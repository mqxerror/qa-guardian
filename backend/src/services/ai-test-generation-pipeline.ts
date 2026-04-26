/**
 * AI Test Generation Pipeline (Phase 2)
 *
 * Replaces the single-shot "write me a test" prompt with a grounded,
 * multi-turn pipeline:
 *   1. Recon  — fetch target URL and extract DOM skeleton (title, forms,
 *               buttons, links, inputs, navigation, page type).
 *   2. Plan   — ask the AI to propose a structured test plan (steps +
 *               selectors + assertions) grounded in the REAL DOM.
 *   3. Codegen — ask the AI to emit Playwright code that executes the plan.
 *
 * Why this beats single-shot prompting: the model no longer has to guess
 * what elements exist on a page it has never seen. Selectors reference
 * real labels/roles. Assertions cite real headings/text.
 *
 * Designed to fail safe: if recon fails (site down, timeout, no DOM), or
 * the plan turn returns malformed JSON, we surface the reason and let the
 * caller fall back to the original single-shot path.
 */

import { aiRouter } from './providers/ai-router.js';
import { modelSelector } from './providers/model-selector.js';
import { analyzeSite, type SiteAnalysis } from './crawl4ai.js';
import { createLogger } from './logger.js';

const log = createLogger('ai-test-generation-pipeline');

// =============================================================================
// Types
// =============================================================================

/** Plain-JSON plan emitted by the LLM in the Plan turn */
export interface TestPlan {
  name: string;
  goal: string;
  steps: Array<{
    action: 'navigate' | 'click' | 'fill' | 'select' | 'hover' | 'wait' | 'assert' | 'screenshot';
    /** Human-readable description */
    description: string;
    /** For click/fill/select/hover — Playwright locator expression (role-based preferred) */
    selector?: string;
    /** For fill/select — the value */
    value?: string;
    /** For assert — what to check */
    assertion?: string;
  }>;
  assertions: string[];
  risks?: string[];
}

export interface PipelineResult {
  success: boolean;
  /** Final Playwright code. Present on success. */
  code?: string;
  plan?: TestPlan;
  recon?: SiteAnalysis;
  /** Step-by-step summary for the UI */
  steps?: string[];
  /** Meta: which turn failed, if any */
  failedAt?: 'recon' | 'plan' | 'codegen';
  error?: string;
  /** Provider / model / token / latency info from the underlying AI calls */
  aiMeta: {
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    usedFallback: boolean;
    fallbackReason?: string;
    latencyMs: number;
    /** Which turns called the AI — for debugging */
    turns: string[];
  };
  /** Derived confidence (0..1) */
  confidenceScore?: number;
  /** Why we got this confidence — shown in the UI */
  confidenceReasons?: string[];
}

// =============================================================================
// Recon cache — avoid hammering target sites on repeated generations
// =============================================================================

interface ReconCacheEntry { analysis: SiteAnalysis; expiresAt: number }
const reconCache = new Map<string, ReconCacheEntry>();
const RECON_TTL_MS = 5 * 60 * 1000; // 5 minutes
const RECON_MAX_SIZE = 50;

function getCachedRecon(url: string): SiteAnalysis | null {
  const entry = reconCache.get(url);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    reconCache.delete(url);
    return null;
  }
  return entry.analysis;
}

function cacheRecon(url: string, analysis: SiteAnalysis): void {
  if (reconCache.size >= RECON_MAX_SIZE) {
    const oldestKey = reconCache.keys().next().value;
    if (oldestKey !== undefined) reconCache.delete(oldestKey);
  }
  reconCache.set(url, { analysis, expiresAt: Date.now() + RECON_TTL_MS });
}

// =============================================================================
// DOM serialization — compact, prompt-friendly
// =============================================================================

/**
 * Render the site analysis as a compact text block the LLM can consume.
 * We keep it under ~1500 tokens even for dense pages by capping each list.
 */
