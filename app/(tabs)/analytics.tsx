import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { VictoryAxis, VictoryBar, VictoryChart, VictoryPie } from "victory-native";

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

type Tx = {
  id: string;
  type: "income" | "expense";
  category: string;
  note: string;
  amount: number;
  day: number;
};

const DATA: Record<string, Tx[]> = {
  "01/2026": [
    { id: "t1", type: "income", category: "Lương", note: "Lương tháng", amount: 12000000, day: 5 },
    { id: "t2", type: "expense", category: "Ăn uống", note: "Ăn trưa", amount: 65000, day: 6 },
    { id: "t3", type: "expense", category: "Di chuyển", note: "Đổ xăng", amount: 120000, day: 7 },
    { id: "t4", type: "expense", category: "Mua sắm", note: "Áo", amount: 350000, day: 8 },
    { id: "t5", type: "expense", category: "Giải trí", note: "Xem phim", amount: 90000, day: 9 },
    { id: "t6", type: "income", category: "Thưởng", note: "Bonus", amount: 500000, day: 12 },
    { id: "t7", type: "expense", category: "Hóa đơn", note: "Điện nước", amount: 420000, day: 15 },
    { id: "t8", type: "expense", category: "Ăn uống", note: "Cafe", amount: 45000, day: 16 },
    { id: "t9", type: "expense", category: "Ăn uống", note: "Ăn tối", amount: 110000, day: 18 },
  ],
  "12/2025": [
    { id: "a1", type: "income", category: "Lương", note: "Lương tháng", amount: 11500000, day: 5 },
    { id: "a2", type: "expense", category: "Ăn uống", note: "Bún", amount: 50000, day: 6 },
    { id: "a3", type: "expense", category: "Mua sắm", note: "Giày", amount: 900000, day: 10 },
    { id: "a4", type: "expense", category: "Hóa đơn", note: "Internet", amount: 240000, day: 12 },
    { id: "a5", type: "income", category: "Khác", note: "Freelance", amount: 1500000, day: 20 },
  ],
};

const MONTHS = ["01/2026", "12/2025"];

const PIE_COLORS = ["#4F46E5", "#22C55E", "#F97316", "#EF4444", "#06B6D4", "#A855F7", "#F59E0B", "#10B981"];

const fmtMoney = (v: number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(v) + " ₫";

function sumBy(txs: Tx[], type: Tx["type"]) {
  return txs.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);
}

