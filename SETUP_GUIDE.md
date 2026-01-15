# IG-DATABASE Project Setup & Run Guide

## Project Overview

This is a full-stack Instagram data mining and outreach platform built with:
- **Frontend**: Remix (React framework) with shadcn/ui components
- **Backend**: Elysia API server (merged with Remix server)
- **Database**: TimescaleDB (PostgreSQL 14)
- **Runtime**: Bun
- **Additional Services**: Python FastAPI for language detection, Reacher for email verification

## Prerequisites

1. **Bun** - Install from https://bun.sh
2. **Docker & Docker Compose** - For running TimescaleDB and Reacher
3. **Python 3.8+** - For the language detection service
4. **Node.js** (optional, if Bun doesn't work for some operations)

## Step-by-Step Setup

### 1. Install Dependencies

```bash
# Install Bun dependencies
bun install

# Install Python dependencies for language detection
cd lang-detect
pip install -r requirements.txt
cd ..
```

### 2. Set Up Environment Variables

Create a `.env` file in the root directory with the following variables (based on `backend/src/env.ts`):

```env
# General
NODE_ENV=development
PORT=3000
WEBHOOK_KEY=your_webhook_key
REDIS_URL=redis://localhost:6379
EMAIL_KEY=your_email_key

# Pipedrive
PIPEDRIVE_CLIENT_ID=your_client_id
PIPEDRIVE_CLIENT_SECRET=your_client_secret
PIPEDRIVE_API_KEY=your_api_key

# External Services
ME_SLACK_URL=https://hooks.slack.com/services/your/webhook
NILS_SLACK_URL=https://hooks.slack.com/services/your/webhook
WEBHOOK_SECRET=your_webhook_secret
CALENDLY_KEY=your_calendly_key

# Email Services
MIXMAX_KEY=your_mixmax_key
INSTANTLY_KEY=your_instantly_key

# Database (will be used by Docker Compose)
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/igdb
DATABASE_HOST=localhost
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=your_password
DATABASE_PORT=5432

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GMAIL_CLIENT_ID=your_gmail_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GMAIL_CLIENT_SECRET=your_gmail_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
GMAIL_CALLBACK_URL=http://localhost:3000/auth/gmail/callback

# Brightdata (Proxy)
BRIGHTDATA_API_KEY=your_brightdata_key
BRIGHTDATA_ACCOUNT_ID=your_account_id
BRIGHTDATA_ZONE=your_zone

# Proxy
PROXY_URL=your_proxy_url
PROXY_USERNAME=your_proxy_username
PROXY_PASSWORD=your_proxy_password
PROXY_LIST=your_proxy_list

# Instagram API (HikerAPI/Lamadava)
LAMADAVA_KEY=your_lamadava_key
LAMADAVA_URL=your_lamadava_url

# Other Services
RUNPOD_KEY=your_runpod_key
STRIPE_KEY=your_stripe_key
OPEN_AI_API_KEY=your_openai_key
```

**Note**: Replace all placeholder values with your actual API keys and credentials.

### 3. Start Docker Services

Start the database and Reacher service using Docker Compose:

```bash
docker-compose up -d
```

This will start:
- **TimescaleDB** on port 5432
- **Reacher** (email verification) on port 8080

Wait for the database to be ready (check with `docker ps`).

### 4. Set Up Database

```bash
# Generate Prisma client and push schema to database
bun run db:push

# This will create all tables and generate types in backend/src/db/db_types.ts
```

### 5. Start the Language Detection Service (Optional)

In a separate terminal:

```bash
cd lang-detect
python main.py
# or
uvicorn main:app --host 0.0.0.0 --port 8000
```

This service runs on port 8000 by default.

### 6. Run the Application

#### Development Mode (Recommended for first run)

```bash
# Start the main server (Remix + API)
bun run dev
```

This will:
- Start the Remix dev server with hot reload
- Run the Elysia API server
- Start background services (limited in dev mode)

The application will be available at: **http://localhost:3000**

#### Production Mode

```bash
# Build the application first
bun run build

# Start the server
bun run start
```

### 7. Background Services (Optional)

The project includes several background services that run automatically in production:

- **Services** (`bun run start:services`): Background tasks and cron jobs
- **Miner 1** (`bun run start:miner1`): Mines new Instagram accounts
- **Miner 2** (`bun run start:miner2`): Updates existing Instagram accounts
- **Miner 3** (`bun run start:miner3`): Mines German accounts for cloning

In development mode, only `importAccountsToEmailSequenceCron` runs.

## Available Scripts

From `package.json`:

- `bun run dev` - Start development server with hot reload
- `bun run build` - Build for production
- `bun run start` - Start production server
- `bun run backend` - Run backend-only mode
- `bun run start:services` - Start background services
- `bun run start:miner1` - Start Instagram miner 1
- `bun run start:miner2` - Start Instagram miner 2
- `bun run start:miner3` - Start Instagram miner 3
- `bun run db:push` - Push Prisma schema to database
- `bun run db:migrate` - Run database migrations
- `bun run generate` - Generate Prisma client
- `bun run typecheck` - Type check TypeScript
- `bun run format` - Format code with Biome

## Project Structure

- `app/` - Remix frontend (routes, components, services)
- `backend/src/` - Backend API and services
  - `api/` - API routes (Elysia)
  - `mining/` - Instagram mining logic
  - `triggers/` - Email outreach triggers
  - `db/` - Database utilities (Kysely)
- `prisma/` - Database schema files
- `lang-detect/` - Python FastAPI service for language detection
- `server.ts` - Main server entry point (merges Remix + Elysia)
- `services.ts` - Background services entry point

## Authentication

The app uses Google OAuth via Lucia Auth. Only whitelisted emails or `@startviral.de` domain can log in.

## Troubleshooting

1. **Database connection errors**: 
   - Ensure Docker containers are running: `docker ps`
   - Check DATABASE_URL in `.env` matches docker-compose.yml settings

2. **Port already in use**:
   - Change PORT in `.env` or stop the conflicting service

3. **Missing environment variables**:
   - Check `backend/src/env.ts` for all required variables
   - Ensure all are set in `.env`

4. **Prisma errors**:
   - Run `bun run generate` to regenerate Prisma client
   - Run `bun run db:push` to sync schema

5. **Bun not found**:
   - Install Bun: `curl -fsSL https://bun.sh/install | bash`
   - Or use npm/node: `npm install` and `npm run dev` (may have compatibility issues)

## Next Steps

1. Set up Google OAuth credentials in Google Cloud Console
2. Configure all API keys for external services
3. Set up Redis (if not using Docker)
4. Review and configure background services in `services.ts`
5. Set up proper authentication whitelist in the codebase

## Production Deployment

For production, the project uses PM2. See `ecosystem.config.cjs` for configuration. Deploy with:

```bash
bun run deploy
```

