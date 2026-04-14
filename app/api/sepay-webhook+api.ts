// API endpoint để nhận webhook từ Sepay
import { supabase } from '@/lib/supabase';

// Mapping từ nội dung giao dịch sang danh mục
const CATEGORY_MAPPING: Record<string, string[]> = {
  'Ăn uống': [
    'an uong', 'ăn uống', 'anuong', 'ănuống',
    'food', 'cafe', 'coffee', 'restaurant', 
    'nhà hàng', 'nha hang', 'quán ăn', 'quan an',
    'cơm', 'com', 'phở', 'pho', 'bún', 'bun',
    'trà sữa', 'tra sua', 'milk tea',
    'đồ ăn', 'do an', 'thức ăn', 'thuc an'
  ],
  'Di chuyển': [
    'grab', 'uber', 'xe', 'taxi', 
    'xăng', 'xang', 'gas', 'petrol',
    'parking', 'đỗ xe', 'do xe',
    've xe', 'vé xe', 've may bay', 'vé máy bay'
  ],
  'Mua sắm': [
    'shopping', 'mua sam', 'mua sắm', 'muasam',
    'shop', 'siêu thị', 'sieu thi', 'market',
    'lazada', 'shopee', 'tiki', 'sendo'
  ],
  'Giải trí': [
    'phim', 'movie', 'game', 
    'vui chơi', 'vui choi', 'giải trí', 'giai tri',
    'entertainment', 'netflix', 'spotify', 'youtube'
  ],
  'Sức khỏe': [
    'bệnh viện', 'benh vien', 'hospital',
    'thuốc', 'thuoc', 'medicine',
    'khám bệnh', 'kham benh', 'doctor', 'pharmacy'
  ],
  'Học tập': [
    'học', 'hoc', 'study', 'course',
    'sách', 'sach', 'book',
    'trường', 'truong', 'học phí', 'hoc phi'
  ],
  'Hóa đơn': [
    'điện', 'dien', 'nước', 'nuoc', 'water',
    'internet', 'phone', 'bill', 'hóa đơn', 'hoa don',
    'evn', 'vnpt', 'viettel', 'mobifone', 'vinaphone'
  ],
  'Nhà cửa': [
    'thuê nhà', 'thue nha', 'rent',
    'nhà', 'nha', 'house', 'apartment'
  ],
};

// Hàm loại bỏ dấu tiếng Việt
function removeVietnameseTones(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

// Hàm phân loại danh mục dựa trên nội dung
function detectCategory(content: string): string {
  const lowerContent = content.toLowerCase().trim();
  const normalizedContent = removeVietnameseTones(lowerContent);
  
  for (const [category, keywords] of Object.entries(CATEGORY_MAPPING)) {
    for (const keyword of keywords) {
      const normalizedKeyword = removeVietnameseTones(keyword.toLowerCase());
      
      // Kiểm tra cả bản gốc và bản không dấu
      if (lowerContent.includes(keyword.toLowerCase()) || 
          normalizedContent.includes(normalizedKeyword)) {
        return category;
      }
    }
  }
  
  return 'Khác'; // Danh mục mặc định
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Sepay webhook received:', body);

    // Validate webhook data
    if (!body || !body.transactions || !Array.isArray(body.transactions)) {
      return Response.json(
        { error: 'Invalid webhook data' },
        { status: 400 }
      );
    }

    const results = [];

    for (const transaction of body.transactions) {
      try {
        // Lấy thông tin giao dịch từ Sepay
        const {
          id: sepayId,
          amount_in,
          amount_out,
          content,
          transaction_date,
          account_number,
        } = transaction;

        // Xác định loại giao dịch (thu nhập hay chi tiêu)
        const isIncome = amount_in > 0;
        const amount = isIncome ? amount_in : amount_out;
        const type = isIncome ? 'income' : 'expense';

        // Tìm user dựa trên account_number hoặc sepay_api_key
        // (Giả sử bạn lưu account_number trong user_profiles)
        const { data: userProfile, error: userError } = await supabase
          .from('user_profiles')
          .select('user_id')
          .not('sepay_api_key', 'is', null)
          .limit(1)
          .single();

        if (userError || !userProfile) {
          console.error('User not found for transaction:', sepayId);
          results.push({ sepayId, status: 'user_not_found' });
          continue;
        }

        const userId = userProfile.user_id;

        // Kiểm tra xem giao dịch đã tồn tại chưa (tránh duplicate)
        const { data: existingTx } = await supabase
          .from('transactions')
          .select('id')
          .eq('note', `Sepay: ${sepayId}`)
          .eq('user_id', userId)
          .single();

        if (existingTx) {
          console.log('Transaction already exists:', sepayId);
          results.push({ sepayId, status: 'already_exists' });
          continue;
        }

        // Phát hiện danh mục từ nội dung
        const detectedCategoryName = detectCategory(content || '');

        // Tìm hoặc tạo danh mục
        let categoryId: number | null = null;

        const { data: existingCategory } = await supabase
          .from('categories')
          .select('id')
          .eq('user_id', userId)
          .eq('name', detectedCategoryName)
          .eq('type', type)
          .single();

        if (existingCategory) {
          categoryId = existingCategory.id;
        } else {
          // Tạo danh mục mới nếu chưa có
          const { data: newCategory, error: categoryError } = await supabase
            .from('categories')
            .insert({
              user_id: userId,
              name: detectedCategoryName,
              type: type,
              emoji: type === 'income' ? '💰' : '💸',
            })
            .select('id')
            .single();

          if (categoryError) {
            console.error('Error creating category:', categoryError);
          } else if (newCategory) {
            categoryId = newCategory.id;
          }
        }

        // Tạo giao dịch mới
        const { data: newTransaction, error: txError } = await supabase
          .from('transactions')
          .insert({
            user_id: userId,
            category_id: categoryId,
            type: type,
            amount: amount,
            note: `Sepay: ${sepayId}\n${content || ''}`,
            transaction_date: transaction_date || new Date().toISOString(),
            occurred_at: transaction_date || new Date().toISOString(),
          })
          .select()
          .single();

        if (txError) {
          console.error('Error creating transaction:', txError);
          results.push({ sepayId, status: 'error', error: txError.message });
        } else {
          console.log('Transaction created:', newTransaction);
          results.push({ sepayId, status: 'success', transactionId: newTransaction.id });
        }
      } catch (err: any) {
        console.error('Error processing transaction:', err);
        results.push({ sepayId: transaction.id, status: 'error', error: err.message });
      }
    }

    return Response.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return Response.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
