#!/usr/bin/env python3
"""
QA Guardian - Feature Screenshot Capture

Captures screenshots for features during testing using Playwright.
Screenshots are saved to docs/images/features/ and linked in documentation.

Usage:
    python scripts/capture-feature-screenshot.py <feature_id> <url> [selector]

Examples:
    python scripts/capture-feature-screenshot.py 42 http://localhost:3000/dashboard
    python scripts/capture-feature-screenshot.py 42 http://localhost:3000/dashboard ".main-content"
"""

import sys
import sqlite3
import subprocess
import json
from pathlib import Path
from datetime import datetime

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
DB_PATH = PROJECT_DIR / 'features.db'
IMAGES_DIR = PROJECT_DIR / 'docs' / 'images' / 'features'


def sanitize_filename(name):
    """Convert feature name to safe filename."""
    # Remove special characters and limit length
    safe = ''.join(c if c.isalnum() or c in ' -_' else '' for c in name)
    safe = safe.replace(' ', '-').lower()
    return safe[:50]


def capture_screenshot(url, output_path, selector=None, viewport_width=1280, viewport_height=720):
    """Capture screenshot using Playwright."""

    # Build Playwright script
    script = f'''
const {{ chromium }} = require('playwright');

(async () => {{
    const browser = await chromium.launch();
    const context = await browser.newContext({{
        viewport: {{ width: {viewport_width}, height: {viewport_height} }}
    }});
    const page = await context.newPage();

    await page.goto('{url}', {{ waitUntil: 'networkidle' }});
    await page.waitForTimeout(1000);  // Wait for animations

    {'await page.locator("' + selector + '").screenshot({ path: "' + str(output_path) + '" });' if selector else 'await page.screenshot({ path: "' + str(output_path) + '", fullPage: false });'}

    await browser.close();
    console.log('Screenshot saved to: {output_path}');
}})();
'''

    # Write temp script
    temp_script = SCRIPT_DIR / 'temp_capture.js'
    temp_script.write_text(script)

    try:
        result = subprocess.run(
            ['node', str(temp_script)],
            capture_output=True,
            text=True,
            cwd=PROJECT_DIR
        )

        if result.returncode != 0:
            print(f"Error: {result.stderr}")
            return False

        return True
    finally:
        temp_script.unlink(missing_ok=True)


def update_feature_screenshot(feature_id, screenshot_path):
    """Update feature with screenshot path."""
    conn = sqlite3.connect(DB_PATH)

    # Get relative path for docs
    relative_path = f"../images/features/{screenshot_path.name}"

    conn.execute('''
        UPDATE features
        SET screenshot_path = ?
        WHERE id = ?
    ''', (relative_path, feature_id))

    conn.commit()
    conn.close()


def get_feature(feature_id):
    """Get feature details."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    cursor = conn.execute('''
        SELECT id, name, category
        FROM features
        WHERE id = ?
    ''', (feature_id,))

    feature = cursor.fetchone()
    conn.close()

    return dict(feature) if feature else None


def main():
    if len(sys.argv) < 3:
        print("Usage: python capture-feature-screenshot.py <feature_id> <url> [selector]")
        print("Example: python capture-feature-screenshot.py 42 http://localhost:3000/dashboard")
        sys.exit(1)

    feature_id = int(sys.argv[1])
    url = sys.argv[2]
    selector = sys.argv[3] if len(sys.argv) > 3 else None

    # Get feature info
    feature = get_feature(feature_id)
    if not feature:
        print(f"Feature {feature_id} not found")
        sys.exit(1)

    print(f"📸 Capturing screenshot for: {feature['name']}")

    # Generate filename
    filename = f"{feature_id}-{sanitize_filename(feature['name'])}.png"
    output_path = IMAGES_DIR / filename

    # Ensure directory exists
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    # Capture screenshot
    if capture_screenshot(url, output_path, selector):
        print(f"✅ Screenshot saved: {output_path}")

        # Update database
        update_feature_screenshot(feature_id, output_path)
        print(f"✅ Database updated with screenshot path")
    else:
        print("❌ Failed to capture screenshot")
        sys.exit(1)


if __name__ == '__main__':
    main()
