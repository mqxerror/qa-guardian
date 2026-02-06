/**
 * PDF Export Utilities for Test Run Results
 * Feature #46: Extracted from TestRunResultPage.tsx for modularity
 * Features #1910, #1911: K6 and Lighthouse PDF export functions
 * Feature #105: jsPDF is now lazy-loaded for better bundle performance
 */

// Type for jsPDF since we're loading it dynamically
type jsPDF = import('jspdf').jsPDF;

interface PdfHelpers {
  pdf: jsPDF;
  pageWidth: number;
  margin: number;
  yPos: number;
}

// Helper to add title to PDF
const addTitle = (helpers: PdfHelpers, text: string, size: number = 16, color: [number, number, number] = [0, 0, 0]) => {
  const { pdf, margin } = helpers;
  pdf.setFontSize(size);
  pdf.setTextColor(...color);
  pdf.text(text, margin, helpers.yPos);
  helpers.yPos += size / 2 + 4;
};

// Helper to add text to PDF
const addText = (helpers: PdfHelpers, text: string, size: number = 10, color: [number, number, number] = [60, 60, 60]) => {
  const { pdf, pageWidth, margin } = helpers;
  pdf.setFontSize(size);
  pdf.setTextColor(...color);
  const lines = pdf.splitTextToSize(text, pageWidth - 2 * margin);
  pdf.text(lines, margin, helpers.yPos);
  helpers.yPos += lines.length * (size / 2 + 2);
};

// Helper to add metric row to PDF
const addMetricRow = (helpers: PdfHelpers, label: string, value: string, status?: 'good' | 'warning' | 'bad') => {
  const { pdf, pageWidth, margin } = helpers;
  pdf.setFontSize(10);
  pdf.setTextColor(100, 100, 100);
  pdf.text(label, margin, helpers.yPos);

  // Color based on status
  if (status === 'good') pdf.setTextColor(34, 197, 94);
  else if (status === 'warning') pdf.setTextColor(234, 179, 8);
  else if (status === 'bad') pdf.setTextColor(239, 68, 68);
  else pdf.setTextColor(0, 0, 0);

  pdf.text(value, pageWidth - margin - pdf.getTextWidth(value), helpers.yPos);
  helpers.yPos += 7;
};

// Helper to check if new page is needed
const checkNewPage = (helpers: PdfHelpers, neededSpace: number = 30) => {
  const { pdf } = helpers;
  if (helpers.yPos > pdf.internal.pageSize.getHeight() - neededSpace) {
    pdf.addPage();
    helpers.yPos = 20;
  }
};

// Helper to draw score gauge in PDF
const drawScoreGauge = (helpers: PdfHelpers, score: number, label: string, x: number, y: number) => {
  const { pdf } = helpers;
  const radius = 15;

  // Background circle
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(3);
  pdf.circle(x, y, radius, 'S');

  // Score arc
  if (score >= 90) pdf.setDrawColor(34, 197, 94);
  else if (score >= 50) pdf.setDrawColor(234, 179, 8);
  else pdf.setDrawColor(239, 68, 68);

  // Draw arc (simplified - just the score as text in center)
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  if (score >= 90) pdf.setTextColor(34, 197, 94);
  else if (score >= 50) pdf.setTextColor(234, 179, 8);
  else pdf.setTextColor(239, 68, 68);
  pdf.text(String(score), x - 5, y + 4);

  // Label below
  pdf.setFontSize(8);
  pdf.setTextColor(100, 100, 100);
  pdf.setFont('helvetica', 'normal');
  pdf.text(label, x - pdf.getTextWidth(label) / 2, y + radius + 8);
};

/**
 * Export K6 Load Test results as PDF
 * Feature #1910
 * Feature #105: Lazy loads jsPDF (387KB) only when export is triggered
 */
