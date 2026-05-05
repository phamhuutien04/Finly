import { saveToDownloads } from '@/lib/DownloadModule';
import { selectImageFromWeb, uploadImageToCloudinary } from '@/lib/cloudinaryService';
import { syncSepayTransactions } from '@/lib/sepayService';
import { File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from "expo-router";
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
import { useTheme } from "@/contexts/ThemeContext";
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
  const router = useRouter();
  const { isDark, themeMode, setThemeMode } = useTheme();
  
  // Dark mode toggle state
  const [darkMode, setDarkMode] = useState(isDark);
  
  // Update when theme changes
  React.useEffect(() => {
    setDarkMode(isDark);
  }, [isDark]);
  
  // Handle dark mode toggle
  const handleDarkModeToggle = (value: boolean) => {
    setDarkMode(value);
    // Set theme mode: dark or light (not system)
    setThemeMode(value ? 'dark' : 'light');
  };
  
  // Improved light/dark theme with better contrast
  const screenBg = isDark ? '#111827' : '#f5f5f5';
  const cardBg = isDark ? '#1f2937' : '#ffffff';
  const text = isDark ? '#f9fafb' : '#1f2937';
  const subtleText = isDark ? '#9ca3af' : '#64748b';
  const borderColor = isDark ? '#374151' : '#d1d5db';
  const inputBg = isDark ? '#1f2937' : '#ffffff';
  const accentColor = '#6366f1';
  
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

  // Sepay API key states
  const [showSepayModal, setShowSepayModal] = useState(false);
  const [sepayApiKey, setSepayApiKey] = useState('');
  const [sepayApiKeyInput, setSepayApiKeyInput] = useState(''); // Separate state for modal input
  const [savingSepayKey, setSavingSepayKey] = useState(false);
  const [syncingSepay, setSyncingSepay] = useState(false);

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
    loadSepayApiKey();
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

  // Load Sepay API key
  const loadSepayApiKey = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Lấy từ bảng user_profiles
      const { data, error } = await supabase
        .from('user_profiles')
        .select('sepay_api_key')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error loading Sepay key:', error);
        return;
      }

      if (data?.sepay_api_key) {
        setSepayApiKey(data.sepay_api_key);
      }
    } catch (error) {
      console.error('Error loading Sepay key:', error);
    }
  };

  // Save Sepay API key
  const saveSepayApiKey = async () => {
    if (!sepayApiKeyInput.trim()) {
      showWarning('Lỗi', 'Vui lòng nhập API key');
      return;
    }

    setSavingSepayKey(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showError('Lỗi', 'Vui lòng đăng nhập');
        return;
      }

      // Lưu vào bảng user_profiles (trigger sẽ tự động cập nhật sepay_key_created_at)
      const { error } = await supabase
        .from('user_profiles')
        .update({
          sepay_api_key: sepayApiKeyInput.trim(),
        })
        .eq('user_id', user.id);

      if (error) {
        showError('Lỗi', 'Không thể lưu API key: ' + error.message);
        return;
      }

      setSepayApiKey(sepayApiKeyInput.trim()); // Update main state after successful save
      setShowSepayModal(false);
      // Removed success notification
    } catch (err: any) {
      showError('Lỗi', err.message);
    } finally {
      setSavingSepayKey(false);
    }
  };

  // Remove Sepay API key
  const removeSepayApiKey = async () => {
    confirmDanger(
      'Xoá API key',
      'Bạn có chắc muốn xoá API key?',
      async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            showError('Lỗi', 'Vui lòng đăng nhập');
            return;
          }

          // Xoá khỏi bảng user_profiles (trigger sẽ tự động xoá sepay_key_created_at)
          const { error } = await supabase
            .from('user_profiles')
            .update({
              sepay_api_key: null,
            })
            .eq('user_id', user.id);

          if (error) {
            showError('Lỗi', 'Không thể xoá API key: ' + error.message);
            return;
          }

          setSepayApiKey('');
          // Removed success notification
        } catch (err: any) {
          showError('Lỗi', err.message);
        }
      }
    );
  };

  // Đồng bộ giao dịch từ Sepay
  const handleSyncSepay = async () => {
    if (!sepayApiKey) {
      showWarning('Lỗi', 'Vui lòng cài đặt API key trước');
      return;
    }

    setSyncingSepay(true);
    try {
      const result = await syncSepayTransactions();
      
      if (result.success) {
        if (result.synced > 0) {
          showSuccess(
            'Đồng bộ thành công', 
            `${result.message}\n\nĐang chuyển về trang chủ...`
          );
          
          // Đợi 1.5s rồi chuyển về trang chủ để reload dữ liệu
          setTimeout(() => {
            router.push('/(tabs)');
          }, 1500);
        } else {
          showInfo('Thông báo', result.message);
        }
      } else {
        showError('Lỗi', result.message);
      }
    } catch (err: any) {
      showError('Lỗi', err.message || 'Không thể đồng bộ');
    } finally {
      setSyncingSepay(false);
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

  // Pick and upload avatar to Cloudinary
  const pickAvatar = async () => {
    try {
      let imageUri: string | null = null;

      if (Platform.OS === 'web') {
        // Web: use file input
        imageUri = await selectImageFromWeb();
      } else {
        // Mobile: use ImagePicker
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          showError('Lỗi', 'Cần quyền truy cập thư viện ảnh');
          return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });

        if (result.canceled) return;
        imageUri = result.assets[0].uri;
      }

      if (!imageUri) return;

      setUploadingAvatar(true);

      // Upload to Cloudinary
      const uploadResult = await uploadImageToCloudinary(imageUri);

      if (!uploadResult.success) {
        showError('Lỗi', uploadResult.error || 'Không thể tải ảnh lên');
        return;
      }

      const avatarUrl = uploadResult.url!;

      // Update user_profiles table
      const { error: updateProfileError } = await supabase
        .from('user_profiles')
        .update({ avatar_url: avatarUrl })
        .eq('user_id', currentUser?.id);

      if (updateProfileError) {
        console.error('Update profile error:', updateProfileError);
        showError('Lỗi', 'Không thể cập nhật ảnh đại diện');
        return;
      }

      // Update user metadata (optional, for backward compatibility)
      await supabase.auth.updateUser({
        data: { avatar_url: avatarUrl },
      });

      // Update local state
      if (currentUser) {
        setCurrentUser({ ...currentUser, avatar_url: avatarUrl });
      }
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
    <ThemedView style={{ ...styles.page, backgroundColor: screenBg }}>
      <Stack.Screen options={{ title: "Cài đặt" }} />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Profile */}
        <ThemedView style={{ ...styles.profileCard, backgroundColor: cardBg, borderColor: borderColor }}>
          <Pressable onPress={pickAvatar} style={styles.avatarContainer}>
            {uploadingAvatar ? (
              <View style={{ ...styles.avatar, backgroundColor: inputBg }}>
                <ActivityIndicator size="small" color={accentColor} />
              </View>
            ) : currentUser?.avatar_url ? (
              <Image source={{ uri: currentUser.avatar_url }} style={styles.avatarImage} />
            ) : (
              <ThemedView style={{ ...styles.avatar, backgroundColor: inputBg }}>
                <ThemedText style={{ ...styles.avatarText, color: subtleText }}>
                  {currentUser?.display_name?.charAt(0)?.toUpperCase() || 
                   currentUser?.email?.charAt(0)?.toUpperCase() || '?'}
                </ThemedText>
              </ThemedView>
            )}
            <View style={{ ...styles.avatarBadge, backgroundColor: accentColor, borderColor: cardBg }}>
              <ThemedText style={styles.avatarBadgeText}>📷</ThemedText>
            </View>
          </Pressable>
          
          <View style={{ flex: 1 }}>
            <ThemedText type="subtitle" style={{ color: text }}>
              {loadingProfile ? 'Đang tải...' : (currentUser?.display_name || currentUser?.email || 'Người dùng')}
            </ThemedText>
            <ThemedText style={{ ...styles.muted, color: subtleText }}>
              {currentUser?.email || 'Chưa có email'}
            </ThemedText>
            {currentUser?.phone && (
              <ThemedText style={{ ...styles.muted, color: subtleText }}>
                📱 {currentUser.phone}
              </ThemedText>
            )}
          </View>

          <Pressable
            onPress={editCurrentUserProfile}
            style={({ pressed }) => [
              { ...styles.outlineBtn, borderColor: borderColor },
              pressed && { opacity: 0.75 }
            ]}
          >
            <ThemedText style={{ ...styles.outlineBtnText, color: text }}>Sửa</ThemedText>
          </Pressable>
        </ThemedView>

        <Section title="Tuỳ chọn" borderColor={borderColor} cardBg={cardBg}>
          <RowSwitch
            title="Dark Mode"
            subtitle="Giao diện tối dễ nhìn ban đêm"
            value={darkMode}
            onValueChange={handleDarkModeToggle}
            borderColor={borderColor}
            subtleText={subtleText}
            cardBg={cardBg}
            text={text}
          />
          <RowSwitch
            title="Thông báo đẩy"
            subtitle="Nhắc nhở ghi chi tiêu hằng ngày"
            value={pushNoti}
            onValueChange={setPushNoti}
            borderColor={borderColor}
            subtleText={subtleText}
            cardBg={cardBg}
            text={text}
          />
          <RowSwitch
            title="Báo cáo tuần"
            subtitle="Gửi tổng kết chi tiêu mỗi tuần"
            value={weeklyReport}
            onValueChange={setWeeklyReport}
            borderColor={borderColor}
            subtleText={subtleText}
            cardBg={cardBg}
            text={text}
          />
          <RowPress
            title="Ngôn ngữ"
            subtitle={language.label}
            onPress={() => pickOption("Chọn ngôn ngữ", languages, language, setLanguage)}
            borderColor={borderColor}
            subtleText={subtleText}
            cardBg={cardBg}
            text={text}
          />
          <RowPress
            title="Tiền tệ"
            subtitle={currency.label}
            onPress={() => pickOption("Chọn tiền tệ", currencies, currency, setCurrency)}
            borderColor={borderColor}
            subtleText={subtleText}
            cardBg={cardBg}
            text={text}
          />
        </Section>

        <Section title="Bảo mật" borderColor={borderColor} cardBg={cardBg}>
          <RowSwitch
            title="Mở khoá sinh trắc học"
            subtitle="Vân tay / FaceID (nếu thiết bị hỗ trợ)"
            value={biometric}
            onValueChange={setBiometric}
            borderColor={borderColor}
            subtleText={subtleText}
            cardBg={cardBg}
            text={text}
          />
          <RowPress
            title="Đổi mã PIN"
            subtitle="Thiết lập PIN để mở app"
            onPress={() => showInfo("PIN", "Gắn màn hình đổi PIN vào đây.")}
            borderColor={borderColor}
            subtleText={subtleText}
            cardBg={cardBg}
            text={text}
          />
        </Section>

        <Section title="Tích hợp API" borderColor={borderColor} cardBg={cardBg}>
          <RowPress
            title="API Key"
            subtitle={sepayApiKey ? '••••••••' + sepayApiKey.slice(-4) : 'Chưa cài đặt'}
            onPress={() => {
              setSepayApiKeyInput(sepayApiKey); // Copy current value to input
              setShowSepayModal(true);
            }}
            borderColor={borderColor}
            subtleText={subtleText}
            cardBg={cardBg}
            text={text}
          />
          {sepayApiKey && (
            <>
              <RowPress
                title="Đồng bộ giao dịch ngân hàng"
                subtitle="Tự động phân loại chi tiêu"
                onPress={handleSyncSepay}
                borderColor={borderColor}
                subtleText={subtleText}
                cardBg={cardBg}
                text={text}
              />
              <RowDanger
                title="Xoá API Key"
                subtitle="Xoá key đã lưu"
                onPress={removeSepayApiKey}
                borderColor={borderColor}
                subtleText={subtleText}
                cardBg={cardBg}
              />
            </>
          )}
        </Section>

        <Section title="Dữ liệu" borderColor={borderColor} cardBg={cardBg}>
          <RowPress
            title="Sao lưu dữ liệu"
            subtitle="Xuất dữ liệu ra file Excel"
            onPress={() => setShowExportModal(true)}
            borderColor={borderColor}
            subtleText={subtleText}
            cardBg={cardBg}
            text={text}
          />
          <RowPress
            title="Khôi phục dữ liệu"
            subtitle="Nhập lại từ bản sao lưu"
            onPress={() => showInfo("Restore", "Import CSV/JSON ở đây.")}
            borderColor={borderColor}
            subtleText={subtleText}
            cardBg={cardBg}
            text={text}
          />
        </Section>

        <Section title="Thông tin" borderColor={borderColor} cardBg={cardBg}>
          <RowPress
            title="Giới thiệu"
            subtitle="Phiên bản 1.0.0"
            onPress={() => showInfo("About", "App quản lí chi tiêu • Finly")}
            borderColor={borderColor}
            subtleText={subtleText}
            cardBg={cardBg}
            text={text}
          />
          <RowPress
            title="Điều khoản & Chính sách"
            subtitle="Xem nội dung"
            onPress={() => showInfo("Policy", "Mở trang Terms/Privacy ở đây.")}
            borderColor={borderColor}
            subtleText={subtleText}
            cardBg={cardBg}
            text={text}
          />
        </Section>

        <Section title="Khu vực nguy hiểm" danger borderColor={borderColor} cardBg={cardBg}>
          <RowDanger
            title="Xoá toàn bộ dữ liệu"
            subtitle="Không thể khôi phục"
            onPress={() =>
              confirmDanger("Xoá dữ liệu", "Bạn chắc chắn muốn xoá toàn bộ dữ liệu?", () =>
                showSuccess("Đã xoá", "Mình đã xoá dữ liệu (demo).")
              )
            }
            borderColor={borderColor}
            subtleText={subtleText}
            cardBg={cardBg}
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
                  
                  // Router sẽ tự động redirect về login nhờ auth listener trong _layout.tsx
                } catch (err: any) {
                  showError("Lỗi", err?.message || "Có lỗi xảy ra");
                }
              })
            }
            borderColor={borderColor}
            subtleText={subtleText}
            cardBg={cardBg}
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
              <ThemedView style={{ ...styles.editModalContent, backgroundColor: cardBg }}>
                <ThemedText type="subtitle" style={{ marginBottom: 16, color: text }}>
                  Chỉnh sửa thông tin cá nhân
                </ThemedText>

                <ThemedText style={{ ...styles.label, color: text }}>Email</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    styles.inputDisabled,
                    { borderColor: borderColor, backgroundColor: inputBg, color: subtleText }
                  ]}
                  value={currentUser?.email || ''}
                  editable={false}
                  placeholder="Email"
                  placeholderTextColor={subtleText}
                />
                <ThemedText style={{ ...styles.helperText, color: subtleText }}>Email không thể thay đổi</ThemedText>

                <ThemedText style={{ ...styles.label, color: text }}>Tên hiển thị</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    { borderColor: borderColor, backgroundColor: inputBg, color: text }
                  ]}
                  value={profileForm.display_name}
                  onChangeText={(text) => setProfileForm({ ...profileForm, display_name: text })}
                  placeholder="Nhập tên hiển thị"
                  placeholderTextColor={subtleText}
                />

                <ThemedText style={{ ...styles.label, color: text }}>Số điện thoại</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    { borderColor: borderColor, backgroundColor: inputBg, color: text }
                  ]}
                  value={profileForm.phone}
                  onChangeText={(text) => setProfileForm({ ...profileForm, phone: text })}
                  placeholder="Nhập số điện thoại"
                  placeholderTextColor={subtleText}
                  keyboardType="phone-pad"
                />

                <View style={styles.editModalActions}>
                  <Pressable
                    onPress={() => setShowEditProfileModal(false)}
                    style={({ pressed }) => [
                      { ...styles.cancelBtn, backgroundColor: inputBg },
                      pressed && { opacity: 0.7 }
                    ]}
                  >
                    <ThemedText style={{ ...styles.cancelBtnText, color: text }}>Huỷ</ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={saveProfileChanges}
                    style={({ pressed }) => [
                      { ...styles.saveBtn, backgroundColor: accentColor },
                      pressed && { opacity: 0.7 }
                    ]}
                  >
                    <ThemedText style={styles.saveBtnText}>Lưu</ThemedText>
                  </Pressable>
                </View>
              </ThemedView>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* Sepay API Key Modal */}
      {showSepayModal && (
        <Modal
          visible={showSepayModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowSepayModal(false)}
        >
          <Pressable 
            style={styles.editModalOverlay}
            onPress={() => setShowSepayModal(false)}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <ThemedView style={{ ...styles.editModalContent, backgroundColor: cardBg }}>
                <ThemedText type="subtitle" style={{ marginBottom: 8, color: text }}>
                  Cài đặt Sepay API Key
                </ThemedText>
                <ThemedText style={[styles.helperText, { marginTop: 0, marginBottom: 16, color: subtleText }]}>
                  Nhập API key từ Sepay để tự động đồng bộ giao dịch ngân hàng
                </ThemedText>

                <ThemedText style={{ ...styles.label, color: text }}>API Key</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    { borderColor: borderColor, backgroundColor: inputBg, color: text }
                  ]}
                  value={sepayApiKeyInput}
                  onChangeText={setSepayApiKeyInput}
                  placeholder="Nhập Sepay API key"
                  placeholderTextColor={subtleText}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <ThemedText style={{ ...styles.helperText, color: subtleText }}>
                  Lấy API key tại: https://my.sepay.vn
                </ThemedText>

                <View style={styles.editModalActions}>
                  <Pressable
                    onPress={() => setShowSepayModal(false)}
                    style={({ pressed }) => [
                      { ...styles.cancelBtn, backgroundColor: inputBg },
                      pressed && { opacity: 0.7 }
                    ]}
                  >
                    <ThemedText style={{ ...styles.cancelBtnText, color: text }}>Huỷ</ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={saveSepayApiKey}
                    disabled={savingSepayKey}
                    style={({ pressed }) => [
                      { ...styles.saveBtn, backgroundColor: accentColor },
                      savingSepayKey && styles.saveBtnDisabled,
                      pressed && { opacity: 0.7 }
                    ]}
                  >
                    {savingSepayKey ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <ThemedText style={styles.saveBtnText}>Lưu</ThemedText>
                    )}
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
          animationType="slide"
          transparent
          onRequestClose={() => {
            setShowExportModal(false);
            setExportType(null);
          }}
        >
          <Pressable 
            style={styles.exportModalOverlay}
            onPress={() => {
              setShowExportModal(false);
              setExportType(null);
            }}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <ThemedView style={{ ...styles.exportModalContent, backgroundColor: cardBg }}>
                <View style={{ ...styles.exportModalHandle, backgroundColor: borderColor }} />
                
                <ThemedText style={{ ...styles.exportModalTitle, color: text }}>Xuất dữ liệu</ThemedText>
                <ThemedText style={{ ...styles.exportModalSubtitle, color: subtleText }}>Chọn loại giao dịch</ThemedText>
                
                <View style={styles.exportOptionsContainer}>
                  <Pressable
                    onPress={() => setExportType('income')}
                    style={[
                      { ...styles.exportOptionCard, backgroundColor: inputBg },
                      exportType === 'income' && styles.exportOptionCardSelected
                    ]}
                  >
                    <View style={[styles.exportOptionIcon, { backgroundColor: '#10B981' }]}>
                      <ThemedText style={styles.exportOptionEmoji}>💰</ThemedText>
                    </View>
                    <ThemedText style={{ ...styles.exportOptionTitle, color: text }}>Thu nhập</ThemedText>
                    <ThemedText style={{ ...styles.exportOptionDesc, color: subtleText }}>Xuất tất cả giao dịch</ThemedText>
                    {exportType === 'income' && (
                      <View style={styles.exportCheckmark}>
                        <ThemedText style={styles.exportCheckmarkText}>✓</ThemedText>
                      </View>
                    )}
                  </Pressable>

                  <Pressable
                    onPress={() => setExportType('expense')}
                    style={[
                      { ...styles.exportOptionCard, backgroundColor: inputBg },
                      exportType === 'expense' && styles.exportOptionCardSelected
                    ]}
                  >
                    <View style={[styles.exportOptionIcon, { backgroundColor: '#EF4444' }]}>
                      <ThemedText style={styles.exportOptionEmoji}>💸</ThemedText>
                    </View>
                    <ThemedText style={{ ...styles.exportOptionTitle, color: text }}>Chi tiêu</ThemedText>
                    <ThemedText style={{ ...styles.exportOptionDesc, color: subtleText }}>Xuất tất cả giao dịch</ThemedText>
                    {exportType === 'expense' && (
                      <View style={styles.exportCheckmark}>
                        <ThemedText style={styles.exportCheckmarkText}>✓</ThemedText>
                      </View>
                    )}
                  </Pressable>
                </View>

                <View style={styles.exportModalActions}>
                  <Pressable
                    onPress={() => {
                      setShowExportModal(false);
                      setExportType(null);
                    }}
                    style={({ pressed }) => [
                      { ...styles.exportCancelBtn, backgroundColor: inputBg },
                      pressed && { opacity: 0.7 }
                    ]}
                  >
                    <ThemedText style={{ ...styles.exportCancelBtnText, color: subtleText }}>Huỷ</ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={exportTransactions}
                    disabled={!exportType || exportLoading}
                    style={({ pressed }) => [
                      { ...styles.exportDownloadBtn, backgroundColor: accentColor },
                      (!exportType || exportLoading) && styles.exportDownloadBtnDisabled,
                      pressed && { opacity: 0.7 }
                    ]}
                  >
                    {exportLoading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <ThemedText style={styles.exportDownloadBtnText}>📥 Tải xuống</ThemedText>
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
  borderColor,
  cardBg,
}: {
  title: string;
  danger?: boolean;
  children: React.ReactNode;
  borderColor: string;
  cardBg: string;
}) {
  return (
    <View style={styles.section}>
      <ThemedText style={[styles.sectionTitle, danger && { color: "#DC2626" }]}>
        {title}
      </ThemedText>

      <View style={{ ...styles.card, borderColor, backgroundColor: cardBg }}>{children}</View>
    </View>
  );
}

