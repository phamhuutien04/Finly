import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { supabase } from "@/lib/supabase";

const { width: screenWidth } = Dimensions.get("window");
const isSmallScreen = screenWidth < 375;
const isMediumScreen = screenWidth >= 375 && screenWidth < 414;

type UserProfile = {
  user_id: string;
  email: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  location: string;
  website: string;
  is_public: boolean;
  created_at: string;
};

type FriendshipStatus = "none" | "pending_sent" | "pending_received" | "accepted" | "blocked";

export default function FriendProfileScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [friendshipStatus, setFriendshipStatus] = useState<FriendshipStatus>("none");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      loadProfile();
    }
  }, [userId]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/auth/login");
        return;
      }
      
      setCurrentUserId(user.id);

      // Load friend profile
      const { data: profileData, error: profileError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (profileError) {
        console.error("Error loading profile:", profileError);
        Alert.alert("Lỗi", "Không thể tải thông tin người dùng");
        return;
      }

      // Check if profile is public or if they are friends
      if (!profileData.is_public) {
        // Check friendship status
        const { data: friendship } = await supabase
          .from("friendships")
          .select("status, user_id, friend_id")
          .or(`and(user_id.eq.${user.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${user.id})`)
          .single();

        if (!friendship || friendship.status !== "accepted") {
          Alert.alert("Không thể xem", "Hồ sơ này ở chế độ riêng tư");
          router.back();
          return;
        }
      }

      setProfile(profileData);

      // Load friendship status
      await loadFriendshipStatus(user.id, userId);

    } catch (error: any) {
      console.error("Error loading profile:", error);
      Alert.alert("Lỗi", "Có lỗi xảy ra khi tải thông tin");
    } finally {
      setLoading(false);
    }
  };

  const loadFriendshipStatus = async (currentUserId: string, targetUserId: string) => {
    const { data: friendship } = await supabase
      .from("friendships")
      .select("status, user_id, friend_id")
      .or(`and(user_id.eq.${currentUserId},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${currentUserId})`)
      .single();

    if (!friendship) {
      setFriendshipStatus("none");
      return;
    }

    if (friendship.status === "accepted") {
      setFriendshipStatus("accepted");
    } else if (friendship.status === "pending") {
      if (friendship.user_id === currentUserId) {
        setFriendshipStatus("pending_sent");
      } else {
        setFriendshipStatus("pending_received");
      }
    } else {
      setFriendshipStatus(friendship.status as FriendshipStatus);
    }
  };

  const sendFriendRequest = async () => {
    if (!currentUserId || !userId) return;

    try {
      const { error } = await supabase.from("friendships").insert({
        user_id: currentUserId,
        friend_id: userId,
        status: "pending",
      });

      if (error) throw error;

      setFriendshipStatus("pending_sent");
      Alert.alert("Thành công", "Đã gửi lời mời kết bạn!");
    } catch (error: any) {
      console.error("Error sending friend request:", error);
      Alert.alert("Lỗi", "Không thể gửi lời mời kết bạn");
    }
  };

  const acceptFriendRequest = async () => {
    if (!currentUserId || !userId) return;

    try {
      // Find the friendship request
      const { data: friendship, error: findError } = await supabase
        .from("friendships")
        .select("id")
        .eq("user_id", userId)
        .eq("friend_id", currentUserId)
        .eq("status", "pending")
        .single();

      if (findError || !friendship) {
        Alert.alert("Lỗi", "Không tìm thấy lời mời kết bạn");
        return;
      }

      // Update the request status
      const { error: updateError } = await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("id", friendship.id);

      if (updateError) throw updateError;

      // Create reverse friendship
      const { error: insertError } = await supabase.from("friendships").insert({
        user_id: currentUserId,
        friend_id: userId,
        status: "accepted",
      });

      if (insertError) {
        console.error("Error creating reverse friendship:", insertError);
      }

      setFriendshipStatus("accepted");
      Alert.alert("Thành công", "Đã chấp nhận lời mời kết bạn!");
    } catch (error: any) {
      console.error("Error accepting friend request:", error);
      Alert.alert("Lỗi", "Không thể chấp nhận lời mời");
    }
  };

  const startChat = () => {
    if (userId) {
      router.push(`/chat/${userId}` as any);
    }
  };

  const getActionButtons = () => {
    if (!profile || profile.user_id === currentUserId) return null;

    switch (friendshipStatus) {
      case "accepted":
        return (
          <View style={styles.actionButtons}>
            <Pressable style={styles.primaryButton} onPress={startChat}>
              <Ionicons name="chatbubble" size={20} color="#fff" />
              <ThemedText style={styles.primaryButtonText}>Nhắn tin</ThemedText>
            </Pressable>
          </View>
        );
      case "pending_sent":
        return (
          <View style={styles.actionButtons}>
            <View style={styles.pendingButton}>
              <Ionicons name="time" size={20} color="#f59e0b" />
              <ThemedText style={styles.pendingButtonText}>Đã gửi lời mời</ThemedText>
            </View>
          </View>
        );
      case "pending_received":
        return (
          <View style={styles.actionButtons}>
            <Pressable style={styles.primaryButton} onPress={acceptFriendRequest}>
              <Ionicons name="checkmark" size={20} color="#fff" />
              <ThemedText style={styles.primaryButtonText}>Chấp nhận</ThemedText>
            </Pressable>
          </View>
        );
      default:
        return (
          <View style={styles.actionButtons}>
            <Pressable style={styles.primaryButton} onPress={sendFriendRequest}>
              <Ionicons name="person-add" size={20} color="#fff" />
              <ThemedText style={styles.primaryButtonText}>Kết bạn</ThemedText>
            </Pressable>
          </View>
        );
    }
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

  if (!profile) {
    return (
      <SafeAreaView style={styles.screen}>
        <Stack.Screen options={{ title: "Không tìm thấy" }} />
        <View style={styles.errorContainer}>
          <Ionicons name="person-outline" size={64} color="#d1d5db" />
          <ThemedText style={styles.errorText}>Không tìm thấy người dùng</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ title: profile.display_name || "Hồ sơ" }} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={48} color="#9ca3af" />
              </View>
            )}
          </View>

          <ThemedText style={styles.displayName}>
            {profile.display_name || "Chưa đặt tên"}
          </ThemedText>

          {profile.bio && (
            <ThemedText style={styles.bio}>{profile.bio}</ThemedText>
          )}

          <View style={styles.joinDate}>
            <Ionicons name="calendar-outline" size={16} color="#9ca3af" />
            <ThemedText style={styles.joinDateText}>
              Tham gia {new Date(profile.created_at).toLocaleDateString("vi-VN")}
            </ThemedText>
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoSection}>
          {profile.location && (
            <View style={styles.infoItem}>
              <Ionicons name="location-outline" size={20} color="#6366f1" />
              <ThemedText style={styles.infoText}>{profile.location}</ThemedText>
            </View>
          )}

          {profile.website && (
            <View style={styles.infoItem}>
              <Ionicons name="globe-outline" size={20} color="#6366f1" />
              <ThemedText style={styles.infoText}>{profile.website}</ThemedText>
            </View>
          )}

          <View style={styles.infoItem}>
            <Ionicons name="mail-outline" size={20} color="#6366f1" />
            <ThemedText style={styles.infoText}>{profile.email}</ThemedText>
          </View>
        </View>

        {/* Action Buttons */}
        {getActionButtons()}
      </ScrollView>
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
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    color: "#9ca3af",
  },
  scrollContent: {
    padding: isSmallScreen ? 16 : isMediumScreen ? 20 : 24,
  },

  // Header
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: isSmallScreen ? 100 : isMediumScreen ? 110 : 120,
    height: isSmallScreen ? 100 : isMediumScreen ? 110 : 120,
    borderRadius: isSmallScreen ? 50 : isMediumScreen ? 55 : 60,
    borderWidth: 4,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  avatarPlaceholder: {
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  displayName: {
    fontSize: isSmallScreen ? 24 : isMediumScreen ? 26 : 28,
    fontWeight: "900",
    marginBottom: 8,
    textAlign: "center",
  },
  bio: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 12,
  },
  joinDate: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  joinDateText: {
    fontSize: 14,
    color: "#9ca3af",
  },

  // Info
  infoSection: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  infoText: {
    fontSize: 15,
    color: "#374151",
    flex: 1,
  },

  // Action Buttons
  actionButtons: {
    gap: 12,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6366f1",
    borderRadius: 16,
    paddingVertical: 16,
    gap: 8,
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  pendingButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fef3c7",
    borderRadius: 16,
    paddingVertical: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: "#f59e0b",
  },
  pendingButtonText: {
    color: "#f59e0b",
    fontSize: 16,
    fontWeight: "800",
  },
});