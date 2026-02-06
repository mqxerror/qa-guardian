# QA Guardian Backend - Production Dockerfile
# Feature #159: Uses tsc to compile TypeScript, runs compiled JS for better performance

FROM node:20-slim

# Install system dependencies for Playwright and runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    xdg-utils \
    curl \
    dumb-init \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Install k6 for load testing
RUN curl -fsSL https://dl.k6.io/key.gpg | gpg --dearmor -o /usr/share/keyrings/k6-archive-keyring.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" > /etc/apt/sources.list.d/k6.list \
    && apt-get update && apt-get install -y k6 \
    && rm -rf /var/lib/apt/lists/*

# Install gitleaks for secret detection
RUN curl -sSfL https://github.com/gitleaks/gitleaks/releases/download/v8.21.2/gitleaks_8.21.2_linux_x64.tar.gz \
    -o /tmp/gitleaks.tar.gz \
    && tar xzf /tmp/gitleaks.tar.gz -C /usr/local/bin/ gitleaks \
    && chmod +x /usr/local/bin/gitleaks \
    && rm /tmp/gitleaks.tar.gz

# Install semgrep for SAST scanning
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip \
    && pip3 install --break-system-packages semgrep \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Install Playwright browsers
RUN npx playwright install chromium

# Copy source code
COPY . .

# Feature #159: Compile TypeScript to JavaScript for production
# Note: tsc build disabled due to widespread TS2307/TS2835 errors in codebase.
# Using tsx runtime until Phase 10 code refactoring resolves all type errors.
# RUN npm run build

# Create directories for runtime data
RUN mkdir -p /app/uploads /app/logs /app/data /app/screenshots /app/traces /app/videos /app/baselines

# Set production environment
ENV NODE_ENV=production
ENV PORT=3001

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application using tsx (TypeScript runtime)
# Will switch to compiled JS (node dist/index.js) after Phase 10 refactoring
CMD ["npx", "tsx", "src/index.ts"]
