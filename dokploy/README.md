# QA Guardian - Dokploy Deployment

Deploy QA Guardian to production using [Dokploy](https://dokploy.com), a self-hosted PaaS that simplifies Docker deployments.

## Prerequisites

- Dokploy installed and running on your server
- Domain configured: `qa.pixelcraftedmedia.com` pointing to your server
- Git repository access configured in Dokploy

## Environment Files

This directory contains two environment configuration files:

| File | Purpose |
|------|---------|
| `.env.example` | Quick-start template with minimal required variables |
| `.env.production.example` | **Comprehensive** configuration with all variables and detailed documentation |

For production deployments, refer to `.env.production.example` for the complete list of options.

## Deployment Steps

### 1. Create Application in Dokploy

1. Log into Dokploy dashboard
2. Click "Create Application"
3. Select "Docker Compose" as deployment type
4. Connect your Git repository
5. Set the compose file path to `dokploy/docker-compose.yml`

### 2. Configure Environment Variables

In Dokploy dashboard, add these environment variables.

**Generate Secrets First:**
```bash
# Run these commands to generate secure values:
openssl rand -base64 32  # For passwords (POSTGRES, REDIS, MINIO)
openssl rand -base64 64  # For tokens (JWT_SECRET, JWT_REFRESH_SECRET, SESSION_SECRET)
```

**Minimum Required Variables:**
```bash
# Application Mode
NODE_ENV=production

# Database
POSTGRES_PASSWORD=<your-generated-32-byte-secret>

# Redis
REDIS_PASSWORD=<your-generated-32-byte-secret>

# MinIO Storage
MINIO_ROOT_USER=qa-guardian-admin
MINIO_ROOT_PASSWORD=<your-generated-32-byte-secret>
STORAGE_BUCKET=qa-guardian-artifacts

# JWT/Session (use 64-byte secrets)
JWT_SECRET=<your-generated-64-byte-secret>
JWT_REFRESH_SECRET=<your-generated-64-byte-secret>
SESSION_SECRET=<your-generated-64-byte-secret>

# Frontend URLs
FRONTEND_URL=https://qa.pixelcraftedmedia.com
VITE_API_URL=https://qa.pixelcraftedmedia.com
VITE_API_BASE_URL=https://qa.pixelcraftedmedia.com
VITE_SOCKET_URL=https://qa.pixelcraftedmedia.com
VITE_MCP_URL=https://qa.pixelcraftedmedia.com/mcp
```

**Optional - AI Features (Highly Recommended):**
```bash
# Kie.ai - 70% cost savings on Claude models!
KIE_API_KEY=your-kie-api-key

# Anthropic - fallback provider
ANTHROPIC_API_KEY=your-anthropic-api-key
```

**Optional - Google Sign-in:**
```bash
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

**Optional - GitHub Integration:**
```bash
GITHUB_APP_ID=your-github-app-id
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

> For the complete list of all environment variables with detailed documentation, see [`.env.production.example`](.env.production.example)

### 3. Configure Domain

1. In Dokploy, go to application settings
2. Set domain to `qa.pixelcraftedmedia.com`
3. Enable SSL (Let's Encrypt will auto-provision)
4. Configure HTTPS redirect

### 4. Deploy

Click "Deploy" in Dokploy dashboard, or push to your configured branch for automatic deployment.

### 5. Enable Auto-Deploy with GitHub Webhook (Optional)

Set up automatic deployments when you push to your repository:

#### Step 1: Get Dokploy Webhook URL

1. In Dokploy dashboard, go to your QA Guardian project
2. Navigate to **Settings** → **Webhooks**
3. Click **Create Webhook** or find the existing webhook
4. Copy the **Webhook URL** (format: `https://your-dokploy-server/api/webhook/xxxxx`)

#### Step 2: Add Webhook to GitHub

1. Go to your GitHub repository
2. Navigate to **Settings** → **Webhooks** → **Add webhook**
3. Configure:
   - **Payload URL**: Paste the Dokploy webhook URL
   - **Content type**: `application/json`
   - **Secret**: Generate and enter a webhook secret (same as in Dokploy)
   - **Which events?**: Select "Just the push event"
   - **Active**: Check this box
4. Click **Add webhook**

#### Step 3: Configure Webhook Secret (Security)

```bash
# Generate a secure webhook secret
openssl rand -hex 32
```

Add this secret in both:
- Dokploy: Project Settings → Webhooks → Secret
- GitHub: Repository Settings → Webhooks → Secret

#### Step 4: Test Auto-Deploy

1. Make a small change to your code
2. Commit and push to the main branch
3. Check Dokploy dashboard for automatic deployment
4. Verify the webhook delivery in GitHub (Settings → Webhooks → Recent Deliveries)

## Architecture

```
                    ┌──────────────┐
                    │   Traefik    │
                    │   (HTTPS)    │
                    └──────┬───────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
    ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
    │  Frontend   │ │   Backend   │ │    MCP      │
    │   (nginx)   │ │  (Fastify)  │ │  (optional) │
    │   :80       │ │   :3001     │ │   :3002     │
    └─────────────┘ └──────┬──────┘ └─────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
    ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
    │  PostgreSQL │ │    Redis    │ │    MinIO    │
    │    :5432    │ │    :6379    │ │  :9000/9001 │
    └─────────────┘ └─────────────┘ └─────────────┘
```

## Traefik Routing

| Path | Service | Port |
|------|---------|------|
| `/` | Frontend (nginx) | 80 |
| `/api/*` | Backend (Fastify) | 3001 |
| `/socket.io/*` | Backend (WebSocket) | 3001 |
| `/mcp/*` | MCP Server | 3002 |

## Health Checks

All services include health checks:

- **Frontend**: `GET /health`
- **Backend**: `GET /api/health` or `GET :3001/health`
- **PostgreSQL**: `pg_isready -U postgres`
- **Redis**: `redis-cli ping`
- **MinIO**: `GET /minio/health/live`

## Logs

View logs in Dokploy dashboard or via SSH:

```bash
# All services
docker-compose -f dokploy/docker-compose.yml logs -f

# Specific service
docker-compose -f dokploy/docker-compose.yml logs -f backend
```

## Scaling

To enable MCP server for AI agent integration:

```bash
docker-compose -f dokploy/docker-compose.yml --profile mcp up -d
```

## Troubleshooting

### SSL Certificate Issues
- Ensure domain DNS is properly configured
- Check Traefik logs: `docker logs traefik`
- Verify Let's Encrypt rate limits

### Database Connection Issues
- Check postgres health: `docker exec qa-guardian-postgres pg_isready`
- Verify POSTGRES_PASSWORD matches in all services

### CORS Errors
- Verify FRONTEND_URL is set to `https://qa.pixelcraftedmedia.com`
- Check backend CORS configuration

### AI Features Not Working (503 errors)
- Ensure KIE_API_KEY or ANTHROPIC_API_KEY is set
- Check backend logs for AI provider initialization
- Verify API key is valid at provider dashboard

## Default Login

After deployment, use:
- Email: `owner@example.com`
- Password: `Owner123!`

**Important:** Change the default password after first login!
