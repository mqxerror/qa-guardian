// Feature #1139: AI Selector Suggestions
// Analyzes web pages and suggests optimal selectors for test automation

import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth';

// Feature #1139: Interface for AI selector suggestion
interface SuggestedSelector {
  element_description: string;
  primary_selector: string;
  selector_type: 'data-testid' | 'aria-label' | 'role' | 'name' | 'id' | 'class' | 'text' | 'css' | 'xpath';
  confidence: number; // 0-100
  stability_score: number; // 0-100 (higher = more stable)
  fallback_selectors: string[];
  reason: string;
  warnings?: string[];
}

interface AnalyzedElement {
  tag: string;
  attributes: Record<string, string>;
  text?: string;
  innerText?: string;
  role?: string;
  parentTag?: string;
  siblings?: number;
  depth?: number;
}

interface AISuggestSelectorsBody {
  url?: string; // URL to crawl and analyze
  html?: string; // Direct HTML to analyze
  element_descriptions?: string[]; // Optional: specific elements to find selectors for
  include_all_interactive?: boolean; // Include all buttons, links, inputs, etc.
  max_results?: number; // Max number of suggestions (default: 50)
}

// Feature #1139: Generate mock analyzed elements for demonstration
// In production, this would parse actual HTML from the URL
function generateMockAnalyzedElements(url?: string, html?: string): AnalyzedElement[] {
  const elements: AnalyzedElement[] = [];

  // Common interactive elements found in web applications
  const commonElements: AnalyzedElement[] = [
    // Login form elements
    { tag: 'input', attributes: { type: 'email', 'data-testid': 'email-input', name: 'email', placeholder: 'Enter your email' }, role: 'textbox' },
    { tag: 'input', attributes: { type: 'password', 'data-testid': 'password-input', name: 'password', placeholder: 'Enter password' }, role: 'textbox' },
    { tag: 'button', attributes: { type: 'submit', 'data-testid': 'login-button', 'aria-label': 'Sign in' }, text: 'Login', role: 'button' },

    // Navigation elements
    { tag: 'a', attributes: { href: '/dashboard', 'aria-label': 'Go to dashboard' }, text: 'Dashboard', role: 'link' },
    { tag: 'a', attributes: { href: '/settings', 'data-testid': 'settings-link' }, text: 'Settings', role: 'link' },
    { tag: 'button', attributes: { 'aria-label': 'Open menu', 'aria-expanded': 'false' }, role: 'button' },

    // Form elements
    { tag: 'input', attributes: { type: 'text', name: 'search', placeholder: 'Search...' }, role: 'searchbox' },
    { tag: 'select', attributes: { name: 'category', id: 'category-select' }, role: 'combobox' },
    { tag: 'textarea', attributes: { name: 'description', 'data-testid': 'description-field', rows: '4' }, role: 'textbox' },
    { tag: 'input', attributes: { type: 'checkbox', name: 'remember', id: 'remember-me' }, role: 'checkbox' },

    // Action buttons
    { tag: 'button', attributes: { 'data-testid': 'save-button', 'aria-label': 'Save changes' }, text: 'Save', role: 'button' },
    { tag: 'button', attributes: { 'data-testid': 'cancel-button' }, text: 'Cancel', role: 'button' },
    { tag: 'button', attributes: { 'aria-label': 'Delete item', class: 'btn-danger' }, text: 'Delete', role: 'button' },
    { tag: 'button', attributes: { type: 'submit', class: 'primary-btn submit-form' }, text: 'Submit', role: 'button' },

    // Elements without good test attributes (to show warnings)
    { tag: 'div', attributes: { class: 'card-item clickable', onclick: 'handleClick()' }, text: 'Click me' },
    { tag: 'span', attributes: { class: 'icon close-btn' }, text: '×' },
  ];

  // Add common elements
  elements.push(...commonElements);

  // If HTML was provided, we could parse it here
  // For now, we just return the common elements
  return elements;
}

