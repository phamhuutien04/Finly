import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { supabase } from "@/lib/supabase";

type CategoryType = "expense" | "income";

type CategoryRow = {
  id: number; // DB trả number nhưng khi query bigint đôi khi cần string -> sẽ convert khi dùng
  user_id?: string | null;
  name?: string | null;
  type?: CategoryType | string | null;
  emoji: string | null;
  icon_uri: string | null;
  icon_preset_id: string | null;
  created_at: string | null;
};

type IconFromDb = { id: string; uri: string; label: string };

const normalizeType = (t: any): CategoryType => (t === "income" ? "income" : "expense");

export default function CategoriesScreen() {
  const [activeType, setActiveType] = useState<CategoryType>("expense");
  const [q, setQ] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [categories, setCategories] = useState<CategoryRow[]>([]);

  // modal
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);

  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [formType, setFormType] = useState<CategoryType>("expense");

  const [iconUri, setIconUri] = useState<string>("");
  const [iconPresetId, setIconPresetId] = useState<string>("");

  const getUserId = async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return data.user.id;
  };

  const fetchCategories = async () => {
    setLoading(true);

    const uid = await getUserId();
    const selectCols = "id, user_id, name, type, emoji, icon_uri, icon_preset_id, created_at";

    // ưu tiên theo user_id nếu có
    if (uid) {
      const { data, error } = await supabase
        .from("categories")
        .select(selectCols)
        .eq("user_id", uid)
        .order("id", { ascending: true });

      if (!error) {
        setCategories((data as CategoryRow[]) ?? []);
        setLoading(false);
        return;
      }

      const msg = (error.message || "").toLowerCase();
      const noUserIdCol =
        msg.includes("column") && msg.includes("user_id") && msg.includes("does not exist");
      if (!noUserIdCol) {
        Alert.alert("Lỗi tải danh mục", error.message);
        setLoading(false);
        return;
      }
    }

    // fallback: lấy tất cả
    const { data: data2, error: error2 } = await supabase
      .from("categories")
      .select(selectCols)
      .order("id", { ascending: true });

    if (error2) {
      Alert.alert("Lỗi tải danh mục", error2.message);
      setLoading(false);
      return;
    }

    setCategories((data2 as CategoryRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const hasTypeCol = useMemo(() => categories.some((c) => c.type != null), [categories]);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    let arr = categories;

    if (hasTypeCol) {
      arr = arr.filter((c) => normalizeType(c.type) === activeType);
    }

    return arr.filter((c) => {
      const displayName = (c.name ?? "").toLowerCase();
      return kw ? displayName.includes(kw) : true;
    });
  }, [categories, activeType, q, hasTypeCol]);

  const iconLibraryFromDb: IconFromDb[] = useMemo(() => {
    const map = new Map<string, IconFromDb>();
    for (const c of categories) {
      const pid = c.icon_preset_id?.trim();
      const uri = c.icon_uri?.trim();
      if (!pid || !uri) continue;

      const key = `${pid}__${uri}`;
      if (!map.has(key)) {
        map.set(key, {
          id: pid,
          uri,
          label: (c.name?.trim() || pid).toString(),
        });
      }
    }
    return Array.from(map.values());
  }, [categories]);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setEmoji("");
    setFormType(activeType);
    setIconUri("");
    setIconPresetId("");
    setOpen(true);
  };

  const openEdit = (c: CategoryRow) => {
    setEditing(c);
    setName(c.name ?? "");
    setEmoji(c.emoji ?? "");
    setFormType(normalizeType(c.type));
    setIconUri(c.icon_uri ?? "");
    setIconPresetId(c.icon_preset_id ?? "");
    setOpen(true);
  };

  const pickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Thiếu quyền", "Bạn cần cho phép truy cập thư viện ảnh.");
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!res.canceled) {
      const uri = res.assets?.[0]?.uri;
      if (uri) {
        setIconUri(uri);
        setIconPresetId("");
      }
    }
  };

  const chooseFromDbLibrary = (it: IconFromDb) => {
    setIconPresetId(it.id);
    setIconUri(it.uri);
  };

  const clearIcon = () => {
    setIconUri("");
    setIconPresetId("");
  };

  const onSave = async () => {
    if (saving) return;

    const n = name.trim();
    const e = emoji.trim();

    if (!n) {
      Alert.alert("Thiếu tên", "Bạn nhập tên danh mục nhé.");
      return;
    }

    const uid = await getUserId();

    const payload: any = {
      name: n,
      type: editing ? normalizeType(editing.type) : formType,
      emoji: e ? e : null,
      icon_uri: iconUri ? iconUri : null,
      icon_preset_id: iconPresetId ? iconPresetId : null,
    };
    if (uid) payload.user_id = uid;

    try {
      setSaving(true);

      if (editing) {
        const { error } = await supabase.from("categories").update(payload).eq("id", String(editing.id));
        if (error) {
          Alert.alert("Lỗi sửa danh mục", error.message);
          return;
        }
      } else {
        const { error } = await supabase.from("categories").insert([payload]);
        if (error) {
          Alert.alert("Lỗi thêm danh mục", error.message);
          return;
        }
      }

      setOpen(false);
      await fetchCategories();
    } finally {
      setSaving(false);
    }
  };

  // ✅ DELETE chắc chắn: ép id về string + select('id') để biết có xóa trúng row không
  const runDelete = async (row: CategoryRow) => {
    const idStr = String(row.id);

    const { data, error } = await supabase
      .from("categories")
      .delete()
      .eq("id", idStr)
      .select("id");

    if (error) {
      console.log("DELETE ERROR:", error);
      Alert.alert("Lỗi xóa", error.message);
      return;
    }

    if (!data || data.length === 0) {
      Alert.alert(
        "Không xóa được",
        "DB không xóa dòng này. Thường do RLS policy (chưa cho DELETE) hoặc id không match."
      );
      return;
    }

    await fetchCategories();
  };

  const onDelete = (c: CategoryRow) => {
    Alert.alert("Xóa danh mục?", `Bạn chắc muốn xóa "${c.name ?? `#${c.id}`}" không?`, [
      { text: "Hủy", style: "cancel" },
      { text: "Xóa", style: "destructive", onPress: () => runDelete(c) },
    ]);
  };

  return (
    <ThemedView style={styles.screen}>
      {/* Header */}
      <ThemedView style={styles.header}>
        <View style={{ flex: 1 }}>
          <ThemedText type="title">Danh mục</ThemedText>
        </View>

        <Pressable onPress={openCreate} style={styles.addBtn} hitSlop={10}>
          <ThemedText style={styles.addBtnText}>+ Thêm</ThemedText>
        </Pressable>
      </ThemedView>

      {/* Segment */}
      <ThemedView style={styles.segment}>
        <Pressable
          onPress={() => setActiveType("expense")}
          style={[styles.segmentBtn, activeType === "expense" && styles.segmentBtnActive]}
          hitSlop={10}
        >
          <ThemedText style={styles.segmentText}>Chi</ThemedText>
        </Pressable>

        <Pressable
          onPress={() => setActiveType("income")}
          style={[styles.segmentBtn, activeType === "income" && styles.segmentBtnActive]}
          hitSlop={10}
        >
          <ThemedText style={styles.segmentText}>Thu</ThemedText>
        </Pressable>
      </ThemedView>

      {/* Search */}
      <TextInput value={q} onChangeText={setQ} placeholder="Tìm danh mục..." style={styles.search} />

      {loading ? (
        <View style={{ paddingVertical: 24 }}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={styles.columnWrap}
          contentContainerStyle={{ paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            // ✅ dùng View thay ThemedView để khỏi chặn touch
            <View style={styles.card} pointerEvents="auto">
              <View style={styles.cardTop} pointerEvents="auto">
                <View style={styles.emojiBox} pointerEvents="none">
                  {item.icon_uri ? (
                    <Image source={{ uri: item.icon_uri }} style={{ width: 24, height: 24, borderRadius: 6 }} />
                  ) : (
                    <ThemedText style={{ fontSize: 18 }}>{item.emoji ?? "🏷️"}</ThemedText>
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.cardName} numberOfLines={1}>
                    {item.name ?? `Danh mục #${item.id}`}
                  </ThemedText>
                  <ThemedText style={styles.muted} numberOfLines={1}>
                    {item.type ? (normalizeType(item.type) === "expense" ? "Danh mục chi" : "Danh mục thu") : "—"}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.actions} pointerEvents="auto">
                <Pressable
                  onPressIn={() => console.log("PRESS IN EDIT", item.id)}
                  onPress={() => openEdit(item)}
                  hitSlop={10}
                  android_ripple={{ color: "rgba(0,0,0,0.08)" }}
                  style={({ pressed }) => [styles.editBtn, pressed && styles.pressedBtn]}
                >
                  <ThemedText style={styles.btnText}>Sửa</ThemedText>
                </Pressable>

                <Pressable
                  onPressIn={() => console.log("PRESS IN DELETE", item.id)}
                  onPress={() => onDelete(item)}
                  hitSlop={10}
                  android_ripple={{ color: "rgba(0,0,0,0.08)" }}
                  style={({ pressed }) => [styles.delBtn, pressed && styles.pressedBtn]}
                >
                  <ThemedText style={styles.btnText}>Xóa</ThemedText>
                </Pressable>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={{ paddingVertical: 30, alignItems: "center" }}>
              <ThemedText style={styles.muted}>Không có dữ liệu trong bảng categories.</ThemedText>
            </View>
          }
        />
      )}

      {/* Modal Add/Edit */}
      <Modal visible={open} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.modalCard}>
            <ThemedText type="subtitle">{editing ? "Sửa danh mục" : "Thêm danh mục"}</ThemedText>

            {hasTypeCol && (
              <ThemedView style={styles.modalSegment}>
                <Pressable
                  disabled={!!editing}
                  onPress={() => setFormType("expense")}
                  style={[
                    styles.modalSegBtn,
                    formType === "expense" && styles.modalSegBtnActive,
                    editing && styles.modalSegDisabled,
                  ]}
                >
                  <ThemedText style={styles.segmentText}>Chi tiêu</ThemedText>
                </Pressable>

                <Pressable
                  disabled={!!editing}
                  onPress={() => setFormType("income")}
                  style={[
                    styles.modalSegBtn,
                    formType === "income" && styles.modalSegBtnActive,
                    editing && styles.modalSegDisabled,
                  ]}
                >
                  <ThemedText style={styles.segmentText}>Thu nhập</ThemedText>
                </Pressable>
              </ThemedView>
            )}

            <TextInput value={name} onChangeText={setName} placeholder="Tên danh mục" style={styles.modalInput} />
            <TextInput value={emoji} onChangeText={setEmoji} placeholder="Emoji (có thể bỏ trống)" style={styles.modalInput} />

            <ThemedView style={{ marginTop: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <ThemedText style={styles.muted}>Icon (DB / ảnh thư viện)</ThemedText>

                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable onPress={pickFromLibrary} style={styles.btnMini} hitSlop={10}>
                    <ThemedText style={styles.btnMiniText}>Thư viện</ThemedText>
                  </Pressable>

                  <Pressable onPress={clearIcon} style={styles.btnMiniGhost} hitSlop={10}>
                    <ThemedText style={styles.btnMiniText}>Xóa</ThemedText>
                  </Pressable>
                </View>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 }}>
                <ThemedView style={styles.iconPreview}>
                  {iconUri ? (
                    <Image source={{ uri: iconUri }} style={{ width: 40, height: 40, borderRadius: 12 }} />
                  ) : (
                    <ThemedText style={styles.muted}>Chưa chọn</ThemedText>
                  )}
                </ThemedView>

                <ThemedText style={styles.muted} numberOfLines={2}>
                  Preset bên dưới tự lấy từ DB (icon_preset_id + icon_uri).
                </ThemedText>
              </View>

              {iconLibraryFromDb.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingTop: 10 }}>
                  {iconLibraryFromDb.map((it) => {
                    const active = iconPresetId === it.id && iconUri === it.uri;
                    return (
                      <Pressable
                        key={`${it.id}__${it.uri}`}
                        onPress={() => chooseFromDbLibrary(it)}
                        style={[styles.presetItem, active && styles.presetItemActive]}
                        hitSlop={10}
                      >
                        <Image source={{ uri: it.uri }} style={{ width: 32, height: 32 }} />
                        <ThemedText style={{ fontSize: 11, opacity: 0.7 }} numberOfLines={1}>
                          {it.label}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </ThemedView>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <Pressable onPress={() => setOpen(false)} style={styles.btnGhost} disabled={saving} hitSlop={10}>
                <ThemedText style={styles.btnText}>Hủy</ThemedText>
              </Pressable>

              <Pressable onPress={onSave} style={styles.btnSolid} disabled={saving} hitSlop={10}>
                {saving ? <ActivityIndicator /> : <ThemedText style={[styles.btnText, { color: "#fff" }]}>Lưu</ThemedText>}
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 16, paddingTop: 14 },

  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  muted: { opacity: 0.7, marginTop: 2 },

  addBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(127,127,127,0.35)",
  },
  addBtnText: { fontSize: 14, fontWeight: "700" },

  segment: {
    flexDirection: "row",
    borderRadius: 16,
    padding: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(127,127,127,0.25)",
    marginBottom: 10,
  },
  segmentBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center" },
  segmentBtnActive: { borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(127,127,127,0.25)" },
  segmentText: { fontWeight: "800" },

  search: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(127,127,127,0.25)",
    marginBottom: 12,
  },

  columnWrap: { gap: 10, justifyContent: "space-between" },

  // ✅ View card
  card: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(127,127,127,0.25)",
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },

  emojiBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(127,127,127,0.25)",
  },

  cardName: { fontSize: 14, fontWeight: "800", marginBottom: 2 },

  actions: { flexDirection: "row", gap: 10, marginTop: 12 },

  editBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(127,127,127,0.25)",
    overflow: "hidden",
  },
  delBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(127,127,127,0.25)",
    overflow: "hidden",
  },
  pressedBtn: { opacity: 0.6, transform: [{ scale: 0.98 }] },

  btnText: { fontWeight: "800", fontSize: 13 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.25)", justifyContent: "center", padding: 18 },
  modalCard: { borderRadius: 18, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(127,127,127,0.25)" },

  modalInput: { marginTop: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(127,127,127,0.25)" },

  modalSegment: { flexDirection: "row", borderRadius: 14, padding: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(127,127,127,0.25)", marginTop: 10 },
  modalSegBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center" },
  modalSegBtnActive: { borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(127,127,127,0.25)" },
  modalSegDisabled: { opacity: 0.75 },

  iconPreview: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(127,127,127,0.25)" },
  presetItem: { width: 74, height: 74, borderRadius: 16, padding: 8, alignItems: "center", justifyContent: "center", gap: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(127,127,127,0.25)" },
  presetItemActive: { borderWidth: 2, borderColor: "#111" },

  btnMini: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, backgroundColor: "#111" },
  btnMiniGhost: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(127,127,127,0.25)" },
  btnMiniText: { fontWeight: "800", fontSize: 12, color: "#fff" },

  btnGhost: { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(127,127,127,0.25)" },
  btnSolid: { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: "center", backgroundColor: "#111" },
});
