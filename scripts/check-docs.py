#!/usr/bin/env python3
"""
QA Guardian - Documentation Health Check

Run this anytime to see documentation coverage status.

Usage:
    python scripts/check-docs.py           # Full report
    python scripts/check-docs.py --brief   # Quick summary
    python scripts/check-docs.py --missing # Show only missing docs
"""

import sqlite3
import sys
from pathlib import Path
from datetime import datetime

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
DB_PATH = PROJECT_DIR / 'features.db'


def get_docs_stats(conn):
    """Get documentation coverage statistics."""

    # Total features
    total = conn.execute('SELECT COUNT(*) FROM features').fetchone()[0]
    completed = conn.execute('SELECT COUNT(*) FROM features WHERE passes = 1').fetchone()[0]
    pending = total - completed

    # Documentation coverage (only for completed features)
    user_docs = conn.execute('''
        SELECT COUNT(*) FROM features
        WHERE passes = 1 AND user_docs IS NOT NULL AND user_docs != ""
    ''').fetchone()[0]

    api_docs = conn.execute('''
        SELECT COUNT(*) FROM features
        WHERE passes = 1 AND api_docs IS NOT NULL AND api_docs != ""
    ''').fetchone()[0]

    dev_notes = conn.execute('''
        SELECT COUNT(*) FROM features
        WHERE passes = 1 AND dev_notes IS NOT NULL AND dev_notes != ""
    ''').fetchone()[0]

    # Fully documented (has at least user_docs)
    fully_documented = conn.execute('''
        SELECT COUNT(*) FROM features
        WHERE passes = 1 AND user_docs IS NOT NULL AND user_docs != ""
    ''').fetchone()[0]

    return {
        'total': total,
        'completed': completed,
        'pending': pending,
        'user_docs': user_docs,
        'api_docs': api_docs,
        'dev_notes': dev_notes,
        'fully_documented': fully_documented
    }


def get_missing_docs(conn, limit=20):
    """Get features missing documentation."""

    cursor = conn.execute('''
        SELECT id, category, name,
               CASE WHEN user_docs IS NOT NULL AND user_docs != "" THEN 1 ELSE 0 END as has_user,
               CASE WHEN api_docs IS NOT NULL AND api_docs != "" THEN 1 ELSE 0 END as has_api,
               CASE WHEN dev_notes IS NOT NULL AND dev_notes != "" THEN 1 ELSE 0 END as has_dev
        FROM features
        WHERE passes = 1
          AND (user_docs IS NULL OR user_docs = "")
        ORDER BY category, id
        LIMIT ?
    ''', (limit,))

    return cursor.fetchall()


def get_category_coverage(conn):
    """Get documentation coverage by category."""

    cursor = conn.execute('''
        SELECT
            category,
            COUNT(*) as total,
            SUM(CASE WHEN passes = 1 THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN passes = 1 AND user_docs IS NOT NULL AND user_docs != "" THEN 1 ELSE 0 END) as documented
        FROM features
        GROUP BY category
        ORDER BY total DESC
    ''')

    return cursor.fetchall()


def pct(part, total):
    """Calculate percentage."""
    if total == 0:
        return 0
    return round((part / total) * 100)


def progress_bar(part, total, width=10):
    """Create a progress bar."""
    if total == 0:
        return '░' * width
    filled = round((part / total) * width)
    return '█' * filled + '░' * (width - filled)


