#!/usr/bin/env node

/**
 * QA Guardian - Documentation Generator
 *
 * Generates documentation from the features database.
 * Combines feature descriptions, steps, and custom docs into
 * organized Markdown files.
 *
 * Usage:
 *   node scripts/generate-docs.js [--all|--category=<name>|--completed|--pending]
 */

const sqlite3 = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'features.db');
const DOCS_PATH = path.join(__dirname, '..', 'docs');

// Category groupings for documentation structure
const CATEGORY_GROUPS = {
  'Getting Started': [
    'Authentication Flow',
    'Organization Management',
    'Project Management'
  ],
  'Test Management': [
    'Test Authoring',
    'Test Execution',
    'Test Results',
    'Artifacts Management'
  ],
  'Visual Regression Testing': [
    'functional' // Will filter by name containing 'visual', 'baseline', 'screenshot', 'diff'
  ],
  'Performance Testing': [
    'functional' // Will filter by name containing 'lighthouse', 'performance', 'web vitals'
  ],
  'Load Testing': [
    'functional' // Will filter by name containing 'k6', 'load test', 'virtual user'
  ],
  'Accessibility Testing': [
    'functional' // Will filter by name containing 'accessibility', 'axe', 'wcag', 'a11y'
  ],
  'MCP Integration': [
    'functional' // Will filter by name containing 'mcp', 'tool', 'resource'
  ],
  'Security & Access': [
    'Security & Access Control',
    'security'
  ],
  'User Interface': [
    'Navigation Integrity',
    'UI Components',
    'Responsive & Layout',
    'style'
  ],
  'Integrations': [
    'GitHub Integration',
    'Alerting',
    'API'
  ],
  'Error Handling': [
    'Error Handling',
    'error-handling'
  ],
  'Data & Workflows': [
    'Workflow Completeness',
    'Form Validation',
    'Data Cleanup & Cascade',
    'State & Persistence',
    'Real Data Verification'
  ],
  'Advanced Features': [
    'Scheduling',
    'Export/Import',
    'Dashboard & Analytics',
    'Audit Logging',
    'Real-time Features'
  ]
};

// Keywords for filtering functional category
const CATEGORY_KEYWORDS = {
  'Visual Regression Testing': ['visual', 'baseline', 'screenshot', 'diff', 'pixelmatch', 'comparison'],
  'Performance Testing': ['lighthouse', 'performance', 'web vital', 'lcp', 'fid', 'cls', 'core web'],
  'Load Testing': ['k6', 'load test', 'virtual user', 'vus', 'ramp', 'stress', 'spike', 'soak'],
  'Accessibility Testing': ['accessibility', 'axe', 'wcag', 'a11y', 'violation', 'aria'],
  'MCP Integration': ['mcp', 'tool:', 'resource:', 'qaguardian://']
};

class DocsGenerator {
  constructor() {
    this.db = new sqlite3(DB_PATH, { readonly: true });
  }

  // Get all features
  getAllFeatures() {
    return this.db.prepare(`
      SELECT id, category, name, description, steps, passes, user_docs, api_docs, dev_notes
      FROM features
      ORDER BY category, priority, id
    `).all();
  }

  // Get features by status
  getFeaturesByStatus(completed = true) {
    const condition = completed ? 'passes = 1' : '(passes IS NULL OR passes = 0)';
    return this.db.prepare(`
      SELECT id, category, name, description, steps, passes, user_docs, api_docs, dev_notes
      FROM features
      WHERE ${condition}
      ORDER BY category, priority, id
    `).all();
  }

  // Get distinct categories
  getCategories() {
    return this.db.prepare(`
      SELECT DISTINCT category, COUNT(*) as count
      FROM features
      GROUP BY category
      ORDER BY count DESC
    `).all();
  }

  // Check if feature matches keywords for a group
  matchesKeywords(feature, groupName) {
    const keywords = CATEGORY_KEYWORDS[groupName];
    if (!keywords) return false;

    const searchText = `${feature.name} ${feature.description}`.toLowerCase();
    return keywords.some(keyword => searchText.includes(keyword.toLowerCase()));
  }

  // Group features by documentation category
  groupFeatures(features) {
    const grouped = {};
    const assigned = new Set();

    // First pass: assign by exact category match or keywords
    for (const [groupName, categories] of Object.entries(CATEGORY_GROUPS)) {
      grouped[groupName] = [];

      for (const feature of features) {
        if (assigned.has(feature.id)) continue;

        // Check exact category match
        if (categories.includes(feature.category)) {
          // For 'functional' category, also check keywords
          if (feature.category === 'functional') {
            if (this.matchesKeywords(feature, groupName)) {
              grouped[groupName].push(feature);
              assigned.add(feature.id);
            }
          } else {
            grouped[groupName].push(feature);
            assigned.add(feature.id);
          }
        }
      }
    }

    // Second pass: assign remaining functional features to "Other Features"
    grouped['Other Features'] = features.filter(f => !assigned.has(f.id));

    // Remove empty groups
    for (const [key, value] of Object.entries(grouped)) {
      if (value.length === 0) delete grouped[key];
    }

    return grouped;
  }

