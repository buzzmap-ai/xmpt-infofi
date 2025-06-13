import {
  createSigner,
  getEncryptionKeyFromHex,
  logAgentDetails,
  validateEnvironment,
} from "./helpers/client";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";
import https from 'https';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { messageStore } from './messageStore';
import type { Message } from './messageStore';

// Define your 3 API endpoints
const API_ENDPOINTS = {
  endpoint1: "https://api.cred.buzz/user/author-handle-details?author_handle=author_value",
  endpoint2: "https://api.cred.buzz/user/get-top-tweets?author_handle=author_value&interval=7day&sort_by=view_count_desc&limit=5",
  endpoint3: "https://api.cred.buzz/user/author-handle-followers?author_handle=author_value&sort_by=smart_followers_count_desc&limit=10&start=0",
};

async function decideApiEndpoint(userMessage: string, model: any): Promise<string> {
  try {
    const prompt = `
You are an AI assistant that needs to decide which API endpoint to call based on user input.

Available API endpoints:
1. endpoint1: For getting author handle details and social media information
2. endpoint2: For getting top tweets of the author
3. endpoint3: For getting top followers or smart followers of the author

User message: "${userMessage}"

Based on the user's message, which endpoint should be called? Respond with ONLY one of these options:
- endpoint1
- endpoint2  
- endpoint3

Consider the context and intent of the user's message to make the best choice.
`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const decision = response.text().trim().toLowerCase();
    
    if (decision === 'endpoint1' || decision === 'endpoint2' || decision === 'endpoint3') {
      console.log(`AI decided to use: ${decision}`);
      return decision;
    } else {
      console.log(`AI gave unexpected response: ${decision}, defaulting to endpoint1`);
      return 'endpoint1';
    }
  } catch (error) {
    console.error('Error with AI decision making:', error);
    return 'endpoint1';
  }
}

async function extractAuthorHandle(userMessage: string, model: any): Promise<string> {
  try {
    const prompt = `
Extract the author handle (username/handle) from the following user message. 
The author handle could be mentioned with or without @ symbol, or could be a Twitter/social media username.

User message: "${userMessage}"

Return ONLY the author handle without any @ symbol or additional text. If no clear author handle is found, return the most relevant username or handle mentioned.

Examples:
- "Get details for @elonmusk" -> "elonmusk"
- "Show me tweets from vitalik" -> "vitalik"
- "What are the followers of @naval?" -> "naval"
- "kaitoai profile" -> "kaitoai"
`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const authorHandle = response.text().trim().replace('@', '');
    
    console.log(`Extracted author handle: ${authorHandle}`);
    return authorHandle;
  } catch (error) {
    console.error('Error extracting author handle:', error);
    const words = userMessage.split(' ');
    for (const word of words) {
      if (word.startsWith('@')) {
        return word.substring(1);
      }
      if (word.match(/^[a-zA-Z0-9_]{3,}$/)) {
        return word;
      }
    }
    return userMessage.trim();
  }
}

function makeApiCall(endpoint: string, authorHandle: string): Promise<any> {
  return new Promise((resolve, reject) => {
    let url: string;
    
    switch (endpoint) {
      case 'endpoint1':
        url = API_ENDPOINTS.endpoint1.replace('author_value', encodeURIComponent(authorHandle));
        break;
      case 'endpoint2':
        url = API_ENDPOINTS.endpoint2.replace('author_value', encodeURIComponent(authorHandle));
        break;
      case 'endpoint3':
        url = API_ENDPOINTS.endpoint3.replace('author_value', encodeURIComponent(authorHandle));
        break;
      default:
        url = API_ENDPOINTS.endpoint1.replace('author_value', encodeURIComponent(authorHandle));
    }

    console.log(`Making API call to: ${url}`);

    const options = {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'XMTP-Agent/1.0',
      },
      rejectUnauthorized: false,
    };

    const req = https.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(data);
          resolve({
            endpoint_used: endpoint,
            author_handle: authorHandle,
            data: parsedData
          });
        } catch (e) {
          resolve({
            endpoint_used: endpoint,
            author_handle: authorHandle,
            error: 'Failed to parse response',
            raw_data: data
          });
        }
      });
    });

    req.on('error', (error) => {
      console.error(`Request error for ${endpoint}:`, error);
      resolve({
        endpoint_used: endpoint,
        author_handle: authorHandle,
        error: error.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        endpoint_used: endpoint,
        author_handle: authorHandle,
        error: 'Request timeout'
      });
    });

    req.setTimeout(10000);
  });
}

