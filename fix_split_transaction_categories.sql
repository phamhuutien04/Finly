-- ============================================
-- FIX SPLIT TRANSACTION CATEGORIES
-- ============================================
-- Đảm bảo khi chia tiền với bạn bè, luôn có danh mục phù hợp

-- Tạo function để đảm bảo user có danh mục "Khác" cho cả income và expense
CREATE OR REPLACE FUNCTION ensure_other_categories(target_user_id UUID)
RETURNS void AS $$
BEGIN
    -- Tạo danh mục "Khác" cho expense nếu chưa có
    INSERT INTO categories (user_id, name, type, emoji, icon_preset_id, icon_uri)
    SELECT 
        target_user_id,
        'Khác',
        'expense',
        '📝',
        'other',
        'https://cdn-icons-png.flaticon.com/512/3135/3135700.png'
    WHERE NOT EXISTS (
        SELECT 1 FROM categories 
        WHERE user_id = target_user_id 
        AND name = 'Khác' 
        AND type = 'expense'
    );

    -- Tạo danh mục "Khác" cho income nếu chưa có
    INSERT INTO categories (user_id, name, type, emoji, icon_preset_id, icon_uri)
    SELECT 
        target_user_id,
        'Khác',
        'income',
        '📝',
        'other',
        'https://cdn-icons-png.flaticon.com/512/3135/3135700.png'
    WHERE NOT EXISTS (
        SELECT 1 FROM categories 
        WHERE user_id = target_user_id 
        AND name = 'Khác' 
        AND type = 'income'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cập nhật function handle_new_user để tạo danh mục "Khác"
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Tạo profile cho user
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
  
  -- Đảm bảo có danh mục "Khác"
  PERFORM ensure_other_categories(NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Tạo function để tìm hoặc tạo danh mục phù hợp cho split transaction
CREATE OR REPLACE FUNCTION get_or_create_category_for_split(
    target_user_id UUID,
    category_name TEXT,
    category_type TEXT,
    category_emoji TEXT DEFAULT '📝',
    category_icon_uri TEXT DEFAULT NULL,
    category_icon_preset_id TEXT DEFAULT 'other'
)
RETURNS BIGINT AS $$
DECLARE
    category_id BIGINT;
BEGIN
    -- Bước 1: Tìm danh mục cùng tên và type
    SELECT id INTO category_id
    FROM categories
    WHERE user_id = target_user_id
    AND name = category_name
    AND type = category_type
    LIMIT 1;

    IF category_id IS NOT NULL THEN
        RETURN category_id;
    END IF;

    -- Bước 2: Tạo danh mục mới với tên gốc
    BEGIN
        INSERT INTO categories (user_id, name, type, emoji, icon_uri, icon_preset_id)
        VALUES (target_user_id, category_name, category_type, category_emoji, category_icon_uri, category_icon_preset_id)
        RETURNING id INTO category_id;
        
        IF category_id IS NOT NULL THEN
            RETURN category_id;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Nếu lỗi, tiếp tục với fallback
        NULL;
    END;

    -- Bước 3: Fallback - tìm danh mục "Khác" cùng type
    SELECT id INTO category_id
    FROM categories
    WHERE user_id = target_user_id
    AND name = 'Khác'
    AND type = category_type
    LIMIT 1;

    IF category_id IS NOT NULL THEN
        RETURN category_id;
    END IF;

    -- Bước 4: Tạo danh mục "Khác" nếu chưa có
    BEGIN
        INSERT INTO categories (user_id, name, type, emoji, icon_uri, icon_preset_id)
        VALUES (target_user_id, 'Khác', category_type, '📝', 'https://cdn-icons-png.flaticon.com/512/3135/3135700.png', 'other')
        RETURNING id INTO category_id;
        
        RETURN category_id;
    EXCEPTION WHEN OTHERS THEN
        -- Nếu vẫn lỗi, trả về NULL
        RETURN NULL;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cấp quyền thực thi functions
GRANT EXECUTE ON FUNCTION ensure_other_categories(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_category_for_split(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- Tạo danh mục "Khác" cho tất cả user hiện tại
DO $$
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN 
        SELECT DISTINCT user_id FROM user_profiles
    LOOP
        PERFORM ensure_other_categories(user_record.user_id);
    END LOOP;
END $$;

-- Hoàn thành
SELECT 'Split transaction categories fix completed!' as status;