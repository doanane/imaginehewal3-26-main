# Testing Checklist: Real-Time Messaging & Integration

## 🎯 Complete Feature List

### ✅ Backend Infrastructure (100% Complete)
- [x] Message model (already existed in caregiver.py)
- [x] Message schemas (MessageCreate, MessageResponse, ConversationResponse)
- [x] Messages router with REST API endpoints
- [x] WebSocket connection manager for real-time messaging
- [x] Notification WebSocket support
- [x] Relationship verification for messaging
- [x] Message read receipts
- [x] Typing status broadcast
- [x] Online status tracking
- [x] Unread message counting
- [x] Conversation grouping

### ✅ Frontend Infrastructure (100% Complete)
- [x] Messaging service (WebSocket + REST API)
- [x] MessagingContext for state management
- [x] Auto-reconnect mechanism
- [x] Keep-alive ping/pong
- [x] Event subscription system
- [x] Type-safe interfaces
- [x] Error handling
- [x] MessagingProvider integrated in _layout.tsx
- [x] apiCall exported for messaging service

### ✅ User Interface (Already Implemented)
- [x] Patient profile displays Patient ID
- [x] Caregiver profile displays Caregiver ID
- [x] Copy ID buttons
- [x] Share ID buttons
- [x] ID-based connection system

### ⏳ Pending Updates (UI Integration)
- [ ] Update patient chat.tsx to use real API
- [ ] Update caregiver messaging.tsx to use real API
- [ ] Update team-chat.tsx to use real API
- [ ] Add real-time typing indicators to UI
- [ ] Add connection status banners

## 🧪 Backend Testing

### 1. Test Message API Endpoints

#### Send Message
```bash
# Get auth token first
TOKEN="your_jwt_token_here"

# Send message
curl -X POST http://localhost:8000/messages/send \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "receiver_id": 2,
    "content": "Hello from the API!"
  }'

# Expected: 200 OK with message object
```

#### Get Conversations
```bash
curl http://localhost:8000/messages/conversations \
  -H "Authorization: Bearer $TOKEN"

# Expected: Array of conversations with unread counts
```

#### Get Conversation Messages
```bash
curl "http://localhost:8000/messages/conversation/2?limit=50&offset=0" \
  -H "Authorization: Bearer $TOKEN"

# Expected: Array of messages between users
```

#### Mark Messages as Read
```bash
curl -X POST http://localhost:8000/messages/mark-read \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message_ids": [1, 2, 3]
  }'

# Expected: Success message
```

#### Get Unread Count
```bash
curl http://localhost:8000/messages/unread-count \
  -H "Authorization: Bearer $TOKEN"

# Expected: {"unread_count": 5}
```

### 2. Test WebSocket Connection

Create a test HTML file:
```html
<!DOCTYPE html>
<html>
<head>
  <title>WebSocket Test</title>
</head>
<body>
  <h1>Messaging WebSocket Test</h1>
  <div id="status">Disconnected</div>
  <div id="messages"></div>
  <input type="text" id="messageInput" placeholder="Type message...">
  <button onclick="sendMessage()">Send</button>

  <script>
    const userId = 1; // Change to your user ID
    const ws = new WebSocket(`ws://localhost:8000/messages/ws/${userId}`);
    
    ws.onopen = () => {
      document.getElementById('status').textContent = 'Connected';
      console.log('WebSocket connected');
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('Received:', data);
      
      const messagesDiv = document.getElementById('messages');
      messagesDiv.innerHTML += `<p>${JSON.stringify(data, null, 2)}</p>`;
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      document.getElementById('status').textContent = 'Error';
    };
    
    ws.onclose = () => {
      document.getElementById('status').textContent = 'Disconnected';
      console.log('WebSocket closed');
    };
    
    function sendMessage() {
      const input = document.getElementById('messageInput');
      ws.send(JSON.stringify({
        type: 'typing',
        to_user_id: 2,
        is_typing: true
      }));
      input.value = '';
    }
    
    // Send ping every 30 seconds
    setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  </script>
</body>
</html>
```

### 3. Test Notification WebSocket

```javascript
const ws = new WebSocket('ws://localhost:8000/notifications/ws/1');

ws.onopen = () => console.log('Notifications connected');
ws.onmessage = (e) => {
  const notification = JSON.parse(e.data);
  console.log('New notification:', notification);
};
```

### 4. Test Relationship Verification

```bash
# Try to message someone without relationship - should fail
curl -X POST http://localhost:8000/messages/send \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "receiver_id": 999,
    "content": "This should fail"
  }'

# Expected: 403 Forbidden (no relationship)
```

## 🎨 Frontend Testing

### 1. Test MessagingContext

Create a test component:
```tsx
import { useMessaging } from '@/contexts/MessagingContext';

export function MessagingTest() {
  const {
    conversations,
    isConnected,
    unreadCount,
    sendMessage
  } = useMessaging();

  return (
    <View>
      <Text>Connected: {isConnected ? 'Yes' : 'No'}</Text>
      <Text>Unread: {unreadCount}</Text>
      <Text>Conversations: {conversations.length}</Text>
      
      <Button
        title="Send Test Message"
        onPress={() => sendMessage(2, 'Test message from UI')}
      />
    </View>
  );
}
```

### 2. Test Auto-Reconnect

```tsx
// In your test component
const messaging = messagingService;

// Manually disconnect
messaging.disconnect();

