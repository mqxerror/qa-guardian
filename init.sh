#!/bin/bash

# QA Guardian - Development Environment Setup Script
# This script initializes and runs the development environment

set -e

echo "======================================"
echo "  QA Guardian - Development Setup"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to print status
print_status() {
    echo -e "${GREEN}[OK]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
echo "Checking prerequisites..."
echo ""

# Check Node.js
if command_exists node; then
    NODE_VERSION=$(node -v)
    print_status "Node.js found: $NODE_VERSION"
else
    print_error "Node.js not found. Please install Node.js 20+."
    exit 1
fi

# Check npm
if command_exists npm; then
    NPM_VERSION=$(npm -v)
    print_status "npm found: $NPM_VERSION"
else
    print_error "npm not found. Please install npm."
    exit 1
fi

# Check Docker (optional but recommended)
if command_exists docker; then
    DOCKER_VERSION=$(docker -v)
    print_status "Docker found: $DOCKER_VERSION"
else
    print_warning "Docker not found. Some features (test execution workers) require Docker."
fi

# Check PostgreSQL (check for psql command)
if command_exists psql; then
    print_status "PostgreSQL client found"
else
    print_warning "PostgreSQL client not found. Database setup may require manual configuration."
fi

# Check Redis (check for redis-cli command)
if command_exists redis-cli; then
    print_status "Redis client found"
else
    print_warning "Redis client not found. Will need Redis server for caching/queuing."
fi

echo ""
echo "======================================"
echo "  Installing Dependencies"
echo "======================================"
echo ""

# Install backend dependencies
if [ -d "backend" ]; then
    echo "Installing backend dependencies..."
    cd backend
    npm install
    cd ..
    print_status "Backend dependencies installed"
else
    print_warning "Backend directory not found. Will be created during project setup."
fi

# Install frontend dependencies
if [ -d "frontend" ]; then
    echo "Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
    print_status "Frontend dependencies installed"
else
    print_warning "Frontend directory not found. Will be created during project setup."
fi

echo ""
echo "======================================"
echo "  Environment Configuration"
echo "======================================"
echo ""

# Create .env file if not exists
if [ ! -f ".env" ]; then
    echo "Creating .env file from example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        print_status ".env file created from .env.example"
    else
        cat > .env << 'EOF'
# QA Guardian Environment Configuration

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/qa_guardian
REDIS_URL=redis://localhost:6379

# Application
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000

# JWT Secrets (generate your own for production)
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-key-change-in-production

# Session
SESSION_SECRET=your-session-secret-change-in-production
SESSION_TIMEOUT_DAYS=7

# Google OAuth (configure if using Google Sign-In)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3001/api/v1/auth/google/callback

# GitHub App (configure for GitHub integration)
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_WEBHOOK_SECRET=

# Storage (MinIO/S3)
STORAGE_ENDPOINT=localhost
STORAGE_PORT=9000
STORAGE_ACCESS_KEY=minioadmin
STORAGE_SECRET_KEY=minioadmin
STORAGE_BUCKET=qa-guardian-artifacts
STORAGE_USE_SSL=false

# Email (configure for email notifications)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@example.com

# Slack (configure for Slack integration)
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
EOF
        print_status ".env file created with default values"
    fi
    print_warning "Please update .env with your actual configuration values"
else
    print_status ".env file already exists"
fi

echo ""
echo "======================================"
echo "  Database Setup"
echo "======================================"
echo ""

# Run database migrations if available
if [ -d "backend" ] && [ -f "backend/package.json" ]; then
    if grep -q "migrate" backend/package.json; then
        echo "Running database migrations..."
        cd backend
        npm run migrate 2>/dev/null || print_warning "Migration command not available yet"
        cd ..
    fi
fi

echo ""
echo "======================================"
echo "  Development Servers"
echo "======================================"
echo ""

# Check if we should start servers
if [ "$1" == "--start" ] || [ "$1" == "-s" ]; then
    echo "Starting development servers..."

    # Start backend
    if [ -d "backend" ]; then
        echo "Starting backend server..."
        cd backend
        npm run dev &
        BACKEND_PID=$!
        cd ..
        echo "Backend server starting on http://localhost:3001"
    fi

    # Start frontend
    if [ -d "frontend" ]; then
        echo "Starting frontend server..."
        cd frontend
        npm run dev &
        FRONTEND_PID=$!
        cd ..
        echo "Frontend server starting on http://localhost:3000"
    fi

    echo ""
    echo "======================================"
    echo "  QA Guardian is Running!"
    echo "======================================"
    echo ""
    echo "  Frontend: http://localhost:3000"
    echo "  Backend:  http://localhost:3001"
    echo "  API Docs: http://localhost:3001/api/docs"
    echo ""
    echo "  Press Ctrl+C to stop all servers"
    echo ""

    # Wait for interrupt
    wait
else
    echo "To start the development servers, run:"
    echo ""
    echo "  ./init.sh --start"
    echo ""
    echo "Or start them individually:"
    echo ""
    echo "  Backend:  cd backend && npm run dev"
    echo "  Frontend: cd frontend && npm run dev"
    echo ""
fi

echo ""
echo "======================================"
echo "  Setup Complete!"
echo "======================================"
echo ""
echo "Next steps:"
echo "  1. Update .env with your configuration"
echo "  2. Start PostgreSQL and Redis services"
echo "  3. Run database migrations"
echo "  4. Start the development servers"
echo ""
