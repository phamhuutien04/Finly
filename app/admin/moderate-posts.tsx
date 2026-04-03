import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { supabase } from "@/lib/supabase";

type Post = {
  id: number;
  user_id: string;
  content: string;
  images: string[] | null;
  visibility: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  user_display_name?: string;
  user_avatar_url?: string;
};

export default function ModeratePostsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [markedAsViolated, setMarkedAsViolated] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'rejected'>('pending');

  useEffect(() => {
    checkAdminAndLoadPosts();
  }, []);

  useEffect(() => {
    if (!loading) {
      loadPosts();
    }
  }, [activeTab]);

  const checkAdminAndLoadPosts = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/auth/login");
        return;
      }

      // Check if user is admin
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("is_admin")
        .eq("user_id", user.id)
        .single();

      if (!profile?.is_admin) {
        Alert.alert("Không có quyền", "Bạn không có quyền truy cập trang này");
        router.back();
        return;
      }

      await loadPosts();
    } catch (error: any) {
      console.error("Error checking admin:", error);
      Alert.alert("Lỗi", "Không thể kiểm tra quyền admin");
    } finally {
      setLoading(false);
    }
  };

  const loadPosts = async () => {
    try {
      if (activeTab === 'pending') {
        // Chỉ load 6 bài có status = 'pending', loại trừ bài chia sẻ
        // Sắp xếp từ cũ nhất lên mới nhất (ascending: true)
        const { data, error } = await supabase
          .from("posts")
          .select("*")
          .eq("status", "pending")
          .not("content", "like", "Đã chia sẻ bài viết của%")
          .order("created_at", { ascending: true })
          .limit(6);

        console.log("Loaded posts:", data?.length, "posts");
        if (error) {
          console.error("Error loading posts:", error);
          throw error;
        }

        // Load user info for each post
        const postsWithUsers = await Promise.all(
          (data || []).map(async (post) => {
            const { data: profileData } = await supabase
              .from("user_profiles")
              .select("display_name, avatar_url")
              .eq("user_id", post.user_id)
              .single();

            return {
              ...post,
              user_display_name: profileData?.display_name || "User",
              user_avatar_url: profileData?.avatar_url,
            };
          })
        );

        setPosts(postsWithUsers);
      } else {
        // Load bài đã bị rejected
        const { data, error } = await supabase
          .from("posts")
          .select("*")
          .eq("status", "rejected")
          .not("content", "like", "Đã chia sẻ bài viết của%")
          .order("reviewed_at", { ascending: false });

        if (error) {
          console.error("Error loading rejected posts:", error);
          throw error;
        }

        // Load user info for each post
        const postsWithUsers = await Promise.all(
          (data || []).map(async (post) => {
            const { data: profileData } = await supabase
              .from("user_profiles")
              .select("display_name, avatar_url")
              .eq("user_id", post.user_id)
              .single();

            return {
              ...post,
              user_display_name: profileData?.display_name || "User",
              user_avatar_url: profileData?.avatar_url,
            };
          })
        );

        setPosts(postsWithUsers);
      }
    } catch (error: any) {
      console.error("Error loading posts:", error);
      Alert.alert("Lỗi", "Không thể tải bài viết");
    }
  };

  const toggleViolation = (postId: number) => {
    setMarkedAsViolated(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  const saveAndContinue = async () => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      // Update all posts in batch
      const updates = posts.map(post => {
        const isViolated = markedAsViolated.has(post.id);
        return supabase
          .from("posts")
          .update({
            status: isViolated ? 'rejected' : 'approved',
            reviewed_by: user?.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", post.id);
      });

      await Promise.all(updates);

      // Clear marked violations
      setMarkedAsViolated(new Set());
      
      // Load next batch
      await loadPosts();
    } catch (error: any) {
      console.error("Error saving posts:", error);
      Alert.alert("Lỗi", "Không thể lưu trạng thái bài viết");
    } finally {
      setSaving(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPosts();
    setRefreshing(false);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Vừa xong';
    if (minutes < 60) return `${minutes} phút trước`;
    if (hours < 24) return `${hours} giờ trước`;
    if (days < 7) return `${days} ngày trước`;
    return date.toLocaleDateString('vi-VN');
  };

  const renderPost = ({ item }: { item: Post }) => {
    const isMarked = markedAsViolated.has(item.id);

    return (
      <ThemedView style={[styles.postCard, isMarked && styles.postCardMarked]}>
        <ThemedText style={styles.postUserName} numberOfLines={1}>
          {item.user_display_name}
        </ThemedText>
        
        <ThemedText style={styles.postContent} numberOfLines={4}>
          {item.content}
        </ThemedText>
        
        <ThemedText style={styles.postTime}>
          {formatTime(item.created_at)}
        </ThemedText>

        {activeTab === 'pending' ? (
          <Pressable
            style={[styles.violateButton, isMarked && styles.violateButtonActive]}
            onPress={() => toggleViolation(item.id)}
          >
            <Ionicons 
              name={isMarked ? "close-circle" : "flag-outline"} 
              size={18} 
              color={isMarked ? "#fff" : "#6b7280"} 
            />
          </Pressable>
        ) : (
          <View style={styles.rejectedBadge}>
            <Ionicons name="close-circle" size={16} color="#ef4444" />
            <ThemedText style={styles.rejectedText}>Vi phạm</ThemedText>
          </View>
        )}
      </ThemedView>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <Stack.Screen options={{ 
          title: "Duyệt bài đăng",
          headerStyle: { backgroundColor: '#fff' },
          headerShadowVisible: false,
        }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10b981" />
          <ThemedText style={styles.loadingText}>Đang tải...</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ 
        title: "Quản lý bài viết",
        headerStyle: { backgroundColor: '#fff' },
        headerShadowVisible: false,
      }} />

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <Pressable
          style={[styles.tab, activeTab === 'pending' && styles.tabActive]}
          onPress={() => setActiveTab('pending')}
        >
          <ThemedText style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>
            Chờ duyệt
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'rejected' && styles.tabActive]}
          onPress={() => setActiveTab('rejected')}
        >
          <ThemedText style={[styles.tabText, activeTab === 'rejected' && styles.tabTextActive]}>
            Vi phạm
          </ThemedText>
        </Pressable>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderPost}
        numColumns={3}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={['#ef4444']}
            tintColor="#ef4444"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons 
                name={activeTab === 'pending' ? "checkmark-done-circle" : "shield-checkmark"} 
                size={80} 
                color="#10b981" 
              />
            </View>
            <ThemedText style={styles.emptyTitle}>
              {activeTab === 'pending' ? 'Hoàn thành!' : 'Không có bài vi phạm'}
            </ThemedText>
            <ThemedText style={styles.emptyText}>
              {activeTab === 'pending' 
                ? 'Không còn bài viết nào cần duyệt'
                : 'Chưa có bài viết nào bị đánh dấu vi phạm'
              }
            </ThemedText>
          </View>
        }
      />

      {posts.length > 0 && activeTab === 'pending' && (
        <View style={styles.bottomBar}>
          <ThemedText style={styles.bottomBarText}>
            {markedAsViolated.size > 0 
              ? `${markedAsViolated.size} bài vi phạm • ${posts.length - markedAsViolated.size} bài duyệt`
              : `Duyệt tất cả ${posts.length} bài`
            }
          </ThemedText>
          <Pressable
            style={[styles.continueButton, saving && styles.buttonDisabled]}
            onPress={saveAndContinue}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <ThemedText style={styles.continueButtonText}>Tiếp tục</ThemedText>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </>
            )}
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: "#65676b",
  },
  listContent: {
    padding: 8,
  },
  columnWrapper: {
    gap: 8,
  },
  postCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 2,
    borderColor: "#f0f0f0",
    alignItems: "center",
    minHeight: 180,
  },
  postCardMarked: {
    borderColor: "#ef4444",
    backgroundColor: "#fef2f2",
  },
  postUserName: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
    color: "#1c1e21",
    textAlign: "center",
    width: "100%",
  },
  postContent: {
    fontSize: 13,
    lineHeight: 18,
    color: "#65676b",
    marginBottom: 8,
    textAlign: "center",
    flex: 1,
  },
  postTime: {
    fontSize: 11,
    color: "#9ca3af",
    marginBottom: 10,
  },
  violateButton: {
    width: "100%",
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 4,
  },
  violateButtonActive: {
    backgroundColor: "#ef4444",
    borderColor: "#ef4444",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  bottomBar: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#e4e6eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  bottomBarText: {
    fontSize: 14,
    color: "#65676b",
    fontWeight: "600",
    flex: 1,
  },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#10b981",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  continueButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  emptyState: {
    paddingVertical: 80,
    paddingHorizontal: 40,
    alignItems: "center",
  },
  emptyIconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#d1fae5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 8,
    color: "#10b981",
  },
  emptyText: {
    fontSize: 17,
    color: "#65676b",
    textAlign: "center",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e4e6eb",
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: "center",
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: "#10b981",
  },
  tabText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#65676b",
  },
  tabTextActive: {
    color: "#10b981",
  },
  rejectedBadge: {
    width: "100%",
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 4,
  },
  rejectedText: {
    fontSize: 13,
    color: "#ef4444",
    fontWeight: "600",
  },
});
