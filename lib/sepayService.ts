// Service để đồng bộ giao dịch từ Sepay
import { supabase } from './supabase';

// Lock để tránh sync đồng thời
let isSyncLocked = false;

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

// Hàm phát hiện danh mục từ nội dung
export function detectCategory(content: string): string {
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

// Interface cho giao dịch Sepay
export interface SepayTransaction {
  id: string;
  gateway: string;
  transaction_date: string;
  account_number: string;
  sub_account?: string;
  amount_in: number;
  amount_out: number;
  accumulated: number;
  code?: string;
  transaction_content: string;
  reference_number?: string;
  body?: string;
  bank_brand_name?: string;
}

// Lấy API key của user hiện tại
export async function getUserSepayApiKey(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('user_profiles')
      .select('sepay_api_key')
      .eq('user_id', user.id)
      .single();

    if (error || !data?.sepay_api_key) {
      return null;
    }

    return data.sepay_api_key;
  } catch (error) {
    console.error('Error getting Sepay API key:', error);
    return null;
  }
}

// Lấy danh sách giao dịch từ Sepay API
export async function fetchSepayTransactions(
  apiKey: string,
  limit: number = 20
): Promise<SepayTransaction[]> {
  try {
    console.log('📡 Calling Sepay API...');
    
    // Gọi trực tiếp Sepay API (cả web và mobile)
    const endpoint = `https://my.sepay.vn/userapi/transactions/list?limit=${limit}`;
    
    console.log(`   Endpoint: ${endpoint}`);
    console.log(`   API Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`);

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      mode: 'cors', // Explicitly set CORS mode
    });

    console.log(`📡 Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Sepay API error:`, errorText);
      throw new Error(`Sepay API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('📡 Sepay API response:', JSON.stringify(data, null, 2));
    
    // Sepay API trả về format: { status: 200, transactions: [...] }
    if (data.status === 200 && Array.isArray(data.transactions)) {
      console.log(`✅ Found ${data.transactions.length} transactions`);
      return data.transactions;
    }
    
    // Fallback: nếu có transactions nhưng không có status
    if (Array.isArray(data.transactions)) {
      console.log(`✅ Found ${data.transactions.length} transactions (no status field)`);
      return data.transactions;
    }

    console.warn('⚠️  No transactions found in response');
    return [];
  } catch (error: any) {
    console.error('❌ Error fetching Sepay transactions:', error);
    console.error('   Error details:', error.message);
    
    // Nếu là CORS error trên web, throw message rõ ràng
    if (error.message === 'Failed to fetch' && typeof window !== 'undefined') {
      throw new Error('CORS Error: Không thể gọi Sepay API từ web. Vui lòng chạy trên mobile hoặc dùng extension CORS Unblock.');
    }
    
    throw error;
  }
}

// Lấy thời điểm tạo API key
async function getSepayKeyCreatedAt(): Promise<Date | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('user_profiles')
      .select('sepay_key_created_at')
      .eq('user_id', user.id)
      .single();

    if (error || !data?.sepay_key_created_at) {
      return null;
    }

    return new Date(data.sepay_key_created_at);
  } catch (error) {
    console.error('Error getting Sepay key created time:', error);
    return null;
  }
}

// Tìm hoặc tạo danh mục
async function findOrCreateCategory(
  userId: string,
  categoryName: string,
  type: 'income' | 'expense'
): Promise<number | null> {
  try {
    // Chuẩn hóa tên danh mục
    const normalizedName = categoryName.trim();
    const normalizedNameNoTone = removeVietnameseTones(normalizedName.toLowerCase());

    // Tìm danh mục có sẵn (so sánh không phân biệt dấu)
    const { data: allCategories } = await supabase
      .from('categories')
      .select('id, name')
      .eq('user_id', userId)
      .eq('type', type);

    if (allCategories && allCategories.length > 0) {
      // Tìm danh mục khớp (không phân biệt hoa thường và dấu)
      const matchedCategory = allCategories.find(cat => {
        const catNameNoTone = removeVietnameseTones(cat.name.toLowerCase());
        return catNameNoTone === normalizedNameNoTone || 
               cat.name.toLowerCase() === normalizedName.toLowerCase();
      });

      if (matchedCategory) {
        console.log(`✅ Found existing category: ${matchedCategory.name} (ID: ${matchedCategory.id})`);
        return matchedCategory.id;
      }
    }

    // Tạo danh mục mới nếu không tìm thấy
    console.log(`➕ Creating new category: ${normalizedName}`);
    const { data: newCategory, error } = await supabase
      .from('categories')
      .insert({
        user_id: userId,
        name: normalizedName,
        type: type,
        emoji: type === 'income' ? '💰' : '💸',
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating category:', error);
      return null;
    }

    console.log(`✅ Created category: ${normalizedName} (ID: ${newCategory.id})`);
    return newCategory?.id || null;
  } catch (error) {
    console.error('Error in findOrCreateCategory:', error);
    return null;
  }
}

// Đồng bộ giao dịch từ Sepay vào database
export async function syncSepayTransactions(): Promise<{
  success: boolean;
  synced: number;
  skipped: number;
  errors: number;
  message: string;
}> {
  // Kiểm tra lock để tránh sync đồng thời
  if (isSyncLocked) {
    console.log('🔒 Sync already in progress, skipping...');
    return {
      success: true,
      synced: 0,
      skipped: 0,
      errors: 0,
      message: 'Sync đang chạy',
    };
  }

  // Đặt lock
  isSyncLocked = true;

  try {
    console.log('🔄 Starting Sepay sync...');
    
    // Lấy user hiện tại
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        success: false,
        synced: 0,
        skipped: 0,
        errors: 0,
        message: 'Vui lòng đăng nhập',
      };
    }

    console.log(`👤 User ID: ${user.id}`);

    // Lấy API key
    const apiKey = await getUserSepayApiKey();
    if (!apiKey) {
      return {
        success: false,
        synced: 0,
        skipped: 0,
        errors: 0,
        message: 'Chưa cài đặt Sepay API key',
      };
    }

    console.log('🔑 API key found, fetching transactions...');

    // Lấy thời điểm tạo key
    const keyCreatedAt = await getSepayKeyCreatedAt();
    console.log(`⏰ Key created at: ${keyCreatedAt?.toISOString() || 'unknown'}`);

    // Lấy giao dịch từ Sepay
    const transactions = await fetchSepayTransactions(apiKey, 50);
    
    console.log(`📊 Fetched ${transactions.length} transactions from Sepay`);
    
    if (transactions.length === 0) {
      return {
        success: true,
        synced: 0,
        skipped: 0,
        errors: 0,
        message: 'Không có giao dịch mới',
      };
    }

    // Lọc chỉ lấy giao dịch sau khi add key
    const filteredTransactions = keyCreatedAt 
      ? transactions.filter(tx => {
          const txDate = new Date(tx.transaction_date);
          return txDate >= keyCreatedAt;
        })
      : transactions;

    console.log(`🔍 Filtered to ${filteredTransactions.length} transactions after key creation time`);

    if (filteredTransactions.length === 0) {
      return {
        success: true,
        synced: 0,
        skipped: 0,
        errors: 0,
        message: 'Không có giao dịch mới sau khi thêm API key',
      };
    }

    let synced = 0;
    let skipped = 0;
    let errors = 0;

    for (const tx of filteredTransactions) {
      try {
        // Xác định loại giao dịch
        const isIncome = tx.amount_in > 0;
        const amount = isIncome ? tx.amount_in : tx.amount_out;
        const type: 'income' | 'expense' = isIncome ? 'income' : 'expense';

        console.log(`\n📝 Processing transaction:`, {
          id: tx.id,
          content: tx.transaction_content,
          amount,
          type,
          date: tx.transaction_date,
        });

        // Kiểm tra giao dịch đã sync chưa (dùng bảng tracking)
        console.log(`🔍 Checking if Sepay transaction ${tx.id} already synced`);
        
        const { data: syncedRecord, error: checkError } = await supabase
          .from('sepay_synced_transactions')
          .select('id')
          .eq('user_id', user.id)
          .eq('sepay_transaction_id', tx.id.toString())
          .maybeSingle();

        if (checkError) {
          console.error('❌ Error checking sync status:', checkError);
          errors++;
          continue;
        }

        if (syncedRecord) {
          console.log(`⏭️  Transaction ${tx.id} already synced, skipping`);
          skipped++;
          continue;
        }
        
        console.log(`✨ Transaction ${tx.id} is new, will create it`);

        // Lưu vào bảng tracking TRƯỚC để tránh race condition
        const { error: preTrackError } = await supabase
          .from('sepay_synced_transactions')
          .insert({
            user_id: user.id,
            sepay_transaction_id: tx.id.toString(),
            transaction_id: null, // Tạm thời null, sẽ update sau
          });
        
        if (preTrackError) {
          // Nếu lỗi unique constraint = đã sync rồi
          if (preTrackError.code === '23505') {
            console.log(`⏭️  Transaction ${tx.id} already being synced, skipping`);
            skipped++;
            continue;
          }
          console.error('❌ Error pre-tracking:', preTrackError);
          errors++;
          continue;
        }

        // Phát hiện danh mục từ nội dung
        const detectedCategoryName = detectCategory(tx.transaction_content || '');
        console.log(`🔍 Detected category: ${detectedCategoryName}`);

        // Tìm hoặc tạo danh mục
        const categoryId = await findOrCreateCategory(user.id, detectedCategoryName, type);
        console.log(`📁 Category ID: ${categoryId}`);

        // Tạo giao dịch mới (chỉ lưu tên, không có prefix Sepay)
        const noteContent = tx.transaction_content || 'Giao dịch ngân hàng';
        
        const { data: newTx, error: insertError } = await supabase
          .from('transactions')
          .insert({
            user_id: user.id,
            category_id: categoryId,
            type: type,
            amount: amount,
            note: noteContent,
            transaction_date: tx.transaction_date,
            occurred_at: tx.transaction_date,
          })
          .select()
          .single();

        if (insertError) {
          console.error('❌ Error inserting transaction:', insertError);
          // Xóa record tracking vì tạo transaction thất bại
          await supabase
            .from('sepay_synced_transactions')
            .delete()
            .eq('user_id', user.id)
            .eq('sepay_transaction_id', tx.id.toString());
          errors++;
        } else {
          console.log(`✅ Transaction created successfully:`, newTx);
          
          // Update transaction_id vào tracking record
          await supabase
            .from('sepay_synced_transactions')
            .update({ transaction_id: newTx.id })
            .eq('user_id', user.id)
            .eq('sepay_transaction_id', tx.id.toString());
          
          synced++;
        }
      } catch (err) {
        console.error('❌ Error processing transaction:', err);
        errors++;
      }
    }

    return {
      success: true,
      synced,
      skipped,
      errors,
      message: `Đã đồng bộ ${synced} giao dịch, bỏ qua ${skipped} giao dịch trùng`,
    };
  } catch (error: any) {
    console.error('Sync error:', error);
    return {
      success: false,
      synced: 0,
      skipped: 0,
      errors: 0,
      message: error.message || 'Có lỗi xảy ra',
    };
  } finally {
    // Luôn mở lock khi kết thúc
    isSyncLocked = false;
  }
}
