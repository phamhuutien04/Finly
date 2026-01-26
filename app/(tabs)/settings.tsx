import React, { useMemo, useState } from "react";
import { Stack, useRouter } from "expo-router";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

type Option = { label: string; value: string };

export default function SettingsScreen() {
  const router = useRouter();

  const [darkMode, setDarkMode] = useState(false); // demo UI
  const [biometric, setBiometric] = useState(false);
  const [pushNoti, setPushNoti] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(true);

  const [language, setLanguage] = useState<Option>({ label: "Tiếng Việt", value: "vi" });
  const [currency, setCurrency] = useState<Option>({ label: "VND (₫)", value: "VND" });

  const languages: Option[] = useMemo(
    () => [
      { label: "Tiếng Việt", value: "vi" },
      { label: "English", value: "en" },
      { label: "日本語", value: "ja" },
    ],
    []
  );

  const currencies: Option[] = useMemo(
    () => [
      { label: "VND (₫)", value: "VND" },
      { label: "USD ($)", value: "USD" },
      { label: "JPY (¥)", value: "JPY" },
    ],
    []
  );

  const pickOption = (
    title: string,
    options: Option[],
    current: Option,
    onPick: (o: Option) => void
  ) => {
    Alert.alert(
      title,
      `Đang chọn: ${current.label}`,
      [
        ...options.map((o) => ({
          text: o.label,
          onPress: () => onPick(o),
        })),
        { text: "Huỷ", style: "cancel" },
      ]
    );
  };

  const confirmDanger = (title: string, message: string, onYes: () => void) => {
    Alert.alert(title, message, [
      { text: "Huỷ", style: "cancel" },
      { text: "Xác nhận", style: "destructive", onPress: onYes },
    ]);
  };

  return (
    <ThemedView style={styles.page}>
      <Stack.Screen options={{ title: "Cài đặt" }} />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Profile */}
        <ThemedView style={styles.profileCard}>
          <ThemedView style={styles.avatar} />
          <View style={{ flex: 1 }}>
            <ThemedText type="subtitle">Pham Huu Tien</ThemedText>
            <ThemedText style={styles.muted}>
              Tài khoản cá nhân • {Platform.OS.toUpperCase()}
            </ThemedText>
          </View>

          <Pressable
            onPress={() => Alert.alert("Info", "Bạn có thể mở trang Profile ở đây.")}
            style={({ pressed }) => [styles.outlineBtn, pressed && { opacity: 0.75 }]}
          >
            <ThemedText style={styles.outlineBtnText}>Sửa</ThemedText>
          </Pressable>
        </ThemedView>

        <Section title="Tuỳ chọn">
          <RowSwitch
            title="Dark Mode"
            subtitle="Giao diện tối dễ nhìn ban đêm"
            value={darkMode}
            onValueChange={setDarkMode}
          />
          <RowSwitch
            title="Thông báo đẩy"
            subtitle="Nhắc nhở ghi chi tiêu hằng ngày"
            value={pushNoti}
            onValueChange={setPushNoti}
          />
          <RowSwitch
            title="Báo cáo tuần"
            subtitle="Gửi tổng kết chi tiêu mỗi tuần"
            value={weeklyReport}
            onValueChange={setWeeklyReport}
          />
          <RowPress
            title="Ngôn ngữ"
            subtitle={language.label}
            onPress={() => pickOption("Chọn ngôn ngữ", languages, language, setLanguage)}
          />
          <RowPress
            title="Tiền tệ"
            subtitle={currency.label}
            onPress={() => pickOption("Chọn tiền tệ", currencies, currency, setCurrency)}
          />
        </Section>

        <Section title="Bảo mật">
          <RowSwitch
            title="Mở khoá sinh trắc học"
            subtitle="Vân tay / FaceID (nếu thiết bị hỗ trợ)"
            value={biometric}
            onValueChange={setBiometric}
          />
          <RowPress
            title="Đổi mã PIN"
            subtitle="Thiết lập PIN để mở app"
            onPress={() => Alert.alert("PIN", "Gắn màn hình đổi PIN vào đây.")}
          />
        </Section>

        <Section title="Dữ liệu">
          <RowPress
            title="Sao lưu dữ liệu"
            subtitle="Xuất dữ liệu ra file"
            onPress={() => Alert.alert("Backup", "Export CSV/JSON ở đây.")}
          />
          <RowPress
            title="Khôi phục dữ liệu"
            subtitle="Nhập lại từ bản sao lưu"
            onPress={() => Alert.alert("Restore", "Import CSV/JSON ở đây.")}
          />
        </Section>

        <Section title="Thông tin">
          <RowPress
            title="Giới thiệu"
            subtitle="Phiên bản 1.0.0"
            onPress={() => Alert.alert("About", "App quản lí chi tiêu • Finly")}
          />
          <RowPress
            title="Điều khoản & Chính sách"
            subtitle="Xem nội dung"
            onPress={() => Alert.alert("Policy", "Mở trang Terms/Privacy ở đây.")}
          />
        </Section>

        <Section title="Khu vực nguy hiểm" danger>
          <RowDanger
            title="Xoá toàn bộ dữ liệu"
            subtitle="Không thể khôi phục"
            onPress={() =>
              confirmDanger("Xoá dữ liệu", "Bạn chắc chắn muốn xoá toàn bộ dữ liệu?", () =>
                Alert.alert("Đã xoá", "Mình đã xoá dữ liệu (demo).")
              )
            }
          />
          <RowDanger
            title="Đăng xuất"
            subtitle="Thoát khỏi tài khoản hiện tại"
            onPress={() =>
              confirmDanger("Đăng xuất", "Bạn muốn đăng xuất?", () => {
                Alert.alert("Đăng xuất", "Đã đăng xuất (demo).");
                // router.replace("/auth/login");
              })
            }
          />
        </Section>

        <ThemedText style={styles.footer}>© {new Date().getFullYear()} Finly</ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

/* ---------------- Components ---------------- */

function Section({
  title,
  danger,
  children,
}: {
  title: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <ThemedText style={[styles.sectionTitle, danger && { color: "#DC2626" }]}>
        {title}
      </ThemedText>

      <ThemedView style={styles.card}>{children}</ThemedView>
    </View>
  );
}

function RowSwitch({
  title,
  subtitle,
  value,
  onValueChange,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <ThemedView style={styles.row}>
      <View style={{ flex: 1 }}>
        <ThemedText style={styles.rowTitle}>{title}</ThemedText>
        {!!subtitle && <ThemedText style={styles.rowSub}>{subtitle}</ThemedText>}
      </View>
      <Switch value={value} onValueChange={onValueChange} />
    </ThemedView>
  );
}

function RowPress({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.75 }]}>
      <ThemedView style={styles.row}>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.rowTitle}>{title}</ThemedText>
          {!!subtitle && <ThemedText style={styles.rowSub}>{subtitle}</ThemedText>}
        </View>
        <ThemedText style={styles.chev}>›</ThemedText>
      </ThemedView>
    </Pressable>
  );
}

