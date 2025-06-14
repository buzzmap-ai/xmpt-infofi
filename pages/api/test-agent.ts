import { NextApiRequest, NextApiResponse } from 'next';
import { createSigner, validateEnvironment, getEncryptionKeyFromHex } from '../../src/helpers/client';
import { Client, type XmtpEnv } from "@xmtp/node-sdk";
import { generatePrivateKey } from 'viem/accounts';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, address } = req.body;

  if (!message || !address) {
    return res.status(400).json({ error: 'Message and address are required' });
  }

  try {
    console.log(`🚀 XMTP Test: Creating real XMTP DM conversation from ${address} to agent`);

    // Get environment variables for the agent
    console.log('Step 1: Loading environment variables...');
    const { WALLET_KEY, ENCRYPTION_KEY, XMTP_ENV } = validateEnvironment([
      "WALLET_KEY",
      "ENCRYPTION_KEY", 
      "XMTP_ENV",
    ]);
    console.log(`✓ Environment loaded (XMTP_ENV: ${XMTP_ENV})`);

    // Validate XMTP environment value
    const validEnvs = ['dev', 'production', 'local'];
    if (!validEnvs.includes(XMTP_ENV)) {
      throw new Error(`Invalid XMTP_ENV: ${XMTP_ENV}. Must be one of: ${validEnvs.join(', ')}`);
    }

    // Clean and validate wallet key (remove 0x prefix if present)
    const cleanWalletKey = WALLET_KEY.startsWith('0x') ? WALLET_KEY.slice(2) : WALLET_KEY;
    if (!/^[0-9a-fA-F]{64}$/.test(cleanWalletKey)) {
      throw new Error(`Invalid WALLET_KEY format. Must be 64 hexadecimal characters (with or without 0x prefix). Current length: ${cleanWalletKey.length}`);
    }

    // Create the agent's XMTP client to get its address
    console.log('Step 2: Creating agent XMTP client...');
    let agentClient;
    try {
      const agentSigner = createSigner(`0x${cleanWalletKey}`);
      const agentDbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);
      
      agentClient = await Client.create(agentSigner, {
        dbEncryptionKey: agentDbEncryptionKey,
        env: XMTP_ENV as XmtpEnv,
      });
      console.log(`✓ Agent XMTP client created successfully`);
    } catch (error: any) {
      console.error('❌ Failed to create agent XMTP client:', error);
      throw new Error(`Agent client creation failed: ${error.message}`);
    }

    const agentAddress = agentClient.accountIdentifier?.identifier;
    const agentInboxId = agentClient.inboxId;
    console.log(`✓ Agent address: ${agentAddress}`);
    console.log(`✓ Agent inbox ID: ${agentInboxId}`);

    if (!agentAddress || !agentInboxId) {
      throw new Error('Could not get agent wallet address or inbox ID from client');
    }

    // Create a temporary test user XMTP client 
    console.log('Step 3: Creating test user XMTP client...');
    let testUserClient;
    let testUserInboxId;
    try {
      const testUserPrivateKey = generatePrivateKey();
      const testUserSigner = createSigner(testUserPrivateKey);
      
      // Use a separate database for the test user
      const testUserDbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);
      
      testUserClient = await Client.create(testUserSigner, {
        dbEncryptionKey: testUserDbEncryptionKey,
        env: XMTP_ENV as XmtpEnv,
      });
      testUserInboxId = testUserClient.inboxId;
      console.log(`✓ Test user XMTP client created successfully`);
    } catch (error: any) {
      console.error('❌ Failed to create test user XMTP client:', error);
      throw new Error(`Test user client creation failed: ${error.message}`);
    }

    const testUserAddress = testUserClient.accountIdentifier?.identifier;
    console.log(`✓ Test user address: ${testUserAddress}`);
    console.log(`✓ Test user inbox ID: ${testUserInboxId}`);

    // Sync both clients to ensure they're ready
    console.log('Step 4: Syncing XMTP clients...');
    try {
      await Promise.all([
        agentClient.conversations.sync(),
        testUserClient.conversations.sync()
      ]);
      console.log('✓ Both clients synced successfully');
    } catch (error: any) {
      console.error('❌ Failed to sync XMTP clients:', error);
      throw new Error(`Client sync failed: ${error.message}`);
    }

    // Check if the agent can message the test user
    console.log('Step 5: Checking if addresses can message each other...');
    try {
      // Ensure we have valid addresses before checking
      if (agentAddress && testUserAddress) {
        console.log(`Checking canMessage for: agent=${agentAddress}, testUser=${testUserAddress}`);
        const canMessageResponse = await Client.canMessage([agentAddress, testUserAddress]);
        console.log('✓ Can message check:', {
          agent: canMessageResponse.get(agentAddress),
          testUser: canMessageResponse.get(testUserAddress)
        });
      } else {
        console.log('⚠️ Skipping canMessage check - missing addresses:', { 
          agentAddress: !!agentAddress, 
          testUserAddress: !!testUserAddress 
        });
      }
    } catch (error: any) {
      console.error('⚠️ Can message check failed (continuing anyway):', error.message);
      console.log('Debug info:', { 
        agentAddress, 
        testUserAddress,
        agentInboxId,
        testUserInboxId 
      });
    }

    // Create a DM conversation between test user and agent
    console.log('Step 6: Creating XMTP DM conversation...');
    let conversation;
    
    try {
      // Create a DM conversation with the agent using inbox ID
      conversation = await testUserClient.conversations.newDm(agentInboxId);
      console.log(`✓ XMTP DM conversation created: ${conversation.id}`);
    } catch (error: any) {
      console.error('❌ Error creating DM conversation:', error);
      throw new Error(`Failed to create XMTP DM conversation: ${error.message}`);
    }

    // Send the message through XMTP network
    console.log('Step 7: Sending message through XMTP network...');
    try {
      await conversation.send(message.trim());
      console.log(`✓ Message sent via XMTP: "${message}"`);
    } catch (error: any) {
      console.error('❌ Failed to send message:', error);
      throw new Error(`Message send failed: ${error.message}`);
    }

    // Wait for the agent to process and respond through XMTP
    console.log('Step 8: Waiting for agent response via XMTP...');
    let agentResponse: string | null = null;
    let attempts = 0;
    const maxAttempts = 3;
    const waitTime = 10000;

    while (attempts < maxAttempts && !agentResponse) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
      attempts++;
      
      try {
        await conversation.sync();
        const messages = await conversation.messages({ limit: 10 });
        
        console.log(`Attempt ${attempts}/${maxAttempts}: Found ${messages.length} messages`);
        
        for (const msg of messages) {
          if (msg.senderInboxId !== testUserClient.inboxId && 
              typeof msg.content === 'string' && 
              msg.content.trim() !== message.trim()) {
            agentResponse = msg.content;
            console.log(`✓ Agent responded via XMTP: "${agentResponse ? agentResponse.substring(0, 100) : 'null'}..."`);
            break;
          }
        }
        
        if (agentResponse) break;
        
        console.log(`⏳ Still waiting for agent response... (${attempts}/${maxAttempts})`);
      } catch (error: any) {
        console.error(`Error checking for response (attempt ${attempts}):`, error);
      }
    }

    if (agentResponse) {
      console.log('✅ XMTP Test completed successfully!');
      res.status(200).json({
        response: agentResponse,
        timestamp: new Date().toISOString(),
        method: 'xmtp-dm-real',
        testUserAddress: testUserAddress,
        testUserInboxId: testUserInboxId,
        agentAddress: agentAddress,
        agentInboxId: agentInboxId,
        conversationId: conversation.id,
        attempts: attempts,
        success: true,
        note: '🎉 This message was sent through the REAL XMTP network via DM! Your agent received it, processed it, and responded back through XMTP.'
      });
    } else {
      console.log(`⚠️ No response received after ${maxAttempts * waitTime / 1000} seconds`);
      res.status(200).json({
        response: `Message successfully sent to agent via XMTP DM! 

⚠️ However, no response was received within ${maxAttempts * waitTime / 1000} seconds. This could mean:

1. The XMTP agent is not running (check XMTP Network tab)
2. The agent is processing a complex request
3. Network delays in XMTP message delivery

✅ Your message was definitely sent through the real XMTP network to inbox ID: ${agentInboxId}

Check the XMTP Network tab to see if the conversation appears there.`,
        timestamp: new Date().toISOString(),
        method: 'xmtp-dm-real',
        testUserAddress: testUserAddress,
        testUserInboxId: testUserInboxId,
        agentAddress: agentAddress,
        agentInboxId: agentInboxId,
        conversationId: conversation.id,
        attempts: attempts,
        success: true,
        timeout: true,
        note: 'Message sent through real XMTP DM but response timed out. Check if XMTP agent is running.'
      });
    }

  } catch (error: any) {
    console.error('❌ XMTP Test error:', error);
    console.error('Error stack:', error.stack);
    
    // Provide more specific error guidance
    let errorGuidance = 'This is a real XMTP network integration using DM conversations. ';
    
    if (error.message.includes('transport error') || error.message.includes('GenericFailure')) {
      errorGuidance += `

🔍 XMTP Transport Error Troubleshooting:
1. Check your internet connection
2. Verify XMTP_ENV is set correctly (dev/production/local)
3. Ensure WALLET_KEY is a valid private key (64 hex characters)
4. Try switching XMTP_ENV between 'dev' and 'production'
5. Check if XMTP network is experiencing issues

Current XMTP_ENV: ${process.env.XMTP_ENV || 'not set'}
WALLET_KEY present: ${process.env.WALLET_KEY ? 'yes' : 'no'}
ENCRYPTION_KEY present: ${process.env.ENCRYPTION_KEY ? 'yes' : 'no'}`;
    } else if (error.message.includes('invalid hexadecimal digit')) {
      errorGuidance += `

🔍 Wallet Key Format Error:
Your WALLET_KEY appears to have formatting issues. Please ensure:
1. It's exactly 64 hexadecimal characters (0-9, a-f, A-F)
2. Remove any '0x' prefix if present
3. No spaces or special characters

Current WALLET_KEY format: ${process.env.WALLET_KEY ? `${process.env.WALLET_KEY.length} characters` : 'not set'}`;
    }
    
    res.status(500).json({ 
      error: 'Failed to send message via XMTP network',
      details: error.message,
      errorName: error.name,
      errorType: error.message.includes('transport error') ? 'TRANSPORT_ERROR' : 
                error.message.includes('invalid hexadecimal digit') ? 'WALLET_KEY_FORMAT_ERROR' : 
                error.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      guidance: errorGuidance
    });
  }
} 
