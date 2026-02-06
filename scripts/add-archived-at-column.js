#!/usr/bin/env node
/**
 * Quick script to add the archived_at column to projects table
 * Run with: node scripts/add-archived-at-column.js
 */

const pg = require('../backend/node_modules/pg');
const dotenv = require('../backend/node_modules/dotenv');
const path = require('path');

// Load .env from project root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pg;

async function addArchivedAtColumn() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Checking if archived_at column exists...');

    // Check if column exists
    const checkResult = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'projects' AND column_name = 'archived_at'
    `);

    if (checkResult.rows.length > 0) {
      console.log('Column archived_at already exists. No changes needed.');
      return;
    }

    console.log('Adding archived_at column to projects table...');

    await pool.query(`
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL
    `);

    console.log('Successfully added archived_at column!');

    // Verify the column was added
    const verifyResult = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'projects' AND column_name = 'archived_at'
    `);

    if (verifyResult.rows.length > 0) {
      console.log('Verified: Column exists with type', verifyResult.rows[0].data_type);
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

addArchivedAtColumn();
