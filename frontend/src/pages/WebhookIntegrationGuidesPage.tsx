/**
 * WebhookIntegrationGuidesPage
 * Feature #323: Step-by-step integration guides for n8n, Zapier, and Make
 *
 * Provides detailed documentation for connecting QA Guardian webhooks
 * with popular automation platforms.
 */

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/ui';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

// Webhook event types and their descriptions
const WEBHOOK_EVENTS = [
 { event: 'test.run.started', label: 'Test Run Started', description: 'Fired when a test run begins execution' },
 { event: 'test.run.completed', label: 'Test Run Completed', description: 'Fired when a test run finishes (any result)' },
 { event: 'test.run.failed', label: 'Test Run Failed', description: 'Fired when a test run fails' },
 { event: 'test.run.passed', label: 'Test Run Passed', description: 'Fired when a test run passes' },
 { event: 'test.created', label: 'Test Created', description: 'Fired when a new test is created' },
 { event: 'visual.diff.detected', label: 'Visual Diff Detected', description: 'Fired when visual regression is detected' },
 { event: 'baseline.approved', label: 'Baseline Approved', description: 'Fired when a visual baseline is approved' },
 { event: 'security.vulnerability.found', label: 'Security Vulnerability Found', description: 'Fired when a security scan finds vulnerabilities' },
 { event: 'flaky.test.detected', label: 'Flaky Test Detected', description: 'Fired when a test is identified as flaky' },
 { event: 'schedule.triggered', label: 'Schedule Triggered', description: 'Fired when a scheduled run is triggered' },
 { event: 'performance.budget.exceeded', label: 'Performance Budget Exceeded', description: 'Fired when Lighthouse metrics exceed thresholds' },
 { event: 'accessibility.issue.found', label: 'Accessibility Issue Found', description: 'Fired when accessibility violations are detected' },
];

// Example payload for test.run.completed
const EXAMPLE_PAYLOAD = `{
 "event": "test.run.completed",
 "timestamp": "2024-01-15T14:30:00Z",
 "data": {
 "run_id": "run_abc123",
 "test_id": "test_xyz789",
 "test_name": "Login Flow Test",
 "suite_id": "suite_456",
 "suite_name": "Authentication Suite",
 "project_id": "proj_001",
 "project_name": "My E2E Tests",
 "status": "passed",
 "duration_ms": 4532,
 "browser": "chromium",
 "environment": "staging",
 "results": {
 "passed": 5,
 "failed": 0,
 "skipped": 1,
 "total": 6
 },
 "triggered_by": "schedule",
 "commit_sha": "a1b2c3d4e5f6"
 }
}`;

// HMAC verification code snippets for each platform
const VERIFICATION_CODE = {
 javascript: `// Node.js HMAC Signature Verification
const crypto = require('crypto');

function verifyWebhookSignature(payload, signatureHeader, secret) {
 // Parse signature header: t=timestamp,v1=signature
 const parts = signatureHeader.split(',');
 let timestamp, signature;

 for (const part of parts) {
 const [key, value] = part.split('=');
 if (key === 't') timestamp = value;
 if (key === 'v1') signature = value;
 }

 // Check timestamp is within 5 minutes
 const age = Math.floor(Date.now() / 1000) - parseInt(timestamp);
 if (age > 300) {
 throw new Error('Webhook signature expired');
 }

 // Compute expected signature
 const signedPayload = \`\${timestamp}.\${payload}\`;
 const expectedSignature = crypto
 .createHmac('sha256', secret)
 .update(signedPayload)
 .digest('hex');

 // Timing-safe comparison
 return crypto.timingSafeEqual(
 Buffer.from(signature, 'hex'),
 Buffer.from(expectedSignature, 'hex')
 );
}`,
 python: `# Python HMAC Signature Verification
import hmac
import hashlib
import time

def verify_webhook_signature(payload: str, signature_header: str, secret: str) -> bool:
 # Parse signature header: t=timestamp,v1=signature
 parts = dict(p.split('=') for p in signature_header.split(','))
 timestamp = parts.get('t')
 signature = parts.get('v1')

 # Check timestamp is within 5 minutes
 age = int(time.time()) - int(timestamp)
 if age > 300:
 raise ValueError('Webhook signature expired')

 # Compute expected signature
 signed_payload = f"{timestamp}.{payload}"
 expected_signature = hmac.new(
 secret.encode('utf-8'),
 signed_payload.encode('utf-8'),
 hashlib.sha256
 ).hexdigest()

 # Constant-time comparison
 return hmac.compare_digest(signature, expected_signature)`,
};

