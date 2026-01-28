const Database = require('better-sqlite3');
const db = new Database('features.db');
const id = parseInt(process.argv[2]);
if (!id) { console.log('Usage: node mark-in-progress.js <feature_id>'); process.exit(1); }
db.prepare('UPDATE features SET in_progress = 1 WHERE id = ?').run(id);
console.log(`Feature ${id} marked as in-progress`);
db.close();
