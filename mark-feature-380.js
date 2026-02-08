const Database = require('better-sqlite3');
const db = new Database('./features.db');

const featureId = 380;

// Update the feature
const result = db.prepare(`
  UPDATE features
  SET passes = 1, in_progress = 0
  WHERE id = ?
`).run(featureId);

if (result.changes > 0) {
  const feature = db.prepare('SELECT * FROM features WHERE id = ?').get(featureId);
  console.log(`✅ Feature #${featureId} marked as passing`);
  console.log(`   Name: ${feature.name}`);
  console.log(`   Category: ${feature.category}`);

  // Get stats
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN passes = 1 THEN 1 ELSE 0 END) as passing,
      SUM(CASE WHEN in_progress = 1 THEN 1 ELSE 0 END) as in_progress
    FROM features
  `).get();

  console.log(`\n📊 Progress: ${stats.passing}/${stats.total} (${((stats.passing/stats.total)*100).toFixed(1)}%)`);
} else {
  console.log(`❌ Feature #${featureId} not found`);
}

db.close();
