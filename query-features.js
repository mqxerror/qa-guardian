const Database = require('better-sqlite3');
const db = new Database('/Users/mqxerrormac16/Documents/QA-Dam3oun/features.db');
const rows = db.prepare('SELECT id, priority, category, name, passes, in_progress FROM features WHERE passes = 0 ORDER BY priority LIMIT 5').all();
console.log(JSON.stringify(rows, null, 2));
db.close();
