# 🚀 Quick Start Guide - Real-time Facebook Bot Dashboard

## ⚡ 3-Minute Setup

### 1. Start Redis (Required for Real-time Features)

**Option A: Docker (Recommended)**

```bash
docker run -d --name redis -p 6379:6379 redis:alpine
```

**Option B: Local Installation**

```bash
# Windows (Chocolatey)
choco install redis-64
redis-server

# macOS (Homebrew)
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt install redis-server
sudo systemctl start redis
```

### 2. Start the Application

```bash
# For real-time features with Socket.IO
npm run dev:socket

# OR standard Next.js dev server (limited real-time)
npm run dev
```

### 3. Test Real-time System

1. Open: http://localhost:3000/dashboard/bot-settings
2. Check **System Status** - should show all green
3. Click **"Test Webhook"** - should show ✅ success

### 4. Test Live Messaging

1. Go to **Conversations** → **"Open Live View"**
2. Real-time interface should load
3. Send test messages to see live updates

## 🔧 Facebook Setup (5 minutes)

### 1. Facebook Developer Console

1. Go to https://developers.facebook.com/
2. Create App → **Business** type
3. Add **Messenger** product
4. Generate **Page Access Token**

### 2. Webhook Configuration

**In Bot Settings page:**

- Copy the webhook URL shown
- Use your custom verify token

**In Facebook Console:**

- Set webhook URL: `http://localhost:3000/api/webhook/facebook`
- Set verify token (same as your setting)
- Subscribe to: `messages`, `messaging_postbacks`, `message_deliveries`, `message_reads`

### 3. Test Integration

1. Message your Facebook page
2. Check dashboard for incoming message
3. Reply from dashboard
4. Verify message appears on Facebook

## ✅ Verification Checklist

- [ ] Redis running (`redis-cli ping` returns PONG)
- [ ] App started with `npm run dev:socket`
- [ ] Bot Settings shows all green status
- [ ] Webhook test passes
- [ ] Facebook webhook verified
- [ ] Live conversations accessible
- [ ] Messages send/receive in real-time

## 🎯 Key Features Working

✅ **Real-time messaging** - Instant send/receive
✅ **Auto-bot responses** - AI powered replies  
✅ **Typing indicators** - See when users type
✅ **Delivery confirmations** - Message status updates
✅ **Multi-user support** - Team collaboration
✅ **Role-based access** - Owner/Admin/Agent permissions

## 🔍 Troubleshooting

**Redis Connection Error?**

```bash
# Check if Redis is running
redis-cli ping

# Start Redis
docker run -d -p 6379:6379 redis:alpine
```

**Socket.IO Not Working?**

```bash
# Use Socket.IO server
npm run dev:socket

# Check browser console for errors
```

**Facebook Webhook Fails?**

- Use `/api/webhook/facebook/simple` for testing
- Verify webhook URL is publicly accessible
- Check verify token matches

## 🚀 Production Deployment

1. **Use Redis Cloud** for production
2. **Enable HTTPS** for webhooks
3. **Set environment variables**
4. **Start with**: `node server.js`

## 📚 Full Documentation

See `REALTIME_SETUP_DOCUMENTATION.md` for complete setup instructions and advanced configuration.

---

**Need Help?** All components are designed to work independently and provide clear error messages. Check the system status panel in Bot Settings for real-time diagnostics.
