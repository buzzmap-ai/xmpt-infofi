# XMTP Agent Web Interface

A simple web interface for the XMTP agent that provides a chat-like UI instead of terminal-based interaction.

## Features

- 🌐 **Web-based Interface**: Chat-like UI instead of terminal
- 🔄 **Real-time Updates**: Messages update automatically every 2 seconds
- 🎛️ **Service Control**: Start/Stop the XMTP agent from the web interface
- 💬 **Conversation Management**: View all conversations and messages
- 📱 **Responsive Design**: Clean, modern UI with Tailwind CSS

## Architecture

The application consists of:

1. **XMTP Service** (`src/xmtpService.ts`): Background service that handles XMTP connections
2. **Message Store** (`src/messageStore.ts`): In-memory storage for conversations and messages
3. **Web Interface** (`pages/index.tsx`): React-based chat UI
4. **API Routes** (`pages/api/`): REST API to control the service and send messages

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables** (same as before):
   ```bash
   export WALLET_KEY="your-wallet-private-key"
   export ENCRYPTION_KEY="your-encryption-key"
   export XMTP_ENV="production" # or "dev"
   export GOOGLE_API_KEY="your-google-api-key"
   ```

## Running the Application

### Web Interface (Recommended)

1. **Start the web application**:
   ```bash
   npm run dev
   ```

2. **Open your browser** and go to `http://localhost:3000`

3. **Click "Start Agent"** in the web interface to begin listening for messages

4. **Use the interface** to:
   - View incoming conversations
   - See all messages in real-time
   - Send manual messages to any conversation
   - Monitor the agent's status

### Terminal Mode (Original)

If you prefer the terminal interface:
```bash
npm run agent
```

## How It Works

1. **Background Process**: The XMTP agent runs as a background service within the Next.js application
2. **Shared State**: Messages are stored in an in-memory store accessible by both the service and web interface
3. **Real-time Updates**: The web interface polls for updates every 2 seconds
4. **API Integration**: Same AI logic and cred.buzz API calls as the original terminal version

## Features

- **Start/Stop Control**: Toggle the XMTP agent on/off from the web interface
- **Live Status**: See if the agent is running and connected
- **Conversation List**: All conversations appear in the sidebar
- **Message History**: Full message history for each conversation
- **Send Messages**: Manually send messages to any conversation
- **Auto-scroll**: Messages automatically scroll to the bottom
- **Responsive**: Works on desktop and mobile

## Development

The web interface adds the following new files:
- `pages/` - Next.js pages and API routes
- `styles/` - Global CSS with Tailwind
- `src/messageStore.ts` - Shared message storage
- `src/xmtpService.ts` - Service wrapper for XMTP client

The original `src/index.ts` remains unchanged and can still be used independently.

## Deployment

For local deployment:
```bash
npm run build
npm start
```

The agent will run continuously in the background while the web interface remains accessible. 