def print_brief_report(stats):
    """Print a quick summary."""
    print("\n" + "=" * 50)
    print("📊 QA GUARDIAN - DOCS HEALTH CHECK")
    print("=" * 50)
    print(f"⏰ {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print()

    # Feature progress
    feat_pct = pct(stats['completed'], stats['total'])
    print(f"Features:  {progress_bar(stats['completed'], stats['total'])} {stats['completed']}/{stats['total']} ({feat_pct}%)")

    # Documentation coverage
    if stats['completed'] > 0:
        doc_pct = pct(stats['user_docs'], stats['completed'])
        print(f"Documented:{progress_bar(stats['user_docs'], stats['completed'])} {stats['user_docs']}/{stats['completed']} ({doc_pct}%)")

        if doc_pct >= 80:
            print("\n✅ Documentation coverage is GOOD!")
        elif doc_pct >= 50:
            print("\n⚠️  Documentation coverage needs attention")
        else:
            print("\n❌ Documentation coverage is LOW - needs work!")

    print()


def print_full_report(conn, stats):
    """Print detailed report."""

    print("\n" + "=" * 60)
    print("📊 QA GUARDIAN - DOCUMENTATION HEALTH REPORT")
    print("=" * 60)
    print(f"⏰ Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print()

    # Overall Stats
    print("## OVERALL PROGRESS")
    print("-" * 40)
    print(f"Total Features:    {stats['total']}")
    print(f"Completed:         {stats['completed']} ({pct(stats['completed'], stats['total'])}%)")
    print(f"Pending:           {stats['pending']}")
    print()

    # Documentation Coverage
    print("## DOCUMENTATION COVERAGE (Completed Features)")
    print("-" * 40)

    if stats['completed'] > 0:
        print(f"User Docs:    {progress_bar(stats['user_docs'], stats['completed'])} {stats['user_docs']}/{stats['completed']} ({pct(stats['user_docs'], stats['completed'])}%)")
        print(f"API Docs:     {progress_bar(stats['api_docs'], stats['completed'])} {stats['api_docs']}/{stats['completed']} ({pct(stats['api_docs'], stats['completed'])}%)")
        print(f"Dev Notes:    {progress_bar(stats['dev_notes'], stats['completed'])} {stats['dev_notes']}/{stats['completed']} ({pct(stats['dev_notes'], stats['completed'])}%)")
    else:
        print("No completed features yet.")
    print()

    # Category breakdown
    print("## BY CATEGORY")
    print("-" * 40)
    print(f"{'Category':<30} {'Done':<8} {'Docs':<8} {'Coverage'}")
    print("-" * 60)

    categories = get_category_coverage(conn)
    for cat, total, completed, documented in categories:
        if completed > 0:
            cov_pct = pct(documented, completed)
            bar = progress_bar(documented, completed, 5)
            status = "✅" if cov_pct >= 80 else ("⚠️" if cov_pct >= 50 else "❌")
            print(f"{cat[:28]:<30} {completed:<8} {documented:<8} {bar} {cov_pct}% {status}")

    print()

    # Health Score
    if stats['completed'] > 0:
        doc_score = pct(stats['user_docs'], stats['completed'])

        print("## HEALTH SCORE")
        print("-" * 40)

        if doc_score >= 80:
            print(f"🟢 EXCELLENT - {doc_score}% documented")
            print("   Great job keeping docs up to date!")
        elif doc_score >= 60:
            print(f"🟡 GOOD - {doc_score}% documented")
            print("   Some features need documentation.")
        elif doc_score >= 40:
            print(f"🟠 NEEDS WORK - {doc_score}% documented")
            print("   Many features missing documentation.")
        else:
            print(f"🔴 CRITICAL - {doc_score}% documented")
            print("   Most features lack documentation!")

        print()


def print_missing_report(conn):
    """Print features missing documentation."""

    print("\n" + "=" * 60)
    print("📋 FEATURES MISSING DOCUMENTATION")
    print("=" * 60)
    print()

    missing = get_missing_docs(conn, limit=50)

    if not missing:
        print("✅ All completed features have documentation!")
        return

    print(f"Found {len(missing)} features without user_docs:\n")
    print(f"{'ID':<6} {'Category':<25} {'Feature Name'}")
    print("-" * 70)

    for row in missing:
        id, category, name, has_user, has_api, has_dev = row
        print(f"{id:<6} {category[:23]:<25} {name[:40]}")

    total_missing = conn.execute('''
        SELECT COUNT(*) FROM features
        WHERE passes = 1 AND (user_docs IS NULL OR user_docs = "")
    ''').fetchone()[0]

    if total_missing > 50:
        print(f"\n... and {total_missing - 50} more")

    print()


def main():
    conn = sqlite3.connect(DB_PATH)

    try:
        stats = get_docs_stats(conn)

        if '--brief' in sys.argv:
            print_brief_report(stats)
        elif '--missing' in sys.argv:
            print_missing_report(conn)
        else:
            print_full_report(conn, stats)

            # Also show missing if there are undocumented features
            if stats['completed'] > stats['user_docs']:
                print("## MISSING DOCUMENTATION (Top 10)")
                print("-" * 40)
                missing = get_missing_docs(conn, limit=10)
                for row in missing:
                    id, category, name, _, _, _ = row
                    print(f"  #{id}: {name[:50]}")
                print()
                print(f"Run 'python scripts/check-docs.py --missing' to see all.")
                print()

    finally:
        conn.close()


if __name__ == '__main__':
    main()
