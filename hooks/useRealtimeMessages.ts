import { supabase } from '@/lib/supabase';
import { useEffect, useRef, useState } from 'react';

type Message = {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  is_read: boolean;
  conversation_id: number;
};

type UseRealtimeMessagesProps = {
  conversationId: number | null;
  currentUserId: string | null;
  onNewMessage: (message: Message) => void;
  onMessageUpdate: (message: Message) => void;
};

export const useRealtimeMessages = ({
  conversationId,
  currentUserId,
  onNewMessage,
  onMessageUpdate,
}: UseRealtimeMessagesProps) => {
  const channelRef = useRef<any>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!conversationId || !currentUserId) {
      console.log('❌ Missing conversationId or currentUserId');
      setIsConnected(false);
      return;
    }

    console.log('🔄 Setting up realtime for conversation:', conversationId);

    // Cleanup previous subscription
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      setIsConnected(false);
    }

    // Create new channel with unique name
    const channelName = `messages_${conversationId}_${currentUserId}_${Date.now()}`;
    const channel = supabase.channel(channelName);

    // Subscribe to INSERT events (new messages)
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        console.log('📨 Realtime: New message received:', payload.new);
        const newMessage = payload.new as Message;
        onNewMessage(newMessage);
      }
    );

    // Subscribe to UPDATE events (message status changes)
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        console.log('📝 Realtime: Message updated:', payload.new);
        const updatedMessage = payload.new as Message;
        onMessageUpdate(updatedMessage);
      }
    );

    // Subscribe and track status
    channel.subscribe((status) => {
      console.log('📡 Realtime status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('✅ Successfully subscribed to realtime');
        setIsConnected(true);
      } else if (status === 'CHANNEL_ERROR') {
        console.error('❌ Realtime subscription error');
        setIsConnected(false);
      } else if (status === 'CLOSED') {
        console.log('🔒 Realtime channel closed');
        setIsConnected(false);
      }
    });

    channelRef.current = channel;

    // Cleanup
    return () => {
      console.log('🧹 Cleaning up realtime subscription');
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      setIsConnected(false);
    };
  }, [conversationId, currentUserId, onNewMessage, onMessageUpdate]);

  return {
    isConnected,
  };
};

export default useRealtimeMessages;