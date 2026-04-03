# Fix Google Sign-In trên Android

## Lỗi: DEVELOPER_ERROR

Lỗi này xảy ra vì chưa cấu hình SHA-1 fingerprint cho Android app.

## Bước 1: Lấy SHA-1 Fingerprint

### Trên Windows:
```bash
cd android
gradlew.bat signingReport
```

### Trên Mac/Linux:
```bash
cd android
./gradlew signingReport
```

Tìm dòng có `SHA1:` trong output, ví dụ:
```
SHA1: A1:B2:C3:D4:E5:F6:G7:H8:I9:J0:K1:L2:M3:N4:O5:P6:Q7:R8:S9:T0
```

Copy chuỗi SHA-1 này.

## Bước 2: Thêm SHA-1 vào Google Cloud Console

1. Vào https://console.cloud.google.com
2. Chọn project của bạn
3. Vào **APIs & Services** → **Credentials**
4. Tìm **OAuth 2.0 Client IDs**

### Nếu chưa có Android Client:

5. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
6. Chọn **Android**
7. Điền thông tin:
   - **Name**: Finly Android
   - **Package name**: `com.anonymous.Finly`
   - **SHA-1 certificate fingerprint**: Paste SHA-1 từ bước 1
8. Click **CREATE**

### Nếu đã có Android Client:

5. Click vào Android OAuth client ID
6. Thêm SHA-1 fingerprint vào **SHA-1 certificate fingerprints**
7. Click **SAVE**

## Bước 3: Đợi vài phút

Google cần vài phút để cập nhật cấu hình. Đợi 2-5 phút.

## Bước 4: Test lại

1. Đóng app hoàn toàn
2. Mở lại app
3. Thử đăng nhập Google

## Lưu ý quan trọng

- **Web Client ID** (trong `.env`): Dùng cho cả web và native
- **Android Client ID**: Chỉ cần tạo để thêm SHA-1, không cần thêm vào code
- Package name phải khớp: `com.anonymous.Finly`
- SHA-1 phải đúng với keystore đang dùng (debug hoặc release)

## Nếu vẫn lỗi

1. Kiểm tra package name trong `app.json` khớp với Google Console
2. Kiểm tra SHA-1 đã được thêm đúng
3. Thử xóa app và cài lại
4. Kiểm tra Google Play Services đã cài trên điện thoại

## Thông tin hiện tại

- Package name: `com.anonymous.Finly`
- Web Client ID: `978865043993-q10sc77iu5v5j503rfsf1qjhgrgdin1.apps.googleusercontent.com`
