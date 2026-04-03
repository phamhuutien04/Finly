-- ============================================
-- THÊM HỆ THỐNG BÀI VIẾT CÁ NHÂN
-- ============================================
-- Posts, likes, comments (với nested comments), shares

BEGIN;

-- ============================================
-- TẠO BẢNG POSTS
-- ============================================

CREATE TABLE IF NOT EXISTS public.posts (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    images TEXT[], -- Array of image URLs
    visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'friends', 'private')),
    likes_count INTEGER NOT NULL DEFAULT 0,
    comments_count INTEGER NOT NULL DEFAULT 0,
    shares_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- TẠO BẢNG POST_LIKES
-- ============================================

CREATE TABLE IF NOT EXISTS public.post_likes (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

-- ============================================
-- TẠO BẢNG POST_COMMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS public.post_comments (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    parent_comment_id BIGINT REFERENCES public.post_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    likes_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- TẠO BẢNG COMMENT_LIKES
-- ============================================

CREATE TABLE IF NOT EXISTS public.comment_likes (
    id BIGSERIAL PRIMARY KEY,
    comment_id BIGINT NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(comment_id, user_id)
);

-- ============================================
-- TẠO BẢNG POST_SHARES
-- ============================================

CREATE TABLE IF NOT EXISTS public.post_shares (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    shared_to TEXT NOT NULL CHECK (shared_to IN ('profile', 'external')),
    platform TEXT, -- 'facebook', 'twitter', 'instagram', etc.
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- TẠO INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_visibility ON public.posts(visibility);

CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON public.post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON public.post_likes(user_id);

CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON public.post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_user_id ON public.post_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_parent_id ON public.post_comments(parent_comment_id);

CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id ON public.comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user_id ON public.comment_likes(user_id);

CREATE INDEX IF NOT EXISTS idx_post_shares_post_id ON public.post_shares(post_id);
CREATE INDEX IF NOT EXISTS idx_post_shares_user_id ON public.post_shares(user_id);

-- ============================================
-- BẬT RLS
-- ============================================

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_shares ENABLE ROW LEVEL SECURITY;

-- ============================================
-- TẠO POLICIES
-- ============================================

-- Posts Policies
CREATE POLICY "Users can view public posts" ON public.posts
    FOR SELECT USING (
        visibility = 'public' OR
        user_id = auth.uid() OR
        (visibility = 'friends' AND EXISTS (
            SELECT 1 FROM public.friendships
            WHERE (user_id = posts.user_id AND friend_id = auth.uid() AND status = 'accepted')
            OR (friend_id = posts.user_id AND user_id = auth.uid() AND status = 'accepted')
        ))
    );

CREATE POLICY "Users can create own posts" ON public.posts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts" ON public.posts
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts" ON public.posts
    FOR DELETE USING (auth.uid() = user_id);

-- Post Likes Policies
CREATE POLICY "Anyone can view post likes" ON public.post_likes
    FOR SELECT USING (true);

CREATE POLICY "Users can like posts" ON public.post_likes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike posts" ON public.post_likes
    FOR DELETE USING (auth.uid() = user_id);

-- Post Comments Policies
CREATE POLICY "Anyone can view comments on visible posts" ON public.post_comments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.posts
            WHERE id = post_comments.post_id
            AND (
                visibility = 'public' OR
                user_id = auth.uid() OR
                (visibility = 'friends' AND EXISTS (
                    SELECT 1 FROM public.friendships
                    WHERE (user_id = posts.user_id AND friend_id = auth.uid() AND status = 'accepted')
                    OR (friend_id = posts.user_id AND user_id = auth.uid() AND status = 'accepted')
                ))
            )
        )
    );

CREATE POLICY "Users can create comments" ON public.post_comments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments" ON public.post_comments
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON public.post_comments
    FOR DELETE USING (auth.uid() = user_id);

-- Comment Likes Policies
CREATE POLICY "Anyone can view comment likes" ON public.comment_likes
    FOR SELECT USING (true);

CREATE POLICY "Users can like comments" ON public.comment_likes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike comments" ON public.comment_likes
    FOR DELETE USING (auth.uid() = user_id);

-- Post Shares Policies
CREATE POLICY "Anyone can view shares" ON public.post_shares
    FOR SELECT USING (true);

CREATE POLICY "Users can share posts" ON public.post_shares
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- TẠO FUNCTIONS
-- ============================================

-- Function cập nhật likes_count cho posts
CREATE OR REPLACE FUNCTION public.update_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function cập nhật comments_count cho posts
CREATE OR REPLACE FUNCTION public.update_post_comments_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function cập nhật likes_count cho comments
CREATE OR REPLACE FUNCTION public.update_comment_likes_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.post_comments SET likes_count = likes_count + 1 WHERE id = NEW.comment_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.post_comments SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.comment_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function cập nhật shares_count cho posts
CREATE OR REPLACE FUNCTION public.update_post_shares_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.posts SET shares_count = shares_count + 1 WHERE id = NEW.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TẠO TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS update_post_likes_count_trigger ON public.post_likes;
CREATE TRIGGER update_post_likes_count_trigger
    AFTER INSERT OR DELETE ON public.post_likes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_post_likes_count();

DROP TRIGGER IF EXISTS update_post_comments_count_trigger ON public.post_comments;
CREATE TRIGGER update_post_comments_count_trigger
    AFTER INSERT OR DELETE ON public.post_comments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_post_comments_count();

DROP TRIGGER IF EXISTS update_comment_likes_count_trigger ON public.comment_likes;
CREATE TRIGGER update_comment_likes_count_trigger
    AFTER INSERT OR DELETE ON public.comment_likes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_comment_likes_count();

DROP TRIGGER IF EXISTS update_post_shares_count_trigger ON public.post_shares;
CREATE TRIGGER update_post_shares_count_trigger
    AFTER INSERT ON public.post_shares
    FOR EACH ROW
    EXECUTE FUNCTION public.update_post_shares_count();

-- ============================================
-- BẬT REALTIME
-- ============================================

DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.post_likes;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comments;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_likes;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.post_shares;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;

-- ============================================
-- PHÂN QUYỀN
-- ============================================

GRANT ALL ON public.posts TO authenticated;
GRANT ALL ON public.post_likes TO authenticated;
GRANT ALL ON public.post_comments TO authenticated;
GRANT ALL ON public.comment_likes TO authenticated;
GRANT ALL ON public.post_shares TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

COMMIT;

-- ============================================
-- HOÀN THÀNH
-- ============================================

SELECT 
    '✅ POSTS SYSTEM CREATED SUCCESSFULLY!' as status,
    'Tables: posts, post_likes, post_comments, comment_likes, post_shares' as tables,
    'Features: Like posts/comments, nested comments, share to profile/social, visibility control' as features;
