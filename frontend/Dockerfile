# QA Guardian Frontend - Production Dockerfile
# Multi-stage build for optimized production image with nginx

# ==============================================================================
# Stage 1: Builder
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# VITE build args — baked into the static bundle at build time
# Defaults match production; override via docker compose build args
ARG VITE_API_URL=https://qa.pixelcraftedmedia.com
ARG VITE_API_BASE_URL=https://qa.pixelcraftedmedia.com
ARG VITE_SOCKET_URL=https://qa.pixelcraftedmedia.com
# T2.1: VITE_MCP_URL empty → fetch resolves to same-origin `/mcp/message`.
# Nginx proxies /mcp to backend, where the JSON-RPC adapter lives. Prior
# value produced /mcp/mcp/message (double prefix) — matched nothing.
ARG VITE_MCP_URL=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
ENV VITE_MCP_URL=$VITE_MCP_URL

# Build production bundle
ENV NODE_ENV=production
RUN npm run build

# ==============================================================================
# Stage 2: Production Runtime (nginx)
# ==============================================================================
FROM nginx:1.25-alpine AS production

# Install curl for health checks
RUN apk add --no-cache curl

# Remove default nginx static content
RUN rm -rf /usr/share/nginx/html/*

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built static files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Create nginx cache directories
RUN mkdir -p /var/cache/nginx/client_temp \
    /var/cache/nginx/proxy_temp \
    /var/cache/nginx/fastcgi_temp \
    /var/cache/nginx/uwsgi_temp \
    /var/cache/nginx/scgi_temp

# Set proper permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Run nginx as non-root user
USER nginx

CMD ["nginx", "-g", "daemon off;"]