function formatEndpoint1Response(data: any): string {
  try {
    const name = data.result.name || 'N/A';
    const authorHandle = data.result.author_handle || 'N/A';
    const bio = data.result.bio || 'N/A';
    const profileImageUrl = data.result.profile_image_url || 'N/A';
    const followersCount = data.result.followers_count || 'N/A';
    const tags = Array.isArray(data.result.tags) ? data.result.tags.join(', ') : (data.result.tags || 'N/A');
    
    return `👤 Name: ${name}
🏷️ Handle: ${authorHandle}
📝 Bio: ${bio}
🖼️ Profile Image: ${profileImageUrl}
👥 Followers: ${followersCount}
🏷️ Tags: ${tags}`;
  } catch (error) {
    console.error('Error formatting endpoint1 response:', error);
    return 'Error formatting profile data';
  }
}

function formatEndpoint3Response(data: any): string {
  try {
    const followings = data.result.followings || [];
    
    if (followings.length === 0) {
      return '❌ No followers data found';
    }
    
    let response = `🌟 Top Smart Followers (${followings.length}):\n\n`;
    
    followings.forEach((follower: any, index: number) => {
      const profileName = follower.profile_name || 'N/A';
      const handle = follower.handle || 'N/A';
      const profileImageUrl = follower.profile_image_url || 'N/A';
      const tags = Array.isArray(follower.tags) ? follower.tags.join(', ') : (follower.tags || 'N/A');
      const followersCount = follower.followers_count || 'N/A';
      const smartFollowers = follower.smart_followers || 'N/A';
      
      response += `${index + 1}. 👤 ${profileName}
   🏷️ @${handle}
   🖼️ ${profileImageUrl}
   🏷️ ${tags}
   👥 ${followersCount} followers
   ⭐ ${smartFollowers} smart followers\n\n`;
    });
    
    return response.trim();
  } catch (error) {
    console.error('Error formatting endpoint3 response:', error);
    return 'Error formatting followers data';
  }
}

function formatEndpoint2Response(data: any): string {
  try {
    const tweets = data.result || [];
    
    if (tweets.length === 0) {
      return '❌ No tweets data found';
    }
    
    let response = `🐦 Top Tweets (${tweets.length}):\n\n`;
    
    tweets.forEach((tweet: any, index: number) => {
      const body = tweet.body || 'N/A';
      const createTime = tweet.tweet_create_time || 'N/A';
      const viewCount = tweet.view_count || 'N/A';
      const likeCount = tweet.like_count || 'N/A';
      const replyCount = tweet.reply_count || 'N/A';
      const retweetCount = tweet.retweet_count || 'N/A';
      const category = tweet.tweet_category || 'N/A';
      
      const truncatedBody = body.length > 200 ? body.substring(0, 200) + '...' : body;
      
      response += `${index + 1}. 📝 ${truncatedBody}
   📅 ${createTime}
   👀 ${viewCount} views
   ❤️ ${likeCount} likes
   💬 ${replyCount} replies
   🔄 ${retweetCount} retweets
   🏷️ ${category}\n\n`;
    });
    
    return response.trim();
  } catch (error) {
    console.error('Error formatting endpoint2 response:', error);
    return 'Error formatting tweets data';
  }
}

export class XMTPService {
  private client: Client | null = null;
  private isRunning = false;
  private model: any;

  constructor() {
    const { GOOGLE_API_KEY } = validateEnvironment(["GOOGLE_API_KEY"]);
    const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
    this.model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  }

