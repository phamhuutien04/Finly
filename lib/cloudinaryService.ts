import { Platform } from 'react-native';

const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export interface CloudinaryUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Upload ảnh lên Cloudinary (unsigned upload)
 * @param imageUri - URI của ảnh (file:// hoặc base64)
 * @returns URL của ảnh đã upload
 */
export async function uploadImageToCloudinary(imageUri: string): Promise<CloudinaryUploadResult> {
  try {
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
      return {
        success: false,
        error: 'Cloudinary chưa được cấu hình'
      };
    }

    // Tạo FormData
    const formData = new FormData();
    
    // Xử lý file upload
    if (Platform.OS === 'web') {
      // Web: convert base64 hoặc blob
      const response = await fetch(imageUri);
      const blob = await response.blob();
      formData.append('file', blob);
    } else {
      // Mobile: sử dụng URI trực tiếp
      const filename = imageUri.split('/').pop() || 'avatar.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      
      formData.append('file', {
        uri: imageUri,
        name: filename,
        type,
      } as any);
    }
    
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('folder', 'finly/avatars');

    // Upload lên Cloudinary
    const uploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json();
      return {
        success: false,
        error: errorData.error?.message || 'Upload thất bại'
      };
    }

    const data = await uploadResponse.json();
    
    return {
      success: true,
      url: data.secure_url,
    };
  } catch (error: any) {
    console.error('Cloudinary upload error:', error);
    return {
      success: false,
      error: error.message || 'Có lỗi xảy ra khi upload ảnh'
    };
  }
}

/**
 * Chọn ảnh từ thư viện (Web)
 */
export function selectImageFromWeb(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) {
        resolve(null);
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        resolve(event.target?.result as string);
      };
      reader.onerror = () => {
        resolve(null);
      };
      reader.readAsDataURL(file);
    };
    
    input.click();
  });
}
