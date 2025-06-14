import {
  createSigner,
  getEncryptionKeyFromHex,
  logAgentDetails,
  validateEnvironment,
} from "./helpers/client";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";
import https from 'https';
import { GoogleGenerativeAI } from '@google/generative-ai';

/* Get the wallet key associated to the public key of
 * the agent and the encryption key for the local db
 * that stores your agent's messages */
const { WALLET_KEY, ENCRYPTION_KEY, XMTP_ENV, GOOGLE_API_KEY } = validateEnvironment([
  "WALLET_KEY",
  "ENCRYPTION_KEY",
  "XMTP_ENV",
  "GOOGLE_API_KEY",
]);

/* Create the signer using viem and parse the encryption key for the local db */
const signer = createSigner(WALLET_KEY);
const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

// Initialize Google AI
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Define your 3 API endpoints
const API_ENDPOINTS = {
  endpoint1: "https://api.cred.buzz/user/author-handle-details?author_handle=author_value",
  endpoint2: "https://api.cred.buzz/user/get-top-tweets?author_handle=author_value&interval=7day&sort_by=view_count_desc&limit=5",
  endpoint3: "https://api.cred.buzz/user/author-handle-followers?author_handle=author_value&sort_by=smart_followers_count_desc&limit=10&start=0",
};

async function decideApiEndpoint(userMessage: string): Promise<string> {
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
    
    // Validate the decision
    if (decision === 'endpoint1' || decision === 'endpoint2' || decision === 'endpoint3') {
      console.log(`AI decided to use: ${decision}`);
      return decision;
    } else {
      console.log(`AI gave unexpected response: ${decision}, defaulting to endpoint1`);
      return 'endpoint1';
    }
  } catch (error) {
    console.error('Error with AI decision making:', error);
    return 'endpoint1'; // Default fallback
  }
}

async function extractAuthorHandle(userMessage: string): Promise<string> {
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
    // Fallback: try to extract handle manually
    const words = userMessage.split(' ');
    for (const word of words) {
      if (word.startsWith('@')) {
        return word.substring(1);
      }
      // Look for common social media handle patterns
      if (word.match(/^[a-zA-Z0-9_]{3,}$/)) {
        return word;
      }
    }
    return userMessage.trim(); // Last resort fallback
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

    req.setTimeout(10000); // 10 second timeout
  });
}

function formatEndpoint1Response(data: any): string {
  try {
    const profileImageUrl = data.result.profile_image_url || 'N/A';
    const name = data.result.name || 'N/A';
    const authorHandle = data.result.author_handle || 'N/A';
    const bio = data.result.bio || 'N/A';
    const followersCount = data.result.followers_count || 'N/A';
    const tags = Array.isArray(data.result.tags) ? data.result.tags.join(', ') : (data.result.tags || 'N/A');
    
    return `${profileImageUrl}

👤 Name: ${name}
🏷️ Handle: ${authorHandle}
📝 Bio: ${bio}
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
      const profileImageUrl = follower.profile_image_url || 'N/A';
      const profileName = follower.profile_name || 'N/A';
      const handle = follower.handle || 'N/A';
      const tags = Array.isArray(follower.tags) ? follower.tags.join(', ') : (follower.tags || 'N/A');
      const followersCount = follower.followers_count || 'N/A';
      const smartFollowers = follower.smart_followers || 'N/A';
      
      response += `${index + 1}. ${profileImageUrl}
   👤 ${profileName}
   🏷️ @${handle}
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
    
    // Try to get profile image from first tweet's author data
    const profileImageUrl = tweets[0]?.profile_image_url || tweets[0]?.author_profile_image_url || 'N/A';
    
    let response = `${profileImageUrl}

🐦 Top Tweets (${tweets.length}):\n\n`;
    
    tweets.forEach((tweet: any, index: number) => {
      const body = tweet.body || 'N/A';
      const createTime = tweet.tweet_create_time || 'N/A';
      const viewCount = tweet.view_count || 'N/A';
      const likeCount = tweet.like_count || 'N/A';
      const replyCount = tweet.reply_count || 'N/A';
      const retweetCount = tweet.retweet_count || 'N/A';
      const category = tweet.tweet_category || 'N/A';
      
      // Truncate tweet body if too long
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

async function main() {
  const client = await Client.create(signer, {
    dbEncryptionKey,
    env: XMTP_ENV as XmtpEnv,
  });
  void logAgentDetails(client);

  console.log("✓ Syncing conversations...");
  await client.conversations.sync();

  console.log("Waiting for messages...");
  const stream = await client.conversations.streamAllMessages();

  for await (const message of stream) {
    if (
      message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
      message?.contentType?.typeId !== "text"
    ) {
      continue;
    }

    const conversation = await client.conversations.getConversationById(
      message.conversationId,
    );

    if (!conversation) {
      console.log("Unable to find conversation, skipping");
      continue;
    }

    const inboxState = await client.preferences.inboxStateFromInboxIds([
      message.senderInboxId,
    ]);
    const addressFromInboxId = inboxState[0].identifiers[0].identifier;
    
    // Get the message content
    const messageContent = typeof message.content === 'string' ? message.content : '';
    if (!messageContent) {
      console.log('Received message with no content, skipping');
      continue;
    }
    console.log(`Received message from ${addressFromInboxId}: ${messageContent}`);
    
    try {
      // Use AI to decide which API endpoint to call
      const selectedEndpoint = await decideApiEndpoint(messageContent);
      console.log(`Selected endpoint: ${selectedEndpoint}`);
      
      // Extract author handle from the message
      const authorHandle = await extractAuthorHandle(messageContent);
      
      // Make the API call to the selected endpoint
      const apiResponse = await makeApiCall(selectedEndpoint, authorHandle);
      
      // Send back the response
      console.log(`Sending response to ${addressFromInboxId}...`);
      console.log(`API Response: ${JSON.stringify(apiResponse, null, 2)}`);
      
      let responseMessage: string;
      
      // Format responses based on endpoint
      if (apiResponse.data && !apiResponse.error) {
        const data = apiResponse.data;
        console.log(`Data: ${JSON.stringify(data, null, 2)}`);
        
        if (selectedEndpoint === 'endpoint1') {
          responseMessage = formatEndpoint1Response(data);
        } else if (selectedEndpoint === 'endpoint2') {
          responseMessage = formatEndpoint2Response(data);
        } else if (selectedEndpoint === 'endpoint3') {
          responseMessage = formatEndpoint3Response(data);
        } else {
          // For other endpoints, send JSON response
          responseMessage = JSON.stringify(apiResponse, null, 2);
        }
      } else {
        // For errors, send JSON response
        responseMessage = JSON.stringify(apiResponse, null, 2);
      }
      
      await conversation.send(responseMessage);
    } catch (error) {
      console.error('Error:', error);
      await conversation.send(JSON.stringify({ error: 'Failed to process request' }, null, 2));
    }

    console.log("Waiting for messages...");
  }
}

main().catch(console.error);
