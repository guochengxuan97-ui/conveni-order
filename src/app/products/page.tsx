'use client';
import { useState, useEffect, useRef } from 'react';
import { Product, ProductCategory, MarkdownRule } from '@/lib/types';

const CATEGORIES: ProductCategory[] = [
  '弁当',
  'おにぎり・おむすび',
  'サンドイッチ',
  'サラダ',
  'パスタ',
  'その他',
];

const CATEGORY_ICONS: Record<string, string> = {
  '弁当': '🍱',
  'おにぎり・おむすび': '🍙',
  'サンドイッチ': '🥪',
  'サラダ': '🥗',
  'パスタ': '🍝',
  'その他': '🛒',
};

interface FormState {
  name: string;
  category: ProductCategory;
  defaultOrder: number;
  shelfLife: number;
  isDeliItem: boolean;
  deliverySlotCount: 1 | 2 | 3;
  overOrderTolerance: number;
  underOrderTolerance: number;
  hasOrderCorrectionPeriod: boolean;
  correctionDeadlineHour: number;
  price: string;
  cost: string;
  markdownRules: MarkdownRule[];
}

const defaultForm: FormState = {
  name: '',
  category: '弁当',
  defaultOrder: 10,
  shelfLife: 1,
  isDeliItem: false,
  deliverySlotCount: 1,
  overOrderTolerance: 2,
  underOrderTolerance: 1,
  hasOrderCorrectionPeriod: false,
  correctionDeadlineHour: 10,
  price: '',
  cost: '',
  markdownRules: [],
};