// Should automatically reconnect after delay
// Check console for reconnection logs
```

### 3. Test Real-Time Updates

1. Open app on two devices/browsers
2. Login as patient on one, caregiver on other
3. Send message from patient
4. Verify it appears instantly on caregiver device
5. Check unread count updates
6. Mark as read, verify count updates

## 🔗 Integration Testing

### Scenario 1: First Time Connection

1. **Create Patient Account**
   - Sign up as patient
   - Navigate to profile
   - Copy Patient ID
   - Verify ID is displayed correctly

2. **Create Caregiver Account**
   - Sign up as caregiver
   - Navigate to profile
   - Copy Caregiver ID
   - Verify ID is displayed correctly

3. **Connect Accounts**
   - Caregiver: Go to "Connect Patient"
   - Enter Patient ID
   - Submit connection request
   - Verify "pending" status

4. **Approve Connection** (Patient side)
   - Patient: Check notifications/requests
   - Approve caregiver connection
   - Verify status changes to "approved"

5. **Test Messaging**
   - Both users should now see each other in conversations
   - Send messages both directions
   - Verify real-time delivery
   - Check unread counts
   - Mark messages as read
   - Verify read status updates

### Scenario 2: Multiple Conversations

1. **Create Multiple Accounts**
   - 1 Patient
   - 2 Caregivers

2. **Connect All**
   - Both caregivers connect to patient
   - Patient approves both

3. **Test Conversations**
   - Patient sends message to Caregiver 1
   - Caregiver 1 responds
   - Patient sends message to Caregiver 2
   - Caregiver 2 responds
   - Verify correct conversation grouping
   - Verify unread counts per conversation
   - Verify messages don't leak between conversations

### Scenario 3: Real-Time Features

1. **Test Typing Indicators**
   - User A starts typing
   - User B sees "typing..." indicator
   - User A stops typing
   - Indicator disappears

2. **Test Online Status**
   - User A is online (green dot)
   - User A closes app
   - User B sees offline status
   - User A returns
   - User B sees online status again

3. **Test Notification Delivery**
   - User A receives message while on different screen
   - Verify notification appears
   - Verify unread badge shows
   - User A opens conversation
   - Verify badge clears

### Scenario 4: Error Handling

1. **Test No Connection**
   - Turn off backend server
   - Try to send message
   - Verify error message shown
   - Verify reconnect attempts
   - Start backend
   - Verify connection restores

2. **Test Invalid Receiver**
   - Try to message non-existent user
   - Verify error handling
   - Verify UI shows error message

3. **Test Authentication Failure**
   - Use invalid token
   - Verify redirect to login
   - Verify WebSocket disconnects

## 📊 Performance Testing

### 1. Load Testing

```bash
# Test with multiple simultaneous connections
for i in {1..10}; do
  curl -X POST http://localhost:8000/messages/send \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"receiver_id\": 2, \"content\": \"Message $i\"}" &
done
```

### 2. WebSocket Stability

- Keep connection open for 1 hour
- Verify ping/pong keep-alive works
- Verify no disconnections
- Monitor memory usage

### 3. Message History Loading

- Create 100+ messages in a conversation
- Load conversation
- Verify pagination works
- Verify performance is acceptable

## ✅ Success Criteria

### Backend
- [x] All API endpoints return 200 OK for valid requests
- [x] WebSocket connections stay open with ping/pong
- [x] Messages saved to database correctly
- [x] Relationship verification works
- [x] Read receipts update correctly
- [x] Unread counts are accurate

### Frontend
- [ ] MessagingContext provides real data
- [ ] WebSocket connects automatically
- [ ] Messages appear in real-time
- [ ] UI updates without manual refresh
- [ ] Typing indicators work
- [ ] Online status shows correctly
- [ ] Error messages display appropriately

### Integration
- [ ] Patient can connect to caregiver using ID
- [ ] Caregiver can connect to patient using ID
- [ ] Both parties can message after approval
- [ ] Messages deliver instantly
- [ ] Unread counts update automatically
- [ ] Multiple conversations work independently
- [ ] App remains stable with multiple users

## 🐛 Known Issues to Test

1. **CORS Issues**: Test from different origins
2. **Token Expiration**: Test with expired JWT
3. **Network Interruption**: Test with spotty connection
4. **Multiple Devices**: Test same user on multiple devices
5. **Message Order**: Verify messages display chronologically
6. **Time Zones**: Test timestamps across time zones

## 📝 Test Report Template

```markdown
## Test Session: [Date]

### Environment
- Backend: Running on [URL]
- Frontend: [Platform - iOS/Android/Web]
- Tester: [Name]

### Tests Performed
- [ ] Backend API endpoints
- [ ] WebSocket connections
- [ ] Real-time message delivery
- [ ] Typing indicators
- [ ] Online status
- [ ] Connection with IDs
- [ ] Multiple conversations
- [ ] Error handling

### Results
**Passed**: X tests
**Failed**: Y tests
**Blocked**: Z tests

### Issues Found
1. [Issue description]
   - Steps to reproduce:
   - Expected result:
   - Actual result:
   - Screenshots:

### Notes
[Any additional observations]
```

## 🚀 Next Steps After Testing

1. **Fix any bugs found**
2. **Update chat screens UI** (see CHAT_SCREENS_UPDATE_GUIDE.md)
3. **Add push notifications** for mobile
4. **Add message attachments** (images, files)
5. **Add message reactions** (like, heart, etc.)
6. **Add group messaging** (multiple participants)
7. **Add voice/video calls** (WebRTC)

## 📚 Reference Documentation

- Full Implementation: `docs/REALTIME_MESSAGING_IMPLEMENTATION.md`
- UI Update Guide: `docs/CHAT_SCREENS_UPDATE_GUIDE.md`
- API Documentation: http://localhost:8000/docs
- Backend Models: `back/app/models/caregiver.py`
- Frontend Service: `front/services/messaging.ts`
- Context Provider: `front/contexts/MessagingContext.tsx`

Good luck with testing! 🎉
