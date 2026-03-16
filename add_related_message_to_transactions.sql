-- Add related_message_id column to transactions table
-- This links a transaction to the money request message that created it

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS related_message_id BIGINT REFERENCES messages(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_transactions_related_message 
ON transactions(related_message_id);

-- Add comment to explain the column
COMMENT ON COLUMN transactions.related_message_id IS 'Links transaction to the money request message that created it';
