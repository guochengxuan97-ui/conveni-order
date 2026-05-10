'use client';
import { useState, useEffect, useMemo } from 'react';
import { Product, SalesRecord } from '@/lib/types';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

type Period = 'day' | 'week' | 'month' | 'year' | 'custom';
type ReportTab = 'overview' | 'category' | 'product' | 'seasonal';

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return toDateString(d);
}

function daysAgo(n: number): string {
  return addDays(toDateString(new Date()), -n);
}

function getWeekStart(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return toDateString(date);
}

function getSeason(month: number): 'spring' | 'summer' | 'fall' | 'winter' {
  if ([3, 4, 5].includes(month)) return 'spring';
  if ([6, 7, 8].includes(month)) return 'summer';
  if ([9, 10, 11].includes(month)) return 'fall';
  return 'winter';
}

const SEASON_LABELS = { spring: '春 (3-5月)', summer: '夏 (6-8月)', fall: '秋 (9-11月)', winter: '冬 (12-2月)' };
const SEASON_ICON   = { spring: '🌸', summer: '☀️', fall: '🍂', winter: '❄️' };

function heatmapColor(sold: number, max: number): string {
  if (max === 0 || sold === 0) return '#f3f4f6';
  const r = sold / max;
  if (r < 0.2) return '#dcfce7';
  if (r < 0.4) return '#bbf7d0';
  if (r < 0.65) return '#86efac';
  return '#22c55e';
}

interface PeriodRow {
  key: string;
  label: string;
  sold: number;
  ordered: number;
  wasted: number;
  stockout: number;
  markedDown: number;
  revenue: number;
}

const PERIOD_LABEL: Record<Period, string> = {
  day: '日別', week: '週別', month: '月別', year: '年別', custom: '期間指定',
};

