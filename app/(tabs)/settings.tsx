import { Stack, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
    Alert,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    View,
} from "react-native";

type Option = { label: string; value: string };

export default function SettingsScreen() {
  const router = useRouter();

  const [darkMode, setDarkMode] = useState(false);
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

  const pickOption = (title: string, options: Option[], current: Option, onPick: (o: Option) => void) => {
    // Cách đơn giản: dùng Alert (dễ chạy mọi nơi). Nếu bạn muốn “bottom sheet” đẹp hơn, mình có thể đổi sau.
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
    <View style={styles.page}>
      <Stack.Screen options={{ title: "Cài đặt" }} />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header / Profile */}
        <View style={styles.profileCard}>
          <View style={styles.avatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>Pham Huu Tien</Text>
            <Text style={styles.profileSub}>Tài khoản cá nhân • {Platform.OS.toUpperCase()}</Text>
          </View>
          <Pressable
            onPress={() => {
              // router.push("/profile"); // nếu bạn có trang profile
              Alert.alert("Info", "Bạn có thể điều hướng sang trang Profile ở đây.");
            }}
            style={({ pressed }) => [styles.outlineBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.outlineBtnText}>Sửa</Text>
          </Pressable>
        </View>

        {/* Preferences */}
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

        {/* Security */}
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
            onPress={() => Alert.alert("PIN", "Chỗ này bạn gắn màn hình đổi PIN vào.")}
          />
        </Section>

        {/* Data */}
        <Section title="Dữ liệu">
          <RowPress
            title="Sao lưu dữ liệu"
            subtitle="Xuất dữ liệu ra file"
            onPress={() => Alert.alert("Backup", "Bạn có thể export CSV/JSON ở đây.")}
          />
          <RowPress
            title="Khôi phục dữ liệu"
            subtitle="Nhập lại từ bản sao lưu"
            onPress={() => Alert.alert("Restore", "Bạn có thể import CSV/JSON ở đây.")}
          />
        </Section>

        {/* About */}
        <Section title="Thông tin">
          <RowPress
            title="Giới thiệu"
            subtitle="Phiên bản 1.0.0"
            onPress={() => Alert.alert("About", "App quản lí chi tiêu • Finly")}
          />
          <RowPress
            title="Điều khoản & Chính sách"
            subtitle="Xem nội dung"
            onPress={() => Alert.alert("Policy", "Bạn có thể mở trang Terms/Privacy ở đây.")}
          />
        </Section>

        {/* Danger Zone */}
        <Section title="Khu vực nguy hiểm" danger>
          <RowDanger
            title="Xoá toàn bộ dữ liệu"
            subtitle="Không thể khôi phục"
            onPress={() =>
              confirmDanger("Xoá dữ liệu", "Bạn chắc chắn muốn xoá toàn bộ dữ liệu?", () => {
                Alert.alert("Đã xoá", "Mình đã xoá dữ liệu (demo).");
              })
            }
          />
          <RowDanger
            title="Đăng xuất"
            subtitle="Thoát khỏi tài khoản hiện tại"
            onPress={() =>
              confirmDanger("Đăng xuất", "Bạn muốn đăng xuất?", () => {
                Alert.alert("Đăng xuất", "Đã đăng xuất (demo).");
                // router.replace("/login");
              })
            }
          />
        </Section>

        <Text style={styles.footer}>© {new Date().getFullYear()} Finly</Text>
      </ScrollView>
    </View>
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
      <Text style={[styles.sectionTitle, danger && { color: "#C62828" }]}>{title}</Text>
      <View style={styles.card}>{children}</View>
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
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.rowSub}>{subtitle}</Text>}
      </View>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
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
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.rowSub}>{subtitle}</Text>}
      </View>
      <Text style={styles.chev}>›</Text>
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
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: "#C62828" }]}>{title}</Text>
        {!!subtitle && <Text style={[styles.rowSub, { color: "#C62828" }]}>{subtitle}</Text>}
      </View>
      <Text style={[styles.chev, { color: "#C62828" }]}>›</Text>
    </Pressable>
  );
}

/* ---------------- Styles ---------------- */

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#0B0F19" },
  container: { padding: 16, paddingBottom: 28, gap: 14 },

  profileCard: {
    backgroundColor: "#111827",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  profileName: { color: "#E5E7EB", fontSize: 16, fontWeight: "700" },
  profileSub: { color: "#9CA3AF", marginTop: 2, fontSize: 12 },

  outlineBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  outlineBtnText: { color: "#E5E7EB", fontWeight: "600" },

  section: { gap: 8 },
  sectionTitle: { color: "#9CA3AF", fontSize: 12, fontWeight: "700", paddingLeft: 4 },

  card: {
    backgroundColor: "#111827",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  row: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.07)",
  },
  pressed: { opacity: 0.75 },

  rowTitle: { color: "#E5E7EB", fontSize: 14, fontWeight: "700" },
  rowSub: { color: "#9CA3AF", fontSize: 12, marginTop: 2 },

  chev: { color: "#9CA3AF", fontSize: 22, marginLeft: 6, marginTop: -2 },

  footer: { textAlign: "center", color: "#6B7280", marginTop: 6, fontSize: 12 },
});
