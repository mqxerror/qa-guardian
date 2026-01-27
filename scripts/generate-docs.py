#!/usr/bin/env python3
"""
QA Guardian - Documentation Generator

Generates documentation from the features database.
Combines feature descriptions, steps, and custom docs into
organized Markdown files.

Usage:
    python scripts/generate-docs.py [--all|--completed|--pending]
"""

import sqlite3
import json
import os
from datetime import datetime
from pathlib import Path
import sys

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
DB_PATH = PROJECT_DIR / 'features.db'
DOCS_PATH = PROJECT_DIR / 'docs'

# Category groupings for documentation structure
CATEGORY_GROUPS = {
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
    'Visual Regression Testing': ['functional'],
    'Performance Testing': ['functional'],
    'Load Testing': ['functional'],
    'Accessibility Testing': ['functional'],
    'MCP Integration': ['functional'],
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
}

# Keywords for filtering functional category
CATEGORY_KEYWORDS = {
    'Visual Regression Testing': ['visual', 'baseline', 'screenshot', 'diff', 'pixelmatch', 'comparison', 'overlay', 'slider'],
    'Performance Testing': ['lighthouse', 'performance', 'web vital', 'lcp', 'fid', 'cls', 'core web', 'speed', 'seo audit'],
    'Load Testing': ['k6', 'load test', 'virtual user', 'vus', 'ramp', 'stress', 'spike', 'soak', 'rps', 'latency'],
    'Accessibility Testing': ['accessibility', 'axe', 'wcag', 'a11y', 'violation', 'aria', 'screen reader'],
    'MCP Integration': ['mcp', 'tool:', 'resource:', 'qaguardian://', 'trigger-test', 'get-run-status']
}


