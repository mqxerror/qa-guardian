const Database = require('better-sqlite3');
const db = new Database('/Users/mqxerrormac16/Documents/QA-Dam3oun/features.db');
const featureId = parseInt(process.argv[2]) || 178;
db.prepare('UPDATE features SET in_progress = 1 WHERE id = ?').run(featureId);
const feature = db.prepare('SELECT id, category, name, description, steps FROM features WHERE id = ?').get(featureId);
console.log(JSON.stringify(feature, null, 2));
db.close();
