// QAChatWidget - Extracted from App.tsx
// Feature #1441: Split App.tsx into logical modules
import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  data?: {
    type: 'test_results' | 'explanation' | 'action_result' | 'text';
    tests?: Array<{
      id: string;
      name: string;
      status: 'passed' | 'failed' | 'flaky';
      suite: string;
      duration: number;
      error?: string;
      timestamp: string;
    }>;
    explanation?: {
      summary: string;
      root_cause: string;
      evidence: string[];
      fix_suggestion: string;
    };
    action?: {
      type: 'fix_applied' | 'test_triggered' | 'test_running' | 'test_completed';
      details: string;
      success?: boolean;
    };
  };
}

function QAChatWidget() {
  const { user, token } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [runningTestSuite, setRunningTestSuite] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Add welcome message when chat opens for first time
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: '1',
        role: 'assistant',
        content: `👋 Hi ${user?.name || 'there'}! I'm your QA Assistant. I can help you with:\n\n• **Show test results** - "Show me failed tests from yesterday"\n• **Explain failures** - "Why did the login test fail?"\n• **Take actions** - "Fix it and run again"\n• **View analytics** - "What's our pass rate this week?"\n\nHow can I help you today?`,
        timestamp: new Date(),
        data: { type: 'text' }
      }]);
    }
  }, [isOpen, messages.length, user?.name]);

  const processUserMessage = async (userMessage: string) => {
    const lowerMessage = userMessage.toLowerCase();

    // Simulate AI processing delay
    setIsTyping(true);
    await new Promise(resolve => setTimeout(resolve, 1500));

    let response: ChatMessage;

    // Pattern: Show failed tests from yesterday/today/this week
    if (lowerMessage.includes('failed tests') || lowerMessage.includes('show me') && lowerMessage.includes('test')) {
      const timeframe = lowerMessage.includes('yesterday') ? 'yesterday' :
                       lowerMessage.includes('today') ? 'today' :
                       lowerMessage.includes('week') ? 'this week' : 'recently';

      response = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `📊 Here are the failed tests from ${timeframe}:`,
        timestamp: new Date(),
        data: {
          type: 'test_results',
          tests: [
            { id: 'test-1', name: 'Login flow - valid credentials', status: 'failed', suite: 'Auth Suite', duration: 3.2, error: 'Element not found: #login-button', timestamp: '2026-01-15T14:30:00Z' },
            { id: 'test-2', name: 'User registration - email validation', status: 'failed', suite: 'Auth Suite', duration: 2.8, error: 'Timeout waiting for validation message', timestamp: '2026-01-15T14:32:00Z' },
            { id: 'test-3', name: 'Dashboard load time', status: 'failed', suite: 'Performance Suite', duration: 15.5, error: 'Load time exceeded 10s threshold', timestamp: '2026-01-15T15:00:00Z' },
            { id: 'test-4', name: 'Checkout - payment processing', status: 'failed', suite: 'E-Commerce Suite', duration: 8.1, error: 'Payment gateway timeout', timestamp: '2026-01-15T16:45:00Z' },
          ]
        }
      };
    }
    // Pattern: Why did X test fail?
    else if (lowerMessage.includes('why') && (lowerMessage.includes('fail') || lowerMessage.includes('error'))) {
      const testName = lowerMessage.includes('login') ? 'Login flow - valid credentials' :
                      lowerMessage.includes('registration') ? 'User registration - email validation' :
                      lowerMessage.includes('dashboard') ? 'Dashboard load time' :
                      lowerMessage.includes('checkout') || lowerMessage.includes('payment') ? 'Checkout - payment processing' :
                      'Login flow - valid credentials';

      response = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `🔍 **Root Cause Analysis for "${testName}"**`,
        timestamp: new Date(),
        data: {
          type: 'explanation',
          explanation: {
            summary: 'The test failed because the login button selector has changed after a recent UI update.',
            root_cause: 'The element selector `#login-button` no longer exists in the DOM. The button was refactored to use a different ID: `#btn-login` as part of the UI component library migration (commit abc123 by developer@example.com on Jan 15).',
            evidence: [
              '🔴 Selector `#login-button` not found in page snapshot',
              '🟡 Similar element found: `#btn-login` with 95% confidence match',
              '🟢 Recent commit changed Button component IDs (Jan 15)',
              '🟢 3 other tests using old selectors also failing'
            ],
            fix_suggestion: 'Update the selector from `#login-button` to `#btn-login`, or better yet, use a data-testid attribute for more stable selectors.'
          }
        }
      };
    }
    // Pattern: Fix it / Apply fix / Run again
    else if (lowerMessage.includes('fix') || (lowerMessage.includes('run') && lowerMessage.includes('again'))) {
      // First show fixing message
      response = {
        id: Date.now().toString(),
        role: 'assistant',
        content: '🔧 **Applying AI-Suggested Fix...**',
        timestamp: new Date(),
        data: {
          type: 'action_result',
          action: {
            type: 'fix_applied',
            details: 'Updated selector from `#login-button` to `#btn-login` in auth.spec.ts line 42',
            success: true
          }
        }
      };

      setMessages(prev => [...prev, response]);
      setIsTyping(true);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Then show running test
      const runningResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '🏃 **Re-running test...**',
        timestamp: new Date(),
        data: {
          type: 'action_result',
          action: {
            type: 'test_running',
            details: 'Executing: Login flow - valid credentials'
          }
        }
      };

      setMessages(prev => [...prev, runningResponse]);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Finally show result
      response = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: '✅ **Test Passed!**\n\nThe login test is now passing after the selector fix. The change has been committed to your branch.',
        timestamp: new Date(),
        data: {
          type: 'action_result',
          action: {
            type: 'test_completed',
            details: 'Login flow - valid credentials completed in 2.8s',
            success: true
          }
        }
      };
    }
    // Pattern: Pass rate / Analytics
    else if (lowerMessage.includes('pass rate') || lowerMessage.includes('analytics') || lowerMessage.includes('stats')) {
      response = {
        id: Date.now().toString(),
        role: 'assistant',
        content: '📈 **Test Analytics Summary**\n\n• **Pass Rate**: 89.5% (↑2.3% from last week)\n• **Total Tests**: 1,250\n• **Failed**: 42\n• **Flaky**: 18\n• **Avg Duration**: 4.2s\n\n**Top Failing Suites:**\n1. Auth Suite - 12 failures\n2. E-Commerce Suite - 8 failures\n3. Performance Suite - 6 failures\n\nWould you like me to analyze any of these in more detail?',
        timestamp: new Date(),
        data: { type: 'text' }
      };
    }
    // Pattern: Debug test (Feature #1248)
    else if (lowerMessage.includes('debug')) {
      const testName = lowerMessage.includes('checkout') ? 'Checkout - payment processing' :
                      lowerMessage.includes('login') ? 'Login flow - valid credentials' :
                      lowerMessage.includes('registration') ? 'User registration - email validation' :
                      lowerMessage.includes('dashboard') ? 'Dashboard load time' :
                      'Checkout - payment processing';

      response = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `🔬 **Debug Analysis: "${testName}"**\n\n**Test Execution Breakdown:**`,
        timestamp: new Date(),
        data: {
          type: 'debug_analysis',
          debug: {
            test_name: testName,
            total_steps: 5,
            failed_step: 3,
            steps: [
              { number: 1, action: 'Navigate to /checkout', status: 'passed', duration: 1.2, screenshot: true },
              { number: 2, action: 'Fill shipping address form', status: 'passed', duration: 2.1, screenshot: true },
              { number: 3, action: 'Click "Proceed to Payment" button', status: 'failed', duration: 8.1, error: 'Timeout: Element #payment-btn not clickable after 8s', screenshot: true },
              { number: 4, action: 'Enter payment details', status: 'skipped', duration: 0, screenshot: false },
              { number: 5, action: 'Verify order confirmation', status: 'skipped', duration: 0, screenshot: false }
            ],
            failure_details: {
              step: 3,
              error: 'Timeout: Element #payment-btn not clickable after 8s',
              reason: 'The payment button was covered by a loading overlay that did not disappear. This is likely due to a race condition where the payment gateway initialization takes longer than expected.',
              stack_trace: 'at click (#payment-btn)\nat CheckoutTest.proceedToPayment (checkout.spec.ts:45)\nat async Runner.runTest (runner.ts:123)'
            }
          }
        }
      };
    }
    // Pattern: What should I try / Suggest fixes (Feature #1248)
    else if (lowerMessage.includes('what should') || lowerMessage.includes('suggest') || lowerMessage.includes('how do i') || lowerMessage.includes('try')) {
      response = {
        id: Date.now().toString(),
        role: 'assistant',
        content: '💡 **Suggested Fixes for This Issue:**',
        timestamp: new Date(),
        data: {
          type: 'suggestions',
          suggestions: [
            {
              priority: 'high',
              title: 'Wait for loading overlay to disappear',
              description: 'Add an explicit wait for the loading overlay to be hidden before clicking the payment button.',
              code: `// Before clicking payment button\nawait page.waitForSelector('.loading-overlay', { state: 'hidden' });\nawait page.click('#payment-btn');`,
              confidence: 92
            },
            {
              priority: 'high',
              title: 'Increase timeout for payment initialization',
              description: 'The payment gateway may need more time to initialize. Increase the timeout or add a custom wait.',
              code: `// Use a longer timeout for this specific action\nawait page.click('#payment-btn', { timeout: 15000 });`,
              confidence: 85
            },
            {
              priority: 'medium',
              title: 'Mock the payment gateway in tests',
              description: 'For faster and more reliable tests, consider mocking the payment gateway API.',
              code: `// Mock payment gateway\nawait page.route('**/api/payment/**', route => {\n  route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });\n});`,
              confidence: 78
            },
            {
              priority: 'low',
              title: 'Add retry logic for flaky payment tests',
              description: 'If this test is intermittently failing, add retry logic to handle transient issues.',
              code: `// In playwright.config.ts\nretries: process.env.CI ? 2 : 0,`,
              confidence: 65
            }
          ]
        }
      };
    }
    // Pattern: Run tests / Run regression suite
    else if (lowerMessage.includes('run') && (lowerMessage.includes('regression') || lowerMessage.includes('suite') || lowerMessage.includes('test'))) {
      const suiteName = lowerMessage.includes('regression') ? 'Regression Suite' :
                        lowerMessage.includes('smoke') ? 'Smoke Tests' :
                        lowerMessage.includes('auth') ? 'Auth Suite' :
                        lowerMessage.includes('e-commerce') ? 'E-Commerce Suite' :
                        'All Tests';

      setIsTestRunning(true);
      setRunningTestSuite(suiteName);

      // First show confirmation
      response = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `🎯 **Starting ${suiteName}**\n\nI'm initiating the test run now...`,
        timestamp: new Date(),
        data: {
          type: 'action_result',
          action: {
            type: 'test_running',
            details: `Running: ${suiteName} (0/48 tests completed)`
          }
        }
      };

      setMessages(prev => [...prev, response]);

      // Simulate test progress updates
      await new Promise(resolve => setTimeout(resolve, 2000));

      const progressResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '⏳ **Test Progress Update**',
        timestamp: new Date(),
        data: {
          type: 'action_result',
          action: {
            type: 'test_running',
            details: `Running: ${suiteName} (24/48 tests completed) - 45 passed, 2 failed, 1 running`
          }
        }
      };
      setMessages(prev => [...prev, progressResponse]);

      await new Promise(resolve => setTimeout(resolve, 3000));

      // Final result
      setIsTestRunning(false);
      setRunningTestSuite(null);

      response = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: `✅ **${suiteName} Completed**\n\n**Results:**\n• ✅ Passed: 45\n• ❌ Failed: 3\n• ⏭️ Skipped: 0\n• ⏱️ Duration: 2m 34s\n\nWould you like me to show the failed tests or analyze the failures?`,
        timestamp: new Date(),
        data: {
          type: 'action_result',
          action: {
            type: 'test_completed',
            details: `${suiteName}: 45 passed, 3 failed in 2m 34s`,
            success: true
          }
        }
      };
    }
    // Pattern: Stop tests / Stop current run
    else if (lowerMessage.includes('stop') && (lowerMessage.includes('run') || lowerMessage.includes('test') || lowerMessage.includes('execution'))) {
      if (isTestRunning && runningTestSuite) {
        setIsTestRunning(false);
        const stoppedSuite = runningTestSuite;
        setRunningTestSuite(null);

        response = {
          id: Date.now().toString(),
          role: 'assistant',
          content: `🛑 **Test Execution Stopped**\n\nI've stopped the ${stoppedSuite}.\n\n**Partial Results:**\n• ✅ Passed: 24\n• ❌ Failed: 2\n• ⏹️ Stopped: 22 tests remaining\n\nWould you like to see the results so far or restart the suite?`,
          timestamp: new Date(),
          data: {
            type: 'action_result',
            action: {
              type: 'test_completed',
              details: `${stoppedSuite} stopped - 24 passed, 2 failed, 22 remaining`,
              success: false
            }
          }
        };
      } else {
        response = {
          id: Date.now().toString(),
          role: 'assistant',
          content: '⚠️ **No Test Running**\n\nThere are no tests currently running to stop. Would you like me to start a test suite?\n\nTry saying: "Run the regression suite"',
          timestamp: new Date(),
          data: { type: 'text' }
        };
      }
    }
    // Pattern: Analyze screenshot / What's in this screenshot (Feature #1250 - Semantic Screenshot Analysis)
    else if (lowerMessage.includes('analyze') && (lowerMessage.includes('screenshot') || lowerMessage.includes('image')) ||
             lowerMessage.includes('what') && lowerMessage.includes('screenshot') ||
             lowerMessage.includes('describe') && (lowerMessage.includes('screenshot') || lowerMessage.includes('image')) ||
             lowerMessage.includes('screenshot') && lowerMessage.includes('semantic')) {
      // Determine which screenshot to analyze based on context
      const isLogin = lowerMessage.includes('login') || lowerMessage.includes('auth');
      const isCheckout = lowerMessage.includes('checkout') || lowerMessage.includes('payment');
      const isDashboard = lowerMessage.includes('dashboard') || lowerMessage.includes('home');
      const isError = lowerMessage.includes('error') || lowerMessage.includes('failure');

      let pageAnalysis;
      if (isLogin || isError) {
        // Login page with error scenario
        pageAnalysis = {
          page_type: {
            identified: 'Login Form',
            confidence: 96,
            category: 'Authentication'
          },
          elements_detected: [
            { type: 'input', role: 'email', label: 'Email Address', selector: '#email-input', required: true, has_value: true, validation: 'valid' },
            { type: 'input', role: 'password', label: 'Password', selector: '#password-input', required: true, has_value: true, validation: 'masked' },
            { type: 'button', role: 'submit', label: 'Sign In', selector: '#login-btn', enabled: true, primary: true },
            { type: 'link', role: 'navigation', label: 'Forgot Password?', selector: 'a[href="/forgot-password"]' },
            { type: 'link', role: 'navigation', label: 'Create Account', selector: 'a[href="/register"]' },
            { type: 'checkbox', role: 'option', label: 'Remember me', selector: '#remember-me', checked: false }
          ],
          errors_detected: [
            { type: 'validation_error', message: 'Invalid email or password', severity: 'error', location: 'above form', visible: true },
            { type: 'field_error', message: 'Please enter a valid email address', severity: 'warning', location: 'below email field', visible: false }
          ],
          visual_state: {
            has_loading_spinner: false,
            has_modal: false,
            has_overlay: false,
            theme: 'light',
            responsive_view: 'desktop'
          },
          semantic_description: 'This is a **login authentication form** with an error state. The page shows:\n\n• An email input field (filled)\n• A password input field (filled with masked characters)\n• A "Sign In" primary action button\n• An error message: "Invalid email or password"\n• Secondary options: "Forgot Password?" and "Create Account" links\n• A "Remember me" checkbox (unchecked)\n\n**Current State**: The form has been submitted with invalid credentials, triggering an authentication error. The user should verify their email and password.',
          suggested_test_assertions: [
            'Assert error message is visible after invalid login',
            'Assert email field retains entered value',
            'Assert password field is cleared after failed attempt',
            'Assert login button remains enabled for retry'
          ]
        };
      } else if (isCheckout) {
        pageAnalysis = {
          page_type: {
            identified: 'Checkout Page',
            confidence: 94,
            category: 'E-Commerce'
          },
          elements_detected: [
            { type: 'form', role: 'shipping', label: 'Shipping Address', selector: '#shipping-form', required: true },
            { type: 'form', role: 'payment', label: 'Payment Method', selector: '#payment-form', required: true },
            { type: 'input', role: 'card_number', label: 'Card Number', selector: '#card-number', required: true, validation: 'partial' },
            { type: 'button', role: 'submit', label: 'Place Order', selector: '#place-order-btn', enabled: false, primary: true },
            { type: 'summary', role: 'cart', label: 'Order Summary', selector: '#order-summary' }
          ],
          errors_detected: [],
          visual_state: {
            has_loading_spinner: false,
            has_modal: false,
            has_overlay: false,
            theme: 'light',
            responsive_view: 'desktop'
          },
          semantic_description: 'This is a **checkout payment page** in a multi-step flow. The page shows:\n\n• Shipping address form (completed)\n• Payment method section (in progress)\n• Card number field with partial input\n• "Place Order" button (disabled until form complete)\n• Order summary with item list and totals\n\n**Current State**: User is entering payment details. The submit button is disabled pending form completion.',
          suggested_test_assertions: [
            'Assert Place Order button disabled until all fields valid',
            'Assert card number validates format on blur',
            'Assert order total matches cart items'
          ]
        };
      } else if (isDashboard) {
        pageAnalysis = {
          page_type: {
            identified: 'Analytics Dashboard',
            confidence: 92,
            category: 'Data Visualization'
          },
          elements_detected: [
            { type: 'stat_card', role: 'metric', label: 'Total Tests', value: '1,250' },
            { type: 'stat_card', role: 'metric', label: 'Pass Rate', value: '89.5%' },
            { type: 'chart', role: 'visualization', label: 'Test Results Over Time', chart_type: 'line' },
            { type: 'table', role: 'data', label: 'Recent Test Runs', rows: 10 },
            { type: 'button', role: 'action', label: 'Run Tests', selector: '#run-tests-btn' }
          ],
          errors_detected: [],
          visual_state: {
            has_loading_spinner: false,
            has_modal: false,
            has_overlay: false,
            theme: 'light',
            responsive_view: 'desktop'
          },
          semantic_description: 'This is a **QA analytics dashboard**. The page shows:\n\n• Summary statistics: Total Tests (1,250), Pass Rate (89.5%)\n• A line chart showing test results over time\n• A table of recent test runs\n• Action button to run tests\n\n**Current State**: Dashboard is fully loaded with current data.',
          suggested_test_assertions: [
            'Assert metrics load within 3 seconds',
            'Assert chart renders with data points',
            'Assert table shows at least 1 row'
          ]
        };
      } else {
        // Generic page analysis
        pageAnalysis = {
          page_type: {
            identified: 'Web Application Page',
            confidence: 88,
            category: 'Generic UI'
          },
          elements_detected: [
            { type: 'navigation', role: 'header', label: 'Main Navigation', selector: 'nav' },
            { type: 'heading', role: 'title', label: 'Page Title', selector: 'h1' },
            { type: 'content', role: 'main', label: 'Main Content Area', selector: 'main' },
            { type: 'button', role: 'action', label: 'Primary Action', selector: '.btn-primary' },
            { type: 'footer', role: 'footer', label: 'Page Footer', selector: 'footer' }
          ],
          errors_detected: [],
          visual_state: {
            has_loading_spinner: false,
            has_modal: false,
            has_overlay: false,
            theme: 'light',
            responsive_view: 'desktop'
          },
          semantic_description: 'This appears to be a **standard web application page**. The page shows:\n\n• Navigation header with menu items\n• Main heading/title\n• Primary content area\n• Action buttons\n• Standard footer\n\n**Current State**: Page appears fully loaded with no errors.',
          suggested_test_assertions: [
            'Assert navigation menu is visible',
            'Assert page title matches expected',
            'Assert main content area is not empty'
          ]
        };
      }

      response = {
        id: Date.now().toString(),
        role: 'assistant',
        content: '🔍 **Semantic Screenshot Analysis**',
        timestamp: new Date(),
        data: {
          type: 'screenshot_analysis',
          analysis: pageAnalysis
        }
      };
    }
    // Default response
    else {
      response = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `I understand you're asking about "${userMessage}". I can help you with:\n\n• Viewing test results: "Show me failed tests from yesterday"\n• Understanding failures: "Why did the login test fail?"\n• Taking actions: "Fix it and run again"\n• Viewing analytics: "What's our pass rate?"\n• Analyzing screenshots: "Analyze this screenshot"\n\nCould you rephrase your question or try one of these examples?`,
        timestamp: new Date(),
        data: { type: 'text' }
      };
    }

    setIsTyping(false);
    setMessages(prev => [...prev, response]);
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');

    await processUserMessage(input);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Floating Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-all duration-300 ${
          isOpen ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:bg-primary/90'
        }`}
        aria-label={isOpen ? 'Close QA Chat' : 'Open QA Chat'}
      >
        {isOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-96 h-[600px] flex flex-col rounded-xl shadow-2xl border border-border bg-card overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary text-primary-foreground">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-sm">QA Assistant</h3>
                <p className="text-xs opacity-80">Powered by AI</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMessages([])}
                className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
                title="Clear conversation"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {/* Message content with markdown-like formatting */}
                  <div className="text-sm whitespace-pre-wrap">
                    {message.content.split('\n').map((line, i) => (
                      <p key={i} className={i > 0 ? 'mt-1' : ''}>
                        {line.split('**').map((part, j) =>
                          j % 2 === 1 ? <strong key={j}>{part}</strong> : part
                        )}
                      </p>
                    ))}
                  </div>

                  {/* Test Results Display */}
                  {message.data?.type === 'test_results' && message.data.tests && (
                    <div className="mt-2 space-y-2">
                      {message.data.tests.map((test) => (
                        <div key={test.id} className="rounded-md bg-background/50 p-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-500"></span>
                            <span className="font-medium">{test.name}</span>
                          </div>
                          <div className="mt-1 text-muted-foreground">
                            <span className="mr-2">📁 {test.suite}</span>
                            <span>⏱️ {test.duration}s</span>
                          </div>
                          {test.error && (
                            <div className="mt-1 text-red-400 text-xs font-mono bg-red-500/10 rounded px-1 py-0.5">
                              {test.error}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Explanation Display */}
                  {message.data?.type === 'explanation' && message.data.explanation && (
                    <div className="mt-2 space-y-2 text-xs">
                      <div className="rounded-md bg-background/50 p-2">
                        <p className="font-medium text-foreground">Summary:</p>
                        <p className="text-muted-foreground">{message.data.explanation.summary}</p>
                      </div>
                      <div className="rounded-md bg-background/50 p-2">
                        <p className="font-medium text-foreground">Root Cause:</p>
                        <p className="text-muted-foreground">{message.data.explanation.root_cause}</p>
                      </div>
                      <div className="rounded-md bg-background/50 p-2">
                        <p className="font-medium text-foreground mb-1">Evidence:</p>
                        {message.data.explanation.evidence.map((e, i) => (
                          <p key={i} className="text-muted-foreground">{e}</p>
                        ))}
                      </div>
                      <div className="rounded-md bg-green-500/10 border border-green-500/20 p-2">
                        <p className="font-medium text-green-600">💡 Suggested Fix:</p>
                        <p className="text-muted-foreground">{message.data.explanation.fix_suggestion}</p>
                      </div>
                    </div>
                  )}

                  {/* Action Result Display */}
                  {message.data?.type === 'action_result' && message.data.action && (
                    <div className="mt-2">
                      <div className={`rounded-md p-2 text-xs ${
                        message.data.action.type === 'test_completed' && message.data.action.success
                          ? 'bg-green-500/10 border border-green-500/20'
                          : message.data.action.type === 'test_running'
                          ? 'bg-blue-500/10 border border-blue-500/20'
                          : 'bg-amber-500/10 border border-amber-500/20'
                      }`}>
                        {message.data.action.type === 'test_running' && (
                          <div className="flex items-center gap-2">
                            <div className="animate-spin h-3 w-3 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                            <span>{message.data.action.details}</span>
                          </div>
                        )}
                        {message.data.action.type !== 'test_running' && (
                          <span>{message.data.action.details}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Debug Analysis Display (Feature #1248) */}
                  {message.data?.type === 'debug_analysis' && (message.data as any).debug && (
                    <div className="mt-2 space-y-2">
                      {(message.data as any).debug.steps.map((step: any) => (
                        <div key={step.number} className={`rounded-md p-2 text-xs ${
                          step.status === 'passed' ? 'bg-green-500/10 border border-green-500/20' :
                          step.status === 'failed' ? 'bg-red-500/10 border border-red-500/20' :
                          'bg-gray-500/10 border border-gray-500/20'
                        }`}>
                          <div className="flex items-center gap-2">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              step.status === 'passed' ? 'bg-green-500 text-white' :
                              step.status === 'failed' ? 'bg-red-500 text-white' :
                              'bg-gray-400 text-white'
                            }`}>{step.number}</span>
                            <span className="flex-1">{step.action}</span>
                            <span className={`text-[10px] ${
                              step.status === 'passed' ? 'text-green-600' :
                              step.status === 'failed' ? 'text-red-600' :
                              'text-gray-500'
                            }`}>
                              {step.status === 'passed' ? '✓' : step.status === 'failed' ? '✗' : '○'} {step.duration > 0 ? `${step.duration}s` : ''}
                            </span>
                          </div>
                          {step.error && (
                            <div className="mt-1 text-red-400 text-[10px] font-mono bg-red-500/10 rounded px-1 py-0.5">
                              {step.error}
                            </div>
                          )}
                        </div>
                      ))}
                      {(message.data as any).debug.failure_details && (
                        <div className="rounded-md bg-red-500/10 border border-red-500/20 p-2 mt-2">
                          <p className="text-xs font-medium text-red-600">💥 Step {(message.data as any).debug.failure_details.step} failed because:</p>
                          <p className="text-xs text-red-500 mt-1">{(message.data as any).debug.failure_details.reason}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Fix Suggestions Display (Feature #1248) */}
                  {message.data?.type === 'suggestions' && (message.data as any).suggestions && (
                    <div className="mt-2 space-y-2">
                      {(message.data as any).suggestions.map((suggestion: any, idx: number) => (
                        <div key={idx} className={`rounded-md p-2 text-xs border ${
                          suggestion.priority === 'high' ? 'bg-orange-500/10 border-orange-500/20' :
                          suggestion.priority === 'medium' ? 'bg-blue-500/10 border-blue-500/20' :
                          'bg-gray-500/10 border-gray-500/20'
                        }`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              suggestion.priority === 'high' ? 'bg-orange-500 text-white' :
                              suggestion.priority === 'medium' ? 'bg-blue-500 text-white' :
                              'bg-gray-500 text-white'
                            }`}>{suggestion.priority}</span>
                            <span className="font-medium text-foreground">{suggestion.title}</span>
                            <span className="ml-auto text-[10px] text-muted-foreground">{suggestion.confidence}% confidence</span>
                          </div>
                          <p className="text-muted-foreground mb-1">{suggestion.description}</p>
                          {suggestion.code && (
                            <pre className="text-[10px] bg-background/50 rounded p-1.5 overflow-x-auto font-mono text-green-400">
                              {suggestion.code}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Semantic Screenshot Analysis Display (Feature #1250) */}
                  {message.data?.type === 'screenshot_analysis' && (message.data as any).analysis && (
                    <div className="mt-2 space-y-2">
                      {/* Page Type Identification */}
                      <div className="rounded-md bg-purple-500/10 border border-purple-500/20 p-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-purple-400">🖼️</span>
                          <span className="text-xs font-medium text-foreground">Page Identified</span>
                          <span className="ml-auto px-1.5 py-0.5 rounded text-[10px] bg-purple-500 text-white">
                            {(message.data as any).analysis.page_type.confidence}% confidence
                          </span>
                        </div>
                        <p className="text-sm font-bold text-purple-300">{(message.data as any).analysis.page_type.identified}</p>
                        <p className="text-[10px] text-muted-foreground">Category: {(message.data as any).analysis.page_type.category}</p>
                      </div>

                      {/* Elements Detected */}
                      <div className="rounded-md bg-blue-500/10 border border-blue-500/20 p-2">
                        <p className="text-xs font-medium text-foreground mb-1">🔍 Elements Detected</p>
                        <div className="space-y-1">
                          {(message.data as any).analysis.elements_detected.slice(0, 6).map((el: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 text-[10px]">
                              <span className={`w-2 h-2 rounded-full ${
                                el.type === 'input' ? 'bg-cyan-400' :
                                el.type === 'button' ? 'bg-green-400' :
                                el.type === 'link' ? 'bg-blue-400' :
                                el.type === 'form' ? 'bg-amber-400' :
                                'bg-gray-400'
                              }`}></span>
                              <span className="text-muted-foreground capitalize">{el.type}</span>
                              <span className="text-foreground flex-1">{el.label || el.role}</span>
                              {el.selector && (
                                <code className="text-[8px] bg-background/50 px-1 rounded">{el.selector}</code>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Errors Detected */}
                      {(message.data as any).analysis.errors_detected.length > 0 && (
                        <div className="rounded-md bg-red-500/10 border border-red-500/20 p-2">
                          <p className="text-xs font-medium text-red-400 mb-1">⚠️ Errors Detected</p>
                          <div className="space-y-1">
                            {(message.data as any).analysis.errors_detected.map((err: any, idx: number) => (
                              <div key={idx} className="text-[10px]">
                                <div className="flex items-center gap-1">
                                  <span className={`px-1 py-0.5 rounded text-[8px] uppercase ${
                                    err.severity === 'error' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
                                  }`}>{err.severity}</span>
                                  <span className="text-red-300">{err.message}</span>
                                </div>
                                <p className="text-muted-foreground ml-4">Location: {err.location}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Visual State */}
                      <div className="rounded-md bg-background/50 p-2">
                        <p className="text-xs font-medium text-foreground mb-1">👁️ Visual State</p>
                        <div className="flex flex-wrap gap-2 text-[10px]">
                          <span className="px-1.5 py-0.5 rounded bg-background border border-border">
                            Theme: {(message.data as any).analysis.visual_state.theme}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-background border border-border">
                            View: {(message.data as any).analysis.visual_state.responsive_view}
                          </span>
                          {(message.data as any).analysis.visual_state.has_loading_spinner && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">Loading</span>
                          )}
                          {(message.data as any).analysis.visual_state.has_modal && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">Modal Open</span>
                          )}
                        </div>
                      </div>

                      {/* Semantic Description */}
                      <div className="rounded-md bg-green-500/10 border border-green-500/20 p-2">
                        <p className="text-xs font-medium text-green-400 mb-1">📝 Semantic Description</p>
                        <div className="text-[11px] text-foreground whitespace-pre-wrap">
                          {(message.data as any).analysis.semantic_description.split('\n').map((line: string, i: number) => (
                            <p key={i} className={i > 0 ? 'mt-1' : ''}>
                              {line.split('**').map((part, j) =>
                                j % 2 === 1 ? <strong key={j}>{part}</strong> : part
                              )}
                            </p>
                          ))}
                        </div>
                      </div>

                      {/* Suggested Test Assertions */}
                      {(message.data as any).analysis.suggested_test_assertions && (
                        <div className="rounded-md bg-cyan-500/10 border border-cyan-500/20 p-2">
                          <p className="text-xs font-medium text-cyan-400 mb-1">✅ Suggested Test Assertions</p>
                          <ul className="space-y-0.5">
                            {(message.data as any).analysis.suggested_test_assertions.map((assertion: string, idx: number) => (
                              <li key={idx} className="text-[10px] text-muted-foreground flex items-start gap-1">
                                <span className="text-cyan-400">•</span>
                                {assertion}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  <span className="text-[10px] opacity-60 mt-1 block">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-3 py-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce"></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border p-3">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about your tests..."
                className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary border-input"
                disabled={isTyping}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className="rounded-lg bg-primary px-3 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
              Press Enter to send • Try: "Show me failed tests"
            </p>
          </div>
        </div>
      )}
    </>
  );
}

// Toast Container Component - renders all active toasts in a stack

export { QAChatWidget };
