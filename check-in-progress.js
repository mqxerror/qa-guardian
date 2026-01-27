const Database = require('better-sqlite3');
const db = new Database('features.db');
const rows = db.prepare('SELECT id, name, in_progress, passes FROM features WHERE in_progress = 1').all();
console.log(JSON.stringify(rows, null, 2));
db.close();
