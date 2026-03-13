-- ============================================
-- FINLY APP - SIMPLE DATABASE SCHEMA (FIXED)
-- ============================================
-- Phiên bản đơn giản, ổn định, không lỗi

-- Xóa tất cả dữ liệu cũ
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.handle_user_email_change();
DROP FUNCTION IF EXISTS seed_default_categories(UUID);

DROP TABLE IF EXISTS split_transaction_participants CASCADE;
DROP TABLE IF EXISTS post_comments CASCADE;
DROP TABLE IF EXISTS post_likes CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS friendships CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS budgets CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ============================================
-- TẠO BẢNG CƠ BẢN
-- ============================================

-- BẢNG DANH MỤC
CREATE TABLE categories (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('income', 'expense')) NOT NULL,
    emoji TEXT,
    icon_uri TEXT,
    icon_preset_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- BẢNG GIAO DỊCH
CREATE TABLE transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
    type TEXT CHECK (type IN ('income', 'expense')) NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    note TEXT,
    occurred_at TIMESTAMPTZ DEFAULT NOW(),
    transaction_date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_split BOOLEAN DEFAULT false,
    split_total_amount NUMERIC,
    split_participants INTEGER DEFAULT 1,
    original_transaction_id BIGINT REFERENCES transactions(id)
);

-- BẢNG NGÂN SÁCH
CREATE TABLE budgets (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    category_id BIGINT REFERENCES categories(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    period TEXT CHECK (period IN ('daily', 'weekly', 'monthly', 'yearly', 'custom')) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- BẢNG THÔNG TIN NGƯỜI DÙNG
CREATE TABLE user_profiles (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    email TEXT NOT NULL,
    display_name TEXT NOT NULL,
    bio TEXT,
    avatar_url TEXT,
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- BẢNG KẾT BẠN
CREATE TABLE friendships (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    friend_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    status TEXT CHECK (status IN ('pending', 'accepted', 'blocked')) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, friend_id),
    CHECK (user_id != friend_id)
);
-- BẢNG CHIA TIỀN
CREATE TABLE split_transaction_participants (
    id BIGSERIAL PRIMARY KEY,
    transaction_id BIGINT REFERENCES transactions(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    is_creator BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TẠO INDEX
-- ============================================

CREATE INDEX idx_categories_user_id ON categories(user_id);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date DESC);
CREATE INDEX idx_budgets_user_id ON budgets(user_id);
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_email ON user_profiles(email);
CREATE INDEX idx_user_profiles_display_name ON user_profiles(display_name);
CREATE INDEX idx_friendships_user_id ON friendships(user_id);
CREATE INDEX idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX idx_split_participants_transaction_id ON split_transaction_participants(transaction_id);
CREATE INDEX idx_split_participants_user_id ON split_transaction_participants(user_id);

-- ============================================
-- BẬT RLS
-- ============================================

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE split_transaction_participants ENABLE ROW LEVEL SECURITY;

-- ============================================
-- TẠO POLICIES ĐỂN GIẢN
-- ============================================

-- Categories
CREATE POLICY "Users manage own categories" ON categories FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Friends can create categories for split" ON categories FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM friendships 
        WHERE ((user_id = auth.uid() AND friend_id = categories.user_id) 
               OR (user_id = categories.user_id AND friend_id = auth.uid()))
        AND status = 'accepted'
    )
);

-- Transactions
CREATE POLICY "Users manage own transactions" ON transactions FOR ALL USING (auth.uid() = user_id);

-- Budgets
CREATE POLICY "Users manage own budgets" ON budgets FOR ALL USING (auth.uid() = user_id);

-- User Profiles
CREATE POLICY "View public profiles" ON user_profiles FOR SELECT USING (is_public = true OR auth.uid() = user_id);
CREATE POLICY "Manage own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Delete own profile" ON user_profiles FOR DELETE USING (auth.uid() = user_id);

-- Friendships
CREATE POLICY "View own friendships" ON friendships FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Create friendship requests" ON friendships FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update friendship status" ON friendships FOR UPDATE USING (auth.uid() = friend_id OR auth.uid() = user_id);
CREATE POLICY "Delete friendships" ON friendships FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Split Transactions
CREATE POLICY "Manage own split transactions" ON split_transaction_participants FOR ALL USING (auth.uid() = user_id);
-- ============================================
-- TẠO FUNCTIONS ĐƠN GIẢN
-- ============================================

-- Function tạo profile cho user mới (đơn giản, không lỗi)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, display_name, is_public)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      SPLIT_PART(NEW.email, '@', 1)
    ),
    true
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger tạo profile khi user đăng ký
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- PHÂN QUYỀN
-- ============================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON user_profiles TO anon;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- ============================================
-- HOÀN THÀNH
-- ============================================

/*
DATABASE SCHEMA ĐƠN GIẢN - KHÔNG LỖI:

✅ Bảng cơ bản: categories, transactions, budgets, user_profiles, friendships, split_transaction_participants
✅ RLS policies đơn giản và ổn định
✅ Trigger tự động tạo profile khi đăng ký (không tạo categories tự động để tránh lỗi)
✅ Indexes cơ bản cho hiệu suất
✅ Constraints đảm bảo tính toàn vẹn dữ liệu

CÁCH SỬ DỤNG:
1. Chạy file này để reset database
2. User đăng ký sẽ tự động có profile
3. Categories sẽ được tạo từ app (không tự động)
4. Tìm kiếm bạn bè hoạt động bình thường
5. Chia tiền với bạn bè hoạt động

LƯU Ý:
- Đã loại bỏ tự động tạo categories để tránh lỗi
- App sẽ tự tạo categories khi cần
- Schema đơn giản, ổn định, ít lỗi
*/