# Snappy - XMTP Agent

Meet Snappy, your InfoFi AI agent for XMTP. Real-time messaging. Web-based.

## What Snappy Does

- 🌐 Web chat interface
- 🔄 Live message updates
- 🎛️ Start/stop Snappy control
- 💬 Conversation management
- 📱 Mobile-ready design

## Get Started with Snappy

1. **Install**:
   ```bash
   npm install
   ```

2. **Configure**:
   ```bash
   export WALLET_KEY="your-wallet-private-key"
   export ENCRYPTION_KEY="your-encryption-key"
   export XMTP_ENV="production"
   export GOOGLE_API_KEY="your-google-api-key"
   ```

3. **Run**:
   ```bash
   npm run dev
   ```

4. **Go**: Open `http://localhost:3000` → Click "Start Snappy"

## Two Ways to Use Snappy

**Web** (recommended): Point, click, chat with Snappy.
**Terminal**: `npm run agent`

## How Snappy Works

- **XMTP Service**: Handles Snappy's connections
- **Message Store**: Stores Snappy's conversations
- **Web UI**: React interface for Snappy
- **API**: Control endpoints for Snappy

## Deploy Snappy

```bash
npm run build && npm start
```

Snappy's ready! 🚀 
