-- ============================================
-- THÊM CÁC CỘT CHO HỆ THỐNG DUYỆT BÀI
-- ============================================

BEGIN;

-- 1. Thêm cột is_admin vào user_profiles
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- 2. Thêm các cột moderation vào posts
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'));

ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS rejected_reason TEXT;

ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id);

ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- 3. Tạo index cho status
CREATE INDEX IF NOT EXISTS idx_posts_status ON public.posts(status);

-- 4. Cập nhật tất cả bài viết cũ thành 'approved'
UPDATE public.posts SET status = 'approved' WHERE status IS NULL;

COMMIT;

SELECT '✅ MODERATION COLUMNS ADDED!' as status;
