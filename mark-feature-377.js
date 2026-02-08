const Database = require('better-sqlite3');
const db = new Database('./features.db');

const evidence = `Fixed DependencyTreePage.tsx inline style hex colors for dark mode: Replaced hardcoded #111827 colors with hsl(var(--foreground)), #6b7280/#9ca3af/#4b5563 with hsl(var(--muted-foreground)), backgroundColor: white with hsl(var(--card)), border colors #e5e7eb with hsl(var(--border)). Converted key structural inline styles to Tailwind classes. Build verified with npm run build - 0 errors. Commit: c1d71d3`;

const stmt = db.prepare("UPDATE features SET passes = 1, in_progress = NULL, verification_evidence = ?, marked_passing_at = datetime('now') WHERE id = 377");
const result = stmt.run(evidence);

console.log('Updated rows:', result.changes);

// Verify the update
const row = db.prepare('SELECT id, name, passes FROM features WHERE id = 377').get();
console.log('Feature 377:', JSON.stringify(row, null, 2));

db.close();
