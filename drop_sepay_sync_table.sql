-- Bước 1: Thêm cột sepay_transaction_id vào bảng transactions nếu chưa có
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS sepay_transaction_id TEXT;

-- Bước 2: Tạo index để tăng tốc độ query check trùng
CREATE INDEX IF NOT EXISTS idx_transactions_sepay_transaction_id 
ON public.transactions(sepay_transaction_id) 
WHERE sepay_transaction_id IS NOT NULL;

-- Bước 3: Tạo unique constraint để đảm bảo không trùng lặp
-- (Chỉ áp dụng cho các row có sepay_transaction_id không null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_sepay_transaction_id_unique 
ON public.transactions(user_id, sepay_transaction_id) 
WHERE sepay_transaction_id IS NOT NULL;

-- Bước 4: Drop bảng sepay_synced_transactions vì không cần thiết nữa
DROP TABLE IF EXISTS public.sepay_synced_transactions;
