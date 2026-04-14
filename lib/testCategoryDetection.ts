// File test để kiểm tra phát hiện danh mục
import { detectCategory } from './sepayService';

// Test cases
const testCases = [
  'Chuyen khoan an uong',
  'Thanh toan cafe',
  'Mua com trua',
  'AN UONG',
  'ăn uống',
  'Grab bike',
  'Shopee',
  'Lazada',
  'Thanh toan dien',
  'Hoa don nuoc',
  'Xem phim',
  'Mua thuoc',
  'Hoc phi',
  'Thue nha',
  'Chuyen tien khong ro',
];

export function testCategoryDetection() {
  console.log('\n🧪 Testing Category Detection:\n');
  
  testCases.forEach(content => {
    const category = detectCategory(content);
    console.log(`"${content}" → ${category}`);
  });
  
  console.log('\n✅ Test completed\n');
}

// Uncomment để chạy test
// testCategoryDetection();
