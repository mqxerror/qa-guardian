const Database = require('better-sqlite3');
const db = new Database('features.db');
const ids = process.argv.slice(2).map(Number);
ids.forEach(id => {
  db.prepare('UPDATE features SET passes = 1, in_progress = 0 WHERE id = ?').run(id);
  console.log('Feature #' + id + ' marked as PASSING');
});
db.close();
