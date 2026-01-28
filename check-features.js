const db = require('better-sqlite3')('/Users/mqxerrormac16/Documents/QA-Dam3oun/features.db');
db.prepare("UPDATE features SET passes = 1, in_progress = 0 WHERE id IN (2115, 2116, 2117, 2118)").run();
console.log("Features #2115-2118 marked as passing");
const next = db.prepare("SELECT id, name, description FROM features WHERE passes = 0 ORDER BY id LIMIT 1").get();
console.log("Next pending feature:", JSON.stringify(next, null, 2));
const stats = db.prepare("SELECT CASE WHEN passes = 1 THEN 'passing' WHEN in_progress = 1 THEN 'in_progress' ELSE 'pending' END as status, COUNT(*) as count FROM features GROUP BY status").all();
console.log("Stats:", JSON.stringify(stats));
