import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { Stack, useRouter } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
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

type Visibility = "public" | "friends" | "private";

export default function CreatePostScreen() {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [posting, setPosting] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const response = await fetch(uri);
      const blob = await response.blob();
      const fileExt = uri.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from("post-images")
        .upload(fileName, blob, {
          contentType: `image/${fileExt}`,
          upsert: false,
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from("post-images")
        .getPublicUrl(data.path);

      return publicUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      return null;
    }
  };

  const createPost = async () => {
    if (!content.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập nội dung bài viết");
      return;
    }

    try {
      setPosting(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Lỗi", "Bạn cần đăng nhập để đăng bài");
        return;
      }

      let imageUrl = null;
      if (imageUri) {
        imageUrl = await uploadImage(imageUri);
      }

      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        content: content.trim(),
        image_url: imageUrl,
        visibility,
      });

      if (error) throw error;

      Alert.alert("Thành công", "Đã đăng bài viết!", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      console.error("Error creating post:", error);
      Alert.alert("Lỗi", "Không thể đăng bài viết: " + error.message);
    } finally {
      setPosting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen
        options={{
          title: "Tạo bài viết",
          headerRight: () => (
            <Pressable
              onPress={createPost}
              disabled={posting || !content.trim()}
              style={[
                styles.postButton,
                (posting || !content.trim()) && styles.postButtonDisabled,
              ]}
            >
              {posting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <ThemedText style={styles.postButtonText}>Đăng</ThemedText>
              )}
            </Pressable>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Content Input */}
        <View style={styles.inputSection}>
          <TextInput
            style={styles.contentInput}
            placeholder="Bạn đang nghĩ gì?"
            placeholderTextColor="#9ca3af"
            value={content}
            onChangeText={setContent}
            multiline
            maxLength={5000}
            autoFocus
          />
        </View>

        {/* Image Preview */}
        {imageUri && (
          <View style={styles.imagePreview}>
            <Image source={{ uri: imageUri }} style={styles.previewImage} />
            <Pressable
              style={styles.removeImageButton}
              onPress={() => setImageUri(null)}
            >
              <Ionicons name="close-circle" size={32} color="#ef4444" />
            </Pressable>
          </View>
        )}

        {/* Visibility Selector */}
        <View style={styles.visibilitySection}>
          <ThemedText style={styles.sectionTitle}>Ai có thể xem?</ThemedText>
          <View style={styles.visibilityOptions}>
            <Pressable
              style={[
                styles.visibilityOption,
                visibility === "public" && styles.visibilityOptionActive,
              ]}
              onPress={() => setVisibility("public")}
            >
              <Ionicons
                name="globe"
                size={20}
                color={visibility === "public" ? "#6366f1" : "#9ca3af"}
              />
              <ThemedText
                style={[
                  styles.visibilityText,
                  visibility === "public" && styles.visibilityTextActive,
                ]}
              >
                Công khai
              </ThemedText>
            </Pressable>

            <Pressable
              style={[
                styles.visibilityOption,
                visibility === "friends" && styles.visibilityOptionActive,
              ]}
              onPress={() => setVisibility("friends")}
            >
              <Ionicons
                name="people"
                size={20}
                color={visibility === "friends" ? "#6366f1" : "#9ca3af"}
              />
              <ThemedText
                style={[
                  styles.visibilityText,
                  visibility === "friends" && styles.visibilityTextActive,
                ]}
              >
                Bạn bè
              </ThemedText>
            </Pressable>

            <Pressable
              style={[
                styles.visibilityOption,
                visibility === "private" && styles.visibilityOptionActive,
              ]}
              onPress={() => setVisibility("private")}
            >
              <Ionicons
                name="lock-closed"
                size={20}
                color={visibility === "private" ? "#6366f1" : "#9ca3af"}
              />
              <ThemedText
                style={[
                  styles.visibilityText,
                  visibility === "private" && styles.visibilityTextActive,
                ]}
              >
                Riêng tư
              </ThemedText>
            </Pressable>
          </View>
        </View>

        {/* Add Image Button */}
        <Pressable style={styles.addImageButton} onPress={pickImage}>
          <Ionicons name="image" size={24} color="#6366f1" />
          <ThemedText style={styles.addImageText}>Thêm ảnh</ThemedText>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fafafa",
  },
  scrollContent: {
    padding: isSmallScreen ? 16 : 20,
  },
  postButton: {
    backgroundColor: "#6366f1",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  postButtonDisabled: {
    backgroundColor: "#d1d5db",
  },
  postButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },

  // Content
  inputSection: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    minHeight: 200,
  },
  contentInput: {
    fontSize: 16,
    lineHeight: 24,
    color: "#111827",
    textAlignVertical: "top",
  },

  // Image
  imagePreview: {
    position: "relative",
    marginBottom: 16,
    borderRadius: 16,
    overflow: "hidden",
  },
  previewImage: {
    width: "100%",
    height: 200,
    borderRadius: 16,
  },
  removeImageButton: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#fff",
    borderRadius: 16,
  },

  // Visibility
  visibilitySection: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  visibilityOptions: {
    flexDirection: "row",
    gap: 8,
  },
  visibilityOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#f9fafb",
    borderWidth: 2,
    borderColor: "#f3f4f6",
  },
  visibilityOptionActive: {
    backgroundColor: "#eef2ff",
    borderColor: "#6366f1",
  },
  visibilityText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  visibilityTextActive: {
    color: "#6366f1",
  },

  // Add Image
  addImageButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderStyle: "dashed",
  },
  addImageText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6366f1",
  },
});
