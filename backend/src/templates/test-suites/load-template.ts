/**
 * Load Test Suite Template
 * Feature #1731: Generates K6 load testing configuration from site analysis
 *
 * Creates tests for:
 * - Baseline load testing
 * - Stress testing (increasing load)
 * - Spike testing (sudden traffic surges)
 * - Endurance testing (sustained load)
 * - API endpoint load testing
 */

import { TestSuiteTemplate, TemplateGeneratorOptions, GeneratedTest } from './types';

export function generateLoadTemplate(options: TemplateGeneratorOptions): TestSuiteTemplate {
  const { baseUrl, siteAnalysis, projectName } = options;
  const tests: GeneratedTest[] = [];

  // 1. Baseline Load Test - Homepage
  tests.push({
    name: 'Homepage - Baseline Load Test',
    description: `Baseline load test for ${baseUrl} with moderate concurrent users`,
    type: 'load',
    target_url: baseUrl,
    config: {
      tool: 'k6',
      scenario: 'baseline',
      vus: 10,              // Virtual users
      duration: '1m',       // Test duration
      ramp_up: '10s',       // Ramp up time
      thresholds: {
        http_req_duration: ['p(95)<500'],  // 95% of requests under 500ms
        http_req_failed: ['rate<0.01'],    // Less than 1% failure rate
      },
    },
  });

  // 2. Stress Test - Gradually increasing load
  tests.push({
    name: 'Homepage - Stress Test',
    description: 'Stress test with gradually increasing load to find breaking point',
    type: 'load',
    target_url: baseUrl,
    config: {
      tool: 'k6',
      scenario: 'stress',
      stages: [
        { duration: '30s', target: 10 },   // Ramp up to 10 users
        { duration: '1m', target: 50 },    // Ramp up to 50 users
        { duration: '30s', target: 100 },  // Ramp up to 100 users
        { duration: '1m', target: 100 },   // Stay at 100 users
        { duration: '30s', target: 0 },    // Ramp down
      ],
      thresholds: {
        http_req_duration: ['p(95)<2000'],  // 95% under 2s during stress
        http_req_failed: ['rate<0.05'],     // Less than 5% failure during stress
      },
    },
  });

  // 3. Spike Test - Sudden traffic surge
  tests.push({
    name: 'Homepage - Spike Test',
    description: 'Spike test to verify behavior under sudden traffic surge',
    type: 'load',
    target_url: baseUrl,
    config: {
      tool: 'k6',
      scenario: 'spike',
      stages: [
        { duration: '10s', target: 5 },    // Normal load
        { duration: '5s', target: 100 },   // Sudden spike
        { duration: '30s', target: 100 },  // Maintain spike
        { duration: '5s', target: 5 },     // Drop back
        { duration: '10s', target: 0 },    // Ramp down
      ],
      thresholds: {
        http_req_duration: ['p(95)<3000'],  // Allow higher latency during spike
        http_req_failed: ['rate<0.10'],     // Allow up to 10% failure during spike
      },
    },
  });

  // 4. Endurance Test - Sustained load
  tests.push({
    name: 'Homepage - Endurance Test',
    description: 'Extended load test to identify memory leaks and degradation',
    type: 'load',
    target_url: baseUrl,
    config: {
      tool: 'k6',
      scenario: 'endurance',
      vus: 20,
      duration: '10m',      // Extended duration
      thresholds: {
        http_req_duration: ['p(95)<1000'],
        http_req_failed: ['rate<0.01'],
      },
    },
  });

  // 5. Login Flow Load Test (if login exists)
  if (siteAnalysis.hasLogin) {
    const loginUrl = findLoginUrl(siteAnalysis, baseUrl);
    tests.push({
      name: 'Login Flow - Load Test',
      description: 'Load test for authentication flow',
      type: 'load',
      target_url: loginUrl,
      config: {
        tool: 'k6',
        scenario: 'auth_flow',
        vus: 20,
        duration: '2m',
        flow_type: 'login',
        thresholds: {
          http_req_duration: ['p(95)<1000'],
          http_req_failed: ['rate<0.02'],
        },
      },
    });
  }

  // 6. Search Functionality Load Test (if search exists)
  if (siteAnalysis.hasSearch) {
    tests.push({
      name: 'Search - Load Test',
      description: 'Load test for search functionality with varied queries',
      type: 'load',
      target_url: baseUrl,
      config: {
        tool: 'k6',
        scenario: 'search_load',
        vus: 15,
        duration: '2m',
        search_terms: ['test', 'product', 'service', 'help', 'contact'],
        thresholds: {
          http_req_duration: ['p(95)<800'],
          http_req_failed: ['rate<0.02'],
        },
      },
    });
  }

  // 7. Cart/Checkout Load Test (if e-commerce)
  if (siteAnalysis.hasCart) {
    tests.push({
      name: 'Checkout Flow - Load Test',
      description: 'Load test for cart and checkout functionality',
      type: 'load',
      target_url: baseUrl,
      config: {
        tool: 'k6',
        scenario: 'checkout_flow',
        vus: 10,
        duration: '3m',
        flow_type: 'checkout',
        thresholds: {
          http_req_duration: ['p(95)<1500'],
          http_req_failed: ['rate<0.01'],  // Checkout must be reliable
        },
      },
    });
  }

  // 8. API Endpoints Load Test (based on forms/interactions)
  if (siteAnalysis.forms.length > 0) {
    tests.push({
      name: 'Form Submissions - Load Test',
      description: 'Load test for form submission endpoints',
      type: 'load',
      target_url: baseUrl,
      config: {
        tool: 'k6',
        scenario: 'form_submissions',
        vus: 10,
        duration: '1m',
        form_count: siteAnalysis.forms.length,
        thresholds: {
          http_req_duration: ['p(95)<1000'],
          http_req_failed: ['rate<0.02'],
        },
      },
    });
  }

  // 9. Static Assets Load Test
  tests.push({
    name: 'Static Assets - Load Test',
    description: 'Load test for static asset delivery (CSS, JS, images)',
    type: 'load',
    target_url: baseUrl,
    config: {
      tool: 'k6',
      scenario: 'static_assets',
      vus: 50,              // Higher VUs for static content
      duration: '1m',
      asset_types: ['css', 'js', 'images'],
      thresholds: {
        http_req_duration: ['p(95)<300'],  // Static assets should be fast
        http_req_failed: ['rate<0.005'],   // Very low failure rate
      },
    },
  });

  // 10. Multi-page User Journey
  tests.push({
    name: 'User Journey - Load Test',
    description: 'Simulates realistic user journey across multiple pages',
    type: 'load',
    target_url: baseUrl,
    config: {
      tool: 'k6',
      scenario: 'user_journey',
      vus: 10,
      duration: '3m',
      journey_pages: getJourneyPages(siteAnalysis, baseUrl),
      think_time: '2s',     // Pause between page loads
      thresholds: {
        http_req_duration: ['p(95)<1500'],
        http_req_failed: ['rate<0.02'],
      },
    },
  });

  return {
    name: `${projectName || 'Site'} Load Tests`,
    description: `K6 load testing suite for ${baseUrl}`,
    type: 'load',
    tests,
  };
}

