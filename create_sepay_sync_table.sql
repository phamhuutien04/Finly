-- Xóa bảng cũ nếu có
DROP TABLE IF EXISTS sepay_synced_transactions CASCADE;

-- Tạo bảng để track các Sepay transaction đã sync
CREATE TABLE sepay_synced_transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  sepay_transaction_id TEXT NOT NULL,
  transaction_id BIGINT REFERENCES transactions(id) ON DELETE CASCADE,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, sepay_transaction_id)
);

-- Index để tìm kiếm nhanh
CREATE INDEX idx_sepay_synced_user_sepay_id ON sepay_synced_transactions(user_id, sepay_transaction_id);

-- TẮT RLS
ALTER TABLE sepay_synced_transactions DISABLE ROW LEVEL SECURITY;

-- Grant permissions cho authenticated users
GRANT ALL ON sepay_synced_transactions TO authenticated;
GRANT ALL ON sepay_synced_transactions TO anon;
GRANT USAGE, SELECT ON SEQUENCE sepay_synced_transactions_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE sepay_synced_transactions_id_seq TO anon;
