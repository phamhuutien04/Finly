// lib/receiptOCR.ts - OCR và phân tích hóa đơn

export type ReceiptData = {
  amount: number | null;
  date: Date | null;
  merchantName: string | null;
  category: string | null;
  rawText: string;
};

// Từ khóa để phân loại danh mục
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Ăn uống': [
    'nhà hàng', 'quán ăn', 'cà phê', 'cafe', 'coffee', 'phở', 'cơm', 'bún', 
    'bánh', 'trà', 'tea', 'food', 'restaurant', 'highland', 'starbucks',
    'lotteria', 'kfc', 'jollibee', 'pizza', 'burger', 'gà rán', 'fastfood',
    'bếp', 'kitchen', 'món ăn', 'thức ăn', 'đồ ăn'
  ],
  'Di chuyển': [
    'grab', 'uber', 'gojek', 'be', 'taxi', 'xe ôm', 'xăng', 'petrol', 
    'gas', 'petrolimex', 'pvoil', 'xe buýt', 'bus', 'vé xe', 'parking',
    'đỗ xe', 'bãi xe', 'cầu đường', 'phí đường', 'toll'
  ],
  'Mua sắm': [
    'siêu thị', 'supermarket', 'coopmart', 'lotte', 'vinmart', 'circle k',
    'family mart', 'gs25', 'mini stop', 'shop', 'store', 'cửa hàng',
    'thời trang', 'fashion', 'quần áo', 'giày dép', 'phụ kiện'
  ],
  'Giải trí': [
    'rạp', 'cinema', 'cgv', 'lotte cinema', 'galaxy', 'game', 'karaoke',
    'bar', 'pub', 'club', 'vui chơi', 'entertainment', 'du lịch', 'travel',
    'khách sạn', 'hotel', 'resort'
  ],
  'Sức khỏe': [
    'bệnh viện', 'hospital', 'phòng khám', 'clinic', 'nhà thuốc', 'pharmacy',
    'dược', 'thuốc', 'medicine', 'khám', 'chữa', 'y tế', 'health',
    'nha khoa', 'dental', 'spa', 'massage'
  ],
  'Học tập': [
    'trường', 'school', 'university', 'đại học', 'học phí', 'tuition',
    'sách', 'book', 'nhà sách', 'bookstore', 'khóa học', 'course',
    'giáo dục', 'education', 'văn phòng phẩm', 'stationery'
  ],
  'Hóa đơn': [
    'điện', 'electric', 'evn', 'nước', 'water', 'internet', 'wifi',
    'điện thoại', 'phone', 'mobile', 'viettel', 'vinaphone', 'mobifone',
    'vnpt', 'fpt', 'gas', 'khí đốt'
  ],
  'Khác': []
};

/**
 * Phân tích text từ OCR để trích xuất thông tin hóa đơn
 */
export function parseReceiptText(text: string): ReceiptData {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  let amount: number | null = null;
  let date: Date | null = null;
  let merchantName: string | null = null;
  
  // Tìm số tiền (VND)
  for (const line of lines) {
    // Pattern: 123,456 hoặc 123.456 hoặc 123456 VND/đ/₫
    // Tìm tất cả số trong dòng
    const amounts = line.match(/(\d{1,3}(?:[,\.]\d{3})*(?:[,\.]\d{2})?)/g);
    
    if (amounts) {
      for (const amountStr of amounts) {
        // Loại bỏ dấu phẩy và chấm
        const numStr = amountStr.replace(/[,\.]/g, '');
        const parsed = parseInt(numStr, 10);
        
        // Chỉ lấy số tiền hợp lý (> 1000 VND và < 100 triệu)
        if (parsed > 1000 && parsed < 100000000) {
          // Ưu tiên số lớn nhất (thường là tổng cộng)
          if (!amount || parsed > amount) {
            amount = parsed;
          }
        }
      }
    }
    
    // Kiểm tra xem dòng có chứa từ khóa "tổng" không
    if (line.toLowerCase().includes('tổng') || 
        line.toLowerCase().includes('total') ||
        line.toLowerCase().includes('cộng')) {
      // Nếu có từ "tổng", ưu tiên số trong dòng này
      const totalMatch = line.match(/(\d{1,3}(?:[,\.]\d{3})*(?:[,\.]\d{2})?)/);
      if (totalMatch) {
        const numStr = totalMatch[1].replace(/[,\.]/g, '');
        const parsed = parseInt(numStr, 10);
        if (parsed > 1000 && parsed < 100000000) {
          amount = parsed;
          break; // Dừng tìm kiếm khi đã tìm thấy tổng
        }
      }
    }
  }
  
  // Tìm ngày tháng
  for (const line of lines) {
    // Pattern: DD/MM/YYYY hoặc DD-MM-YYYY
    const dateMatch = line.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dateMatch) {
      const day = parseInt(dateMatch[1], 10);
      const month = parseInt(dateMatch[2], 10);
      const year = parseInt(dateMatch[3], 10);
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        date = new Date(year, month - 1, day);
        break;
      }
    }
  }
  
  // Tìm tên cửa hàng (thường ở dòng đầu tiên)
  if (lines.length > 0) {
    merchantName = lines[0].substring(0, 50); // Giới hạn 50 ký tự
  }
  
  // Phân loại danh mục dựa trên từ khóa
  const category = categorizeReceipt(text);
  
  return {
    amount,
    date,
    merchantName,
    category,
    rawText: text
  };
}

/**
 * Phân loại hóa đơn dựa trên từ khóa
 */
export function categorizeReceipt(text: string): string | null {
  const lowerText = text.toLowerCase();
  
  let bestMatch: { category: string; score: number } | null = null;
  
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (category === 'Khác') continue;
    
    let score = 0;
    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        score++;
      }
    }
    
    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { category, score };
    }
  }
  
  return bestMatch ? bestMatch.category : 'Khác';
}

/**
 * Tìm category_id từ tên danh mục
 */
export async function findCategoryId(
  categoryName: string | null,
  categories: Array<{ id: number; name: string; type: string }>
): Promise<number | null> {
  if (!categoryName) return null;
  
  // Tìm chính xác
  const exact = categories.find(c => 
    c.name.toLowerCase() === categoryName.toLowerCase() && c.type === 'expense'
  );
  if (exact) return exact.id;
  
  // Tìm gần đúng
  const partial = categories.find(c => 
    c.name.toLowerCase().includes(categoryName.toLowerCase()) && c.type === 'expense'
  );
  if (partial) return partial.id;
  
  return null;
}
