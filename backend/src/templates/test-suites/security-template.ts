/**
 * Security Test Suite Template
 * Feature #1731: Generates DAST security scan configuration from site analysis
 *
 * Creates tests for:
 * - XSS vulnerability scanning
 * - SQL injection testing
 * - CSRF protection verification
 * - Security headers check
 * - Authentication security
 * - Sensitive data exposure
 */

import { TestSuiteTemplate, TemplateGeneratorOptions, GeneratedTest } from './types';

export function generateSecurityTemplate(options: TemplateGeneratorOptions): TestSuiteTemplate {
  const { baseUrl, siteAnalysis, projectName } = options;
  const tests: GeneratedTest[] = [];

  // 1. Security Headers Scan
  tests.push({
    name: 'Security Headers Check',
    description: 'Verify presence and configuration of security headers',
    type: 'security',
    target_url: baseUrl,
    config: {
      scan_type: 'headers',
      expected_headers: [
        'X-Content-Type-Options',
        'X-Frame-Options',
        'X-XSS-Protection',
        'Strict-Transport-Security',
        'Content-Security-Policy',
        'Referrer-Policy',
        'Permissions-Policy',
      ],
      severity: 'medium',
    },
  });

  // 2. HTTPS/TLS Configuration
  tests.push({
    name: 'HTTPS/TLS Configuration',
    description: 'Verify HTTPS is enforced and TLS configuration is secure',
    type: 'security',
    target_url: baseUrl,
    config: {
      scan_type: 'tls',
      checks: [
        'https_enforced',
        'hsts_enabled',
        'secure_cookies',
        'no_mixed_content',
        'tls_version_1_2_minimum',
      ],
      severity: 'high',
    },
  });

  // 3. XSS Vulnerability Scan
  tests.push({
    name: 'XSS Vulnerability Scan',
    description: 'Scan for Cross-Site Scripting vulnerabilities',
    type: 'security',
    target_url: baseUrl,
    config: {
      scan_type: 'xss',
      attack_vectors: [
        'reflected_xss',
        'stored_xss',
        'dom_based_xss',
      ],
      test_inputs: siteAnalysis.inputs.filter(i => i.type === 'text' || i.type === 'search').length > 0,
      severity: 'critical',
    },
  });

  // 4. SQL Injection Scan (if forms exist)
  if (siteAnalysis.forms.length > 0) {
    tests.push({
      name: 'SQL Injection Scan',
      description: 'Scan for SQL injection vulnerabilities in form inputs',
      type: 'security',
      target_url: baseUrl,
      config: {
        scan_type: 'sqli',
        attack_vectors: [
          'classic_sqli',
          'blind_sqli',
          'time_based_sqli',
        ],
        form_count: siteAnalysis.forms.length,
        severity: 'critical',
      },
    });
  }

  // 5. CSRF Protection Check (if forms exist)
  if (siteAnalysis.forms.length > 0) {
    tests.push({
      name: 'CSRF Protection Check',
      description: 'Verify CSRF tokens are present and validated on forms',
      type: 'security',
      target_url: baseUrl,
      config: {
        scan_type: 'csrf',
        checks: [
          'csrf_token_present',
          'csrf_token_validated',
          'samesite_cookies',
        ],
        form_count: siteAnalysis.forms.length,
        severity: 'high',
      },
    });
  }

  // 6. Authentication Security (if login exists)
  if (siteAnalysis.hasLogin) {
    tests.push({
      name: 'Authentication Security Scan',
      description: 'Verify authentication mechanisms are secure',
      type: 'security',
      target_url: baseUrl,
      config: {
        scan_type: 'auth',
        checks: [
          'password_complexity_enforced',
          'rate_limiting_enabled',
          'account_lockout',
          'secure_password_storage',
          'session_management',
          'logout_invalidates_session',
        ],
        severity: 'critical',
      },
    });

    // 7. Brute Force Protection
    tests.push({
      name: 'Brute Force Protection',
      description: 'Verify login rate limiting and lockout mechanisms',
      type: 'security',
      target_url: baseUrl,
      config: {
        scan_type: 'brute_force',
        max_attempts: 5,
        lockout_check: true,
        rate_limit_check: true,
        severity: 'high',
      },
    });
  }

  // 8. Sensitive Data Exposure
  tests.push({
    name: 'Sensitive Data Exposure Scan',
    description: 'Check for exposed sensitive information',
    type: 'security',
    target_url: baseUrl,
    config: {
      scan_type: 'data_exposure',
      checks: [
        'source_code_exposure',
        'debug_info_exposure',
        'error_message_info_leak',
        'directory_listing',
        'backup_files',
        'config_files',
        'api_keys_exposure',
      ],
      severity: 'high',
    },
  });

  // 9. Cookie Security
  tests.push({
    name: 'Cookie Security Check',
    description: 'Verify cookies have proper security attributes',
    type: 'security',
    target_url: baseUrl,
    config: {
      scan_type: 'cookies',
      required_attributes: [
        'Secure',
        'HttpOnly',
        'SameSite',
      ],
      checks: [
        'session_cookie_security',
        'no_sensitive_data_in_cookies',
        'proper_expiration',
      ],
      severity: 'medium',
    },
  });

  // 10. Clickjacking Protection
  tests.push({
    name: 'Clickjacking Protection',
    description: 'Verify protection against clickjacking attacks',
    type: 'security',
    target_url: baseUrl,
    config: {
      scan_type: 'clickjacking',
      checks: [
        'x_frame_options',
        'csp_frame_ancestors',
        'frame_break_js',
      ],
      severity: 'medium',
    },
  });

  // 11. API Security (if forms suggest API interactions)
  if (siteAnalysis.forms.length > 0 || siteAnalysis.buttons.length > 5) {
    tests.push({
      name: 'API Security Scan',
      description: 'Scan for API security vulnerabilities',
      type: 'security',
      target_url: baseUrl,
      config: {
        scan_type: 'api',
        checks: [
          'proper_authentication',
          'rate_limiting',
          'input_validation',
          'proper_error_handling',
          'cors_configuration',
        ],
        severity: 'high',
      },
    });
  }

  // 12. Information Disclosure
  tests.push({
    name: 'Information Disclosure Scan',
    description: 'Check for unintended information disclosure',
    type: 'security',
    target_url: baseUrl,
    config: {
      scan_type: 'info_disclosure',
      checks: [
        'server_version_hidden',
        'technology_stack_hidden',
        'internal_paths_hidden',
        'user_enumeration_prevented',
      ],
      common_paths: [
        '/.git',
        '/.env',
        '/robots.txt',
        '/sitemap.xml',
        '/admin',
        '/backup',
        '/wp-admin',
        '/phpinfo.php',
      ],
      severity: 'medium',
    },
  });

  // 13. Content Security Policy Audit
  tests.push({
    name: 'Content Security Policy Audit',
    description: 'Analyze and validate Content-Security-Policy configuration',
    type: 'security',
    target_url: baseUrl,
    config: {
      scan_type: 'csp_audit',
      checks: [
        'csp_present',
        'no_unsafe_inline',
        'no_unsafe_eval',
        'strict_dynamic',
        'report_uri_configured',
      ],
      severity: 'medium',
    },
  });

  // 14. File Upload Security (if file inputs exist)
  const hasFileInput = siteAnalysis.inputs.some(i => i.type === 'file');
  if (hasFileInput) {
    tests.push({
      name: 'File Upload Security',
      description: 'Test file upload security controls',
      type: 'security',
      target_url: baseUrl,
      config: {
        scan_type: 'file_upload',
        checks: [
          'file_type_validation',
          'file_size_limits',
          'malware_scanning',
          'filename_sanitization',
          'storage_location_security',
        ],
        test_files: [
          'malicious.php',
          'xss.svg',
          'shell.jsp',
          'oversized.bin',
        ],
        severity: 'critical',
      },
    });
  }

  // 15. E-commerce Security (if cart exists)
  if (siteAnalysis.hasCart) {
    tests.push({
      name: 'E-commerce Security Scan',
      description: 'Security scan for e-commerce functionality',
      type: 'security',
      target_url: baseUrl,
      config: {
        scan_type: 'ecommerce',
        checks: [
          'payment_page_https',
          'price_tampering_prevention',
          'inventory_manipulation_prevention',
          'order_data_protection',
          'pci_dss_compliance_basics',
        ],
        severity: 'critical',
      },
    });
  }

  return {
    name: `${projectName || 'Site'} Security Tests`,
    description: `DAST security scanning suite for ${baseUrl}`,
    type: 'security',
    tests,
  };
}

export default generateSecurityTemplate;
