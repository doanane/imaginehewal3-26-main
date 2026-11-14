// front/contexts/MessagingContext.tsx
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import messagingService, { Conversation, Message, WebSocketMessage } from '../services/messaging';
import { useAuth } from './AuthContext';

interface MessagingContextType {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  isConnected: boolean;
  isLoading: boolean;
  unreadCount: number;
  
  selectConversation: (conversation: Conversation) => Promise<void>;
  sendMessage: (receiverId: number, content: string) => Promise<void>;
  markAsRead: (messageIds: number[]) => Promise<void>;
  refreshConversations: () => Promise<void>;
  refreshMessages: () => Promise<void>;
  sendTypingStatus: (toUserId: number, isTyping: boolean) => void;
}

const MessagingContext = createContext<MessagingContextType | undefined>(undefined);

export const useMessaging = () => {
  const context = useContext(MessagingContext);
  if (!context) {
    throw new Error('useMessaging must be used within MessagingProvider');
  }
  return context;
};

export const MessagingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Initialize WebSocket connection when user is authenticated
  useEffect(() => {
    if (user?.id) {
      console.log('🔌 Initializing messaging for user:', user.id);
      const userId = typeof user.id === 'string' ? parseInt(user.id, 10) : user.id;
      messagingService.connect(userId);

      // Listen for connection status
      const unsubscribeStatus = messagingService.onConnectionStatus((status) => {
        console.log('📡 Messaging connection status:', status);
        setIsConnected(status);
      });

      // Listen for incoming messages
      const unsubscribeMessages = messagingService.onMessage((wsMessage: WebSocketMessage) => {
        handleWebSocketMessage(wsMessage);
      });

      // Load initial data
      loadConversations();
      loadUnreadCount();

      return () => {
        unsubscribeStatus();
        unsubscribeMessages();
        messagingService.disconnect();
      };
    }
  }, [user?.id]);

  const handleWebSocketMessage = (wsMessage: WebSocketMessage) => {
    console.log('📨 Received WebSocket message:', wsMessage.type);

    switch (wsMessage.type) {
      case 'new_message':
        if (wsMessage.message) {
          // Add to messages if it's for current conversation
          if (currentConversation && 
              (wsMessage.message.sender_id === currentConversation.user_id || 
               wsMessage.message.receiver_id === currentConversation.user_id)) {
            setMessages(prev => [...prev, wsMessage.message!]);
          }

          // Update unread count
          loadUnreadCount();
          
          // Refresh conversations to update last message
          loadConversations();
        }
        break;

      case 'typing':
        // Handle typing indicator (can be implemented in UI)
        console.log('User typing:', wsMessage.from_user_id, wsMessage.is_typing);
        break;
    }
  };

  const loadConversations = async () => {
    try {
      const data = await messagingService.getConversations();
      setConversations(data);
    } catch (error: any) {
      console.error('Error loading conversations:', error);
      // Silently fail - messaging feature is optional
      setConversations([]);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const count = await messagingService.getUnreadCount();
      setUnreadCount(count);
    } catch (error: any) {
      console.error('Error loading unread count:', error);
      // Silently fail - messaging feature is optional
      setUnreadCount(0);
    }
  };

  const selectConversation = async (conversation: Conversation) => {
    try {
      setIsLoading(true);
      setCurrentConversation(conversation);
      
      // Load messages for this conversation
      const conversationMessages = await messagingService.getConversationMessages(conversation.user_id);
      setMessages(conversationMessages);

      // Mark unread messages as read
      const unreadIds = conversationMessages
        .filter(msg => !msg.is_read && msg.receiver_id === user?.id)
        .map(msg => msg.id);
      
      if (unreadIds.length > 0) {
        await messagingService.markMessagesAsRead(unreadIds);
        loadUnreadCount();
        loadConversations(); // Refresh to update unread counts
      }
    } catch (error) {
      console.error('Error selecting conversation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (receiverId: number, content: string) => {
    try {
      const newMessage = await messagingService.sendMessage(receiverId, content);
      setMessages(prev => [...prev, newMessage]);
      loadConversations(); // Refresh to update last message
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  };

  const markAsRead = async (messageIds: number[]) => {
    try {
      await messagingService.markMessagesAsRead(messageIds);
      
      // Update local state
      setMessages(prev => 
        prev.map(msg => 
          messageIds.includes(msg.id) ? { ...msg, is_read: true } : msg
        )
      );
      
      loadUnreadCount();
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const refreshConversations = async () => {
    await loadConversations();
    await loadUnreadCount();
  };

  const refreshMessages = async () => {
    if (currentConversation) {
      try {
        const conversationMessages = await messagingService.getConversationMessages(currentConversation.user_id);
        setMessages(conversationMessages);
      } catch (error) {
        console.error('Error refreshing messages:', error);
      }
    }
  };

  const sendTypingStatus = (toUserId: number, isTyping: boolean) => {
    messagingService.sendTypingStatus(toUserId, isTyping);
  };

  return (
    <MessagingContext.Provider
      value={{
        conversations,
        currentConversation,
        messages,
        isConnected,
        isLoading,
        unreadCount,
        selectConversation,
        sendMessage,
        markAsRead,
        refreshConversations,
        refreshMessages,
        sendTypingStatus
      }}
    >
      {children}
    </MessagingContext.Provider>
  );
};