function RowSwitch({
  title,
  subtitle,
  value,
  onValueChange,
  borderColor,
  subtleText,
  cardBg,
  text,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  borderColor: string;
  subtleText?: string;
  cardBg: string;
  text: string;
}) {
  return (
    <View style={{ ...styles.row, borderTopColor: borderColor, backgroundColor: cardBg }}>
      <View style={{ flex: 1 }}>
        <ThemedText style={[styles.rowTitle, { color: text }]}>{title}</ThemedText>
        {!!subtitle && <ThemedText style={[styles.rowSub, { color: subtleText }]}>{subtitle}</ThemedText>}
      </View>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

function RowPress({
  title,
  subtitle,
  onPress,
  borderColor,
  subtleText,
  cardBg,
  text,
}: {
  title: string;
  subtitle?: string;
  onPress: () => void;
  borderColor: string;
  subtleText?: string;
  cardBg: string;
  text: string;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.75 }]}>
      <View style={{ ...styles.row, borderTopColor: borderColor, backgroundColor: cardBg }}>
        <View style={{ flex: 1 }}>
          <ThemedText style={[styles.rowTitle, { color: text }]}>{title}</ThemedText>
          {!!subtitle && <ThemedText style={[styles.rowSub, { color: subtleText }]}>{subtitle}</ThemedText>}
        </View>
        <ThemedText style={[styles.chev, { color: text }]}>›</ThemedText>
      </View>
    </Pressable>
  );
}

