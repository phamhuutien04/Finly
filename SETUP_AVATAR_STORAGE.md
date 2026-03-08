# Hướng dẫn Setup Storage cho Avatar - ĐƠN GIẢN

## Bước 1: Tạo Storage Bucket trong Supabase

1. Mở Supabase Dashboard
2. Vào **Storage** (menu bên trái)
3. Click **New bucket**
4. Điền thông tin:
   - **Name**: `avatars`
   - **Public bucket**: ✅ BẬT (quan trọng!)
   - **File size limit**: 5 MB
   - **Allowed MIME types**: `image/*`
5. Click **Create bucket**

## Bước 2: TẮT RLS cho bucket avatars (Cách đơn giản nhất)

### Cách 1: Tắt RLS qua UI
1. Vào **Storage** → Click vào bucket `avatars`
2. Click tab **Policies**
3. Tìm toggle **"Enable RLS"** và TẮT nó đi

### Cách 2: Tắt RLS qua SQL
Vào **SQL Editor** và chạy:

```sql
-- Tắt RLS cho bucket avatars
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
```

## Bước 3: (Tùy chọn) Nếu muốn giữ RLS, dùng policy đơn giản

Nếu bạn muốn bật RLS để bảo mật, chạy SQL này:

```sql
-- Bật RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy 1: Cho phép mọi người upload vào bucket avatars
CREATE POLICY "Anyone can upload to avatars"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'avatars');

-- Policy 2: Cho phép mọi người xem
CREATE POLICY "Anyone can view avatars"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Policy 3: Cho phép mọi người update
CREATE POLICY "Anyone can update avatars"
ON storage.objects
FOR UPDATE
TO public
USING (bucket_id = 'avatars');

-- Policy 4: Cho phép mọi người delete
CREATE POLICY "Anyone can delete avatars"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id = 'avatars');
```

## Bước 4: Test

1. Mở app → Settings
2. Click vào avatar
3. Chọn ảnh
4. Upload thành công!

## Lưu ý

- **Tên file**: `{user_id}.jpg` (đơn giản, dễ quản lý)
- **Upsert**: Tự động ghi đè ảnh cũ
- **Cache busting**: Thêm `?t=timestamp` để tránh cache
- **Public bucket**: Phải bật để ảnh hiển thị được

## Troubleshooting

### Lỗi 403 Unauthorized
→ Chưa tắt RLS hoặc chưa setup policy
→ **Giải pháp**: Tắt RLS (cách đơn giản nhất)

### Lỗi "Bucket not found"
→ Chưa tạo bucket `avatars`
→ **Giải pháp**: Tạo bucket theo Bước 1

### Ảnh không hiển thị
→ Bucket chưa public
→ **Giải pháp**: Bật "Public bucket" khi tạo

## Khuyến nghị

Để đơn giản nhất: **TẮT RLS** cho bucket `avatars` vì:
- Ảnh avatar là public nên không cần bảo mật
- Tránh lỗi phức tạp với policies
- Dễ debug và maintain