export function serializeReconForPrompt(recon: SiteAnalysis): string {
  const lines: string[] = [];
  lines.push(`URL: ${recon.url}`);
  lines.push(`Title: ${recon.title}`);
  lines.push(`PageType: ${recon.pageType}`);
  if (recon.hasLogin || recon.hasSearch || recon.hasCart) {
    const flags: string[] = [];
    if (recon.hasLogin) flags.push('login');
    if (recon.hasSearch) flags.push('search');
    if (recon.hasCart) flags.push('cart');
    lines.push(`Features: ${flags.join(', ')}`);
  }
  if (recon.navigation) {
    const nav: string[] = [];
    if (recon.navigation.hasHeader) nav.push('header');
    if (recon.navigation.hasFooter) nav.push('footer');
    if (recon.navigation.hasSidebar) nav.push('sidebar');
    lines.push(`Layout: ${nav.join(', ') || 'none'}`);
    if (recon.navigation.menuItems?.length) {
      lines.push(`Menu: ${recon.navigation.menuItems.slice(0, 10).map(m => JSON.stringify(m)).join(', ')}`);
    }
  }
  if (recon.forms.length) {
    lines.push(`Forms (${recon.forms.length}):`);
    for (const f of recon.forms.slice(0, 5)) {
      lines.push(`  - action=${JSON.stringify(f.action || '/')} method=${f.method} fields=[${f.fields.slice(0, 10).join(', ')}]`);
    }
  }
  if (recon.inputs.length) {
    lines.push(`Inputs (showing up to 15):`);
    for (const i of recon.inputs.slice(0, 15)) {
      const desc = [
        i.label ? `label="${i.label}"` : null,
        i.name ? `name="${i.name}"` : null,
        `type=${i.type}`,
        i.placeholder ? `placeholder="${i.placeholder}"` : null,
        i.required ? 'required' : null,
      ].filter(Boolean).join(' ');
      lines.push(`  - ${desc}`);
    }
  }
  if (recon.buttons.length) {
    lines.push(`Buttons (showing up to 15):`);
    for (const b of recon.buttons.slice(0, 15)) {
      const submit = b.isSubmit ? ' [submit]' : '';
      lines.push(`  - ${JSON.stringify(b.text)}${submit}`);
    }
  }
  if (recon.links.length) {
    lines.push(`Key links (showing up to 12):`);
    const nav = recon.links.filter(l => l.category === 'nav').slice(0, 8);
    const rest = recon.links.filter(l => l.category !== 'nav').slice(0, 4);
    for (const l of [...nav, ...rest]) {
      lines.push(`  - ${JSON.stringify(l.text)} → ${l.href}${l.isExternal ? ' [ext]' : ''}`);
    }
  }
  return lines.join('\n');
}

// =============================================================================
// JSON extraction — the LLM sometimes wraps JSON in fences or prose
// =============================================================================

function extractJson(content: string): unknown {
  // Prefer fenced ```json blocks
  const fence = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1] : content;
  // Find the first { ... } block at top level
  const braceStart = candidate.indexOf('{');
  if (braceStart < 0) throw new Error('No JSON object found in response');
  // Scan for matching close brace
  let depth = 0;
  let end = -1;
  for (let i = braceStart; i < candidate.length; i++) {
    const ch = candidate[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end < 0) throw new Error('Unterminated JSON object');
  const slice = candidate.slice(braceStart, end + 1);
  return JSON.parse(slice);
}

function validatePlan(plan: unknown): TestPlan {
  if (!plan || typeof plan !== 'object') throw new Error('Plan is not an object');
  const p = plan as Record<string, unknown>;
  if (typeof p.name !== 'string' || !Array.isArray(p.steps) || p.steps.length === 0) {
    throw new Error('Plan missing required fields (name, steps[])');
  }
  // Coerce assertions to array of strings
  const assertions = Array.isArray(p.assertions) ? p.assertions.filter(a => typeof a === 'string') : [];
  return {
    name: p.name,
    goal: typeof p.goal === 'string' ? p.goal : '',
    steps: (p.steps as Array<Record<string, unknown>>).map(s => ({
      action: (s.action as TestPlan['steps'][number]['action']) || 'click',
      description: typeof s.description === 'string' ? s.description : '',
      selector: typeof s.selector === 'string' ? s.selector : undefined,
      value: typeof s.value === 'string' ? s.value : undefined,
      assertion: typeof s.assertion === 'string' ? s.assertion : undefined,
    })),
    assertions,
    risks: Array.isArray(p.risks) ? p.risks.filter(r => typeof r === 'string') as string[] : undefined,
  };
}

// =============================================================================
// Prompt templates
// =============================================================================

const PLAN_SYSTEM = `You are a senior QA engineer producing a structured test plan.
Output ONLY a single JSON object matching this TypeScript interface — no prose, no code fences:

{
  "name": string,                    // short test name (5-60 chars)
  "goal": string,                    // one-sentence goal
  "steps": Array<{
    "action": "navigate" | "click" | "fill" | "select" | "hover" | "wait" | "assert" | "screenshot",
    "description": string,           // human-readable description
    "selector"?: string,             // Playwright locator (prefer getByRole, getByLabel, getByText)
    "value"?: string,                // for fill/select
    "assertion"?: string             // for assert
  }>,
  "assertions": string[],            // high-level success criteria
  "risks"?: string[]                 // things that might make the test flaky
}

Rules:
- Base every selector on elements that ACTUALLY exist in the supplied DOM snapshot.
- Prefer getByRole('button', { name: /.../ }), getByLabel, getByText — avoid CSS/XPath.
- Include at least one meaningful assertion (not just "page loaded").
- 3-8 steps is ideal. Do not generate tests that navigate to pages you cannot confirm exist.`;

