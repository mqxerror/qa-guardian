const Database = require('better-sqlite3');
const db = new Database('features.db');
const rows = db.prepare('SELECT id, category, name FROM features WHERE passes = 0 AND in_progress = 0 ORDER BY id ASC LIMIT 30').all();
rows.forEach(r => console.log(r.id + ': [' + r.category + '] ' + r.name));
db.close();
