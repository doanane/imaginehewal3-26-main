import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ChatMessage, getHealthResponse, testGeminiAPI, saveChatHistory, loadChatHistory, clearChatHistory } from '../services/chatbot';

interface ChatbotContextType {
  messages: ChatMessage[];
  isChatOpen: boolean;
  isLoading: boolean;
  isTyping: boolean;
  apiStatus: { gemini: boolean; message: string };
  
  
  sendMessage: (content: string) => Promise<void>;
  toggleChat: () => void;
  openChat: () => void;
  closeChat: () => void;
  testConnection: () => Promise<void>;
  clearMessages: () => Promise<void>;
}

const ChatbotContext = createContext<ChatbotContextType | undefined>(undefined);

export const useChatbot = () => {
  const context = useContext(ChatbotContext);
  if (!context) throw new Error('useChatbot must be used within ChatbotProvider');
  return context;
};

export const ChatbotProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [apiStatus, setApiStatus] = useState({ gemini: false, message: 'Not tested' });

  
  useEffect(() => {
    const loadHistory = async () => {
      const history = await loadChatHistory();
      if (history.length > 0) {
        setMessages(history);
      } else {
        
        const welcomeMessage: ChatMessage = {
          id: '1',
          role: 'assistant',
          content: "Hello! I'm your HEWAL3 Health Assistant. I can help you with health questions, medication guidance, emergency assistance, and general health tips. How can I help you today?",
          timestamp: new Date().toISOString()
        };
        setMessages([welcomeMessage]);
        await saveChatHistory([welcomeMessage]);
      }
    };
    loadHistory();
  }, []);

  
  const sendMessage = async (content: string) => {
    if (!content.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date().toISOString()
    };

    
    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    try {
      
      const response = await getHealthResponse(content);
      
      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date().toISOString(),
        isEmergency: response.isEmergency
      };

      
      setMessages(prev => [...prev, botMessage]);
      
      
      await saveChatHistory([...messages, userMessage, botMessage]);
      
    } catch (error) {
      console.error('Error sending message:', error);
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Sorry, I'm having trouble connecting. Please try again or contact emergency services if needed.",
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, errorMessage]);
      await saveChatHistory([...messages, userMessage, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  
  const testConnection = async () => {
    setIsLoading(true);
    try {
      const result = await testGeminiAPI();
      setApiStatus({ gemini: result.success, message: result.message });
      
      
      const testMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: result.message,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, testMessage]);
      
    } catch (error) {
      console.error('Test failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  
  
  
  
  const clearMessages = async () => {
    try {
      console.log('Starting to clear messages...');
      
      
      await clearChatHistory();
      console.log('Chat history cleared from storage');
      
      
      const welcomeMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: "Conversation cleared. Hello! I'm your HEWAL3 Health Assistant. How can I help you today?",
        timestamp: new Date().toISOString()
      };
      
      
      setMessages([welcomeMessage]);
      console.log('Messages state reset with welcome message');
      
      
      await saveChatHistory([welcomeMessage]);
      console.log('Welcome message saved to storage');
      
    } catch (error) {
      console.error('Error clearing messages:', error);
      
      
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: "Chat cleared. How can I help you?",
        timestamp: new Date().toISOString()
      };
      setMessages([errorMessage]);
    }
  };
  
  const toggleChat = () => {
    const newIsOpen = !isChatOpen;
    setIsChatOpen(newIsOpen);
    
    
    
    if (newIsOpen) {
      
      
      
    }
  };

  const openChat = () => setIsChatOpen(true);
  const closeChat = () => setIsChatOpen(false);

  return (
    <ChatbotContext.Provider
      value={{
        messages,
        isChatOpen,
        isLoading,
        isTyping,
        apiStatus,
        sendMessage,
        toggleChat,
        openChat,
        closeChat,
        testConnection,
        clearMessages
      }}
    >
      {children}
    </ChatbotContext.Provider>
  );
};