  async start() {
    if (this.isRunning) {
      console.log("XMTP Service is already running");
      return;
    }

    const { WALLET_KEY, ENCRYPTION_KEY, XMTP_ENV } = validateEnvironment([
      "WALLET_KEY",
      "ENCRYPTION_KEY", 
      "XMTP_ENV",
    ]);

    const signer = createSigner(WALLET_KEY);
    const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

    this.client = await Client.create(signer, {
      dbEncryptionKey,
      env: XMTP_ENV as XmtpEnv,
    });

    void logAgentDetails(this.client);

    console.log("✓ Syncing conversations...");
    await this.client.conversations.sync();

    this.isRunning = true;
    console.log("✓ XMTP Service started, listening for messages...");

    this.startMessageListener();
  }

  private async startMessageListener() {
    if (!this.client) return;

    const stream = await this.client.conversations.streamAllMessages();

    for await (const message of stream) {
      if (!this.isRunning) break;

      if (
        message?.senderInboxId.toLowerCase() === this.client.inboxId.toLowerCase() ||
        message?.contentType?.typeId !== "text"
      ) {
        continue;
      }

      const conversation = await this.client.conversations.getConversationById(
        message.conversationId,
      );

      if (!conversation) {
        console.log("Unable to find conversation, skipping");
        continue;
      }

      const inboxState = await this.client.preferences.inboxStateFromInboxIds([
        message.senderInboxId,
      ]);
      const addressFromInboxId = inboxState[0].identifiers[0].identifier;
      
      const messageContent = typeof message.content === 'string' ? message.content : '';
      if (!messageContent) {
        console.log('Received message with no content, skipping');
        continue;
      }

      console.log(`Received message from ${addressFromInboxId}: ${messageContent}`);
      
      // Add to message store
      const incomingMessage: Message = {
        id: `msg_${Date.now()}_${Math.random()}`,
        sender: addressFromInboxId,
        content: messageContent,
        timestamp: new Date(),
        type: 'incoming',
        conversationId: message.conversationId
      };

      messageStore.addMessage(incomingMessage, message.conversationId, addressFromInboxId);
      
      try {
        const selectedEndpoint = await decideApiEndpoint(messageContent, this.model);
        console.log(`Selected endpoint: ${selectedEndpoint}`);
        
        const authorHandle = await extractAuthorHandle(messageContent, this.model);
        const apiResponse = await makeApiCall(selectedEndpoint, authorHandle);
        
        console.log(`Sending response to ${addressFromInboxId}...`);
        
        let responseMessage: string;
        
        if (apiResponse.data && !apiResponse.error) {
          const data = apiResponse.data;
          
          if (selectedEndpoint === 'endpoint1') {
            responseMessage = formatEndpoint1Response(data);
          } else if (selectedEndpoint === 'endpoint2') {
            responseMessage = formatEndpoint2Response(data);
          } else if (selectedEndpoint === 'endpoint3') {
            responseMessage = formatEndpoint3Response(data);
          } else {
            responseMessage = JSON.stringify(apiResponse, null, 2);
          }
        } else {
          responseMessage = JSON.stringify(apiResponse, null, 2);
        }
        
        await conversation.send(responseMessage);

        // Add response to message store
        const outgoingMessage: Message = {
          id: `msg_${Date.now()}_${Math.random()}`,
          sender: 'Agent',
          content: responseMessage,
          timestamp: new Date(),
          type: 'outgoing',
          conversationId: message.conversationId
        };

        messageStore.addMessage(outgoingMessage, message.conversationId, addressFromInboxId);

      } catch (error) {
        console.error('Error:', error);
        await conversation.send(JSON.stringify({ error: 'Failed to process request' }, null, 2));
      }
    }
  }

  async sendMessage(conversationId: string, content: string) {
    if (!this.client) {
      throw new Error('XMTP client is not initialized');
    }

    const conversation = await this.client.conversations.getConversationById(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    await conversation.send(content);
    
    // Add to message store
    const messageId = `msg_${Date.now()}_${Math.random()}`;
    messageStore.markOutgoingMessage(conversationId, messageId, content);
  }

  stop() {
    this.isRunning = false;
    console.log("✓ XMTP Service stopped");
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      clientConnected: !!this.client
    };
  }
}

export const xmtpService = new XMTPService(); 