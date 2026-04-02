// app/scan-receipt.tsx - Màn hình quét hóa đơn
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { findCategoryId, parseReceiptText, type ReceiptData } from '@/lib/receiptOCR';
import { supabase } from '@/lib/supabase';
import { recognizeText } from '@/lib/textRecognition';

type Category = {
  id: number;
  name: string;
  type: 'income' | 'expense';
  emoji: string | null;
};

export default function ScanReceiptScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  // Modal xác nhận
  const [showConfirm, setShowConfirm] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  
  // Form data
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Load categories
  React.useEffect(() => {
    loadCategories();
  }, []);
  
  const loadCategories = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, type, emoji')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .order('name');
      
      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };
  
  // Xin quyền camera
  if (!permission) {
    return <View style={styles.container}><ActivityIndicator /></View>;
  }
  
  if (!permission.granted) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={styles.message}>
          Cần quyền truy cập camera để quét hóa đơn
        </ThemedText>
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Cho phép</Text>
        </Pressable>
      </ThemedView>
    );
  }
  
  // Chụp ảnh
  const takePicture = async () => {
    if (!cameraRef.current || !cameraReady) return;
    
    try {
      setProcessing(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });
      
      if (photo?.uri) {
        await processImage(photo.uri);
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Lỗi', 'Không thể chụp ảnh');
    } finally {
      setProcessing(false);
    }
  };
  
  // Chọn ảnh từ thư viện
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets[0]) {
        setProcessing(true);
        await processImage(result.assets[0].uri);
        setProcessing(false);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Lỗi', 'Không thể chọn ảnh');
      setProcessing(false);
    }
  };
  
  // Xử lý ảnh với OCR
  const processImage = async (imageUri: string) => {
    try {
      setCapturedImage(imageUri);
      
      // Nhận diện text
      const text = await recognizeText(imageUri);
      
      if (!text) {
        Alert.alert('Thông báo', 'Không nhận diện được text từ ảnh');
        return;
      }
      
      // Phân tích hóa đơn
      const parsed = parseReceiptText(text);
      setReceiptData(parsed);
      
      // Điền form
      if (parsed.amount) {
        setAmount(parsed.amount.toString());
      }
      if (parsed.merchantName) {
        setNote(parsed.merchantName);
      }
      
      // Tìm category
      if (parsed.category) {
        const categoryId = await findCategoryId(parsed.category, categories);
        if (categoryId) {
          setSelectedCategoryId(categoryId);
        }
      }
      
      setShowConfirm(true);
    } catch (error) {
      console.error('Error processing image:', error);
      Alert.alert('Lỗi', 'Không thể xử lý ảnh');
    }
  };
  
  // Lưu giao dịch
  const saveTransaction = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Lỗi', 'Vui lòng nhập số tiền hợp lệ');
      return;
    }
    
    if (!selectedCategoryId) {
      Alert.alert('Lỗi', 'Vui lòng chọn danh mục');
      return;
    }
    
    try {
      setProcessing(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Chưa đăng nhập');
      
      const transactionDate = receiptData?.date || new Date();
      
      const { error } = await supabase.from('transactions').insert({
        user_id: user.id,
        category_id: selectedCategoryId,
        type: 'expense',
        amount: parseFloat(amount),
        note: note || null,
        transaction_date: transactionDate.toISOString(),
        occurred_at: transactionDate.toISOString(),
      });
      
      if (error) throw error;
      
      Alert.alert('Thành công', 'Đã lưu chi tiêu từ hóa đơn', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      console.error('Error saving transaction:', error);
      Alert.alert('Lỗi', error.message || 'Không thể lưu giao dịch');
    } finally {
      setProcessing(false);
    }
  };
  
  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        onCameraReady={() => setCameraReady(true)}
      />
      <View style={styles.overlay}>
        <View style={styles.header}>
          <Pressable style={styles.closeButton} onPress={() => router.back()}>
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
          <Text style={styles.title}>Quét hóa đơn</Text>
          <View style={{ width: 40 }} />
        </View>
        
        <View style={styles.scanArea}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>
        
        <View style={styles.controls}>
          <Pressable style={styles.iconButton} onPress={pickImage}>
            <Ionicons name="images" size={28} color="#fff" />
          </Pressable>
          
          <Pressable
            style={[styles.captureButton, processing && styles.captureButtonDisabled]}
            onPress={takePicture}
            disabled={processing || !cameraReady}
          >
            {processing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.captureInner} />
            )}
          </Pressable>
          
          <View style={{ width: 60 }} />
        </View>
      </View>
      
      {/* Modal xác nhận */}
      <Modal visible={showConfirm} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Xác nhận thông tin</Text>
              
              {capturedImage && (
                <Image source={{ uri: capturedImage }} style={styles.preview} />
              )}
              
              <Text style={styles.label}>Số tiền *</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="Nhập số tiền"
              />
              
              <Text style={styles.label}>Ghi chú</Text>
              <TextInput
                style={styles.input}
                value={note}
                onChangeText={setNote}
                placeholder="Tên cửa hàng, mô tả..."
              />
              
              <Text style={styles.label}>Danh mục *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                {categories.map(cat => (
                  <Pressable
                    key={cat.id}
                    style={[
                      styles.categoryChip,
                      selectedCategoryId === cat.id && styles.categoryChipSelected
                    ]}
                    onPress={() => setSelectedCategoryId(cat.id)}
                  >
                    <Text style={styles.categoryEmoji}>{cat.emoji || '📁'}</Text>
                    <Text style={[
                      styles.categoryName,
                      selectedCategoryId === cat.id && styles.categoryNameSelected
                    ]}>
                      {cat.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              
              {receiptData?.category && (
                <Text style={styles.hint}>
                  💡 Gợi ý: {receiptData.category}
                </Text>
              )}
              
              <View style={styles.modalButtons}>
                <Pressable
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setShowConfirm(false);
                    setCapturedImage(null);
                    setReceiptData(null);
                    setAmount('');
                    setNote('');
                    setSelectedCategoryId(null);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Hủy</Text>
                </Pressable>
                
                <Pressable
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={saveTransaction}
                  disabled={processing}
                >
                  {processing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Lưu</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  scanArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 40,
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#fff',
  },
  topLeft: {
    top: 0,
    left: 40,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  topRight: {
    top: 0,
    right: 40,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  bottomLeft: {
    bottom: 0,
    left: 40,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  bottomRight: {
    bottom: 0,
    right: 40,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  iconButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#000',
  },
  message: {
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignSelf: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  preview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  categoryScroll: {
    marginBottom: 16,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  categoryChipSelected: {
    backgroundColor: '#007AFF',
  },
  categoryEmoji: {
    fontSize: 18,
    marginRight: 6,
  },
  categoryName: {
    fontSize: 14,
    color: '#333',
  },
  categoryNameSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  hint: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
