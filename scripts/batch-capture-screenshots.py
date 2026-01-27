#!/usr/bin/env python3
"""
QA Guardian - Batch Screenshot Capture

Captures screenshots of key application pages and links them to relevant features.
Run this when the app is running locally at http://localhost:3000

Usage:
    python scripts/batch-capture-screenshots.py [--dry-run]
"""

import sqlite3
import subprocess
import sys
from pathlib import Path
from datetime import datetime

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
DB_PATH = PROJECT_DIR / 'features.db'
IMAGES_DIR = PROJECT_DIR / 'docs' / 'images' / 'features'

# Base URL - change if your app runs on a different port
# Common ports: 3000 (React), 5173 (Vite), 4200 (Angular), 8080 (Vue)
BASE_URL = "http://localhost:5173"

# Key pages to capture and their related feature keywords
# Format: (page_name, url_path, keywords_to_match_features)
KEY_PAGES = [
    # Authentication & Getting Started
    ("login", "/login", ["login", "sign in", "authentication", "email and password"]),
    ("register", "/register", ["registration", "sign up", "create account"]),
    ("forgot-password", "/forgot-password", ["password reset", "forgot password"]),

    # Dashboard
    ("dashboard", "/dashboard", ["dashboard", "health score", "pass rate", "trends", "analytics"]),

    # Projects
    ("projects-list", "/projects", ["project list", "projects", "create project"]),
    ("project-detail", "/projects/1", ["project detail", "project settings", "environment variables"]),

    # Test Suites
    ("test-suites", "/projects/1/suites", ["test suite", "suites", "create suite"]),
    ("test-detail", "/projects/1/suites/1/tests/1", ["test detail", "test steps", "edit test"]),

    # Test Authoring
    ("visual-recorder", "/recorder", ["visual recorder", "record", "capture click", "capture type"]),
    ("code-editor", "/projects/1/suites/1/tests/1/code", ["playwright code", "code editor", "edit code"]),

    # Test Results
    ("test-results", "/runs/1", ["test results", "pass/fail", "execution trace"]),
    ("test-artifacts", "/runs/1/artifacts", ["screenshot", "video", "trace viewer", "artifacts"]),

    # Visual Regression
    ("visual-regression", "/visual", ["visual regression", "visual test"]),
    ("baseline-viewer", "/visual/baselines", ["baseline", "baseline viewer", "baseline history"]),
    ("diff-viewer", "/visual/compare/1", ["diff viewer", "comparison", "side-by-side", "overlay", "slider"]),
    ("visual-review-queue", "/visual/review", ["review queue", "pending approval", "batch approve"]),

    # Performance Testing (Lighthouse)
    ("lighthouse-results", "/performance/1", ["lighthouse", "performance score", "lcp", "cls", "fid", "web vitals"]),
    ("lighthouse-trends", "/performance/trends", ["performance trends", "score over time"]),

    # Load Testing (K6)
    ("k6-editor", "/load-testing/new", ["k6 editor", "k6 script", "load test template"]),
    ("k6-results", "/load-testing/runs/1", ["k6 results", "rps", "latency", "p95", "p99", "virtual users"]),
    ("k6-realtime", "/load-testing/runs/1/live", ["real-time", "vus", "rps during"]),

    # Accessibility Testing
    ("accessibility-results", "/accessibility/1", ["accessibility", "violations", "wcag", "axe-core"]),
    ("accessibility-violation", "/accessibility/1/violations", ["violation detail", "remediation", "affected element"]),

    # Settings
    ("settings", "/settings", ["settings", "preferences", "notification"]),
    ("team-settings", "/settings/team", ["team", "invite", "member role", "organization"]),
    ("api-keys", "/settings/api-keys", ["api key", "create key", "scopes"]),

    # Schedules
    ("schedules", "/schedules", ["schedule", "cron", "frequency"]),

    # Integrations
    ("github-integration", "/settings/integrations/github", ["github", "repository", "pr status"]),
    ("slack-integration", "/settings/integrations/slack", ["slack", "alert", "notification"]),

    # Alerts
    ("alerts", "/alerts", ["alert", "notification history"]),

    # Audit Log
    ("audit-log", "/audit", ["audit log", "user actions", "history"]),
]


