const Database = require('better-sqlite3');
const db = new Database('features.db');
const features = db.prepare('SELECT * FROM features WHERE passes = 0 ORDER BY priority LIMIT 10').all();
features.forEach(f => {
  console.log(`\n--- Feature #${f.id} (Priority: ${f.priority}) ---`);
  console.log(`Name: ${f.name}`);
  console.log(`Category: ${f.category}`);
  console.log(`Description: ${f.description}`);
  console.log(`Steps: ${f.steps}`);
  console.log(`In Progress: ${f.in_progress}`);
});
db.close();
