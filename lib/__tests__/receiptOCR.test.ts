// lib/__tests__/receiptOCR.test.ts - Unit tests cho receipt OCR
import { categorizeReceipt, parseReceiptText } from '../receiptOCR';

describe('Receipt OCR', () => {
  describe('parseReceiptText', () => {
    it('should extract amount from receipt', () => {
      const text = `
        CỬA HÀNG TIỆN LỢI
        Circle K
        Coca Cola    15,000đ
        Bánh mì      20,000đ
        TỔNG CỘNG:   35,000đ
      `;
      
      const result = parseReceiptText(text);
      expect(result.amount).toBe(35000);
    });

    it('should extract date from receipt', () => {
      const text = `
        Ngày: 02/04/2026
        TỔNG CỘNG: 50,000đ
      `;
      
      const result = parseReceiptText(text);
      expect(result.date).toBeInstanceOf(Date);
      expect(result.date?.getDate()).toBe(2);
      expect(result.date?.getMonth()).toBe(3); // April (0-indexed)
      expect(result.date?.getFullYear()).toBe(2026);
    });

    it('should extract merchant name', () => {
      const text = `
        HIGHLAND COFFEE
        123 Nguyễn Huệ
        Cà phê: 45,000đ
      `;
      
      const result = parseReceiptText(text);
      expect(result.merchantName).toContain('HIGHLAND');
    });
  });

  describe('categorizeReceipt', () => {
    it('should categorize food receipt', () => {
      const text = 'HIGHLAND COFFEE Cà phê đen 45,000đ';
      const category = categorizeReceipt(text);
      expect(category).toBe('Ăn uống');
    });

    it('should categorize transport receipt', () => {
      const text = 'GRAB Chuyến đi từ nhà đến văn phòng 45,000đ';
      const category = categorizeReceipt(text);
      expect(category).toBe('Di chuyển');
    });

    it('should categorize shopping receipt', () => {
      const text = 'VINMART Siêu thị mua sắm 150,000đ';
      const category = categorizeReceipt(text);
      expect(category).toBe('Mua sắm');
    });

    it('should return "Khác" for unknown receipt', () => {
      const text = 'Some random text without keywords';
      const category = categorizeReceipt(text);
      expect(category).toBe('Khác');
    });
  });
});
