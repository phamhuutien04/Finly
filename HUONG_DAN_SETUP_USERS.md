# Hướng dẫn Setup Quản lý Users - Đa nền tảng

## ✅ Tính năng
- ✅ Lấy danh sách users từ Supabase Auth
- ✅ Chỉnh sửa thông tin (tên hiển thị, số điện thoại) trên WEB và MOBILE
- ✅ Xuất file CSV/Excel trên WEB và MOBILE
- ✅ Hoạt động đa nền tảng (Web, iOS, Android)

---

## 📋 Bước 1: Setup Supabase

### 1.1. Mở Supabase Dashboard
1. Truy cập https://supabase.com
2. Chọn project của bạn
3. Vào **SQL Editor**

### 1.2. Chạy SQL Script
Copy toàn bộ nội dung file `supabase_get_users_function.sql` và paste vào SQL Editor, sau đó click **Run**.

Script này sẽ tạo 2 functions:
- `get_all_users()` - Lấy danh sách tất cả users
- `update_user_metadata()` - Cập nhật thông tin user

### 1.3. Kiểm tra
Chạy lệnh sau để test:

```sql
-- Xem tất cả users
SELECT * FROM public.get_all_users();

-- Test update (thay user-id bằng ID thật)
SELECT public.update_user_metadata(
  'user-id-here'::uuid, 
  'Tên mới', 
  '0123456789'
);
```

---

## 📱 Bước 2: Test trên App

### 2.1. Khởi động app
```bash
npm start
```

### 2.2. Mở Settings
1. Vào tab **Settings** (Cài đặt)
2. Scroll xuống phần **"Dữ liệu"**
3. Click **"Quản lý người dùng"**

### 2.3. Xem danh sách users
- Danh sách users sẽ được load từ Supabase
- Hiển thị: UID, Email, Tên, Phone, Provider

---

## ✏️ Bước 3: Chỉnh sửa thông tin

### Trên WEB:
1. Click nút **"Sửa"** bên cạnh user
2. Nhập **tên hiển thị** trong prompt đầu tiên
3. Nhập **số điện thoại** trong prompt thứ hai
4. Thông tin sẽ được cập nhật vào Supabase ngay lập tức
5. Thông báo "Đã cập nhật thông tin người dùng thành công!"

### Trên MOBILE (iOS/Android):
1. Click nút **"Sửa"** bên cạnh user
2. Modal hiện ra với form nhập liệu
3. Nhập **tên hiển thị** và **số điện thoại**
4. Click nút **"Lưu"**
5. Thông báo "Đã cập nhật thông tin người dùng"

---

## 📊 Bước 4: Xuất Excel/CSV

### Trên WEB:
1. Click nút **"Xuất Excel"** ở góc trên
2. File CSV sẽ tự động download về máy
3. Tên file: `users_[timestamp].csv`
4. Mở bằng Excel, Google Sheets, hoặc text editor

### Trên MOBILE:
1. Click nút **"Xuất Excel"**
2. Xem preview dữ liệu CSV
3. (Nếu cần lưu file, cài thêm expo-file-system và expo-sharing)

### Format CSV:
```csv
UID,Display Name,Email,Phone,Provider,Provider Type
"uuid-1","Tên 1","email1@gmail.com","0123456789","email","Email"
"uuid-2","Tên 2","email2@gmail.com","","email","Email"
```

---

## 🔧 Troubleshooting

### ❌ Lỗi: "Không thể tải danh sách người dùng"
**Nguyên nhân:** Chưa chạy SQL script

**Giải pháp:**
1. Mở Supabase SQL Editor
2. Chạy lại file `supabase_get_users_function.sql`
3. Kiểm tra: `SELECT * FROM public.get_all_users();`

---

### ❌ Lỗi: "Không thể cập nhật"
**Nguyên nhân:** Function chưa có quyền thực thi

**Giải pháp:**
```sql
GRANT EXECUTE ON FUNCTION public.update_user_metadata(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_users() TO authenticated;
```

---

### ❌ Không thấy dữ liệu
**Kiểm tra:**
1. Mở Console (F12 trên web)
2. Xem tab Console có lỗi gì không
3. Kiểm tra Network tab xem API call có thành công không

**Debug:**
```javascript
// Thêm vào fetchUsers() để debug
console.log('Fetching users...');
const { data, error } = await supabase.rpc('get_all_users');
console.log('Data:', data);
console.log('Error:', error);
```

---

### ❌ Trên web không download được file CSV
**Nguyên nhân:** Browser chặn download

**Giải pháp:**
1. Cho phép popup/download trong browser settings
2. Hoặc copy dữ liệu từ alert và paste vào Excel

---

## 🚀 Nâng cao

### Thêm quyền Admin
Nếu muốn chỉ admin mới xem/sửa được:

```sql
-- Thêm role check vào function
CREATE OR REPLACE FUNCTION public.get_all_users()
RETURNS TABLE (...)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND raw_user_meta_data->>'role' = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Admin only';
  END IF;
  
  RETURN QUERY
  SELECT ...
END;
$$;

-- Set admin role
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"role": "admin"}'::jsonb
WHERE email = 'admin@example.com';
```

### Thêm cột mới
Nếu muốn thêm cột khác (ví dụ: address):

1. Sửa function `get_all_users()`:
```sql
-- Thêm vào SELECT
u.raw_user_meta_data->>'address' as address
```

2. Sửa function `update_user_metadata()`:
```sql
-- Thêm parameter
new_address text

-- Thêm vào UPDATE
raw_user_meta_data = raw_user_meta_data || 
  jsonb_build_object(
    'display_name', new_display_name,
    'address', new_address
  )
```

3. Sửa code TypeScript:
```typescript
type User = {
  // ... existing fields
  address?: string;
};
```

---

## 📞 Hỗ trợ

Nếu gặp vấn đề:
1. Kiểm tra Console log
2. Kiểm tra Supabase logs
3. Đảm bảo đã chạy SQL script
4. Kiểm tra network requests trong DevTools

---

## ✨ Hoàn thành!

Bây giờ bạn có thể:
- ✅ Xem danh sách users từ Supabase
- ✅ Chỉnh sửa thông tin trên web (dùng prompt)
- ✅ Chỉnh sửa thông tin trên mobile (dùng modal)
- ✅ Xuất file CSV trên web (auto download)
- ✅ Xuất file CSV trên mobile (preview)
