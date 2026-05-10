'use client';
import { useState, useEffect } from 'react';
import { Product, SalesRecord, WeatherType } from '@/lib/types';

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const WEATHER_OPTIONS: WeatherType[] = ['晴れ', '曇り', '雨', '雪'];
const WEATHER_ICONS: Record<WeatherType, string> = {
  '晴れ': '☀️', '曇り': '☁️', '雨': '🌧️', '雪': '❄️',
};

interface RowData {
  ordered: number;
  sold: number;
  wasted: number;
  stockout: number;
  markedDown: number;
  markdownAmount: number;
}

interface WeatherInfo {
  tempMax: number;
  tempMin: number;
  precipProbability: number | null;
}

export default function SalesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [date, setDate] = useState(toDateString(new Date()));
  const [weather, setWeather] = useState<WeatherType>('曇り');
  const [weatherInfo, setWeatherInfo] = useState<WeatherInfo | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [rows, setRows] = useState<Record<string, RowData>>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchProducts(); }, []);

  useEffect(() => {
    if (products.length > 0) loadSalesData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, products.length]);

  useEffect(() => {
    setWeatherInfo(null);
    setWeatherLoading(true);
    fetch(`/api/weather?date=${date}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.tempMax !== undefined) {
          setWeatherInfo({ tempMax: data.tempMax, tempMin: data.tempMin, precipProbability: data.precipProbability });
        }
      })
      .catch(() => {})
      .finally(() => setWeatherLoading(false));
  }, [date]);

  async function fetchProducts() {
    const res = await fetch('/api/products');
    setProducts(await res.json());
  }

  async function loadSalesData() {
    const res = await fetch(`/api/sales?date=${date}`);
    const records: SalesRecord[] = await res.json();

    if (records.length > 0 && records[0].weather) {
      setWeather(records[0].weather);
    }

    const init: Record<string, RowData> = {};
    products.forEach((p) => {
      const r = records.find((rec) => rec.productId === p.id);
      init[p.id] = {
        ordered: r?.ordered ?? 0,
        sold: r?.sold ?? 0,
        wasted: r?.wasted ?? 0,
        stockout: r?.stockout ?? 0,
        markedDown: r?.markedDown ?? 0,
        markdownAmount: r?.markdownAmount ?? 0,
      };
    });
    setRows(init);
    setSaved(false);
  }

  function handleChange(productId: string, field: keyof RowData, value: string) {
    const num = Math.max(0, parseInt(value) || 0);
    setRows((prev) => ({ ...prev, [productId]: { ...prev[productId], [field]: num } }));
    setSaved(false);
  }

  function handleAmountChange(productId: string, value: string) {
    const num = Math.max(0, parseInt(value) || 0);
    setRows((prev) => ({ ...prev, [productId]: { ...prev[productId], markdownAmount: num } }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    const payload = Object.entries(rows).map(([productId, data]) => ({
      date,
      productId,
      weather,
      ...data,
    }));
    await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    setSaved(true);
  }

  const totalWasted = Object.values(rows).reduce((s, r) => s + r.wasted, 0);
  const totalOrdered = Object.values(rows).reduce((s, r) => s + r.ordered, 0);
  const totalStockout = Object.values(rows).reduce((s, r) => s + r.stockout, 0);
  const totalMarkdownAmount = Object.values(rows).reduce((s, r) => s + r.markdownAmount, 0);

  const numericFields: { key: keyof Omit<RowData, 'markdownAmount'>; label: string; color?: string }[] = [
    { key: 'ordered', label: '発注数' },
    { key: 'sold', label: '販売数' },
    { key: 'wasted', label: '廃棄数', color: 'text-orange-500' },
    { key: 'stockout', label: '欠品数', color: 'text-red-500' },
    { key: 'markedDown', label: '値下げ数', color: 'text-purple-500' },
  ];

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-800">販売実績入力</h1>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-wrap gap-6 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">日付</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <label className="text-sm font-medium text-gray-700">天気</label>
            {weatherLoading && (
              <span className="text-xs text-blue-500 flex items-center gap-1">
                <span className="inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                取得中...
              </span>
            )}
            {!weatherLoading && weatherInfo && (
              <span className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">
                🌡️ {weatherInfo.tempMax}°/{weatherInfo.tempMin}°
                {weatherInfo.precipProbability !== null && ` 💧${weatherInfo.precipProbability}%`}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {WEATHER_OPTIONS.map((w) => (
              <button
                key={w}
                onClick={() => { setWeather(w); setSaved(false); }}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  weather === w
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {WEATHER_ICONS[w]} {w}
              </button>
            ))}
          </div>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm border border-gray-100 text-center text-gray-400">
          <div className="text-5xl mb-3">📦</div>
          <div className="font-medium">商品マスタに商品を登録してください</div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-orange-50 rounded-xl p-3 text-center">
              <div className="text-xs text-orange-600">廃棄合計</div>
              <div className="text-xl font-bold text-orange-600">{totalWasted}個</div>
            </div>
            <div className="bg-red-50 rounded-xl p-3 text-center">
              <div className="text-xs text-red-600">欠品合計</div>
              <div className="text-xl font-bold text-red-600">{totalStockout}個</div>
            </div>
            <div className="bg-purple-50 rounded-xl p-3 text-center">
              <div className="text-xs text-purple-600">値下げ損失</div>
              <div className="text-xl font-bold text-purple-600">¥{totalMarkdownAmount.toLocaleString()}</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <div className="text-xs text-gray-500">発注合計</div>
              <div className="text-xl font-bold text-gray-700">{totalOrdered}個</div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium min-w-28">商品名</th>
                    {numericFields.map((f) => (
                      <th key={f.key} className={`text-center px-2 py-3 font-medium ${f.color ?? 'text-gray-500'}`}>
                        {f.label}
                      </th>
                    ))}
                    <th className="text-center px-2 py-3 font-medium text-purple-400">値下げ額(¥)</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product, idx) => (
                    <tr key={product.id} className={idx > 0 ? 'border-t border-gray-50' : ''}>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-gray-800">{product.name}</div>
                        <div className="text-xs text-gray-400">{product.category}</div>
                      </td>
                      {numericFields.map((f) => (
                        <td key={f.key} className="px-2 py-2.5 text-center">
                          <input
                            type="number"
                            min="0"
                            value={rows[product.id]?.[f.key] ?? 0}
                            onChange={(e) => handleChange(product.id, f.key, e.target.value)}
                            className="w-14 text-center border border-gray-200 rounded-lg px-1 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                          />
                        </td>
                      ))}
                      <td className="px-2 py-2.5 text-center">
                        <input
                          type="number"
                          min="0"
                          step="10"
                          value={rows[product.id]?.markdownAmount ?? 0}
                          onChange={(e) => handleAmountChange(product.id, e.target.value)}
                          className="w-20 text-center border border-gray-200 rounded-lg px-1 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className={`w-full py-3 rounded-xl font-bold text-base transition-colors ${
              saved ? 'bg-green-100 text-green-700' : 'bg-green-600 text-white hover:bg-green-700'
            } disabled:opacity-50`}
          >
            {saving ? '保存中...' : saved ? '✓ 保存しました' : '保存する'}
          </button>
        </>
      )}
    </div>
  );
}
