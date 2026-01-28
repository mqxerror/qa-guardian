const Database = require('better-sqlite3');
const db = new Database('features.db');
const id = parseInt(process.argv[2]);
const action = process.argv[3] || 'pass';

if (action === 'pass') {
  db.prepare('UPDATE features SET passes = 1, in_progress = 0 WHERE id = ?').run(id);
  console.log(`Feature #${id} marked as PASSING`);
} else if (action === 'in_progress') {
  db.prepare('UPDATE features SET in_progress = 1 WHERE id = ?').run(id);
  console.log(`Feature #${id} marked as IN PROGRESS`);
} else if (action === 'clear') {
  db.prepare('UPDATE features SET in_progress = 0 WHERE id = ?').run(id);
  console.log(`Feature #${id} cleared in_progress`);
}
