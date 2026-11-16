// front/services/messaging.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiCall } from './api';
import { realtime } from './realtime';

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
    async connect(_userId?: number) {
        realtime.start();
    }

    disconnect() {
        realtime.stop();
    }

    sendTypingStatus(toUserId: number, isTyping: boolean) {
        realtime.send({ type: 'typing', to_user_id: toUserId, is_typing: isTyping });
    }

    onMessage(listener: (message: WebSocketMessage) => void) {
        const offs = [
            realtime.on('message.new', (e) => listener({ type: 'new_message', message: e.message })),
            realtime.on('typing', (e) => listener({ type: 'typing', from_user_id: e.from_user_id, is_typing: e.is_typing })),
            realtime.on('presence', (e) => listener({ type: 'connection_status', from_user_id: e.user_id, is_online: e.online })),
        ];
        return () => offs.forEach((off) => off());
    }

    onConnectionStatus(listener: (status: boolean) => void) {
        return realtime.onStatus(listener);
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
