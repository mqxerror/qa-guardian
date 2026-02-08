const Database = require('better-sqlite3');
const db = new Database('./features.db');

const evidence = `Fixed AIRouterPage.tsx (6,708 lines) dark mode violations: Replaced 57 bg-white card/panel containers with bg-card, replaced ~26 bg-gray-50 occurrences with bg-muted/50, replaced multiple bg-gray-100/200 patterns with bg-muted. Kept legitimate bg-white uses: bg-white/20 overlays, toggle knobs (rounded-full shadow), animate-pulse dots. Added dark: modifiers for colored backgrounds. Build verified with npm run build - 0 errors. Commit: c40870c`;

const stmt = db.prepare("UPDATE features SET passes = 1, in_progress = NULL, verification_evidence = ?, marked_passing_at = datetime('now') WHERE id = 376");
const result = stmt.run(evidence);

console.log('Updated rows:', result.changes);

// Verify the update
const row = db.prepare('SELECT id, name, passes FROM features WHERE id = 376').get();
console.log('Feature 376:', JSON.stringify(row, null, 2));

db.close();
