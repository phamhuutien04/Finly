-- ACCOUNTS
CREATE TABLE accounts (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT,
    balance NUMERIC DEFAULT 0,
    currency TEXT DEFAULT 'VND',
    avatar_uri TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CATEGORIES
CREATE TABLE categories (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT,
    emoji TEXT,
    icon_uri TEXT,
    icon_preset_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TRANSACTIONS
CREATE TABLE transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
    category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL, -- Allow NULL and set to NULL if category deleted
    type TEXT,
    amount NUMERIC NOT NULL,
    note TEXT,
    occurred_at TIMESTAMPTZ,
    transaction_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Split transaction columns
    is_split BOOLEAN DEFAULT false,
    split_total_amount NUMERIC,
    split_participants INTEGER DEFAULT 1,
    original_transaction_id BIGINT REFERENCES transactions(id)
);

-- BUDGETS
CREATE TABLE budgets (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id BIGINT REFERENCES categories(id),
    amount NUMERIC,
    period TEXT,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================
-- SOCIAL FEATURES
-- ============================================

-- USER PROFILES (Extended user information)
CREATE TABLE user_profiles (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    email TEXT,
    display_name TEXT,
    bio TEXT,
    avatar_url TEXT,
    cover_url TEXT,
    location TEXT,
    website TEXT,
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FRIENDSHIPS (Friend connections)
CREATE TABLE friendships (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    friend_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, friend_id)
);

-- POSTS (Social posts/updates)
CREATE TABLE posts (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    image_url TEXT,
    visibility TEXT CHECK (visibility IN ('public', 'friends', 'private')) DEFAULT 'friends',
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- POST LIKES
CREATE TABLE post_likes (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

-- POST COMMENTS
CREATE TABLE post_comments (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- NOTIFICATIONS
CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('friend_request', 'friend_accepted', 'post_like', 'post_comment', 'mention')),
    from_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    reference_id BIGINT,
    content TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES for better performance
CREATE INDEX idx_friendships_user_id ON friendships(user_id);
CREATE INDEX idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX idx_friendships_status ON friendships(status);
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX idx_post_comments_post_id ON post_comments(post_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_user_profiles_email ON user_profiles(email);
CREATE INDEX idx_user_profiles_display_name ON user_profiles(display_name);

-- RLS (Row Level Security) Policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- User Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone" ON user_profiles
    FOR SELECT USING (is_public = true);

CREATE POLICY "Users can view their own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Friendships Policies
CREATE POLICY "Users can view their own friendships" ON friendships
    FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can create friendship requests" ON friendships
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their friendship status" ON friendships
    FOR UPDATE USING (auth.uid() = friend_id);

CREATE POLICY "Users can delete their friendships" ON friendships
    FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Posts Policies
CREATE POLICY "Public posts are viewable by everyone" ON posts
    FOR SELECT USING (visibility = 'public');

CREATE POLICY "Users can view their own posts" ON posts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view friends' posts" ON posts
    FOR SELECT USING (
        visibility = 'friends' AND 
        EXISTS (
            SELECT 1 FROM friendships 
            WHERE (user_id = auth.uid() AND friend_id = posts.user_id AND status = 'accepted')
            OR (friend_id = auth.uid() AND user_id = posts.user_id AND status = 'accepted')
        )
    );

CREATE POLICY "Users can create their own posts" ON posts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts" ON posts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts" ON posts
    FOR DELETE USING (auth.uid() = user_id);

-- Post Likes Policies
CREATE POLICY "Users can view all post likes" ON post_likes
    FOR SELECT USING (true);

CREATE POLICY "Users can like posts" ON post_likes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike posts" ON post_likes
    FOR DELETE USING (auth.uid() = user_id);

-- Post Comments Policies
CREATE POLICY "Users can view comments on visible posts" ON post_comments
    FOR SELECT USING (true);

CREATE POLICY "Users can create comments" ON post_comments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments" ON post_comments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON post_comments
    FOR DELETE USING (auth.uid() = user_id);

-- Notifications Policies
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications" ON notifications
    FOR INSERT WITH CHECK (true);


-- ============================================
-- TRIGGERS & FUNCTIONS
-- ============================================

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, display_name, is_public)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', SPLIT_PART(NEW.email, '@', 1)),
    true
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to sync email changes
CREATE OR REPLACE FUNCTION public.handle_user_email_change()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.user_profiles
  SET email = NEW.email,
      updated_at = NOW()
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to sync email changes
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.handle_user_email_change();


-- ============================================
-- SPLIT TRANSACTIONS SUPPORT
-- ============================================

-- Create split_transaction_participants table
CREATE TABLE IF NOT EXISTS split_transaction_participants (
    id BIGSERIAL PRIMARY KEY,
    transaction_id BIGINT REFERENCES transactions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    is_creator BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_split_participants_transaction_id ON split_transaction_participants(transaction_id);
CREATE INDEX IF NOT EXISTS idx_split_participants_user_id ON split_transaction_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_is_split ON transactions(is_split);
CREATE INDEX IF NOT EXISTS idx_transactions_original_id ON transactions(original_transaction_id);

-- RLS policies for split_transaction_participants
ALTER TABLE split_transaction_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own split transactions" ON split_transaction_participants
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create split transactions" ON split_transaction_participants
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own split transactions" ON split_transaction_participants
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own split transactions" ON split_transaction_participants
    FOR DELETE USING (auth.uid() = user_id);

</content>
</file></function_results>

<function_calls>
<invoke strReplace>
<parameter name="newStr">  EXECUTE FUNCTION public.handle_user_email_change();


-- ============================================
-- SPLIT TRANSACTIONS SUPPORT
-- ============================================

-- Create split_transaction_participants table
CREATE TABLE IF NOT EXISTS split_transaction_participants (
    id BIGSERIAL PRIMARY KEY,
    transaction_id BIGINT REFERENCES transactions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    is_creator BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_split_participants_transaction_id ON split_transaction_participants(transaction_id);
CREATE INDEX IF NOT EXISTS idx_split_participants_user_id ON split_transaction_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_is_split ON transactions(is_split);
CREATE INDEX IF NOT EXISTS idx_transactions_original_id ON transactions(original_transaction_id);

-- RLS policies for split_transaction_participants
ALTER TABLE split_transaction_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own split transactions" ON split_transaction_participants
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create split transactions" ON split_transaction_participants
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own split transactions" ON split_transaction_participants
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own split transactions" ON split_transaction_participants
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- ADDITIONAL POLICIES FOR SPLIT TRANSACTIONS
-- ============================================

-- Ensure categories table has RLS enabled
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Allow users to create categories (needed for split transactions)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'categories' 
        AND policyname = 'Users can create their own categories'
    ) THEN
        CREATE POLICY "Users can create their own categories" ON categories
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- Special policy: Allow creating categories for friends in split transactions
-- This allows the current user to create categories for their friends when splitting bills
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'categories' 
        AND policyname = 'Allow creating categories for friends in split transactions'
    ) THEN
        CREATE POLICY "Allow creating categories for friends in split transactions" ON categories
            FOR INSERT WITH CHECK (
                -- Allow if the target user_id is a friend of the current user
                EXISTS (
                    SELECT 1 FROM friendships 
                    WHERE (
                        (user_id = auth.uid() AND friend_id = categories.user_id AND status = 'accepted')
                        OR 
                        (user_id = categories.user_id AND friend_id = auth.uid() AND status = 'accepted')
                    )
                )
            );
    END IF;
END $$;

-- Allow users to read their own categories
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'categories' 
        AND policyname = 'Users can view their own categories'
    ) THEN
        CREATE POLICY "Users can view their own categories" ON categories
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
END $$;

-- Allow users to update their own categories
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'categories' 
        AND policyname = 'Users can update their own categories'
    ) THEN
        CREATE POLICY "Users can update their own categories" ON categories
            FOR UPDATE USING (auth.uid() = user_id);
    END IF;
END $$;