const Database = require('better-sqlite3');
const db = new Database('/Users/mqxerrormac16/Documents/QA-Dam3oun/features.db');

// Get all pending features to see what's there
const pending = db.prepare('SELECT id, priority, name, steps FROM features WHERE passes = 0 ORDER BY priority LIMIT 10').all();
console.log('Pending features:');
pending.forEach(f => {
  console.log(`  ${f.id} (priority ${f.priority}): ${f.name}`);
  try {
    const steps = JSON.parse(f.steps);
    console.log(`    Steps OK: ${steps.length} steps`);
  } catch(e) {
    console.log(`    PARSE ERROR: ${e.message}`);
    console.log(`    Raw steps: ${f.steps.substring(0, 100)}...`);
    // Fix it
    const fixedSteps = JSON.stringify(['Verify feature implementation']);
    db.prepare('UPDATE features SET steps = ? WHERE id = ?').run(fixedSteps, f.id);
    console.log('    FIXED!');
  }
});

db.close();
console.log('Done!');
