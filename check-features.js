const db = require('better-sqlite3')('/Users/mqxerrormac16/Documents/QA-Dam3oun/features.db');
const features = db.prepare("SELECT id, name, passes FROM features WHERE id >= 2120 ORDER BY id").all();
features.forEach(f => console.log(`  #${f.id}: ${f.name} (passes=${f.passes})`));
