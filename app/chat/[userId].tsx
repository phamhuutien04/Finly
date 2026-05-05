import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Appearance,
    Dimensions,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    TextInput,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import useRealtimeMessages from "@/hooks/useRealtimeMessages";
import { showError, showSuccess, showWarning } from "@/lib/globalAlert";
import { supabase } from "@/lib/supabase";

// Simple hook to get color scheme that works on all platforms
function useColorScheme() {
  const [colorScheme, setColorScheme] = useState(Appearance.getColorScheme());
  
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setColorScheme(colorScheme);
    });
    
    return () => subscription.remove();
  }, []);
  
  return colorScheme;
}

const { width: screenWidth } = Dimensions.get("window");
const isSmallScreen = screenWidth < 375;

type Message = {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  is_read: boolean;
  message_type?: string;
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
  
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // Theme colors
  const screenBg = isDark ? '#111827' : '#fafafa';
  const cardBg = isDark ? '#1f2937' : '#ffffff';
  const text = isDark ? '#f9fafb' : '#1f2937';
  const subtleText = isDark ? '#9ca3af' : '#6b7280';
  const borderColor = isDark ? '#374151' : '#e5e7eb';
  const inputBg = isDark ? '#1f2937' : '#f9fafb';
  const accentColor = '#6366f1';
  const emptyIconBg = isDark ? '#1f2937' : '#f9fafb';
  const messageBubbleFriend = isDark ? '#1f2937' : '#ffffff';
  const messageTextFriend = isDark ? '#f9fafb' : '#111827';

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

  // Money request states
  const [showMoneyRequestModal, setShowMoneyRequestModal] = useState(false);
  const [requestAmount, setRequestAmount] = useState("");
  const [requestReason, setRequestReason] = useState("");
  const [sendingRequest, setSendingRequest] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [processedRequests, setProcessedRequests] = useState<Set<string>>(new Set());

  // Add state to track processed status for each message
  const [messageProcessedStatus, setMessageProcessedStatus] = useState<Record<string, boolean>>({});

  // Format number with thousand separators
  const formatNumber = (value: string) => {
    // Remove all non-digit characters
    const numbers = value.replace(/[^\d]/g, '');
    if (!numbers) return '';
    
    // Add thousand separators
    return parseInt(numbers, 10).toLocaleString('vi-VN');
  };

  const handleAmountChange = (text: string) => {
    const formatted = formatNumber(text);
    setRequestAmount(formatted);
  };

  // Check processed status when messages load or update
  useEffect(() => {
    const checkAllMessageStatus = async () => {
      if (!messages.length || !currentUserId || !userId) return;

      try {
        const statusChecks = messages
          .filter(msg => msg.content.includes('💸 Yêu cầu thanh toán:'))
          .map(async (msg) => {
            try {
              const isProcessed = await checkIfRequestProcessed(msg.content, msg.id);
              return { messageId: msg.id, isProcessed };
            } catch (error) {
              console.error("Error checking message status:", error);
              return { messageId: msg.id, isProcessed: false };
            }
          });

        const results = await Promise.all(statusChecks);
        const statusMap: Record<string, boolean> = {};
        results.forEach(({ messageId, isProcessed }) => {
          statusMap[messageId] = isProcessed;
        });

        setMessageProcessedStatus(statusMap);
      } catch (error) {
        console.error("Error checking all message status:", error);
      }
    };

    checkAllMessageStatus();
  }, [messages, currentUserId, userId]);

  useEffect(() => {
    if (userId) {
      loadChatData();
    }
  }, [userId]);

  // Listen for new transactions to update payment status
  useEffect(() => {
    if (!currentUserId || !userId) return;

    const channel = supabase
      .channel('transaction-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=in.(${currentUserId},${userId})`
        },
        async (payload) => {
          console.log('🔔 New transaction detected:', payload);
          
          // Check if it's a payment transaction
          const transaction = payload.new as any;
          if (transaction.note?.includes('Trả tiền cho bạn bè') || transaction.note?.includes('Nhận tiền từ bạn bè')) {
            console.log('💰 Payment transaction detected, refreshing status...');
            
            // Wait a bit for both transactions to be created
            setTimeout(async () => {
              // Refresh all message statuses
              const statusChecks = messages
                .filter(msg => msg.content.includes('💸 Yêu cầu thanh toán:'))
                .map(async (msg) => {
                  try {
                    const isProcessed = await checkIfRequestProcessed(msg.content, msg.id);
                    return { messageId: msg.id, isProcessed };
                  } catch (error) {
                    console.error("Error checking message status:", error);
                    return { messageId: msg.id, isProcessed: false };
                  }
                });

              const results = await Promise.all(statusChecks);
              const statusMap: Record<string, boolean> = {};
              results.forEach(({ messageId, isProcessed }) => {
                statusMap[messageId] = isProcessed;
              });

              setMessageProcessedStatus(prev => ({ ...prev, ...statusMap }));
              console.log('✅ Status refreshed:', statusMap);
            }, 2000); // Wait 2 seconds for both transactions
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [currentUserId, userId, messages]);

  // Realtime subscription for new messages
  const handleNewMessage = useCallback((message: Message) => {
    console.log('📨 Adding new message to state:', message);
    setMessages(prev => {
      // Check if message already exists to avoid duplicates
      const exists = prev.some(m => m.id === message.id);
      if (exists) {
        console.log('⚠️ Message already exists, skipping:', message.id);
        return prev;
      }
      
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

  const sendMoneyRequest = async () => {
    if (!requestAmount.trim() || !conversationId || !currentUserId || sendingRequest) return;

    // Parse the formatted amount (remove dots)
    const amount = parseFloat(requestAmount.replace(/\./g, ''));
    if (isNaN(amount) || amount <= 0) {
      showError("Lỗi", "Vui lòng nhập số tiền hợp lệ");
      return;
    }

    if (!selectedCategory) {
      showError("Lỗi", "Vui lòng chọn danh mục");
      return;
    }

    try {
      setSendingRequest(true);
      
      // Include category_id in the message content for accurate tracking
      const requestContent = `💸 Yêu cầu thanh toán: ${requestAmount} VND${requestReason.trim() ? ` - ${requestReason.trim()}` : ''} (${selectedCategory.name}) [CAT:${selectedCategory.id}]`;
      
      const { data, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: currentUserId,
          content: requestContent,
          message_type: 'text'
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error sending money request:', error);
        throw error;
      }

      console.log('✅ Money request sent successfully:', data);
      
      // Clear form and close modal
      setRequestAmount("");
      setRequestReason("");
      setSelectedCategory(null);
      setShowMoneyRequestModal(false);
      
      showSuccess("Thành công", "Đã gửi yêu cầu thanh toán!");

    } catch (error: any) {
      console.error("Error sending money request:", error);
      showError("Lỗi", "Không thể gửi yêu cầu thanh toán: " + error.message);
    } finally {
      setSendingRequest(false);
    }
  };

  const loadCategories = async () => {
    if (!currentUserId) return;
    
    try {
      setLoadingCategories(true);
      // Only load expense categories for money requests
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, emoji, type")
        .eq("user_id", currentUserId)
        .eq("type", "expense") // Only expense categories
        .order("name");

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error("Error loading categories:", error);
    } finally {
      setLoadingCategories(false);
    }
  };

  const checkIfRequestProcessed = async (messageContent: string, messageId: string) => {
    if (!currentUserId || !userId) return false;

    try {
      // Only check for transactions with related_message_id
      // This ensures accurate tracking without false positives
      const { data: relatedTransactions, error: relatedError } = await supabase
        .from("transactions")
        .select("id, user_id, type")
        .eq("related_message_id", messageId)
        .limit(2);

      if (relatedError) {
        console.error("Error checking related transactions:", relatedError);
        return false;
      }

      if (relatedTransactions && relatedTransactions.length > 0) {
        console.log(`✅ Found ${relatedTransactions.length} transactions for message ${messageId}`);
        return true;
      }

      console.log(`⚠️ No transactions found for message ${messageId}`);
      return false;
    } catch (error) {
      console.error("Error checking request status:", error);
      return false;
    }
  };

  const handlePayMoneyRequest = async (messageContent: string, messageId: string) => {
    if (!currentUserId || !conversationId) return;

    // Check if already processed by looking for existing transaction
    const isAlreadyProcessed = await checkIfRequestProcessed(messageContent, messageId);
    if (isAlreadyProcessed) {
      showWarning("Thông báo", "Yêu cầu này đã được thanh toán rồi");
      return;
    }

    try {
      // Parse amount, category name, and category_id from message content
      const amountMatch = messageContent.match(/(\d{1,3}(?:\.\d{3})*)\s*VND/);
      const categoryMatch = messageContent.match(/\(([^)]+)\)\s*\[CAT:(\d+)\]/);
      
      console.log('Message content:', messageContent);
      console.log('Amount match:', amountMatch);
      console.log('Category match:', categoryMatch);
      
      if (!amountMatch || !categoryMatch) {
        showError("Lỗi", "Không thể xử lý yêu cầu thanh toán - không tìm thấy thông tin đầy đủ");
        return;
      }

      // Handle Vietnamese number format (dots as thousand separators)
      const amountString = amountMatch[1].replace(/\./g, '');
      const amount = parseInt(amountString, 10);
      const categoryName = categoryMatch[1];
      const requestCategoryId = parseInt(categoryMatch[2], 10);
      const requesterUserId = userId; // Friend who requested money

      console.log('Raw amount string:', amountMatch[1]);
      console.log('Cleaned amount string:', amountString);
      console.log('Parsed amount number:', amount);
      console.log('Category name:', categoryName);
      console.log('Request category ID:', requestCategoryId);
      console.log('Requester user ID:', requesterUserId);

      if (isNaN(amount) || amount <= 0) {
        showError("Lỗi", `Số tiền không hợp lệ: ${amount}`);
        return;
      }

      // Create transactions for both users
      await createPaymentTransactions(amount, categoryName, requesterUserId, messageId, requestCategoryId);
      
      // Update both local state and processed status immediately
      setProcessedRequests(prev => new Set([...prev, messageId]));
      setMessageProcessedStatus(prev => ({ ...prev, [messageId]: true }));
      
      // Force refresh the message status for both users
      setTimeout(async () => {
        const statusChecks = messages
          .filter(msg => msg.content.includes('💸 Yêu cầu thanh toán:'))
          .map(async (msg) => {
            try {
              const isProcessed = await checkIfRequestProcessed(msg.content, msg.id);
              return { messageId: msg.id, isProcessed };
            } catch (error) {
              console.error("Error checking message status:", error);
              return { messageId: msg.id, isProcessed: false };
            }
          });

        const results = await Promise.all(statusChecks);
        const statusMap: Record<string, boolean> = {};
        results.forEach(({ messageId, isProcessed }) => {
          statusMap[messageId] = isProcessed;
        });

        setMessageProcessedStatus(prev => ({ ...prev, ...statusMap }));
      }, 1000);
      
      showSuccess("Thành công", "Đã thanh toán thành công!");

    } catch (error: any) {
      console.error("Error processing payment:", error);
      showError("Lỗi", "Không thể xử lý thanh toán: " + error.message);
    }
  };

  const createPaymentTransactions = async (amount: number, categoryName: string, requesterUserId: string, messageId: string, requestCategoryId: number) => {
    // Get current date
    const transactionDate = new Date().toISOString();

    // 1. Tạo giao dịch thu nhập cho người yêu cầu (requester) - sử dụng đúng category_id của họ
    await createTransactionForUser(requesterUserId, amount, "income", categoryName, `Nhận tiền từ bạn bè`, transactionDate, messageId, requestCategoryId);

    // 2. Tạo giao dịch chi tiêu cho người trả tiền (current user) - tìm hoặc tạo category tương ứng
    await createTransactionForUser(currentUserId!, amount, "expense", categoryName, `Trả tiền cho bạn bè`, transactionDate, messageId);

    // 3. Send a status update message to trigger realtime sync (hidden message)
    const statusMessage = `✅ Thanh toán hoàn tất: ${amount.toLocaleString('vi-VN')} VND (${categoryName})`;
    
    await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: currentUserId,
        content: statusMessage,
        message_type: 'text'
      });
  };

  const createTransactionForUser = async (userId: string, amount: number, type: "income" | "expense", categoryName: string, note: string, transactionDate: string, messageId: string, existingCategoryId?: number) => {
    try {
      console.log(`Creating transaction for user ${userId}:`, {
        amount,
        type,
        categoryName,
        note,
        messageId,
        existingCategoryId
      });

      // Use existing category ID if provided, otherwise find or create
      let categoryId: number;
      if (existingCategoryId) {
        categoryId = existingCategoryId;
        console.log(`Using existing category ID: ${categoryId}`);
      } else {
        categoryId = await findOrCreateCategory(userId, categoryName, type);
        console.log(`Found/created category ID: ${categoryId}`);
      }

      const transactionAmount = Math.abs(amount);
      console.log(`Final transaction amount: ${transactionAmount}`);

      if (transactionAmount <= 0) {
        throw new Error(`Invalid amount: ${transactionAmount}`);
      }

      // Create transaction - amount should always be positive
      const insertData = {
        user_id: userId,
        category_id: categoryId,
        amount: transactionAmount,
        type: type,
        note: note,
        transaction_date: transactionDate,
        occurred_at: transactionDate,
        related_message_id: messageId // Link to the money request message
      };

      console.log('Inserting transaction data:', insertData);

      const { data, error } = await supabase
        .from("transactions")
        .insert(insertData)
        .select();

      if (error) {
        console.error(`Transaction insert error:`, error);
        throw error;
      }

      console.log(`✅ Transaction created successfully:`, data);

      console.log(`✅ Transaction created successfully for user ${userId}`);
    } catch (error) {
      console.error(`Error creating transaction for user ${userId}:`, error);
      throw error;
    }
  };

  const findOrCreateCategory = async (userId: string, categoryName: string, type: "income" | "expense") => {
    try {
      // Try to find existing category with same name and type
      const { data: existingCategory } = await supabase
        .from("categories")
        .select("id")
        .eq("user_id", userId)
        .eq("name", categoryName)
        .eq("type", type)
        .single();

      if (existingCategory) {
        return existingCategory.id;
      }

      // Try to create new category with same name
      const { data: newCategory, error: createError } = await supabase
        .from("categories")
        .insert({
          user_id: userId,
          name: categoryName,
          type: type,
          emoji: "💰",
          icon_preset_id: "other"
        })
        .select("id")
        .single();

      if (!createError && newCategory) {
        return newCategory.id;
      }

      // Fallback to "Khác" category
      const { data: otherCategory } = await supabase
        .from("categories")
        .select("id")
        .eq("user_id", userId)
        .eq("name", "Khác")
        .eq("type", type)
        .single();

      if (otherCategory) {
        return otherCategory.id;
      }

      // Create "Khác" category as final fallback
      const { data: createdOther } = await supabase
        .from("categories")
        .insert({
          user_id: userId,
          name: "Khác",
          type: type,
          emoji: "📝",
          icon_preset_id: "other"
        })
        .select("id")
        .single();

      return createdOther?.id;
    } catch (error) {
      console.error("Error finding/creating category:", error);
      throw error;
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMyMessage = item.sender_id === currentUserId;
    const messageTime = new Date(item.created_at).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const isMoneyRequest = item.content.includes('💸 Yêu cầu thanh toán:');
    const isPaymentComplete = item.content.includes('✅ Thanh toán hoàn tất:');
    const isProcessedLocally = processedRequests.has(item.id);
    const isProcessedInDB = messageProcessedStatus[item.id] || false;
    const isProcessed = isProcessedLocally || isProcessedInDB;

    // Don't show payment complete messages as separate bubbles
    if (isPaymentComplete) {
      return null;
    }

    return (
      <View style={[styles.messageContainer, isMyMessage && styles.myMessageContainer]}>
        <View style={[
          styles.messageBubble, 
          isMyMessage ? styles.myMessageBubble : [styles.friendMessageBubble, { backgroundColor: messageBubbleFriend }],
          isMoneyRequest && !isMyMessage && [styles.moneyRequestBubble, { backgroundColor: cardBg }], // Use cardBg for received requests
          isProcessed && isMyMessage && isMoneyRequest && styles.myProcessedRequestBubble,
          isProcessed && !isMyMessage && isMoneyRequest && [styles.processedRequestBubble, { backgroundColor: cardBg }]
        ]}>
          {isMoneyRequest && (
            <View style={styles.moneyRequestHeader}>
              <Ionicons 
                name={isProcessed ? "checkmark-circle" : "card-outline"} 
                size={16} 
                color={isMyMessage ? (isProcessed ? "#10b981" : "#fff") : (isDark ? "#f9fafb" : "#000000")} 
              />
              <ThemedText style={[
                styles.moneyRequestLabel, 
                isMyMessage ? (isProcessed ? styles.myProcessedRequestLabel : styles.myMessageText) : [styles.friendRequestLabel, { color: isDark ? '#f9fafb' : '#000000' }]
              ]}>
                {isMyMessage 
                  ? (isProcessed ? "ĐÃ ĐƯỢC THANH TOÁN" : "ĐANG CHỜ THANH TOÁN") 
                  : (isProcessed ? "ĐÃ THANH TOÁN" : "YÊU CẦU THANH TOÁN")
                }
              </ThemedText>
            </View>
          )}
          <ThemedText style={[
            styles.messageText, 
            { color: messageTextFriend },
            isMyMessage && !isMoneyRequest && styles.myMessageText, // White text for my normal messages
            isMyMessage && isMoneyRequest && !isProcessed && styles.myMessageText, // White text for my pending money requests
            isMyMessage && isMoneyRequest && isProcessed && styles.myProcessedMessageText, // Dark green for my processed requests
            !isMyMessage && isMoneyRequest && [styles.moneyRequestText, { color: isDark ? '#f9fafb' : '#000000' }], // Dynamic text for received money requests
          ]}>
            {item.content.replace(/\s*\[CAT:\d+\]/, '')}
          </ThemedText>
          {isMoneyRequest && !isMyMessage && !isProcessed && (
            <View style={styles.moneyRequestActions}>
              <Pressable 
                style={styles.payButtonFull}
                onPress={() => handlePayMoneyRequest(item.content, item.id)}
              >
                <ThemedText style={styles.payButtonText}>Thanh toán</ThemedText>
              </Pressable>
            </View>
          )}
          {isMoneyRequest && !isMyMessage && isProcessed && (
            <View style={styles.processedIndicator}>
              <Ionicons name="checkmark-circle" size={16} color={isDark ? "#f9fafb" : "#000000"} />
              <ThemedText style={[styles.processedText, { color: isDark ? '#f9fafb' : '#000000' }]}>
                Đã thanh toán
              </ThemedText>
            </View>
          )}
          <ThemedText style={[
            styles.messageTime, 
            isMyMessage && !isMoneyRequest && styles.myMessageTime, // White time for my normal messages
            isMyMessage && isMoneyRequest && !isProcessed && styles.myMessageTime, // White time for my pending requests
            isMyMessage && isMoneyRequest && isProcessed && { color: "#065f46", opacity: 0.7 }, // Dark green time for my processed requests
            !isMyMessage && isMoneyRequest && { color: isDark ? '#f9fafb' : '#000000', opacity: 0.6 } // Dynamic time for received money requests
          ]}>
            {messageTime}
          </ThemedText>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: screenBg }]}>
        <Stack.Screen options={{ title: "Đang tải..." }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={accentColor} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: screenBg }]}>
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
                onPress={() => router.push(`/profile/${userId}` as any)}
                style={styles.headerButton}
              >
                <Ionicons name="person-circle-outline" size={28} color={accentColor} />
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
              <View style={[styles.emptyIconContainer, { backgroundColor: emptyIconBg, borderColor: borderColor }]}>
                <Ionicons name="chatbubbles-outline" size={64} color={subtleText} />
              </View>
              <ThemedText style={[styles.emptyTitle, { color: text }]}>Bắt đầu cuộc trò chuyện</ThemedText>
              <ThemedText style={[styles.emptyDescription, { color: subtleText }]}>
                Gửi tin nhắn đầu tiên cho {friendProfile?.display_name}
              </ThemedText>
            </View>
          }
          ListFooterComponent={
            otherUserTyping ? (
              <View style={styles.typingIndicator}>
                <View style={[styles.typingBubble, { backgroundColor: messageBubbleFriend }]}>
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
        <View style={[styles.inputContainer, { backgroundColor: cardBg, borderTopColor: borderColor }]}>
          <View style={styles.inputWrapper}>
            <Pressable
              onPress={() => {
                setShowMoneyRequestModal(true);
                loadCategories();
              }}
              style={styles.moneyButton}
            >
              <Ionicons name="card-outline" size={20} color={accentColor} />
            </Pressable>
            <TextInput
              style={[styles.textInput, { borderColor: borderColor, backgroundColor: inputBg, color: text }]}
              placeholder="Nhập tin nhắn..."
              placeholderTextColor={subtleText}
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

        {/* Money Request Modal */}
        {showMoneyRequestModal && (
          <Modal
            visible={showMoneyRequestModal}
            animationType="fade"
            transparent
            onRequestClose={() => setShowMoneyRequestModal(false)}
          >
            <Pressable 
              style={styles.modalOverlay}
              onPress={() => setShowMoneyRequestModal(false)}
            >
              <Pressable onPress={(e) => e.stopPropagation()}>
                <ThemedView style={[styles.modalContent, { backgroundColor: cardBg }]}>
                  <View style={styles.modalHeader}>
                    <ThemedText style={[styles.modalTitle, { color: text }]}>Yêu cầu thanh toán</ThemedText>
                    <Pressable onPress={() => setShowMoneyRequestModal(false)}>
                      <Ionicons name="close" size={24} color={subtleText} />
                    </Pressable>
                  </View>

                  <View style={styles.modalBody}>
                    <ThemedText style={[styles.label, { color: text }]}>Danh mục</ThemedText>
                    {loadingCategories ? (
                      <View style={styles.categoryLoadingContainer}>
                        <ActivityIndicator size="small" color={accentColor} />
                        <ThemedText style={[styles.categoryLoadingText, { color: subtleText }]}>Đang tải danh mục...</ThemedText>
                      </View>
                    ) : (
                      <View style={styles.categorySelector}>
                        {categories.map((category) => (
                          <Pressable
                            key={category.id}
                            style={[
                              styles.categoryItem,
                              { borderColor: borderColor, backgroundColor: inputBg },
                              selectedCategory?.id === category.id && styles.categoryItemSelected
                            ]}
                            onPress={() => setSelectedCategory(category)}
                          >
                            <ThemedText style={styles.categoryEmoji}>{category.emoji || "📝"}</ThemedText>
                            <ThemedText style={[
                              styles.categoryName,
                              { color: text },
                              selectedCategory?.id === category.id && styles.categoryNameSelected
                            ]}>
                              {category.name}
                            </ThemedText>
                          </Pressable>
                        ))}
                      </View>
                    )}

                    <ThemedText style={[styles.label, { marginTop: 16, color: text }]}>Số tiền</ThemedText>
                    <TextInput
                      style={[styles.amountInput, { color: text, borderBottomColor: accentColor }]}
                      placeholder="0"
                      placeholderTextColor={subtleText}
                      value={requestAmount}
                      onChangeText={handleAmountChange}
                      keyboardType="numeric"
                    />
                    <ThemedText style={[styles.currencyLabel, { color: subtleText }]}>VND</ThemedText>

                    <ThemedText style={[styles.label, { marginTop: 16, color: text }]}>Lý do (tùy chọn)</ThemedText>
                    <TextInput
                      style={[styles.reasonInput, { borderColor: borderColor, color: text }]}
                      placeholder="Ví dụ: Tiền ăn trưa, tiền xăng..."
                      placeholderTextColor={subtleText}
                      value={requestReason}
                      onChangeText={setRequestReason}
                      multiline
                      maxLength={200}
                    />
                  </View>

                  <View style={styles.modalActions}>
                    <Pressable
                      onPress={() => setShowMoneyRequestModal(false)}
                      style={[styles.cancelButton, { backgroundColor: inputBg }]}
                    >
                      <ThemedText style={[styles.cancelButtonText, { color: text }]}>Hủy</ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={sendMoneyRequest}
                      disabled={!requestAmount.trim() || !selectedCategory || sendingRequest}
                      style={[
                        styles.sendRequestButton,
                        { backgroundColor: accentColor },
                        (!requestAmount.trim() || !selectedCategory || sendingRequest) && styles.sendRequestButtonDisabled
                      ]}
                    >
                      {sendingRequest ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <ThemedText style={styles.sendRequestButtonText}>Gửi yêu cầu</ThemedText>
                      )}
                    </Pressable>
                  </View>
                </ThemedView>
              </Pressable>
            </Pressable>
          </Modal>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
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
  },
  moneyRequestText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
  },
  myMessageText: {
    color: "#fff",
  },
  myProcessedMessageText: {
    color: "#065f46", // Dark green text on light green background
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
    opacity: 0.7,
  },
  myMessageTime: {
    color: "#000000", // Black instead of white
    opacity: 0.7,
  },

  // Input
  inputContainer: {
    padding: 16,
    borderTopWidth: 1,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },
  moneyButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f0f9ff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
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

  // Money Request Message Styles
  moneyRequestBubble: {
    borderWidth: 2,
    borderColor: "#6366f1",
  },
  processedRequestBubble: {
    borderColor: "#10b981",
  },
  myProcessedRequestBubble: {
    borderColor: "#10b981",
    backgroundColor: "#d1fae5", // Light green background for my processed requests
  },
  moneyRequestHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  moneyRequestLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  myProcessedRequestLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#065f46", // Dark green text on light green background
    textTransform: "uppercase",
  },
  friendRequestLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  moneyRequestActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  processedIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingVertical: 4,
  },
  processedText: {
    fontSize: 12,
    fontWeight: "600",
  },
  payButton: {
    flex: 1,
    backgroundColor: "#10b981",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  payButtonFull: {
    width: "100%",
    backgroundColor: "#10b981",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  payButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: "#ef4444",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  rejectButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },

  // Money Request Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  modalBody: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
    opacity: 0.8,
  },
  amountInput: {
    fontSize: 32,
    fontWeight: "800",
    textAlign: "center",
    paddingVertical: 16,
    borderBottomWidth: 2,
    marginBottom: 8,
  },
  currencyLabel: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 16,
  },
  reasonInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: "top",
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelButtonText: {
    fontWeight: "700",
  },
  sendRequestButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  sendRequestButtonDisabled: {
    backgroundColor: "#d1d5db",
  },
  sendRequestButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  // Category Selector Styles (moved to avoid duplicate)
  categorySelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  categoryItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  categoryItemSelected: {
    borderColor: "#6366f1",
    backgroundColor: "#f0f9ff",
  },
  categoryEmoji: {
    fontSize: 16,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: "600",
  },
  categoryNameSelected: {
    color: "#6366f1",
  },
  categoryLoadingContainer: {  // Renamed to avoid duplicate
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    gap: 8,
  },
  categoryLoadingText: {  // Renamed to avoid duplicate
    fontSize: 14,
  },

  // Typing Indicator
  typingIndicator: {
    marginBottom: 12,
    alignItems: "flex-start",
  },
  typingBubble: {
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
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    borderWidth: 3,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyDescription: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});