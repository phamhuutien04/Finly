-- ============================================
-- SỬA POLICY ĐỂ CHO PHÉP ADMIN UPDATE BÀI VIẾT
-- ============================================

-- Xóa policy cũ
DROP POLICY IF EXISTS "Users can update own posts" ON public.posts;

-- Tạo policy mới cho phép admin update bất kỳ bài viết nào
CREATE POLICY "Users can update own posts or admin can update any" ON public.posts
    FOR UPDATE USING (
        -- Chủ bài viết có thể update
        auth.uid() = user_id 
        OR 
        -- Admin có thể update bất kỳ bài viết nào
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND is_admin = true
        )
    ) WITH CHECK (
        -- Chủ bài viết có thể update
        auth.uid() = user_id 
        OR 
        -- Admin có thể update bất kỳ bài viết nào
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND is_admin = true
        )
    );

-- Kiểm tra xem tài khoản của bạn đã là admin chưa
SELECT user_id, email, display_name, is_admin 
FROM public.user_profiles 
WHERE is_admin = true;

-- Nếu chưa có admin nào, chạy lệnh này (thay email của bạn):
-- UPDATE public.user_profiles 
-- SET is_admin = true 
-- WHERE email = 'phamhuutien@admin.com';

SELECT '✅ POLICY UPDATED!' as status,
       'Admin can now update any post status' as message;
