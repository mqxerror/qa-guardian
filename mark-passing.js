const Database = require('better-sqlite3');
const db = new Database('/Users/mqxerrormac16/Documents/QA-Dam3oun/features.db');
const featureId = parseInt(process.argv[2]);
const evidence = process.argv.slice(3).join(' ') || 'Verified via browser automation';
if (!featureId) { console.log('Usage: node mark-passing.js <feature_id> [evidence]'); process.exit(1); }
db.prepare('UPDATE features SET passes = 1, in_progress = 0, verification_evidence = ?, marked_passing_at = datetime(\'now\') WHERE id = ?').run(evidence, featureId);
const feature = db.prepare('SELECT id, name, passes, verification_evidence FROM features WHERE id = ?').get(featureId);
console.log('Feature marked as passing:');
console.log(JSON.stringify(feature, null, 2));
db.close();