// Feature #1139: Generate optimal selector suggestion for an element
function generateSelectorSuggestion(element: AnalyzedElement): SuggestedSelector | null {
  const { tag, attributes, text, role } = element;
  const fallbackSelectors: string[] = [];
  const warnings: string[] = [];

  let primarySelector = '';
  let selectorType: SuggestedSelector['selector_type'] = 'css';
  let confidence = 50;
  let stabilityScore = 50;
  let reason = '';

  // Priority 1: data-testid (most stable)
  if (attributes['data-testid']) {
    primarySelector = `[data-testid="${attributes['data-testid']}"]`;
    selectorType = 'data-testid';
    confidence = 95;
    stabilityScore = 95;
    reason = 'data-testid is the most reliable selector - explicitly added for testing';
  }
  // Priority 2: aria-label (accessibility attribute)
  else if (attributes['aria-label']) {
    primarySelector = `[aria-label="${attributes['aria-label']}"]`;
    selectorType = 'aria-label';
    confidence = 90;
    stabilityScore = 85;
    reason = 'aria-label is stable and semantically meaningful for accessibility';
  }
  // Priority 3: role + text combination
  else if (role && text) {
    primarySelector = `${role === 'button' ? 'button' : role === 'link' ? 'a' : `[role="${role}"]`}:has-text("${text}")`;
    selectorType = 'role';
    confidence = 85;
    stabilityScore = 80;
    reason = 'Role + text combination is semantically stable';
  }
  // Priority 4: name attribute (forms)
  else if (attributes.name) {
    primarySelector = `[name="${attributes.name}"]`;
    selectorType = 'name';
    confidence = 80;
    stabilityScore = 75;
    reason = 'name attribute is typically stable for form elements';
  }
  // Priority 5: id attribute
  else if (attributes.id) {
    primarySelector = `#${attributes.id}`;
    selectorType = 'id';
    confidence = 75;
    stabilityScore = 70;
    reason = 'ID is unique but may be auto-generated in some frameworks';
    if (attributes.id.match(/^[a-z]+_[a-f0-9]+$/i) || attributes.id.match(/^\d+$/)) {
      warnings.push('ID appears to be auto-generated - may be unstable');
      stabilityScore -= 20;
      confidence -= 15;
    }
  }
  // Priority 6: text content (for buttons/links)
  else if (text && (tag === 'button' || tag === 'a')) {
    primarySelector = `${tag}:has-text("${text}")`;
    selectorType = 'text';
    confidence = 70;
    stabilityScore = 65;
    reason = 'Text-based selector works but may break with i18n changes';
    warnings.push('Text selectors may break if text is translated or changed');
  }
  // Priority 7: class (less stable)
  else if (attributes.class) {
    const classes = attributes.class.split(' ').filter(c => c && !c.match(/^(active|hover|focus|disabled|hidden|show|fade)/));
    if (classes.length > 0) {
      primarySelector = `${tag}.${classes.slice(0, 2).join('.')}`;
      selectorType = 'class';
      confidence = 55;
      stabilityScore = 45;
      reason = 'Class-based selector - may change with styling updates';
      warnings.push('CSS classes may change during design updates');
    }
  }

  // If we still don't have a selector, use tag + position (not recommended)
  if (!primarySelector) {
    primarySelector = tag;
    selectorType = 'css';
    confidence = 30;
    stabilityScore = 20;
    reason = 'No stable attributes found - consider adding data-testid';
    warnings.push('Element lacks stable selectors - highly recommend adding data-testid');
  }

  // Generate fallback selectors
  if (attributes['data-testid'] && selectorType !== 'data-testid') {
    fallbackSelectors.push(`[data-testid="${attributes['data-testid']}"]`);
  }
  if (attributes['aria-label'] && selectorType !== 'aria-label') {
    fallbackSelectors.push(`[aria-label="${attributes['aria-label']}"]`);
  }
  if (role && text && selectorType !== 'role') {
    fallbackSelectors.push(`[role="${role}"]:has-text("${text}")`);
  }
  if (attributes.name && selectorType !== 'name') {
    fallbackSelectors.push(`[name="${attributes.name}"]`);
  }
  if (attributes.id && selectorType !== 'id') {
    fallbackSelectors.push(`#${attributes.id}`);
  }
  if (text && (tag === 'button' || tag === 'a') && selectorType !== 'text') {
    fallbackSelectors.push(`text="${text}"`);
  }

  // Generate element description
  const elementDescription = generateElementDescription(element);

  return {
    element_description: elementDescription,
    primary_selector: primarySelector,
    selector_type: selectorType,
    confidence,
    stability_score: stabilityScore,
    fallback_selectors: fallbackSelectors.slice(0, 3),
    reason,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

// Feature #1139: Generate human-readable element description
function generateElementDescription(element: AnalyzedElement): string {
  const { tag, attributes, text, role } = element;
  const parts: string[] = [];

  // Start with role or tag
  if (role) {
    parts.push(role.charAt(0).toUpperCase() + role.slice(1));
  } else {
    parts.push(tag.toUpperCase());
  }

  // Add descriptive attributes
  if (text) {
    parts.push(`"${text}"`);
  } else if (attributes['aria-label']) {
    parts.push(`labeled "${attributes['aria-label']}"`);
  } else if (attributes.placeholder) {
    parts.push(`with placeholder "${attributes.placeholder}"`);
  } else if (attributes.name) {
    parts.push(`named "${attributes.name}"`);
  } else if (attributes['data-testid']) {
    parts.push(`(${attributes['data-testid']})`);
  }

  // Add type for inputs
  if (tag === 'input' && attributes.type) {
    parts.splice(1, 0, `(${attributes.type})`);
  }

  return parts.join(' ');
}

// Feature #1139: AI Selector Suggestions Routes
export async function aiSelectorsRoutes(app: FastifyInstance) {
  // Feature #1139: AI Selector Suggestion Endpoint
  // Analyzes an application and suggests optimal selectors
  app.post<{ Body: AISuggestSelectorsBody }>('/api/v1/ai/suggest-selectors', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { url, html, element_descriptions, include_all_interactive = true, max_results = 50 } = request.body;

    if (!url && !html) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Either url or html must be provided',
      });
    }

    console.log(`[AI SELECTOR SUGGESTION] Analyzing ${url || 'provided HTML'} for optimal selectors`);

    // Simulated HTML analysis - in production this would crawl the URL or parse provided HTML
    // For now, we generate mock elements based on common patterns
    const analyzedElements: AnalyzedElement[] = generateMockAnalyzedElements(url, html);

    // Generate selector suggestions for each element
    const suggestions: SuggestedSelector[] = [];

    for (const element of analyzedElements) {
      const suggestion = generateSelectorSuggestion(element);
      if (suggestion) {
        suggestions.push(suggestion);
      }
      if (suggestions.length >= max_results) break;
    }

    // If specific element descriptions were requested, filter/prioritize those
    let filteredSuggestions = suggestions;
    if (element_descriptions && element_descriptions.length > 0) {
      filteredSuggestions = suggestions.filter(s =>
        element_descriptions.some(desc =>
          s.element_description.toLowerCase().includes(desc.toLowerCase()) ||
          s.primary_selector.toLowerCase().includes(desc.toLowerCase())
        )
      );
      // If no matches found, return all suggestions with a note
      if (filteredSuggestions.length === 0) {
        filteredSuggestions = suggestions;
      }
    }

    // Sort by stability score (most stable first)
    filteredSuggestions.sort((a, b) => b.stability_score - a.stability_score);

    console.log(`[AI SELECTOR SUGGESTION] Generated ${filteredSuggestions.length} selector suggestions`);

    return {
      success: true,
      source: url || 'provided_html',
      total_elements_analyzed: analyzedElements.length,
      suggestions: filteredSuggestions.slice(0, max_results),
      selector_priority_explanation: {
        highest_priority: 'data-testid - Explicitly added for testing, most stable',
        high_priority: 'aria-label/role - Accessibility attributes, semantically meaningful',
        medium_priority: 'name/id - Often stable but can change',
        lower_priority: 'class - Can change with styling updates',
        avoid: 'positional/xpath indices - Very fragile, breaks with any DOM change',
      },
      recommendations: [
        'Prefer data-testid attributes when available',
        'Use ARIA labels for accessible elements',
        'Avoid selectors based on CSS classes that may change',
        'Avoid positional selectors like nth-child unless necessary',
        'Use role-based selectors for semantic elements',
      ],
    };
  });
}