const CODEGEN_SYSTEM = `You are a senior Playwright engineer converting a structured plan into runnable TypeScript.
Output ONLY the code inside a single \`\`\`typescript fence. No explanation.

Rules:
- Use modern Playwright best practices: @playwright/test, getByRole/getByLabel/getByText, web-first assertions.
- Follow the plan's steps in order; each step should map to 1-3 lines of code.
- Start with: import { test, expect } from '@playwright/test';
- Use the test name from the plan.
- Include meaningful assertions (toBeVisible, toHaveURL, toHaveText).
- Handle common waits implicitly via web-first assertions (no hard-coded waitForTimeout).
- Do not include commentary or placeholder data — use values from the plan.`;

// =============================================================================
// Pipeline
// =============================================================================

export interface PipelineOptions {
  description: string;
  targetUrl: string;
  /** Whether to run Playwright for recon (true) or fall back to HTTP-only (false). Default true. */
  usePlaywrightRecon?: boolean;
  /** Preferred model (passed through to the router — Kie/Anthropic). */
  model?: string;
}

export async function runGenerationPipeline(options: PipelineOptions): Promise<PipelineResult> {
  const { description, targetUrl, usePlaywrightRecon = true } = options;
  const startedAt = Date.now();

  // Aggregate AI metrics across both turns
  let aggInput = 0, aggOutput = 0, aggLatency = 0;
  let provider = 'unknown';
  let model = options.model || 'unknown';
  let usedFallback = false;
  let fallbackReason: string | undefined;
  const turns: string[] = [];

  // -------------------------------------------------------------------------
  // 1. Recon
  // -------------------------------------------------------------------------
  let recon: SiteAnalysis | null = getCachedRecon(targetUrl);
  if (!recon) {
    try {
      recon = await analyzeSite(targetUrl, usePlaywrightRecon);
      cacheRecon(targetUrl, recon);
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Recon threw';
      log.warn({ url: targetUrl, error }, 'DOM recon failed — pipeline cannot proceed');
      return {
        success: false,
        failedAt: 'recon',
        error,
        aiMeta: { provider, model, inputTokens: 0, outputTokens: 0, usedFallback: false, latencyMs: Date.now() - startedAt, turns },
      };
    }
  }

  // If recon returned an empty shell (timeout, 403, etc.) we bail — the AI
  // has nothing to ground against and would just hallucinate selectors.
  if (!recon.title && recon.buttons.length === 0 && recon.forms.length === 0 && recon.links.length === 0) {
    return {
      success: false,
      failedAt: 'recon',
      recon,
      error: 'Recon returned an empty DOM (site may be gated or JS-rendered beyond recon reach).',
      aiMeta: { provider, model, inputTokens: 0, outputTokens: 0, usedFallback: false, latencyMs: Date.now() - startedAt, turns },
    };
  }

  const reconSummary = serializeReconForPrompt(recon);

  // -------------------------------------------------------------------------
  // 2. Plan turn
  // -------------------------------------------------------------------------
  const modelConfig = options.model
    ? { model: options.model, tier: 'fast' as const }
    : modelSelector.getModelForFeature('test_generation');
  let plan: TestPlan;
  try {
    const planResp = await aiRouter.sendMessage(
      [{
        role: 'user',
        content: `# Task\n${description}\n\n# Site snapshot\n${reconSummary}\n\nProduce the JSON test plan now.`,
      }],
      {
        model: modelConfig.model,
        maxTokens: 1500,
        temperature: 0.2,
        systemPrompt: PLAN_SYSTEM,
        // P2.3: feature hint enables smart routing — the router picks the
        // configured provider for test_generation (DeepSeek V4 Pro by default).
        feature: 'test_generation',
      },
    );
    turns.push('plan');
    aggInput += planResp.inputTokens;
    aggOutput += planResp.outputTokens;
    aggLatency += planResp.latencyMs ?? 0;
    provider = planResp.actualProvider || provider;
    model = planResp.model;
    if (planResp.usedFallback) { usedFallback = true; fallbackReason = planResp.fallbackReason; }

    const raw = extractJson(planResp.content);
    plan = validatePlan(raw);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    log.warn({ error }, 'Plan turn failed');
    return {
      success: false,
      failedAt: 'plan',
      recon,
      error,
      aiMeta: { provider, model, inputTokens: aggInput, outputTokens: aggOutput, usedFallback, fallbackReason, latencyMs: aggLatency || Date.now() - startedAt, turns },
    };
  }

  // -------------------------------------------------------------------------
  // 3. Codegen turn
  // -------------------------------------------------------------------------
  let code: string;
  try {
    const codegenResp = await aiRouter.sendMessage(
      [{
        role: 'user',
        content: `# Test plan (JSON)\n${JSON.stringify(plan, null, 2)}\n\n# Target URL\n${targetUrl}\n\nEmit the runnable Playwright TypeScript now.`,
      }],
      {
        model: modelConfig.model,
        maxTokens: 2000,
        temperature: 0.2,
        systemPrompt: CODEGEN_SYSTEM,
        // P2.3: same feature hint for codegen turn
        feature: 'test_generation',
      },
    );
    turns.push('codegen');
    aggInput += codegenResp.inputTokens;
    aggOutput += codegenResp.outputTokens;
    aggLatency += codegenResp.latencyMs ?? 0;
    // Latest provider/model wins (in case failover happened in codegen)
    provider = codegenResp.actualProvider || provider;
    model = codegenResp.model || model;
    if (codegenResp.usedFallback) { usedFallback = true; fallbackReason = codegenResp.fallbackReason; }

    const fence = codegenResp.content.match(/```(?:typescript|ts|javascript|js)?\s*([\s\S]*?)```/);
    code = (fence ? fence[1] : codegenResp.content).trim();
    if (!code.includes('import') && !code.includes('require')) {
      code = `import { test, expect } from '@playwright/test';\n\n${code}`;
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    log.warn({ error }, 'Codegen turn failed');
    return {
      success: false,
      failedAt: 'codegen',
      recon,
      plan,
      error,
      aiMeta: { provider, model, inputTokens: aggInput, outputTokens: aggOutput, usedFallback, fallbackReason, latencyMs: aggLatency || Date.now() - startedAt, turns },
    };
  }

  // -------------------------------------------------------------------------
  // 4. Score confidence based on observable signals
  // -------------------------------------------------------------------------
  const { confidence, reasons } = scoreConfidence(plan, code, recon);

  return {
    success: true,
    code,
    plan,
    recon,
    steps: plan.steps.map(s => s.description),
    confidenceScore: confidence,
    confidenceReasons: reasons,
    aiMeta: {
      provider,
      model,
      inputTokens: aggInput,
      outputTokens: aggOutput,
      usedFallback,
      fallbackReason,
      latencyMs: aggLatency || Date.now() - startedAt,
      turns,
    },
  };
}

// =============================================================================
// Confidence scoring — observable, not LLM-declared
// =============================================================================

function scoreConfidence(plan: TestPlan, code: string, recon: SiteAnalysis): { confidence: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0.5;

  // +0.15 if the plan has >= 3 steps
  if (plan.steps.length >= 3) { score += 0.15; reasons.push(`Plan has ${plan.steps.length} steps`); }
  else reasons.push(`Plan only has ${plan.steps.length} step(s)`);

  // +0.15 if the code uses role-based locators (best-practice)
  const roleHits = (code.match(/getByRole|getByLabel|getByText/g) || []).length;
  if (roleHits >= 2) { score += 0.15; reasons.push(`${roleHits} role-based selectors (preferred)`); }
  else reasons.push('Few role-based selectors — may be brittle');

  // +0.1 if there are assertions
  const assertHits = (code.match(/expect\(/g) || []).length;
  if (assertHits >= 2) { score += 0.1; reasons.push(`${assertHits} assertions in generated code`); }
  else reasons.push(`Only ${assertHits} assertion(s)`);

  // +0.1 if recon has substance (title + > 3 interactive elements)
  const totalElements = recon.buttons.length + recon.inputs.length + recon.forms.length;
  if (recon.title && totalElements >= 4) { score += 0.1; reasons.push(`Grounded in ${totalElements} real DOM elements`); }
  else reasons.push('Thin DOM recon — low grounding');

  // -0.2 if the code still contains obvious placeholders
  if (/YOUR_EMAIL_HERE|YOUR_PASSWORD|PLACEHOLDER/i.test(code)) {
    score -= 0.2;
    reasons.push('Code contains placeholder values — AI could not ground them');
  }

  return { confidence: Math.max(0.1, Math.min(0.95, score)), reasons };
}
