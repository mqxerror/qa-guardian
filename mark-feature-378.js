const Database = require('better-sqlite3');
const db = new Database('./features.db');

const evidence = `Feature #378 Fix SharedTestRunPage and FlakyTestsDashboardPage dark mode completed and verified:

1. SharedTestRunPage.tsx - Fixed 15 dark mode violations:
   - Replaced bg-gray-50 dark:bg-gray-900 with bg-background (5 instances)
   - Replaced bg-white dark:bg-gray-800 with bg-card (6 instances)
   - Replaced bg-white dark:bg-gray-700 on input with bg-input (1 instance)
   - Replaced bg-gray-50 dark:bg-gray-700/50 with bg-muted (2 instances)

2. FlakyTestsDashboardPage.tsx - Fixed 8 dark mode violations:
   - Replaced all bg-white dark:bg-gray-800 with bg-card

3. Verification: npm run build (0 errors), npm run lint (0 errors), Flaky Tests page tested via Playwright with screenshot verification

4. Git commit: fb05447`;

const stmt = db.prepare("UPDATE features SET passes = 1, in_progress = NULL, verification_evidence = ?, marked_passing_at = datetime('now') WHERE id = 378");
const result = stmt.run(evidence);

console.log('Updated rows:', result.changes);

// Verify the update
const row = db.prepare('SELECT id, name, passes FROM features WHERE id = 378').get();
console.log('Feature 378:', JSON.stringify(row, null, 2));

db.close();
