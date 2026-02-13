const Database = require('better-sqlite3');
const db = new Database('/Users/mqxerrormac16/Documents/QA-Dam3oun/features.db');

const action = process.argv[2];
const featureId = process.argv[3];

if (action === 'mark-passing') {
  db.prepare('UPDATE features SET passes = 1, in_progress = 0 WHERE id = ?').run(featureId);
  const row = db.prepare('SELECT id, name, passes, in_progress FROM features WHERE id = ?').get(featureId);
  console.log('Marked passing:', JSON.stringify(row));
} else if (action === 'mark-in-progress') {
  db.prepare('UPDATE features SET in_progress = 1 WHERE id = ?').run(featureId);
  const row = db.prepare('SELECT id, name, passes, in_progress FROM features WHERE id = ?').get(featureId);
  console.log('Marked in-progress:', JSON.stringify(row));
} else if (action === 'next') {
  const row = db.prepare('SELECT id, name, description, steps, category FROM features WHERE passes = 0 AND in_progress = 0 ORDER BY priority ASC LIMIT 1').get();
  console.log('Next feature:', JSON.stringify(row, null, 2));
} else if (action === 'stats') {
  const total = db.prepare('SELECT COUNT(*) as c FROM features').get().c;
  const passing = db.prepare('SELECT COUNT(*) as c FROM features WHERE passes = 1').get().c;
  const inProgress = db.prepare('SELECT COUNT(*) as c FROM features WHERE in_progress = 1').get().c;
  console.log(`Stats: ${passing}/${total} passing (${(passing/total*100).toFixed(1)}%), ${inProgress} in-progress`);
} else {
  console.log('Usage: node query-pending.js [mark-passing|mark-in-progress|next|stats] [featureId]');
}

db.close();