def get_connection():
    """Get database connection."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def find_matching_features(conn, keywords):
    """Find features that match any of the keywords."""
    matching_ids = set()

    for keyword in keywords:
        cursor = conn.execute('''
            SELECT id FROM features
            WHERE passes = 1
              AND (LOWER(name) LIKE ? OR LOWER(description) LIKE ?)
        ''', (f'%{keyword.lower()}%', f'%{keyword.lower()}%'))

        for row in cursor.fetchall():
            matching_ids.add(row['id'])

    return list(matching_ids)


def capture_screenshot(url, output_path, viewport_width=1280, viewport_height=800):
    """Capture screenshot using Playwright via Node.js."""

    script = f'''
const {{ chromium }} = require('playwright');

(async () => {{
    const browser = await chromium.launch();
    const context = await browser.newContext({{
        viewport: {{ width: {viewport_width}, height: {viewport_height} }}
    }});
    const page = await context.newPage();

    try {{
        await page.goto('{url}', {{ waitUntil: 'networkidle', timeout: 10000 }});
        await page.waitForTimeout(500);
        await page.screenshot({{ path: '{output_path}' }});
        console.log('OK');
    }} catch (e) {{
        console.log('FAIL: ' + e.message);
    }}

    await browser.close();
}})();
'''

    temp_script = SCRIPT_DIR / 'temp_batch_capture.js'
    temp_script.write_text(script)

    try:
        result = subprocess.run(
            ['node', str(temp_script)],
            capture_output=True,
            text=True,
            cwd=PROJECT_DIR,
            timeout=30
        )

        output = result.stdout.strip()
        return output == 'OK'
    except subprocess.TimeoutExpired:
        print(f"  ⏱️  Timeout capturing {url}")
        return False
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return False
    finally:
        temp_script.unlink(missing_ok=True)


def update_features_with_screenshot(conn, feature_ids, screenshot_path):
    """Update features to reference the screenshot."""
    relative_path = f"../images/features/{screenshot_path.name}"

    for fid in feature_ids:
        conn.execute('''
            UPDATE features
            SET screenshot_path = ?
            WHERE id = ? AND (screenshot_path IS NULL OR screenshot_path = '')
        ''', (relative_path, fid))

    conn.commit()
    return len(feature_ids)


def main():
    dry_run = '--dry-run' in sys.argv

    print("=" * 60)
    print("📸 QA GUARDIAN - BATCH SCREENSHOT CAPTURE")
    print("=" * 60)
    print(f"⏰ {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"🌐 Base URL: {BASE_URL}")
    print(f"📂 Output: {IMAGES_DIR}")
    if dry_run:
        print("🔍 DRY RUN - No screenshots will be captured")
    print()

    # Ensure output directory exists
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    conn = get_connection()

    total_pages = len(KEY_PAGES)
    captured = 0
    failed = 0
    features_linked = 0

    print(f"Processing {total_pages} key pages...\n")

    for i, (page_name, url_path, keywords) in enumerate(KEY_PAGES, 1):
        full_url = f"{BASE_URL}{url_path}"
        output_path = IMAGES_DIR / f"{page_name}.png"

        # Find matching features
        matching_ids = find_matching_features(conn, keywords)

        print(f"[{i}/{total_pages}] {page_name}")
        print(f"    URL: {url_path}")
        print(f"    Matching features: {len(matching_ids)}")

        if dry_run:
            print(f"    ✓ Would capture screenshot")
            features_linked += len(matching_ids)
            captured += 1
        else:
            # Capture screenshot
            if capture_screenshot(full_url, output_path):
                print(f"    ✅ Screenshot saved")
                captured += 1

                # Link to features
                if matching_ids:
                    linked = update_features_with_screenshot(conn, matching_ids, output_path)
                    features_linked += linked
                    print(f"    🔗 Linked to {linked} features")
            else:
                print(f"    ❌ Failed to capture (is the app running?)")
                failed += 1

        print()

    conn.close()

    # Summary
    print("=" * 60)
    print("📊 SUMMARY")
    print("=" * 60)
    print(f"Pages captured: {captured}/{total_pages}")
    print(f"Pages failed: {failed}")
    print(f"Features linked to screenshots: {features_linked}")

    if failed > 0:
        print(f"\n⚠️  Some pages failed. Make sure the app is running at {BASE_URL}")

    if not dry_run and captured > 0:
        print(f"\n✨ Run 'python scripts/generate-docs.py' to update documentation with screenshots!")


if __name__ == '__main__':
    main()