function productToForm(p: Product): FormState {
  return {
    name: p.name,
    category: p.category,
    defaultOrder: p.defaultOrder,
    shelfLife: p.shelfLife,
    isDeliItem: p.isDeliItem,
    deliverySlotCount: p.deliverySlotCount,
    overOrderTolerance: p.overOrderTolerance,
    underOrderTolerance: p.underOrderTolerance,
    hasOrderCorrectionPeriod: p.hasOrderCorrectionPeriod,
    correctionDeadlineHour: p.correctionDeadlineHour,
    price: p.price != null ? String(p.price) : '',
    cost: p.cost != null ? String(p.cost) : '',
    markdownRules: Array.isArray(p.markdownRules) ? p.markdownRules : [],
  };
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

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [saving, setSaving] = useState(false);

  // Scan state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanStep, setScanStep] = useState<'select' | 'preview' | 'confirm'>('select');
  const [scanImageUrl, setScanImageUrl] = useState<string | null>(null);
  const [scanImageData, setScanImageData] = useState<{ base64: string; mimeType: string } | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanForm, setScanForm] = useState<FormState>(defaultForm);

  useEffect(() => { fetchProducts(); }, []);

  async function fetchProducts() {
    const res = await fetch('/api/products');
    setProducts(await res.json());
  }

  function openNew() {
    setEditProduct(null);
    setForm(defaultForm);
    setShowModal(true);
  }

  function openEdit(product: Product) {
    setEditProduct(product);
    setForm(productToForm(product));
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      price: form.price !== '' ? Number(form.price) : undefined,
      cost: form.cost !== '' ? Number(form.cost) : undefined,
    };
    if (editProduct) {
      await fetch(`/api/products/${editProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    setSaving(false);
    setShowModal(false);
    fetchProducts();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    await fetch(`/api/products/${id}`, { method: 'DELETE' });
    fetchProducts();
  }

  const num = (v: string, min = 0) => Math.max(min, parseInt(v) || min);

  function addMarkdownRule() {
    setForm((prev) => ({
      ...prev,
      markdownRules: [...prev.markdownRules, { hoursBeforeExpiry: 6, discountAmount: 10 }],
    }));
  }

  function updateMarkdownRule(index: number, field: keyof MarkdownRule, value: string) {
    setForm((prev) => {
      const rules = [...prev.markdownRules];
      rules[index] = { ...rules[index], [field]: Math.max(0, parseInt(value) || 0) };
      return { ...prev, markdownRules: rules };
    });
  }

  function removeMarkdownRule(index: number) {
    setForm((prev) => ({
      ...prev,
      markdownRules: prev.markdownRules.filter((_, i) => i !== index),
    }));
  }

  // --- Scan handlers ---
  function openScanModal() {
    setScanStep('select');
    setScanImageUrl(null);
    setScanImageData(null);
    setScanError(null);
    setShowScanModal(true);
  }

  async function handleScanFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanImageUrl(URL.createObjectURL(file));
    setScanImageData(await resizeAndEncode(file));
    setScanStep('preview');
    e.target.value = '';
  }

  async function handleScan() {
    if (!scanImageData) return;
    setScanLoading(true);
    setScanError(null);
    try {
      const res = await fetch('/api/scan-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scanImageData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '読み取り失敗');
      setScanForm({
        ...defaultForm,
        name: data.name ?? '',
        category: data.category ?? '弁当',
        price: data.price != null ? String(data.price) : '',
        shelfLife: data.shelfLife ?? 1,
      });
      setScanStep('confirm');
    } catch (err) {
      setScanError(err instanceof Error ? err.message : '読み取りに失敗しました');
    } finally {
      setScanLoading(false);
    }
  }

  async function handleScanSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...scanForm,
        price: scanForm.price !== '' ? Number(scanForm.price) : undefined,
        cost: scanForm.cost !== '' ? Number(scanForm.cost) : undefined,
      }),
    });
    setSaving(false);
    setShowScanModal(false);
    fetchProducts();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">商品マスタ管理</h1>
        <div className="flex gap-2">
          <button
            onClick={openScanModal}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-1.5"
          >
            📷 写真から登録
          </button>
          <button
            onClick={openNew}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
          >
            + 商品追加
          </button>
        </div>
      </div>

      {/* Manual entry modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl my-4">
            <h2 className="text-lg font-bold text-gray-800 mb-5">
              {editProduct ? '商品を編集' : '新規商品登録'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">商品名</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="例: 幕の内弁当"
                  required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリ</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as ProductCategory })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{CATEGORY_ICONS[cat]} {cat}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">通常発注数（個）</label>
                  <input
                    type="number" min="1"
                    value={form.defaultOrder}
                    onChange={(e) => setForm({ ...form, defaultOrder: num(e.target.value, 1) })}
                    required
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">賞味期限（日）</label>
                  <input
                    type="number" min="1"
                    value={form.shelfLife}
                    onChange={(e) => setForm({ ...form, shelfLife: num(e.target.value, 1) })}
                    required
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div className="border border-gray-100 rounded-xl p-3 space-y-3 bg-gray-50">
                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">発注許容範囲</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">多め許容（＋個まで）</label>
                    <input
                      type="number" min="0"
                      value={form.overOrderTolerance}
                      onChange={(e) => setForm({ ...form, overOrderTolerance: num(e.target.value) })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">少なめ許容（－個まで）</label>
                    <input
                      type="number" min="0"
                      value={form.underOrderTolerance}
                      onChange={(e) => setForm({ ...form, underOrderTolerance: num(e.target.value) })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="border border-gray-100 rounded-xl p-3 space-y-3 bg-gray-50">
                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">デリ・納品設定</div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isDeliItem}
                    onChange={(e) => setForm({ ...form, isDeliItem: e.target.checked })}
                    className="w-4 h-4 accent-green-600"
                  />
                  <span className="text-sm text-gray-700">デリ商品（複数便に分けて納品）</span>
                </label>
                {form.isDeliItem && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">1日の納品便数</label>
                    <select
                      value={form.deliverySlotCount}
                      onChange={(e) => setForm({ ...form, deliverySlotCount: Number(e.target.value) as 1 | 2 | 3 })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                    >
                      <option value={1}>1便</option>
                      <option value={2}>2便</option>
                      <option value={3}>3便</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="border border-gray-100 rounded-xl p-3 space-y-3 bg-gray-50">
                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">発注修正期間</div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.hasOrderCorrectionPeriod}
                    onChange={(e) => setForm({ ...form, hasOrderCorrectionPeriod: e.target.checked })}
                    className="w-4 h-4 accent-green-600"
                  />
                  <span className="text-sm text-gray-700">発注修正期間あり</span>
                </label>
                {form.hasOrderCorrectionPeriod && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">修正締切時刻（時）</label>
                    <input
                      type="number" min="0" max="23"
                      value={form.correctionDeadlineHour}
                      onChange={(e) => setForm({ ...form, correctionDeadlineHour: Math.min(23, num(e.target.value)) })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                    />
                  </div>
                )}
              </div>

              <div className="border border-gray-100 rounded-xl p-3 space-y-3 bg-gray-50">
                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">価格（粗利計算用・任意）</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">売価（円）</label>
                    <input
                      type="number" min="0"
                      value={form.price}
                      placeholder="例: 498"
                      onChange={(e) => setForm({ ...form, price: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">原価（円）</label>
                    <input
                      type="number" min="0"
                      value={form.cost}
                      placeholder="例: 299"
                      onChange={(e) => setForm({ ...form, cost: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="border border-gray-100 rounded-xl p-3 space-y-3 bg-gray-50">
                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">値下げルール</div>
                {form.markdownRules.length === 0 && (
                  <div className="text-xs text-gray-400">ルールなし</div>
                )}
                {form.markdownRules.map((rule, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 shrink-0">賞味期限</span>
                    <input
                      type="number" min="0"
                      value={rule.hoursBeforeExpiry}
                      onChange={(e) => updateMarkdownRule(index, 'hoursBeforeExpiry', e.target.value)}
                      className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white text-center"
                    />
                    <span className="text-xs text-gray-600 shrink-0">時間前に</span>
                    <input
                      type="number" min="0"
                      value={rule.discountAmount}
                      onChange={(e) => updateMarkdownRule(index, 'discountAmount', e.target.value)}
                      className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white text-center"
                    />
                    <span className="text-xs text-gray-600 shrink-0">円引き</span>
                    <button
                      type="button"
                      onClick={() => removeMarkdownRule(index)}
                      className="ml-auto text-xs text-red-500 hover:text-red-700 shrink-0"
                    >
                      削除
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addMarkdownRule}
                  className="text-xs text-green-600 hover:text-green-700 font-medium"
                >
                  ＋ルール追加
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Scan modal — bottom sheet */}
      {showScanModal && (
        <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50">
          <div className="bg-white rounded-t-3xl w-full max-w-lg shadow-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
              <h2 className="text-lg font-bold text-gray-800">📷 写真から商品登録</h2>
              <button
                onClick={() => setShowScanModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

              {/* Step: select */}
              {scanStep === 'select' && (
                <>
                  <p className="text-sm text-gray-500 text-center">
                    商品パッケージを撮影、またはギャラリーから選択してください
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleScanFileSelect}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-10 rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50 text-center text-blue-700 hover:bg-blue-100 active:bg-blue-200 transition-colors"
                  >
                    <div className="text-6xl mb-3">📷</div>
                    <div className="text-lg font-bold">カメラ / ギャラリー</div>
                    <div className="text-sm text-blue-400 mt-1">タップして選択</div>
                  </button>
                </>
              )}

              {/* Step: preview */}
              {scanStep === 'preview' && scanImageUrl && (
                <>
                  <img
                    src={scanImageUrl}
                    alt="選択した画像"
                    className="w-full rounded-xl object-contain max-h-64 bg-gray-100"
                  />
                  {scanError && (
                    <div className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{scanError}</div>
                  )}
                  <button
                    onClick={handleScan}
                    disabled={scanLoading}
                    className="w-full py-4 rounded-xl bg-blue-600 text-white font-bold text-lg hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {scanLoading ? (
                      <>
                        <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        読み取り中...
                      </>
                    ) : (
                      'AI で商品情報を読み取る'
                    )}
                  </button>
                  <button
                    onClick={() => { setScanStep('select'); setScanError(null); }}
                    className="w-full py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50"
                  >
                    撮り直す
                  </button>
                </>
              )}

              {/* Step: confirm */}
              {scanStep === 'confirm' && (
                <>
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700 flex items-start gap-2">
                    <span className="shrink-0">✅</span>
                    <span>読み取り完了。内容を確認・修正してから登録してください。</span>
                  </div>
                  <form onSubmit={handleScanSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">商品名</label>
                      <input
                        type="text"
                        value={scanForm.name}
                        onChange={(e) => setScanForm({ ...scanForm, name: e.target.value })}
                        required
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリ</label>
                      <select
                        value={scanForm.category}
                        onChange={(e) => setScanForm({ ...scanForm, category: e.target.value as ProductCategory })}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>{CATEGORY_ICONS[cat]} {cat}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">売価（円）</label>
                        <input
                          type="number" min="0"
                          value={scanForm.price}
                          placeholder="例: 498"
                          onChange={(e) => setScanForm({ ...scanForm, price: e.target.value })}
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">賞味期限（日）</label>
                        <input
                          type="number" min="1"
                          value={scanForm.shelfLife}
                          onChange={(e) => setScanForm({ ...scanForm, shelfLife: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="flex gap-3 pt-1">
                      <button
                        type="submit"
                        disabled={saving}
                        className="flex-1 bg-green-600 text-white py-4 rounded-xl font-bold text-base hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        {saving ? '登録中...' : '商品マスタに登録'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setScanStep('preview')}
                        className="px-5 py-4 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50"
                      >
                        戻る
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Product list */}
      {products.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm border border-gray-100 text-center text-gray-400">
          <div className="text-5xl mb-3">📦</div>
          <div className="font-medium text-lg">商品がまだ登録されていません</div>
          <div className="text-sm mt-1">「商品追加」または「写真から登録」ボタンから登録してください</div>
        </div>
      ) : (
        <div className="space-y-3">
          {CATEGORIES.map((category) => {
            const catProducts = products.filter((p) => p.category === category);
            if (catProducts.length === 0) return null;
            return (
              <div
                key={category}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
              >
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-gray-600">
                    {CATEGORY_ICONS[category]} {category}
                  </h2>
                </div>
                {catProducts.map((product, idx) => (
                  <div
                    key={product.id}
                    className={`flex items-start px-4 py-3 ${idx > 0 ? 'border-t border-gray-50' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-800">
                        {product.name}
                        {product.isDeliItem && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-700 rounded px-1.5 py-0.5">
                            デリ {product.deliverySlotCount}便
                          </span>
                        )}
                        {product.hasOrderCorrectionPeriod && (
                          <span className="ml-1 text-xs bg-yellow-100 text-yellow-700 rounded px-1.5 py-0.5">
                            修正{product.correctionDeadlineHour}時締切
                          </span>
                        )}
                        {product.markdownRules.length > 0 && (
                          <span className="ml-1 text-xs bg-purple-100 text-purple-700 rounded px-1.5 py-0.5">
                            値下げ{product.markdownRules.length}ルール
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        通常発注: {product.defaultOrder}個 ・ 賞味期限: {product.shelfLife}日
                        ・ 許容: ±{product.underOrderTolerance}/+{product.overOrderTolerance}個
                        {product.price != null && ` ・ 売価¥${product.price}`}
                      </div>
                    </div>
                    <div className="flex gap-3 ml-3 shrink-0 mt-0.5">
                      <button onClick={() => openEdit(product)} className="text-blue-600 text-sm hover:underline">
                        編集
                      </button>
                      <button onClick={() => handleDelete(product.id, product.name)} className="text-red-500 text-sm hover:underline">
                        削除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