function RowDanger({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.75 }]}>
      <ThemedView style={styles.row}>
        <View style={{ flex: 1 }}>
          <ThemedText style={[styles.rowTitle, { color: "#DC2626" }]}>{title}</ThemedText>
          {!!subtitle && <ThemedText style={[styles.rowSub, { color: "#DC2626" }]}>{subtitle}</ThemedText>}
        </View>
        <ThemedText style={[styles.chev, { color: "#DC2626" }]}>›</ThemedText>
      </ThemedView>
    </Pressable>
  );
}

/* ---------------- Styles ---------------- */

const styles = StyleSheet.create({
  page: { flex: 1 },
  container: { padding: 16, paddingBottom: 28, gap: 14 },

  // profile
  profileCard: {
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(127,127,127,0.25)",
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "rgba(127,127,127,0.15)",
  },

  outlineBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(127,127,127,0.35)",
  },
  outlineBtnText: { fontWeight: "700" },

  // sections
  section: { gap: 8 },
  sectionTitle: { fontSize: 12, fontWeight: "700", paddingLeft: 4, opacity: 0.75 },

  card: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(127,127,127,0.25)",
  },

  row: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(127,127,127,0.18)",
  },

  rowTitle: { fontSize: 14, fontWeight: "700" },
  rowSub: { fontSize: 12, marginTop: 2, opacity: 0.7 },

  muted: { marginTop: 2, fontSize: 12, opacity: 0.7 },

  chev: { fontSize: 22, marginLeft: 6, marginTop: -2, opacity: 0.6 },

  footer: { textAlign: "center", marginTop: 6, fontSize: 12, opacity: 0.6 },
});
