/**
 * Report Generation Utilities
 * Feature #46: Extracted from TestRunResultPage.tsx for modularity
 * Feature #105: jsPDF is now lazy-loaded for better bundle performance
 *
 * Contains functions for generating PDF and HTML test reports.
 */

import type { jsPDF } from 'jspdf';
import { TestRun, ResultSummary, PdfSections } from './types';
import { formatDuration } from './utils';

/**
 * Parameters for PDF report generation
 */
export interface PdfReportParams {
  run: TestRun;
  resultSummary: ResultSummary;
  pdfSections: PdfSections;
  logoBase64?: string | null;
  organizationName?: string;
  setGeneratingPdf: (generating: boolean) => void;
}

/**
 * Parameters for HTML report generation
 */
export interface HtmlReportParams {
  run: TestRun;
  resultSummary: ResultSummary;
  setGeneratingHtml: (generating: boolean) => void;
}

/**
 * Helper to escape HTML special characters
 */
export const escapeHtml = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Helper to infer test type from result data if test_type not explicitly set
 */
const inferTestType = (result: TestRun['results'][0]): string => {
  // If explicit test_type is set, use it
  if (result.test_type) {
    // Map backend types to display names
    const typeMap: Record<string, string> = {
      'visual_regression': 'VISUAL',
      'lighthouse': 'PERFORMANCE',
      'load': 'LOAD',
      'accessibility': 'ACCESSIBILITY',
      'e2e': 'E2E',
    };
    return typeMap[result.test_type] || result.test_type.toUpperCase();
  }
  // Infer from test data
  if (result.steps.some(s => s.lighthouse)) return 'PERFORMANCE';
  if (result.steps.some(s => s.accessibility)) return 'ACCESSIBILITY';
  if (result.visual_comparison || result.baseline_screenshot_base64 || result.diff_image_base64) return 'VISUAL';
  if (result.steps.some(s => s.load_test)) return 'LOAD';
  return 'E2E';
};

/**
 * Generate a professional PDF test report
 * Feature #1992: Customizable sections, Feature #1995: Company branding
 */
