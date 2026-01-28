const Database = require('better-sqlite3');
const db = new Database('features.db');

// Mark feature #2100 as passing and clear in_progress flag
const result = db.prepare('UPDATE features SET passes = 1, in_progress = 0 WHERE id = 2100').run();
console.log('Feature #2100 marked as passing:', result.changes, 'row(s) updated');

// Verify
const feature = db.prepare('SELECT id, name, passes, in_progress FROM features WHERE id = 2100').get();
console.log('Feature #2100:', feature);

// Get updated stats
const stats = db.prepare('SELECT COUNT(*) as total, SUM(CASE WHEN passes = 1 THEN 1 ELSE 0 END) as passing, SUM(CASE WHEN in_progress = 1 THEN 1 ELSE 0 END) as in_progress FROM features').get();
console.log('Updated stats:', stats);

db.close();
