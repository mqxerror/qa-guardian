// DAST Alert Generation Functions

import { DASTAlert, DASTRisk, DASTConfidence, DASTConfig } from './types';
import { generateId } from './utils';

// Generate simulated OWASP ZAP alerts
export function generateSimulatedAlerts(
  targetUrl: string,
  scanProfile: 'baseline' | 'full' | 'api',
  authConfig?: DASTConfig['authConfig']
): DASTAlert[] {
  const alerts: DASTAlert[] = [];

  // Common baseline alerts
  const baselineAlerts: Partial<DASTAlert>[] = [
    {
      pluginId: '10015',
      name: 'Re-examine Cache-control Directives',
      risk: 'Informational',
      confidence: 'Medium',
      description: 'The cache-control header has not been set properly or is missing.',
      solution: 'Whenever possible ensure the cache-control HTTP header is set with no-cache, no-store, must-revalidate.',
      cweId: 525,
    },
    {
      pluginId: '10020',
      name: 'X-Frame-Options Header Not Set',
      risk: 'Medium',
      confidence: 'High',
      description: 'X-Frame-Options header is not included in the HTTP response to protect against clickjacking attacks.',
      solution: 'Most modern web browsers support the X-Frame-Options HTTP header. Ensure it is set on all web pages returned by your site.',
      cweId: 1021,
    },
    {
      pluginId: '10021',
      name: 'X-Content-Type-Options Header Missing',
      risk: 'Low',
      confidence: 'Medium',
      description: 'The Anti-MIME-Sniffing header X-Content-Type-Options was not set to nosniff.',
      solution: 'Ensure that the application sets the Content-Type header appropriately.',
      cweId: 693,
    },
    {
      pluginId: '10038',
      name: 'Content Security Policy (CSP) Header Not Set',
      risk: 'Medium',
      confidence: 'High',
      description: 'Content Security Policy (CSP) is an added layer of security that helps to detect and mitigate certain types of attacks.',
      solution: 'Ensure that your web server, application server, load balancer, etc. is configured to set the Content-Security-Policy header.',
      cweId: 693,
    },
    {
      pluginId: '10096',
      name: 'Timestamp Disclosure - Unix',
      risk: 'Low',
      confidence: 'Low',
      description: 'A timestamp was disclosed by the application/web server - Unix.',
      solution: 'Manually confirm that the timestamp data is not sensitive, and that the data cannot be aggregated to disclose exploitable patterns.',
      cweId: 200,
    },
    {
      pluginId: '10035',
      name: 'Strict-Transport-Security Header Not Set',
      risk: 'Low',
      confidence: 'High',
      description: 'HTTP Strict Transport Security (HSTS) is a web security policy mechanism whereby a web server declares that complying user agents (such as a web browser) are to interact with it using only secure HTTPS connections.',
      solution: 'Ensure that your web server, application server, load balancer, etc. is configured to enforce Strict-Transport-Security.',
      cweId: 319,
    },
  ];

  // Add baseline alerts
  baselineAlerts.forEach((template, index) => {
    alerts.push({
      id: generateId(),
      pluginId: template.pluginId!,
      name: template.name!,
      risk: template.risk as DASTRisk,
      confidence: template.confidence as DASTConfidence,
      description: template.description!,
      url: `${targetUrl}${index === 0 ? '/' : `/page${index}`}`,
      method: 'GET',
      solution: template.solution!,
      cweId: template.cweId,
    });
  });

  // Add SSL/TLS alerts for HTTPS targets
  if (targetUrl.startsWith('https://')) {
    const sslAlerts: Partial<DASTAlert>[] = [
      {
        pluginId: '10011',
        name: 'Weak SSL/TLS Cipher Suites Detected',
        risk: 'Medium',
        confidence: 'High',
        description: 'The server supports SSL/TLS cipher suites that are considered weak.',
        solution: 'Configure the server to use only strong cipher suites. Disable RC4, DES, 3DES, and export-grade ciphers.',
        cweId: 327,
        evidence: 'TLS_RSA_WITH_3DES_EDE_CBC_SHA, TLS_RSA_WITH_RC4_128_SHA',
      },
      {
        pluginId: '10012',
        name: 'SSL Certificate Expiring Soon',
        risk: 'Low',
        confidence: 'High',
        description: 'The SSL/TLS certificate for this site will expire within 30 days.',
        solution: 'Renew the SSL/TLS certificate before it expires.',
        cweId: 295,
        evidence: 'Certificate expires: 2025-02-15',
      },
      {
        pluginId: '10013',
        name: 'Deprecated TLS Version Supported',
        risk: 'Medium',
        confidence: 'High',
        description: 'The server supports TLS 1.0 and/or TLS 1.1, which are deprecated protocols.',
        solution: 'Configure the server to only support TLS 1.2 and TLS 1.3.',
        cweId: 326,
        evidence: 'TLS 1.0 and TLS 1.1 protocols enabled',
      },
    ];

    sslAlerts.forEach((template) => {
      alerts.push({
        id: generateId(),
        pluginId: template.pluginId!,
        name: template.name!,
        risk: template.risk as DASTRisk,
        confidence: template.confidence as DASTConfidence,
        description: template.description!,
        url: targetUrl,
        method: 'GET',
        evidence: template.evidence,
        solution: template.solution!,
        cweId: template.cweId,
      });
    });
  }

  // Add information disclosure alerts
  const infoDisclosureAlerts: Partial<DASTAlert>[] = [
    {
      pluginId: '10036',
      name: 'Server Leaks Version Information via "Server" HTTP Response Header Field',
      risk: 'Low',
      confidence: 'High',
      description: 'The web/application server is leaking version information via the "Server" HTTP response header.',
      solution: 'Ensure that your web server is configured to suppress the "Server" header.',
      cweId: 200,
      evidence: 'nginx/1.18.0 (Ubuntu)',
    },
    {
      pluginId: '10037',
      name: 'Server Leaks Information via "X-Powered-By" HTTP Response Header Field(s)',
      risk: 'Low',
      confidence: 'Medium',
      description: 'The web/application server is leaking information via "X-Powered-By" HTTP response headers.',
      solution: 'Ensure that your web server is configured to suppress "X-Powered-By" headers.',
      cweId: 200,
      evidence: 'X-Powered-By: Express',
    },
    {
      pluginId: '10050',
      name: 'Application Error Disclosure',
      risk: 'Medium',
      confidence: 'Medium',
      description: 'This page contains an error/warning message that may disclose sensitive information.',
      solution: 'Review the source code of this page. Implement custom error pages.',
      cweId: 200,
      evidence: 'Error: ENOENT: no such file or directory',
    },
  ];

  infoDisclosureAlerts.forEach((template, index) => {
    alerts.push({
      id: generateId(),
      pluginId: template.pluginId!,
      name: template.name!,
      risk: template.risk as DASTRisk,
      confidence: template.confidence as DASTConfidence,
      description: template.description!,
      url: `${targetUrl}${index === 0 ? '/api' : `/page${index + 10}`}`,
      method: 'GET',
      evidence: template.evidence,
      solution: template.solution!,
      cweId: template.cweId,
    });
  });

  // Add more alerts for full scan
  if (scanProfile === 'full') {
    const fullScanAlerts: Partial<DASTAlert>[] = [
      {
        pluginId: '40012',
        name: 'Cross Site Scripting (Reflected)',
        risk: 'High',
        confidence: 'Medium',
        description: 'Cross-site Scripting (XSS) is an attack technique that involves echoing attacker-supplied code into a user\'s browser instance.',
        solution: 'Use a vetted library or framework that does not allow this weakness to occur.',
        cweId: 79,
        param: 'search',
        attack: '<script>alert(1)</script>',
        evidence: '<script>alert(1)</script>',
      },
      {
        pluginId: '40014',
        name: 'Cross Site Scripting (Persistent)',
        risk: 'High',
        confidence: 'High',
        description: 'Cross-site Scripting (XSS) is an attack technique that involves echoing attacker-supplied code into a user\'s browser instance.',
        solution: 'Use a vetted library or framework that does not allow this weakness to occur.',
        cweId: 79,
        param: 'comment',
        attack: '<img src=x onerror=alert(1)>',
      },
      {
        pluginId: '40018',
        name: 'SQL Injection',
        risk: 'High',
        confidence: 'Medium',
        description: 'SQL injection may be possible.',
        solution: 'Do not trust client side input, even if there is client side validation in place.',
        cweId: 89,
        param: 'id',
        attack: '1\' OR \'1\'=\'1',
      },
      {
        pluginId: '90020',
        name: 'Remote OS Command Injection',
        risk: 'High',
        confidence: 'Medium',
        description: 'Attack technique used for unauthorized execution of operating system commands.',
        solution: 'If possible, use library calls rather than external processes to recreate the desired functionality.',
        cweId: 78,
        param: 'filename',
        attack: '; cat /etc/passwd',
      },
      {
        pluginId: '10095',
        name: 'Insecure Direct Object Reference (IDOR)',
        risk: 'High',
        confidence: 'Medium',
        description: 'The application appears to allow access to objects by manipulating a predictable identifier.',
        solution: 'Implement proper access control checks that verify the requesting user has permission.',
        cweId: 639,
        param: 'user_id',
        attack: 'Changed user_id from 123 to 456',
        evidence: 'Successfully accessed data belonging to user 456 while authenticated as user 123',
      },
    ];

    fullScanAlerts.forEach((template) => {
      alerts.push({
        id: generateId(),
        pluginId: template.pluginId!,
        name: template.name!,
        risk: template.risk as DASTRisk,
        confidence: template.confidence as DASTConfidence,
        description: template.description!,
        url: `${targetUrl}/api/v1/data`,
        method: 'POST',
        param: template.param,
        attack: template.attack,
        evidence: template.evidence,
        solution: template.solution!,
        cweId: template.cweId,
      });
    });
  }

  // Add API-specific alerts for API scan
  if (scanProfile === 'api') {
    const apiAlerts: Partial<DASTAlert>[] = [
      {
        pluginId: '10098',
        name: 'Cross-Domain Misconfiguration',
        risk: 'Medium',
        confidence: 'Medium',
        description: 'Web browser data loading may be possible, due to a Cross Origin Resource Sharing (CORS) misconfiguration.',
        solution: 'Ensure that sensitive data is not available in an unauthenticated manner.',
        cweId: 264,
      },
      {
        pluginId: '10105',
        name: 'Weak Authentication Method',
        risk: 'Medium',
        confidence: 'Medium',
        description: 'HTTP basic authentication is used over an unencrypted connection.',
        solution: 'Protect the connection using HTTPS or use a more secure authentication mechanism.',
        cweId: 326,
      },
      {
        pluginId: '40003',
        name: 'CRLF Injection',
        risk: 'Medium',
        confidence: 'Medium',
        description: 'Cookie can be set via CRLF injection. It may also be possible to set arbitrary HTTP response headers.',
        solution: 'Type-check and validation of user input.',
        cweId: 113,
      },
      {
        pluginId: '10109',
        name: 'Modern Web Application',
        risk: 'Informational',
        confidence: 'Medium',
        description: 'The application appears to be a modern web application.',
        solution: 'This is an informational alert and no changes are required.',
      },
    ];

    apiAlerts.forEach((template, index) => {
      alerts.push({
        id: generateId(),
        pluginId: template.pluginId!,
        name: template.name!,
        risk: template.risk as DASTRisk,
        confidence: template.confidence as DASTConfidence,
        description: template.description!,
        url: `${targetUrl}/api/v1/${['users', 'orders', 'products', 'auth'][index % 4]}`,
        method: ['GET', 'POST', 'PUT', 'DELETE'][index % 4] as string,
        solution: template.solution!,
        cweId: template.cweId,
      });
    });
  }

  // Add auth-related alerts if auth is configured
  if (authConfig?.enabled) {
    alerts.push({
      id: generateId(),
      pluginId: '10012',
      name: 'Password Autocomplete in Browser',
      risk: 'Low',
      confidence: 'Medium',
      description: 'The AUTOCOMPLETE attribute is not disabled on an HTML FORM/INPUT element containing password type input.',
      url: authConfig.loginUrl || `${targetUrl}/login`,
      method: 'GET',
      solution: 'Turn off AUTOCOMPLETE attribute in the form or individual input elements containing password.',
      cweId: 525,
    });
  }

  return alerts;
}
