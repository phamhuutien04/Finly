import Ionicons from "@expo/vector-icons/Ionicons";
import { Link, useRouter } from "expo-router";
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
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { useAppColorScheme } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabase";

const { width: screenWidth } = Dimensions.get("window");
const isSmallScreen = screenWidth < 375;
const isMediumScreen = screenWidth >= 375 && screenWidth < 414;

type TabType = "friends" | "requests" | "search";

type UserProfile = {
  id: string;
  user_id: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  email?: string;
  friendship_status?: "none" | "pending_sent" | "pending_received" | "accepted" | "blocked";
};

type Friendship = {
  id: string;
  user_id: string;
  friend_id: string;
  status: "pending" | "accepted" | "blocked";
  created_at: string;
  friend_profile?: UserProfile;
};

// Union type for FlatList data
type ListItem = Friendship | UserProfile;

export default function SocialScreen() {
  const scheme = useAppColorScheme();
  
  // Improved light/dark theme with better contrast
  const screenBg = scheme === 'dark' ? '#111827' : '#f5f5f5';
  const cardBg = scheme === 'dark' ? '#1f2937' : '#ffffff';
  const text = scheme === 'dark' ? '#f9fafb' : '#1f2937';
  const subtleText = scheme === 'dark' ? '#9ca3af' : '#64748b';
  const borderColor = scheme === 'dark' ? '#374151' : '#d1d5db';
  const inputBg = scheme === 'dark' ? '#1f2937' : '#ffffff';
  const accentColor = '#6366f1';
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("friends");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [friends, setFriends] = useState<Friendship[]>([]);
  const [requests, setRequests] = useState<Friendship[]>([]);
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/auth/login");
        return;
      }
      setCurrentUserId(user.id);

      // Check if user is admin
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("is_admin")
        .eq("user_id", user.id)
        .single();

      setIsAdmin(profile?.is_admin || false);

      if (activeTab === "friends") {
        await loadFriends(user.id);
      } else if (activeTab === "requests") {
        await loadRequests(user.id);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadFriends = async (userId: string) => {
    const { data, error } = await supabase
      .from("friendships")
      .select(`
        id,
        user_id,
        friend_id,
        status,
        created_at,
        updated_at
      `)
      .eq("user_id", userId)
      .eq("status", "accepted");

    if (error) {
      console.error("Error loading friends:", error);
      return;
    }

    // Load friend profiles separately
    if (data && data.length > 0) {
      const friendIds = data.map(f => f.friend_id);
      const { data: profiles, error: profileError } = await supabase
        .from("user_profiles")
        .select("*")
        .in("user_id", friendIds);

      if (profileError) {
        console.error("Error loading friend profiles:", profileError);
        setFriends(data as Friendship[]);
        return;
      }

      // Merge profiles with friendships
      const friendsWithProfiles = data.map(friendship => ({
        ...friendship,
        friend_profile: profiles?.find(p => p.user_id === friendship.friend_id),
      }));

      setFriends(friendsWithProfiles as Friendship[]);
    } else {
      setFriends([]);
    }
  };

  const loadRequests = async (userId: string) => {
    const { data, error } = await supabase
      .from("friendships")
      .select(`
        id,
        user_id,
        friend_id,
        status,
        created_at,
        updated_at
      `)
      .eq("friend_id", userId)
      .eq("status", "pending");

    if (error) {
      console.error("Error loading requests:", error);
      return;
    }

    // Load requester profiles separately
    if (data && data.length > 0) {
      const requesterIds = data.map(f => f.user_id);
      const { data: profiles, error: profileError } = await supabase
        .from("user_profiles")
        .select("*")
        .in("user_id", requesterIds);

      if (profileError) {
        console.error("Error loading requester profiles:", profileError);
        setRequests(data as Friendship[]);
        return;
      }

      // Merge profiles with requests
      const requestsWithProfiles = data.map(request => ({
        ...request,
        friend_profile: profiles?.find(p => p.user_id === request.user_id),
      }));

      setRequests(requestsWithProfiles as Friendship[]);
    } else {
      setRequests([]);
    }
  };

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      console.log("Searching for:", query);
      console.log("Current user ID:", currentUserId);

      // Search by display_name or email in user_profiles
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .or(`display_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(20);

      console.log("Search results:", data);
      console.log("Search error:", error);

      if (error) {
        console.error("Error searching users:", error);
        Alert.alert("Lỗi tìm kiếm", error.message);
        return;
      }

      // Filter out current user
      const filteredResults = (data || []).filter(
        profile => profile.user_id !== currentUserId
      );

      console.log("Filtered results:", filteredResults);

      // Check friendship status for each user
      if (filteredResults.length > 0 && currentUserId) {
        const userIds = filteredResults.map(u => u.user_id);
        
        console.log("Checking friendship status for users:", userIds);

        const { data: friendships, error: friendshipError } = await supabase
          .from("friendships")
          .select("user_id, friend_id, status")
          .or(`and(user_id.eq.${currentUserId},friend_id.in.(${userIds.join(",")})),and(user_id.in.(${userIds.join(",")}),friend_id.eq.${currentUserId})`);

        console.log("Friendship data:", friendships);
        console.log("Friendship error:", friendshipError);

        if (friendshipError) {
          console.error("Error checking friendships:", friendshipError);
        }

        // Add friendship status to each user
        const resultsWithStatus = filteredResults.map(user => {
          const friendship = friendships?.find(f => 
            (f.user_id === currentUserId && f.friend_id === user.user_id) ||
            (f.user_id === user.user_id && f.friend_id === currentUserId)
          );

          let status = "none";
          if (friendship) {
            if (friendship.status === "accepted") {
              status = "accepted";
            } else if (friendship.status === "pending") {
              // Nếu current user gửi lời mời -> "pending_sent"
              // Nếu user khác gửi lời mời -> "pending_received"
              status = friendship.user_id === currentUserId ? "pending_sent" : "pending_received";
            } else {
              status = friendship.status;
            }
          }

          return {
            ...user,
            friendship_status: status
          };
        });

        console.log("Final results with status:", resultsWithStatus);
        setSearchResults(resultsWithStatus);
      } else {
        setSearchResults(filteredResults);
      }
    } catch (error) {
      console.error("Error searching users:", error);
      Alert.alert("Lỗi", "Có lỗi xảy ra khi tìm kiếm: " + (error as any)?.message);
    }
  };

  const sendFriendRequest = async (friendId: string) => {
    if (!currentUserId) return;

    try {
      // Check if friendship already exists
      const { data: existing, error: checkError } = await supabase
        .from("friendships")
        .select("*")
        .or(`and(user_id.eq.${currentUserId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${currentUserId})`)
        .single();

      if (checkError && checkError.code !== "PGRST116") {
        console.error("Error checking friendship:", checkError);
      }

      if (existing) {
        Alert.alert("Thông báo", "Đã có quan hệ bạn bè với người này!");
        return;
      }

      // Send friend request
      const { error } = await supabase.from("friendships").insert({
        user_id: currentUserId,
        friend_id: friendId,
        status: "pending",
      });

      if (error) {
        console.error("Error sending friend request:", error);
        Alert.alert("Lỗi", "Không thể gửi lời mời kết bạn: " + error.message);
        return;
      }

      Alert.alert("Thành công", "Đã gửi lời mời kết bạn!");
      
      // Refresh search results to update the friendship status
      if (searchQuery.trim()) {
        await searchUsers(searchQuery);
      }
    } catch (error: any) {
      console.error("Error in sendFriendRequest:", error);
      Alert.alert("Lỗi", "Có lỗi xảy ra: " + error.message);
    }
  };

  const acceptFriendRequest = async (friendshipId: string, friendUserId: string) => {
    if (!currentUserId) return;

    // Update the request status
    const { error: updateError } = await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", friendshipId);

    if (updateError) {
      Alert.alert("Lỗi", "Không thể chấp nhận lời mời");
      return;
    }

    // Create reverse friendship
    const { error: insertError } = await supabase.from("friendships").insert({
      user_id: currentUserId,
      friend_id: friendUserId,
      status: "accepted",
    });

    if (insertError) {
      console.error("Error creating reverse friendship:", insertError);
    }

    Alert.alert("Thành công", "Đã chấp nhận lời mời kết bạn!");
    loadRequests(currentUserId);
  };

  const rejectFriendRequest = async (friendshipId: string) => {
    const { error } = await supabase
      .from("friendships")
      .delete()
      .eq("id", friendshipId);

    if (error) {
      Alert.alert("Lỗi", "Không thể từ chối lời mời");
      return;
    }

    Alert.alert("Đã từ chối lời mời kết bạn");
    if (currentUserId) loadRequests(currentUserId);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const cancelFriendRequest = async (friendId: string) => {
    if (!currentUserId) return;

    try {
      // Xóa lời mời kết bạn
      const { error } = await supabase
        .from("friendships")
        .delete()
        .eq("user_id", currentUserId)
        .eq("friend_id", friendId)
        .eq("status", "pending");

      if (error) {
        Alert.alert("Lỗi", "Không thể hủy lời mời kết bạn");
        return;
      }

      Alert.alert("Thành công", "Đã hủy lời mời kết bạn!");
      
      // Refresh search results
      if (searchQuery.trim()) {
        await searchUsers(searchQuery);
      }
    } catch (error: any) {
      console.error("Error canceling friend request:", error);
      Alert.alert("Lỗi", "Có lỗi xảy ra: " + error.message);
    }
  };

  const acceptFriendRequestFromSearch = async (friendUserId: string) => {
    if (!currentUserId) return;

    try {
      // Tìm friendship record
      const { data: friendship, error: findError } = await supabase
        .from("friendships")
        .select("id")
        .eq("user_id", friendUserId)
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

      if (updateError) {
        Alert.alert("Lỗi", "Không thể chấp nhận lời mời");
        return;
      }

      // Create reverse friendship
      const { error: insertError } = await supabase.from("friendships").insert({
        user_id: currentUserId,
        friend_id: friendUserId,
        status: "accepted",
      });

      if (insertError) {
        console.error("Error creating reverse friendship:", insertError);
      }

      Alert.alert("Thành công", "Đã chấp nhận lời mời kết bạn!");
      
      // Refresh search results
      if (searchQuery.trim()) {
        await searchUsers(searchQuery);
      }
    } catch (error: any) {
      console.error("Error accepting friend request:", error);
      Alert.alert("Lỗi", "Có lỗi xảy ra: " + error.message);
    }
  };

  const rejectFriendRequestFromSearch = async (friendUserId: string) => {
    if (!currentUserId) return;

    try {
      // Xóa lời mời kết bạn
      const { error } = await supabase
        .from("friendships")
        .delete()
        .eq("user_id", friendUserId)
        .eq("friend_id", currentUserId)
        .eq("status", "pending");

      if (error) {
        Alert.alert("Lỗi", "Không thể từ chối lời mời");
        return;
      }

      Alert.alert("Đã từ chối lời mời kết bạn");
      
      // Refresh search results
      if (searchQuery.trim()) {
        await searchUsers(searchQuery);
      }
    } catch (error: any) {
      console.error("Error rejecting friend request:", error);
      Alert.alert("Lỗi", "Có lỗi xảy ra: " + error.message);
    }
  };

  const renderFriendItem = ({ item }: { item: Friendship }) => {
    const profile = item.friend_profile;
    if (!profile) return null;

    const displayName = profile.display_name || "Chưa đặt tên";
    const subtitle = profile.bio || profile.email || "";

    return (
      <Pressable 
        style={({ pressed }) => ({
          ...styles.friendCard,
          backgroundColor: cardBg,
          borderColor: borderColor,
          opacity: pressed ? 0.7 : 1
        })}
        onPress={() => router.push(`/profile/${profile.user_id}` as any)}
      >
        <View style={styles.avatarContainer}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={{ ...styles.avatar, borderColor: cardBg }} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: inputBg, borderColor: cardBg }]}>
              <Ionicons name="person" size={32} color={subtleText} />
            </View>
          )}
        </View>

        <View style={styles.friendInfo}>
          <ThemedText style={{ ...styles.friendName, color: text }}>
            {displayName}
          </ThemedText>
          {subtitle && (
            <ThemedText style={{ ...styles.friendBio, color: subtleText }} numberOfLines={2}>
              {subtitle}
            </ThemedText>
          )}
        </View>

        <Pressable 
          style={({ pressed }) => ({
            ...styles.messageButton,
            backgroundColor: inputBg,
            opacity: pressed ? 0.7 : 1,
            padding: 8,
            borderRadius: 8
          })}
          onPress={(e) => {
            e.stopPropagation();
            router.push(`/chat/${profile.user_id}` as any);
          }}
        >
          <Ionicons name="chatbubble-outline" size={20} color={accentColor} />
        </Pressable>
      </Pressable>
    );
  };

  const renderRequestItem = ({ item }: { item: Friendship }) => {
    const profile = item.friend_profile;
    if (!profile) return null;

    const displayName = profile.display_name || "Chưa đặt tên";

    return (
      <View style={{ ...styles.requestCard, backgroundColor: cardBg, borderColor: '#f59e0b' }}>
        <View style={styles.avatarContainer}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={{ ...styles.avatar, borderColor: cardBg }} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: inputBg, borderColor: cardBg }]}>
              <Ionicons name="person" size={32} color={subtleText} />
            </View>
          )}
        </View>

        <View style={styles.requestInfo}>
          <ThemedText style={{ ...styles.friendName, color: text }}>
            {displayName}
          </ThemedText>
          {profile.email && (
            <ThemedText style={{ ...styles.friendBio, color: subtleText }} numberOfLines={1}>
              {profile.email}
            </ThemedText>
          )}
          <ThemedText style={{ ...styles.requestTime, color: '#f59e0b' }}>
            Đã gửi lời mời kết bạn
          </ThemedText>

          <View style={styles.requestActions}>
            <Pressable
              style={({ pressed }) => ({
                ...styles.acceptButton,
                backgroundColor: '#10b981',
                opacity: pressed ? 0.7 : 1
              })}
              onPress={() => acceptFriendRequest(item.id, item.user_id)}
            >
              <Text style={styles.acceptButtonText}>Chấp nhận</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => ({
                ...styles.rejectButton,
                backgroundColor: inputBg,
                opacity: pressed ? 0.7 : 1
              })}
              onPress={() => rejectFriendRequest(item.id)}
            >
              <Text style={{ ...styles.rejectButtonText, color: subtleText }}>Từ chối</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  const renderSearchItem = ({ item }: { item: UserProfile }) => {
    const isCurrentUser = item.user_id === currentUserId;
    const displayName = item.display_name || "Chưa đặt tên";

    const getActionButtons = () => {
      if (isCurrentUser) return null;

      switch (item.friendship_status) {
        case "accepted":
          return (
            <View style={styles.buttonGroup}>
              <Pressable 
                style={({ pressed }) => ({
                  ...styles.actionButton,
                  backgroundColor: inputBg,
                  opacity: pressed ? 0.7 : 1
                })}
                onPress={() => router.push(`/chat/${item.user_id}` as any)}
              >
                <Ionicons name="chatbubble" size={16} color={accentColor} />
                <ThemedText style={[styles.buttonText, { color: accentColor }]}>
                  Nhắn tin
                </ThemedText>
              </Pressable>
              <Pressable 
                style={({ pressed }) => ({
                  ...styles.actionButton,
                  backgroundColor: inputBg,
                  opacity: pressed ? 0.7 : 1
                })}
                onPress={() => router.push(`/friend-profile/${item.user_id}` as any)}
              >
                <Ionicons name="person" size={16} color="#42b883" />
                <ThemedText style={[styles.buttonText, { color: '#42b883' }]}>
                  Xem hồ sơ
                </ThemedText>
              </Pressable>
            </View>
          );
        case "pending_sent":
          // Mình đã gửi lời mời cho người này
          return (
            <View style={styles.buttonGroup}>
              <Pressable 
                style={({ pressed }) => ({
                  ...styles.actionButton,
                  backgroundColor: inputBg,
                  opacity: pressed ? 0.7 : 1
                })}
                onPress={() => cancelFriendRequest(item.user_id)}
              >
                <Ionicons name="close" size={16} color={subtleText} />
                <ThemedText style={[styles.buttonText, { color: subtleText }]}>
                  Hủy lời mời
                </ThemedText>
              </Pressable>
            </View>
          );
        case "pending_received":
          // Người này đã gửi lời mời cho mình
          return (
            <View style={styles.buttonGroup}>
              <Pressable 
                style={({ pressed }) => ({
                  ...styles.actionButton,
                  backgroundColor: accentColor,
                  opacity: pressed ? 0.7 : 1
                })}
                onPress={() => acceptFriendRequestFromSearch(item.user_id)}
              >
                <Ionicons name="checkmark" size={16} color="#fff" />
                <ThemedText style={[styles.buttonText, styles.addFriendButtonText]}>
                  Chấp nhận
                </ThemedText>
              </Pressable>
              <Pressable 
                style={({ pressed }) => ({
                  ...styles.actionButton,
                  backgroundColor: inputBg,
                  opacity: pressed ? 0.7 : 1
                })}
                onPress={() => rejectFriendRequestFromSearch(item.user_id)}
              >
                <Ionicons name="close" size={16} color={subtleText} />
                <ThemedText style={[styles.buttonText, { color: subtleText }]}>
                  Từ chối
                </ThemedText>
              </Pressable>
            </View>
          );
        case "blocked":
          return (
            <View style={styles.buttonGroup}>
              <Pressable style={({ pressed }) => ({
                ...styles.actionButton,
                backgroundColor: '#ffebee',
                opacity: pressed ? 0.7 : 1
              })}>
                <Ionicons name="ban" size={16} color="#e41e3f" />
                <ThemedText style={[styles.buttonText, { color: '#e41e3f' }]}>
                  Đã chặn
                </ThemedText>
              </Pressable>
            </View>
          );
        default:
          return (
            <View style={styles.buttonGroup}>
              <Pressable
                style={({ pressed }) => ({
                  ...styles.actionButton,
                  backgroundColor: accentColor,
                  opacity: pressed ? 0.7 : 1
                })}
                onPress={() => sendFriendRequest(item.user_id)}
              >
                <Ionicons name="person-add" size={16} color="#fff" />
                <ThemedText style={[styles.buttonText, styles.addFriendButtonText]}>
                  Kết bạn
                </ThemedText>
              </Pressable>
              <Pressable 
                style={({ pressed }) => ({
                  ...styles.actionButton,
                  backgroundColor: inputBg,
                  opacity: pressed ? 0.7 : 1
                })}
                onPress={() => router.push(`/profile/${item.user_id}` as any)}
              >
                <Ionicons name="person" size={16} color={accentColor} />
                <ThemedText style={[styles.buttonText, { color: accentColor }]}>
                  Xem hồ sơ
                </ThemedText>
              </Pressable>
            </View>
          );
      }
    };

    return (
      <View style={{ ...styles.searchCard, backgroundColor: cardBg, borderColor: borderColor }}>
        <View style={styles.avatarContainer}>
          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={{ ...styles.avatar, borderColor: cardBg }} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: inputBg, borderColor: cardBg }]}>
              <Ionicons name="person" size={40} color={subtleText} />
            </View>
          )}
        </View>

        <View style={styles.searchInfo}>
          <ThemedText style={{ ...styles.friendName, color: text }}>
            {displayName}
          </ThemedText>
          {item.bio && (
            <ThemedText style={{ ...styles.friendBio, color: subtleText }} numberOfLines={1}>
              {item.bio}
            </ThemedText>
          )}
          {item.email && (
            <ThemedText style={{ ...styles.friendEmail, color: subtleText }} numberOfLines={1}>
              {item.email}
            </ThemedText>
          )}
          
          {/* Chỉ hiện bạn chung khi có dữ liệu thật */}
          {/* <ThemedText style={styles.mutualFriends}>
            2 bạn chung
          </ThemedText> */}
        </View>

        {getActionButtons()}
      </View>
    );
  };

  const renderListItem = ({ item }: { item: ListItem }) => {
    // Type guard to check if item is a Friendship
    const isFriendship = (item: ListItem): item is Friendship => {
      return 'friend_id' in item && 'status' in item && 'created_at' in item;
    };

    if (activeTab === "friends" && isFriendship(item)) {
      return renderFriendItem({ item });
    } else if (activeTab === "requests" && isFriendship(item)) {
      return renderRequestItem({ item });
    } else if (activeTab === "search" && !isFriendship(item)) {
      return renderSearchItem({ item: item as UserProfile });
    }
    return null;
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: screenBg }]}>
      {/* Header */}
      <View style={{ ...styles.header, backgroundColor: cardBg, borderBottomColor: borderColor }}>
        <ThemedText style={styles.headerTitle}>Bạn bè</ThemedText>
        <View style={styles.headerButtons}>
          {isAdmin && (
            <Pressable 
              style={styles.adminButton}
              onPress={() => router.push('/admin/moderate-posts' as any)}
            >
              <Ionicons name="shield-checkmark" size={28} color="#ef4444" />
            </Pressable>
          )}
          <Link href="/chat/messages" asChild>
            <Pressable style={styles.headerButton}>
              <Ionicons name="chatbubbles-outline" size={28} color={accentColor} />
            </Pressable>
          </Link>
          <Pressable 
            style={styles.profileButton}
            onPress={() => {
              if (currentUserId) {
                router.push(`/profile/${currentUserId}` as any);
              }
            }}
          >
            <Ionicons name="person-circle-outline" size={28} color={accentColor} />
          </Pressable>
        </View>
      </View>

      {/* Tabs */}
      <View style={{ ...styles.tabs, backgroundColor: cardBg, borderBottomColor: borderColor }}>
        <Pressable
          style={({ pressed }) => ({
            ...styles.tab,
            backgroundColor: activeTab === "friends" ? accentColor + '20' : 'transparent',
            opacity: pressed ? 0.7 : 1
          })}
          onPress={() => setActiveTab("friends")}
        >
          <ThemedText
            style={[styles.tabText, { color: activeTab === "friends" ? accentColor : subtleText }]}
          >
            Bạn bè
          </ThemedText>
          {friends.length > 0 && (
            <View style={{ ...styles.badge, backgroundColor: accentColor }}>
              <Text style={styles.badgeText}>{friends.length}</Text>
            </View>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => ({
            ...styles.tab,
            backgroundColor: activeTab === "requests" ? accentColor + '20' : 'transparent',
            opacity: pressed ? 0.7 : 1
          })}
          onPress={() => setActiveTab("requests")}
        >
          <ThemedText
            style={[styles.tabText, { color: activeTab === "requests" ? accentColor : subtleText }]}
          >
            Lời mời
          </ThemedText>
          {requests.length > 0 && (
            <View style={{ ...styles.badge, backgroundColor: '#ef4444' }}>
              <Text style={styles.badgeText}>{requests.length}</Text>
            </View>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => ({
            ...styles.tab,
            backgroundColor: activeTab === "search" ? accentColor + '20' : 'transparent',
            opacity: pressed ? 0.7 : 1
          })}
          onPress={() => setActiveTab("search")}
        >
          <ThemedText
            style={[styles.tabText, { color: activeTab === "search" ? accentColor : subtleText }]}
          >
            Tìm kiếm
          </ThemedText>
        </Pressable>
      </View>

      {/* Search Bar (only visible in search tab) */}
      {activeTab === "search" && (
        <View style={{ ...styles.searchContainer, backgroundColor: cardBg }}>
          <View style={{ ...styles.searchBar, backgroundColor: inputBg, borderColor: borderColor }}>
            <Ionicons name="search" size={20} color={subtleText} />
            <TextInput
              style={{ ...styles.searchInput, color: text }}
              placeholder="Tìm kiếm bạn bè..."
              placeholderTextColor={subtleText}
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                searchUsers(text);
              }}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => {
                setSearchQuery("");
                setSearchResults([]);
              }}>
                <Ionicons name="close-circle" size={20} color={subtleText} />
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={accentColor} />
        </View>
      ) : (
        <FlatList
          data={
            activeTab === "friends"
              ? friends
              : activeTab === "requests"
              ? requests
              : searchResults
          }
          keyExtractor={(item) => item.id}
          renderItem={renderListItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={{ ...styles.emptyIconContainer, backgroundColor: inputBg, borderColor: borderColor }}>
                <Ionicons
                  name={
                    activeTab === "friends"
                      ? "people-outline"
                      : activeTab === "requests"
                      ? "mail-outline"
                      : "search-outline"
                  }
                  size={64}
                  color={subtleText}
                />
              </View>
              <ThemedText style={styles.emptyTitle}>
                {activeTab === "friends"
                  ? "Chưa có bạn bè"
                  : activeTab === "requests"
                  ? "Không có lời mời"
                  : searchQuery
                  ? "Không tìm thấy kết quả"
                  : "Tìm kiếm bạn bè"}
              </ThemedText>
              <ThemedText style={{ ...styles.emptyDescription, color: subtleText }}>
                {activeTab === "friends"
                  ? "Hãy tìm kiếm và kết bạn với mọi người"
                  : activeTab === "requests"
                  ? "Bạn chưa có lời mời kết bạn nào"
                  : "Nhập tên để tìm kiếm bạn bè"}
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
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: isSmallScreen ? 16 : isMediumScreen ? 20 : 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: isSmallScreen ? 24 : isMediumScreen ? 26 : 28,
    fontWeight: "900",
    letterSpacing: -1,
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerButton: {
    padding: 4,
  },
  adminButton: {
    padding: 4,
  },
  profileButton: {
    padding: 4,
  },

  // Tabs
  tabs: {
    flexDirection: "row",
    paddingHorizontal: isSmallScreen ? 12 : isMediumScreen ? 16 : 20,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 6,
  },
  tabActive: {
    // backgroundColor applied inline
  },
  tabText: {
    fontSize: isSmallScreen ? 13 : isMediumScreen ? 14 : 15,
    fontWeight: "700",
  },
  tabTextActive: {
    // color applied inline
  },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: "center",
  },
  badgeAlert: {
    // backgroundColor applied inline
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },

  // Search
  searchContainer: {
    paddingHorizontal: isSmallScreen ? 16 : isMediumScreen ? 20 : 24,
    paddingVertical: 12,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },

  // List
  listContent: {
    padding: isSmallScreen ? 16 : isMediumScreen ? 20 : 24,
    gap: 12,
  },

  // Friend Card
  friendCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    padding: isSmallScreen ? 14 : isMediumScreen ? 16 : 18,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: isSmallScreen ? 60 : isMediumScreen ? 64 : 68,
    height: isSmallScreen ? 60 : isMediumScreen ? 64 : 68,
    borderRadius: isSmallScreen ? 30 : isMediumScreen ? 32 : 34,
    borderWidth: 2,
  },
  avatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: isSmallScreen ? 16 : isMediumScreen ? 17 : 18,
    fontWeight: "700",
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  friendBio: {
    fontSize: isSmallScreen ? 13 : isMediumScreen ? 14 : 14,
    lineHeight: 18,
    marginBottom: 2,
  },

  // Request Card
  requestCard: {
    flexDirection: "row",
    borderRadius: 20,
    padding: isSmallScreen ? 14 : isMediumScreen ? 16 : 18,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 2,
  },
  requestInfo: {
    flex: 1,
  },
  requestTime: {
    fontSize: 13,
    marginBottom: 12,
    fontWeight: "600",
  },
  requestActions: {
    flexDirection: "row",
    gap: 8,
  },
  acceptButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  acceptButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
  rejectButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: "800",
  },

  // Search Card
  searchCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 12,
    padding: isSmallScreen ? 12 : isMediumScreen ? 14 : 16,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
  },
  searchInfo: {
    flex: 1,
    marginLeft: 12,
  },
  friendEmail: {
    fontSize: 13,
    marginTop: 2,
  },
  mutualFriends: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: "500",
  },

  // Button Groups (Facebook style)
  buttonGroup: {
    flexDirection: "column",
    gap: 6,
    minWidth: 100,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
    minHeight: 36,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "600",
  },

  // Add Friend Button (Blue like Facebook)
  addFriendButton: {
    // backgroundColor applied inline
  },
  addFriendButtonText: {
    color: "#fff",
  },

  // Message Button
  messageButton: {
    // backgroundColor applied inline
  },
  messageButtonText: {
    // color applied inline
  },

  // Friends Button (Green)
  friendsButton: {
    // backgroundColor applied inline
  },
  friendsButtonText: {
    // color applied inline
  },

  // Cancel Button
  cancelButton: {
    // backgroundColor applied inline
  },
  cancelButtonText: {
    // color applied inline
  },

  // Blocked Button
  blockedButtonStyle: {
    // backgroundColor applied inline
  },
  blockedButtonText: {
    // color applied inline
  },

  // Empty State
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: isSmallScreen ? 100 : isMediumScreen ? 110 : 120,
    height: isSmallScreen ? 100 : isMediumScreen ? 110 : 120,
    borderRadius: isSmallScreen ? 50 : isMediumScreen ? 55 : 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    borderWidth: 3,
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
    textAlign: "center",
    lineHeight: 22,
  },

  // Friendship Status Buttons
  friendButton: {
    // backgroundColor applied inline
  },
  pendingButton: {
    // backgroundColor applied inline
  },
  blockedButton: {
    // backgroundColor applied inline
  },

  // Status Text
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  statusTextGreen: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
});
