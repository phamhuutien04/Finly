import { saveToDownloads } from '@/lib/DownloadModule';
import { File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack } from "expo-router";
import * as Sharing from 'expo-sharing';
import React, { useMemo, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    TextInput,
    View
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { showAlert, showConfirm, showError, showInfo, showSuccess, showWarning } from "@/lib/globalAlert";
import { supabase } from "@/lib/supabase";

// Import NotificationTest conditionally
let NotificationTest: any = null;
try {
  NotificationTest = require("@/components/NotificationTest").default;
} catch (error) {
  console.log('NotificationTest component not available');
  NotificationTest = () => null;
}

type Option = { label: string; value: string };

type User = {
  id: string;
  email: string;
  display_name?: string;
  phone?: string;
  provider?: string;
  provider_type?: string;
  avatar_url?: string;
};

export default function SettingsScreen() {
  const [darkMode, setDarkMode] = useState(false);
  const [biometric, setBiometric] = useState(false);
  const [pushNoti, setPushNoti] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(true);

  const [language, setLanguage] = useState<Option>({ label: "Tiếng Việt", value: "vi" });
  const [currency, setCurrency] = useState<Option>({ label: "VND (₫)", value: "VND" });

  // Current user profile
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({ display_name: '', phone: '' });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Export data states
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState<'income' | 'expense' | null>(null);
  const [exportLoading, setExportLoading] = useState(false);

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
    showAlert({
      type: "info",
      title: title,
      message: `Đang chọn: ${current.label}`,
      buttons: [
        ...options.map((o) => ({
          text: o.label,
          onPress: () => onPick(o),
        })),
        { text: "Huỷ", style: "cancel" as const },
      ]
    });
  };

  const confirmDanger = (title: string, message: string, onYes: () => void) => {
    showConfirm(title, message, onYes, undefined, "Xác nhận", "Huỷ");
  };

  // Load current user profile
  React.useEffect(() => {
    loadCurrentUserProfile();
  }, []);

  const loadCurrentUserProfile = async () => {
    setLoadingProfile(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        setCurrentUser({
          id: user.id,
          email: user.email || '',
          display_name: user.user_metadata?.display_name || user.user_metadata?.full_name || '',
          phone: user.phone || '',
          provider: user.app_metadata?.provider || 'email',
          provider_type: user.app_metadata?.providers?.[0] || 'Email',
          avatar_url: user.user_metadata?.avatar_url || '',
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoadingProfile(false);
    }
  };

  // Edit current user profile
  const editCurrentUserProfile = () => {
    if (!currentUser) return;
    
    setProfileForm({
      display_name: currentUser.display_name || '',
      phone: currentUser.phone || '',
    });
    setShowEditProfileModal(true);
  };

  // Pick and upload avatar
  const pickAvatar = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showError('Lỗi', 'Cần quyền truy cập thư viện ảnh');
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

      // Get file info
      const uri = result.assets[0].uri;
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${currentUser?.id}.${fileExt}`; // Đơn giản hóa tên file

      // Convert to blob
      const response = await fetch(uri);
      const blob = await response.blob();

      // Upload to Supabase Storage với upsert
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, {
          contentType: `image/${fileExt}`,
          upsert: true, // Ghi đè nếu đã tồn tại
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        showError('Lỗi', 'Không thể tải ảnh lên: ' + uploadError.message);
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
        showError('Lỗi', 'Không thể cập nhật ảnh đại diện: ' + updateError.message);
        return;
      }

      // Update local state
      if (currentUser) {
        setCurrentUser({ ...currentUser, avatar_url: avatarUrl });
      }

      showSuccess('Thành công', 'Đã cập nhật ảnh đại diện');
    } catch (error: any) {
      console.error('Error picking avatar:', error);
      showError('Lỗi', error.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Save profile changes
  const saveProfileChanges = async () => {
    if (!currentUser) return;
    
    try {
      // Update user metadata trực tiếp qua Supabase Auth
      const { data, error } = await supabase.auth.updateUser({
        data: {
          display_name: profileForm.display_name,
          full_name: profileForm.display_name,
        },
        phone: profileForm.phone,
      });
      
      if (error) {
        console.error('Error updating profile:', error);
        showError('Lỗi', 'Không thể cập nhật: ' + error.message);
        return;
      }
      
      // Update current user state
      setCurrentUser({ 
        ...currentUser, 
        display_name: profileForm.display_name, 
        phone: profileForm.phone 
      });
      
      setShowEditProfileModal(false);
      showSuccess('Thành công', 'Đã cập nhật thông tin cá nhân');
    } catch (err: any) {
      console.error('Error:', err);
      showError('Lỗi', 'Không thể cập nhật: ' + err.message);
    }
  };

  // Export transactions to Excel
  const exportTransactions = async () => {
    if (!exportType) {
      showWarning('Lỗi', 'Vui lòng chọn loại giao dịch');
      return;
    }

    setExportLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showError('Lỗi', 'Vui lòng đăng nhập');
        return;
      }

      // Lấy dữ liệu transactions
      const { data, error } = await supabase
        .from('transactions')
        .select('*, categories(name)')
        .eq('user_id', user.id)
        .eq('type', exportType)
        .order('transaction_date', { ascending: false });

      if (error) {
        console.error('Error fetching transactions:', error);
        showError('Lỗi', 'Không thể lấy dữ liệu: ' + error.message);
        return;
      }

      if (!data || data.length === 0) {
        showInfo('Thông báo', `Không có dữ liệu ${exportType === 'income' ? 'thu nhập' : 'chi tiêu'}`);
        return;
      }

      // Create CSV content
      const headers = 'Ngày,Danh mục,Số tiền,Ghi chú\n';
      const rows = data.map((tx: any) => {
        const date = new Date(tx.transaction_date).toLocaleDateString('vi-VN');
        const category = tx.categories?.name || 'Không có';
        const amount = tx.amount.toLocaleString('vi-VN');
        const note = (tx.note || '').replace(/"/g, '""'); // Escape quotes
        return `"${date}","${category}","${amount}","${note}"`;
      }).join('\n');
      
      const csvContent = '\uFEFF' + headers + rows; // Add BOM for UTF-8
      const fileName = `${exportType === 'income' ? 'thu_nhap' : 'chi_tieu'}_${new Date().getTime()}.csv`;

      if (Platform.OS === 'web') {
        // Trên web: Download file CSV
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showSuccess('Thành công', `Đã tải xuống ${data.length} giao dịch`);
      } else if (Platform.OS === 'android') {
        // Trên Android: Lưu trực tiếp vào Downloads
        try {
          await saveToDownloads(fileName, csvContent);
          
          showSuccess(
            'Thành công', 
            `Đã lưu ${data.length} giao dịch vào thư mục Downloads\n\nTên file: ${fileName}`
          );
        } catch (fileError: any) {
          console.error('File save error:', fileError);
          showError('Lỗi', 'Không thể lưu file: ' + fileError.message);
        }
      } else {
        // Trên iOS: Chia sẻ file
        try {
          const file = new File(Paths.document, fileName);
          await file.write(csvContent);
          
          await Sharing.shareAsync(file.uri, {
            mimeType: 'text/csv',
            dialogTitle: 'Lưu file vào điện thoại',
            UTI: 'public.comma-separated-values-text',
          });
        } catch (fileError: any) {
          console.error('File save error:', fileError);
          showError('Lỗi', 'Không thể tạo file: ' + fileError.message);
        }
      }

      // Đóng modal và reset
      setShowExportModal(false);
      setExportType(null);
    } catch (err: any) {
      console.error('Export error:', err);
      showError('Lỗi', 'Không thể xuất file: ' + err.message);
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <ThemedView style={styles.page}>
      <Stack.Screen options={{ title: "Cài đặt" }} />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Profile */}
        <ThemedView style={styles.profileCard}>
          <Pressable onPress={pickAvatar} style={styles.avatarContainer}>
            {uploadingAvatar ? (
              <View style={styles.avatar}>
                <ActivityIndicator size="small" color="#3B82F6" />
              </View>
            ) : currentUser?.avatar_url ? (
              <Image source={{ uri: currentUser.avatar_url }} style={styles.avatarImage} />
            ) : (
              <ThemedView style={styles.avatar}>
                <ThemedText style={styles.avatarText}>
                  {currentUser?.display_name?.charAt(0)?.toUpperCase() || 
                   currentUser?.email?.charAt(0)?.toUpperCase() || '?'}
                </ThemedText>
              </ThemedView>
            )}
            <View style={styles.avatarBadge}>
              <ThemedText style={styles.avatarBadgeText}>📷</ThemedText>
            </View>
          </Pressable>
          
          <View style={{ flex: 1 }}>
            <ThemedText type="subtitle">
              {loadingProfile ? 'Đang tải...' : (currentUser?.display_name || currentUser?.email || 'Người dùng')}
            </ThemedText>
            <ThemedText style={styles.muted}>
              {currentUser?.email || 'Chưa có email'} • {Platform.OS.toUpperCase()}
            </ThemedText>
            {currentUser?.phone && (
              <ThemedText style={styles.muted}>
                📱 {currentUser.phone}
              </ThemedText>
            )}
          </View>

          <Pressable
            onPress={editCurrentUserProfile}
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
            onPress={() => showInfo("PIN", "Gắn màn hình đổi PIN vào đây.")}
          />
        </Section>

        <Section title="Dữ liệu">
          <RowPress
            title="Sao lưu dữ liệu"
            subtitle="Xuất dữ liệu ra file Excel"
            onPress={() => setShowExportModal(true)}
          />
          <RowPress
            title="Khôi phục dữ liệu"
            subtitle="Nhập lại từ bản sao lưu"
            onPress={() => showInfo("Restore", "Import CSV/JSON ở đây.")}
          />
        </Section>

        <Section title="Thông tin">
          <RowPress
            title="Giới thiệu"
            subtitle="Phiên bản 1.0.0"
            onPress={() => showInfo("About", "App quản lí chi tiêu • Finly")}
          />
          <RowPress
            title="Điều khoản & Chính sách"
            subtitle="Xem nội dung"
            onPress={() => showInfo("Policy", "Mở trang Terms/Privacy ở đây.")}
          />
        </Section>

        <Section title="Khu vực nguy hiểm" danger>
          <RowDanger
            title="Xoá toàn bộ dữ liệu"
            subtitle="Không thể khôi phục"
            onPress={() =>
              confirmDanger("Xoá dữ liệu", "Bạn chắc chắn muốn xoá toàn bộ dữ liệu?", () =>
                showSuccess("Đã xoá", "Mình đã xoá dữ liệu (demo).")
              )
            }
          />
          <RowDanger
            title="Đăng xuất"
            subtitle="Thoát khỏi tài khoản hiện tại"
            onPress={() =>
              confirmDanger("Đăng xuất", "Bạn muốn đăng xuất?", async () => {
                try {
                  // Đăng xuất khỏi Supabase
                  const { error } = await supabase.auth.signOut();
                  
                  if (error) {
                    showError("Lỗi", "Không thể đăng xuất: " + error.message);
                    return;
                  }
                  
                  showSuccess("Đăng xuất", "Đã đăng xuất thành công");
                  
                  // Router sẽ tự động redirect về login nhờ auth listener trong _layout.tsx
                } catch (err: any) {
                  showError("Lỗi", err?.message || "Có lỗi xảy ra");
                }
              })
            }
          />
        </Section>

        <ThemedText style={styles.footer}>© {new Date().getFullYear()} Finly</ThemedText>
      </ScrollView>

      {/* Edit Profile Modal */}
      {showEditProfileModal && (
        <Modal
          visible={showEditProfileModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowEditProfileModal(false)}
        >
          <Pressable 
            style={styles.editModalOverlay}
            onPress={() => setShowEditProfileModal(false)}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <ThemedView style={styles.editModalContent}>
                <ThemedText type="subtitle" style={{ marginBottom: 16 }}>
                  Chỉnh sửa thông tin cá nhân
                </ThemedText>

                <ThemedText style={styles.label}>Email</ThemedText>
                <TextInput
                  style={[styles.input, styles.inputDisabled]}
                  value={currentUser?.email || ''}
                  editable={false}
                  placeholder="Email"
                  placeholderTextColor="rgba(127,127,127,0.5)"
                />
                <ThemedText style={styles.helperText}>Email không thể thay đổi</ThemedText>

                <ThemedText style={styles.label}>Tên hiển thị</ThemedText>
                <TextInput
                  style={styles.input}
                  value={profileForm.display_name}
                  onChangeText={(text) => setProfileForm({ ...profileForm, display_name: text })}
                  placeholder="Nhập tên hiển thị"
                  placeholderTextColor="rgba(127,127,127,0.5)"
                />

                <ThemedText style={styles.label}>Số điện thoại</ThemedText>
                <TextInput
                  style={styles.input}
                  value={profileForm.phone}
                  onChangeText={(text) => setProfileForm({ ...profileForm, phone: text })}
                  placeholder="Nhập số điện thoại"
                  placeholderTextColor="rgba(127,127,127,0.5)"
                  keyboardType="phone-pad"
                />

                <View style={styles.editModalActions}>
                  <Pressable
                    onPress={() => setShowEditProfileModal(false)}
                    style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
                  >
                    <ThemedText style={styles.cancelBtnText}>Huỷ</ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={saveProfileChanges}
                    style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.7 }]}
                  >
                    <ThemedText style={styles.saveBtnText}>Lưu</ThemedText>
                  </Pressable>
                </View>
              </ThemedView>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* Export Data Modal */}
      {showExportModal && (
        <Modal
          visible={showExportModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowExportModal(false)}
        >
          <Pressable 
            style={styles.editModalOverlay}
            onPress={() => setShowExportModal(false)}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <ThemedView style={styles.editModalContent}>
                <ThemedText type="subtitle" style={{ marginBottom: 16 }}>
                  Xuất dữ liệu
                </ThemedText>

                <ThemedText style={styles.label}>Chọn loại giao dịch</ThemedText>
                
                <Pressable
                  onPress={() => setExportType('income')}
                  style={[
                    styles.optionBtn,
                    exportType === 'income' && styles.optionBtnSelected
                  ]}
                >
                  <View style={styles.radioOuter}>
                    {exportType === 'income' && <View style={styles.radioInner} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.optionTitle}>Thu nhập</ThemedText>
                    <ThemedText style={styles.optionSubtitle}>Xuất tất cả giao dịch thu nhập</ThemedText>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => setExportType('expense')}
                  style={[
                    styles.optionBtn,
                    exportType === 'expense' && styles.optionBtnSelected
                  ]}
                >
                  <View style={styles.radioOuter}>
                    {exportType === 'expense' && <View style={styles.radioInner} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.optionTitle}>Chi tiêu</ThemedText>
                    <ThemedText style={styles.optionSubtitle}>Xuất tất cả giao dịch chi tiêu</ThemedText>
                  </View>
                </Pressable>

                <View style={styles.editModalActions}>
                  <Pressable
                    onPress={() => {
                      setShowExportModal(false);
                      setExportType(null);
                    }}
                    style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
                  >
                    <ThemedText style={styles.cancelBtnText}>Huỷ</ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={exportTransactions}
                    disabled={!exportType || exportLoading}
                    style={({ pressed }) => [
                      styles.saveBtn,
                      (!exportType || exportLoading) && styles.saveBtnDisabled,
                      pressed && { opacity: 0.7 }
                    ]}
                  >
                    {exportLoading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <ThemedText style={styles.saveBtnText}>📥 Tải xuống</ThemedText>
                    )}
                  </Pressable>
                </View>
              </ThemedView>
            </Pressable>
          </Pressable>
        </Modal>
      )}
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
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(127,127,127,0.15)",
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    opacity: 0.6,
  },
  avatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarBadgeText: {
    fontSize: 12,
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

  // Edit modal
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  editModalContent: {
    width: '100%',
    maxWidth: 440,
    padding: 24,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 16,
    opacity: 0.8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1.5,
    borderColor: 'rgba(127,127,127,0.25)',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    backgroundColor: 'rgba(127,127,127,0.03)',
    color: '#000',
  },
  inputDisabled: {
    backgroundColor: 'rgba(127,127,127,0.12)',
    color: 'rgba(0,0,0,0.4)',
    borderColor: 'rgba(127,127,127,0.15)',
  },
  helperText: {
    fontSize: 11,
    opacity: 0.5,
    marginTop: 6,
    fontStyle: 'italic',
  },
  editModalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 28,
  },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(127,127,127,0.15)',
    alignItems: 'center',
  },
  cancelBtnText: { 
    fontWeight: '700',
    fontSize: 15,
  },
  saveBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  saveBtnText: { 
    color: '#fff', 
    fontWeight: '700',
    fontSize: 15,
  },
  saveBtnDisabled: {
    backgroundColor: 'rgba(59,130,246,0.4)',
    shadowOpacity: 0,
  },

  // Export modal
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(127,127,127,0.15)',
    marginBottom: 12,
    gap: 14,
    backgroundColor: 'rgba(127,127,127,0.02)',
  },
  optionBtnSelected: {
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59,130,246,0.08)',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(127,127,127,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3B82F6',
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 13,
    opacity: 0.65,
    marginTop: 2,
  },
});
