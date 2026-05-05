import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Modal,
    Pressable,
    Share,
    StyleSheet,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAppColorScheme } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabase";

const showError = (title: string, message: string) => Alert.alert(title, message);
const showSuccess = (title: string, message: string) => Alert.alert(title, message);

type Post = {
  id: number;
  user_id: string;
  content: string;
  images: string[] | null;
  visibility: 'public' | 'friends' | 'private';
  likes_count: number;
  comments_count: number;
  shares_count: number;
  created_at: string;
  user_liked?: boolean;
};

type Comment = {
  id: number;
  post_id: number;
  user_id: string;
  parent_comment_id: number | null;
  content: string;
  created_at: string;
  user_display_name?: string;
  user_avatar_url?: string;
};

type UserProfile = {
  user_id: string;
  display_name: string;
  avatar_url: string;
  bio: string;
  email: string;
};

export default function ProfileScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const colorScheme = useAppColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostVisibility, setNewPostVisibility] = useState<'public' | 'friends' | 'private'>('public');
  const [creating, setCreating] = useState(false);
  
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [loadingComments, setLoadingComments] = useState(false);
  
  const [showEditModal, setShowEditModal] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'about' | 'photos'>('posts');
  
  const [showPostMenu, setShowPostMenu] = useState(false);
  const [selectedPostForMenu, setSelectedPostForMenu] = useState<Post | null>(null);
  const [showEditPostModal, setShowEditPostModal] = useState(false);
  const [editPostVisibility, setEditPostVisibility] = useState<'public' | 'friends' | 'private'>('public');
  
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedPostForShare, setSelectedPostForShare] = useState<Post | null>(null);
  
  const [friendshipStatus, setFriendshipStatus] = useState<'none' | 'pending' | 'pending_received' | 'accepted' | 'self'>('none');

  useEffect(() => {
    loadProfile();
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
      setIsOwner(user.id === userId);

      if (user.id !== userId) {
        const { data: friendshipData } = await supabase
          .from("friendships")
          .select("status, user_id, friend_id")
          .or(`and(user_id.eq.${user.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${user.id})`);

        const friendship = friendshipData && friendshipData.length > 0 ? friendshipData[0] : null;
        if (friendship) {
          if (friendship.status === 'accepted') {
            setFriendshipStatus('accepted');
          } else if (friendship.status === 'pending' && friendship.user_id === user.id) {
            setFriendshipStatus('pending');
          } else if (friendship.status === 'pending' && friendship.user_id === userId) {
            setFriendshipStatus('pending_received');
          }
        } else {
          setFriendshipStatus('none');
        }
      } else {
        setFriendshipStatus('self');
      }

      const { data: profileData, error: profileError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);
      setEditDisplayName(profileData.display_name || "");
      setEditBio(profileData.bio || "");

      await loadPosts(user.id);
    } catch (error: any) {
      console.error("Error loading profile:", error);
      showError("Lỗi", "Không thể tải hồ sơ");
    } finally {
      setLoading(false);
    }
  };

  const loadPosts = async (currentUserId: string) => {
    try {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("user_id", userId)
        .in("status", ["pending", "approved"])
        .order("created_at", { ascending: false });
      
      if (error) throw error;

      const postsWithLikes = await Promise.all(
        (data || []).map(async (post) => {
          const { data: likeData } = await supabase
            .from("post_likes")
            .select("id")
            .eq("post_id", post.id)
            .eq("user_id", currentUserId)
            .single();

          const { count: likesCount } = await supabase
            .from("post_likes")
            .select("*", { count: "exact", head: true })
            .eq("post_id", post.id);

          const { count: commentsCount } = await supabase
            .from("post_comments")
            .select("*", { count: "exact", head: true })
            .eq("post_id", post.id);

          const { count: sharesCount } = await supabase
            .from("post_shares")
            .select("*", { count: "exact", head: true })
            .eq("post_id", post.id);

          return {
            ...post,
            likes_count: likesCount || 0,
            comments_count: commentsCount || 0,
            shares_count: sharesCount || 0,
            user_liked: !!likeData,
          };
        })
      );

      setPosts(postsWithLikes);
    } catch (error: any) {
      console.error("Error loading posts:", error);
    }
  };

  const createPost = async () => {
    if (!newPostContent.trim() || creating) return;
    try {
      setCreating(true);
      const { error } = await supabase
        .from("posts")
        .insert({
          user_id: currentUserId,
          content: newPostContent.trim(),
          visibility: newPostVisibility,
        });

      if (error) throw error;
      showSuccess("Thành công", "Đã đăng bài viết!");
      setNewPostContent("");
      setShowCreateModal(false);
      loadPosts(currentUserId!);
    } catch (error: any) {
      showError("Lỗi", "Không thể đăng bài viết");
    } finally {
      setCreating(false);
    }
  };

  const toggleLikePost = async (post: Post) => {
    try {
      if (post.user_liked) {
        await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", currentUserId);
      } else {
        await supabase
          .from("post_likes")
          .insert({ post_id: post.id, user_id: currentUserId });
      }
      await loadPosts(currentUserId!);
    } catch (error: any) {
      console.error("Error toggling like:", error);
    }
  };

  const loadComments = async (postId: number) => {
    try {
      setLoadingComments(true);
      const { data, error } = await supabase
        .from("post_comments")
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Load user info for each comment
      const commentsWithUsers = await Promise.all(
        (data || []).map(async (comment) => {
          const { data: profileData } = await supabase
            .from("user_profiles")
            .select("display_name, avatar_url")
            .eq("user_id", comment.user_id)
            .single();

          return {
            ...comment,
            user_display_name: profileData?.display_name || "User",
            user_avatar_url: profileData?.avatar_url,
          };
        })
      );

      setComments(commentsWithUsers);
    } catch (error: any) {
      console.error("Error loading comments:", error);
    } finally {
      setLoadingComments(false);
    }
  };

  const openCommentsModal = (post: Post) => {
    setSelectedPost(post);
    setShowCommentsModal(true);
    loadComments(post.id);
  };

  const addComment = async () => {
    if (!newComment.trim() || !selectedPost) return;
    try {
      const { error } = await supabase
        .from("post_comments")
        .insert({
          post_id: selectedPost.id,
          user_id: currentUserId,
          parent_comment_id: replyingTo?.id || null,
          content: newComment.trim(),
        });

      if (error) throw error;
      setNewComment("");
      setReplyingTo(null);
      await loadComments(selectedPost.id);
      await loadPosts(currentUserId!);
    } catch (error: any) {
      showError("Lỗi", "Không thể thêm bình luận");
    }
  };

  const getCommentAvatar = (avatarUrl?: string, displayName?: string) => {
    if (avatarUrl) return avatarUrl;
    return 'https://ui-avatars.com/api/?name=' + encodeURIComponent(displayName || 'User') + '&size=80&background=1877f2&color=fff&bold=true';
  };

  const renderComment = (comment: Comment) => {
    const isReply = !!comment.parent_comment_id;

    return (
      <View key={comment.id} style={[styles.commentItem, isReply && styles.commentReply]}>
        <Image
          source={{ uri: getCommentAvatar(comment.user_avatar_url, comment.user_display_name) }}
          style={styles.commentAvatar}
        />
        <View style={styles.commentContent}>
          <View style={styles.commentBubble}>
            <ThemedText style={styles.commentUserName}>{comment.user_display_name}</ThemedText>
            <ThemedText style={styles.commentText}>{comment.content}</ThemedText>
          </View>
          <View style={styles.commentActions}>
            <Pressable onPress={() => setReplyingTo(comment)}>
              <ThemedText style={styles.commentAction}>Trả lời</ThemedText>
            </Pressable>
            <ThemedText style={styles.commentActionDot}> · </ThemedText>
            <ThemedText style={styles.commentTime}>
              {new Date(comment.created_at).toLocaleDateString('vi-VN')}
            </ThemedText>
          </View>
        </View>
      </View>
    );
  };

  const renderCommentWithReplies = (comment: Comment) => {
    if (comment.parent_comment_id) return null;
    
    // Lấy tất cả reply (bao gồm cả reply của reply)
    const allReplies = comments.filter(c => c.parent_comment_id === comment.id);
    
    return (
      <View key={comment.id}>
        {renderComment(comment)}
        {allReplies.map(reply => {
          // Render reply
          const nestedReplies = comments.filter(c => c.parent_comment_id === reply.id);
          return (
            <View key={reply.id}>
              {renderComment(reply)}
              {nestedReplies.map(nested => renderComment(nested))}
            </View>
          );
        })}
      </View>
    );
  };

  const sharePost = async (post: Post) => {
    setSelectedPostForShare(post);
    setShowShareModal(true);
  };

  const shareToProfile = async () => {
    if (!selectedPostForShare) return;
    try {
      const { error } = await supabase
        .from("posts")
        .insert({
          user_id: currentUserId,
          content: `Đã chia sẻ bài viết của ${profile?.display_name}:\n\n${selectedPostForShare.content}`,
          visibility: 'public',
        });

      if (error) throw error;

      await supabase
        .from("post_shares")
        .insert({
          post_id: selectedPostForShare.id,
          user_id: currentUserId,
          shared_to: 'profile',
        });

      showSuccess("Thành công", "Đã chia sẻ về trang cá nhân!");
      setShowShareModal(false);
      await loadPosts(currentUserId!);
    } catch (error: any) {
      showError("Lỗi", "Không thể chia sẻ bài viết");
    }
  };

  const shareExternal = async () => {
    if (!selectedPostForShare) return;
    try {
      const result = await Share.share({
        message: `${selectedPostForShare.content}\n\nXem thêm tại Finly App`,
      });

      if (result.action === Share.sharedAction) {
        await supabase
          .from("post_shares")
          .insert({
            post_id: selectedPostForShare.id,
            user_id: currentUserId,
            shared_to: 'external',
          });
        showSuccess("Thành công", "Đã chia sẻ!");
        setShowShareModal(false);
        await loadPosts(currentUserId!);
      }
    } catch (error: any) {
      console.error("Error sharing externally:", error);
    }
  };

  const sendFriendRequest = async () => {
    try {
      const { data: existing } = await supabase
        .from("friendships")
        .select("*")
        .or(`and(user_id.eq.${currentUserId},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${currentUserId})`);

      if (existing && existing.length > 0) {
        showError("Thông báo", "Đã có quan hệ bạn bè với người này!");
        return;
      }

      const { error } = await supabase
        .from("friendships")
        .insert({ user_id: currentUserId, friend_id: userId, status: 'pending' });

      if (error) throw error;
      setFriendshipStatus('pending');
      showSuccess("Thành công", "Đã gửi lời mời kết bạn!");
    } catch (error: any) {
      showError("Lỗi", "Không thể gửi lời mời kết bạn");
    }
  };

  const saveProfile = async () => {
    if (!editDisplayName.trim() || saving) return;
    try {
      setSaving(true);
      const { error } = await supabase
        .from("user_profiles")
        .update({
          display_name: editDisplayName.trim(),
          bio: editBio.trim() || null,
        })
        .eq("user_id", currentUserId);

      if (error) throw error;
      
      showSuccess("Thành công", "Đã cập nhật thông tin!");
      setShowEditModal(false);
      await loadProfile();
    } catch (error: any) {
      showError("Lỗi", "Không thể cập nhật thông tin");
    } finally {
      setSaving(false);
    }
  };

  const getDefaultAvatar = () => {
    return 'https://ui-avatars.com/api/?name=' + encodeURIComponent(profile?.display_name || 'User') + '&size=200&background=1877f2&color=fff&bold=true';
  };

  const getVisibilityText = (visibility: string) => {
    switch (visibility) {
      case 'public': return '🌐 Công khai';
      case 'friends': return '👥 Bạn bè';
      case 'private': return '🔒 Riêng tư';
      default: return visibility;
    }
  };

  const parseSharedPost = (content: string) => {
    const sharedMatch = content.match(/^Đã chia sẻ bài viết của (.+?):\n\n(.+)$/s);
    if (sharedMatch) {
      return {
        is_shared: true,
        original_author: sharedMatch[1],
        original_content: sharedMatch[2],
      };
    }
    return { is_shared: false };
  };

  const renderPost = ({ item }: { item: Post }) => {
    const sharedInfo = parseSharedPost(item.content);
    
    // Theme colors
    const cardBg = isDark ? '#1f2937' : '#ffffff';
    const text = isDark ? '#f9fafb' : '#1f2937';
    const subtleText = isDark ? '#9ca3af' : '#65676b';
    const borderColor = isDark ? '#374151' : '#e4e6eb';
    const sharedBg = isDark ? '#374151' : '#f0f2f5';
    
    return (
      <View style={[styles.postCard, { backgroundColor: cardBg, borderBottomColor: isDark ? '#374151' : '#f0f2f5' }]}>
        <View style={styles.postHeader}>
          <View style={styles.postUserInfo}>
            <Image
              source={{ uri: profile?.avatar_url || getDefaultAvatar() }}
              style={styles.postAvatar}
            />
            <View>
              <ThemedText style={[styles.postUserName, { color: text }]}>{profile?.display_name}</ThemedText>
              <View style={styles.postMetaRow}>
                <ThemedText style={[styles.postTime, { color: subtleText }]}>
                  {new Date(item.created_at).toLocaleDateString('vi-VN')}
                </ThemedText>
                <ThemedText style={[styles.postTime, { color: subtleText }]}> · </ThemedText>
                <ThemedText style={[styles.postTime, { color: subtleText }]}>{getVisibilityText(item.visibility)}</ThemedText>
              </View>
            </View>
          </View>
        </View>

        <ThemedText style={[styles.postContent, { color: text }]}>
          {sharedInfo.is_shared ? `Đã chia sẻ bài viết của ${sharedInfo.original_author}` : item.content}
        </ThemedText>

        {sharedInfo.is_shared && (
          <View style={styles.sharedPostContainer}>
            <View style={styles.sharedPostBorder} />
            <View style={[styles.sharedPostContent, { backgroundColor: sharedBg }]}>
              <ThemedText style={[styles.sharedPostText, { color: text }]}>{sharedInfo.original_content}</ThemedText>
            </View>
          </View>
        )}

        {(item.likes_count > 0 || item.comments_count > 0 || item.shares_count > 0) && (
          <View style={[styles.postStats, { borderTopColor: borderColor, borderBottomColor: borderColor }]}>
            <View style={styles.postStatLeft}>
              {item.likes_count > 0 && (
                <>
                  <View style={styles.likeIcon}>
                    <Ionicons name="heart" size={12} color="#fff" />
                  </View>
                  <ThemedText style={[styles.postStat, { color: subtleText }]}>{item.likes_count}</ThemedText>
                </>
              )}
            </View>
            <View style={styles.postStatRight}>
              {item.comments_count > 0 && (
                <ThemedText style={[styles.postStat, { color: subtleText }]}>{item.comments_count} bình luận</ThemedText>
              )}
              {item.comments_count > 0 && item.shares_count > 0 && (
                <ThemedText style={[styles.postStatDot, { color: subtleText }]}> · </ThemedText>
              )}
              {item.shares_count > 0 && (
                <ThemedText style={[styles.postStat, { color: subtleText }]}>{item.shares_count} chia sẻ</ThemedText>
              )}
            </View>
          </View>
        )}

        <View style={styles.postActions}>
          <Pressable style={styles.postAction} onPress={() => toggleLikePost(item)}>
            <Ionicons 
              name={item.user_liked ? "heart" : "heart-outline"} 
              size={20} 
              color={item.user_liked ? "#ef4444" : subtleText} 
            />
            <ThemedText style={[styles.postActionText, { color: item.user_liked ? "#ef4444" : subtleText }]}>
              Thích
            </ThemedText>
          </Pressable>

          <Pressable style={styles.postAction} onPress={() => openCommentsModal(item)}>
            <Ionicons name="chatbubble-outline" size={20} color={subtleText} />
            <ThemedText style={[styles.postActionText, { color: subtleText }]}>Bình luận</ThemedText>
          </Pressable>

          <Pressable style={styles.postAction} onPress={() => sharePost(item)}>
            <Ionicons name="share-outline" size={20} color={subtleText} />
            <ThemedText style={[styles.postActionText, { color: subtleText }]}>Chia sẻ</ThemedText>
          </Pressable>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: isDark ? '#111827' : '#fff' }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      </SafeAreaView>
    );
  }

  // Theme colors
  const screenBg = isDark ? '#111827' : '#f5f5f5';
  const cardBg = isDark ? '#1f2937' : '#ffffff';
  const text = isDark ? '#f9fafb' : '#1f2937';
  const subtleText = isDark ? '#9ca3af' : '#65676b';
  const borderColor = isDark ? '#374151' : '#e4e6eb';
  const inputBg = isDark ? '#374151' : '#f0f2f5';
  const modalBg = isDark ? '#1f2937' : '#ffffff';
  const overlayBg = isDark ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.6)';

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: screenBg }]} edges={['bottom']}>
      <Stack.Screen options={{ title: profile?.display_name || "Hồ sơ" }} />

      <FlatList
        data={activeTab === 'posts' ? posts : []}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderPost}
        ListHeaderComponent={
          <>
            <View style={[styles.profileHeader, { backgroundColor: cardBg }]}>
              <Image
                source={{ uri: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&h=400&fit=crop' }}
                style={styles.coverPhoto}
              />
              <View style={styles.profileInfoSection}>
                <View style={styles.avatarSection}>
                  <Image
                    source={{ uri: profile?.avatar_url || getDefaultAvatar() }}
                    style={styles.avatar}
                  />
                </View>
                <ThemedText style={[styles.displayName, { color: text }]}>{profile?.display_name}</ThemedText>
                {profile?.bio && <ThemedText style={[styles.bio, { color: subtleText }]}>{profile.bio}</ThemedText>}
                
                <View style={styles.profileActions}>
                  {isOwner ? (
                    <>
                      <Pressable style={styles.createPostButton} onPress={() => setShowCreateModal(true)}>
                        <Ionicons name="add-circle-outline" size={20} color="#fff" />
                        <ThemedText style={styles.createPostButtonText}>Tạo bài viết</ThemedText>
                      </Pressable>
                    </>
                  ) : friendshipStatus === 'accepted' ? (
                    <>
                      <Pressable style={styles.friendButton}>
                        <Ionicons name="checkmark-circle" size={20} color="#050505" />
                        <ThemedText style={styles.friendButtonText}>Bạn bè</ThemedText>
                      </Pressable>
                      <Pressable 
                        style={styles.messageButton}
                        onPress={() => router.push(`/chat/${userId}`)}
                      >
                        <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
                        <ThemedText style={styles.messageButtonText}>Nhắn tin</ThemedText>
                      </Pressable>
                    </>
                  ) : (
                    <Pressable style={styles.createPostButton} onPress={sendFriendRequest}>
                      <Ionicons name="person-add" size={20} color="#fff" />
                      <ThemedText style={styles.createPostButtonText}>Thêm bạn bè</ThemedText>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>

            <View style={[styles.tabsContainer, { backgroundColor: cardBg, borderBottomColor: borderColor }]}>
              <View style={styles.tabs}>
                <Pressable style={[styles.tab, activeTab === 'posts' && styles.tabActive]} onPress={() => setActiveTab('posts')}>
                  <ThemedText style={[styles.tabText, { color: activeTab === 'posts' ? '#1877f2' : subtleText }]}>Bài viết</ThemedText>
                </Pressable>
                <Pressable style={[styles.tab, activeTab === 'about' && styles.tabActive]} onPress={() => setActiveTab('about')}>
                  <ThemedText style={[styles.tabText, { color: activeTab === 'about' ? '#1877f2' : subtleText }]}>Giới thiệu</ThemedText>
                </Pressable>
              </View>
            </View>

            {activeTab === 'about' && (
              <View style={[styles.aboutSection, { backgroundColor: cardBg, borderBottomColor: isDark ? '#374151' : '#f0f2f5' }]}>
                <View style={styles.aboutHeader}>
                  <ThemedText style={[styles.aboutTitle, { color: text }]}>Giới thiệu</ThemedText>
                  {isOwner && (
                    <Pressable style={styles.editButton} onPress={() => setShowEditModal(true)}>
                      <Ionicons name="create-outline" size={20} color="#1877f2" />
                      <ThemedText style={styles.editButtonText}>Chỉnh sửa</ThemedText>
                    </Pressable>
                  )}
                </View>
                
                {profile?.bio ? (
                  <ThemedText style={[styles.aboutBio, { color: text }]}>{profile.bio}</ThemedText>
                ) : (
                  <ThemedText style={[styles.aboutEmpty, { color: subtleText }]}>
                    {isOwner ? "Thêm tiểu sử để giới thiệu bản thân" : "Chưa có thông tin giới thiệu"}
                  </ThemedText>
                )}

                <View style={styles.aboutInfo}>
                  <View style={styles.aboutInfoItem}>
                    <Ionicons name="mail-outline" size={20} color={subtleText} />
                    <ThemedText style={[styles.aboutInfoText, { color: text }]}>{profile?.email}</ThemedText>
                  </View>
                </View>
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          activeTab === 'posts' ? (
            <View style={[styles.emptyState, { backgroundColor: cardBg }]}>
              <Ionicons name="document-text-outline" size={64} color="#d1d5db" />
              <ThemedText style={[styles.emptyText, { color: subtleText }]}>Chưa có bài viết nào</ThemedText>
            </View>
          ) : null
        }
      />

      <Modal visible={showEditModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: overlayBg }]}>
          <View style={[styles.modalContent, { backgroundColor: modalBg }]}>
            <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
              <ThemedText style={[styles.modalTitle, { color: text }]}>Chỉnh sửa giới thiệu</ThemedText>
              <Pressable onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color={subtleText} />
              </Pressable>
            </View>

            <View style={styles.editForm}>
              <View style={styles.formGroup}>
                <ThemedText style={[styles.formLabel, { color: text }]}>Tên hiển thị</ThemedText>
                <TextInput
                  style={[styles.formInput, { borderColor, backgroundColor: inputBg, color: text }]}
                  placeholder="Nhập tên của bạn"
                  placeholderTextColor={subtleText}
                  value={editDisplayName}
                  onChangeText={setEditDisplayName}
                  maxLength={50}
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={[styles.formLabel, { color: text }]}>Tiểu sử</ThemedText>
                <TextInput
                  style={[styles.formInput, styles.formTextArea, { borderColor, backgroundColor: inputBg, color: text }]}
                  placeholder="Viết vài dòng về bản thân..."
                  placeholderTextColor={subtleText}
                  value={editBio}
                  onChangeText={setEditBio}
                  multiline
                  maxLength={200}
                  textAlignVertical="top"
                />
                <ThemedText style={[styles.charCount, { color: subtleText }]}>{editBio.length}/200</ThemedText>
              </View>
            </View>

            <Pressable
              style={[styles.saveButton, (!editDisplayName.trim() || saving) && styles.saveButtonDisabled]}
              onPress={saveProfile}
              disabled={!editDisplayName.trim() || saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <ThemedText style={styles.saveButtonText}>Lưu thay đổi</ThemedText>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: overlayBg }]}>
          <View style={[styles.modalContent, { backgroundColor: modalBg }]}>
            <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
              <ThemedText style={[styles.modalTitle, { color: text }]}>Tạo bài viết</ThemedText>
              <Pressable onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color={subtleText} />
              </Pressable>
            </View>

            <TextInput
              style={[styles.postInput, { color: text }]}
              placeholder="Bạn đang nghĩ gì?"
              placeholderTextColor={subtleText}
              value={newPostContent}
              onChangeText={setNewPostContent}
              multiline
              maxLength={1000}
            />

            <Pressable
              style={[styles.createButton, (!newPostContent.trim() || creating) && styles.createButtonDisabled]}
              onPress={createPost}
              disabled={!newPostContent.trim() || creating}
            >
              {creating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <ThemedText style={styles.createButtonText}>Đăng</ThemedText>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showCommentsModal} animationType="slide" transparent>
        <View style={styles.commentsModalOverlay}>
          <ThemedView style={styles.commentsModalContent}>
            <View style={styles.commentsModalHeader}>
              <ThemedText style={styles.commentsModalTitle}>Bình luận</ThemedText>
              <Pressable onPress={() => {
                setShowCommentsModal(false);
                setReplyingTo(null);
              }}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </Pressable>
            </View>

            {loadingComments ? (
              <View style={styles.commentsLoading}>
                <ActivityIndicator size="large" color="#6366f1" />
              </View>
            ) : (
              <FlatList
                data={comments.filter(c => !c.parent_comment_id)}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => renderCommentWithReplies(item)}
                contentContainerStyle={styles.commentsList}
                ListEmptyComponent={
                  <View style={styles.commentsEmpty}>
                    <Ionicons name="chatbubble-outline" size={48} color="#d1d5db" />
                    <ThemedText style={styles.commentsEmptyText}>Chưa có bình luận nào</ThemedText>
                  </View>
                }
              />
            )}

            <View style={styles.commentInputContainer}>
              {replyingTo && (
                <View style={styles.replyingToBar}>
                  <ThemedText style={styles.replyingToText}>
                    Đang trả lời {replyingTo.user_display_name}
                  </ThemedText>
                  <Pressable onPress={() => setReplyingTo(null)}>
                    <Ionicons name="close-circle" size={20} color="#6b7280" />
                  </Pressable>
                </View>
              )}
              <View style={styles.commentInputRow}>
                <Image
                  source={{ uri: profile?.avatar_url || getDefaultAvatar() }}
                  style={styles.commentInputAvatar}
                />
                <TextInput
                  style={styles.commentInput}
                  placeholder={replyingTo ? "Viết câu trả lời..." : "Viết bình luận..."}
                  value={newComment}
                  onChangeText={setNewComment}
                  multiline
                />
                <Pressable
                  style={[styles.commentSendButton, !newComment.trim() && styles.commentSendButtonDisabled]}
                  onPress={addComment}
                  disabled={!newComment.trim()}
                >
                  <Ionicons name="send" size={20} color={newComment.trim() ? "#1877f2" : "#bcc0c4"} />
                </Pressable>
              </View>
            </View>
          </ThemedView>
        </View>
      </Modal>

      <Modal visible={showShareModal} animationType="slide" transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setShowShareModal(false)}>
          <View style={styles.shareModalContent}>
            <View style={styles.shareModalHandle} />
            <ThemedText style={styles.shareModalTitle}>Chia sẻ bài viết</ThemedText>
            
            <Pressable style={styles.shareOption} onPress={shareToProfile}>
              <View style={styles.shareOptionIcon}>
                <Ionicons name="person-circle" size={32} color="#1877f2" />
              </View>
              <View style={styles.shareOptionText}>
                <ThemedText style={styles.shareOptionTitle}>Chia sẻ về trang cá nhân</ThemedText>
                <ThemedText style={styles.shareOptionDesc}>Đăng lên trang cá nhân của bạn</ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#65676b" />
            </Pressable>

            <Pressable style={styles.shareOption} onPress={shareExternal}>
              <View style={styles.shareOptionIcon}>
                <Ionicons name="share-social" size={32} color="#42b883" />
              </View>
              <View style={styles.shareOptionText}>
                <ThemedText style={styles.shareOptionTitle}>Chia sẻ ra ngoài</ThemedText>
                <ThemedText style={styles.shareOptionDesc}>Gửi qua tin nhắn, email hoặc mạng xã hội</ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#65676b" />
            </Pressable>

            <Pressable style={styles.shareCancelButton} onPress={() => setShowShareModal(false)}>
              <ThemedText style={styles.shareCancelText}>Hủy</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Tạo bài viết</ThemedText>
              <Pressable onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </Pressable>
            </View>

            <TextInput
              style={styles.postInput}
              placeholder="Bạn đang nghĩ gì?"
              value={newPostContent}
              onChangeText={setNewPostContent}
              multiline
              maxLength={1000}
            />

            <Pressable
              style={[styles.createButton, (!newPostContent.trim() || creating) && styles.createButtonDisabled]}
              onPress={createPost}
              disabled={!newPostContent.trim() || creating}
            >
              {creating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <ThemedText style={styles.createButtonText}>Đăng</ThemedText>
              )}
            </Pressable>
          </ThemedView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  profileHeader: {
    backgroundColor: "#fff",
    marginBottom: 0,
  },
  coverPhoto: {
    width: "100%",
    height: 200,
  },
  profileInfoSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    alignItems: "center",
  },
  avatarSection: {
    marginTop: -50,
    marginBottom: 12,
  },
  avatar: {
    width: 168,
    height: 168,
    borderRadius: 84,
    borderWidth: 5,
    borderColor: "#fff",
  },
  displayName: {
    fontSize: 32,
    fontWeight: "800",
    marginBottom: 4,
    textAlign: "center",
  },
  bio: {
    fontSize: 15,
    color: "#65676b",
    marginBottom: 16,
    textAlign: "center",
  },
  profileActions: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
  },
  createPostButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#1877f2",
    paddingVertical: 10,
    borderRadius: 8,
  },
  createPostButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  friendButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#e4e6eb",
    paddingVertical: 10,
    borderRadius: 8,
  },
  friendButtonText: {
    color: "#050505",
    fontWeight: "700",
    fontSize: 15,
  },
  messageButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#1877f2",
    paddingVertical: 10,
    borderRadius: 8,
  },
  messageButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  tabsContainer: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e4e6eb",
    marginBottom: 0,
  },
  tabs: {
    flexDirection: "row",
    paddingHorizontal: 16,
  },
  tab: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: "#1877f2",
  },
  tabText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#65676b",
  },
  tabTextActive: {
    color: "#1877f2",
  },
  postCard: {
    backgroundColor: "#fff",
    marginBottom: 0,
    borderBottomWidth: 8,
    borderBottomColor: "#f0f2f5",
  },
  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
  },
  postUserInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  postAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  postUserName: {
    fontWeight: "600",
    fontSize: 15,
  },
  postMetaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  postTime: {
    fontSize: 13,
    color: "#65676b",
  },
  postContent: {
    fontSize: 15,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  sharedPostContainer: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    overflow: "hidden",
  },
  sharedPostBorder: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: "#1877f2",
  },
  sharedPostContent: {
    backgroundColor: "#f0f2f5",
    padding: 12,
    paddingLeft: 16,
    borderRadius: 12,
  },
  sharedPostText: {
    fontSize: 15,
  },
  postStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#e4e6eb",
    borderBottomWidth: 1,
    borderBottomColor: "#e4e6eb",
  },
  postStatLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  postStatRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  likeIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
  },
  postStat: {
    fontSize: 13,
    color: "#65676b",
  },
  postStatDot: {
    fontSize: 13,
    color: "#65676b",
    marginHorizontal: 4,
  },
  postActions: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  postAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
  },
  postActionText: {
    fontSize: 15,
    color: "#65676b",
    fontWeight: "600",
  },
  postActionTextLiked: {
    color: "#ef4444",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "90%",
    maxWidth: 500,
    backgroundColor: "#fff",
    borderRadius: 12,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e4e6eb",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  postInput: {
    fontSize: 15,
    minHeight: 120,
    textAlignVertical: "top",
    padding: 16,
  },
  createButton: {
    backgroundColor: "#1877f2",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    margin: 16,
    marginTop: 0,
  },
  createButtonDisabled: {
    backgroundColor: "#e4e6eb",
  },
  createButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  shareModalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: 32,
    marginTop: "auto",
  },
  shareModalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#e4e6eb",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  shareModalTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 20,
  },
  shareOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 12,
  },
  shareOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#f0f2f5",
    alignItems: "center",
    justifyContent: "center",
  },
  shareOptionText: {
    flex: 1,
  },
  shareOptionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  shareOptionDesc: {
    fontSize: 13,
    color: "#65676b",
  },
  shareCancelButton: {
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 14,
    backgroundColor: "#f0f2f5",
    borderRadius: 12,
    alignItems: "center",
  },
  shareCancelText: {
    fontSize: 16,
    fontWeight: "600",
  },
  commentsModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  commentsModalContent: {
    height: "90%",
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  commentsModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e4e6eb",
  },
  commentsModalTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  commentsLoading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  commentsList: {
    padding: 16,
  },
  commentsEmpty: {
    padding: 60,
    alignItems: "center",
  },
  commentsEmptyText: {
    fontSize: 15,
    color: "#65676b",
    marginTop: 12,
  },
  commentItem: {
    flexDirection: "row",
    marginBottom: 16,
    gap: 8,
  },
  commentReply: {
    marginLeft: 48,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  commentContent: {
    flex: 1,
  },
  commentBubble: {
    backgroundColor: "#f0f2f5",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  commentUserName: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 2,
  },
  commentText: {
    fontSize: 15,
  },
  commentActions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    marginLeft: 12,
  },
  commentAction: {
    fontSize: 12,
    color: "#65676b",
    fontWeight: "600",
  },
  commentActionDot: {
    fontSize: 12,
    color: "#65676b",
    marginHorizontal: 4,
  },
  commentTime: {
    fontSize: 12,
    color: "#65676b",
  },
  commentInputContainer: {
    borderTopWidth: 1,
    borderTopColor: "#e4e6eb",
    backgroundColor: "#fff",
  },
  replyingToBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#f0f2f5",
  },
  replyingToText: {
    fontSize: 13,
    color: "#65676b",
  },
  commentInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    gap: 8,
  },
  commentInputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  commentInput: {
    flex: 1,
    backgroundColor: "#f0f2f5",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 15,
  },
  commentSendButton: {
    padding: 8,
  },
  commentSendButtonDisabled: {
    opacity: 0.5,
  },
  aboutSection: {
    backgroundColor: "#fff",
    padding: 16,
    marginBottom: 0,
    borderBottomWidth: 8,
    borderBottomColor: "#f0f2f5",
  },
  aboutHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  aboutTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#e7f3ff",
    borderRadius: 6,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1877f2",
  },
  aboutBio: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  aboutEmpty: {
    fontSize: 15,
    color: "#65676b",
    fontStyle: "italic",
    marginBottom: 16,
  },
  aboutInfo: {
    gap: 12,
  },
  aboutInfoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  aboutInfoText: {
    fontSize: 15,
    color: "#050505",
  },
  editForm: {
    padding: 16,
    gap: 20,
  },
  formGroup: {
    gap: 8,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#050505",
  },
  formInput: {
    borderWidth: 1,
    borderColor: "#e4e6eb",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: "#fff",
  },
  formTextArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 12,
    color: "#65676b",
    textAlign: "right",
  },
  saveButton: {
    backgroundColor: "#1877f2",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    margin: 16,
    marginTop: 0,
  },
  saveButtonDisabled: {
    backgroundColor: "#e4e6eb",
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  emptyState: {
    padding: 60,
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 0,
    margin: 0,
  },
  emptyText: {
    fontSize: 17,
    color: "#65676b",
    marginTop: 12,
    fontWeight: "600",
  },
});
