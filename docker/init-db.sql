-- QA Guardian Database Initialization Script
-- This script runs when the PostgreSQL container is first created

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create tables will be handled by migrations
-- This file is for any initial setup needed

-- Grant privileges (if using a separate app user)
-- CREATE USER qa_guardian_app WITH PASSWORD 'app_password';
-- GRANT ALL PRIVILEGES ON DATABASE qa_guardian TO qa_guardian_app;
