const Database = require('better-sqlite3');
const db = new Database('/Users/mqxerrormac16/Documents/QA-Dam3oun/features.db');

const rows = db.prepare('SELECT id, priority, name, category FROM features WHERE passes = 0 ORDER BY priority').all();
console.log('Pending features:');
rows.forEach(r => console.log(`  ${r.id} (p${r.priority}) [${r.category}]: ${r.name}`));

db.close();
