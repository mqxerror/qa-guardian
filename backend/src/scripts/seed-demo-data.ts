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

import { createLogger } from '../services/logger.js';

const seedLogger = createLogger('seed-demo-data');

seedLogger.info('=================================================');
seedLogger.info('  QA Guardian - Demo Data Seeder');
seedLogger.info('=================================================');

seedLogger.info('This script seeds demo/sample data into the application.');
seedLogger.info('It is intended for: Screenshots and marketing materials, Demo environments, Development testing');

seedLogger.info('NOTE: In normal operation, the application starts clean. Users create their own real data through the UI.');

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
  seedLogger.info('Seeding demo data...');

  // In a real implementation, this would:
  // 1. Connect to the database
  // 2. Insert demo projects, test suites, tests
  // 3. Create sample test runs with varied results
  // 4. Add demo monitors with status history
  // 5. Populate AI cost analytics

  seedLogger.info({ config: DEMO_CONFIG }, 'Demo data configuration');

  seedLogger.info('This is a placeholder script. The actual implementation would insert demo data into the stores.');
  seedLogger.info('For now, the application starts clean and users create their own data.');

  seedLogger.info('=================================================');
  seedLogger.info('  Demo data seeding complete!');
  seedLogger.info('=================================================');
}

// Run if executed directly
seedDemoData().catch((err) => {
  seedLogger.error({ error: err instanceof Error ? err.message : String(err) }, 'Seed script failed');
});
