import Ionicons from "@expo/vector-icons/Ionicons";
import { Link, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { supabase } from "@/lib/supabase";

const { width: screenWidth } = Dimensions.get("window");
const isSmallScreen = screenWidth < 375;
const isMediumScreen = screenWidth >= 375 && screenWidth < 414;

type Conversation = {
  id: string;
  participant_1: string;
  participant_2: string;
  last_message_at: string;
  last_message?: {
    content: string;
    sender_id: string;
  };
  other_user?: {
    user_id: string;
    display_name: string;
    avatar_url: string;
  };
  unread_count?: number;
};

export default function MessagesScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  // Realtime subscription for conversation updates
  useEffect(() => {
    if (!currentUserId) return;

    console.log('Setting up realtime subscription for conversations');

    // Subscribe to new conversations
    const conversationsSubscription = supabase
      .channel('conversations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `or(participant_1.eq.${currentUserId},participant_2.eq.${currentUserId})`,
        },
        (payload) => {
          console.log('Conversation updated:', payload);
          // Reload conversations when there's any change
          loadConversations();
        }
      )
      .subscribe();

    // Subscribe to new messages (to update last message)
    const messagesSubscription = supabase
      .channel('messages_list')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          console.log('New message in any conversation:', payload.new);
          // Reload conversations to update last message and unread count
          loadConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          console.log('Message updated in any conversation:', payload.new);
          // Reload conversations to update unread count
          loadConversations();
        }
      )
      .subscribe();

    // Cleanup subscriptions
    return () => {
      console.log('Cleaning up conversations realtime subscriptions');
      conversationsSubscription.unsubscribe();
      messagesSubscription.unsubscribe();
    };
  }, [currentUserId]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/auth/login");
        return;
      }
      setCurrentUserId(user.id);

      // Load conversations with last message
      const { data: convData, error: convError } = await supabase
        .from("conversations")
        .select(`
          id,
          participant_1,
          participant_2,
          last_message_at,
          last_message_id
        `)
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
        .order("last_message_at", { ascending: false });

      if (convError) {
        console.error("Error loading conversations:", convError);
        return;
      }

      if (!convData || convData.length === 0) {
        setConversations([]);
        return;
      }

      // Get other participants' profiles
      const otherUserIds = convData.map(conv => 
        conv.participant_1 === user.id ? conv.participant_2 : conv.participant_1
      );

      const { data: profiles, error: profileError } = await supabase
        .from("user_profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", otherUserIds);

      if (profileError) {
        console.error("Error loading profiles:", profileError);
      }

      // Get last messages
      const messageIds = convData
        .filter(conv => conv.last_message_id)
        .map(conv => conv.last_message_id);

      let lastMessages: any[] = [];
      if (messageIds.length > 0) {
        const { data: msgData, error: msgError } = await supabase
          .from("messages")
          .select("id, content, sender_id")
          .in("id", messageIds);

        if (!msgError) {
          lastMessages = msgData || [];
        }
      }

      // Get unread counts
      const unreadCounts = await Promise.all(
        convData.map(async (conv) => {
          const { count } = await supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("conversation_id", conv.id)
            .neq("sender_id", user.id)
            .eq("is_read", false);
          
          return { conversation_id: conv.id, count: count || 0 };
        })
      );

      // Combine all data
      const conversationsWithData = convData.map(conv => {
        const otherUserId = conv.participant_1 === user.id ? conv.participant_2 : conv.participant_1;
        const otherUser = profiles?.find(p => p.user_id === otherUserId);
        const lastMessage = lastMessages.find(msg => msg.id === conv.last_message_id);
        const unreadCount = unreadCounts.find(uc => uc.conversation_id === conv.id)?.count || 0;

        return {
          ...conv,
          other_user: otherUser,
          last_message: lastMessage,
          unread_count: unreadCount,
        };
      });

      setConversations(conversationsWithData);

    } catch (error: any) {
      console.error("Error loading conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  };

  const renderConversation = ({ item }: { item: Conversation }) => {
    if (!item.other_user) return null;

    const displayName = item.other_user.display_name || "Chưa đặt tên";
    const lastMessageText = item.last_message 
      ? (item.last_message.sender_id === currentUserId ? "Bạn: " : "") + item.last_message.content
      : "Bắt đầu cuộc trò chuyện";
    
    const messageTime = new Date(item.last_message_at).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
    });

    return (
      <Pressable
        style={styles.conversationCard}
        onPress={() => router.push(`/chat/${item.other_user?.user_id}` as any)}
      >
        <View style={styles.avatarContainer}>
          {item.other_user.avatar_url ? (
            <Image source={{ uri: item.other_user.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={24} color="#9ca3af" />
            </View>
          )}
          {item.unread_count && item.unread_count > 0 && (
            <View style={styles.unreadBadge}>
              <ThemedText style={styles.unreadBadgeText}>
                {item.unread_count > 99 ? "99+" : item.unread_count}
              </ThemedText>
            </View>
          )}
        </View>

        <View style={styles.conversationInfo}>
          <View style={styles.conversationHeader}>
            <ThemedText style={styles.conversationName} numberOfLines={1}>
              {displayName}
            </ThemedText>
            <ThemedText style={styles.conversationTime}>
              {messageTime}
            </ThemedText>
          </View>
          <ThemedText 
            style={[
              styles.lastMessage,
              (item.unread_count && item.unread_count > 0) ? styles.lastMessageUnread : null
            ]} 
            numberOfLines={2}
          >
            {lastMessageText}
          </ThemedText>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <ThemedText style={styles.headerTitle}>Tin nhắn</ThemedText>
          {/* Realtime status indicator */}
          <View style={styles.realtimeStatus}>
            <View style={[styles.realtimeDot, currentUserId && styles.realtimeDotActive]} />
            <ThemedText style={styles.realtimeText}>
              {currentUserId ? 'Realtime' : 'Offline'}
            </ThemedText>
          </View>
        </View>
        <Link href="/tab/profile" asChild>
          <Pressable style={styles.profileButton}>
            <Ionicons name="person-circle-outline" size={28} color="#6366f1" />
          </Pressable>
        </Link>
      </View>

      {/* Conversations List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversation}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="chatbubbles-outline" size={64} color="#d1d5db" />
              </View>
              <ThemedText style={styles.emptyTitle}>Chưa có tin nhắn</ThemedText>
              <ThemedText style={styles.emptyDescription}>
                Bắt đầu trò chuyện với bạn bè từ trang Bạn bè
              </ThemedText>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fafafa",
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: isSmallScreen ? 16 : isMediumScreen ? 20 : 24,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: isSmallScreen ? 24 : isMediumScreen ? 26 : 28,
    fontWeight: "900",
    letterSpacing: -1,
    marginBottom: 4,
  },
  realtimeStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  realtimeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#9ca3af",
  },
  realtimeDotActive: {
    backgroundColor: "#22c55e",
  },
  realtimeText: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "600",
  },
  profileButton: {
    padding: 4,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // List
  listContent: {
    padding: isSmallScreen ? 16 : isMediumScreen ? 20 : 24,
    gap: 12,
  },

  // Conversation Card
  conversationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: isSmallScreen ? 12 : isMediumScreen ? 14 : 16,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: isSmallScreen ? 48 : isMediumScreen ? 52 : 56,
    height: isSmallScreen ? 48 : isMediumScreen ? 52 : 56,
    borderRadius: isSmallScreen ? 24 : isMediumScreen ? 26 : 28,
    borderWidth: 2,
    borderColor: "#fff",
  },
  avatarPlaceholder: {
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#ef4444",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  unreadBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },
  conversationInfo: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  conversationName: {
    fontSize: isSmallScreen ? 16 : isMediumScreen ? 17 : 18,
    fontWeight: "700",
    flex: 1,
    marginRight: 8,
  },
  conversationTime: {
    fontSize: 12,
    color: "#9ca3af",
    fontWeight: "600",
  },
  lastMessage: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 18,
  },
  lastMessageUnread: {
    fontWeight: "700",
    color: "#374151",
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: isSmallScreen ? 100 : isMediumScreen ? 110 : 120,
    height: isSmallScreen ? 100 : isMediumScreen ? 110 : 120,
    borderRadius: isSmallScreen ? 50 : isMediumScreen ? 55 : 60,
    backgroundColor: "#f9fafb",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    borderWidth: 3,
    borderColor: "#f3f4f6",
  },
  emptyTitle: {
    fontSize: isSmallScreen ? 18 : isMediumScreen ? 20 : 22,
    fontWeight: "900",
    marginBottom: 8,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  emptyDescription: {
    fontSize: isSmallScreen ? 14 : isMediumScreen ? 14 : 15,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 22,
  },
});