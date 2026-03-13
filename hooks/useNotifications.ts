import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';

export const useNotifications = () => {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadUnreadCount();
    setupRealtimeSubscription();
  }, []);

  const loadUnreadCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Count unread split transaction notifications
      const { count: splitCount, error: splitError } = await supabase
        .from("split_transaction_participants")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_creator", false)
        .eq("is_read", false);

      if (splitError) throw splitError;

      // Count unread pending friend requests
      const { count: friendCount, error: friendError } = await supabase
        .from("friendships")
        .select("id", { count: "exact", head: true })
        .eq("friend_id", user.id)
        .eq("status", "pending")
        .eq("is_read", false);

      if (friendError) throw friendError;

      setUnreadCount((splitCount || 0) + (friendCount || 0));
    } catch (error) {
      console.error("Error loading unread count:", error);
    }
  };

  const setupRealtimeSubscription = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const channel = supabase
      .channel('notifications_count')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'split_transaction_participants',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadUnreadCount();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'split_transaction_participants',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadUnreadCount();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'friendships',
          filter: `friend_id=eq.${user.id}`,
        },
        () => {
          loadUnreadCount();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
          filter: `friend_id=eq.${user.id}`,
        },
        () => {
          loadUnreadCount();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  };

  return { unreadCount };
};