export const exportK6ResultsPDF = async (loadTestData: any, testName: string) => {
  if (!loadTestData) return;

  // Lazy load jsPDF only when needed
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 20;
  const helpers: PdfHelpers = { pdf, pageWidth, margin, yPos: 20 };

  // === PAGE 1: Executive Summary ===

  // Company branding area
  pdf.setFillColor(59, 130, 246); // Blue header
  pdf.rect(0, 0, pageWidth, 35, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(22);
  pdf.setFont('helvetica', 'bold');
  pdf.text('K6 Load Test Report', margin, 22);

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, 30);

  helpers.yPos = 45;

  // Test Info
  pdf.setTextColor(0, 0, 0);
  addTitle(helpers, `Test: ${testName}`, 14);

  // Calculate overall status
  const successRate = parseFloat(String(loadTestData.summary?.success_rate).replace('%', '')) || 0;
  const errorRate = 100 - successRate;
  const thresholds = loadTestData.thresholds || {};
  const thresholdsFailed = Object.values(thresholds).filter(v => !v).length;
  const overallStatus = successRate >= 99 && errorRate < 1 && thresholdsFailed === 0 ? 'PASSED' :
                        successRate >= 95 && errorRate < 5 ? 'WARNING' : 'FAILED';

  // Status badge
  if (overallStatus === 'PASSED') pdf.setFillColor(34, 197, 94);
  else if (overallStatus === 'WARNING') pdf.setFillColor(234, 179, 8);
  else pdf.setFillColor(239, 68, 68);

  pdf.roundedRect(margin, helpers.yPos, 40, 10, 2, 2, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.text(overallStatus, margin + 20 - pdf.getTextWidth(overallStatus) / 2, helpers.yPos + 7);
  helpers.yPos += 18;

  // Executive Summary text
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(60, 60, 60);
  const summaryText = overallStatus === 'PASSED'
    ? `The system successfully handled ${(loadTestData.summary?.total_requests || 0).toLocaleString()} requests from ${loadTestData.virtual_users?.configured || loadTestData.configuration?.target_vus || loadTestData.summary?.max_vus || 0} concurrent users with a ${successRate.toFixed(1)}% success rate and ${loadTestData.response_times?.p95 || 0}ms P95 latency.`
    : overallStatus === 'WARNING'
    ? `The system processed ${(loadTestData.summary?.total_requests || 0).toLocaleString()} requests but showed signs of stress with ${errorRate.toFixed(1)}% errors. Consider optimizing before production deployment.`
    : `Performance issues detected: ${thresholdsFailed} threshold(s) failed, ${errorRate.toFixed(1)}% error rate. Investigation required.`;
  addText(helpers, summaryText);

  helpers.yPos += 8;

  // Key Metrics Section
  addTitle(helpers, 'Key Metrics', 14, [0, 0, 0]);

  pdf.setDrawColor(200, 200, 200);
  pdf.line(margin, helpers.yPos - 2, pageWidth - margin, helpers.yPos - 2);
  helpers.yPos += 4;

  addMetricRow(helpers, 'Total Requests', (loadTestData.summary?.total_requests || 0).toLocaleString());
  addMetricRow(helpers, 'Requests/sec', `${loadTestData.summary?.requests_per_second || 0}`);
  addMetricRow(helpers, 'Success Rate', `${loadTestData.summary?.success_rate || '0%'}`, successRate >= 99 ? 'good' : successRate >= 95 ? 'warning' : 'bad');
  addMetricRow(helpers, 'Error Rate', `${errorRate.toFixed(2)}%`, errorRate < 1 ? 'good' : errorRate < 5 ? 'warning' : 'bad');
  addMetricRow(helpers, 'Virtual Users', `${loadTestData.virtual_users?.configured || loadTestData.configuration?.target_vus || loadTestData.summary?.max_vus || 0}`);
  addMetricRow(helpers, 'Duration', `${loadTestData.configuration?.duration || loadTestData.summary?.duration_formatted || 'N/A'}`);
  addMetricRow(helpers, 'Data Transferred', `${loadTestData.summary?.data_transferred_formatted || '0 B'}`);

  helpers.yPos += 10;
  checkNewPage(helpers, 60);

  // Response Times Section
  addTitle(helpers, 'Response Times', 14, [0, 0, 0]);
  pdf.line(margin, helpers.yPos - 2, pageWidth - margin, helpers.yPos - 2);
  helpers.yPos += 4;

  const rt = loadTestData.response_times || {};
  addMetricRow(helpers, 'Minimum', `${rt.min || 0}ms`);
  addMetricRow(helpers, 'Average', `${rt.avg || 0}ms`);
  addMetricRow(helpers, 'Median (P50)', `${rt.median || rt.p50 || 0}ms`);
  addMetricRow(helpers, 'P90', `${rt.p90 || 0}ms`);
  addMetricRow(helpers, 'P95', `${rt.p95 || 0}ms`, (rt.p95 || 0) < 500 ? 'good' : (rt.p95 || 0) < 1000 ? 'warning' : 'bad');
  addMetricRow(helpers, 'P99', `${rt.p99 || 0}ms`);
  addMetricRow(helpers, 'Maximum', `${rt.max || 0}ms`);

  helpers.yPos += 10;
  checkNewPage(helpers, 60);

  // Thresholds Section
  if (loadTestData.thresholds && Object.keys(loadTestData.thresholds).length > 0) {
    addTitle(helpers, 'Thresholds', 14, [0, 0, 0]);
    pdf.line(margin, helpers.yPos - 2, pageWidth - margin, helpers.yPos - 2);
    helpers.yPos += 4;

    Object.entries(loadTestData.thresholds).forEach(([name, passed]) => {
      addMetricRow(helpers, name.replace(/_/g, ' '), passed ? 'PASSED' : 'FAILED', passed ? 'good' : 'bad');
    });

    helpers.yPos += 10;
    checkNewPage(helpers, 60);
  }

  // HTTP Status Codes Section
  if (loadTestData.http_codes && Object.keys(loadTestData.http_codes).length > 0) {
    addTitle(helpers, 'HTTP Status Codes', 14, [0, 0, 0]);
    pdf.line(margin, helpers.yPos - 2, pageWidth - margin, helpers.yPos - 2);
    helpers.yPos += 4;

    Object.entries(loadTestData.http_codes).forEach(([code, count]) => {
      const codeNum = parseInt(code);
      const status = codeNum < 300 ? 'good' : codeNum < 400 ? undefined : codeNum < 500 ? 'warning' : 'bad';
      addMetricRow(helpers, `HTTP ${code}`, (count as number).toLocaleString(), status);
    });

    helpers.yPos += 10;
    checkNewPage(helpers, 60);
  }

  // === PAGE 2+: Detailed Analysis ===
  pdf.addPage();
  helpers.yPos = 20;

  // Recommendations Section
  addTitle(helpers, 'Recommendations', 14, [0, 0, 0]);
  pdf.line(margin, helpers.yPos - 2, pageWidth - margin, helpers.yPos - 2);
  helpers.yPos += 4;

  const recommendations: string[] = [];

  if (errorRate >= 5) {
    recommendations.push('• High error rate detected. Investigate server logs and identify root cause of failures.');
  }
  if ((rt.p95 || 0) > 1000) {
    recommendations.push('• P95 response time exceeds 1 second. Consider optimizing database queries and caching strategies.');
  }
  if ((rt.p95 || 0) > 500 && (rt.p95 || 0) <= 1000) {
    recommendations.push('• P95 response time is moderate. Monitor for degradation under higher load.');
  }
  if (thresholdsFailed > 0) {
    recommendations.push(`• ${thresholdsFailed} threshold(s) failed. Review threshold configurations or optimize system performance.`);
  }
  if (successRate < 99) {
    recommendations.push('• Success rate below 99%. Investigate failed requests and implement retry mechanisms if appropriate.');
  }
  if (overallStatus === 'PASSED') {
    recommendations.push('• All metrics within acceptable range. Consider increasing load to find system limits.');
    recommendations.push('• Document this baseline for future regression testing.');
  }

  recommendations.forEach(rec => {
    addText(helpers, rec, 10, [60, 60, 60]);
    helpers.yPos += 2;
  });

  helpers.yPos += 10;

  // Configuration Section
  checkNewPage(helpers, 50);
  addTitle(helpers, 'Test Configuration', 14, [0, 0, 0]);
  pdf.line(margin, helpers.yPos - 2, pageWidth - margin, helpers.yPos - 2);
  helpers.yPos += 4;

  if (loadTestData.configuration) {
    addMetricRow(helpers, 'Target VUs', `${loadTestData.configuration.target_vus || 'N/A'}`);
    addMetricRow(helpers, 'Duration', `${loadTestData.configuration.duration || 'N/A'}`);
    addMetricRow(helpers, 'Ramp-up', `${loadTestData.configuration.ramp_up || 'N/A'}`);
    if (loadTestData.configuration.script_name) {
      addMetricRow(helpers, 'Script', loadTestData.configuration.script_name);
    }
  }

  // Footer on all pages
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 20, pdf.internal.pageSize.getHeight() - 10);
    pdf.text('Generated by QA Guardian', margin, pdf.internal.pageSize.getHeight() - 10);
  }

  // Save PDF
  pdf.save(`k6-report-${testName.replace(/[^a-z0-9]/gi, '_')}-${Date.now()}.pdf`);
};

