import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import useRealtimeMessages from "@/hooks/useRealtimeMessages";
import { supabase } from "@/lib/supabase";

const { width: screenWidth } = Dimensions.get("window");
const isSmallScreen = screenWidth < 375;

type Message = {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  is_read: boolean;
};

type UserProfile = {
  user_id: string;
  display_name: string;
  avatar_url: string;
  email: string;
};

export default function ChatScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const flatListRef = useRef<FlatList>(null);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [friendProfile, setFriendProfile] = useState<UserProfile | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (userId) {
      loadChatData();
    }
  }, [userId]);

  // Realtime subscription for new messages
  const handleNewMessage = useCallback((message: Message) => {
    console.log('📨 Adding new message to state:', message);
    setMessages(prev => {
      // Check if message already exists to avoid duplicates
      const exists = prev.some(m => m.id === message.id);
      if (exists) return prev;
      
      return [...prev, message];
    });
    
    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  const handleMessageUpdate = useCallback((message: Message) => {
    console.log('📝 Updating message in state:', message);
    setMessages(prev => 
      prev.map(msg => 
        msg.id === message.id ? message : msg
      )
    );
  }, []);

  // Use realtime hook
  const { isConnected } = useRealtimeMessages({
    conversationId,
    currentUserId,
    onNewMessage: handleNewMessage,
    onMessageUpdate: handleMessageUpdate,
  });

  // Debug: Log when realtime connection changes
  useEffect(() => {
    console.log('🔗 Realtime connection status:', isConnected ? 'CONNECTED' : 'DISCONNECTED');
  }, [isConnected]);

  // Handle typing indicator
  const handleTyping = useCallback(() => {
    if (!conversationId || !currentUserId) return;
    
    setIsTyping(true);
    
    // Send typing event
    supabase.channel(`conversation_${conversationId}`)
      .send({
        type: 'broadcast',
        event: 'typing',
        payload: { user_id: currentUserId, typing: true }
      });
    
    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Stop typing after 2 seconds
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      supabase.channel(`conversation_${conversationId}`)
        .send({
          type: 'broadcast',
          event: 'typing',
          payload: { user_id: currentUserId, typing: false }
        });
    }, 2000);
  }, [conversationId, currentUserId]);

  // Listen for typing events
  useEffect(() => {
    if (!conversationId || !currentUserId) return;

    const channel = supabase.channel(`typing_${conversationId}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { user_id, typing } = payload.payload;
        if (user_id !== currentUserId) {
          setOtherUserTyping(typing);
        }
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [conversationId, currentUserId]);

  const loadChatData = async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/auth/login");
        return;
      }
      
      setCurrentUserId(user.id);

      // Load friend profile
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("user_id, display_name, avatar_url, email")
        .eq("user_id", userId)
        .single();

      if (profileError) {
        console.error("Error loading friend profile:", profileError);
        Alert.alert("Lỗi", "Không thể tải thông tin bạn bè");
        return;
      }

      setFriendProfile(profile);

      // Get or create conversation
      const { data: convId, error: convError } = await supabase.rpc(
        'get_or_create_conversation',
        { user1_id: user.id, user2_id: userId }
      );

      if (convError) {
        console.error("Error getting conversation:", convError);
        Alert.alert("Lỗi", "Không thể tạo cuộc trò chuyện");
        return;
      }

      setConversationId(convId);

      // Load messages
      await loadMessages(convId);

      // Mark messages as read
      await markMessagesAsRead(convId, user.id);

    } catch (error: any) {
      console.error("Error loading chat data:", error);
      Alert.alert("Lỗi", "Không thể tải dữ liệu chat");
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (convId: number) => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(100);

    if (error) {
      console.error("Error loading messages:", error);
      return;
    }

    setMessages(data || []);
    
    // Scroll to bottom after loading
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: false });
    }, 100);
  };

  const markMessagesAsRead = async (convId: number, userId: string) => {
    await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("conversation_id", convId)
      .neq("sender_id", userId)
      .eq("is_read", false);
  };

  const markMessageAsRead = async (messageId: string) => {
    await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("id", messageId);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !conversationId || !currentUserId || sending) return;

    try {
      setSending(true);
      console.log('📤 Sending message:', newMessage.trim());
      
      const { data, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: currentUserId,
          content: newMessage.trim(),
          message_type: 'text'
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error sending message:', error);
        throw error;
      }

      console.log('✅ Message sent successfully:', data);
      
      // Clear input
      setNewMessage("");

    } catch (error: any) {
      console.error("Error sending message:", error);
      Alert.alert("Lỗi", "Không thể gửi tin nhắn: " + error.message);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMyMessage = item.sender_id === currentUserId;
    const messageTime = new Date(item.created_at).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });

    return (
      <View style={[styles.messageContainer, isMyMessage && styles.myMessageContainer]}>
        <View style={[styles.messageBubble, isMyMessage ? styles.myMessageBubble : styles.friendMessageBubble]}>
          <ThemedText style={[styles.messageText, isMyMessage && styles.myMessageText]}>
            {item.content}
          </ThemedText>
          <ThemedText style={[styles.messageTime, isMyMessage && styles.myMessageTime]}>
            {messageTime}
          </ThemedText>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <Stack.Screen options={{ title: "Đang tải..." }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen 
        options={{ 
          title: friendProfile?.display_name || "Chat",
          headerRight: () => (
            <View style={styles.headerRight}>
              {/* Connection status indicator */}
              <View style={[styles.connectionIndicator, isConnected && styles.connectionIndicatorConnected]}>
                <View style={[styles.connectionDot, isConnected && styles.connectionDotConnected]} />
              </View>
              {/* Debug info */}
              <ThemedText style={styles.debugText}>
                {isConnected ? '🟢' : '🔴'}
              </ThemedText>
              <Pressable
                onPress={() => router.push(`/friend-profile/${userId}` as any)}
                style={styles.headerButton}
              >
                <Ionicons name="person-circle-outline" size={28} color="#6366f1" />
              </Pressable>
            </View>
          )
        }} 
      />

      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="chatbubbles-outline" size={64} color="#d1d5db" />
              </View>
              <ThemedText style={styles.emptyTitle}>Bắt đầu cuộc trò chuyện</ThemedText>
              <ThemedText style={styles.emptyDescription}>
                Gửi tin nhắn đầu tiên cho {friendProfile?.display_name}
              </ThemedText>
            </View>
          }
          ListFooterComponent={
            otherUserTyping ? (
              <View style={styles.typingIndicator}>
                <View style={styles.typingBubble}>
                  <View style={styles.typingDots}>
                    <View style={[styles.typingDot, styles.typingDot1]} />
                    <View style={[styles.typingDot, styles.typingDot2]} />
                    <View style={[styles.typingDot, styles.typingDot3]} />
                  </View>
                </View>
              </View>
            ) : null
          }
        />

        {/* Message Input */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              placeholder="Nhập tin nhắn..."
              value={newMessage}
              onChangeText={(text) => {
                setNewMessage(text);
                handleTyping();
              }}
              multiline
              maxLength={1000}
            />
            <Pressable
              onPress={sendMessage}
              disabled={!newMessage.trim() || sending}
              style={[
                styles.sendButton,
                (!newMessage.trim() || sending) && styles.sendButtonDisabled
              ]}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={20} color="#fff" />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fafafa",
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerButton: {
    padding: 4,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  connectionIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  connectionIndicatorConnected: {
    backgroundColor: "#dcfce7",
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#9ca3af",
  },
  connectionDotConnected: {
    backgroundColor: "#22c55e",
  },
  debugText: {
    fontSize: 12,
    fontWeight: "600",
  },

  // Messages
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  messageContainer: {
    marginBottom: 12,
    alignItems: "flex-start",
  },
  myMessageContainer: {
    alignItems: "flex-end",
  },
  messageBubble: {
    maxWidth: "80%",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  friendMessageBubble: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  myMessageBubble: {
    backgroundColor: "#6366f1",
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    color: "#111827",
  },
  myMessageText: {
    color: "#fff",
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
    color: "#9ca3af",
  },
  myMessageTime: {
    color: "rgba(255,255,255,0.7)",
  },

  // Input
  inputContainer: {
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    backgroundColor: "#f9fafb",
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#6366f1",
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#d1d5db",
  },

  // Typing Indicator
  typingIndicator: {
    marginBottom: 12,
    alignItems: "flex-start",
  },
  typingBubble: {
    backgroundColor: "#fff",
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  typingDots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#9ca3af",
  },
  typingDot1: {
    animationDelay: "0ms",
  },
  typingDot2: {
    animationDelay: "150ms",
  },
  typingDot3: {
    animationDelay: "300ms",
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#f9fafb",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    borderWidth: 3,
    borderColor: "#f3f4f6",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyDescription: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 20,
  },
});