class DocsGenerator:
    def __init__(self, db_path):
        self.db_path = db_path
        self.conn = None

    def connect(self):
        self.conn = sqlite3.connect(self.db_path)
        self.conn.row_factory = sqlite3.Row

    def close(self):
        if self.conn:
            self.conn.close()

    def get_all_features(self):
        cursor = self.conn.execute('''
            SELECT id, category, name, description, steps, passes, user_docs, api_docs, dev_notes, screenshot_path
            FROM features
            ORDER BY category, priority, id
        ''')
        return [dict(row) for row in cursor.fetchall()]

    def get_features_by_status(self, completed=True):
        condition = 'passes = 1' if completed else '(passes IS NULL OR passes = 0)'
        cursor = self.conn.execute(f'''
            SELECT id, category, name, description, steps, passes, user_docs, api_docs, dev_notes, screenshot_path
            FROM features
            WHERE {condition}
            ORDER BY category, priority, id
        ''')
        return [dict(row) for row in cursor.fetchall()]

    def matches_keywords(self, feature, group_name):
        keywords = CATEGORY_KEYWORDS.get(group_name, [])
        if not keywords:
            return False

        search_text = f"{feature['name']} {feature['description']}".lower()
        return any(kw.lower() in search_text for kw in keywords)

    def group_features(self, features):
        grouped = {}
        assigned = set()

        # First pass: assign by exact category match or keywords
        for group_name, categories in CATEGORY_GROUPS.items():
            grouped[group_name] = []

            for feature in features:
                if feature['id'] in assigned:
                    continue

                if feature['category'] in categories:
                    if feature['category'] == 'functional':
                        if self.matches_keywords(feature, group_name):
                            grouped[group_name].append(feature)
                            assigned.add(feature['id'])
                    else:
                        grouped[group_name].append(feature)
                        assigned.add(feature['id'])

        # Second pass: remaining features
        grouped['Other Features'] = [f for f in features if f['id'] not in assigned]

        # Remove empty groups
        return {k: v for k, v in grouped.items() if v}

    def feature_to_markdown(self, feature, include_steps=True):
        md = ''

        # Feature header
        status = '✅' if feature['passes'] else '📋'
        md += f"### {status} {feature['name']}\n\n"

        # Description
        md += f"{feature['description']}\n\n"

        # Screenshot (if available)
        if feature.get('screenshot_path'):
            md += f"![{feature['name']}]({feature['screenshot_path']})\n\n"

        # User docs
        if feature.get('user_docs'):
            md += f"**How to use:**\n{feature['user_docs']}\n\n"

        # Steps
        if include_steps and feature.get('steps'):
            try:
                steps = json.loads(feature['steps']) if isinstance(feature['steps'], str) else feature['steps']
                if steps:
                    md += "**Expected Behavior:**\n"
                    for i, step in enumerate(steps, 1):
                        md += f"{i}. {step}\n"
                    md += '\n'
            except json.JSONDecodeError:
                pass

        # API docs
        if feature.get('api_docs'):
            md += f"**API Reference:**\n```\n{feature['api_docs']}\n```\n\n"

        # Dev notes
        if feature.get('dev_notes'):
            md += f"> **Developer Note:** {feature['dev_notes']}\n\n"

        md += '---\n\n'
        return md

    def generate_docs(self, completed_only=False, pending_only=False):
        if completed_only:
            features = self.get_features_by_status(True)
        elif pending_only:
            features = self.get_features_by_status(False)
        else:
            features = self.get_all_features()

        grouped = self.group_features(features)
        timestamp = datetime.now().strftime('%Y-%m-%d')

        # Ensure directories exist
        (DOCS_PATH / 'generated').mkdir(parents=True, exist_ok=True)

        # Generate index
        completed_count = len([f for f in features if f['passes']])
        pending_count = len([f for f in features if not f['passes']])

        index_md = f"""# QA Guardian Documentation

> Auto-generated from feature database on {timestamp}

## Overview

| Status | Count |
|--------|-------|
| ✅ Completed | {completed_count} |
| 📋 Pending | {pending_count} |
| **Total** | {len(features)} |

## Quick Links

- [Feature Statistics](./STATS.md)
- [User Guide](./user-guide/)
- [API Reference](./api/)
- [Developer Guide](./developer/)

## Feature Categories

"""

        for group_name, group_features in grouped.items():
            filename = group_name.lower().replace(' ', '-').replace('&', 'and')
            filename = ''.join(c if c.isalnum() or c == '-' else '' for c in filename)
            completed = len([f for f in group_features if f['passes']])
            total = len(group_features)
            index_md += f"- [{group_name}](./generated/{filename}.md) ({completed}/{total} completed)\n"

        # Write index
        with open(DOCS_PATH / 'README.md', 'w') as f:
            f.write(index_md)
        print('Generated: docs/README.md')

        # Generate category files
        for group_name, group_features in grouped.items():
            filename = group_name.lower().replace(' ', '-').replace('&', 'and')
            filename = ''.join(c if c.isalnum() or c == '-' else '' for c in filename)

            completed_features = [f for f in group_features if f['passes']]
            pending_features = [f for f in group_features if not f['passes']]

            category_md = f"""# {group_name}

> {len(group_features)} features | {len(completed_features)} completed | {len(pending_features)} pending

[← Back to Index](../README.md)

---

"""

            if completed_features:
                category_md += "## ✅ Completed Features\n\n"
                for feature in completed_features:
                    category_md += self.feature_to_markdown(feature)

            if pending_features:
                category_md += "## 📋 Pending Features\n\n"
                for feature in pending_features:
                    category_md += self.feature_to_markdown(feature)

            with open(DOCS_PATH / 'generated' / f'{filename}.md', 'w') as f:
                f.write(category_md)
            print(f'Generated: docs/generated/{filename}.md')

        # Generate stats
        self.generate_stats(features)

        print(f'\n✅ Documentation generated successfully!')
        print(f'   Total features documented: {len(features)}')
        print(f'   Completed: {completed_count}')
        print(f'   Pending: {pending_count}')

    def generate_stats(self, features):
        categories = {}
        for f in features:
            cat = f['category']
            if cat not in categories:
                categories[cat] = {'total': 0, 'completed': 0}
            categories[cat]['total'] += 1
            if f['passes']:
                categories[cat]['completed'] += 1

        stats_md = f"""# Feature Statistics

> Generated on {datetime.now().strftime('%Y-%m-%d')}

## Summary

- **Total Features:** {len(features)}
- **Completed:** {len([f for f in features if f['passes']])}
- **Pending:** {len([f for f in features if not f['passes']])}

## By Category

| Category | Completed | Total | Progress |
|----------|-----------|-------|----------|
"""

        sorted_cats = sorted(categories.items(), key=lambda x: x[1]['total'], reverse=True)

        for cat, stats in sorted_cats:
            pct = round((stats['completed'] / stats['total']) * 100) if stats['total'] > 0 else 0
            bar = '█' * (pct // 10) + '░' * (10 - pct // 10)
            stats_md += f"| {cat} | {stats['completed']} | {stats['total']} | {bar} {pct}% |\n"

        with open(DOCS_PATH / 'STATS.md', 'w') as f:
            f.write(stats_md)
        print('Generated: docs/STATS.md')


def main():
    generator = DocsGenerator(DB_PATH)

    try:
        generator.connect()

        if '--completed' in sys.argv:
            generator.generate_docs(completed_only=True)
        elif '--pending' in sys.argv:
            generator.generate_docs(pending_only=True)
        else:
            generator.generate_docs()

    finally:
        generator.close()


if __name__ == '__main__':
    main()
