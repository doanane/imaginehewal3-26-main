import { useSegments } from 'expo-router';
import React, { useEffect } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useChatbot } from '../../contexts/ChatbotContext';
import { ChatButton } from './ChatButton';
import { ChatWindow } from './ChatWindow';
import { View } from '../themed';

export const ChatbotContainer: React.FC = () => {
  const { isChatOpen, toggleChat, messages } = useChatbot();
  const { isAuthenticated } = useAuth();
  const segments = useSegments();
  const { width, height } = useWindowDimensions();

  
  const shouldShowChatbot = React.useMemo(() => {
    if (!isAuthenticated) return false;
    
    const currentSegment = segments[0];
    const currentRoute = segments[1];
    if (!currentSegment || !currentRoute) return false;
    
    // Only show chatbot on home and dashboard screens
    const allowedScreens = [
      'home',
      'dashboard',
    ];
    
    return allowedScreens.includes(currentRoute);
  }, [isAuthenticated, segments]);

  
  const unreadCount = React.useMemo(() => {
    if (isChatOpen) return 0;
    
    
    return messages.filter(msg => msg.role === 'assistant').length > 1 ? 1 : 0;
  }, [messages, isChatOpen]);

  
  useEffect(() => {
    if (Platform.OS === 'web' && isChatOpen) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          toggleChat();
        }
      };
      
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [isChatOpen]);

  if (!shouldShowChatbot) {
    return null;
  }

  return (
    <View style={{ 
      position: 'absolute', 
      width: '100%', 
      height: '100%', 
      pointerEvents: 'box-none',
      zIndex: 9999,
    }}>
      {/* Chat button - only show when chat is closed */}
      {!isChatOpen && (
        <ChatButton 
          onPress={toggleChat} 
          unreadCount={unreadCount}
          isChatOpen={isChatOpen}
        />
      )}
      
      {/* Chat window - full screen when open */}
      <ChatWindow isVisible={isChatOpen} onClose={toggleChat} />
    </View>
  );
};