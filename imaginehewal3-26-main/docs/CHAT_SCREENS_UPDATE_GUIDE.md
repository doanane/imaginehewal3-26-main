# Quick Start Guide: Update Chat Screens to Use Real-Time API

## 🎯 Goal
Replace mock data in chat screens with real API calls using the MessagingContext.

## 📁 Files to Update

### 1. Patient Chat Screen
**File**: `front/app/(patient)/chat.tsx`

**Current State**: Uses mock conversation data
```tsx
const [conversations] = useState([
  {
    id: '1',
    type: 'caregiver',
    name: 'Sarah Morgan (Daughter)',
    lastMessage: 'How are you feeling today, Dad?',
    // ... mock data
  }
]);
```

**What to Change**:
```tsx
import { useMessaging } from '../../contexts/MessagingContext';

export default function ChatScreen() {
  const {
    conversations,        // Real conversations from API
    currentConversation,  // Currently selected conversation
    messages,            // Real messages from API
    sendMessage,         // Send message function
    selectConversation,  // Open conversation function
    isConnected,         // WebSocket connection status
    unreadCount          // Total unread count
  } = useMessaging();

  // No need for useState - data comes from context
  
  // Handle conversation selection
  const handleOpenChat = async (conversation) => {
    await selectConversation(conversation);
    // Messages automatically loaded
  };

  // Handle sending message
  const handleSendMessage = async () => {
    if (messageInput.trim() && currentConversation) {
      try {
        await sendMessage(currentConversation.user_id, messageInput);
        setMessageInput(''); // Clear input
      } catch (error) {
        Alert.alert('Error', 'Failed to send message');
      }
    }
  };

  return (
    <View>
      {/* Show connection status */}
      {!isConnected && (
        <View style={styles.offlineBanner}>
          <Text>Connecting...</Text>
        </View>
      )}

      {/* Conversation list */}
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.user_id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => handleOpenChat(item)}>
            <Text>{item.user_name}</Text>
            <Text>{item.last_message}</Text>
            {item.unread_count > 0 && (
              <View style={styles.badge}>
                <Text>{item.unread_count}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      />

      {/* Message view */}
      {currentConversation && (
        <View>
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <View style={item.sender_id === user?.id ? styles.sentMessage : styles.receivedMessage}>
                <Text>{item.content}</Text>
                <Text>{new Date(item.created_at).toLocaleTimeString()}</Text>
              </View>
            )}
          />

          <TextInput
            value={messageInput}
            onChangeText={setMessageInput}
            placeholder="Type a message..."
            onSubmitEditing={handleSendMessage}
          />
          <Button title="Send" onPress={handleSendMessage} />
        </View>
      )}
    </View>
  );
}
```

### 2. Caregiver Messaging Screen
**File**: `front/app/(caregiver)/messaging.tsx`

**Current State**: Uses mock chat history
```tsx
const [chatHistory, setChatHistory] = useState([
  { id: 1, sender: 'patient', text: 'I felt a bit dizzy...', time: '09:15 AM' },
  // ... mock data
]);
```

**What to Change**:
```tsx
import { useMessaging } from '../../contexts/MessagingContext';
import { useAuth } from '../../contexts/AuthContext';

export default function CaregiverMessaging() {
  const { user } = useAuth();
  const {
    messages,
    currentConversation,
    sendMessage,
    sendTypingStatus
  } = useMessaging();
  
  const [messageInput, setMessageInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Handle typing indicator
  const handleTextChange = (text: string) => {
    setMessageInput(text);
    
    // Send typing status
    if (text.length > 0 && !isTyping) {
      setIsTyping(true);
      if (currentConversation) {
        sendTypingStatus(currentConversation.user_id, true);
      }
    } else if (text.length === 0 && isTyping) {
      setIsTyping(false);
      if (currentConversation) {
        sendTypingStatus(currentConversation.user_id, false);
      }
    }
  };

  // Send message
  const handleSendMessage = async () => {
    if (messageInput.trim() && currentConversation) {
      try {
        await sendMessage(currentConversation.user_id, messageInput);
        setMessageInput('');
        setIsTyping(false);
        sendTypingStatus(currentConversation.user_id, false);
      } catch (error) {
        Alert.alert('Error', 'Failed to send message');
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Header with patient info */}
      <View style={styles.header}>
        <Text>{currentConversation?.user_name || 'Select a patient'}</Text>
        {currentConversation?.is_online && (
          <View style={styles.onlineIndicator} />
        )}
      </View>

      {/* Messages */}
      <FlatList
        data={messages}
        inverted  // Show latest at bottom
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={item.sender_id === user?.id ? styles.myMessage : styles.theirMessage}>
            <Text>{item.content}</Text>
            <Text style={styles.timestamp}>
              {new Date(item.created_at).toLocaleTimeString()}
            </Text>
          </View>
        )}
      />

      {/* Input area */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={messageInput}
          onChangeText={handleTextChange}
          placeholder="Type your message..."
          multiline
        />
        <TouchableOpacity 
          style={styles.sendButton}
          onPress={handleSendMessage}
          disabled={!messageInput.trim()}
        >
          <Ionicons name="send" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
```