/**
 * Export Lighthouse results as PDF
 * Feature #1911
 * Feature #105: Lazy loads jsPDF (387KB) only when export is triggered
 */
export const exportLighthousePDF = async (lighthouseData: any, testName: string, url?: string) => {
  if (!lighthouseData) return;

  // Lazy load jsPDF only when needed
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 20;
  const helpers: PdfHelpers = { pdf, pageWidth, margin, yPos: 20 };

  // === PAGE 1: Executive Summary ===

  // Header with gradient effect (purple theme for Lighthouse)
  pdf.setFillColor(147, 51, 234); // Purple header
  pdf.rect(0, 0, pageWidth, 35, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(22);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Lighthouse Performance Report', margin, 22);

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, 30);

  helpers.yPos = 45;

  // Test Info
  pdf.setTextColor(0, 0, 0);
  addTitle(helpers, `Test: ${testName}`, 14);
  if (url) {
    addText(helpers, `URL: ${url}`, 10, [100, 100, 100]);
  }

  helpers.yPos += 4;

  // Calculate overall status
  const scores = [
    lighthouseData.performance || 0,
    lighthouseData.accessibility || 0,
    lighthouseData.best_practices || lighthouseData.bestPractices || 0,
    lighthouseData.seo || 0,
  ].filter(s => s > 0);
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0;
  const minScore = scores.length > 0 ? Math.min(...scores) : 0;
  const overallStatus = minScore >= 90 ? 'EXCELLENT' : minScore >= 50 ? 'NEEDS IMPROVEMENT' : 'POOR';

  // Status badge
  if (overallStatus === 'EXCELLENT') pdf.setFillColor(34, 197, 94);
  else if (overallStatus === 'NEEDS IMPROVEMENT') pdf.setFillColor(234, 179, 8);
  else pdf.setFillColor(239, 68, 68);

  pdf.roundedRect(margin, helpers.yPos, 55, 10, 2, 2, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.text(overallStatus, margin + 27.5 - pdf.getTextWidth(overallStatus) / 2, helpers.yPos + 7);
  helpers.yPos += 18;

  // Executive Summary text
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(60, 60, 60);
  const summaryText = overallStatus === 'EXCELLENT'
    ? `This page achieves excellent scores across all Lighthouse categories with an average of ${avgScore}. It provides a fast, accessible, and SEO-friendly user experience.`
    : overallStatus === 'NEEDS IMPROVEMENT'
    ? `This page has an average Lighthouse score of ${avgScore}. Some categories need attention to meet modern web standards.`
    : `This page has significant performance issues with an average score of ${avgScore}. Immediate optimization is recommended.`;
  addText(helpers, summaryText);

  helpers.yPos += 8;

  // Score Gauges
  const gaugeStartX = margin + 20;
  const gaugeSpacing = 40;
  const gaugeY = helpers.yPos + 20;

  [
    { label: 'Performance', score: lighthouseData.performance || 0 },
    { label: 'Accessibility', score: lighthouseData.accessibility || 0 },
    { label: 'Best Practices', score: lighthouseData.best_practices || lighthouseData.bestPractices || 0 },
    { label: 'SEO', score: lighthouseData.seo || 0 },
  ].forEach((item, idx) => {
    drawScoreGauge(helpers, item.score, item.label, gaugeStartX + idx * gaugeSpacing, gaugeY);
  });

  helpers.yPos = gaugeY + 35;

  // Core Web Vitals Section
  if (lighthouseData.metrics) {
    helpers.yPos += 10;
    addTitle(helpers, 'Core Web Vitals', 14, [0, 0, 0]);
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, helpers.yPos - 2, pageWidth - margin, helpers.yPos - 2);
    helpers.yPos += 4;

    const metrics = lighthouseData.metrics;
    if (metrics.lcp) {
      const lcpSec = (metrics.lcp / 1000).toFixed(2);
      addMetricRow(helpers, 'Largest Contentful Paint (LCP)', `${lcpSec}s`, metrics.lcp < 2500 ? 'good' : metrics.lcp < 4000 ? 'warning' : 'bad');
    }
    if (metrics.fid) {
      addMetricRow(helpers, 'First Input Delay (FID)', `${metrics.fid}ms`, metrics.fid < 100 ? 'good' : metrics.fid < 300 ? 'warning' : 'bad');
    }
    if (metrics.cls !== undefined) {
      addMetricRow(helpers, 'Cumulative Layout Shift (CLS)', `${metrics.cls.toFixed(3)}`, metrics.cls < 0.1 ? 'good' : metrics.cls < 0.25 ? 'warning' : 'bad');
    }
    if (metrics.fcp) {
      const fcpSec = (metrics.fcp / 1000).toFixed(2);
      addMetricRow(helpers, 'First Contentful Paint (FCP)', `${fcpSec}s`, metrics.fcp < 1800 ? 'good' : metrics.fcp < 3000 ? 'warning' : 'bad');
    }
    if (metrics.tbt) {
      addMetricRow(helpers, 'Total Blocking Time (TBT)', `${metrics.tbt}ms`, metrics.tbt < 200 ? 'good' : metrics.tbt < 600 ? 'warning' : 'bad');
    }
    if (metrics.ttfb) {
      addMetricRow(helpers, 'Time to First Byte (TTFB)', `${metrics.ttfb}ms`, metrics.ttfb < 200 ? 'good' : metrics.ttfb < 500 ? 'warning' : 'bad');
    }
    if (metrics.si) {
      const siSec = (metrics.si / 1000).toFixed(2);
      addMetricRow(helpers, 'Speed Index', `${siSec}s`, metrics.si < 3400 ? 'good' : metrics.si < 5800 ? 'warning' : 'bad');
    }
  }

  helpers.yPos += 10;
  checkNewPage(helpers, 60);

  // Opportunities Section
  if (lighthouseData.opportunities && lighthouseData.opportunities.length > 0) {
    addTitle(helpers, 'Opportunities for Improvement', 14, [0, 0, 0]);
    pdf.line(margin, helpers.yPos - 2, pageWidth - margin, helpers.yPos - 2);
    helpers.yPos += 4;

    lighthouseData.opportunities.slice(0, 5).forEach((opp: any) => {
      const savings = opp.savings >= 1000 ? `${(opp.savings / 1000).toFixed(1)}s` : `${opp.savings}ms`;
      addMetricRow(helpers, opp.title, `Save ${savings}`, opp.savings > 1000 ? 'bad' : opp.savings > 500 ? 'warning' : undefined);
    });

    helpers.yPos += 10;
    checkNewPage(helpers, 60);
  }

  // Diagnostics Section
  if (lighthouseData.diagnostics && lighthouseData.diagnostics.length > 0) {
    addTitle(helpers, 'Diagnostics', 14, [0, 0, 0]);
    pdf.line(margin, helpers.yPos - 2, pageWidth - margin, helpers.yPos - 2);
    helpers.yPos += 4;

    lighthouseData.diagnostics.slice(0, 5).forEach((diag: any) => {
      addText(helpers, `• ${diag.title}`, 10, [60, 60, 60]);
    });

    helpers.yPos += 10;
  }

  // Footer on all pages
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 20, pdf.internal.pageSize.getHeight() - 10);
    pdf.text('Generated by QA Guardian', margin, pdf.internal.pageSize.getHeight() - 10);
  }

  // Save PDF
  pdf.save(`lighthouse-report-${testName.replace(/[^a-z0-9]/gi, '_')}-${Date.now()}.pdf`);
};
