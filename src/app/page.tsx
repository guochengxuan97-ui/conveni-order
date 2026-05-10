'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Product, SalesRecord, OrderRecommendation, WeatherType } from '@/lib/types';

type Period = 'day' | 'week' | 'month' | 'year' | 'custom';

const PERIOD_LABEL: Record<Period, string> = {
  day: '日別', week: '週別', month: '月別', year: '年別', custom: '期間指定',
};
const PERIOD_RANGE_LABEL: Record<Period, string> = {
  day: '直近7日間', week: '直近12週', month: '直近12ヶ月', year: '年別', custom: '期間内',
};

const WEATHER_OPTIONS: { value: WeatherType; label: string; icon: string }[] = [
  { value: '晴れ', label: '晴れ', icon: '☀️' },
  { value: '曇り', label: '曇り', icon: '☁️' },
  { value: '雨',   label: '雨',   icon: '🌧️' },
  { value: '雪',   label: '雪',   icon: '❄️' },
];

function toDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getWeekStart(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return toDateString(date);
}

function daysAgo(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n); return toDateString(d);
}

function estimateMarkdownLoss(product: Product, qty: number): number {
  if (!product.price || !product.cost) return 0;
  return Math.round((product.price - product.cost) * qty);
}

export default function Dashboard() {
  const [products, setProducts]         = useState<Product[]>([]);
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([]);
  const [recommendations, setRecs]      = useState<OrderRecommendation[]>([]);
  const [loading, setLoading]           = useState(true);
  const [weather, setWeather]           = useState<WeatherType>('曇り');
  const [hasEvent, setHasEvent]         = useState(false);
  const [hasSale, setHasSale]           = useState(false);
  const [period, setPeriod]             = useState<Period>('day');
  const [customStart, setCustomStart]   = useState(() => daysAgo(27));
  const [customEnd, setCustomEnd]       = useState(() => toDateString(new Date()));

  const today = toDateString(new Date());

  const fetchRecs = useCallback(async (w: WeatherType, ev: boolean, sale: boolean) => {
    const res = await fetch('/api/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: today, weather: w, hasEvent: ev, hasSale: sale }),
    });
    setRecs(await res.json());
  }, [today]);

  useEffect(() => {
    (async () => {
      const [pRes, sRes] = await Promise.all([fetch('/api/products'), fetch('/api/sales')]);
      setProducts(await pRes.json());
      setSalesRecords(await sRes.json());
      setLoading(false);
      await fetchRecs('曇り', false, false);
    })();
  }, [fetchRecs]);

  const handleWeather = (w: WeatherType) => { setWeather(w); fetchRecs(w, hasEvent, hasSale); };
  const handleEvent   = () => { const n = !hasEvent; setHasEvent(n); fetchRecs(weather, n, hasSale); };
  const handleSale    = () => { const n = !hasSale;  setHasSale(n);  fetchRecs(weather, hasEvent, n); };

  // ── Period-aware aggregation ────────────────────────────────────
  const periodData = useMemo(() => {
    const toKey = (date: string) => {
      if (period === 'week')  return getWeekStart(date);
      if (period === 'month') return date.slice(0, 7);
      if (period === 'year')  return date.slice(0, 4);
      return date; // day / custom
    };

    const groups: Record<string, { sold: number; ordered: number; wasted: number; stockout: number; markedDown: number }> = {};
    salesRecords.forEach((r) => {
      const key = toKey(r.date);
      if (!groups[key]) groups[key] = { sold: 0, ordered: 0, wasted: 0, stockout: 0, markedDown: 0 };
      const g = groups[key];
      g.sold += r.sold; g.ordered += r.ordered; g.wasted += r.wasted;
      g.stockout += r.stockout; g.markedDown += r.markedDown;
    });

    let keys: string[];
    if (period === 'day') {
      keys = Array.from({ length: 7 }, (_, i) => daysAgo(6 - i));
    } else if (period === 'week') {
      keys = Array.from({ length: 12 }, (_, i) => {
        const d = new Date();
        const day = d.getDay();
        d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day) - (11 - i) * 7);
        return toDateString(d);
      });
    } else if (period === 'month') {
      keys = Array.from({ length: 12 }, (_, i) => {
        const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (11 - i));
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      });
    } else if (period === 'year') {
      keys = [...new Set(salesRecords.map((r) => r.date.slice(0, 4)))].sort();
      if (!keys.length) keys = [String(new Date().getFullYear())];
    } else {
      // custom
      if (!customStart || !customEnd || customStart > customEnd) {
        return { chartData: [], avgWaste: 0, avgStockout: 0, totalMarkdownQty: 0, count: 0 };
      }
      keys = [];
      const cur = new Date(customStart);
      const end = new Date(customEnd);
      while (cur <= end) { keys.push(toDateString(cur)); cur.setDate(cur.getDate() + 1); }
    }

    const xLabel = (key: string) =>
      period === 'year' ? key :
      period === 'week' ? key.slice(5) + '〜' :
      key.slice(5);

    const chartData = keys.map((key) => {
      const g = groups[key] ?? { sold: 0, ordered: 0, wasted: 0, stockout: 0, markedDown: 0 };
      const wasteRate    = g.ordered > 0 ? (g.wasted   / g.ordered)             * 100 : 0;
      const demand       = g.sold + g.stockout;
      const stockoutRate = demand  > 0 ? (g.stockout / demand)                  * 100 : 0;
      return { date: xLabel(key), 廃棄率: Math.round(wasteRate * 10) / 10, 欠品率: Math.round(stockoutRate * 10) / 10 };
    });

    const allG       = keys.map((k) => groups[k] ?? { sold: 0, ordered: 0, wasted: 0, stockout: 0, markedDown: 0 });
    const sumOrdered  = allG.reduce((s, g) => s + g.ordered,    0);
    const sumWasted   = allG.reduce((s, g) => s + g.wasted,     0);
    const sumSold     = allG.reduce((s, g) => s + g.sold,       0);
    const sumStockout = allG.reduce((s, g) => s + g.stockout,   0);
    const sumMarkdown = allG.reduce((s, g) => s + g.markedDown, 0);
    const avgWaste    = sumOrdered > 0              ? (sumWasted   / sumOrdered)             * 100 : 0;
    const avgStockout = (sumSold + sumStockout) > 0 ? (sumStockout / (sumSold + sumStockout)) * 100 : 0;

    return { chartData, avgWaste, avgStockout, totalMarkdownQty: sumMarkdown, count: keys.length };
  }, [period, salesRecords, customStart, customEnd]);

  // ── Markdown history (always last 7 days) ─────────────────────
  const productMap = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const last7Days  = useMemo(() => Array.from({ length: 7 }, (_, i) => daysAgo(6 - i)), []);
  const markdownHistory = useMemo(() => last7Days.flatMap((date) =>
    salesRecords
      .filter((r) => r.date === date && r.markedDown > 0)
      .map((r) => ({ date, product: productMap[r.productId], qty: r.markedDown, loss: productMap[r.productId] ? estimateMarkdownLoss(productMap[r.productId], r.markedDown) : 0 }))
      .filter((x) => x.product != null)
  ), [last7Days, salesRecords, productMap]);
  const totalMarkdownLoss = markdownHistory.reduce((s, x) => s + x.loss, 0);

  const totalOrder   = recommendations.reduce((s, r) => s + r.recommendedOrder, 0);
  const highRiskRecs = recommendations.filter((r) => r.markdownRisk === 'high');
  const medRiskRecs  = recommendations.filter((r) => r.markdownRisk === 'medium');

  const xInterval = periodData.count > 20 ? Math.ceil(periodData.count / 10) - 1 : 0;
  const barSize   = period === 'year' ? 36 : period === 'week' ? 24 : periodData.count > 30 ? 6 : 16;

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">読み込み中...</div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">ダッシュボード</h1>
        <p className="text-sm text-gray-500">{today}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-xs text-gray-500 mb-1">本日の推奨発注合計</div>
          <div className="text-2xl font-bold" style={{ color: '#047857' }}>{totalOrder}</div>
          <div className="text-xs text-gray-400">個</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-xs text-gray-500 mb-1">{PERIOD_RANGE_LABEL[period]} 廃棄率</div>
          <div className="text-2xl font-bold text-orange-500">{periodData.avgWaste.toFixed(1)}%</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-xs text-gray-500 mb-1">{PERIOD_RANGE_LABEL[period]} 欠品率</div>
          <div className="text-2xl font-bold text-red-500">{periodData.avgStockout.toFixed(1)}%</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-xs text-gray-500 mb-1">{PERIOD_RANGE_LABEL[period]} 値下げ数</div>
          <div className="text-2xl font-bold text-purple-500">{periodData.totalMarkdownQty}</div>
          <div className="text-xs text-gray-400">個</div>
        </div>
      </div>

      {/* Risk warning */}
      {(highRiskRecs.length > 0 || medRiskRecs.length > 0) && (
        <div className={`rounded-xl p-4 border ${highRiskRecs.length > 0 ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
          <div className={`font-semibold text-sm mb-2 ${highRiskRecs.length > 0 ? 'text-red-700' : 'text-yellow-700'}`}>
            ⚠️ 本日の発注に値下げリスクがある商品
          </div>
          <div className="space-y-1">
            {[...highRiskRecs, ...medRiskRecs].map((rec) => (
              <div key={rec.product.id} className="flex items-center gap-2 text-sm">
                <span className={`text-xs rounded-full px-2 py-0.5 ${rec.markdownRisk === 'high' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-yellow-100 text-yellow-700 border border-yellow-200'}`}>
                  {rec.markdownRisk === 'high' ? '高' : '中'}
                </span>
                <span className="text-gray-700">{rec.product.name}</span>
                <span className="text-gray-400 text-xs">{rec.markdownRiskReason}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">発注試算ページで許容範囲の下限寄りに発注数を調整してください。</p>
        </div>
      )}

      {/* Condition picker */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">本日の条件</h2>
        <div className="flex flex-wrap gap-2">
          {WEATHER_OPTIONS.map((opt) => (
            <button key={opt.value} onClick={() => handleWeather(opt.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${weather === opt.value ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
          <button onClick={handleEvent} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${hasEvent ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            🎪 イベント{hasEvent ? 'あり' : 'なし'}
          </button>
          <button onClick={handleSale} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${hasSale ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            🏷️ セール{hasSale ? 'あり' : 'なし'}
          </button>
        </div>
      </div>

      {/* Recommendations */}
      {products.length === 0 ? (
        <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 text-center text-gray-400">
          <div className="text-4xl mb-2">📦</div>
          <div className="font-medium">商品がまだ登録されていません</div>
          <div className="text-sm mt-1">「商品管理」から商品を追加してください</div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-700">本日の推奨発注数</h2>
            <p className="text-xs text-gray-400 mt-0.5">（最小〜推奨〜最大）</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 text-gray-500 font-medium">商品名</th>
                  <th className="text-right px-4 py-2 text-gray-500 font-medium">平均需要</th>
                  <th className="text-center px-4 py-2 font-bold" style={{ color: '#047857' }}>推奨（範囲）</th>
                  <th className="text-center px-3 py-2 text-gray-500 font-medium">リスク</th>
                </tr>
              </thead>
              <tbody>
                {recommendations.map((rec) => (
                  <tr key={rec.product.id} className={`border-t border-gray-50 hover:bg-gray-50 ${rec.markdownRisk === 'high' ? 'bg-red-50/40' : rec.markdownRisk === 'medium' ? 'bg-yellow-50/30' : ''}`}>
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{rec.product.name}</div>
                      <div className="text-xs text-gray-400">{rec.product.category}</div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-400">{rec.avgDemand}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="text-xs text-gray-300">{rec.minOrder} 〜 </span>
                      <span className="font-bold text-lg" style={{ color: '#047857' }}>{rec.recommendedOrder}</span>
                      <span className="text-xs text-gray-300"> 〜 {rec.maxOrder}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {rec.markdownRisk !== 'low' ? (
                        <span className={`text-xs rounded-full px-2 py-0.5 ${rec.markdownRisk === 'high' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-yellow-100 text-yellow-700 border border-yellow-200'}`}>
                          {rec.markdownRisk === 'high' ? '高' : '中'}
                        </span>
                      ) : <span className="text-xs text-gray-300">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Markdown loss (always last 7 days) */}
      {totalMarkdownLoss > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-700">直近7日間の値下げ損失推計</h2>
            <span className="text-sm font-bold text-purple-600">推計損失合計: ¥{totalMarkdownLoss.toLocaleString()}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 text-gray-500 font-medium">日付</th>
                  <th className="text-left px-4 py-2 text-gray-500 font-medium">商品名</th>
                  <th className="text-right px-4 py-2 text-gray-500 font-medium">値下げ数</th>
                  <th className="text-right px-4 py-2 text-purple-500 font-medium">推計損失</th>
                </tr>
              </thead>
              <tbody>
                {markdownHistory.map((item, idx) => (
                  <tr key={idx} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-500">{item.date.slice(5)}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-800">{item.product.name}</td>
                    <td className="px-4 py-2.5 text-right text-purple-600 font-medium">{item.qty}個</td>
                    <td className="px-4 py-2.5 text-right text-purple-600 font-medium">{item.loss > 0 ? `¥${item.loss.toLocaleString()}` : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {markdownHistory.some((x) => x.loss === 0) && (
            <p className="text-xs text-gray-400 px-4 py-2">※ 売価・原価が未設定の商品は損失推計を表示できません</p>
          )}
        </div>
      )}

      {/* Chart with period toggle */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        {/* Toggle header */}
        <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
          <h2 className="font-semibold text-gray-700">
            {PERIOD_RANGE_LABEL[period]}トレンド（廃棄率・欠品率）
          </h2>
          <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5 shrink-0">
            {(['day', 'week', 'month', 'year', 'custom'] as Period[]).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-2 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${period === p ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {PERIOD_LABEL[p]}
              </button>
            ))}
          </div>
        </div>

        {/* Custom date range inputs */}
        {period === 'custom' && (
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            <span className="text-gray-400 text-sm">〜</span>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
        )}

        {salesRecords.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">販売実績を入力するとグラフが表示されます</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={periodData.chartData} barSize={barSize}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={xInterval} />
              <YAxis unit="%" tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `${v}%`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="廃棄率" fill="#f97316" radius={[3, 3, 0, 0]} />
              <Bar dataKey="欠品率" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
