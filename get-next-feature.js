const Database = require('better-sqlite3');
const db = new Database('features.db');
const next = db.prepare('SELECT * FROM features WHERE passes = 0 AND in_progress = 0 ORDER BY id ASC LIMIT 1').get();
if (next) {
  console.log('Next Feature:', JSON.stringify(next, null, 2));
} else {
  console.log('No pending features!');
}
