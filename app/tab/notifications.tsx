import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

type Notification = {
  id: string;
  type: "split_transaction" | "friend_request" | "budget_alert";
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  related_user?: {
    user_id?: string;
    display_name: string;
    avatar_url: string;
  };
  transaction_id?: number;
  friendship_id?: string;
  action_taken?: "accepted" | "rejected"; // Track what action was taken
};

export default function NotificationsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadNotifications();
    setupRealtimeSubscription();
  }, []);

  const setupRealtimeSubscription = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    console.log('🔔 Setting up realtime for notifications');

    const channel = supabase
      .channel('notifications_updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'split_transaction_participants',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log('🔔 New split transaction notification:', payload.new);
          // Reload notifications when tagged in transaction
          await loadNotifications();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  };

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/auth/login");
        return;
      }

      // Load split transaction notifications
      const { data: splitData, error: splitError } = await supabase
        .from("split_transaction_participants")
        .select(`
          id,
          transaction_id,
          amount,
          created_at,
          is_creator,
          is_read,
          transaction:transactions (
            id,
            amount,
            note,
            type,
            user_id,
            category_id,
            category:categories (name)
          )
        `)
        .eq("user_id", user.id)
        .eq("is_creator", false)
        .order("created_at", { ascending: false })
        .limit(50);

      if (splitError) throw splitError;

      // Load friend requests
      const { data: friendRequests, error: friendError } = await supabase
        .from("friendships")
        .select("id, user_id, friend_id, status, created_at, is_read")
        .eq("friend_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (friendError) throw friendError;

      // Transform split transactions to notifications
      const splitNotifications: Notification[] = await Promise.all(
        (splitData || []).map(async (item: any) => {
          const tx = item.transaction;
          const categoryName = tx.category?.name || "Khác";
          
          // Get creator info
          const { data: creatorProfile } = await supabase
            .from("user_profiles")
            .select("user_id, display_name, avatar_url")
            .eq("user_id", tx.user_id)
            .single();

          return {
            id: `split_${item.id}`,
            type: "split_transaction" as const,
            title: "Bạn được tag trong giao dịch",
            message: `${creatorProfile?.display_name || "Ai đó"} đã tag bạn trong giao dịch danh mục "${categoryName}" với số tiền ${formatVND(item.amount)}`,
            is_read: item.is_read || false,
            created_at: item.created_at,
            related_user: creatorProfile || undefined,
            transaction_id: tx.id,
          };
        })
      );

      // Transform friend requests to notifications
      const friendNotifications: Notification[] = await Promise.all(
        (friendRequests || []).map(async (item: any) => {
          // Get requester info
          const { data: requesterProfile } = await supabase
            .from("user_profiles")
            .select("user_id, display_name, avatar_url")
            .eq("user_id", item.user_id)
            .single();

          return {
            id: `friend_${item.id}`,
            type: "friend_request" as const,
            title: "Lời mời kết bạn",
            message: `${requesterProfile?.display_name || "Ai đó"} đã gửi lời mời kết bạn cho bạn`,
            is_read: item.is_read || false,
            created_at: item.created_at,
            related_user: requesterProfile || undefined,
            friendship_id: item.id,
          };
        })
      );

      // Combine and sort all notifications
      const allNotifications = [...splitNotifications, ...friendNotifications].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setNotifications(allNotifications);
      
      // Count unread notifications (all are unread for now since we don't have is_read in DB yet)
      setUnreadCount(splitNotifications.filter(n => !n.is_read).length);
    } catch (error: any) {
      console.error("Error loading notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const formatVND = (n: number) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Vừa xong";
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return date.toLocaleDateString("vi-VN");
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "split_transaction":
        return "people";
      case "friend_request":
        return "person-add";
      case "budget_alert":
        return "warning";
      default:
        return "notifications";
    }
  };

  const acceptFriendRequest = async (friendshipId: string, requesterId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Update the request status and mark as read
      const { error: updateError } = await supabase
        .from("friendships")
        .update({ status: "accepted", is_read: true })
        .eq("id", friendshipId);

      if (updateError) throw updateError;

      // Create reverse friendship
      const { error: insertError } = await supabase.from("friendships").insert({
        user_id: user.id,
        friend_id: requesterId,
        status: "accepted",
      });

      if (insertError) {
        console.error("Error creating reverse friendship:", insertError);
      }

      // Mark notification as read and accepted
      setNotifications(prev => prev.map(n => 
        n.id === `friend_${friendshipId}` ? { ...n, is_read: true, action_taken: "accepted" } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));

      Alert.alert("Thành công", "Đã chấp nhận lời mời kết bạn!");
    } catch (error: any) {
      console.error("Error accepting friend request:", error);
      Alert.alert("Lỗi", "Không thể chấp nhận lời mời");
    }
  };

  const rejectFriendRequest = async (friendshipId: string) => {
    try {
      // Mark as read first, then delete
      const { error: readError } = await supabase
        .from("friendships")
        .update({ is_read: true })
        .eq("id", friendshipId);

      if (readError) {
        console.error("Error marking as read:", readError);
      }

      // Delete the friendship request
      const { error } = await supabase
        .from("friendships")
        .delete()
        .eq("id", friendshipId);

      if (error) throw error;

      // Mark notification as read and rejected
      setNotifications(prev => prev.map(n => 
        n.id === `friend_${friendshipId}` ? { ...n, is_read: true, action_taken: "rejected" } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));

      Alert.alert("Đã từ chối", "Đã từ chối lời mời kết bạn");
    } catch (error: any) {
      console.error("Error rejecting friend request:", error);
      Alert.alert("Lỗi", "Không thể từ chối lời mời");
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      // Update the notification as read in local state first
      setNotifications(prev => prev.map(n => 
        n.id === notificationId ? { ...n, is_read: true } : n
      ));

      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1));

      // Update in database
      if (notificationId.startsWith('split_')) {
        const actualId = notificationId.replace('split_', '');
        const { error } = await supabase
          .from('split_transaction_participants')
          .update({ is_read: true })
          .eq('id', actualId);
        
        if (error) {
          console.error('Error updating split notification read status:', error);
        }
      } else if (notificationId.startsWith('friend_')) {
        const actualId = notificationId.replace('friend_', '');
        const { error } = await supabase
          .from('friendships')
          .update({ is_read: true })
          .eq('id', actualId);
        
        if (error) {
          console.error('Error updating friend request read status:', error);
        }
      }
    } catch (error: any) {
      console.error("Error marking notification as read:", error);
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    return (
      <View style={styles.notificationWrapper}>
        <Pressable
          style={[
            styles.notificationCard, 
            !item.is_read && styles.notificationCardUnread
          ]}
          onPress={() => {
            // Handle different notification types
            if (item.type === "split_transaction" && item.transaction_id) {
              // Mark as read (muted)
              if (!item.is_read) {
                markAsRead(item.id);
              }
              // Navigate to transaction detail
              router.push(`/transaction/${item.transaction_id}` as any);
            } else if (item.type === "friend_request" && item.related_user?.user_id) {
              // Mark as read (muted) for friend request too
              if (!item.is_read) {
                markAsRead(item.id);
              }
              // Navigate to friend profile
              router.push(`/friend-profile/${item.related_user.user_id}` as any);
            } else if (item.type !== "friend_request" && !item.is_read) {
              // For other types, just mark as read
              markAsRead(item.id);
            }
          }}
        >
          <View style={styles.notificationIcon}>
            {item.related_user?.avatar_url ? (
              <Image
                source={{ uri: item.related_user.avatar_url }}
                style={styles.userAvatar}
              />
            ) : (
              <View style={styles.iconContainer}>
                <Ionicons
                  name={getNotificationIcon(item.type)}
                  size={24}
                  color="#6366f1"
                />
              </View>
            )}
          </View>

          <View style={styles.notificationContent}>
            <ThemedText style={styles.notificationTitle}>
              {item.title}
            </ThemedText>
            <ThemedText style={styles.notificationMessage}>
              {item.message}
            </ThemedText>
            <ThemedText style={styles.notificationTime}>
              {formatTime(item.created_at)}
            </ThemedText>

            {/* Action buttons for friend requests - inside the card */}
            {item.type === "friend_request" && item.friendship_id && item.related_user?.user_id && (
              <View style={styles.inlineActionButtons}>
                <Pressable
                  style={[
                    styles.inlineAcceptButton,
                    item.action_taken === "accepted" && styles.buttonAccepted
                  ]}
                  onPress={(e) => {
                    e.stopPropagation(); // Prevent navigation to profile
                    if (!item.action_taken) {
                      acceptFriendRequest(item.friendship_id!, item.related_user!.user_id!);
                    }
                  }}
                  disabled={!!item.action_taken}
                >
                  <Ionicons 
                    name={item.action_taken === "accepted" ? "checkmark-circle" : "checkmark"} 
                    size={16} 
                    color={item.action_taken ? "#9ca3af" : "#fff"} 
                  />
                  <ThemedText style={[
                    styles.inlineButtonText, 
                    { color: item.action_taken ? "#9ca3af" : "#fff" }
                  ]}>
                    {item.action_taken === "accepted" ? "Đã chấp nhận" : "Chấp nhận"}
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[
                    styles.inlineRejectButton,
                    item.action_taken === "rejected" && styles.buttonRejected
                  ]}
                  onPress={(e) => {
                    e.stopPropagation(); // Prevent navigation to profile
                    if (!item.action_taken) {
                      rejectFriendRequest(item.friendship_id!);
                    }
                  }}
                  disabled={!!item.action_taken}
                >
                  <Ionicons 
                    name={item.action_taken === "rejected" ? "close-circle" : "close"} 
                    size={16} 
                    color={item.action_taken ? "#9ca3af" : "#6b7280"} 
                  />
                  <ThemedText style={[
                    styles.inlineButtonText, 
                    { color: item.action_taken ? "#9ca3af" : "#6b7280" }
                  ]}>
                    {item.action_taken === "rejected" ? "Đã từ chối" : "Từ chối"}
                  </ThemedText>
                </Pressable>
              </View>
            )}
          </View>

          {!item.is_read && <View style={styles.unreadDot} />}
        </Pressable>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ title: "Thông báo" }} />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="notifications-outline" size={64} color="#d1d5db" />
              </View>
              <ThemedText style={styles.emptyTitle}>Chưa có thông báo</ThemedText>
              <ThemedText style={styles.emptyDescription}>
                Bạn sẽ nhận được thông báo khi có người tag bạn trong giao dịch
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    padding: isSmallScreen ? 16 : 20,
    gap: 12,
  },

  // Notification Wrapper
  notificationWrapper: {
    gap: 8,
  },

  // Notification Card
  notificationCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  notificationCardUnread: {
    backgroundColor: "#eef2ff",
    borderColor: "#c7d2fe",
  },
  notificationCardRead: {
    backgroundColor: "#f9fafb",
    borderColor: "#e5e7eb",
    opacity: 0.7,
  },
  notificationIcon: {
    width: 48,
    height: 48,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "#fff",
  },
  avatarMuted: {
    opacity: 0.6,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainerMuted: {
    backgroundColor: "#f3f4f6",
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
    color: "#111827",
  },
  notificationMessage: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
    marginBottom: 6,
  },
  textMuted: {
    color: "#9ca3af",
  },
  notificationTime: {
    fontSize: 12,
    color: "#9ca3af",
    fontWeight: "600",
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#6366f1",
    marginTop: 4,
  },

  // Action Buttons
  actionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  inlineActionButtons: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  acceptButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#22c55e",
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
  },
  inlineAcceptButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#22c55e",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 4,
  },
  acceptButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  inlineButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  rejectButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  inlineRejectButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  rejectButtonText: {
    color: "#6b7280",
    fontSize: 15,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.5,
    backgroundColor: "#f9fafb",
  },
  buttonMuted: {
    opacity: 0.6,
    backgroundColor: "#f3f4f6",
  },
  buttonAccepted: {
    backgroundColor: "#d1fae5",
    borderColor: "#a7f3d0",
  },
  buttonRejected: {
    backgroundColor: "#fee2e2",
    borderColor: "#fecaca",
  },
  buttonTextDisabled: {
    color: "#9ca3af",
  },
  buttonTextMuted: {
    color: "#9ca3af",
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: isSmallScreen ? 100 : 120,
    height: isSmallScreen ? 100 : 120,
    borderRadius: isSmallScreen ? 50 : 60,
    backgroundColor: "#f9fafb",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    borderWidth: 3,
    borderColor: "#f3f4f6",
  },
  emptyTitle: {
    fontSize: isSmallScreen ? 18 : 20,
    fontWeight: "900",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyDescription: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 22,
  },
});
