const Database = require('better-sqlite3');
const db = new Database('features.db');

const stats = db.prepare('SELECT passes, in_progress, COUNT(*) as count FROM features GROUP BY passes, in_progress').all();
console.log('Feature stats:', stats);

const pending = db.prepare('SELECT id, priority, name FROM features WHERE passes = 0 AND in_progress = 0 ORDER BY priority LIMIT 10').all();
console.log('Pending features (passes=0):', pending);

const nullPending = db.prepare('SELECT id, priority, name, category FROM features WHERE passes IS NULL ORDER BY priority LIMIT 20').all();
console.log('Pending features (passes=NULL):', nullPending);

// Fix the NULL values
const fixResult = db.prepare('UPDATE features SET passes = 0 WHERE passes IS NULL').run();
console.log('Fixed NULL passes:', fixResult.changes, 'rows updated');

// Verify fix
const verifyStats = db.prepare('SELECT passes, in_progress, COUNT(*) as count FROM features GROUP BY passes, in_progress').all();
console.log('Stats after fix:', verifyStats);

const maxPriority = db.prepare('SELECT MAX(priority) as max FROM features').get();
console.log('Max priority:', maxPriority);

db.close();
