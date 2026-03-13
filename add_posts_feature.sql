-- ============================================
-- THÊM TÍNH NĂNG ĐĂNG BÀI VIẾT
-- ============================================

-- BẢNG BÀI VIẾT
CREATE TABLE IF NOT EXISTS posts (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT,
    visibility TEXT CHECK (visibility IN ('public', 'friends', 'private')) DEFAULT 'public',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- BẢNG LIKES
CREATE TABLE IF NOT EXISTS post_likes (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

-- BẢNG COMMENTS
CREATE TABLE IF NOT EXISTS post_comments (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TẠO INDEX
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON post_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_user_id ON post_comments(user_id);

-- BẬT RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

-- POLICIES CHO POSTS
CREATE POLICY "View public posts" ON posts
    FOR SELECT USING (
        visibility = 'public' OR
        auth.uid() = user_id OR
        (visibility = 'friends' AND EXISTS (
            SELECT 1 FROM friendships 
            WHERE ((user_id = auth.uid() AND friend_id = posts.user_id) 
                OR (user_id = posts.user_id AND friend_id = auth.uid()))
            AND status = 'accepted'
        ))
    );

CREATE POLICY "Create own posts" ON posts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Update own posts" ON posts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Delete own posts" ON posts
    FOR DELETE USING (auth.uid() = user_id);

-- POLICIES CHO POST_LIKES
CREATE POLICY "View all likes" ON post_likes
    FOR SELECT USING (true);

CREATE POLICY "Create own likes" ON post_likes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Delete own likes" ON post_likes
    FOR DELETE USING (auth.uid() = user_id);

-- POLICIES CHO POST_COMMENTS
CREATE POLICY "View comments on visible posts" ON post_comments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM posts 
            WHERE id = post_comments.post_id 
            AND (
                visibility = 'public' OR
                user_id = auth.uid() OR
                (visibility = 'friends' AND EXISTS (
                    SELECT 1 FROM friendships 
                    WHERE ((user_id = auth.uid() AND friend_id = posts.user_id) 
                        OR (user_id = posts.user_id AND friend_id = auth.uid()))
                    AND status = 'accepted'
                ))
            )
        )
    );

CREATE POLICY "Create comments on visible posts" ON post_comments
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM posts 
            WHERE id = post_comments.post_id 
            AND (
                visibility = 'public' OR
                user_id = auth.uid() OR
                (visibility = 'friends' AND EXISTS (
                    SELECT 1 FROM friendships 
                    WHERE ((user_id = auth.uid() AND friend_id = posts.user_id) 
                        OR (user_id = posts.user_id AND friend_id = auth.uid()))
                    AND status = 'accepted'
                ))
            )
        )
    );

CREATE POLICY "Update own comments" ON post_comments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Delete own comments" ON post_comments
    FOR DELETE USING (auth.uid() = user_id);

-- BẬT REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE posts;
ALTER PUBLICATION supabase_realtime ADD TABLE post_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE post_comments;

-- PHÂN QUYỀN
GRANT ALL ON posts TO authenticated;
GRANT ALL ON post_likes TO authenticated;
GRANT ALL ON post_comments TO authenticated;
GRANT ALL ON SEQUENCE posts_id_seq TO authenticated;
GRANT ALL ON SEQUENCE post_likes_id_seq TO authenticated;
GRANT ALL ON SEQUENCE post_comments_id_seq TO authenticated;

-- Phân quyền cho realtime
GRANT SELECT ON posts TO anon, authenticated;
GRANT SELECT ON post_likes TO anon, authenticated;
GRANT SELECT ON post_comments TO anon, authenticated;

SELECT 'Posts feature tables created successfully!' as status;