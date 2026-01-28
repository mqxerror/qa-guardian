const Database = require('better-sqlite3');
const db = new Database('features.db');
const f = db.prepare('SELECT * FROM features WHERE in_progress = 1').get();
console.log(JSON.stringify(f, null, 2));
db.close();
