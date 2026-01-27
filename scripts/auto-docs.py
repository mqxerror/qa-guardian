#!/usr/bin/env python3
"""
QA Guardian - Auto Documentation Generator

This script watches for features marked as complete and:
1. Generates user_docs if missing (using feature name/description)
2. Regenerates the documentation files
3. Reports documentation health

Can be run:
- Manually: python scripts/auto-docs.py
- As a cron job
- As a git hook (post-commit)
- By the MCP server when features are marked complete

Usage:
    python scripts/auto-docs.py              # Generate docs for new features
    python scripts/auto-docs.py --watch      # Watch mode (runs every 60s)
    python scripts/auto-docs.py --generate   # Force regenerate all docs
"""

import sqlite3
import sys
import time
import subprocess
from pathlib import Path
from datetime import datetime

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
DB_PATH = PROJECT_DIR / 'features.db'
GENERATE_DOCS_SCRIPT = SCRIPT_DIR / 'generate-docs.py'


def get_connection():
    """Get database connection."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def get_undocumented_features(conn):
    """Get completed features without user_docs."""
    cursor = conn.execute('''
        SELECT id, name, description, category
        FROM features
        WHERE passes = 1 AND (user_docs IS NULL OR user_docs = '')
        ORDER BY id
    ''')
    return cursor.fetchall()


def generate_user_docs(name, description, category):
    """Generate user documentation from feature name and description."""
    # Create user-friendly documentation from the feature info
    # This is a simple template - can be enhanced with AI later

    # Clean up the name to be more user-friendly
    doc = description if description else name

    # Make it more user-friendly based on category
    category_prefixes = {
        'functional': '',
        'error-handling': 'When an error occurs: ',
        'security': 'For security: ',
        'style': 'Visual: ',
    }

    prefix = category_prefixes.get(category.lower(), '')

    # Ensure it starts with a capital letter and ends with period
    doc = prefix + doc
    doc = doc[0].upper() + doc[1:] if doc else doc
    if doc and not doc.endswith('.'):
        doc += '.'

    return doc


def auto_document_features(conn):
    """Auto-generate documentation for undocumented features."""
    undocumented = get_undocumented_features(conn)

    if not undocumented:
        return 0

    count = 0
    for feature in undocumented:
        user_docs = generate_user_docs(
            feature['name'],
            feature['description'],
            feature['category']
        )

        conn.execute('''
            UPDATE features
            SET user_docs = ?
            WHERE id = ?
        ''', (user_docs, feature['id']))
        count += 1

    conn.commit()
    return count


def regenerate_docs():
    """Run the documentation generator."""
    try:
        result = subprocess.run(
            ['python3', str(GENERATE_DOCS_SCRIPT)],
            capture_output=True,
            text=True,
            cwd=PROJECT_DIR
        )
        return result.returncode == 0
    except Exception as e:
        print(f"Error running generate-docs.py: {e}")
        return False


def get_health_status(conn):
    """Get documentation health status."""
    total = conn.execute('SELECT COUNT(*) FROM features').fetchone()[0]
    completed = conn.execute('SELECT COUNT(*) FROM features WHERE passes = 1').fetchone()[0]
    documented = conn.execute('''
        SELECT COUNT(*) FROM features
        WHERE passes = 1 AND user_docs IS NOT NULL AND user_docs != ''
    ''').fetchone()[0]

    return {
        'total': total,
        'completed': completed,
        'documented': documented,
        'coverage': round((documented / completed * 100) if completed > 0 else 0)
    }


def print_status(health, auto_documented=0):
    """Print status summary."""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"\n{'='*50}")
    print(f"📚 AUTO-DOCS STATUS - {timestamp}")
    print(f"{'='*50}")
    print(f"Features Completed: {health['completed']}/{health['total']}")
    print(f"Documentation: {health['documented']}/{health['completed']} ({health['coverage']}%)")

    if auto_documented > 0:
        print(f"✨ Auto-documented: {auto_documented} new features")

    if health['coverage'] >= 95:
        print("🟢 Status: EXCELLENT")
    elif health['coverage'] >= 80:
        print("🟡 Status: GOOD")
    elif health['coverage'] >= 50:
        print("🟠 Status: NEEDS ATTENTION")
    else:
        print("🔴 Status: CRITICAL")
    print()


def run_once():
    """Run auto-documentation once."""
    conn = get_connection()

    try:
        # Auto-document any features missing docs
        auto_count = auto_document_features(conn)

        # Get health status
        health = get_health_status(conn)

        # Regenerate docs if we documented anything
        if auto_count > 0:
            print(f"📝 Auto-documenting {auto_count} features...")
            regenerate_docs()

        # Print status
        print_status(health, auto_count)

        return health['coverage']

    finally:
        conn.close()


def watch_mode(interval=60):
    """Run in watch mode, checking periodically."""
    print(f"👁️  Watch mode started (checking every {interval}s)")
    print("Press Ctrl+C to stop\n")

    try:
        while True:
            run_once()
            time.sleep(interval)
    except KeyboardInterrupt:
        print("\n👋 Watch mode stopped")


def main():
    if '--watch' in sys.argv:
        interval = 60
        for i, arg in enumerate(sys.argv):
            if arg == '--interval' and i + 1 < len(sys.argv):
                interval = int(sys.argv[i + 1])
        watch_mode(interval)
    elif '--generate' in sys.argv:
        print("📄 Regenerating all documentation...")
        regenerate_docs()
        conn = get_connection()
        health = get_health_status(conn)
        conn.close()
        print_status(health)
    else:
        run_once()


if __name__ == '__main__':
    main()