export const generatePdfReport = async ({
  run,
  resultSummary,
  pdfSections,
  logoBase64,
  organizationName,
  setGeneratingPdf,
}: PdfReportParams): Promise<void> => {
  if (!run) return;

  setGeneratingPdf(true);
  try {
    // Feature #105: Lazy load jsPDF (387KB) only when export is triggered
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF();
    let yPos = 20;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;

    // Calculate metrics
    const passRate = resultSummary.total > 0 ? Math.round((resultSummary.passed / resultSummary.total) * 100) : 0;
    const healthScore = resultSummary.total > 0 ? Math.round((resultSummary.passed / resultSummary.total) * 100) : 0;
    const failedTests = resultSummary.failed;

    // Helper to add new page if needed
    const checkNewPage = (height: number) => {
      if (yPos + height > pageHeight - 25) {
        pdf.addPage();
        yPos = 20;
      }
    };

    // Helper to draw a simple pie chart
    const drawPieChart = (x: number, y: number, radius: number, passed: number, failed: number, skipped: number) => {
      const total = passed + failed + skipped;
      if (total === 0) return;

      const centerX = x;
      const centerY = y;
      let startAngle = -Math.PI / 2; // Start from top

      // Draw passed segment (green)
      if (passed > 0) {
        const passedAngle = (passed / total) * 2 * Math.PI;
        pdf.setFillColor(34, 197, 94);
        drawPieSlice(pdf, centerX, centerY, radius, startAngle, startAngle + passedAngle);
        startAngle += passedAngle;
      }

      // Draw failed segment (red)
      if (failed > 0) {
        const failedAngle = (failed / total) * 2 * Math.PI;
        pdf.setFillColor(239, 68, 68);
        drawPieSlice(pdf, centerX, centerY, radius, startAngle, startAngle + failedAngle);
        startAngle += failedAngle;
      }

      // Draw skipped segment (gray)
      if (skipped > 0) {
        const skippedAngle = (skipped / total) * 2 * Math.PI;
        pdf.setFillColor(156, 163, 175);
        drawPieSlice(pdf, centerX, centerY, radius, startAngle, startAngle + skippedAngle);
      }
    };

    // Helper to draw pie slice
    const drawPieSlice = (doc: jsPDF, cx: number, cy: number, r: number, startA: number, endA: number) => {
      const steps = 20;
      const angleStep = (endA - startA) / steps;
      const points: [number, number][] = [[cx, cy]];

      for (let i = 0; i <= steps; i++) {
        const angle = startA + i * angleStep;
        points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
      }

      // Draw filled polygon
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.5);
      // Use triangle approach for simplicity
      for (let i = 1; i < points.length - 1; i++) {
        doc.triangle(cx, cy, points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], 'F');
      }
    };

    // === HEADER SECTION ===
    // Feature #1995: Company branding in PDF header
    // Blue gradient header background
    pdf.setFillColor(59, 130, 246);
    pdf.rect(0, 0, pageWidth, 45, 'F');

    // Company logo (if available)
    let titleOffset = margin;
    if (logoBase64) {
      try {
        // Add company logo on the left side of header
        const logoHeight = 28;
        const logoWidth = 28;
        const logoY = 8;
        pdf.addImage(logoBase64, 'PNG', margin, logoY, logoWidth, logoHeight);
        titleOffset = margin + logoWidth + 8; // Offset title to the right of logo
      } catch (logoError) {
        console.warn('Failed to add logo to PDF:', logoError);
      }
    }

    // Title
    pdf.setFontSize(26);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 255, 255);
    pdf.text('Test Run Report', titleOffset, 28);

    // Organization name (below title if logo is present)
    if (logoBase64 && organizationName && organizationName !== 'My Organization') {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(organizationName, titleOffset, 38);
    }

    // Run ID badge
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Run #${run.id.slice(-8)}`, pageWidth - margin - 30, 28);

    yPos = 55;

    // === EXECUTIVE SUMMARY SECTION ===
    // Feature #1992: Conditionally include based on pdfSections
    if (pdfSections.summary) {
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(30, 41, 59);
    pdf.text('Executive Summary', margin, yPos);
    yPos += 12;

    // Executive summary box
    pdf.setFillColor(248, 250, 252);
    pdf.setDrawColor(226, 232, 240);
    pdf.roundedRect(margin, yPos, contentWidth, 65, 3, 3, 'FD');

    const boxY = yPos + 8;
    const colWidth = contentWidth / 3;

    // Column 1: Health Score with circular indicator
    const healthX = margin + colWidth / 2;
    const healthY = boxY + 15;

    // Draw health score circle
    const scoreRadius = 18;
    // Background circle
    pdf.setFillColor(healthScore >= 80 ? 220 : healthScore >= 50 ? 254 : 254,
                     healthScore >= 80 ? 252 : healthScore >= 50 ? 243 : 226,
                     healthScore >= 80 ? 231 : healthScore >= 50 ? 199 : 226);
    pdf.circle(healthX, healthY, scoreRadius, 'F');
    // Score text
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(healthScore >= 80 ? 34 : healthScore >= 50 ? 217 : 239,
                     healthScore >= 80 ? 197 : healthScore >= 50 ? 119 : 68,
                     healthScore >= 80 ? 94 : healthScore >= 50 ? 6 : 68);
    pdf.text(String(healthScore), healthX - pdf.getTextWidth(String(healthScore)) / 2, healthY + 2);
    pdf.setFontSize(8);
    pdf.text('/100', healthX - pdf.getTextWidth('/100') / 2, healthY + 10);

    // Label
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 116, 139);
    pdf.text('Health Score', healthX - pdf.getTextWidth('Health Score') / 2, healthY + scoreRadius + 10);

    // Column 2: Pass Rate with percentage
    const passX = margin + colWidth + colWidth / 2;
    const passY = boxY + 8;

    pdf.setFontSize(10);
    pdf.setTextColor(100, 116, 139);
    pdf.text('Pass Rate', passX - pdf.getTextWidth('Pass Rate') / 2, passY);

    pdf.setFontSize(28);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(passRate >= 80 ? 34 : passRate >= 50 ? 217 : 239,
                     passRate >= 80 ? 197 : passRate >= 50 ? 119 : 68,
                     passRate >= 80 ? 94 : passRate >= 50 ? 6 : 68);
    pdf.text(`${passRate}%`, passX - pdf.getTextWidth(`${passRate}%`) / 2, passY + 18);

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 116, 139);
    const passText = `(${resultSummary.passed}/${resultSummary.total} tests)`;
    pdf.text(passText, passX - pdf.getTextWidth(passText) / 2, passY + 26);

    // Column 3: Critical Issues
    const issuesX = margin + 2 * colWidth + colWidth / 2;
    const issuesY = boxY + 8;

    pdf.setFontSize(10);
    pdf.setTextColor(100, 116, 139);
    pdf.text('Critical Issues', issuesX - pdf.getTextWidth('Critical Issues') / 2, issuesY);

    pdf.setFontSize(28);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(failedTests > 0 ? 239 : 34, failedTests > 0 ? 68 : 197, failedTests > 0 ? 68 : 94);
    pdf.text(String(failedTests), issuesX - pdf.getTextWidth(String(failedTests)) / 2, issuesY + 18);

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 116, 139);
    const failText = failedTests === 1 ? 'failure' : 'failures';
    pdf.text(failText, issuesX - pdf.getTextWidth(failText) / 2, issuesY + 26);

    yPos += 75;

    // === METRICS ROW ===
    const metricsY = yPos;
    const metricBoxWidth = contentWidth / 4 - 3;

    // Metric boxes
    const metrics = [
      { label: 'Total Tests', value: String(resultSummary.total), color: [59, 130, 246] },
      { label: 'Passed', value: String(resultSummary.passed), color: [34, 197, 94] },
      { label: 'Failed', value: String(resultSummary.failed), color: [239, 68, 68] },
      { label: 'Duration', value: formatDuration(run.duration_ms), color: [139, 92, 246] },
    ];

    metrics.forEach((metric, i) => {
      const boxX = margin + i * (metricBoxWidth + 4);
      pdf.setFillColor(metric.color[0], metric.color[1], metric.color[2]);
      pdf.roundedRect(boxX, metricsY, metricBoxWidth, 25, 2, 2, 'F');

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(255, 255, 255);
      pdf.text(metric.label, boxX + metricBoxWidth / 2 - pdf.getTextWidth(metric.label) / 2, metricsY + 8);

      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(metric.value, boxX + metricBoxWidth / 2 - pdf.getTextWidth(metric.value) / 2, metricsY + 19);
    });

    yPos = metricsY + 35;
    } // End pdfSections.summary

    // === TEST BREAKDOWN BY TYPE SECTION ===
    // Feature #1992: Conditionally include based on pdfSections
    if (pdfSections.typeBreakdown) {
    // Group tests by type and calculate stats for each
    const testsByType = new Map<string, { passed: number; failed: number; skipped: number; total: number }>();

    run.results.forEach((result) => {
      const testType = inferTestType(result);
      if (!testsByType.has(testType)) {
        testsByType.set(testType, { passed: 0, failed: 0, skipped: 0, total: 0 });
      }
      const typeStats = testsByType.get(testType)!;
      typeStats.total++;
      if (result.status === 'passed') {
        typeStats.passed++;
      } else if (result.status === 'failed' || result.status === 'error') {
        typeStats.failed++;
      } else {
        typeStats.skipped++;
      }
    });

    // Only show breakdown if there's more than one type or multiple tests
    if (testsByType.size > 0) {
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(30, 41, 59);
      pdf.text('Test Breakdown by Type', margin, yPos);
      yPos += 10;

      // Calculate layout - show types in a grid
      const typeEntries = Array.from(testsByType.entries()).sort((a, b) => b[1].total - a[1].total);
      const typeBoxWidth = (contentWidth - 10) / Math.min(typeEntries.length, 3);
      const typeBoxHeight = 50;

      typeEntries.forEach((entry, idx) => {
        const [typeName, stats] = entry;
        const col = idx % 3;
        const row = Math.floor(idx / 3);

        if (col === 0 && row > 0) {
          yPos += typeBoxHeight + 8;
          checkNewPage(typeBoxHeight + 10);
        }

        const boxX = margin + col * (typeBoxWidth + 5);
        const boxY = yPos;

        // Type box background
        pdf.setFillColor(248, 250, 252);
        pdf.setDrawColor(226, 232, 240);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(boxX, boxY, typeBoxWidth, typeBoxHeight, 2, 2, 'FD');

        // Type name header with colored accent
        const typeColors: Record<string, [number, number, number]> = {
          'E2E': [59, 130, 246],       // Blue
          'VISUAL': [139, 92, 246],    // Purple
          'ACCESSIBILITY': [34, 197, 94], // Green
          'A11Y': [34, 197, 94],       // Green
          'SMOKE': [245, 158, 11],     // Amber
          'LOAD': [236, 72, 153],      // Pink
          'PERFORMANCE': [6, 182, 212], // Cyan
          'SECURITY': [239, 68, 68],   // Red
          'API': [16, 185, 129],       // Emerald
        };
        const typeColor = typeColors[typeName] || [107, 114, 128]; // Default gray

        // Color accent bar at top
        pdf.setFillColor(typeColor[0], typeColor[1], typeColor[2]);
        pdf.rect(boxX, boxY, typeBoxWidth, 4, 'F');

        // Type name
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 41, 59);
        pdf.text(typeName, boxX + 5, boxY + 14);

        // Total count
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100, 116, 139);
        pdf.text(`${stats.total} test${stats.total > 1 ? 's' : ''}`, boxX + 5, boxY + 22);

        // Pass/Fail mini bar
        const barY = boxY + 28;
        const barWidth = typeBoxWidth - 10;
        const barHeight = 6;

        // Background bar
        pdf.setFillColor(229, 231, 235);
        pdf.roundedRect(boxX + 5, barY, barWidth, barHeight, 1, 1, 'F');

        // Passed portion (green)
        if (stats.passed > 0) {
          const passedWidth = (stats.passed / stats.total) * barWidth;
          pdf.setFillColor(34, 197, 94);
          pdf.roundedRect(boxX + 5, barY, passedWidth, barHeight, 1, 1, 'F');
        }

        // Failed portion (red) - starts after passed
        if (stats.failed > 0) {
          const passedWidth = (stats.passed / stats.total) * barWidth;
          const failedWidth = (stats.failed / stats.total) * barWidth;
          pdf.setFillColor(239, 68, 68);
          pdf.rect(boxX + 5 + passedWidth, barY, failedWidth, barHeight, 'F');
        }

        // Stats text below bar
        pdf.setFontSize(8);
        pdf.setTextColor(34, 197, 94);
        pdf.text(`\u2713 ${stats.passed}`, boxX + 5, boxY + 44);

        pdf.setTextColor(239, 68, 68);
        pdf.text(`\u2717 ${stats.failed}`, boxX + 30, boxY + 44);

        if (stats.skipped > 0) {
          pdf.setTextColor(156, 163, 175);
          pdf.text(`\u25CB ${stats.skipped}`, boxX + 55, boxY + 44);
        }

        // Pass rate percentage
        const typePassRate = stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0;
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(typePassRate >= 80 ? 34 : typePassRate >= 50 ? 217 : 239,
                         typePassRate >= 80 ? 197 : typePassRate >= 50 ? 119 : 68,
                         typePassRate >= 80 ? 94 : typePassRate >= 50 ? 6 : 68);
        pdf.text(`${typePassRate}%`, boxX + typeBoxWidth - 20, boxY + 14);
      });

      // Move yPos to after the type boxes
      const totalRows = Math.ceil(typeEntries.length / 3);
      yPos += typeBoxHeight + 15 + (totalRows > 1 ? (totalRows - 1) * (typeBoxHeight + 8) : 0);
    }
    } // End pdfSections.typeBreakdown

    // === PIE CHART SECTION ===
    // Feature #1992: Conditionally include with summary
    if (pdfSections.summary) {
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(30, 41, 59);
    pdf.text('Results Distribution', margin, yPos);
    yPos += 5;

    // Draw pie chart
    const chartX = margin + 35;
    const chartY = yPos + 30;
    const chartRadius = 25;

    drawPieChart(chartX, chartY, chartRadius, resultSummary.passed, resultSummary.failed, resultSummary.skipped);

    // Legend
    const legendX = chartX + 50;
    const legendY = chartY - 15;

    // Passed legend
    pdf.setFillColor(34, 197, 94);
    pdf.rect(legendX, legendY, 8, 8, 'F');
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(60, 60, 60);
    pdf.text(`Passed (${resultSummary.passed})`, legendX + 12, legendY + 6);

    // Failed legend
    pdf.setFillColor(239, 68, 68);
    pdf.rect(legendX, legendY + 14, 8, 8, 'F');
    pdf.text(`Failed (${resultSummary.failed})`, legendX + 12, legendY + 20);

    // Skipped legend
    if (resultSummary.skipped > 0) {
      pdf.setFillColor(156, 163, 175);
      pdf.rect(legendX, legendY + 28, 8, 8, 'F');
      pdf.text(`Skipped (${resultSummary.skipped})`, legendX + 12, legendY + 34);
    }

    // Run Info on right side
    const infoX = margin + contentWidth / 2 + 10;
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(30, 41, 59);
    pdf.text('Run Details', infoX, yPos);

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(71, 85, 105);
    const runDetails = [
      `Run ID: ${run.id}`,
      `Status: ${run.status.toUpperCase()}`,
      `Started: ${new Date(run.created_at).toLocaleString()}`,
      `Completed: ${run.completed_at ? new Date(run.completed_at).toLocaleString() : 'In Progress'}`,
      `Branch: ${run.branch || 'main'}`,
    ];
    runDetails.forEach((detail, i) => {
      pdf.text(detail, infoX, yPos + 8 + i * 7);
    });

    yPos = chartY + chartRadius + 20;
    } // End pdfSections.summary (pie chart)

    // === TEST RESULTS TABLE ===
    // Feature #1992: Conditionally include based on pdfSections
    if (pdfSections.testResults) {
    checkNewPage(40);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(30, 41, 59);
    pdf.text('Test Results', margin, yPos);
    yPos += 8;

    // Table header
    pdf.setFillColor(241, 245, 249);
    pdf.rect(margin, yPos, contentWidth, 10, 'F');
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(71, 85, 105);
    pdf.text('#', margin + 3, yPos + 7);
    pdf.text('Test Name', margin + 15, yPos + 7);
    pdf.text('Type', margin + 105, yPos + 7);
    pdf.text('Duration', margin + 130, yPos + 7);
    pdf.text('Status', margin + 155, yPos + 7);
    yPos += 12;

    // Table rows
    run.results.forEach((result, idx) => {
      checkNewPage(15);

      // Alternating row background
      if (idx % 2 === 0) {
        pdf.setFillColor(249, 250, 251);
        pdf.rect(margin, yPos - 4, contentWidth, 12, 'F');
      }

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(60, 60, 60);

      // Row number
      pdf.text(String(idx + 1), margin + 3, yPos + 3);

      // Test name (truncated if needed)
      const testName = result.test_name.length > 45 ? result.test_name.slice(0, 42) + '...' : result.test_name;
      pdf.text(testName, margin + 15, yPos + 3);

      // Test type - use inference helper
      const testTypeForTable = inferTestType(result);
      pdf.setFontSize(7);
      pdf.text(testTypeForTable, margin + 105, yPos + 3);

      // Duration
      pdf.setFontSize(9);
      pdf.text(formatDuration(result.duration_ms), margin + 130, yPos + 3);

      // Status with color
      if (result.status === 'passed') {
        pdf.setTextColor(34, 197, 94);
        pdf.setFont('helvetica', 'bold');
        pdf.text('PASSED', margin + 155, yPos + 3);
      } else if (result.status === 'failed' || result.status === 'error') {
        pdf.setTextColor(239, 68, 68);
        pdf.setFont('helvetica', 'bold');
        pdf.text('FAILED', margin + 155, yPos + 3);
      } else {
        pdf.setTextColor(156, 163, 175);
        pdf.setFont('helvetica', 'normal');
        pdf.text(result.status.toUpperCase(), margin + 155, yPos + 3);
      }

      yPos += 10;

      // Show brief error message for failed tests (full details in Failure Details section)
      if (result.error) {
        checkNewPage(12);
        pdf.setFontSize(8);
        pdf.setTextColor(239, 68, 68);
        pdf.setFont('helvetica', 'italic');
        const errorLines = pdf.splitTextToSize(`Error: ${result.error}`, contentWidth - 20);
        errorLines.slice(0, 2).forEach((line: string) => {
          pdf.text(line, margin + 15, yPos + 1);
          yPos += 5;
        });
      }
    });
    } // End pdfSections.testResults

    // === FAILURE DETAILS SECTION ===
    // Feature #1992: Conditionally include based on pdfSections
    // Only add if there are failed tests
    const failedResults = run.results.filter(r => r.status === 'failed' || r.status === 'error');
    if (pdfSections.failures && failedResults.length > 0) {
      pdf.addPage();
      yPos = 20;

      // Section header
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(239, 68, 68);
      pdf.text('\u26A0\uFE0F Failure Details', margin, yPos);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 116, 139);
      pdf.text(`${failedResults.length} failed test${failedResults.length > 1 ? 's' : ''}`, margin + 70, yPos);
      yPos += 15;

      failedResults.forEach((result, idx) => {
        // Check if we need a new page (reserve at least 80 pixels for content)
        if (yPos > pageHeight - 80) {
          pdf.addPage();
          yPos = 20;
        }

        // Failure card background
        pdf.setFillColor(254, 242, 242); // Light red background
        pdf.setDrawColor(252, 165, 165); // Red border
        pdf.setLineWidth(0.5);

        // Calculate card height based on error content
        const errorText = result.error || 'Unknown error';
        const errorLines = pdf.splitTextToSize(errorText, contentWidth - 20);
        const maxErrorLines = Math.min(errorLines.length, 15); // Cap at 15 lines
        const cardHeight = 45 + (maxErrorLines * 4.5);

        pdf.roundedRect(margin, yPos, contentWidth, cardHeight, 3, 3, 'FD');

        // Test number and name
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(185, 28, 28); // Dark red
        pdf.text(`${idx + 1}. ${result.test_name}`, margin + 5, yPos + 10);

        // Test type badge - use inference helper
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        const failedTestType = inferTestType(result);
        pdf.setFillColor(254, 226, 226);
        const badgeWidth = pdf.getTextWidth(failedTestType) + 8;
        pdf.roundedRect(margin + 5, yPos + 13, badgeWidth, 6, 1, 1, 'F');
        pdf.setTextColor(185, 28, 28);
        pdf.text(failedTestType, margin + 9, yPos + 17);

        // Duration
        pdf.setTextColor(100, 116, 139);
        pdf.text(`Duration: ${formatDuration(result.duration_ms)}`, margin + 5 + badgeWidth + 10, yPos + 17);

        // Error label
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(127, 29, 29);
        pdf.text('Error Message / Stack Trace:', margin + 5, yPos + 27);

        // Error content (full error with potential stack trace)
        pdf.setFontSize(8);
        pdf.setFont('courier', 'normal'); // Monospace for stack traces
        pdf.setTextColor(127, 29, 29);

        let errorY = yPos + 33;
        errorLines.slice(0, maxErrorLines).forEach((line: string) => {
          pdf.text(line, margin + 5, errorY);
          errorY += 4.5;
        });

        // Show truncation notice if error was cut
        if (errorLines.length > maxErrorLines) {
          pdf.setFont('helvetica', 'italic');
          pdf.setTextColor(156, 163, 175);
          pdf.text(`... (${errorLines.length - maxErrorLines} more lines)`, margin + 5, errorY);
        }

        yPos += cardHeight + 10;
      });
    }

    // === SCREENSHOTS SECTION ===
    // Feature #1992: Conditionally include based on pdfSections
    if (pdfSections.screenshots) {
    // Collect all screenshots from test results
    const screenshotsToEmbed: Array<{
      testName: string;
      stepLabel: string;
      dataUrl: string;
      status: string;
    }> = [];

    run.results.forEach((result) => {
      // Final screenshot for each test
      if (result.screenshot_base64) {
        screenshotsToEmbed.push({
          testName: result.test_name,
          stepLabel: 'Final Screenshot',
          dataUrl: result.screenshot_base64.startsWith('data:')
            ? result.screenshot_base64
            : `data:image/png;base64,${result.screenshot_base64}`,
          status: result.status,
        });
      }

      // Step-level screenshots
      result.steps.forEach((step, stepIdx) => {
        if (step.screenshot_after) {
          screenshotsToEmbed.push({
            testName: result.test_name,
            stepLabel: `Step ${stepIdx + 1}: ${step.action}`,
            dataUrl: step.screenshot_after.startsWith('data:')
              ? step.screenshot_after
              : `data:image/png;base64,${step.screenshot_after}`,
            status: result.status,
          });
        }
        if (step.screenshot_before) {
          screenshotsToEmbed.push({
            testName: result.test_name,
            stepLabel: `Step ${stepIdx + 1} (Before): ${step.action}`,
            dataUrl: step.screenshot_before.startsWith('data:')
              ? step.screenshot_before
              : `data:image/png;base64,${step.screenshot_before}`,
            status: result.status,
          });
        }
      });
    });

    // Only add screenshots section if there are screenshots
    if (screenshotsToEmbed.length > 0) {
      pdf.addPage();
      yPos = 20;

      // Section title
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(30, 41, 59);
      pdf.text('\uD83D\uDCF8 Screenshots', margin, yPos);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 116, 139);
      pdf.text(`${screenshotsToEmbed.length} screenshot${screenshotsToEmbed.length > 1 ? 's' : ''} captured`, margin + 60, yPos);
      yPos += 15;

      // Layout: 2 screenshots per row
      const imgWidth = (contentWidth - 10) / 2; // Width for each image
      const imgHeight = 60; // Fixed height for thumbnails
      const labelHeight = 20;
      const itemHeight = imgHeight + labelHeight + 10;

      screenshotsToEmbed.forEach((screenshot, idx) => {
        // Check if we need a new page
        if (yPos + itemHeight > pageHeight - 30) {
          pdf.addPage();
          yPos = 20;
        }

        // Calculate position (2 per row)
        const col = idx % 2;
        const xPos = margin + col * (imgWidth + 10);

        // If starting a new row and not first item
        if (col === 0 && idx > 0) {
          yPos += itemHeight;
        }

        // Draw image container with border
        pdf.setDrawColor(226, 232, 240);
        pdf.setLineWidth(0.5);
        pdf.rect(xPos, yPos, imgWidth, imgHeight + labelHeight, 'S');

        // Try to add the image
        try {
          pdf.addImage(
            screenshot.dataUrl,
            'PNG',
            xPos + 2,
            yPos + 2,
            imgWidth - 4,
            imgHeight - 4,
            undefined,
            'FAST'
          );
        } catch (imgErr) {
          // If image fails to load, show placeholder
          pdf.setFillColor(241, 245, 249);
          pdf.rect(xPos + 2, yPos + 2, imgWidth - 4, imgHeight - 4, 'F');
          pdf.setFontSize(9);
          pdf.setTextColor(156, 163, 175);
          pdf.text('Image unavailable', xPos + imgWidth / 2 - 20, yPos + imgHeight / 2);
        }

        // Label background
        pdf.setFillColor(248, 250, 252);
        pdf.rect(xPos, yPos + imgHeight, imgWidth, labelHeight, 'F');

        // Test name (truncated)
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 41, 59);
        const truncatedTestName = screenshot.testName.length > 35
          ? screenshot.testName.slice(0, 32) + '...'
          : screenshot.testName;
        pdf.text(truncatedTestName, xPos + 3, yPos + imgHeight + 6);

        // Step label
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100, 116, 139);
        const truncatedStep = screenshot.stepLabel.length > 40
          ? screenshot.stepLabel.slice(0, 37) + '...'
          : screenshot.stepLabel;
        pdf.text(truncatedStep, xPos + 3, yPos + imgHeight + 12);

        // Status indicator
        if (screenshot.status === 'passed') {
          pdf.setFillColor(34, 197, 94);
        } else if (screenshot.status === 'failed') {
          pdf.setFillColor(239, 68, 68);
        } else {
          pdf.setFillColor(156, 163, 175);
        }
        pdf.circle(xPos + imgWidth - 8, yPos + imgHeight + 10, 3, 'F');
      });

      // Move to next row if we ended on an odd item
      if (screenshotsToEmbed.length % 2 === 1) {
        yPos += itemHeight;
      } else {
        yPos += itemHeight;
      }
    }
    } // End pdfSections.screenshots

    // === FOOTER ===
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(156, 163, 175);
      pdf.text(
        `Page ${i} of ${pageCount} | Generated by QA Guardian | ${new Date().toLocaleString()}`,
        margin,
        pageHeight - 10
      );

      // QA Guardian branding
      pdf.setTextColor(59, 130, 246);
      pdf.text('QA Guardian', pageWidth - margin - pdf.getTextWidth('QA Guardian'), pageHeight - 10);
    }

    pdf.save(`test-report-${run.id}.pdf`);
  } catch (err) {
    console.error('Failed to generate PDF:', err);
  } finally {
    setGeneratingPdf(false);
  }
};

