import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { supabase } from "@/lib/supabase";

const { width: screenWidth } = Dimensions.get("window");
const isSmallScreen = screenWidth < 375;
const isMediumScreen = screenWidth >= 375 && screenWidth < 414;

type UserProfile = {
  email: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  location: string;
  website: string;
  is_public: boolean;
};

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({
    email: "",
    display_name: "",
    bio: "",
    avatar_url: "",
    location: "",
    website: "",
    is_public: true,
  });

  useEffect(() => {
    loadProfile();
  }, []);

  // Pick and upload avatar
  const pickAvatar = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Lỗi', 'Cần quyền truy cập thư viện ảnh');
        return;
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled) return;

      setUploadingAvatar(true);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Lỗi', 'Vui lòng đăng nhập lại');
        return;
      }

      // Get file info
      const uri = result.assets[0].uri;
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${user.id}.${fileExt}`;

      // Convert to blob
      const response = await fetch(uri);
      const blob = await response.blob();

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, {
          contentType: `image/${fileExt}`,
          upsert: true, // Overwrite if exists
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        Alert.alert('Lỗi', 'Không thể tải ảnh lên: ' + uploadError.message);
        return;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const avatarUrl = urlData.publicUrl + '?t=' + Date.now(); // Cache busting

      // Update user metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          avatar_url: avatarUrl,
        },
      });

      if (updateError) {
        console.error('Update error:', updateError);
        Alert.alert('Lỗi', 'Không thể cập nhật ảnh đại diện: ' + updateError.message);
        return;
      }

      // Update local state
      setProfile(prev => ({ ...prev, avatar_url: avatarUrl }));

      Alert.alert('Thành công', 'Đã cập nhật ảnh đại diện');
    } catch (error: any) {
      console.error('Error picking avatar:', error);
      Alert.alert('Lỗi', error.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const loadProfile = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/auth/login");
        return;
      }

      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setProfile({
          email: data.email || user.email || "",
          display_name: data.display_name || user.user_metadata?.display_name || "",
          bio: data.bio || "",
          avatar_url: data.avatar_url || user.user_metadata?.avatar_url || "",
          location: data.location || "",
          website: data.website || "",
          is_public: data.is_public ?? true,
        });
      } else {
        // Set data from auth user if profile doesn't exist
        setProfile(prev => ({ 
          ...prev, 
          email: user.email || "",
          display_name: user.user_metadata?.display_name || user.user_metadata?.full_name || "",
          avatar_url: user.user_metadata?.avatar_url || "",
        }));
      }
    } catch (error: any) {
      console.error("Error loading profile:", error);
      Alert.alert("Lỗi", "Không thể tải thông tin cá nhân");
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("user_profiles")
        .upsert({
          user_id: user.id,
          email: user.email, // Always use auth email
          display_name: profile.display_name.trim() || null,
          bio: profile.bio.trim() || null,
          avatar_url: profile.avatar_url.trim() || null,
          location: profile.location.trim() || null,
          website: profile.website.trim() || null,
          is_public: profile.is_public,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      // Also update auth user metadata to keep in sync
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          display_name: profile.display_name.trim() || null,
          avatar_url: profile.avatar_url.trim() || null,
        },
      });

      if (authError) {
        console.warn('Warning: Could not update auth metadata:', authError);
      }

      Alert.alert("Thành công", "Đã lưu thông tin cá nhân!");
      router.back();
    } catch (error: any) {
      console.error("Error saving profile:", error);
      Alert.alert("Lỗi", "Không thể lưu thông tin cá nhân");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <Stack.Screen options={{ title: "Hồ sơ cá nhân" }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ title: "Hồ sơ cá nhân" }} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarWrapper}>
              <Pressable onPress={pickAvatar} disabled={uploadingAvatar}>
                {uploadingAvatar ? (
                  <View style={[styles.avatarImage, styles.avatarPlaceholder]}>
                    <ActivityIndicator size="large" color="#6366f1" />
                  </View>
                ) : profile.avatar_url ? (
                  <Image
                    source={{ uri: profile.avatar_url }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <View style={[styles.avatarImage, styles.avatarPlaceholder]}>
                    <Ionicons name="person" size={48} color="#9ca3af" />
                  </View>
                )}
              </Pressable>
              <Pressable 
                style={styles.avatarEditButton}
                onPress={pickAvatar}
                disabled={uploadingAvatar}
              >
                <Ionicons name="camera" size={20} color="#fff" />
              </Pressable>
            </View>
            <ThemedText style={styles.avatarHint}>
              {uploadingAvatar ? 'Đang tải ảnh lên...' : 'Nhấn để thay đổi ảnh đại diện'}
            </ThemedText>
          </View>

          {/* Form Fields */}
          <View style={styles.formSection}>
            {/* Email (Read-only) */}
            <View style={styles.fieldGroup}>
              <ThemedText style={styles.label}>Email</ThemedText>
              <View style={[styles.inputWrapper, styles.inputDisabled]}>
                <Ionicons name="mail-outline" size={20} color="#9ca3af" />
                <TextInput
                  style={[styles.input, styles.inputDisabledText]}
                  value={profile.email}
                  editable={false}
                />
                <Ionicons name="lock-closed" size={16} color="#9ca3af" />
              </View>
              <ThemedText style={styles.hint}>
                Email không thể thay đổi
              </ThemedText>
            </View>

            {/* Display Name */}
            <View style={styles.fieldGroup}>
              <ThemedText style={styles.label}>
                Tên hiển thị <ThemedText style={styles.required}>*</ThemedText>
              </ThemedText>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={20} color="#9ca3af" />
                <TextInput
                  style={styles.input}
                  placeholder="Nhập tên hiển thị"
                  value={profile.display_name}
                  onChangeText={(text) =>
                    setProfile({ ...profile, display_name: text })
                  }
                />
              </View>
            </View>

            {/* Bio */}
            <View style={styles.fieldGroup}>
              <ThemedText style={styles.label}>Giới thiệu</ThemedText>
              <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Viết vài dòng về bạn..."
                  value={profile.bio}
                  onChangeText={(text) => setProfile({ ...profile, bio: text })}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
              <ThemedText style={styles.hint}>
                {profile.bio.length}/200 ký tự
              </ThemedText>
            </View>

            {/* Location */}
            <View style={styles.fieldGroup}>
              <ThemedText style={styles.label}>Địa điểm</ThemedText>
              <View style={styles.inputWrapper}>
                <Ionicons name="location-outline" size={20} color="#9ca3af" />
                <TextInput
                  style={styles.input}
                  placeholder="Thành phố, Quốc gia"
                  value={profile.location}
                  onChangeText={(text) =>
                    setProfile({ ...profile, location: text })
                  }
                />
              </View>
            </View>

            {/* Website */}
            <View style={styles.fieldGroup}>
              <ThemedText style={styles.label}>Website</ThemedText>
              <View style={styles.inputWrapper}>
                <Ionicons name="globe-outline" size={20} color="#9ca3af" />
                <TextInput
                  style={styles.input}
                  placeholder="https://example.com"
                  value={profile.website}
                  onChangeText={(text) =>
                    setProfile({ ...profile, website: text })
                  }
                  keyboardType="url"
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* Privacy Toggle */}
            <View style={styles.fieldGroup}>
              <View style={styles.privacyHeader}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.label}>Hồ sơ công khai</ThemedText>
                  <ThemedText style={styles.hint}>
                    Cho phép mọi người xem hồ sơ của bạn
                  </ThemedText>
                </View>
                <Pressable
                  style={[
                    styles.toggle,
                    profile.is_public && styles.toggleActive,
                  ]}
                  onPress={() =>
                    setProfile({ ...profile, is_public: !profile.is_public })
                  }
                >
                  <View
                    style={[
                      styles.toggleThumb,
                      profile.is_public && styles.toggleThumbActive,
                    ]}
                  />
                </Pressable>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <Pressable
              style={[styles.saveButton, saving && { opacity: 0.6 }]}
              onPress={saveProfile}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <ThemedText style={styles.saveButtonText}>
                    Lưu thay đổi
                  </ThemedText>
                </>
              )}
            </Pressable>

            <Pressable
              style={styles.cancelButton}
              onPress={() => router.back()}
              disabled={saving}
            >
              <ThemedText style={styles.cancelButtonText}>Hủy</ThemedText>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  scrollContent: {
    padding: isSmallScreen ? 16 : isMediumScreen ? 20 : 24,
    paddingBottom: 40,
  },

  // Avatar Section
  avatarSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  avatarWrapper: {
    position: "relative",
    marginBottom: 12,
  },
  avatarImage: {
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
  avatarEditButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#6366f1",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarHint: {
    fontSize: 13,
    color: "#9ca3af",
    fontWeight: "600",
  },

  // Form Section
  formSection: {
    gap: 20,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    fontSize: isSmallScreen ? 14 : isMediumScreen ? 15 : 16,
    fontWeight: "800",
    color: "#374151",
    letterSpacing: -0.2,
  },
  required: {
    color: "#ef4444",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  textAreaWrapper: {
    alignItems: "flex-start",
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  inputDisabled: {
    backgroundColor: "#f9fafb",
    borderColor: "#e5e7eb",
  },
  inputDisabledText: {
    color: "#9ca3af",
  },
  hint: {
    fontSize: 12,
    color: "#9ca3af",
    fontWeight: "600",
  },

  // Privacy Toggle
  privacyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  toggle: {
    width: 52,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#e5e7eb",
    padding: 2,
    justifyContent: "center",
  },
  toggleActive: {
    backgroundColor: "#6366f1",
  },
  toggleThumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleThumbActive: {
    alignSelf: "flex-end",
  },

  // Actions
  actions: {
    marginTop: 32,
    gap: 12,
  },
  saveButton: {
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
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  cancelButton: {
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  cancelButtonText: {
    color: "#6b7280",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
});
