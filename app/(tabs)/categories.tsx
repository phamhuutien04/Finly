import React, { useMemo, useState } from 'react';
import {
    Alert,
    FlatList,
    Modal,
    Pressable,
    Text,
    TextInput,
    View,
} from 'react-native';

type CategoryType = 'expense' | 'income';

type Category = {
  id: string;
  name: string;
  type: CategoryType;
  emoji?: string;
};

const seed: Category[] = [
  { id: 'c1', name: 'Ăn uống', type: 'expense', emoji: '🍜' },
  { id: 'c2', name: 'Di chuyển', type: 'expense', emoji: '🛵' },
  { id: 'c3', name: 'Mua sắm', type: 'expense', emoji: '🛍️' },
  { id: 'c4', name: 'Hóa đơn', type: 'expense', emoji: '🧾' },
  { id: 'c5', name: 'Lương', type: 'income', emoji: '💵' },
  { id: 'c6', name: 'Thưởng', type: 'income', emoji: '🎁' },
];

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export default function CategoriesScreen() {
  const [activeType, setActiveType] = useState<CategoryType>('expense');
  const [q, setQ] = useState('');
  const [categories, setCategories] = useState<Category[]>(seed);

  // modal state
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return categories
      .filter((c) => c.type === activeType)
      .filter((c) => (kw ? c.name.toLowerCase().includes(kw) : true));
  }, [categories, activeType, q]);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setEmoji('');
    setOpen(true);
  };

  const openEdit = (c: Category) => {
    setEditing(c);
    setName(c.name);
    setEmoji(c.emoji ?? '');
    setOpen(true);
  };

  const onSave = () => {
    const n = name.trim();
    const e = emoji.trim();

    if (!n) {
      Alert.alert('Thiếu tên', 'Bạn nhập tên danh mục nhé.');
      return;
    }

    if (editing) {
      setCategories((prev) =>
        prev.map((c) =>
          c.id === editing.id ? { ...c, name: n, emoji: e || undefined } : c
        )
      );
    } else {
      const newC: Category = {
        id: uid(),
        type: activeType,
        name: n,
        emoji: e || undefined,
      };
      setCategories((prev) => [newC, ...prev]);
    }

    setOpen(false);
  };

  const onDelete = (c: Category) => {
    Alert.alert(
      'Xóa danh mục?',
      `Bạn chắc muốn xóa "${c.name}" không?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: () =>
            setCategories((prev) => prev.filter((x) => x.id !== c.id)),
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: '800' }}>Danh mục</Text>

      {/* Switch Thu/Chi */}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: '#eee',
          borderRadius: 14,
          padding: 4,
        }}
      >
        <Pressable
          onPress={() => setActiveType('expense')}
          style={{
            flex: 1,
            paddingVertical: 10,
            borderRadius: 12,
            alignItems: 'center',
            backgroundColor: activeType === 'expense' ? '#fff' : 'transparent',
          }}
        >
          <Text style={{ fontWeight: '700' }}>Chi</Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveType('income')}
          style={{
            flex: 1,
            paddingVertical: 10,
            borderRadius: 12,
            alignItems: 'center',
            backgroundColor: activeType === 'income' ? '#fff' : 'transparent',
          }}
        >
          <Text style={{ fontWeight: '700' }}>Thu</Text>
        </Pressable>
      </View>

      {/* Search */}
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Tìm danh mục..."
        style={{
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: '#ddd',
        }}
      />

      {/* Add button */}
      <Pressable
        onPress={openCreate}
        style={{
          paddingVertical: 12,
          borderRadius: 14,
          alignItems: 'center',
          backgroundColor: '#111',
        }}
      >
        <Text style={{ color: 'white', fontWeight: '700' }}>
          + Thêm danh mục {activeType === 'expense' ? 'Chi' : 'Thu'}
        </Text>
      </Pressable>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => (
          <View
            style={{
              borderWidth: 1,
              borderColor: '#e6e6e6',
              borderRadius: 16,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: '#f3f3f3',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 18 }}>{item.emoji ?? '🏷️'}</Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '800' }}>
                {item.name}
              </Text>
              <Text style={{ color: '#666', marginTop: 2 }}>
                {item.type === 'expense' ? 'Danh mục chi' : 'Danh mục thu'}
              </Text>
            </View>

            <Pressable
              onPress={() => openEdit(item)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderRadius: 12,
                backgroundColor: '#f2f2f2',
              }}
            >
              <Text style={{ fontWeight: '700' }}>Sửa</Text>
            </Pressable>

            <Pressable
              onPress={() => onDelete(item)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderRadius: 12,
                backgroundColor: '#ffe9e9',
              }}
            >
              <Text style={{ fontWeight: '800' }}>Xóa</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <View style={{ paddingVertical: 30, alignItems: 'center' }}>
            <Text style={{ color: '#666' }}>
              Không có danh mục nào. Thêm mới nhé.
            </Text>
          </View>
        }
      />

      {/* Modal Add/Edit */}
      <Modal visible={open} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.35)',
            justifyContent: 'center',
            padding: 18,
          }}
        >
          <View
            style={{
              backgroundColor: 'white',
              borderRadius: 18,
              padding: 16,
              gap: 10,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '900' }}>
              {editing ? 'Sửa danh mục' : 'Thêm danh mục'}
            </Text>

            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Tên danh mục (vd: Ăn uống)"
              style={{
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#ddd',
              }}
            />

            <TextInput
              value={emoji}
              onChangeText={setEmoji}
              placeholder="Emoji (vd: 🍜) - có thể bỏ trống"
              style={{
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#ddd',
              }}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
              <Pressable
                onPress={() => setOpen(false)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 14,
                  alignItems: 'center',
                  backgroundColor: '#eee',
                }}
              >
                <Text style={{ fontWeight: '800' }}>Hủy</Text>
              </Pressable>

              <Pressable
                onPress={onSave}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 14,
                  alignItems: 'center',
                  backgroundColor: '#111',
                }}
              >
                <Text style={{ color: 'white', fontWeight: '800' }}>
                  Lưu
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
