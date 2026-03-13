-- Thêm cột is_read vào bảng split_transaction_participants để lưu trạng thái đã đọc
ALTER TABLE split_transaction_participants 
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

-- Thêm cột is_read vào bảng friendships để lưu trạng thái đã đọc lời mời kết bạn
ALTER TABLE friendships 
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

-- Tạo index để tối ưu query
CREATE INDEX IF NOT EXISTS idx_split_participants_read ON split_transaction_participants(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_friendships_read ON friendships(friend_id, is_read, status);

SELECT 'Notification read status columns added successfully!' as status;