  // Generate markdown for a single feature
  featureToMarkdown(feature, includeSteps = true) {
    let md = '';

    // Feature header
    const status = feature.passes ? '✅' : '📋';
    md += `### ${status} ${feature.name}\n\n`;

    // Description
    md += `${feature.description}\n\n`;

    // User docs (if available)
    if (feature.user_docs) {
      md += `**How to use:**\n${feature.user_docs}\n\n`;
    }

    // Steps (test steps as expected behavior)
    if (includeSteps && feature.steps) {
      const steps = typeof feature.steps === 'string'
        ? JSON.parse(feature.steps)
        : feature.steps;

      if (steps && steps.length > 0) {
        md += `**Expected Behavior:**\n`;
        steps.forEach((step, i) => {
          md += `${i + 1}. ${step}\n`;
        });
        md += '\n';
      }
    }

    // API docs (if available)
    if (feature.api_docs) {
      md += `**API Reference:**\n\`\`\`\n${feature.api_docs}\n\`\`\`\n\n`;
    }

    // Developer notes (if available)
    if (feature.dev_notes) {
      md += `> **Developer Note:** ${feature.dev_notes}\n\n`;
    }

    md += '---\n\n';
    return md;
  }

  // Generate full documentation
  generateDocs(options = {}) {
    const { completedOnly = false, pendingOnly = false } = options;

    let features;
    if (completedOnly) {
      features = this.getFeaturesByStatus(true);
    } else if (pendingOnly) {
      features = this.getFeaturesByStatus(false);
    } else {
      features = this.getAllFeatures();
    }

    const grouped = this.groupFeatures(features);
    const timestamp = new Date().toISOString().split('T')[0];

    // Generate index
    let indexMd = `# QA Guardian Documentation\n\n`;
    indexMd += `> Auto-generated from feature database on ${timestamp}\n\n`;
    indexMd += `## Overview\n\n`;
    indexMd += `| Status | Count |\n|--------|-------|\n`;
    indexMd += `| ✅ Completed | ${features.filter(f => f.passes).length} |\n`;
    indexMd += `| 📋 Pending | ${features.filter(f => !f.passes).length} |\n`;
    indexMd += `| **Total** | ${features.length} |\n\n`;
    indexMd += `## Feature Categories\n\n`;

    for (const [groupName, groupFeatures] of Object.entries(grouped)) {
      const filename = groupName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const completed = groupFeatures.filter(f => f.passes).length;
      const total = groupFeatures.length;
      indexMd += `- [${groupName}](./generated/${filename}.md) (${completed}/${total} completed)\n`;
    }

    // Write index
    fs.writeFileSync(path.join(DOCS_PATH, 'README.md'), indexMd);
    console.log('Generated: docs/README.md');

    // Generate category files
    for (const [groupName, groupFeatures] of Object.entries(grouped)) {
      const filename = groupName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      let categoryMd = `# ${groupName}\n\n`;
      categoryMd += `> ${groupFeatures.length} features | `;
      categoryMd += `${groupFeatures.filter(f => f.passes).length} completed | `;
      categoryMd += `${groupFeatures.filter(f => !f.passes).length} pending\n\n`;
      categoryMd += `[← Back to Index](../README.md)\n\n`;
      categoryMd += `---\n\n`;

      // Group by status
      const completedFeatures = groupFeatures.filter(f => f.passes);
      const pendingFeatures = groupFeatures.filter(f => !f.passes);

      if (completedFeatures.length > 0) {
        categoryMd += `## ✅ Completed Features\n\n`;
        for (const feature of completedFeatures) {
          categoryMd += this.featureToMarkdown(feature);
        }
      }

      if (pendingFeatures.length > 0) {
        categoryMd += `## 📋 Pending Features\n\n`;
        for (const feature of pendingFeatures) {
          categoryMd += this.featureToMarkdown(feature);
        }
      }

      fs.writeFileSync(path.join(DOCS_PATH, 'generated', `${filename}.md`), categoryMd);
      console.log(`Generated: docs/generated/${filename}.md`);
    }

    // Generate summary stats
    this.generateStats(features);

    console.log(`\nDocumentation generated successfully!`);
    console.log(`Total features documented: ${features.length}`);
  }

  // Generate statistics file
  generateStats(features) {
    const categories = {};
    for (const f of features) {
      if (!categories[f.category]) {
        categories[f.category] = { total: 0, completed: 0 };
      }
      categories[f.category].total++;
      if (f.passes) categories[f.category].completed++;
    }

    let statsMd = `# Feature Statistics\n\n`;
    statsMd += `> Generated on ${new Date().toISOString().split('T')[0]}\n\n`;
    statsMd += `## By Category\n\n`;
    statsMd += `| Category | Completed | Total | Progress |\n`;
    statsMd += `|----------|-----------|-------|----------|\n`;

    const sortedCategories = Object.entries(categories)
      .sort((a, b) => b[1].total - a[1].total);

    for (const [cat, stats] of sortedCategories) {
      const pct = Math.round((stats.completed / stats.total) * 100);
      const bar = '█'.repeat(Math.floor(pct / 10)) + '░'.repeat(10 - Math.floor(pct / 10));
      statsMd += `| ${cat} | ${stats.completed} | ${stats.total} | ${bar} ${pct}% |\n`;
    }

    fs.writeFileSync(path.join(DOCS_PATH, 'STATS.md'), statsMd);
    console.log('Generated: docs/STATS.md');
  }

  close() {
    this.db.close();
  }
}

// CLI handling
const args = process.argv.slice(2);
const generator = new DocsGenerator();

try {
  if (args.includes('--completed')) {
    generator.generateDocs({ completedOnly: true });
  } else if (args.includes('--pending')) {
    generator.generateDocs({ pendingOnly: true });
  } else {
    generator.generateDocs();
  }
} finally {
  generator.close();
}