function RowDanger({
  title,
  subtitle,
  onPress,
  borderColor,
  subtleText,
  cardBg,
}: {
  title: string;
  subtitle?: string;
  onPress: () => void;
  borderColor: string;
  subtleText?: string;
  cardBg: string;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.75 }]}>
      <View style={{ ...styles.row, borderTopColor: borderColor, backgroundColor: cardBg }}>
        <View style={{ flex: 1 }}>
          <ThemedText style={[styles.rowTitle, { color: "#DC2626" }]}>{title}</ThemedText>
          {!!subtitle && <ThemedText style={[styles.rowSub, { color: subtleText || "#DC2626" }]}>{subtitle}</ThemedText>}
        </View>
        <ThemedText style={[styles.chev, { color: "#DC2626" }]}>›</ThemedText>
      </View>
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
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
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
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  avatarBadgeText: {
    fontSize: 12,
  },

  outlineBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  outlineBtnText: { fontWeight: "700" },

  // sections
  section: { gap: 8 },
  sectionTitle: { fontSize: 12, fontWeight: "700", paddingLeft: 4, opacity: 0.75 },

  card: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },

  row: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
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
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
  },
  inputDisabled: {
    opacity: 0.5,
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

  // Export modal - new design
  exportModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  exportModalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
    paddingBottom: 32,
    paddingHorizontal: 20,
  },
  exportModalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  exportModalTitle: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  exportModalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  exportOptionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  exportOptionCard: {
    flex: 1,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
    position: 'relative',
  },
  exportOptionCardSelected: {
    borderColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  exportOptionIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  exportOptionEmoji: {
    fontSize: 32,
  },
  exportOptionTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  exportOptionDesc: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  exportCheckmark: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  exportCheckmarkText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  exportModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  exportCancelBtn: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  exportCancelBtnText: {
    fontWeight: '700',
    fontSize: 16,
  },
  exportDownloadBtn: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  exportDownloadBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  exportDownloadBtnDisabled: {
    backgroundColor: '#D1D5DB',
    shadowOpacity: 0,
  },

  // Old export modal styles (keep for edit profile modal)
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
