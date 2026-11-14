# HEWAL3 Real-Time Messaging & Integration Implementation Guide

## 📋 Overview
This document describes the comprehensive integration of real-time messaging, notifications, and ID-based connections between patients and caregivers in the HEWAL3 health management platform.

## ✅ Completed Implementation

### 1. **Real-Time Messaging Backend** 
Created a complete WebSocket-based messaging system.

#### Files Created:
- **`back/app/schemas/message.py`**: Message data schemas
  - `MessageCreate`: Send new messages
  - `MessageResponse`: Message with user details
  - `ConversationResponse`: Conversation metadata
  - `MessageReadRequest`: Mark messages as read
  - `TypingStatus`: Real-time typing indicators

- **`back/app/routers/messages.py`**: Messaging API routes & WebSocket
  - **WebSocket Manager**: Handles real-time connections
  - **REST Endpoints**:
    - `POST /messages/send`: Send message with relationship verification
    - `GET /messages/conversations`: Get all conversations with unread counts
    - `GET /messages/conversation/{user_id}`: Get conversation history
    - `POST /messages/mark-read`: Mark messages as read
    - `GET /messages/unread-count`: Get total unread count
  - **WebSocket Endpoint**: `WS /messages/ws/{user_id}`
    - Real-time message delivery
    - Typing status broadcast
    - Automatic reconnection handling

#### Key Features:
- ✅ **Relationship Verification**: Only approved caregiver-patient connections can message
- ✅ **Real-Time Delivery**: Instant message delivery via WebSocket
- ✅ **Online Status**: Track user connection status
- ✅ **Typing Indicators**: Real-time typing status
- ✅ **Message Read Receipts**: Track read/unread status
- ✅ **Conversation Management**: Automatic conversation grouping

### 2. **Real-Time Notifications Backend**
Enhanced the existing notifications system with WebSocket support.

#### Files Modified:
- **`back/app/routers/notifications.py`**: Added WebSocket support
  - **NotificationConnectionManager**: Manages real-time notification connections
  - **New Features**:
    - `WS /notifications/ws/{user_id}`: Real-time notification delivery
    - `broadcast_to_caregivers()`: Send notifications to all patient's caregivers
    - `send_notification_to_user()`: Helper function for other routers
    - `POST /notifications/create`: Create and broadcast notifications

- **`back/app/schemas/notification.py`**: Updated schema
  - Added `user_id` field to `NotificationCreate`

#### Key Features:
- ✅ **Real-Time Alerts**: Instant notification delivery
- ✅ **Broadcast Support**: Notify multiple users simultaneously
- ✅ **Caregiver Alerts**: Automatic alerts to all patient caregivers
- ✅ **Keep-Alive**: Ping/pong mechanism for connection stability

### 3. **Frontend Messaging Service**
Complete client-side messaging infrastructure.

#### Files Created:
- **`front/services/messaging.ts`**: Messaging service with WebSocket
  - **MessagingService Class**:
    - `connect(userId)`: Establish WebSocket connection
    - `disconnect()`: Clean disconnection
    - `sendMessage()`: Send message via REST API
    - `getConversations()`: Fetch all conversations
    - `getConversationMessages()`: Load conversation history
    - `markMessagesAsRead()`: Mark messages as read
    - `getUnreadCount()`: Get total unread count
    - `sendTypingStatus()`: Broadcast typing status
    - `onMessage()`: Subscribe to incoming messages
    - `onConnectionStatus()`: Monitor connection state

#### Key Features:
- ✅ **Auto-Reconnect**: Exponential backoff reconnection (max 5 attempts)
- ✅ **Keep-Alive**: 30-second ping interval
- ✅ **Event Listeners**: Subscribe to messages and connection status
- ✅ **Type-Safe**: Full TypeScript interfaces
- ✅ **Error Handling**: Comprehensive error management

### 4. **Frontend Messaging Context**
React context for managing messaging state across the app.

#### Files Created:
- **`front/contexts/MessagingContext.tsx`**: Messaging state management
  - **State Management**:
    - `conversations`: List of all conversations
    - `currentConversation`: Active conversation
    - `messages`: Current conversation messages
    - `isConnected`: WebSocket connection status
    - `unreadCount`: Total unread messages
  
  - **Functions**:
    - `selectConversation()`: Switch to a conversation
    - `sendMessage()`: Send message and update UI
    - `markAsRead()`: Mark messages as read
    - `refreshConversations()`: Reload conversation list
    - `refreshMessages()`: Reload current conversation
    - `sendTypingStatus()`: Send typing indicator

