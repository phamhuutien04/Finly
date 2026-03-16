-- Tạo bảng money_requests để lưu trữ các yêu cầu đòi tiền
CREATE TABLE IF NOT EXISTS money_requests (
  id BIGSERIAL PRIMARY KEY,
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- người đòi tiền
  payer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- người được yêu cầu trả tiền
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  reason TEXT, -- lý do đòi tiền
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'rejected', 'cancelled')),
  conversation_id BIGINT REFERENCES conversations(id) ON DELETE CASCADE,
  message_id BIGINT REFERENCES messages(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tạo index cho hiệu suất
CREATE INDEX IF NOT EXISTS idx_money_requests_requester ON money_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_money_requests_payer ON money_requests(payer_id);
CREATE INDEX IF NOT EXISTS idx_money_requests_conversation ON money_requests(conversation_id);
CREATE INDEX IF NOT EXISTS idx_money_requests_status ON money_requests(status);

-- Thêm cột message_type vào bảng messages nếu chưa có
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'money_request', 'image', 'file'));

-- Thêm cột request_id vào messages để liên kết với money_requests
ALTER TABLE messages ADD COLUMN IF NOT EXISTS request_id BIGINT REFERENCES money_requests(id) ON DELETE SET NULL;

-- RLS Policies cho money_requests
ALTER TABLE money_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view requests they are involved in
CREATE POLICY "Users can view their money requests" ON money_requests
  FOR SELECT USING (
    auth.uid() = requester_id OR 
    auth.uid() = payer_id
  );

-- Policy: Users can create requests as requester
CREATE POLICY "Users can create money requests" ON money_requests
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

-- Policy: Users can update requests they are involved in
CREATE POLICY "Users can update their money requests" ON money_requests
  FOR UPDATE USING (
    auth.uid() = requester_id OR 
    auth.uid() = payer_id
  );

-- Function để tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION update_money_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger để tự động cập nhật updated_at
DROP TRIGGER IF EXISTS update_money_requests_updated_at_trigger ON money_requests;
CREATE TRIGGER update_money_requests_updated_at_trigger
  BEFORE UPDATE ON money_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_money_requests_updated_at();

-- Function để tạo money request message
CREATE OR REPLACE FUNCTION create_money_request_message(
  p_requester_id UUID,
  p_payer_id UUID,
  p_conversation_id BIGINT,
  p_amount DECIMAL,
  p_reason TEXT DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
  v_request_id BIGINT;
  v_message_id BIGINT;
  v_message_content TEXT;
BEGIN
  -- Tạo money request record
  INSERT INTO money_requests (requester_id, payer_id, conversation_id, amount, reason)
  VALUES (p_requester_id, p_payer_id, p_conversation_id, p_amount, p_reason)
  RETURNING id INTO v_request_id;
  
  -- Tạo message content
  v_message_content := '💸 Yêu cầu thanh toán: ' || p_amount::TEXT || ' VND';
  IF p_reason IS NOT NULL AND p_reason != '' THEN
    v_message_content := v_message_content || ' - ' || p_reason;
  END IF;
  
  -- Tạo message record
  INSERT INTO messages (conversation_id, sender_id, content, message_type, request_id)
  VALUES (p_conversation_id, p_requester_id, v_message_content, 'money_request', v_request_id)
  RETURNING id INTO v_message_id;
  
  -- Cập nhật request với message_id
  UPDATE money_requests 
  SET message_id = v_message_id 
  WHERE id = v_request_id;
  
  RETURN v_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function để pay/reject money request
CREATE OR REPLACE FUNCTION update_money_request_status(
  p_request_id BIGINT,
  p_status VARCHAR(20),
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_request money_requests%ROWTYPE;
BEGIN
  -- Lấy thông tin request
  SELECT * INTO v_request 
  FROM money_requests 
  WHERE id = p_request_id;
  
  -- Kiểm tra quyền (chỉ payer mới có thể pay/reject)
  IF v_request.payer_id != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Only payer can update request status';
  END IF;
  
  -- Kiểm tra status hợp lệ
  IF p_status NOT IN ('paid', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;
  
  -- Cập nhật status
  UPDATE money_requests 
  SET status = p_status, updated_at = NOW()
  WHERE id = p_request_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;