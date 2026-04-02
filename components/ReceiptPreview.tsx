// components/ReceiptPreview.tsx - Preview hóa đơn đã quét
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { ThemedText } from './themed-text';

type ReceiptPreviewProps = {
  imageUri: string;
  amount?: number | null;
  merchantName?: string | null;
  date?: Date | null;
  category?: string | null;
};

export function ReceiptPreview({
  imageUri,
  amount,
  merchantName,
  date,
  category,
}: ReceiptPreviewProps) {
  const formatVND = (n: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

  const formatDate = (d: Date) => {
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1)
      .toString()
      .padStart(2, '0')}/${d.getFullYear()}`;
  };

  return (
    <View style={styles.container}>
      <Image source={{ uri: imageUri }} style={styles.image} />
      
      <View style={styles.overlay}>
        {amount && (
          <View style={styles.badge}>
            <ThemedText style={styles.badgeText}>{formatVND(amount)}</ThemedText>
          </View>
        )}
      </View>
      
      <View style={styles.info}>
        {merchantName && (
          <ThemedText style={styles.merchant} numberOfLines={1}>
            {merchantName}
          </ThemedText>
        )}
        
        <View style={styles.meta}>
          {date && (
            <ThemedText style={styles.metaText}>📅 {formatDate(date)}</ThemedText>
          )}
          {category && (
            <ThemedText style={styles.metaText}>📁 {category}</ThemedText>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f9fafb',
  },
  image: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  overlay: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  badge: {
    backgroundColor: 'rgba(16, 185, 129, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  info: {
    padding: 12,
  },
  merchant: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  meta: {
    flexDirection: 'row',
    gap: 12,
  },
  metaText: {
    fontSize: 12,
    color: '#6b7280',
  },
});
