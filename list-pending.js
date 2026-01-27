const Database = require('better-sqlite3');
const db = new Database('features.db');
const pending = db.prepare('SELECT id, name, steps FROM features WHERE passes = 0 ORDER BY priority').all();
console.log('=== Pending Features (' + pending.length + ') ===');
pending.forEach(f => {
  console.log('\nID:', f.id, '- Name:', f.name);
  console.log('Steps:', f.steps);
});
db.close();
