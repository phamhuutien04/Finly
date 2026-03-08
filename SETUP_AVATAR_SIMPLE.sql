-- ===================================
-- SETUP AVATAR STORAGE - CÁCH ĐƠN GIẢN
-- Copy và chạy trong Supabase SQL Editor
-- ===================================

-- Tạo policy cho phép public access vào bucket avatars
-- Nếu báo lỗi "already exists", bỏ qua và dùng cách UI

CREATE POLICY "Public Access to Avatars"
ON storage.objects
FOR ALL
TO public
USING (bucket_id = 'avatars')
WITH CHECK (bucket_id = 'avatars');
