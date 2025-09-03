# 🚀 Real-time Messaging Setup Documentation

This guide will help you set up the complete real-time messaging system for your Facebook Bot Dashboard.

## 📋 Prerequisites

- Node.js 18+ installed
- PostgreSQL database running
- Redis server (for message queuing and real-time features)
- Facebook Developer Account

## 🏗️ System Architecture

```
Facebook Webhook → Next.js API → Redis Queue → Socket.IO → React Frontend
                                    ↓
                              Database (PostgreSQL)
```

## 🔧 Installation & Setup

### 1. Install Dependencies

All required dependencies are already in your `package.json`:

```bash
npm install
```

**Key packages for real-time features:**

- `socket.io` & `socket.io-client` - Real-time communication
- `bullmq` - Message queue processing
- `ioredis` - Redis client

### 2. Environment Variables

Add these to your `.env.local` file:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/facebook_bot_db"
DIRECT_URL="postgresql://username:password@localhost:5432/facebook_bot_db"

# NextAuth
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# Redis (Required for real-time messaging)
REDIS_URL="redis://localhost:6379"

# Webhook
WEBHOOK_VERIFY_TOKEN="your-webhook-verify-token"

# Email (for NextAuth email provider)
EMAIL_SERVER_HOST="smtp.gmail.com"
EMAIL_SERVER_PORT="587"
EMAIL_SERVER_USER="your-email@gmail.com"
EMAIL_SERVER_PASSWORD="your-app-password"
EMAIL_FROM="your-email@gmail.com"
```

### 3. Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Optional: Seed database
npm run db:seed
```

### 4. Redis Setup

**Option A: Docker (Recommended)**

```bash
docker run -d --name redis -p 6379:6379 redis:alpine
```

**Option B: Local Installation**

**Windows:**

```bash
# Using Chocolatey
choco install redis-64

# Start Redis
redis-server
```

**macOS:**

```bash
# Using Homebrew
brew install redis
brew services start redis
```

**Ubuntu/Debian:**

```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

**Verify Redis is running:**

```bash
redis-cli ping
# Should return: PONG
```

### 5. Start the Application

**Development with Real-time Features:**

```bash
# Start with custom server for Socket.IO
node server.js
```

**Alternative (without Socket.IO server):**

```bash
npm run dev
```

## 🔌 Facebook Integration

### 1. Facebook App Setup

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app
3. Add **Messenger** platform
4. Generate a **Page Access Token**

### 2. Webhook Configuration

**Webhook URL:** `https://your-domain.com/api/webhook/facebook`
**Verify Token:** Use the same token from your environment variables

**Webhook Fields to Subscribe:**

- `messages`
- `messaging_postbacks`
- `message_deliveries`
- `message_reads`

### 3. Test Webhook

Visit your Bot Settings page and use the "Test Webhook" button to verify:

- Redis connection
- Webhook accessibility
- Facebook integration

## 🎯 Real-time Features

### Socket.IO Events

**Client → Server:**

```javascript
// Join conversation room
socket.emit("join:conversation", conversationId);

// Leave conversation room
socket.emit("leave:conversation", conversationId);

// Typing indicators
socket.emit("typing:start", { conversationId });
socket.emit("typing:stop", { conversationId });

// Presence updates
socket.emit("presence:update", "online" | "away" | "offline");
```

**Server → Client:**

```javascript
// New message received
socket.on("message:new", (data) => {
  // data: { message, conversation }
});

// Message delivery confirmation
socket.on("message:sent", (data) => {
  // data: { messageId, facebookMessageId, sentAt }
});

// Typing indicators
socket.on("typing:start", (data) => {
  // data: { userId, conversationId }
});

socket.on("typing:stop", (data) => {
  // data: { userId, conversationId }
});

// Conversation updates
socket.on("conversation:updated", (data) => {
  // data: { conversationId, lastMessageAt, messageCount }
});
```

### Message Flow

1. **Incoming Message (Facebook → Dashboard):**

   ```
   Facebook Webhook → API Route → Redis Queue → Worker → Database → Socket.IO → Frontend
   ```