/**
 * Generate a self-contained HTML test report
 * Feature #1993: Interactive HTML report with collapsible sections
 */
export const generateHtmlReport = ({
  run,
  resultSummary,
  setGeneratingHtml,
}: HtmlReportParams): void => {
  if (!run) return;
  setGeneratingHtml(true);

  try {
    const passRate = resultSummary.total > 0 ? Math.round((resultSummary.passed / resultSummary.total) * 100) : 0;
    const healthColor = passRate >= 80 ? '#22c55e' : passRate >= 50 ? '#f59e0b' : '#ef4444';

    // Generate HTML content
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Report - ${run.id}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #1e293b; line-height: 1.6; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 40px 20px; border-radius: 12px; margin-bottom: 24px; }
    .header h1 { font-size: 28px; margin-bottom: 8px; }
    .header .run-id { opacity: 0.8; font-size: 14px; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .summary-card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; }
    .summary-card .value { font-size: 32px; font-weight: bold; margin-bottom: 4px; }
    .summary-card .label { color: #64748b; font-size: 14px; }
    .health-score { color: ${healthColor}; }
    .section { background: white; border-radius: 12px; padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .section h2 { font-size: 20px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; cursor: pointer; }
    .section h2::before { content: '\\25BC'; font-size: 12px; transition: transform 0.2s; }
    .section.collapsed h2::before { transform: rotate(-90deg); }
    .section.collapsed .section-content { display: none; }
    .test-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
    .test-card.passed { border-left: 4px solid #22c55e; }
    .test-card.failed { border-left: 4px solid #ef4444; }
    .test-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .test-name { font-weight: 600; }
    .test-status { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .test-status.passed { background: #dcfce7; color: #166534; }
    .test-status.failed { background: #fee2e2; color: #991b1b; }
    .test-meta { display: flex; gap: 16px; color: #64748b; font-size: 14px; }
    .steps-list { margin-top: 12px; }
    .step { padding: 8px 12px; border-radius: 4px; margin-bottom: 4px; display: flex; justify-content: space-between; }
    .step.passed { background: #f0fdf4; }
    .step.failed { background: #fef2f2; }
    .step-action { font-family: monospace; font-size: 13px; }
    .screenshot-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
    .screenshot-card { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; cursor: pointer; }
    .screenshot-card img { width: 100%; height: 200px; object-fit: cover; }
    .screenshot-card .caption { padding: 12px; font-size: 14px; background: #f8fafc; }
    .modal { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.9); z-index: 1000; justify-content: center; align-items: center; }
    .modal.active { display: flex; }
    .modal img { max-width: 90%; max-height: 90%; object-fit: contain; }
    .modal-close { position: absolute; top: 20px; right: 20px; color: white; font-size: 32px; cursor: pointer; }
    .error-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-top: 12px; }
    .error-box pre { font-family: monospace; font-size: 12px; white-space: pre-wrap; word-break: break-all; color: #991b1b; }
    .footer { text-align: center; padding: 24px; color: #64748b; font-size: 14px; }
    @media (max-width: 768px) {
      .summary-grid { grid-template-columns: repeat(2, 1fr); }
      .test-header { flex-direction: column; align-items: flex-start; gap: 8px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Test Run Report</h1>
      <div class="run-id">Run #${run.id.slice(-8)} | ${new Date(run.created_at).toLocaleString()}</div>
    </div>

    <div class="summary-grid">
      <div class="summary-card">
        <div class="value health-score">${passRate}%</div>
        <div class="label">Pass Rate</div>
      </div>
      <div class="summary-card">
        <div class="value">${resultSummary.total}</div>
        <div class="label">Total Tests</div>
      </div>
      <div class="summary-card">
        <div class="value" style="color: #22c55e">${resultSummary.passed}</div>
        <div class="label">Passed</div>
      </div>
      <div class="summary-card">
        <div class="value" style="color: #ef4444">${resultSummary.failed}</div>
        <div class="label">Failed</div>
      </div>
      <div class="summary-card">
        <div class="value">${formatDuration(run.duration_ms)}</div>
        <div class="label">Duration</div>
      </div>
    </div>

    <div class="section" id="results-section">
      <h2 onclick="toggleSection('results-section')">Test Results</h2>
      <div class="section-content">
        ${run.results.map((result, idx) => `
          <div class="test-card ${result.status}">
            <div class="test-header">
              <span class="test-name">${idx + 1}. ${escapeHtml(result.test_name)}</span>
              <span class="test-status ${result.status}">${result.status.toUpperCase()}</span>
            </div>
            <div class="test-meta">
              <span>Duration: ${formatDuration(result.duration_ms)}</span>
              <span>Steps: ${result.steps.length}</span>
            </div>
            ${result.error ? `<div class="error-box"><pre>${escapeHtml(result.error)}</pre></div>` : ''}
            <div class="steps-list">
              ${result.steps.map(step => `
                <div class="step ${step.status}">
                  <span class="step-action">${escapeHtml(step.action)}${step.selector ? ` -> ${escapeHtml(step.selector)}` : ''}</span>
                  <span>${formatDuration(step.duration_ms)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    ${run.results.some(r => r.screenshot_base64) ? `
    <div class="section" id="screenshots-section">
      <h2 onclick="toggleSection('screenshots-section')">Screenshots</h2>
      <div class="section-content">
        <div class="screenshot-grid">
          ${run.results.filter(r => r.screenshot_base64).map(result => `
            <div class="screenshot-card" onclick="openModal('${result.screenshot_base64?.startsWith('data:') ? result.screenshot_base64 : `data:image/png;base64,${result.screenshot_base64}`}')">
              <img src="${result.screenshot_base64?.startsWith('data:') ? result.screenshot_base64 : `data:image/png;base64,${result.screenshot_base64}`}" alt="${escapeHtml(result.test_name)}">
              <div class="caption">${escapeHtml(result.test_name)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
    ` : ''}

    <div class="footer">
      Generated by QA Guardian | ${new Date().toLocaleString()}
    </div>
  </div>

  <div class="modal" id="imageModal" onclick="closeModal()">
    <span class="modal-close">&times;</span>
    <img id="modalImage" src="" alt="Screenshot">
  </div>

  <script>
    function toggleSection(id) {
      const section = document.getElementById(id);
      section.classList.toggle('collapsed');
    }
    function openModal(src) {
      const modal = document.getElementById('imageModal');
      const img = document.getElementById('modalImage');
      img.src = src;
      modal.classList.add('active');
    }
    function closeModal() {
      document.getElementById('imageModal').classList.remove('active');
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  </script>
</body>
</html>`;

    // Download the HTML file
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-report-${run.id}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Failed to generate HTML report:', err);
  } finally {
    setGeneratingHtml(false);
  }
};
