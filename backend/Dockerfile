# QA Guardian Backend - Production Dockerfile
# Feature #159: Uses tsc to compile TypeScript, runs compiled JS for better performance
# Feature #361: Multi-stage build to reduce final image size by ~500MB

# =============================================================================
# Stage 1: Builder - Install build deps, compile TypeScript, install Python tools
# =============================================================================
FROM node:20-slim AS builder

# Feature #361: Build arguments for tool versions (easier updates)
ARG GITLEAKS_VERSION=v8.21.2

# Install build dependencies (these won't be in final image)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gnupg \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install semgrep for SAST scanning (in builder, copy binary to runtime)
RUN pip3 install --break-system-packages semgrep

# Install gitleaks for secret detection (architecture-aware for arm64/amd64)
RUN ARCH=$(dpkg --print-architecture) \
    && GITLEAKS_ARCH=$(if [ "$ARCH" = "amd64" ]; then echo "x64"; else echo "$ARCH"; fi) \
    && curl -sSfL "https://github.com/gitleaks/gitleaks/releases/download/${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION#v}_linux_${GITLEAKS_ARCH}.tar.gz" \
       -o /tmp/gitleaks.tar.gz \
    && tar xzf /tmp/gitleaks.tar.gz -C /usr/local/bin/ gitleaks \
    && chmod +x /usr/local/bin/gitleaks \
    && rm /tmp/gitleaks.tar.gz

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Feature #159 + #177: Compile TypeScript to JavaScript for production
RUN npm run build

# Compile migrations separately (they're outside src/)
# node-pg-migrate needs CommonJS files (.cjs) when running compiled backend
RUN npx tsc migrations/*.ts --outDir migrations --module CommonJS --moduleResolution Node --esModuleInterop --skipLibCheck \
    && for f in migrations/*.js; do mv "$f" "${f%.js}.cjs"; done \
    && rm -f migrations/*.ts

# Feature #181: Remove devDependencies to reduce image size
RUN npm prune --omit=dev

# =============================================================================
# Stage 2: Runtime - Minimal production image
# =============================================================================
FROM node:20-slim AS runtime

# Install only runtime system dependencies for Playwright and tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Playwright dependencies
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
    # Minimal runtime tools
    curl \
    ca-certificates \
    dumb-init \
    # Python runtime for semgrep (no pip/build tools)
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Install k6 for load testing (binary download, architecture-aware for arm64/amd64)
ARG K6_VERSION=v0.54.0
RUN ARCH=$(dpkg --print-architecture) \
    && curl -fsSL "https://github.com/grafana/k6/releases/download/${K6_VERSION}/k6-${K6_VERSION}-linux-${ARCH}.tar.gz" \
       | tar xz -C /usr/local/bin --strip-components=1 \
    && chmod +x /usr/local/bin/k6

WORKDIR /app

# Copy compiled output and production dependencies from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/migrations ./migrations

# Copy pre-built binary tools from builder
COPY --from=builder /usr/local/bin/gitleaks /usr/local/bin/gitleaks

# Copy semgrep and its Python dependencies
COPY --from=builder /usr/local/lib/python3.11/dist-packages /usr/local/lib/python3.11/dist-packages
COPY --from=builder /usr/local/bin/semgrep /usr/local/bin/semgrep

# Install all Playwright browsers (Chromium, Firefox, WebKit) with system dependencies
# All three browsers are required for cross-browser testing functionality
RUN npx playwright install --with-deps

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

# Start the application using compiled JavaScript (Feature #177)
CMD ["node", "dist/index.js"]
