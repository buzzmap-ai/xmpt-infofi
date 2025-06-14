import React, { useState, useEffect, useRef } from 'react';
import { useWallet } from '../src/walletContext';
import type { Conversation, Message } from '../src/messageStore';
import Head from 'next/head';
import AgentInterface from '../src/components/AgentInterface';

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

  const [showAgent, setShowAgent] = useState(false);

  if (showAgent && isConnected) {
    return <AgentInterface />;
  }

  return (
    <>
      <Head>
        <title>Snappy - AI Agent for XMTP</title>
        <meta name="description" content="Meet Snappy, your intelligent AI agent for secure, decentralized communication on XMTP network." />
        <link rel="icon" href="/favicon.svg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </Head>

      <div className="min-h-screen bg-secondary-black text-text-white">
        {/* Navigation */}
        <nav className="border-b border-accent-gray bg-secondary-black/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-primary-orange to-primary-orange-dark rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L2 7v10c0 5.55 3.84 9.739 9 11 5.16-1.261 9-5.45 9-11V7l-10-5z"/>
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold gradient-text">Snappy</h1>
                  <p className="text-xs text-text-gray">InfoFi Agent</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                {isConnected ? (
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-text-gray">
                        {address?.slice(0, 6)}...{address?.slice(-4)}
                      </span>
                    </div>
                    <button
                      onClick={disconnectWallet}
                      className="btn-secondary text-sm"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={connectWallet}
                    disabled={isLoading}
                    className="btn-primary"
                  >
                    {isLoading ? (
                      <div className="flex items-center space-x-2">
                        <div className="loading-spinner"></div>
                        <span>Connecting...</span>
                      </div>
                    ) : (
                      'Connect Wallet'
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="hero-gradient py-20 lg:py-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center fade-in">
              <div className="inline-flex items-center px-4 py-2 bg-secondary-gray/50 rounded-full text-sm text-text-gray mb-8">
                <span className="w-2 h-2 bg-primary-orange rounded-full mr-2"></span>
                Powered by XMTP Protocol
              </div>
              
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
                Meet{' '}
                <span className="gradient-text">Snappy</span>
              </h1>
              
              <p className="text-xl md:text-2xl text-text-gray mb-8 max-w-4xl mx-auto leading-relaxed">
                InfoFi agent for secure, decentralized conversations on XMTP. 
                Connect your wallet and start chatting with Snappy today.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
                {isConnected ? (
                  <button
                    onClick={() => setShowAgent(true)}
                    className="btn-primary text-lg px-8 py-4 flex items-center space-x-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span>Start Conversation</span>
                  </button>
                ) : (
                  <button
                    onClick={connectWallet}
                    disabled={isLoading}
                    className="btn-primary text-lg px-8 py-4 flex items-center space-x-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span>{isLoading ? 'Connecting...' : 'Connect Wallet'}</span>
                  </button>
                )}
                
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 bg-secondary-gray/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Why Choose <span className="gradient-text">Snappy</span>?
              </h2>
              <p className="text-xl text-text-gray max-w-3xl mx-auto">
                Built on cutting-edge blockchain technology for secure, private, and intelligent conversations.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="card text-center slide-up">
                <div className="w-16 h-16 bg-gradient-to-br from-primary-orange to-primary-orange-dark rounded-xl flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-4">End-to-End Encrypted</h3>
                <p className="text-text-gray">
                  Your conversations are protected by military-grade encryption, ensuring complete privacy and security.
                </p>
              </div>
              
              <div className="card text-center slide-up" style={{ animationDelay: '0.2s' }}>
                <div className="w-16 h-16 bg-gradient-to-br from-primary-orange to-primary-orange-dark rounded-xl flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-4">Lightning Fast</h3>
                <p className="text-text-gray">
                  Experience instant responses powered by advanced AI technology and optimized blockchain infrastructure.
                </p>
              </div>
              
              <div className="card text-center slide-up" style={{ animationDelay: '0.4s' }}>
                <div className="w-16 h-16 bg-gradient-to-br from-primary-orange to-primary-orange-dark rounded-xl flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-4">Decentralized</h3>
                <p className="text-text-gray">
                  Built on XMTP protocol, ensuring no single point of failure and complete ownership of your data.
                </p>
              </div>
            </div>
          </div>
        </section>



        {/* Footer */}
        <footer className="border-t border-accent-gray py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="flex items-center space-x-3 mb-4 md:mb-0">
                <div className="w-8 h-8 bg-gradient-to-br from-primary-orange to-primary-orange-dark rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L2 7v10c0 5.55 3.84 9.739 9 11 5.16-1.261 9-5.45 9-11V7l-10-5z"/>
                  </svg>
                </div>
                <div>
                  <span className="font-semibold gradient-text">Snappy</span>
                  <p className="text-xs text-text-gray">InfoFi Agent</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-6 text-sm text-text-gray">
                <span>Powered by XMTP Protocol</span>
                <span>•</span>
                <span>Secure & Private</span>
                <span>•</span>
                <span>© 2024</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
} 