#### Key Features:
- ✅ **Auto-Load**: Loads conversations on mount
- ✅ **Real-Time Updates**: Handles incoming WebSocket messages
- ✅ **Automatic Read Receipts**: Marks messages as read when viewed
- ✅ **State Synchronization**: Keeps UI in sync with backend

### 5. **Integration Updates**

#### Files Modified:
- **`back/app/main.py`**: Added messages router
  ```python
  from app.routers.messages import router as messages_router
  app.include_router(messages_router)
  ```

- **`back/app/schemas/__init__.py`**: Exported message schemas
  ```python
  from .message import *
  ```

- **`front/app/_layout.tsx`**: Added MessagingProvider
  ```tsx
  <MessagingProvider>
    {/* Other providers and components */}
  </MessagingProvider>
  ```

- **`front/services/api.ts`**: Exported `apiCall` function
  ```typescript
  export { apiCall };
  ```

### 6. **ID Display in Profiles**
Both patient and caregiver profiles already display IDs correctly:

- **Patient Profile** (`front/app/(patient)/profile.tsx`):
  - Displays Patient ID
  - Copy ID button
  - Share ID button with pre-formatted message

- **Caregiver Profile** (`front/app/(caregiver)/caregiver-profile.tsx`):
  - Displays Caregiver ID
  - Copy ID button
  - Share ID button with pre-formatted message

### 7. **Connection System**
The caregiver-patient connection system already uses real IDs:

- **Backend** (`back/app/routers/caregivers.py`):
  - `POST /caregivers/connect-patient`: Connect using patient_id or caregiver_id
  - Verifies relationship before allowing messaging
  - Creates pending relationship requiring approval

## 🔧 How to Use the New Features

### Backend Setup

1. **Start the FastAPI server**:
   ```bash
   cd back
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **WebSocket URLs**:
   - Messages: `ws://localhost:8000/messages/ws/{user_id}`
   - Notifications: `ws://localhost:8000/notifications/ws/{user_id}`

### Frontend Setup

1. **The MessagingContext is already integrated** in `_layout.tsx`

2. **Use in components**:
   ```tsx
   import { useMessaging } from '@/contexts/MessagingContext';
   
   function MyComponent() {
     const { 
       conversations, 
       messages, 
       isConnected,
       sendMessage,
       selectConversation 
     } = useMessaging();
     
     // Your component logic
   }
   ```

3. **Example: Send Message**:
   ```tsx
   const handleSend = async () => {
     try {
       await sendMessage(receiverId, messageText);
       // Message automatically appears in UI
     } catch (error) {
       Alert.alert('Error', 'Failed to send message');
     }
   };
   ```

4. **Example: Load Conversation**:
   ```tsx
   const openChat = async (conversation) => {
     await selectConversation(conversation);
     // Messages automatically loaded and displayed
   };
   ```

### Real-Time Features

1. **Incoming Messages**:
   - Automatically appear in conversation view
   - Trigger notification sound/badge
   - Update unread count
   - Update conversation list

2. **Typing Indicators**:
   ```tsx
   // Send typing status
   const handleTyping = (isTyping: boolean) => {
     if (currentConversation) {
       sendTypingStatus(currentConversation.user_id, isTyping);
     }
   };
   ```

3. **Online Status**:
   - Shows green dot for online users
   - Updated via `is_online` field in conversations

## 📱 Next Steps: Update Chat Screens

### Patient Chat Screen (`front/app/(patient)/chat.tsx`)
Currently uses mock data. Update to use MessagingContext:

```tsx
import { useMessaging } from '@/contexts/MessagingContext';

export default function ChatScreen() {
  const {
    conversations,
    selectConversation,
    messages,
    sendMessage,
    isConnected
  } = useMessaging();
  
  // Replace mock data with real conversations
  // Implement message sending
  // Show real-time updates
}
```

### Caregiver Messaging (`front/app/(caregiver)/messaging.tsx`)
Currently uses mock data. Update similarly:

```tsx
import { useMessaging } from '@/contexts/MessagingContext';

export default function CaregiverMessaging() {
  const messaging = useMessaging();
  
  // Use real conversations and messages
  // Implement real-time features
}
```

### Team Chat (`front/app/(caregiver)/team-chat.tsx`)
Can be enhanced to show real patient messages instead of mock data.