### 3. Team Chat Screen
**File**: `front/app/(caregiver)/team-chat.tsx`

This can be enhanced to show real patient communications. Here's a simple example:

```tsx
import { useMessaging } from '../../contexts/MessagingContext';

export default function TeamChat() {
  const { conversations, unreadCount } = useMessaging();
  
  // Filter for team conversations (caregivers/doctors)
  const teamConversations = conversations.filter(
    conv => conv.user_type === 'caregiver' || conv.user_type === 'doctor'
  );

  return (
    <View>
      <Text>Team Chat ({unreadCount} unread)</Text>
      <FlatList
        data={teamConversations}
        keyExtractor={(item) => item.user_id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => selectConversation(item)}>
            <Text>{item.user_name}</Text>
            <Text>{item.last_message}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
```

## 🎨 UI Enhancements

### Show Online Status
```tsx
{conversation.is_online && (
  <View style={styles.onlineDot} />
)}
```

### Show Unread Badge
```tsx
{conversation.unread_count > 0 && (
  <View style={styles.unreadBadge}>
    <Text style={styles.unreadText}>
      {conversation.unread_count > 9 ? '9+' : conversation.unread_count}
    </Text>
  </View>
)}
```

### Show Typing Indicator
```tsx
{/* Listen for typing events from WebSocket */}
{otherUserTyping && (
  <View style={styles.typingIndicator}>
    <Text>{currentConversation.user_name} is typing...</Text>
  </View>
)}
```

### Format Timestamps
```tsx
const formatTime = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString();
};
```

## 🔄 Real-Time Updates

The MessagingContext automatically handles:
- ✅ New messages appear instantly
- ✅ Unread counts update automatically
- ✅ Conversations reorder by latest message
- ✅ Read receipts update in real-time
- ✅ Connection status monitoring

You don't need to manually refresh data!

## 🚀 Quick Implementation Checklist

### Patient Chat (`chat.tsx`)
- [ ] Import `useMessaging` hook
- [ ] Replace mock `conversations` state with context data
- [ ] Replace mock `messages` with context data
- [ ] Update `handleSendMessage` to use `sendMessage()`
- [ ] Update conversation selection to use `selectConversation()`
- [ ] Add connection status indicator
- [ ] Add unread badges
- [ ] Test sending/receiving messages

### Caregiver Messaging (`messaging.tsx`)
- [ ] Import `useMessaging` hook
- [ ] Remove mock `chatHistory` state
- [ ] Use `messages` from context
- [ ] Implement `sendMessage()` for sending
- [ ] Add typing indicators with `sendTypingStatus()`
- [ ] Add online status indicator
- [ ] Format timestamps properly
- [ ] Test real-time updates

### Team Chat (`team-chat.tsx`)
- [ ] Import `useMessaging` hook
- [ ] Use `conversations` from context
- [ ] Filter for team members
- [ ] Implement conversation selection
- [ ] Test with multiple users

## 🧪 Testing Steps

1. **Start Backend**:
   ```bash
   cd back
   uvicorn app.main:app --reload
   ```

2. **Start Frontend**:
   ```bash
   cd front
   npm start
   ```

3. **Create Test Users**:
   - Create a patient account
   - Create a caregiver account
   - Note their IDs from profiles

4. **Connect Users**:
   - Caregiver: Use "Connect Patient" with patient ID
   - Patient: Approve the connection request

5. **Test Messaging**:
   - Open chat screens on both accounts
   - Send messages back and forth
   - Verify real-time delivery
   - Check unread counts
   - Test typing indicators

## 💡 Pro Tips

1. **Always check `currentConversation` before sending**:
   ```tsx
   if (!currentConversation) return;
   await sendMessage(currentConversation.user_id, text);
   ```

2. **Handle errors gracefully**:
   ```tsx
   try {
     await sendMessage(receiverId, text);
   } catch (error) {
     Alert.alert('Error', 'Failed to send message. Please try again.');
   }
   ```

3. **Show loading states**:
   ```tsx
   {isLoading && <ActivityIndicator />}
   ```

4. **Scroll to bottom on new messages**:
   ```tsx
   const flatListRef = useRef<FlatList>(null);
   
   useEffect(() => {
     flatListRef.current?.scrollToEnd();
   }, [messages]);
   ```

5. **Debounce typing indicators**:
   ```tsx
   const typingTimeoutRef = useRef<NodeJS.Timeout>();
   
   const handleTyping = () => {
     sendTypingStatus(userId, true);
     
     clearTimeout(typingTimeoutRef.current);
     typingTimeoutRef.current = setTimeout(() => {
       sendTypingStatus(userId, false);
     }, 3000);
   };
   ```

## 🎯 Expected Result

After implementing these changes:
- ✅ Real conversations load from database
- ✅ Messages send and appear instantly
- ✅ Unread counts update automatically
- ✅ Online status shows correctly
- ✅ Typing indicators work
- ✅ No mock data remains
- ✅ All features work in real-time

## Need Help?

Check the full documentation in:
- `docs/REALTIME_MESSAGING_IMPLEMENTATION.md`
- Backend logs for WebSocket connections
- Browser console for frontend errors
- Network tab for API calls

Happy coding! 🚀
