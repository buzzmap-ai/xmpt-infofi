interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: Date;
  type: 'incoming' | 'outgoing';
  conversationId?: string;
}

interface Conversation {
  id: string;
  participantAddress: string;
  messages: Message[];
  lastActivity: Date;
}

class MessageStore {
  private conversations: Map<string, Conversation> = new Map();
  private listeners: Set<(conversations: Conversation[]) => void> = new Set();

  addMessage(message: Message, conversationId: string, participantAddress: string) {
    if (!this.conversations.has(conversationId)) {
      this.conversations.set(conversationId, {
        id: conversationId,
        participantAddress,
        messages: [],
        lastActivity: new Date()
      });
    }

    const conversation = this.conversations.get(conversationId)!;
    conversation.messages.push(message);
    conversation.lastActivity = new Date();

    this.notifyListeners();
  }

  getConversations(): Conversation[] {
    return Array.from(this.conversations.values())
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
  }

  getConversation(id: string): Conversation | undefined {
    return this.conversations.get(id);
  }

  subscribe(listener: (conversations: Conversation[]) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    const conversations = this.getConversations();
    this.listeners.forEach(listener => listener(conversations));
  }

  // Method for sending messages from the web interface
  markOutgoingMessage(conversationId: string, messageId: string, content: string) {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      const message: Message = {
        id: messageId,
        sender: 'You',
        content,
        timestamp: new Date(),
        type: 'outgoing',
        conversationId
      };
      conversation.messages.push(message);
      conversation.lastActivity = new Date();
      this.notifyListeners();
    }
  }
}

export const messageStore = new MessageStore();
export type { Message, Conversation }; 