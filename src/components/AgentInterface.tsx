import React, { useState, useEffect, useRef } from 'react';
import { useWallet } from '../walletContext';
import type { Conversation, Message } from '../messageStore';

interface TestMessage {
  id: string;
  type: 'user' | 'agent';
  content: string;
  timestamp: Date;
}

export default function AgentInterface() {
  const { isConnected, address, disconnectWallet } = useWallet();
  
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

  // Function to detect and render images in messages
  const renderMessageContent = (content: string) => {
    // Regular expression to detect image URLs
    const imageUrlRegex = /(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp|svg)(?:\?[^\s]*)?)/gi;
    const parts = content.split(imageUrlRegex);
    
    return parts.map((part, index) => {
      if (imageUrlRegex.test(part)) {
        imageUrlRegex.lastIndex = 0; // Reset regex for next use
        return (
          <div key={index} className="my-2">
            <img 
              src={part} 
              alt="Shared image" 
              className="rounded-lg shadow-sm border border-accent-gray object-cover"
              style={{ width: '200px', height: '200px' }}
              onError={(e) => {
                // Fallback to showing URL if image fails to load
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerHTML = `<a href="${part}" target="_blank" rel="noopener noreferrer" class="text-primary-orange underline break-all">${part}</a>`;
              }}
            />
          </div>
        );
      }
      return part;
    });
  };

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

  return (
    <div className="min-h-screen bg-secondary-black text-text-white">
      {/* Header */}
      <div className="border-b border-accent-gray bg-secondary-gray p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-orange to-primary-orange-dark rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7v10c0 5.55 3.84 9.739 9 11 5.16-1.261 9-5.45 9-11V7l-10-5z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold gradient-text">Snappy</h1>
              <p className="text-sm text-text-gray">Connected as {address?.slice(0, 6)}...{address?.slice(-4)}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {!serviceStatus.isRunning ? (
              <button
                onClick={startService}
                disabled={xmtpLoading}
                className="btn-primary flex items-center space-x-2"
              >
                {xmtpLoading ? (
                  <>
                    <div className="loading-spinner"></div>
                    <span>Starting...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.5a1.5 1.5 0 011.5 1.5v1.5m-3 0H6a2 2 0 01-2-2V8a2 2 0 012-2h12a2 2 0 012 2v3a2 2 0 01-2 2h-1.5m-3 0v1.5a1.5 1.5 0 01-1.5 1.5H9v-1.5" />
                    </svg>
                    <span>Start Snappy</span>
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={stopService}
                disabled={xmtpLoading}
                className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg font-medium disabled:opacity-50 transition-colors flex items-center space-x-2"
              >
                {xmtpLoading ? (
                  <>
                    <div className="loading-spinner"></div>
                    <span>Stopping...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6v4H9z" />
                    </svg>
                    <span>Stop Snappy</span>
                  </>
                )}
              </button>
            )}
            
            <button
              onClick={disconnectWallet}
              className="btn-secondary"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Sidebar */}
        <div className="w-1/3 bg-secondary-gray border-r border-accent-gray flex flex-col">
          {/* Section Navigation */}
          <div className="flex border-b border-accent-gray">
            <button
              onClick={() => setActiveSection('test')}
              className={`flex-1 py-4 px-6 text-sm font-medium transition-colors ${
                activeSection === 'test'
                  ? 'bg-primary-orange text-white'
                  : 'text-text-gray hover:text-primary-orange hover:bg-accent-gray'
              }`}
            >
              💬 Chat Now
            </button>
            <button
              onClick={() => setActiveSection('xmtp')}
              className={`flex-1 py-4 px-6 text-sm font-medium transition-colors ${
                activeSection === 'xmtp'
                  ? 'bg-primary-orange text-white'
                  : 'text-text-gray hover:text-primary-orange hover:bg-accent-gray'
              }`}
            >
              📝 Conversation History
            </button>
          </div>

          {/* Section Content */}
          {activeSection === 'test' ? (
            <div className="flex-1 flex flex-col">
              <div className="p-6 border-b border-accent-gray">
                <div className="text-sm font-medium text-text-white mb-2">🤖 Direct Agent Chat</div>
                <div className="text-xs text-text-gray">
                  Chat with Snappy directly. Try asking about social media profiles, Web3 topics, or general questions.
                </div>
              </div>
              <div className="flex-1 p-6">
                <div className="text-center text-text-gray">
                  <div className="mb-4 text-2xl">⚡</div>
                  <div className="text-sm font-medium mb-4">Instant Agent Responses</div>
                  <div className="text-xs text-text-gray space-y-2">
                    <div className="bg-accent-gray p-2 rounded">• "Show me @vitalik profile"</div>
                    <div className="bg-accent-gray p-2 rounded">• "What are @elonmusk's top tweets?"</div>
                    <div className="bg-accent-gray p-2 rounded">• "Who follows @naval?"</div>
                    <div className="bg-accent-gray p-2 rounded">• "What is Web3?"</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              {/* Service Status */}
              <div className="p-6 border-b border-accent-gray">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${serviceStatus.isRunning ? 'bg-green-400' : 'bg-red-400'}`}></div>
                  <span className="text-sm font-medium text-text-white">
                    {serviceStatus.isRunning ? 'Snappy Online' : 'Snappy Offline'}
                  </span>
                </div>
                {serviceStatus.isRunning && (
                  <div className="mt-3 text-xs text-green-400 bg-green-900/20 p-3 rounded">
                    ✓ Snappy ready to receive and respond to XMTP messages
                  </div>
                )}
              </div>



              {/* Conversations List */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-4 border-b border-accent-gray">
                  <div className="text-xs font-medium text-text-gray uppercase tracking-wide">
                    XMTP Conversations
                  </div>
                </div>
                {conversations.length === 0 ? (
                  <div className="p-6 text-text-gray text-center text-sm">
                    {serviceStatus.isRunning ? (
                      <div>
                        <div className="mb-2 text-2xl">💬</div>
                        <div className="mb-2">No conversations yet</div>
                        <div className="text-xs text-text-gray">
                          Others can message Snappy at your Ethereum address
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="mb-2 text-2xl">⚠️</div>
                        <div>Start Snappy to receive messages</div>
                      </div>
                    )}
                  </div>
                ) : (
                  conversations.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => setSelectedConversation(conv.id)}
                      className={`p-4 border-b border-accent-gray cursor-pointer hover:bg-accent-gray transition-colors ${
                        selectedConversation === conv.id ? 'bg-primary-orange/20 border-l-4 border-l-primary-orange' : ''
                      }`}
                    >
                      <div className="font-medium text-sm text-text-white">
                        {conv.participantAddress.slice(0, 6)}...{conv.participantAddress.slice(-4)}
                      </div>
                      <div className="text-xs text-text-gray mt-1">
                        {conv.messages.length} messages
                      </div>
                      <div className="text-xs text-text-gray">
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
              {/* Chat Header */}
              <div className="bg-secondary-gray border-b border-accent-gray p-6">
                <h2 className="font-medium flex items-center gap-2">
                  💬 Chat with Snappy
                  <span className="text-sm text-text-gray">
                    • Direct AI Interaction
                  </span>
                </h2>
              </div>

              {/* Test Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {testMessages.length === 0 ? (
                  <div className="text-center text-text-gray mt-8">
                    <div className="text-6xl mb-6">🧪</div>
                    <h3 className="text-xl font-semibold mb-4">Chat with Snappy</h3>
                    <p className="text-text-gray mb-8">
                      Start a conversation with Snappy and experience AI-powered responses instantly.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                      <div className="bg-accent-gray p-4 rounded-lg">
                        <code className="text-primary-orange">"Show me @vitalik profile"</code>
                      </div>
                      <div className="bg-accent-gray p-4 rounded-lg">
                        <code className="text-primary-orange">"What are @elonmusk's latest tweets?"</code>
                      </div>
                      <div className="bg-accent-gray p-4 rounded-lg">
                        <code className="text-primary-orange">"Who follows @naval?"</code>
                      </div>
                      <div className="bg-accent-gray p-4 rounded-lg">
                        <code className="text-primary-orange">"What is Web3?"</code>
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
                        className={`message-bubble ${
                          message.type === 'user' ? 'message-user' : 'message-agent'
                        }`}
                      >
                        <div className="text-sm whitespace-pre-wrap">{renderMessageContent(message.content)}</div>
                        <div className="text-xs mt-2 opacity-70">
                          {message.type === 'user' ? 'You' : 'Snappy'} • {new Date(message.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                {testLoading && (
                  <div className="flex justify-start">
                    <div className="message-bubble message-agent">
                      <div className="flex items-center space-x-3">
                        <div className="loading-spinner"></div>
                        <div className="text-sm">Snappy is processing...</div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={testMessagesEndRef} />
              </div>

              {/* Test Input */}
              <div className="bg-secondary-gray border-t border-accent-gray p-6">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newTestMessage}
                    onChange={(e) => setNewTestMessage(e.target.value)}
                    placeholder="Chat with Snappy... (e.g., 'Show me @vitalik profile')"
                    className="input-field"
                    onKeyPress={(e) => e.key === 'Enter' && !testLoading && sendTestMessage()}
                    disabled={testLoading}
                  />
                  <button
                    onClick={sendTestMessage}
                    disabled={!newTestMessage.trim() || testLoading}
                    className="btn-primary"
                  >
                    {testLoading ? (
                      <div className="loading-spinner"></div>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    )}
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
                  <div className="bg-secondary-gray border-b border-accent-gray p-6">
                    <h2 className="font-medium flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-primary-orange to-primary-orange-dark rounded-full flex items-center justify-center text-white text-sm font-bold">
                        {selectedConv.participantAddress.slice(2, 4).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-text-white">{selectedConv.participantAddress.slice(0, 6)}...{selectedConv.participantAddress.slice(-4)}</div>
                        <div className="text-xs text-text-gray font-normal">XMTP Conversation</div>
                      </div>
                    </h2>
                    <p className="text-sm text-text-gray mt-2">{selectedConv.participantAddress}</p>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {selectedConv.messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.type === 'outgoing' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`message-bubble ${
                            message.type === 'outgoing' ? 'message-user' : 'message-agent'
                          }`}
                        >
                          <div className="text-sm whitespace-pre-wrap">{renderMessageContent(message.content)}</div>
                          <div className="text-xs mt-2 opacity-70">
                            {message.type === 'outgoing' ? 'Snappy' : 'User'} • {new Date(message.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input */}
                  <div className="bg-secondary-gray border-t border-accent-gray p-6">
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message to respond via XMTP..."
                        className="input-field"
                        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                      />
                      <button
                        onClick={sendMessage}
                        disabled={!newMessage.trim()}
                        className="btn-primary"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-text-gray">
                  <div className="text-center max-w-md">
                    <div className="text-6xl mb-6">📨</div>
                    <h3 className="text-xl font-semibold mb-4">Snappy Network Agent</h3>
                    <p className="text-text-gray mb-6">
                      Your agent is ready to handle decentralized XMTP conversations.
                      {serviceStatus.isRunning ? ' It will automatically respond to incoming messages.' : ' Start the agent to begin receiving messages.'}
                    </p>
                    <div className="bg-accent-gray p-6 rounded-lg text-left">
                      <div className="text-sm font-medium text-text-white mb-3">Network Features:</div>
                      <div className="text-sm text-text-gray space-y-2">
                        <div className="flex items-center space-x-2">
                          <div className="w-1 h-1 bg-primary-orange rounded-full"></div>
                          <span>End-to-end encrypted messaging</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-1 h-1 bg-primary-orange rounded-full"></div>
                          <span>Automatic AI responses</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-1 h-1 bg-primary-orange rounded-full"></div>
                          <span>Social media analysis</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-1 h-1 bg-primary-orange rounded-full"></div>
                          <span>Decentralized identity verification</span>
                        </div>
                      </div>
                    </div>
                    {!serviceStatus.isRunning && (
                      <div className="mt-6 text-sm text-yellow-400 bg-yellow-900/20 p-4 rounded-lg">
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
    </div>
  );
} 