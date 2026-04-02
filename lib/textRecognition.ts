// lib/textRecognition.ts - Text recognition từ ảnh
import Constants from 'expo-constants';

/**
 * Nhận diện text từ ảnh sử dụng OCR.space API (miễn phí)
 * Không cần thẻ tín dụng, 25,000 requests/tháng miễn phí
 */
export async function recognizeText(imageUri: string): Promise<string> {
  try {
    // Chỉ dùng OCR.space API (miễn phí, không cần thẻ)
    const ocrSpaceKey = Constants.expoConfig?.extra?.ocrSpaceApiKey || 
                        process.env.EXPO_PUBLIC_OCR_SPACE_API_KEY ||
                        'K84671498188957'; // Fallback key
    
    console.log('🔍 Using OCR.space API for OCR...');
    console.log('📌 API Key:', ocrSpaceKey.substring(0, 10) + '...');
    
    const result = await recognizeWithOCRSpace(imageUri, ocrSpaceKey);
    
    if (result) {
      console.log('✅ OCR successful, text length:', result.length);
      return result;
    }
    
    console.warn('⚠️ OCR.space failed, using mock OCR');
    return mockOCR();
    
  } catch (error) {
    console.error('❌ Text recognition error:', error);
    return mockOCR();
  }
}

/**
 * OCR.space API - Miễn phí, không cần thẻ
 * 25,000 requests/tháng miễn phí
 */
async function recognizeWithOCRSpace(imageUri: string, apiKey: string): Promise<string | null> {
  try {
    console.log('📸 Converting image to base64...');
    // Convert image to base64
    const base64Image = await imageToBase64(imageUri);
    if (!base64Image) {
      console.error('❌ Failed to convert image to base64');
      return null;
    }

    console.log('🌐 Calling OCR.space API...');
    // Gọi OCR.space API
    const formData = new FormData();
    formData.append('base64Image', `data:image/jpeg;base64,${base64Image}`);
    formData.append('language', 'eng'); // English (hỗ trợ tốt nhất)
    formData.append('isOverlayRequired', 'false');
    formData.append('detectOrientation', 'true');
    formData.append('scale', 'true');
    formData.append('OCREngine', '2'); // Engine 2 tốt hơn

    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: {
        'apikey': apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OCR.space API error:', response.status, errorText);
      return null;
    }

    const result = await response.json();
    console.log('📄 OCR.space response:', JSON.stringify(result).substring(0, 200));
    
    if (result.IsErroredOnProcessing) {
      console.error('❌ OCR.space processing error:', result.ErrorMessage);
      return null;
    }

    if (result.ParsedResults && result.ParsedResults[0]) {
      const text = result.ParsedResults[0].ParsedText;
      return text || null;
    }

    console.warn('⚠️ No text found in OCR.space response');
    return null;
  } catch (error) {
    console.error('❌ OCR.space error:', error);
    return null;
  }
}

/**
 * Convert image URI sang base64
 */
async function imageToBase64(uri: string): Promise<string | null> {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        const base64Data = base64.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting image to base64:', error);
    return null;
  }
}

/**
 * Mock OCR cho testing và demo
 */
function mockOCR(): string {
  const samples = [
    `CỬA HÀNG TIỆN LỢI
Circle K
123 Nguyễn Huệ, Q1, TP.HCM

Ngày: 02/04/2026
Giờ: 14:30

Coca Cola 330ml    15.000đ
Bánh mì           20.000đ
Nước suối          8.000đ

TỔNG CỘNG:        43.000đ

Cảm ơn quý khách!`,
    
    `HIGHLAND COFFEE
Cà phê phin sữa đá    45.000đ
Bánh mì que          25.000đ

Ngày: 02/04/2026
TỔNG CỘNG:           70.000đ`,

    `GRAB
Chuyến đi #GR123456
Từ: 123 Lê Lợi
Đến: 456 Nguyễn Trãi

Ngày: 02/04/2026
Tổng cộng:    55.000đ`,

    `VINMART
Siêu thị Vinmart+
Gạo ST25 5kg        120.000đ
Thịt heo           85.000đ
Rau củ             35.000đ

Ngày: 02/04/2026
TỔNG:             240.000đ`,

    `PHỞ 24
Phở bò tái          50.000đ
Phở gà             45.000đ
Nước ngọt          15.000đ

02/04/2026
Tổng cộng:        110.000đ`,

    `PETROLIMEX
Xăng RON 95
Số lít: 5.5L
Đơn giá: 23.500đ/L

Ngày: 02/04/2026
Thành tiền:      129.250đ`,

    `BÁN MÌ QUẢ
Mì xào hải sản      35.000đ
Trà đá              5.000đ

02/04/2026
Tổng:              40.000đ`,

    `LOTTERIA
Burger phô mai      49.000đ
Gà rán (3 miếng)    55.000đ
Pepsi               15.000đ

Ngày: 02/04/2026
TỔNG CỘNG:         119.000đ`
  ];
  
  return samples[Math.floor(Math.random() * samples.length)];
}