## 🔐 Security Features

1. **Relationship Verification**:
   - Users can only message those with approved caregiver-patient relationships
   - 403 error returned if no relationship exists

2. **Authentication**:
   - All API endpoints require valid JWT token
   - WebSocket connections verify user identity

3. **Message Privacy**:
   - Users only see their own conversations
   - No access to other users' messages

## 📊 Database Schema

### Message Table
```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY,
  sender_id INTEGER REFERENCES users(id),
  receiver_id INTEGER REFERENCES users(id),
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

Already exists in `back/app/models/caregiver.py`

## 🧪 Testing Guide

### Test Messaging Backend

1. **Test WebSocket Connection**:
   ```javascript
   const ws = new WebSocket('ws://localhost:8000/messages/ws/1');
   ws.onopen = () => console.log('Connected');
   ws.onmessage = (e) => console.log('Message:', JSON.parse(e.data));
   ```

2. **Send Test Message**:
   ```bash
   curl -X POST http://localhost:8000/messages/send \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"receiver_id": 2, "content": "Hello!"}'
   ```

3. **Get Conversations**:
   ```bash
   curl http://localhost:8000/messages/conversations \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

### Test Notifications

1. **Connect to Notifications WebSocket**:
   ```javascript
   const ws = new WebSocket('ws://localhost:8000/notifications/ws/1');
   ```

2. **Get Notifications**:
   ```bash
   curl http://localhost:8000/notifications/ \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

## 🐛 Troubleshooting

### WebSocket Connection Issues

1. **CORS Errors**:
   - Ensure WebSocket URLs use `ws://` (not `http://`)
   - Check CORS settings in `back/app/main.py`

2. **Connection Drops**:
   - Check ping/pong keep-alive mechanism
   - Verify network stability
   - Check server logs for errors

3. **Messages Not Appearing**:
   - Verify user is connected to WebSocket
   - Check relationship between sender/receiver
   - Verify JWT token is valid

### Frontend Issues

1. **MessagingContext not working**:
   - Ensure MessagingProvider wraps your component
   - Check console for connection logs
   - Verify user is authenticated

2. **Unread count not updating**:
   - Check if markAsRead is being called
   - Verify WebSocket messages are received
   - Check backend logs

## 📚 API Documentation

### Message Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/messages/send` | Send a new message |
| GET | `/messages/conversations` | Get all conversations |
| GET | `/messages/conversation/{user_id}` | Get messages with specific user |
| POST | `/messages/mark-read` | Mark messages as read |
| GET | `/messages/unread-count` | Get unread message count |
| WS | `/messages/ws/{user_id}` | Real-time messaging WebSocket |

### Notification Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/notifications/` | Get all notifications |
| POST | `/notifications/mark-read/{id}` | Mark notification as read |
| GET | `/notifications/unread-count` | Get unread notification count |
| POST | `/notifications/create` | Create and broadcast notification |
| WS | `/notifications/ws/{user_id}` | Real-time notification WebSocket |

## 🎯 Benefits of This Implementation

1. **Real-Time Communication**: Instant messaging between patients and caregivers
2. **Scalable**: WebSocket manager handles multiple connections efficiently
3. **Reliable**: Auto-reconnect and keep-alive mechanisms
4. **Type-Safe**: Full TypeScript typing throughout
5. **Secure**: Relationship verification and JWT authentication
6. **User-Friendly**: Unread counts, online status, typing indicators
7. **Maintainable**: Clear separation of concerns, context-based state management

## 🚀 Future Enhancements

1. **Group Messaging**: Support multiple participants
2. **File Attachments**: Send images, PDFs, voice notes
3. **Message Reactions**: Like, heart, thumbs up
4. **Voice/Video Calls**: WebRTC integration
5. **Message Search**: Full-text search across conversations
6. **Message Encryption**: End-to-end encryption
7. **Push Notifications**: Mobile push via FCM
8. **Message Delivery Status**: Sent, delivered, read timestamps

## 📝 Summary

This implementation provides a complete, production-ready real-time messaging and notification system for HEWAL3. All backend infrastructure is in place and integrated. The frontend has the necessary services and context providers. The only remaining task is to update the existing chat UI components to use the new real-time APIs instead of mock data.

The system is secure, scalable, and follows React/FastAPI best practices. All user IDs are real and properly displayed in profiles, and the caregiver-patient connection system uses these real IDs for establishing relationships before allowing communication.
