import React, { useState, useEffect, useRef } from 'react';
import { useWallet } from '../src/walletContext';
import type { Conversation, Message } from '../src/messageStore';

interface TestMessage {
  id: string;
  type: 'user' | 'agent';
  content: string;
  timestamp: Date;
}

export default function Home() {
  const { isConnected, address, connectWallet, disconnectWallet, isLoading } = useWallet();
  
  // XMTP related state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [serviceStatus, setServiceStatus] = useState({ isRunning: false, clientConnected: false });
  const [xmtpLoading, setXmtpLoading] = useState(false);
  
  // Test Agent state
  const [testMessages, setTestMessages] = useState<TestMessage[]>([]);
  const [newTestMessage, setNewTestMessage] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<'test' | 'xmtp'>('test');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const testMessagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    testMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversations, selectedConversation, testMessages]);

  // XMTP functionality - only when authenticated
  useEffect(() => {
    if (isConnected && activeSection === 'xmtp') {
      fetchConversations();
      fetchServiceStatus();
      const interval = setInterval(() => {
        fetchConversations();
        fetchServiceStatus();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isConnected, activeSection]);

  const sendTestMessage = async () => {
    if (!newTestMessage.trim() || testLoading || !address) return;

    const userMessage: TestMessage = {
      id: `user_${Date.now()}`,
      type: 'user',
      content: newTestMessage.trim(),
      timestamp: new Date()
    };

    setTestMessages(prev => [...prev, userMessage]);
    const messageToSend = newTestMessage.trim();
    setNewTestMessage('');
    setTestLoading(true);

    try {
      const response = await fetch('/api/test-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageToSend,
          address: address
        })
      });

      if (response.ok) {
        const data = await response.json();
        const agentMessage: TestMessage = {
          id: `agent_${Date.now()}`,
          type: 'agent',
          content: data.response,
          timestamp: new Date(data.timestamp)
        };
        setTestMessages(prev => [...prev, agentMessage]);
      } else {
        const errorMessage: TestMessage = {
          id: `error_${Date.now()}`,
          type: 'agent',
          content: 'Sorry, I encountered an error processing your message.',
          timestamp: new Date()
        };
        setTestMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Error testing agent:', error);
      const errorMessage: TestMessage = {
        id: `error_${Date.now()}`,
        type: 'agent',
        content: 'Sorry, I encountered an error processing your message.',
        timestamp: new Date()
      };
      setTestMessages(prev => [...prev, errorMessage]);
    } finally {
      setTestLoading(false);
    }
  };

  const fetchConversations = async () => {
    try {
      const response = await fetch('/api/conversations');
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  const fetchServiceStatus = async () => {
    try {
      const response = await fetch('/api/status');
      if (response.ok) {
        const data = await response.json();
        setServiceStatus(data);
      }
    } catch (error) {
      console.error('Error fetching service status:', error);
    }
  };

  const startService = async () => {
    setXmtpLoading(true);
    try {
      const response = await fetch('/api/start', { method: 'POST' });
      if (response.ok) {
        setTimeout(() => fetchServiceStatus(), 1000);
      }
    } catch (error) {
      console.error('Error starting service:', error);
    } finally {
      setXmtpLoading(false);
    }
  };

  const stopService = async () => {
    setXmtpLoading(true);
    try {
      const response = await fetch('/api/stop', { method: 'POST' });
      if (response.ok) {
        setTimeout(() => fetchServiceStatus(), 1000);
      }
    } catch (error) {
      console.error('Error stopping service:', error);
    } finally {
      setXmtpLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      const response = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConversation,
          content: newMessage.trim()
        })
      });

      if (response.ok) {
        setNewMessage('');
        setTimeout(() => fetchConversations(), 500);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const selectedConv = conversations.find(c => c.id === selectedConversation);

  // Render wallet connection screen if not connected
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">XMTP Agent</h1>
            <p className="text-gray-600 mb-6">
              Connect your MetaMask wallet to authenticate and start using the XMTP AI agent for secure, decentralized messaging.
            </p>
            <div className="bg-blue-50 p-4 rounded-lg mb-6 text-left">
              <h3 className="font-medium text-blue-900 mb-2">What you'll get access to:</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Test your AI agent directly in the web interface</li>
                <li>• AI-powered conversations via XMTP network</li>
                <li>• End-to-end encrypted messaging</li>
                <li>• Social media profile analysis</li>
                <li>• Decentralized chat with other users</li>
              </ul>
            </div>
            <button
              onClick={connectWallet}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3 px-6 rounded-lg font-medium hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Connecting...
                </div>
              ) : (
                'Connect MetaMask to Continue'
              )}
            </button>
            <p className="text-xs text-gray-500 mt-4">
              Make sure you have MetaMask installed and unlocked
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-1/3 bg-white border-r border-gray-300 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-4">
          <h1 className="text-xl font-bold">XMTP Agent</h1>
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-400"></div>
              <span className="text-sm">Authenticated</span>
            </div>
            <button
              onClick={disconnectWallet}
              className="text-xs bg-white bg-opacity-20 hover:bg-opacity-30 px-2 py-1 rounded transition-colors"
            >
              Disconnect
            </button>
          </div>
          <div className="mt-2 text-sm opacity-90">
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </div>
        </div>

        {/* Section Navigation */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveSection('test')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeSection === 'test'
                ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            🧪 Test Agent
          </button>
          <button
            onClick={() => setActiveSection('xmtp')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeSection === 'xmtp'
                ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            📨 XMTP Network
          </button>
        </div>

        {/* Section Content */}
        {activeSection === 'test' ? (
          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <div className="text-sm font-medium text-gray-800 mb-2">🤖 Direct Agent Chat</div>
              <div className="text-xs text-gray-600">
                Test your agent's AI capabilities directly. Try asking about social media profiles, Web3 topics, or general questions.
              </div>
            </div>
            <div className="flex-1 p-4">
              <div className="text-center text-gray-500">
                <div className="mb-2">⚡</div>
                <div className="text-sm font-medium">Instant Agent Responses</div>
                <div className="text-xs text-gray-400 mt-2 space-y-1">
                  <div>• "Show me @vitalik profile"</div>
                  <div>• "What are @elonmusk's top tweets?"</div>
                  <div>• "Who follows @naval?"</div>
                  <div>• "What is Web3?"</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            {/* XMTP Service Controls */}
            <div className="p-4 border-b border-gray-200">
              {!serviceStatus.isRunning ? (
                <button
                  onClick={startService}
                  disabled={xmtpLoading}
                  className="w-full bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600 disabled:opacity-50 transition-colors"
                >
                  {xmtpLoading ? 'Starting...' : 'Start XMTP Agent'}
                </button>
              ) : (
                <button
                  onClick={stopService}
                  disabled={xmtpLoading}
                  className="w-full bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600 disabled:opacity-50 transition-colors"
                >
                  {xmtpLoading ? 'Stopping...' : 'Stop XMTP Agent'}
                </button>
              )}
              <div className="mt-2 flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${serviceStatus.isRunning ? 'bg-green-400' : 'bg-red-400'}`}></div>
                <span className="text-xs text-gray-600">
                  {serviceStatus.isRunning ? 'XMTP Agent Online' : 'XMTP Agent Offline'}
                </span>
              </div>
              {serviceStatus.isRunning && (
                <div className="mt-2 text-xs text-green-600 bg-green-50 p-2 rounded">
                  ✓ Agent ready to receive and respond to XMTP messages
                </div>
              )}
            </div>

            {/* Agent Info */}
            <div className="p-4 border-b border-gray-200">
              <div className="text-sm font-medium text-gray-800 mb-2">📡 Network Agent</div>
              <div className="text-xs text-gray-600">
                Handles decentralized messages from other XMTP users automatically.
              </div>
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-3 border-b border-gray-100 bg-gray-50">
                <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                  XMTP Conversations
                </div>
              </div>
              {conversations.length === 0 ? (
                <div className="p-4 text-gray-500 text-center text-sm">
                  {serviceStatus.isRunning ? (
                    <div>
                      <div className="mb-2">💬</div>
                      <div>No conversations yet</div>
                      <div className="text-xs text-gray-400 mt-1">
                        Others can message your agent at your Ethereum address
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="mb-2">⚠️</div>
                      <div>Start the agent to receive messages</div>
                    </div>
                  )}
                </div>
              ) : (
                conversations.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => setSelectedConversation(conv.id)}
                    className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedConversation === conv.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                    }`}
                  >
                    <div className="font-medium text-sm text-gray-800">
                      {conv.participantAddress.slice(0, 6)}...{conv.participantAddress.slice(-4)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {conv.messages.length} messages
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(conv.lastActivity).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {activeSection === 'test' ? (
          <>
            {/* Test Agent Header */}
            <div className="bg-white border-b border-gray-300 p-4">
              <h2 className="font-medium flex items-center gap-2">
                🧪 Agent Testing Environment
                <span className="text-sm text-gray-500">
                  • Direct AI Interaction
                </span>
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Test your agent's capabilities without XMTP network dependencies
              </p>
            </div>

            {/* Test Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {testMessages.length === 0 ? (
                <div className="text-center text-gray-500 mt-8">
                  <div className="text-4xl mb-4">🧪</div>
                  <h3 className="text-lg font-medium mb-2">Test Your AI Agent</h3>
                  <p className="text-sm mb-4">
                    Start a conversation to test your agent's AI capabilities instantly.
                  </p>
                  <div className="bg-gray-50 p-4 rounded-lg text-left max-w-md mx-auto">
                    <div className="text-xs font-medium text-gray-700 mb-2">Try these examples:</div>
                    <div className="text-xs text-gray-600 space-y-2">
                      <div className="bg-white p-2 rounded border">
                        <code>"Show me @vitalik profile"</code>
                      </div>
                      <div className="bg-white p-2 rounded border">
                        <code>"What are @elonmusk's latest tweets?"</code>
                      </div>
                      <div className="bg-white p-2 rounded border">
                        <code>"Who follows @naval?"</code>
                      </div>
                      <div className="bg-white p-2 rounded border">
                        <code>"What is Web3?"</code>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                testMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.type === 'user'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-800'
                      }`}
                    >
                      <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                      <div className={`text-xs mt-1 ${
                        message.type === 'user' ? 'text-blue-100' : 'text-gray-500'
                      }`}>
                        {message.type === 'user' ? 'You' : 'Agent'} • {new Date(message.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
              {testLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <div className="animate-pulse">🤖</div>
                      <div className="text-sm">Agent is processing...</div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={testMessagesEndRef} />
            </div>

            {/* Test Input */}
            <div className="bg-white border-t border-gray-300 p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTestMessage}
                  onChange={(e) => setNewTestMessage(e.target.value)}
                  placeholder="Test your agent... (e.g., 'Show me @vitalik profile')"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyPress={(e) => e.key === 'Enter' && !testLoading && sendTestMessage()}
                  disabled={testLoading}
                />
                <button
                  onClick={sendTestMessage}
                  disabled={!newTestMessage.trim() || testLoading}
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {testLoading ? '...' : 'Test'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* XMTP Chat Area */}
            {selectedConv ? (
              <>
                {/* Chat Header */}
                <div className="bg-white border-b border-gray-300 p-4">
                  <h2 className="font-medium flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                      {selectedConv.participantAddress.slice(2, 4).toUpperCase()}
                    </div>
                    <div>
                      <div>{selectedConv.participantAddress.slice(0, 6)}...{selectedConv.participantAddress.slice(-4)}</div>
                      <div className="text-xs text-gray-500 font-normal">XMTP Conversation</div>
                    </div>
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">{selectedConv.participantAddress}</p>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {selectedConv.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.type === 'outgoing' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          message.type === 'outgoing'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 text-gray-800'
                        }`}
                      >
                        <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                        <div className={`text-xs mt-1 ${
                          message.type === 'outgoing' ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          {message.type === 'outgoing' ? 'Agent' : 'User'} • {new Date(message.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <div className="bg-white border-t border-gray-300 p-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message to respond via XMTP..."
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!newMessage.trim()}
                      className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center max-w-md">
                  <div className="text-4xl mb-4">📨</div>
                  <h3 className="text-lg font-medium mb-2">XMTP Network Agent</h3>
                  <p className="text-sm mb-4">
                    Your agent is ready to handle decentralized XMTP conversations.
                    {serviceStatus.isRunning ? ' It will automatically respond to incoming messages.' : ' Start the agent to begin receiving messages.'}
                  </p>
                  <div className="bg-gray-50 p-4 rounded-lg text-left">
                    <div className="text-xs font-medium text-gray-700 mb-2">Network Features:</div>
                    <div className="text-xs text-gray-600 space-y-1">
                      <div>• End-to-end encrypted messaging</div>
                      <div>• Automatic AI responses</div>
                      <div>• Social media analysis</div>
                      <div>• Decentralized identity verification</div>
                    </div>
                  </div>
                  {!serviceStatus.isRunning && (
                    <div className="mt-4 text-xs text-amber-600 bg-amber-50 p-2 rounded">
                      ⚠️ Start the XMTP agent to receive and respond to network messages
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
} 