type TabType = 'n8n' | 'zapier' | 'make';

export function WebhookIntegrationGuidesPage() {
 const [activeTab, setActiveTab] = useState<TabType>('n8n');
 const [copiedText, setCopiedText] = useState<string | null>(null);

 const copyToClipboard = async (text: string, label: string) => {
 try {
 await navigator.clipboard.writeText(text);
 setCopiedText(label);
 setTimeout(() => setCopiedText(null), 2000);
 } catch (err) {
 console.error('Failed to copy:', err);
 }
 };

 const CopyButton = ({ text, label }: { text: string; label: string }) => (
 <Button
 variant="secondary"
 size="sm"
 onClick={() => copyToClipboard(text, label)}
 className="absolute top-2 right-2 text-xs"
 >
 {copiedText === label ? 'Copied!' : 'Copy'}
 </Button>
 );

 const TabButton = ({ tab, label, icon }: { tab: TabType; label: string; icon: string }) => (
 <Button
 variant="ghost"
 onClick={() => setActiveTab(tab)}
 className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-lg rounded-b-none ${
 activeTab === tab
 ? 'bg-card text-foreground border-b-2 border-primary'
 : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
 }`}
 >
 <span className="text-lg">{icon}</span>
 {label}
 </Button>
 );

 return (
 <Layout>
 <div className="p-8 max-w-6xl mx-auto">
 <PageHeader
   title="Webhook Integration Guides"
   description="Connect QA Guardian webhooks with popular automation platforms like n8n, Zapier, and Make (Integromat)."
   breadcrumbs={[
     { label: 'Home', href: '/' },
     { label: 'Settings', href: '/settings' },
     { label: 'Webhooks', href: '/settings?tab=webhooks' },
     { label: 'Integration Guides' }
   ]}
 />

 {/* Quick Links */}
 <div className="mb-8 p-4 rounded-lg border border-border bg-card">
 <h2 className="text-sm font-semibold text-foreground mb-3">Quick Links</h2>
 <div className="flex flex-wrap gap-3">
 <Link
 to="/settings?tab=webhooks"
 className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
 >
 Configure Webhooks
 </Link>
 <a
 href="#events"
 className="inline-flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/80"
 >
 Event Types
 </a>
 <a
 href="#payload"
 className="inline-flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/80"
 >
 Payload Format
 </a>
 <a
 href="#verification"
 className="inline-flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/80"
 >
 Signature Verification
 </a>
 </div>
 </div>

 {/* Platform Tabs */}
 <div className="mb-8">
 <div className="flex gap-1 border-b border-border">
 <TabButton tab="n8n" label="n8n" icon="🔄" />
 <TabButton tab="zapier" label="Zapier" icon="⚡" />
 <TabButton tab="make" label="Make (Integromat)" icon="🔧" />
 </div>

 <div className="rounded-b-lg border border-t-0 border-border bg-card p-6">
 {/* n8n Guide */}
 {activeTab === 'n8n' && (
 <div className="space-y-6">
 <div>
 <h3 className="text-lg font-semibold text-foreground mb-2">Setting up n8n with QA Guardian</h3>
 <p className="text-muted-foreground">
 n8n is a powerful open-source workflow automation tool. Follow these steps to receive QA Guardian webhooks.
 </p>
 </div>

 <div className="space-y-4">
 <div className="flex gap-4">
 <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
 1
 </div>
 <div>
 <h4 className="font-medium text-foreground">Create a Webhook Node</h4>
 <p className="text-sm text-muted-foreground mt-1">
 In n8n, create a new workflow and add a <strong>Webhook</strong> node as the trigger.
 Set the HTTP Method to <code className="bg-muted px-1 rounded">POST</code>.
 </p>
 </div>
 </div>

 <div className="flex gap-4">
 <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
 2
 </div>
 <div>
 <h4 className="font-medium text-foreground">Copy the Webhook URL</h4>
 <p className="text-sm text-muted-foreground mt-1">
 Click on the Webhook node and copy the <strong>Production URL</strong>. It will look like:
 </p>
 <div className="relative mt-2">
 <code className="block bg-muted p-3 rounded text-sm overflow-x-auto">
 https://your-n8n-instance.com/webhook/abc123-def456
 </code>
 </div>
 </div>
 </div>

 <div className="flex gap-4">
 <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
 3
 </div>
 <div>
 <h4 className="font-medium text-foreground">Configure in QA Guardian</h4>
 <p className="text-sm text-muted-foreground mt-1">
 Go to <Link to="/settings?tab=webhooks" className="text-primary hover:underline">Settings &gt; Webhooks</Link> and create a new webhook.
 Paste the n8n webhook URL and select the events you want to trigger on.
 </p>
 </div>
 </div>

 <div className="flex gap-4">
 <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
 4
 </div>
 <div>
 <h4 className="font-medium text-foreground">Add Signature Verification (Recommended)</h4>
 <p className="text-sm text-muted-foreground mt-1">
 Add a <strong>Code</strong> node after the Webhook to verify the HMAC signature.
 Use the JavaScript code from the <a href="#verification" className="text-primary hover:underline">Verification section</a> below.
 </p>
 </div>
 </div>

 <div className="flex gap-4">
 <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
 5
 </div>
 <div>
 <h4 className="font-medium text-foreground">Build Your Workflow</h4>
 <p className="text-sm text-muted-foreground mt-1">
 Add nodes to process the webhook data - send Slack notifications, create Jira tickets,
 update spreadsheets, or trigger other workflows.
 </p>
 </div>
 </div>
 </div>

 <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
 <h4 className="font-medium text-primary mb-2">Pro Tip</h4>
 <p className="text-sm text-primary">
 Use n8n's <strong>IF</strong> node to filter webhooks by event type (e.g., only process <code>test.run.failed</code> events).
 Access the event type via <code>$json.event</code>.
 </p>
 </div>
 </div>
 )}

 {/* Zapier Guide */}
 {activeTab === 'zapier' && (
 <div className="space-y-6">
 <div>
 <h3 className="text-lg font-semibold text-foreground mb-2">Setting up Zapier with QA Guardian</h3>
 <p className="text-muted-foreground">
 Zapier connects thousands of apps. Use Webhooks by Zapier to receive QA Guardian events.
 </p>
 </div>

 <div className="space-y-4">
 <div className="flex gap-4">
 <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
 1
 </div>
 <div>
 <h4 className="font-medium text-foreground">Create a New Zap</h4>
 <p className="text-sm text-muted-foreground mt-1">
 Go to Zapier and click <strong>Create Zap</strong>. Search for <strong>Webhooks by Zapier</strong> as your trigger app.
 </p>
 </div>
 </div>

 <div className="flex gap-4">
 <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
 2
 </div>
 <div>
 <h4 className="font-medium text-foreground">Choose "Catch Hook"</h4>
 <p className="text-sm text-muted-foreground mt-1">
 Select <strong>Catch Hook</strong> as the trigger event. This creates a unique webhook URL for your Zap.
 </p>
 </div>
 </div>

 <div className="flex gap-4">
 <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
 3
 </div>
 <div>
 <h4 className="font-medium text-foreground">Copy the Custom Webhook URL</h4>
 <p className="text-sm text-muted-foreground mt-1">
 Zapier will provide a unique URL like:
 </p>
 <div className="relative mt-2">
 <code className="block bg-muted p-3 rounded text-sm overflow-x-auto">
 https://hooks.zapier.com/hooks/catch/123456/abcdef/
 </code>
 </div>
 </div>
 </div>

 <div className="flex gap-4">
 <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
 4
 </div>
 <div>
 <h4 className="font-medium text-foreground">Configure in QA Guardian</h4>
 <p className="text-sm text-muted-foreground mt-1">
 Add the Zapier webhook URL in <Link to="/settings?tab=webhooks" className="text-primary hover:underline">Settings &gt; Webhooks</Link>.
 Select which events should trigger the Zap.
 </p>
 </div>
 </div>

 <div className="flex gap-4">
 <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
 5
 </div>
 <div>
 <h4 className="font-medium text-foreground">Test the Webhook</h4>
 <p className="text-sm text-muted-foreground mt-1">
 Run a test in QA Guardian to trigger a webhook. Click <strong>Test Trigger</strong> in Zapier
 to see the sample data and configure your actions.
 </p>
 </div>
 </div>

 <div className="flex gap-4">
 <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
 6
 </div>
 <div>
 <h4 className="font-medium text-foreground">Add Actions</h4>
 <p className="text-sm text-muted-foreground mt-1">
 Add action steps like sending emails, Slack messages, creating tasks in Asana/Trello,
 or updating Google Sheets with test results.
 </p>
 </div>
 </div>
 </div>

 <div className="rounded-lg bg-warning/5 border border-warning/20 p-4">
 <h4 className="font-medium text-warning mb-2">Note on Signature Verification</h4>
 <p className="text-sm text-warning">
 Zapier's Webhooks by Zapier doesn't natively support HMAC signature verification.
 For enhanced security, consider using Zapier's <strong>Code by Zapier</strong> step with JavaScript
 to verify signatures before processing.
 </p>
 </div>
 </div>
 )}

 {/* Make (Integromat) Guide */}
 {activeTab === 'make' && (
 <div className="space-y-6">
 <div>
 <h3 className="text-lg font-semibold text-foreground mb-2">Setting up Make with QA Guardian</h3>
 <p className="text-muted-foreground">
 Make (formerly Integromat) offers powerful visual workflow automation. Here's how to integrate with QA Guardian.
 </p>
 </div>

 <div className="space-y-4">
 <div className="flex gap-4">
 <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
 1
 </div>
 <div>
 <h4 className="font-medium text-foreground">Create a New Scenario</h4>
 <p className="text-sm text-muted-foreground mt-1">
 In Make, create a new scenario and add a <strong>Webhooks</strong> module.
 Select <strong>Custom webhook</strong> as the trigger.
 </p>
 </div>
 </div>

 <div className="flex gap-4">
 <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
 2
 </div>
 <div>
 <h4 className="font-medium text-foreground">Create a Webhook</h4>
 <p className="text-sm text-muted-foreground mt-1">
 Click <strong>Add</strong> to create a new webhook. Give it a name like "QA Guardian Events".
 Make will generate a unique URL:
 </p>
 <div className="relative mt-2">
 <code className="block bg-muted p-3 rounded text-sm overflow-x-auto">
 https://hook.make.com/abcdefghijklmnop
 </code>
 </div>
 </div>
 </div>

 <div className="flex gap-4">
 <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
 3
 </div>
 <div>
 <h4 className="font-medium text-foreground">Configure in QA Guardian</h4>
 <p className="text-sm text-muted-foreground mt-1">
 Add the Make webhook URL in <Link to="/settings?tab=webhooks" className="text-primary hover:underline">Settings &gt; Webhooks</Link>.
 Choose your desired events and optionally add a secret for signature verification.
 </p>
 </div>
 </div>

 <div className="flex gap-4">
 <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
 4
 </div>
 <div>
 <h4 className="font-medium text-foreground">Determine Data Structure</h4>
 <p className="text-sm text-muted-foreground mt-1">
 Trigger a test event from QA Guardian. In Make, click <strong>Redetermine data structure</strong>
 to automatically parse the webhook payload.
 </p>
 </div>
 </div>

 <div className="flex gap-4">
 <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
 5
 </div>
 <div>
 <h4 className="font-medium text-foreground">Add a Router (Optional)</h4>
 <p className="text-sm text-muted-foreground mt-1">
 Use Make's <strong>Router</strong> module to handle different event types.
 Create branches for <code>test.run.failed</code>, <code>visual.diff.detected</code>, etc.
 </p>
 </div>
 </div>

 <div className="flex gap-4">
 <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
 6
 </div>
 <div>
 <h4 className="font-medium text-foreground">Configure Actions</h4>
 <p className="text-sm text-muted-foreground mt-1">
 Add modules to send notifications (Slack, Discord, Teams), create issues (Jira, GitHub),
 or update databases (Airtable, Notion) based on test results.
 </p>
 </div>
 </div>
 </div>

 <div className="rounded-lg bg-success/5 border border-success/20 p-4">
 <h4 className="font-medium text-success mb-2">Make + HMAC Verification</h4>
 <p className="text-sm text-success">
 Make supports custom code via the <strong>Tools &gt; Set Variable</strong> module with JavaScript.
 You can use this to verify HMAC signatures before processing the webhook data.
 </p>
 </div>
 </div>
 )}
 </div>
 </div>

 {/* Webhook Events Section */}
 <div id="events" className="mb-8">
 <h2 className="text-2xl font-bold text-foreground mb-4">Available Webhook Events</h2>
 <p className="text-muted-foreground mb-4">
 Subscribe to any combination of these events when creating a webhook.
 </p>
 <div className="grid gap-3 md:grid-cols-2">
 {WEBHOOK_EVENTS.map(evt => (
 <div key={evt.event} className="rounded-lg border border-border bg-card p-4">
 <div className="flex items-start justify-between">
 <div>
 <code className="text-sm font-mono text-primary">{evt.event}</code>
 <p className="text-sm text-foreground font-medium mt-1">{evt.label}</p>
 <p className="text-xs text-muted-foreground mt-1">{evt.description}</p>
 </div>
 <Button
 variant="ghost"
 size="icon"
 onClick={() => copyToClipboard(evt.event, evt.event)}
 title="Copy event name"
 className="h-8 w-8"
 >
 {copiedText === evt.event ? (
                          <Check className="h-4 w-4 text-success" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
 </Button>
 </div>
 </div>
 ))}
 </div>
 </div>

 {/* Payload Format Section */}
 <div id="payload" className="mb-8">
 <h2 className="text-2xl font-bold text-foreground mb-4">Webhook Payload Format</h2>
 <p className="text-muted-foreground mb-4">
 All webhooks are sent as HTTP POST requests with JSON payloads. Here's an example payload for
 the <code className="bg-muted px-1 rounded">test.run.completed</code> event:
 </p>
 <div className="relative">
 <CopyButton text={EXAMPLE_PAYLOAD} label="payload" />
 <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
 <code>{EXAMPLE_PAYLOAD}</code>
 </pre>
 </div>

 <div className="mt-6 space-y-4">
 <h3 className="text-lg font-semibold text-foreground">HTTP Headers</h3>
 <p className="text-muted-foreground">Each webhook request includes these headers:</p>
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b border-border">
 <th className="text-left py-2 px-4 font-medium text-foreground">Header</th>
 <th className="text-left py-2 px-4 font-medium text-foreground">Description</th>
 <th className="text-left py-2 px-4 font-medium text-foreground">Example</th>
 </tr>
 </thead>
 <tbody>
 <tr className="border-b border-border">
 <td className="py-2 px-4 font-mono text-sm">Content-Type</td>
 <td className="py-2 px-4 text-muted-foreground">Always JSON</td>
 <td className="py-2 px-4 font-mono text-sm">application/json</td>
 </tr>
 <tr className="border-b border-border">
 <td className="py-2 px-4 font-mono text-sm">X-Webhook-Event</td>
 <td className="py-2 px-4 text-muted-foreground">Event type</td>
 <td className="py-2 px-4 font-mono text-sm">test.run.completed</td>
 </tr>
 <tr className="border-b border-border">
 <td className="py-2 px-4 font-mono text-sm">X-Webhook-Delivery</td>
 <td className="py-2 px-4 text-muted-foreground">Unique delivery ID</td>
 <td className="py-2 px-4 font-mono text-sm">del_1705329000_abc123</td>
 </tr>
 <tr className="border-b border-border">
 <td className="py-2 px-4 font-mono text-sm">X-Webhook-Attempt</td>
 <td className="py-2 px-4 text-muted-foreground">Retry attempt number</td>
 <td className="py-2 px-4 font-mono text-sm">1</td>
 </tr>
 <tr className="border-b border-border">
 <td className="py-2 px-4 font-mono text-sm">X-Webhook-Signature</td>
 <td className="py-2 px-4 text-muted-foreground">HMAC signature (if secret configured)</td>
 <td className="py-2 px-4 font-mono text-sm">t=1705329000,v1=abc...</td>
 </tr>
 </tbody>
 </table>
 </div>
 </div>
 </div>

 {/* Signature Verification Section */}
 <div id="verification" className="mb-8">
 <h2 className="text-2xl font-bold text-foreground mb-4">HMAC Signature Verification</h2>
 <p className="text-muted-foreground mb-4">
 When you configure a secret for your webhook, QA Guardian signs each request using HMAC-SHA256.
 The signature is included in the <code className="bg-muted px-1 rounded">X-Webhook-Signature</code> header
 in Stripe-compatible format: <code className="bg-muted px-1 rounded">t=timestamp,v1=signature</code>.
 </p>

 <div className="space-y-6">
 <div>
 <h3 className="text-lg font-semibold text-foreground mb-3">JavaScript / Node.js</h3>
 <div className="relative">
 <CopyButton text={VERIFICATION_CODE.javascript} label="js-code" />
 <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm max-h-96">
 <code>{VERIFICATION_CODE.javascript}</code>
 </pre>
 </div>
 </div>

 <div>
 <h3 className="text-lg font-semibold text-foreground mb-3">Python</h3>
 <div className="relative">
 <CopyButton text={VERIFICATION_CODE.python} label="py-code" />
 <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm max-h-96">
 <code>{VERIFICATION_CODE.python}</code>
 </pre>
 </div>
 </div>
 </div>

 <div className="mt-6 rounded-lg bg-destructive/5 border border-destructive/20 p-4">
 <h4 className="font-medium text-destructive mb-2">Security Best Practices</h4>
 <ul className="text-sm text-destructive list-disc list-inside space-y-1">
 <li>Always verify the signature before processing webhook data</li>
 <li>Use a strong, randomly generated secret (32+ characters)</li>
 <li>Reject requests with timestamps older than 5 minutes (replay protection)</li>
 <li>Use timing-safe comparison to prevent timing attacks</li>
 <li>Store your webhook secret securely (environment variables, secrets manager)</li>
 </ul>
 </div>
 </div>

 {/* Footer */}
 <div className="mt-12 pt-8 border-t border-border text-center text-muted-foreground">
 <p>
 Need help? Check our{' '}
 <a href="https://docs.qa-guardian.com" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
 documentation
 </a>{' '}
 or{' '}
 <a href="mailto:support@qa-guardian.com" className="text-primary hover:underline">
 contact support
 </a>.
 </p>
 </div>
 </div>
 </Layout>
 );
}
