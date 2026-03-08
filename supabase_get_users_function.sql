-- ===================================
-- SQL Script để setup quản lý users
-- Chạy trong Supabase SQL Editor
-- ===================================

-- 1. Tạo function để lấy tất cả users từ auth.users
CREATE OR REPLACE FUNCTION public.get_all_users()
RETURNS TABLE (
  id uuid,
  email text,
  phone text,
  display_name text,
  provider text,
  provider_type text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email::text,
    u.phone::text,
    COALESCE(
      u.raw_user_meta_data->>'display_name',
      u.raw_user_meta_data->>'full_name',
      ''
    )::text as display_name,
    COALESCE(u.raw_app_meta_data->>'provider', 'email')::text as provider,
    COALESCE(
      (u.raw_app_meta_data->'providers'->>0),
      'Email'
    )::text as provider_type,
    u.created_at
  FROM auth.users u
  ORDER BY u.created_at DESC;
END;
$$;

-- 2. Tạo function để update user metadata
CREATE OR REPLACE FUNCTION public.update_user_metadata(
  user_id uuid,
  new_display_name text,
  new_phone text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  -- Update user metadata
  UPDATE auth.users
  SET 
    raw_user_meta_data = raw_user_meta_data || 
      jsonb_build_object('display_name', new_display_name),
    phone = new_phone,
    updated_at = now()
  WHERE id = user_id;
  
  -- Return success
  result := json_build_object(
    'success', true,
    'message', 'User updated successfully'
  );
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    result := json_build_object(
      'success', false,
      'message', SQLERRM
    );
    RETURN result;
END;
$$;

-- 3. Grant permissions (optional - nếu cần)
-- GRANT EXECUTE ON FUNCTION public.get_all_users() TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.update_user_metadata(uuid, text, text) TO authenticated;

-- 4. Test functions
-- SELECT * FROM public.get_all_users();
-- SELECT public.update_user_metadata('user-id-here', 'New Name', '0123456789');
