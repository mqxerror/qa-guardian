/**
 * Feature #48: Export utilities for accessibility reports
 * Extracted from TestDetailPage.tsx
 * Feature #105: jsPDF is now lazy-loaded for better bundle performance
 */

import { toast } from '../../stores/toastStore';

/**
 * Export accessibility report as PDF
 * Feature #105: Lazy loads jsPDF (387KB) only when export is triggered
 */
export async function exportAccessibilityPDF(a11yData: any, testName: string, runDate: string) {
  // Lazy load jsPDF only when needed
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  let y = margin;

  // Helper function to add a new page if needed
  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Accessibility Audit Report', margin, y);
  y += 12;

  // Subtitle with test name
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(testName, margin, y);
  y += 8;

  // Date and URL
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${runDate}`, margin, y);
  y += 5;
  if (a11yData.url) {
    doc.text(`URL: ${a11yData.url}`, margin, y);
    y += 5;
  }
  if (a11yData.wcag_level) {
    doc.text(`WCAG Level: ${a11yData.wcag_level}`, margin, y);
    y += 5;
  }
  y += 10;

  // Score section
  doc.setTextColor(0);
  if (a11yData.score !== undefined) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Accessibility Score', margin, y);
    y += 8;

    doc.setFontSize(24);
    const scoreColor = a11yData.score >= 90 ? [34, 197, 94] : a11yData.score >= 50 ? [234, 179, 8] : [239, 68, 68];
    doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
    doc.text(`${a11yData.score}/100`, margin, y);
    y += 15;
    doc.setTextColor(0);
  }

  // Summary section
  checkPageBreak(40);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary', margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const summaryItems = [
    { label: 'Violations', value: a11yData.violations?.count || 0, color: a11yData.violations?.count > 0 ? [239, 68, 68] : [34, 197, 94] },
    { label: 'Passes', value: a11yData.passes?.count || 0, color: [34, 197, 94] },
    { label: 'Incomplete', value: a11yData.incomplete?.count || 0, color: [234, 179, 8] },
    { label: 'Not Applicable', value: a11yData.inapplicable?.count || 0, color: [156, 163, 175] }
  ];

  summaryItems.forEach((item, index) => {
    const xPos = margin + (index * 40);
    doc.setTextColor(item.color[0], item.color[1], item.color[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(String(item.value), xPos, y);
    doc.setTextColor(100);
    doc.setFont('helvetica', 'normal');
    doc.text(item.label, xPos, y + 5);
  });
  y += 20;
  doc.setTextColor(0);

  // Violations breakdown by severity
  if (a11yData.violations?.count > 0) {
    checkPageBreak(30);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Violations by Severity', margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const severities = [
      { label: 'Critical', value: a11yData.violations.critical || 0, color: [239, 68, 68] },
      { label: 'Serious', value: a11yData.violations.serious || 0, color: [249, 115, 22] },
      { label: 'Moderate', value: a11yData.violations.moderate || 0, color: [234, 179, 8] },
      { label: 'Minor', value: a11yData.violations.minor || 0, color: [59, 130, 246] }
    ];

    severities.forEach((sev) => {
      if (sev.value > 0) {
        doc.setTextColor(sev.color[0], sev.color[1], sev.color[2]);
        doc.text(`• ${sev.label}: ${sev.value}`, margin, y);
        y += 5;
      }
    });
    y += 10;
    doc.setTextColor(0);
  }

  // Detailed violations
  if (a11yData.violations?.items?.length > 0) {
    checkPageBreak(20);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Violation Details', margin, y);
    y += 10;

    a11yData.violations.items.forEach((violation: any) => {
      checkPageBreak(50);

      // Violation header with impact badge
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      const impactColors: Record<string, number[]> = {
        critical: [239, 68, 68],
        serious: [249, 115, 22],
        moderate: [234, 179, 8],
        minor: [59, 130, 246]
      };
      const impactColor = impactColors[violation.impact] || [100, 100, 100];

      doc.setTextColor(impactColor[0], impactColor[1], impactColor[2]);
      doc.text(`[${(violation.impact || 'unknown').toUpperCase()}]`, margin, y);
      doc.setTextColor(0);
      doc.text(` ${violation.id}`, margin + 25, y);
      y += 6;

      // Description
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      if (violation.description) {
        const descLines = doc.splitTextToSize(violation.description, contentWidth);
        descLines.forEach((line: string) => {
          checkPageBreak(6);
          doc.text(line, margin, y);
          y += 4;
        });
      }

      // Help text
      if (violation.help) {
        doc.setTextColor(100);
        const helpLines = doc.splitTextToSize(`How to fix: ${violation.help}`, contentWidth);
        helpLines.forEach((line: string) => {
          checkPageBreak(6);
          doc.text(line, margin, y);
          y += 4;
        });
        doc.setTextColor(0);
      }

      // WCAG tags
      if (violation.wcagTags?.length > 0) {
        doc.setTextColor(59, 130, 246);
        doc.text(`WCAG: ${violation.wcagTags.join(', ')}`, margin, y);
        y += 4;
        doc.setTextColor(0);
      }

      // Affected elements
      if (violation.nodes?.length > 0) {
        doc.setTextColor(100);
        doc.text(`Affected elements: ${violation.nodes.length}`, margin, y);
        y += 4;
        if (violation.nodes[0]?.target) {
          const targetText = violation.nodes[0].target.join(', ');
          const targetLines = doc.splitTextToSize(`Selector: ${targetText}`, contentWidth);
          targetLines.slice(0, 2).forEach((line: string) => {
            checkPageBreak(6);
            doc.setFontSize(8);
            doc.text(line, margin, y);
            y += 4;
          });
        }
        doc.setTextColor(0);
      }

      // Help URL
      if (violation.helpUrl) {
        doc.setFontSize(8);
        doc.setTextColor(59, 130, 246);
        doc.text(`Learn more: ${violation.helpUrl}`, margin, y);
        y += 4;
        doc.setTextColor(0);
      }

      y += 8; // Space between violations
    });
  }

  // Passing checks summary
  if (a11yData.passes?.categories?.length > 0) {
    checkPageBreak(30);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('Passing Checks', margin, y);
    y += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(34, 197, 94);
    const passCategories = a11yData.passes.categories.join(', ');
    const passLines = doc.splitTextToSize(passCategories, contentWidth);
    passLines.forEach((line: string) => {
      checkPageBreak(6);
      doc.text(line, margin, y);
      y += 4;
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Page ${i} of ${pageCount} - Generated by QA Guardian`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  // Save the PDF
  const fileName = `accessibility-report-${testName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
  toast.success('Accessibility report PDF downloaded');
}

/**
 * Export accessibility report as CSV
 */
export function exportAccessibilityCSV(a11yData: any, testName: string, runDate: string) {
  const rows: string[][] = [];

  // Helper to escape CSV values
  const escapeCSV = (value: string | number | undefined | null): string => {
    if (value === undefined || value === null) return '';
    const str = String(value);
    // Escape double quotes and wrap in quotes if contains comma, newline, or quotes
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Header row
  rows.push([
    'Severity',
    'Violation ID',
    'Description',
    'How to Fix',
    'WCAG Tags',
    'Affected Elements Count',
    'First Element Selector',
    'Help URL'
  ]);

  // Add violation rows
  if (a11yData.violations?.items?.length > 0) {
    a11yData.violations.items.forEach((violation: any) => {
      const firstSelector = violation.nodes?.[0]?.target?.join(' > ') || '';
      rows.push([
        escapeCSV(violation.impact || 'unknown'),
        escapeCSV(violation.id),
        escapeCSV(violation.description),
        escapeCSV(violation.help),
        escapeCSV(violation.wcagTags?.join(', ')),
        escapeCSV(violation.nodes?.length || 0),
        escapeCSV(firstSelector),
        escapeCSV(violation.helpUrl)
      ]);
    });
  }

  // Add summary information at the end as metadata rows
  rows.push([]); // Empty row
  rows.push(['--- Summary ---']);
  rows.push(['Test Name', escapeCSV(testName)]);
  rows.push(['Run Date', escapeCSV(runDate)]);
  rows.push(['URL', escapeCSV(a11yData.url)]);
  rows.push(['WCAG Level', escapeCSV(a11yData.wcag_level)]);
  rows.push(['Score', escapeCSV(a11yData.score)]);
  rows.push(['Total Violations', escapeCSV(a11yData.violations?.count || 0)]);
  rows.push(['Critical Violations', escapeCSV(a11yData.violations?.critical || 0)]);
  rows.push(['Serious Violations', escapeCSV(a11yData.violations?.serious || 0)]);
  rows.push(['Moderate Violations', escapeCSV(a11yData.violations?.moderate || 0)]);
  rows.push(['Minor Violations', escapeCSV(a11yData.violations?.minor || 0)]);
  rows.push(['Passing Checks', escapeCSV(a11yData.passes?.count || 0)]);
  rows.push(['Incomplete Checks', escapeCSV(a11yData.incomplete?.count || 0)]);
  rows.push(['Not Applicable', escapeCSV(a11yData.inapplicable?.count || 0)]);

  // Convert to CSV string
  const csvContent = rows.map(row => row.join(',')).join('\n');

  // Create and download the file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const fileName = `accessibility-report-${testName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`;
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast.success('Accessibility report CSV downloaded');
}
