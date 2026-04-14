-- Migration: Thêm cột Sepay API key vào bảng user_profiles
-- Tạo ngày: 2026-04-14

-- Thêm 2 cột mới vào bảng user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS sepay_api_key TEXT,
ADD COLUMN IF NOT EXISTS sepay_key_created_at TIMESTAMPTZ;

-- Tạo index cho sepay_api_key để tìm kiếm nhanh hơn (nếu cần)
CREATE INDEX IF NOT EXISTS idx_user_profiles_sepay_key ON public.user_profiles(sepay_api_key) WHERE sepay_api_key IS NOT NULL;

-- Comment mô tả các cột
COMMENT ON COLUMN public.user_profiles.sepay_api_key IS 'API key từ Sepay để tự động đồng bộ giao dịch ngân hàng';
COMMENT ON COLUMN public.user_profiles.sepay_key_created_at IS 'Thời điểm tạo/cập nhật Sepay API key';

-- Tạo function để tự động cập nhật thời gian khi sepay_api_key thay đổi
CREATE OR REPLACE FUNCTION public.update_sepay_key_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- Chỉ cập nhật timestamp khi sepay_api_key thay đổi
  IF NEW.sepay_api_key IS DISTINCT FROM OLD.sepay_api_key THEN
    -- Nếu key mới không null, cập nhật timestamp
    IF NEW.sepay_api_key IS NOT NULL THEN
      NEW.sepay_key_created_at = NOW();
    ELSE
      -- Nếu key bị xoá (set null), xoá luôn timestamp
      NEW.sepay_key_created_at = NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Tạo trigger để tự động gọi function trên
DROP TRIGGER IF EXISTS trigger_update_sepay_timestamp ON public.user_profiles;
CREATE TRIGGER trigger_update_sepay_timestamp
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_sepay_key_timestamp();

-- Cập nhật timestamp cho các key đã tồn tại (nếu có)
UPDATE public.user_profiles
SET sepay_key_created_at = NOW()
WHERE sepay_api_key IS NOT NULL AND sepay_key_created_at IS NULL;

-- Kiểm tra kết quả
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'user_profiles'
  AND column_name IN ('sepay_api_key', 'sepay_key_created_at');

-- Kiểm tra trigger đã được tạo
SELECT trigger_name, event_manipulation, event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_update_sepay_timestamp';
