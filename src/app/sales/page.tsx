'use client';
import { useState, useEffect, useRef } from 'react';
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

interface ScanItem {
  productId: string | null;
  productName: string;
  sold: number;
  wasted: number;
  markedDown: number;
  markdownAmount: number;
  matchedId: string;
}

async function resizeAndEncode(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1120;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width >= height) { height = Math.round(height * MAX / width); width = MAX; }
        else { width = Math.round(width * MAX / height); height = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve({ base64: canvas.toDataURL('image/jpeg', 0.85).split(',')[1], mimeType: 'image/jpeg' });
    };
    img.src = url;
  });
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

  // POS scan state
  const posFileInputRef = useRef<HTMLInputElement>(null);
  const [showPosScan, setShowPosScan] = useState(false);
  const [posScanStep, setPosScanStep] = useState<'select' | 'preview' | 'confirm'>('select');
  const [posImageUrl, setPosImageUrl] = useState<string | null>(null);
  const [posImageData, setPosImageData] = useState<{ base64: string; mimeType: string } | null>(null);
  const [posLoading, setPosLoading] = useState(false);
  const [posError, setPosError] = useState<string | null>(null);
  const [scanItems, setScanItems] = useState<ScanItem[]>([]);

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

  // --- POS scan handlers ---
  function openPosScan() {
    setPosScanStep('select');
    setPosImageUrl(null);
    setPosImageData(null);
    setPosError(null);
    setScanItems([]);
    setShowPosScan(true);
  }

  async function handlePosFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPosImageUrl(URL.createObjectURL(file));
    setPosImageData(await resizeAndEncode(file));
    setPosScanStep('preview');
    e.target.value = '';
  }

  async function handlePosScan() {
    if (!posImageData) return;
    setPosLoading(true);
    setPosError(null);
    try {
      const res = await fetch('/api/scan-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...posImageData,
          products: products.map((p) => ({ id: p.id, name: p.name })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '読み取り失敗');

      const items: ScanItem[] = (data.items ?? []).map((item: Omit<ScanItem, 'matchedId'>) => {
        // Try to match by productId first, then by name
        let matchedId = '';
        if (item.productId && products.some((p) => p.id === item.productId)) {
          matchedId = item.productId;
        } else {
          const byName = products.find((p) =>
            p.name.includes(item.productName) || item.productName.includes(p.name)
          );
          if (byName) matchedId = byName.id;
        }
        return { ...item, matchedId };
      });

      setScanItems(items);
      setPosScanStep('confirm');
    } catch (err) {
      setPosError(err instanceof Error ? err.message : '読み取りに失敗しました');
    } finally {
      setPosLoading(false);
    }
  }

  function applyPosScan() {
    setRows((prev) => {
      const next = { ...prev };
      for (const item of scanItems) {
        if (!item.matchedId) continue;
        next[item.matchedId] = {
          ...next[item.matchedId],
          sold: item.sold,
          wasted: item.wasted,
          markedDown: item.markedDown,
          markdownAmount: item.markdownAmount,
        };
      }
      return next;
    });
    setSaved(false);
    setShowPosScan(false);
  }

  function updateScanItem(index: number, field: keyof ScanItem, value: string | number) {
    setScanItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: typeof value === 'string' && field !== 'matchedId' && field !== 'productId' && field !== 'productName' ? Math.max(0, parseInt(value) || 0) : value };
      return next;
    });
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">販売実績入力</h1>
        <button
          onClick={openPosScan}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-1.5"
        >
          📷 POSから読み取り
        </button>
      </div>

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

      {/* POS scan modal — bottom sheet */}
      {showPosScan && (
        <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50">
          <div className="bg-white rounded-t-3xl w-full max-w-lg shadow-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
              <h2 className="text-lg font-bold text-gray-800">📷 POS販売データ読み取り</h2>
              <button
                onClick={() => setShowPosScan(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

              {/* Step: select */}
              {posScanStep === 'select' && (
                <>
                  <p className="text-sm text-gray-500 text-center">
                    POSレポート画面や販売集計表を撮影してください
                  </p>
                  <input
                    ref={posFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePosFileSelect}
                  />
                  <button
                    onClick={() => posFileInputRef.current?.click()}
                    className="w-full py-10 rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50 text-center text-blue-700 hover:bg-blue-100 active:bg-blue-200 transition-colors"
                  >
                    <div className="text-6xl mb-3">📊</div>
                    <div className="text-lg font-bold">カメラ / ギャラリー</div>
                    <div className="text-sm text-blue-400 mt-1">POSの画面を撮影してください</div>
                  </button>
                </>
              )}

              {/* Step: preview */}
              {posScanStep === 'preview' && posImageUrl && (
                <>
                  <img
                    src={posImageUrl}
                    alt="選択した画像"
                    className="w-full rounded-xl object-contain max-h-56 bg-gray-100"
                  />
                  {posError && (
                    <div className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{posError}</div>
                  )}
                  <button
                    onClick={handlePosScan}
                    disabled={posLoading}
                    className="w-full py-4 rounded-xl bg-blue-600 text-white font-bold text-lg hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {posLoading ? (
                      <>
                        <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        読み取り中...
                      </>
                    ) : (
                      'AI で販売数を読み取る'
                    )}
                  </button>
                  <button
                    onClick={() => { setPosScanStep('select'); setPosError(null); }}
                    className="w-full py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50"
                  >
                    撮り直す
                  </button>
                </>
              )}

              {/* Step: confirm */}
              {posScanStep === 'confirm' && (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700 flex items-start gap-2">
                    <span className="shrink-0">✅</span>
                    <span>読み取り完了。数値を確認・修正してから「販売実績に反映」を押してください。</span>
                  </div>

                  {scanItems.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                      <div className="text-3xl mb-2">🔍</div>
                      <div>販売データを読み取れませんでした。<br />別の画像をお試しください。</div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {scanItems.map((item, idx) => {
                        const matched = products.find((p) => p.id === item.matchedId);
                        return (
                          <div
                            key={idx}
                            className={`rounded-xl border p-3 space-y-2 ${matched ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}`}
                          >
                            {/* Product match selector */}
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-700 shrink-0">商品：</span>
                              <select
                                value={item.matchedId}
                                onChange={(e) => updateScanItem(idx, 'matchedId', e.target.value)}
                                className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="">（除外）</option>
                                {products.map((p) => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                              </select>
                            </div>
                            {!matched && (
                              <div className="text-xs text-orange-600">
                                読み取り名「{item.productName}」→ 上のドロップダウンで商品を選択してください
                              </div>
                            )}

                            {/* Numeric fields */}
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { key: 'sold', label: '販売数', color: 'text-gray-700' },
                                { key: 'wasted', label: '廃棄数', color: 'text-orange-600' },
                                { key: 'markedDown', label: '値下げ数', color: 'text-purple-600' },
                                { key: 'markdownAmount', label: '値下げ額(¥)', color: 'text-purple-600' },
                              ].map(({ key, label, color }) => (
                                <div key={key}>
                                  <label className={`block text-xs font-medium ${color} mb-1`}>{label}</label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={(item as unknown as Record<string, number>)[key]}
                                    onChange={(e) => updateScanItem(idx, key as keyof ScanItem, e.target.value)}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-base text-center focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={applyPosScan}
                      disabled={scanItems.every((i) => !i.matchedId)}
                      className="flex-1 bg-green-600 text-white py-4 rounded-xl font-bold text-base hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      販売実績に反映する
                    </button>
                    <button
                      onClick={() => setPosScanStep('preview')}
                      className="px-5 py-4 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50"
                    >
                      戻る
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

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
