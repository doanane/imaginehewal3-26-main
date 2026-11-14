// front/services/messaging.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiCall } from './api';

export interface Message {
    id: number;
    sender_id: number;
    receiver_id: number;
    content: string;
    is_read: boolean;
    created_at: string;
    sender_name?: string;
    sender_email?: string;
    receiver_name?: string;
    receiver_email?: string;
}

export interface Conversation {
    user_id: number;
    user_name: string;
    user_email: string;
    user_type: 'patient' | 'caregiver' | 'doctor';
    patient_id?: string;
    caregiver_id?: string;
    last_message?: string;
    last_message_time?: string;
    unread_count: number;
    is_online: boolean;
}

export interface WebSocketMessage {
    type: 'new_message' | 'typing' | 'pong' | 'connection_status';
    message?: Message;
    from_user_id?: number;
    is_typing?: boolean;
    is_online?: boolean;
}

class MessagingService {
    private ws: WebSocket | null = null;
    private userId: number | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    private pingInterval: ReturnType<typeof setTimeout> | null = null;
    private messageListeners: ((message: WebSocketMessage) => void)[] = [];
    private connectionStatusListeners: ((status: boolean) => void)[] = [];

    constructor() { }

    async connect(userId: number) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('✅ WebSocket already connected');
            return;
        }

        this.userId = userId;
        const token = await AsyncStorage.getItem('access_token');

        if (!token) {
            console.warn('⚠️  No token found for WebSocket connection (continuing anyway - not required)');
        }

        try {
            const wsUrl = this.getWebSocketUrl();
            console.log(`🔌 Connecting to WebSocket: ${wsUrl}`);

            this.ws = new WebSocket(`${wsUrl}/messages/ws/${userId}`);

            this.ws.onopen = () => {
                console.log('✅ WebSocket connected');
                this.reconnectAttempts = 0;
                this.notifyConnectionStatus(true);
                this.startPing();
            };

            this.ws.onmessage = (event) => {
                try {
                    const data: WebSocketMessage = JSON.parse(event.data);
                    console.log('📨 WebSocket message received:', data.type);
                    this.messageListeners.forEach(listener => listener(data));
                } catch (error) {
                    console.error('❌ Error parsing WebSocket message:', error);
                }
            };

            this.ws.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
            };

            this.ws.onclose = (event) => {
                console.log('❌ WebSocket closed:', event.code, event.reason);
                this.notifyConnectionStatus(false);
                this.stopPing();
                this.attemptReconnect();
            };
        } catch (error) {
            console.error('❌ Error creating WebSocket:', error);
            this.attemptReconnect();
        }
    }

    disconnect() {
        console.log('🔌 Disconnecting WebSocket');
        this.stopPing();
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.notifyConnectionStatus(false);
    }

    private attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('❌ Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        console.log(`🔄 Attempting reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        this.reconnectTimeout = setTimeout(() => {
            if (this.userId) {
                this.connect(this.userId);
            }
        }, delay);
    }

    private startPing() {
        this.stopPing();
        this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'ping' }));
            }
        }, 30000); // Ping every 30 seconds
    }

    private stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    sendTypingStatus(toUserId: number, isTyping: boolean) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'typing',
                to_user_id: toUserId,
                is_typing: isTyping
            }));
        }
    }

    onMessage(listener: (message: WebSocketMessage) => void) {
        this.messageListeners.push(listener);
        return () => {
            this.messageListeners = this.messageListeners.filter(l => l !== listener);
        };
    }

    onConnectionStatus(listener: (status: boolean) => void) {
        this.connectionStatusListeners.push(listener);
        return () => {
            this.connectionStatusListeners = this.connectionStatusListeners.filter(l => l !== listener);
        };
    }

    private notifyConnectionStatus(status: boolean) {
        this.connectionStatusListeners.forEach(listener => listener(status));
    }

    private getWebSocketUrl(): string {
        const baseUrl = process.env.EXPO_PUBLIC_BASE_URL || 'http://localhost:8000';
        return baseUrl.replace(/^http/, 'ws');
    }

    // REST API Methods

    async sendMessage(receiverId: number, content: string): Promise<Message> {
        return await apiCall<Message>('/messages/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                receiver_id: receiverId,
                content: content
            })
        });
    }

    async getConversations(): Promise<Conversation[]> {
        return await apiCall<Conversation[]>('/messages/conversations', {
            method: 'GET'
        });
    }

    async getConversationMessages(userId: number, limit: number = 50, offset: number = 0): Promise<Message[]> {
        return await apiCall<Message[]>(`/messages/conversation/${userId}?limit=${limit}&offset=${offset}`, {
            method: 'GET'
        });
    }

    async markMessagesAsRead(messageIds: number[]): Promise<void> {
        await apiCall('/messages/mark-read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message_ids: messageIds })
        });
    }

    async getUnreadCount(): Promise<number> {
        const response = await apiCall<{ unread_count: number }>('/messages/unread-count', {
            method: 'GET'
        });
        return response.unread_count;
    }
}

export const messagingService = new MessagingService();
export default messagingService;
