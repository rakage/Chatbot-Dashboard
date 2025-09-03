# Facebook Bot Dashboard

A secure, production-ready web application for managing Facebook Messenger chatbots with real-time conversations, AI integration, and comprehensive analytics.

## 🚀 Features

- **Real-time Messaging**: Handle Facebook Messenger conversations with instant notifications and live updates
- **AI Integration**: Support for OpenAI, Gemini, and OpenRouter with intelligent automated responses
- **Role-Based Access Control**: Owner, Admin, and Agent roles with granular permissions
- **Encrypted Security**: API keys and sensitive data encrypted at rest
- **Auto-bot Controls**: Per-message and per-conversation bot toggling
- **Analytics & Logs**: Comprehensive tracking of bot performance and conversation metrics

## 🛠 Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes, TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **Authentication**: NextAuth with email magic links
- **Cache/Queue**: Redis + BullMQ for message processing
- **Real-time**: Socket.IO for live updates
- **Security**: libsodium for encryption, field-level encryption

## 📋 Prerequisites

- Node.js 18+
- PostgreSQL database
- Redis server
- Facebook App with Messenger permissions

## 🔧 Setup Instructions

### 1. Clone and Install

```bash
npm install
```

### 2. Environment Configuration

Copy the example environment file:

```bash
cp env.example .env.local
```

Configure the following variables in `.env.local`:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/facebook_bot_dashboard"

# Redis
REDIS_URL="redis://localhost:6379"

# NextAuth
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# Encryption (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
ENCRYPTION_KEY="your-32-byte-base64-encoded-encryption-key"

# Facebook App
FB_APP_ID="your-facebook-app-id"
FB_APP_SECRET="your-facebook-app-secret"
WEBHOOK_VERIFY_TOKEN="your-webhook-verify-token"

# LLM Providers (optional, can be configured in UI)
OPENAI_API_KEY="your-openai-api-key"
GEMINI_API_KEY="your-gemini-api-key"
OPENROUTER_API_KEY="your-openrouter-api-key"
```

### 3. Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Seed demo data
npm run db:seed
```

### 4. Facebook App Configuration

1. Create a Facebook App at [developers.facebook.com](https://developers.facebook.com)
2. Add Messenger product to your app
3. Configure webhook URL: `https://your-domain.com/api/webhook/facebook`
4. Set webhook verify token (use the same value as `WEBHOOK_VERIFY_TOKEN`)
5. Subscribe to messaging events: `messages`, `messaging_postbacks`, `messaging_deliveries`, `messaging_reads`

### 5. Run the Application

```bash
# Development mode
npm run dev
```

The application will be available at `http://localhost:3000`

## 👥 Demo Users

After running the seed script, you can sign in with these email addresses:

- **Owner**: `owner@example.com` (Full access)
- **Admin**: `admin@example.com` (Manage settings and users)
- **Agent**: `agent@example.com` (Handle conversations)

Authentication uses magic links - check your email or console logs for sign-in links.

## 🔐 Security Features

- **Encrypted Storage**: All API keys and sensitive data encrypted using libsodium
- **Role-Based Access**: Granular permissions for different user types
- **Webhook Verification**: Cryptographic verification of Facebook webhooks
- **Rate Limiting**: Built-in protection against API abuse

## 📊 User Roles

### Owner

- Full system access
- Manage all company settings
- Add/remove users
- Configure LLM providers

### Admin

- Manage company settings
- Configure LLM providers
- Connect Facebook pages
- View analytics and logs

### Agent

- Handle conversations
- Toggle bot settings per conversation
- View assigned conversations
- Add notes and tags

## 🤖 Bot Configuration

### LLM Providers

Supported providers:

- **OpenAI**: GPT-4, GPT-4 Turbo, GPT-3.5 Turbo
- **Gemini**: Gemini Pro, Gemini Pro Vision
- **OpenRouter**: Access to multiple models including Claude, Llama

### Safety Features

- Profanity filtering
- Maximum bot message limits
- Confidence thresholds
- Automatic human handoff triggers

## 📝 License

This project is licensed under the MIT License.