export default function ReportsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [allSales, setAllSales]  = useState<SalesRecord[]>([]);
  const [loading, setLoading]    = useState(true);
  const [period, setPeriod]      = useState<Period>('day');
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');
  const [customStart, setCustomStart] = useState(() => daysAgo(27));
  const [customEnd,   setCustomEnd]   = useState(() => toDateString(new Date()));

  useEffect(() => {
    Promise.all([
      fetch('/api/products').then((r) => r.json()),
      fetch('/api/sales').then((r) => r.json()),
    ]).then(([prods, sales]) => {
      setProducts(prods);
      setAllSales(sales);
      setLoading(false);
    });
  }, []);

  const productMap = useMemo(() => {
    const m: Record<string, Product> = {};
    products.forEach((p) => { m[p.id] = p; });
    return m;
  }, [products]);

  const today = toDateString(new Date());

  // ── Period keys + filtered sales ──────────────────────────────
  const { periodKeys, periodSales, rangeLabel } = useMemo(() => {
    if (period === 'day') {
      const start = addDays(today, -27);
      const keys: string[] = [];
      for (let i = 0; i < 28; i++) keys.push(addDays(start, i));
      return {
        periodKeys: keys,
        periodSales: allSales.filter((s) => s.date >= start && s.date <= today),
        rangeLabel: `${start} 〜 ${today}`,
      };
    }
    if (period === 'week') {
      const todayDate = new Date();
      const dow = todayDate.getDay();
      const currentMonday = new Date(todayDate);
      currentMonday.setDate(todayDate.getDate() + (dow === 0 ? -6 : 1 - dow));
      const keys: string[] = [];
      for (let i = 11; i >= 0; i--) {
        const m = new Date(currentMonday);
        m.setDate(currentMonday.getDate() - i * 7);
        keys.push(toDateString(m));
      }
      const minDate = keys[0];
      return {
        periodKeys: keys,
        periodSales: allSales.filter((s) => s.date >= minDate && s.date <= today),
        rangeLabel: `${keys[0]} 〜 ${keys[11]}`,
      };
    }
    if (period === 'month') {
      const keys = Array.from({ length: 12 }, (_, i) => {
        const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (11 - i));
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      });
      const minDate = keys[0] + '-01';
      return {
        periodKeys: keys,
        periodSales: allSales.filter((s) => s.date >= minDate && s.date <= today),
        rangeLabel: `${keys[0]} 〜 ${keys[11]}`,
      };
    }
    if (period === 'custom') {
      const keys: string[] = [];
      let cur = customStart;
      while (cur <= customEnd) {
        keys.push(cur);
        cur = addDays(cur, 1);
      }
      return {
        periodKeys: keys,
        periodSales: allSales.filter((s) => s.date >= customStart && s.date <= customEnd),
        rangeLabel: `${customStart} 〜 ${customEnd}`,
      };
    }
    // year
    const allYears = [...new Set(allSales.map((s) => s.date.slice(0, 4)))].sort();
    if (allYears.length === 0) allYears.push(String(new Date().getFullYear()));
    return {
      periodKeys: allYears,
      periodSales: allSales,
      rangeLabel: `${allYears[0]} 〜 ${allYears[allYears.length - 1]}`,
    };
  }, [period, today, allSales, customStart, customEnd]);

  // ── Period rows (one row per key) ─────────────────────────────
  const periodRows: PeriodRow[] = useMemo(() => {
    const toKey = (date: string) => {
      if (period === 'day' || period === 'custom') return date;
      if (period === 'week') return getWeekStart(date);
      if (period === 'month') return date.slice(0, 7);
      return date.slice(0, 4);
    };

    const groups: Record<string, Omit<PeriodRow, 'key' | 'label'>> = {};
    periodSales.forEach((s) => {
      const key = toKey(s.date);
      if (!groups[key]) groups[key] = { sold: 0, ordered: 0, wasted: 0, stockout: 0, markedDown: 0, revenue: 0 };
      const g = groups[key];
      g.sold       += s.sold;
      g.ordered    += s.ordered;
      g.wasted     += s.wasted;
      g.stockout   += s.stockout;
      g.markedDown += s.markedDown;
      const p = productMap[s.productId];
      g.revenue += p?.price != null ? s.sold * p.price : 0;
    });

    return periodKeys.map((key) => {
      const g = groups[key] ?? { sold: 0, ordered: 0, wasted: 0, stockout: 0, markedDown: 0, revenue: 0 };
      const label = period === 'year' ? key : key.slice(5);
      return { key, label, ...g };
    });
  }, [period, periodKeys, periodSales, productMap]);

  // ── Aggregate stats ────────────────────────────────────────────
  const totalSold     = periodRows.reduce((a, r) => a + r.sold,       0);
  const totalRevenue  = periodRows.reduce((a, r) => a + r.revenue,    0);
  const totalOrdered  = periodRows.reduce((a, r) => a + r.ordered,    0);
  const totalWasted   = periodRows.reduce((a, r) => a + r.wasted,     0);
  const totalStockout = periodRows.reduce((a, r) => a + r.stockout,   0);
  const wasteRate     = totalOrdered > 0 ? ((totalWasted   / totalOrdered) * 100).toFixed(1) : '0.0';
  const stockoutRate  = totalOrdered > 0 ? ((totalStockout / totalOrdered) * 100).toFixed(1) : '0.0';
  const hasRevenue    = products.some((p) => p.price != null);

  // ── Chart data ────────────────────────────────────────────────
  const chartData = periodRows.map((r) => ({ date: r.label, 販売数: r.sold, 廃棄数: r.wasted, 値下げ数: r.markedDown }));
  const maxSold   = Math.max(...periodRows.map((r) => r.sold), 1);
  const useLineChart = period === 'day' || (period === 'custom' && periodRows.length > 28);
  const xInterval = useLineChart && periodRows.length > 20 ? Math.ceil(periodRows.length / 10) - 1 : 0;
  const barSize = period === 'year' ? 36 : period === 'week' ? 24 : periodRows.length > 30 ? 6 : 16;
  const showHeatmap = period === 'day' || (period === 'custom' && periodRows.length <= 28);

  // ── Category breakdown ────────────────────────────────────────
  const categoryData = useMemo(() => {
    const toKey = (date: string) => {
      if (period === 'day' || period === 'custom') return date;
      if (period === 'week') return getWeekStart(date);
      if (period === 'month') return date.slice(0, 7);
      return date.slice(0, 4);
    };
    const categories = [...new Set(products.map((p) => p.category))];
    return categories.map((cat) => {
      const catIds = products.filter((p) => p.category === cat).map((p) => p.id);
      const colTotals = periodKeys.map((key) =>
        periodSales
          .filter((s) => toKey(s.date) === key && catIds.includes(s.productId))
          .reduce((sum, s) => sum + s.sold, 0)
      );
      const totalWasted2 = periodSales
        .filter((s) => catIds.includes(s.productId))
        .reduce((sum, s) => sum + s.wasted, 0);
      return { category: cat, colTotals, totalSold: colTotals.reduce((a, b) => a + b, 0), totalWasted: totalWasted2 };
    });
  }, [products, periodKeys, periodSales, period]);

  const catCols = useMemo(() => {
    if (period === 'day') return ['第1週', '第2週', '第3週', '第4週'];
    if (period === 'week') return periodKeys.slice(-6).map((k) => k.slice(5));
    if (period === 'month') return periodKeys.slice(-6).map((k) => k.slice(5));
    if (period === 'year') return periodKeys;
    return ['合計'];
  }, [period, periodKeys]);

  const catColData = useMemo(() => {
    if (period === 'day') {
      return categoryData.map((c) => ({
        ...c,
        cols: [0, 1, 2, 3].map((wi) =>
          c.colTotals.slice(wi * 7, wi * 7 + 7).reduce((a, b) => a + b, 0)
        ),
      }));
    }
    if (period === 'week') {
      const offset = periodKeys.length - 6;
      return categoryData.map((c) => ({ ...c, cols: c.colTotals.slice(offset) }));
    }
    if (period === 'month') {
      const offset = periodKeys.length - 6;
      return categoryData.map((c) => ({ ...c, cols: c.colTotals.slice(offset) }));
    }
    if (period === 'year') {
      return categoryData.map((c) => ({ ...c, cols: c.colTotals }));
    }
    // custom: single total column
    return categoryData.map((c) => ({ ...c, cols: [c.totalSold] }));
  }, [period, categoryData, periodKeys]);

  // ── Product summaries ─────────────────────────────────────────
  const productSummaries = useMemo(() => products.map((p) => {
    const recs     = periodSales.filter((s) => s.productId === p.id);
    const sold     = recs.reduce((a, s) => a + s.sold,       0);
    const ordered  = recs.reduce((a, s) => a + s.ordered,    0);
    const wasted   = recs.reduce((a, s) => a + s.wasted,     0);
    const markdown = recs.reduce((a, s) => a + s.markedDown, 0);
    const revenue  = p.price != null ? sold * p.price : 0;
    return { id: p.id, name: p.name, category: p.category, sold, ordered, wasted, markdown, revenue, hasPrice: p.price != null };
  }).sort((a, b) => b.sold - a.sold), [products, periodSales]);

  // ── Seasonal best-sellers (always all-time) ────────────────────
  const seasonalBestSellers = useMemo(() => {
    const seasons = ['spring', 'summer', 'fall', 'winter'] as const;
    return Object.fromEntries(seasons.map((season) => {
      const totals: Record<string, number> = {};
      allSales.forEach((s) => {
        const month = new Date(s.date).getMonth() + 1;
        if (getSeason(month) !== season) return;
        totals[s.productId] = (totals[s.productId] ?? 0) + s.sold;
      });
      const sorted = Object.entries(totals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, sold]) => ({ id, name: productMap[id]?.name ?? id, sold }));
      return [season, sorted];
    }));
  }, [allSales, productMap]);

  const tabs: { key: ReportTab; label: string }[] = [
    { key: 'overview',  label: '概要' },
    { key: 'category',  label: 'カテゴリ別' },
    { key: 'product',   label: '商品別' },
    { key: 'seasonal',  label: '季節分析' },
  ];

  const chartTitle = period === 'day' ? '日別' : period === 'week' ? '週別' : period === 'month' ? '月別' : period === 'year' ? '年別' : '期間内';
  const unitLabel  = period === 'week' ? '週開始日' : period === 'month' ? '月' : period === 'year' ? '年' : '日付';

  const catDescription =
    period === 'day'    ? '週次の販売数内訳' :
    period === 'week'   ? '直近6週の販売数内訳' :
    period === 'month'  ? '直近6ヶ月の販売数内訳' :
    period === 'year'   ? '年次の販売数内訳' :
    'カテゴリ別合計';

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">読み込み中...</div>;
  }

  return (
    <div className="space-y-5">
      {/* Header + period toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">売上レポート</h1>
          <p className="text-xs text-gray-400 mt-0.5">{rangeLabel}</p>
        </div>
        <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
          {(['day', 'week', 'month', 'year', 'custom'] as Period[]).map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-2.5 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${period === p ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Custom date range inputs */}
      {period === 'custom' && (
        <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <span className="text-sm font-medium text-gray-700">期間指定</span>
          <input
            type="date"
            value={customStart}
            max={customEnd}
            onChange={(e) => setCustomStart(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <span className="text-gray-400">〜</span>
          <input
            type="date"
            value={customEnd}
            min={customStart}
            max={today}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <span className="text-xs text-gray-400">{periodRows.length}日間</span>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === t.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 概要 tab ── */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
              <div className="text-xs text-gray-500 mb-1">総販売数</div>
              <div className="text-2xl font-bold text-gray-800">{totalSold.toLocaleString()}</div>
              <div className="text-xs text-gray-400">個</div>
            </div>
            {hasRevenue && (
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                <div className="text-xs text-gray-500 mb-1">総売上金額</div>
                <div className="text-2xl font-bold text-emerald-600">¥{totalRevenue.toLocaleString()}</div>
              </div>
            )}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
              <div className="text-xs text-gray-500 mb-1">廃棄率</div>
              <div className="text-2xl font-bold text-orange-500">{wasteRate}%</div>
              <div className="text-xs text-gray-400">{totalWasted}個</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
              <div className="text-xs text-gray-500 mb-1">欠品率</div>
              <div className="text-2xl font-bold text-red-500">{stockoutRate}%</div>
              <div className="text-xs text-gray-400">{totalStockout}件</div>
            </div>
          </div>

          {/* Calendar heatmap (日別 or 短い期間指定) */}
          {showHeatmap && (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">販売数カレンダー</h2>
              <div className="grid grid-cols-7 gap-1">
                {periodRows.map((r) => (
                  <div key={r.key} title={`${r.key}: ${r.sold}個`}
                    style={{ backgroundColor: heatmapColor(r.sold, maxSold) }}
                    className="rounded p-1 text-center"
                  >
                    <div className="text-xs text-gray-600 leading-tight">{r.key.slice(8)}</div>
                    <div className="text-xs font-medium text-gray-700">{r.sold > 0 ? r.sold : ''}</div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                <span>少</span>
                {['#f3f4f6', '#dcfce7', '#86efac', '#22c55e'].map((c) => (
                  <div key={c} className="w-4 h-3 rounded" style={{ backgroundColor: c }} />
                ))}
                <span>多</span>
              </div>
            </div>
          )}

          {/* Chart */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">{chartTitle}販売数推移</h2>
            {periodRows.every((r) => r.sold === 0) ? (
              <div className="text-center py-8 text-gray-400 text-sm">販売実績を入力するとグラフが表示されます</div>
            ) : useLineChart ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={xInterval} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="販売数" stroke="#059669" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} barSize={barSize}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: period === 'year' ? 12 : 10 }} interval={xInterval} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="販売数"  fill="#059669" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="廃棄数"  fill="#f97316" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="値下げ数" fill="#a855f7" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Summary table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-700">{chartTitle}サマリー</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2 text-gray-500 font-medium">{unitLabel}</th>
                    <th className="text-right px-3 py-2 text-gray-500 font-medium">販売数</th>
                    <th className="text-right px-3 py-2 text-gray-500 font-medium">発注数</th>
                    <th className="text-right px-3 py-2 text-orange-400 font-medium">廃棄数</th>
                    <th className="text-right px-3 py-2 text-red-400 font-medium">欠品数</th>
                    <th className="text-right px-3 py-2 text-purple-400 font-medium">値下げ数</th>
                    {hasRevenue && <th className="text-right px-3 py-2 text-emerald-500 font-medium">売上金額</th>}
                  </tr>
                </thead>
                <tbody>
                  {periodRows.map((r, idx) => (
                    <tr key={r.key} className={`${idx > 0 ? 'border-t border-gray-50' : ''} hover:bg-gray-50`}>
                      <td className="px-4 py-2 text-gray-700">{r.key}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{r.sold}</td>
                      <td className="px-3 py-2 text-right text-gray-500">{r.ordered}</td>
                      <td className="px-3 py-2 text-right text-orange-500">{r.wasted     || '-'}</td>
                      <td className="px-3 py-2 text-right text-red-500">{r.stockout   || '-'}</td>
                      <td className="px-3 py-2 text-right text-purple-500">{r.markedDown || '-'}</td>
                      {hasRevenue && <td className="px-3 py-2 text-right text-emerald-600">{r.revenue > 0 ? `¥${r.revenue.toLocaleString()}` : '-'}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── カテゴリ別 tab ── */}
      {activeTab === 'category' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-700">カテゴリ別集計</h2>
            <p className="text-xs text-gray-400 mt-0.5">{catDescription}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 text-gray-500 font-medium">カテゴリ</th>
                  {catCols.map((col) => (
                    <th key={col} className="text-right px-3 py-2 text-gray-500 font-medium">{col}</th>
                  ))}
                  <th className="text-right px-3 py-2 text-emerald-600 font-medium">合計(販売)</th>
                  <th className="text-right px-3 py-2 text-orange-500 font-medium">廃棄数</th>
                </tr>
              </thead>
              <tbody>
                {catColData.map((c, idx) => (
                  <tr key={c.category} className={`${idx > 0 ? 'border-t border-gray-50' : ''} hover:bg-gray-50`}>
                    <td className="px-4 py-2 text-gray-800 font-medium">{c.category}</td>
                    {c.cols.map((v, i) => (
                      <td key={i} className="px-3 py-2 text-right text-gray-600">{v}</td>
                    ))}
                    <td className="px-3 py-2 text-right font-semibold text-emerald-600">{c.totalSold}</td>
                    <td className="px-3 py-2 text-right text-orange-500">{c.totalWasted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 商品別 tab ── */}
      {activeTab === 'product' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-700">商品別集計（販売数降順）</h2>
            <p className="text-xs text-gray-400 mt-0.5">表示期間: {rangeLabel}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 text-gray-500 font-medium">商品名</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">カテゴリ</th>
                  <th className="text-right px-3 py-2 text-gray-500 font-medium">販売数</th>
                  <th className="text-right px-3 py-2 text-gray-500 font-medium">発注数</th>
                  <th className="text-right px-3 py-2 text-orange-400 font-medium">廃棄数</th>
                  <th className="text-right px-3 py-2 text-purple-400 font-medium">値下げ数</th>
                  {hasRevenue && <th className="text-right px-3 py-2 text-emerald-500 font-medium">売上金額</th>}
                </tr>
              </thead>
              <tbody>
                {productSummaries.map((p, idx) => (
                  <tr key={p.id} className={`${idx > 0 ? 'border-t border-gray-50' : ''} hover:bg-gray-50`}>
                    <td className="px-4 py-2 font-medium text-gray-800">{p.name}</td>
                    <td className="px-3 py-2 text-gray-500">{p.category}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{p.sold}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{p.ordered}</td>
                    <td className="px-3 py-2 text-right text-orange-500">{p.wasted   || '-'}</td>
                    <td className="px-3 py-2 text-right text-purple-500">{p.markdown || '-'}</td>
                    {hasRevenue && (
                      <td className="px-3 py-2 text-right text-emerald-600">
                        {p.hasPrice ? `¥${p.revenue.toLocaleString()}` : '-'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 季節分析 tab (always all-time) ── */}
      {activeTab === 'seasonal' && (
        <div className="space-y-4">
          <p className="text-xs text-gray-400">全期間の販売データを季節別に集計しています</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(['spring', 'summer', 'fall', 'winter'] as const).map((season) => {
              const items = (seasonalBestSellers[season] ?? []) as { id: string; name: string; sold: number }[];
              return (
                <div key={season} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">{SEASON_ICON[season]}</span>
                    <h3 className="font-semibold text-gray-800">{SEASON_LABELS[season]}</h3>
                  </div>
                  {items.length === 0 ? (
                    <div className="text-sm text-gray-400 py-4 text-center">データなし</div>
                  ) : (
                    <ol className="space-y-2">
                      {items.map((item, i) => (
                        <li key={item.id} className="flex items-center gap-2 text-sm">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                            i === 0 ? 'bg-yellow-100 text-yellow-700' :
                            i === 1 ? 'bg-gray-100 text-gray-600' :
                            i === 2 ? 'bg-orange-100 text-orange-600' :
                                      'bg-gray-50 text-gray-500'
                          }`}>{i + 1}</span>
                          <span className="flex-1 text-gray-700">{item.name}</span>
                          <span className="text-gray-400">{item.sold}個</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
