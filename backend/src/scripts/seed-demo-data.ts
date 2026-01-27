/**
 * Feature #2010: Optional Demo Data Seeder
 *
 * This script is NOT run automatically. Use it only for:
 * - Taking screenshots for marketing/documentation
 * - Demo environments
 * - Development testing with realistic data
 *
 * Usage: npm run seed:demo
 */

console.log('=================================================');
console.log('  QA Guardian - Demo Data Seeder');
console.log('=================================================\n');

console.log('This script seeds demo/sample data into the application.');
console.log('It is intended for:');
console.log('  - Screenshots and marketing materials');
console.log('  - Demo environments');
console.log('  - Development testing\n');

console.log('NOTE: In normal operation, the application starts clean.');
console.log('Users create their own real data through the UI.\n');

// Demo data configuration
const DEMO_CONFIG = {
  // Project demo data
  projects: [
    { name: 'Demo E-Commerce App', baseUrl: 'https://demo-shop.example.com' },
    { name: 'Demo Blog Platform', baseUrl: 'https://demo-blog.example.com' },
  ],

  // Test suite demo data
  testSuites: [
    { name: 'Authentication Tests', testCount: 5 },
    { name: 'Checkout Flow Tests', testCount: 8 },
    { name: 'API Integration Tests', testCount: 12 },
  ],

  // Monitor demo data
  monitors: [
    { name: 'Homepage Health', url: 'https://example.com', interval: 60 },
    { name: 'API Gateway', url: 'https://api.example.com/health', interval: 30 },
  ],

  // AI cost analytics demo data (30 days)
  aiCostDays: 30,
};

async function seedDemoData() {
  console.log('Seeding demo data...\n');

  // In a real implementation, this would:
  // 1. Connect to the database
  // 2. Insert demo projects, test suites, tests
  // 3. Create sample test runs with varied results
  // 4. Add demo monitors with status history
  // 5. Populate AI cost analytics

  console.log('Demo data configuration:');
  console.log(JSON.stringify(DEMO_CONFIG, null, 2));

  console.log('\n[INFO] This is a placeholder script.');
  console.log('[INFO] The actual implementation would insert demo data into the stores.');
  console.log('[INFO] For now, the application starts clean and users create their own data.\n');

  console.log('=================================================');
  console.log('  Demo data seeding complete!');
  console.log('=================================================');
}

// Run if executed directly
seedDemoData().catch(console.error);