2. **Outgoing Message (Dashboard → Facebook):**

   ```
   Frontend → API Route → Database → Redis Queue → Worker → Facebook API → Socket.IO Confirmation
   ```

3. **Bot Response:**
   ```
   Incoming Message → Bot Queue → LLM Service → Database → Outgoing Queue → Facebook API
   ```

## 🧪 Testing the System

### 1. Check System Status

Visit: `http://localhost:3000/api/dev/redis-status`

Expected response:

```json
{
  "status": "connected",
  "message": "Redis is running and accessible",
  "url": "redis://localhost:6379"
}
```

### 2. Test Real-time Connection

1. Open **Bot Settings** page
2. Click **"Test Webhook"**
3. Should show: ✅ Webhook test successful! Redis connected.

### 3. Test Live Messaging

1. Go to **Conversations** page
2. Click **"Open Live View"**
3. Select a conversation
4. Send a test message
5. Verify real-time delivery

### 4. Facebook Integration Test

1. Message your Facebook page from a personal account
2. Check Dashboard for incoming message
3. Reply from Dashboard
4. Verify message appears on Facebook

## 🔍 Troubleshooting

### Redis Connection Issues

**Error:** `ECONNREFUSED 127.0.0.1:6379`

**Solutions:**

1. Start Redis server: `redis-server`
2. Check Redis status: `redis-cli ping`
3. Verify REDIS_URL in environment
4. Use Docker: `docker run -d -p 6379:6379 redis:alpine`

### Socket.IO Connection Issues

**Error:** WebSocket connection failed

**Solutions:**

1. Use custom server: `node server.js`
2. Check firewall settings
3. Verify NEXTAUTH_URL environment variable
4. Test in incognito mode (clear cookies)

### Message Queue Issues

**Error:** Queue processing fails

**Solutions:**

1. Restart Redis
2. Check worker initialization
3. Verify database connection
4. Check API routes for errors

### Facebook Webhook Issues

**Error:** Webhook verification fails

**Solutions:**

1. Check WEBHOOK_VERIFY_TOKEN matches Facebook
2. Use HTTPS in production
3. Test simple webhook: `/api/webhook/facebook/simple`
4. Verify page access token

## 📊 Monitoring

### Redis Monitoring

```bash
# Monitor Redis commands
redis-cli monitor

# Check memory usage
redis-cli info memory

# List active connections
redis-cli client list
```

### Application Logs

```bash
# View real-time logs
npm run dev

# Check specific components
console.log("Socket connections:", io.engine.clientsCount);
console.log("Queue jobs:", await queue.getJobs());
```

## 🚀 Production Deployment

### 1. Environment Setup

```env
# Production Redis (recommended: Redis Cloud)
REDIS_URL="rediss://username:password@host:port"

# Secure webhook
NEXTAUTH_URL="https://your-domain.com"
WEBHOOK_VERIFY_TOKEN="secure-production-token"

# SSL Database connection
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
```

### 2. Deployment Commands

```bash
# Build application
npm run build

# Start production server
node server.js

# Or use PM2 for process management
pm2 start server.js --name "facebook-bot-dashboard"
```

### 3. Production Checklist

- ✅ Redis server running and accessible
- ✅ Database migrations applied
- ✅ HTTPS enabled for webhooks
- ✅ Environment variables set
- ✅ Facebook webhook verified
- ✅ Socket.IO server initialized
- ✅ Message workers running

## 🎉 Success!

Your real-time messaging system is now ready! Users can:

- 📱 Send/receive messages instantly
- 👁️ See typing indicators
- ✅ Get delivery confirmations
- 🤖 Use auto-bot responses
- 👥 Collaborate in real-time
- 📊 Monitor live conversation stats

## 🆘 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Verify all prerequisites are met
3. Test each component individually
4. Check browser console for errors
5. Review server logs for details

The system is designed to be robust and will fallback gracefully if certain components (like Redis) are unavailable, ensuring your dashboard remains functional even during maintenance.
