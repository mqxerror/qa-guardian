const Database = require('better-sqlite3');
const db = new Database('./features.db');

const evidence = `Fixed ExecutiveSummary.tsx dark mode violations: 1) Replaced bg-white dark:bg-gray-800 with bg-card at 3 locations (lines 37, 60, 94 for Health Score, Pass Rate, and Critical Issues cards). 2) Replaced bg-gray-200 dark:bg-gray-700 with bg-muted for progress bar background (line 49). 3) Replaced bg-gray-400 with bg-muted-foreground/50 for empty state bar (line 52). Build verified with npm run build - 0 errors. Commit: c70435f`;

const stmt = db.prepare("UPDATE features SET passes = 1, in_progress = NULL, verification_evidence = ?, marked_passing_at = datetime('now') WHERE id = 375");
const result = stmt.run(evidence);

console.log('Updated rows:', result.changes);

// Verify the update
const row = db.prepare('SELECT id, name, passes, verification_evidence FROM features WHERE id = 375').get();
console.log('Feature 375:', JSON.stringify(row, null, 2));

db.close();
