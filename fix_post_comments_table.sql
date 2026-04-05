-- ============================================
-- SỬA BẢNG POST_COMMENTS ĐỂ HỖ TRỢ REPLY
-- ============================================

-- Thêm cột parent_comment_id nếu chưa có
ALTER TABLE public.post_comments 
ADD COLUMN IF NOT EXISTS parent_comment_id INTEGER REFERENCES public.post_comments(id) ON DELETE CASCADE;

-- Tạo index cho parent_comment_id
CREATE INDEX IF NOT EXISTS idx_post_comments_parent ON public.post_comments(parent_comment_id);

SELECT '✅ POST_COMMENTS TABLE FIXED!' as status;
