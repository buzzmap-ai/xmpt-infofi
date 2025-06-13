import React, { useState, useEffect, useRef } from 'react';
import type { Conversation, Message } from '../src/messageStore';

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [serviceStatus, setServiceStatus] = useState({ isRunning: false, clientConnected: false });
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversations, selectedConversation]);

  useEffect(() => {
    // Fetch initial data
    fetchConversations();
    fetchServiceStatus();

    // Poll for updates every 2 seconds
    const interval = setInterval(() => {
      fetchConversations();
      fetchServiceStatus();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

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
    setLoading(true);
    try {
      const response = await fetch('/api/start', { method: 'POST' });
      if (response.ok) {
        setTimeout(() => fetchServiceStatus(), 1000);
      }
    } catch (error) {
      console.error('Error starting service:', error);
    } finally {
      setLoading(false);
    }
  };

  const stopService = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/stop', { method: 'POST' });
      if (response.ok) {
        setTimeout(() => fetchServiceStatus(), 1000);
      }
    } catch (error) {
      console.error('Error stopping service:', error);
    } finally {
      setLoading(false);
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
        // Fetch conversations will update with the new message
        setTimeout(() => fetchConversations(), 500);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const selectedConv = conversations.find(c => c.id === selectedConversation);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-1/3 bg-white border-r border-gray-300 flex flex-col">
        {/* Header */}
        <div className="bg-blue-600 text-white p-4">
          <h1 className="text-xl font-bold">XMTP Agent</h1>
          <div className="mt-2 flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${serviceStatus.isRunning ? 'bg-green-400' : 'bg-red-400'}`}></div>
            <span className="text-sm">
              {serviceStatus.isRunning ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        {/* Service Controls */}
        <div className="p-4 border-b border-gray-200">
          {!serviceStatus.isRunning ? (
            <button
              onClick={startService}
              disabled={loading}
              className="w-full bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600 disabled:opacity-50"
            >
              {loading ? 'Starting...' : 'Start Agent'}
            </button>
          ) : (
            <button
              onClick={stopService}
              disabled={loading}
              className="w-full bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600 disabled:opacity-50"
            >
              {loading ? 'Stopping...' : 'Stop Agent'}
            </button>
          )}
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-4 text-gray-500 text-center">
              No conversations yet
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => setSelectedConversation(conv.id)}
                className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                  selectedConversation === conv.id ? 'bg-blue-50' : ''
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

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConv ? (
          <>
            {/* Chat Header */}
            <div className="bg-white border-b border-gray-300 p-4">
              <h2 className="font-medium">
                {selectedConv.participantAddress.slice(0, 6)}...{selectedConv.participantAddress.slice(-4)}
              </h2>
              <p className="text-sm text-gray-500">{selectedConv.participantAddress}</p>
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
                      {new Date(message.timestamp).toLocaleTimeString()}
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
                  placeholder="Type a message..."
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a conversation to start messaging
          </div>
        )}
      </div>
    </div>
  );
} 