export default function AnalyticsScreen() {
  console.log("VictoryPie:", VictoryPie);
console.log("VictoryChart:", VictoryChart);

  const scheme = useColorScheme();
  const theme = Colors[scheme ?? "light"];

  const bg = theme.background ?? "#fff";
  const card = (theme as any).card ?? bg;
  const text = theme.text ?? "#111";
  const tint = theme.tint ?? "#2f6fed";

  const [month, setMonth] = useState(MONTHS[0]);
  const [mode, setMode] = useState<"expense" | "income">("expense");

  const txs = DATA[month] ?? [];

  const income = useMemo(() => sumBy(txs, "income"), [txs]);
  const expense = useMemo(() => sumBy(txs, "expense"), [txs]);
  const balance = income - expense;
  const total = income + expense;

  const pieIncomeExpense = useMemo(() => {
    const a = Math.max(income, 0);
    const b = Math.max(expense, 0);
    if (a === 0 && b === 0) return [{ x: "NoData", y: 1 }];
    return [
      { x: "Thu", y: a },
      { x: "Chi", y: b },
    ];
  }, [income, expense]);

  const expensePieData = useMemo(() => {
    const m = new Map<string, number>();
    txs.filter((t) => t.type === "expense").forEach((t) => m.set(t.category, (m.get(t.category) ?? 0) + t.amount));

    const entries = [...m.entries()].sort((a, b) => b[1] - a[1]);
    const totalExpense = entries.reduce((s, [, v]) => s + v, 0);
    if (entries.length === 0) return [];

    return entries.map(([category, amount], idx) => ({
      x: category,
      y: amount,
      percent: totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0,
      fill: PIE_COLORS[idx % PIE_COLORS.length],
    }));
  }, [txs]);

  const topCategories = useMemo(() => {
    const m = new Map<string, number>();
    txs.filter((t) => t.type === mode).forEach((t) => m.set(t.category, (m.get(t.category) ?? 0) + t.amount));
    return [...m.entries()]
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [txs, mode]);

  const recent = useMemo(() => [...txs].sort((a, b) => b.day - a.day).slice(0, 6), [txs]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <View style={{ gap: 6 }}>
        <Text style={{ fontSize: 24, fontWeight: "900", color: text }}>Thống kê</Text>
        <Text style={{ color: text + "AA" }}>Mobile dùng victory-native</Text>
      </View>

      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
        {MONTHS.map((m) => {
          const active = m === month;
          return (
            <Pressable
              key={m}
              onPress={() => setMonth(m)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: active ? tint : text + "22",
                backgroundColor: active ? tint : "transparent",
              }}
            >
              <Text style={{ fontWeight: "800", color: active ? "white" : text }}>{m}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1, padding: 14, borderRadius: 18, backgroundColor: card, borderWidth: 1, borderColor: text + "12" }}>
          <Text style={{ color: text + "AA", fontWeight: "700" }}>Thu</Text>
          <Text style={{ fontSize: 18, fontWeight: "900", color: text, marginTop: 6 }}>{fmtMoney(income)}</Text>
        </View>

        <View style={{ flex: 1, padding: 14, borderRadius: 18, backgroundColor: card, borderWidth: 1, borderColor: text + "12" }}>
          <Text style={{ color: text + "AA", fontWeight: "700" }}>Chi</Text>
          <Text style={{ fontSize: 18, fontWeight: "900", color: text, marginTop: 6 }}>{fmtMoney(expense)}</Text>
        </View>
      </View>

      <View style={{ padding: 14, borderRadius: 18, backgroundColor: card, borderWidth: 1, borderColor: text + "12" }}>
        <Text style={{ color: text + "AA", fontWeight: "700" }}>Số dư</Text>
        <Text style={{ fontSize: 22, fontWeight: "900", color: balance >= 0 ? tint : text, marginTop: 6 }}>
          {fmtMoney(balance)}
        </Text>
      </View>

      {/* Donut Thu/Chi */}
      <View style={{ padding: 14, borderRadius: 18, backgroundColor: card, borderWidth: 1, borderColor: text + "12" }}>
        <Text style={{ fontSize: 16, fontWeight: "900", color: text, marginBottom: 8 }}>Thu vs Chi</Text>
        <View style={{ alignItems: "center" }}>
          <VictoryPie
            data={pieIncomeExpense as any}
            innerRadius={70}
            padAngle={2}
            labels={() => ""}
            width={320}
            height={240}
            style={{
              data: {
                fill: ({ datum }: any) => {
                  if (datum.x === "Thu") return tint;
                  if (datum.x === "Chi") return text + "44";
                  return text + "22";
                },
              },
            }}
          />
          <View style={{ position: "absolute", top: 110, alignItems: "center" }}>
            <Text style={{ color: text + "AA", fontWeight: "800" }}>Tổng</Text>
            <Text style={{ color: text, fontSize: 18, fontWeight: "900" }}>{fmtMoney(total)}</Text>
          </View>
        </View>
      </View>

      {/* Pie theo danh mục chi */}
      <View style={{ padding: 14, borderRadius: 18, backgroundColor: card, borderWidth: 1, borderColor: text + "12" }}>
        <Text style={{ fontSize: 16, fontWeight: "900", color: text, marginBottom: 8 }}>Phân bổ chi theo danh mục</Text>

        {expensePieData.length === 0 ? (
          <Text style={{ color: text + "AA" }}>Chưa có dữ liệu chi.</Text>
        ) : (
          <View style={{ alignItems: "center" }}>
            <VictoryPie
              data={expensePieData as any}
              innerRadius={60}
              padAngle={2}
              width={320}
              height={260}
              labels={({ datum }: any) => `${datum.percent}%`}
              labelRadius={92}
              style={{
                data: { fill: ({ datum }: any) => datum.fill },
                labels: { fill: text, fontSize: 12, fontWeight: "700" },
              }}
            />
          </View>
        )}

        <View style={{ marginTop: 10, gap: 8 }}>
          {expensePieData.map((d) => (
            <View key={d.x} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: d.fill }} />
                <Text style={{ color: text, fontWeight: "800" }}>
                  {d.x} • {d.percent}%
                </Text>
              </View>
              <Text style={{ color: text, fontWeight: "900" }}>{fmtMoney(d.y)}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Bar */}
      <View style={{ padding: 14, borderRadius: 18, backgroundColor: card, borderWidth: 1, borderColor: text + "12" }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 16, fontWeight: "900", color: text }}>Top danh mục</Text>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={() => setMode("expense")}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: mode === "expense" ? tint : text + "22",
                backgroundColor: mode === "expense" ? tint : "transparent",
              }}
            >
              <Text style={{ fontWeight: "900", color: mode === "expense" ? "white" : text }}>Chi</Text>
            </Pressable>

            <Pressable
              onPress={() => setMode("income")}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: mode === "income" ? tint : text + "22",
                backgroundColor: mode === "income" ? tint : "transparent",
              }}
            >
              <Text style={{ fontWeight: "900", color: mode === "income" ? "white" : text }}>Thu</Text>
            </Pressable>
          </View>
        </View>

        {topCategories.length === 0 ? (
          <Text style={{ marginTop: 12, color: text + "AA" }}>Chưa có dữ liệu.</Text>
        ) : (
          <VictoryChart height={260} padding={{ top: 20, bottom: 50, left: 60, right: 20 }} domainPadding={{ x: 18 }}>
            <VictoryAxis
              tickFormat={(t: any) => String(t).slice(0, 6)}
              style={{
                tickLabels: { fill: text + "AA", fontSize: 10 },
                axis: { stroke: text + "22" },
                ticks: { stroke: text + "22" },
              }}
            />
            <VictoryAxis
              dependentAxis
              tickFormat={(t: any) => `${Math.round(((+t || 0) / 1000))}k`}
              style={{
                tickLabels: { fill: text + "AA", fontSize: 10 },
                grid: { stroke: text + "12" },
                axis: { stroke: text + "22" },
                ticks: { stroke: text + "22" },
              }}
            />
            <VictoryBar data={topCategories.map((x) => ({ x: x.category, y: x.total }))} cornerRadius={{ top: 8, bottom: 8 }} style={{ data: { fill: tint } }} />
          </VictoryChart>
        )}
      </View>

      {/* Recent */}
      <View style={{ padding: 14, borderRadius: 18, backgroundColor: card, borderWidth: 1, borderColor: text + "12" }}>
        <Text style={{ fontSize: 16, fontWeight: "900", color: text, marginBottom: 10 }}>Giao dịch gần đây</Text>

        {recent.map((t) => (
          <View
            key={t.id}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 12,
              borderRadius: 14,
              backgroundColor: bg,
              borderWidth: 1,
              borderColor: text + "10",
              marginBottom: 10,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: text, fontWeight: "900" }}>
                {t.category} • {String(t.day).padStart(2, "0")}/{month}
              </Text>
              <Text style={{ color: t.type === "income" ? tint : text, fontWeight: "900" }}>
                {t.type === "income" ? "+" : "-"}
                {fmtMoney(t.amount)}
              </Text>
            </View>
            <Text style={{ color: text + "AA", marginTop: 4 }}>{t.note}</Text>
          </View>
        ))}
      </View>

      <View style={{ height: 10 }} />
    </ScrollView>
  );
}
