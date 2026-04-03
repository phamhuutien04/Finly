# 🔐 Hướng Dẫn Setup Google Sign-In

## Bước 1: Tạo Google Cloud Project (nếu chưa có)

1. Vào: https://console.cloud.google.com/
2. Tạo project mới hoặc chọn project có sẵn
3. Ghi nhớ Project ID

## Bước 2: Enable Google Sign-In API

1. Vào menu ☰ → **APIs & Services** → **Library**
2. Tìm: `Google Sign-In API`
3. Click **ENABLE**

## Bước 3: Tạo OAuth 2.0 Client IDs

### 3.1. Tạo OAuth Consent Screen

1. Vào: **APIs & Services** → **OAuth consent screen**
2. Chọn **External**
3. Điền thông tin:
   - App name: `Finly`
   - User support email: email của bạn
   - Developer contact: email của bạn
4. Click **SAVE AND CONTINUE**
5. Bỏ qua Scopes → **SAVE AND CONTINUE**
6. Thêm test users (email của bạn)
7. Click **SAVE AND CONTINUE**

### 3.2. Tạo Web Client ID (cho Supabase)

1. Vào: **APIs & Services** → **Credentials**
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `Finly Web Client`
5. Authorized redirect URIs:
   ```
   https://iniqduvxqhbeqfwscnzu.supabase.co/auth/v1/callback
   ```
   Thay `YOUR_SUPABASE_PROJECT_REF` bằng project ref của bạn
   (Ví dụ: `iniqduvxqhbeqfwscnzu`)
6. Click **CREATE**
7. **Copy Client ID và Client Secret** (cần cho Supabase)

### 3.3. Tạo Android Client ID

1. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
2. Application type: **Android**
3. Name: `Finly Android`
4. Package name: `com.anonymous.Finly` (từ app.json)
5. SHA-1 certificate fingerprint:
   
   **Để lấy SHA-1:**
   ```bash
   # Debug keystore (development)
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
   
   # Hoặc trên Windows:
   keytool -list -v -keystore %USERPROFILE%\.android\debug.keystore -alias androiddebugkey -storepass android -keypass android
   ```
   
   Copy dòng `SHA1:` (dạng: `AA:BB:CC:...`)

6. Click **CREATE**
7. **Copy Client ID** (dạng: `xxxxx.apps.googleusercontent.com`)

### 3.4. Tạo iOS Client ID (nếu cần)

1. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
2. Application type: **iOS**
3. Name: `Finly iOS`
4. Bundle ID: `com.anonymous.Finly`
5. Click **CREATE**
6. **Copy Client ID**

## Bước 4: Cấu hình Supabase

1. Vào Supabase Dashboard: https://supabase.com/dashboard
2. Chọn project của bạn
3. Vào **Authentication** → **Providers**
4. Tìm **Google** và bật ON
5. Điền:
   - **Client ID**: Web Client ID từ bước 3.2
   - **Client Secret**: Web Client Secret từ bước 3.2
6. Click **Save**

## Bước 5: Thêm vào .env

Thêm vào file `.env`:

```env
# Google Sign-In
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=xxxxx-xxxxx.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=xxxxx-xxxxx.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=xxxxx-xxxxx.apps.googleusercontent.com
```

## Bước 6: Cập nhật app.json

Đã tự động cập nhật trong code!

## Bước 7: Test

1. Restart app: `npm start --clear`
2. Vào màn hình đăng nhập
3. Nhấn "Đăng nhập bằng Google"
4. Chọn tài khoản Google
5. Đăng nhập thành công! 🎉

---

## 📝 Checklist

- [ ] Đã tạo Google Cloud Project
- [ ] Đã enable Google Sign-In API
- [ ] Đã tạo OAuth consent screen
- [ ] Đã tạo Web Client ID
- [ ] Đã tạo Android Client ID
- [ ] Đã lấy SHA-1 fingerprint
- [ ] Đã cấu hình Supabase
- [ ] Đã thêm Client IDs vào .env
- [ ] Đã restart app
- [ ] Google Sign-In hoạt động! 🎊

---

## 🆘 Troubleshooting

### Lỗi: "Developer Error"
→ Kiểm tra SHA-1 fingerprint đúng chưa

### Lỗi: "Sign in failed"
→ Kiểm tra Client IDs trong .env

### Lỗi: "Invalid redirect URI"
→ Kiểm tra redirect URI trong Google Console

### Không hiện popup chọn tài khoản
→ Restart app với `npm start --clear`