function findLoginUrl(analysis: typeof import('../../services/crawl4ai').SiteAnalysis.prototype, baseUrl: string): string {
  const loginPatterns = [/login/i, /signin/i, /sign-in/i, /auth/i];

  for (const link of analysis.links) {
    if (link.isExternal) continue;
    for (const pattern of loginPatterns) {
      if (pattern.test(link.href) || pattern.test(link.text)) {
        return link.href.startsWith('http')
          ? link.href
          : `${baseUrl.replace(/\/$/, '')}${link.href.startsWith('/') ? '' : '/'}${link.href}`;
      }
    }
  }

  return `${baseUrl.replace(/\/$/, '')}/login`;
}

function getJourneyPages(analysis: typeof import('../../services/crawl4ai').SiteAnalysis.prototype, baseUrl: string): string[] {
  const pages: string[] = [baseUrl];
  const addedPaths = new Set<string>(['/']);

  // Add important pages to journey
  const journeyPatterns = [
    /about/i,
    /products?|services?/i,
    /contact/i,
    /pricing/i,
  ];

  for (const link of analysis.links) {
    if (link.isExternal || pages.length >= 5) continue;

    for (const pattern of journeyPatterns) {
      if (pattern.test(link.href) || pattern.test(link.text)) {
        const path = link.href.startsWith('http')
          ? new URL(link.href).pathname
          : link.href;

        if (!addedPaths.has(path)) {
          addedPaths.add(path);
          const fullUrl = link.href.startsWith('http')
            ? link.href
            : `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
          pages.push(fullUrl);
        }
        break;
      }
    }
  }

  return pages;
}

export default generateLoadTemplate;
