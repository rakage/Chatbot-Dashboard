# 🚀 Upstash Redis Setup for Real-time Features

## Quick Setup for Upstash Redis

### 1. Get Your Upstash Redis URL

1. Go to [Upstash Console](https://console.upstash.com/)
2. Create a new Redis database (if you haven't already)
3. Copy your **Redis URL** from the dashboard

### 2. Add to Environment Variables

Add this to your `.env.local` file:

```env
# Upstash Redis URL (should look like: rediss://...)
REDIS_URL="rediss://your-upstash-redis-url-here"
```

**Example Upstash URL format:**

```env
REDIS_URL="rediss://default:your-password@your-region.upstash.io:6380"
```

### 3. Test the Connection

1. **Restart your server:**

   ```bash
   npm run dev:realtime
   ```

2. **Check Bot Settings page:**

   - Visit: http://localhost:3000/dashboard/bot-settings
   - Look for "Real-time System Status" panel
   - Should show: ✅ Redis: Connected

3. **Test the system status:**
   - Click "Refresh" button in System Status
   - Should see: ✅ Redis Database: Connected
   - Should see: ✅ Message Workers: Running

### 4. Features Now Available

With Upstash Redis connected, you get:

✅ **Real-time messaging** - Instant message delivery
✅ **Message queues** - Reliable background processing  
✅ **Auto-bot responses** - AI-powered replies
✅ **Worker processes** - Scalable message handling
✅ **Delivery confirmations** - Message status tracking

### 🔧 Troubleshooting

**Connection Issues?**

1. **Check URL format** - Must start with `rediss://` (note the double 's')
2. **Verify credentials** - Username/password should be correct
3. **Region-specific** - Use the exact URL from Upstash console

**Still not working?**

Check server logs for specific error messages:

```bash
# Look for Redis connection messages
npm run dev:realtime
```

### 🎯 Test Real-time Features

Once connected:

1. **Go to Conversations** → **"Open Live View"**
2. **Send test messages** - Should see instant delivery
3. **Check typing indicators** - Real-time feedback
4. **Test auto-bot** - AI responses (if configured)

### 🌟 Production Notes

- ✅ Upstash Redis is **production-ready**
- ✅ **SSL/TLS encrypted** connections
- ✅ **Global edge locations** for low latency
- ✅ **Automatic scaling** and backups

Your real-time system is now fully operational! 🚀
