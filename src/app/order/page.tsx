'use client';
import { useState, useEffect } from 'react';
import { OrderRecommendation, WeatherType, FactorSettings, DEFAULT_FACTOR_SETTINGS } from '@/lib/types';

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const WEATHER_ICONS: Record<WeatherType, string> = {
  '晴れ': '☀️',
  '曇り': '☁️',
  '雨': '🌧️',
  '雪': '❄️',
};

const RISK_STYLE: Record<string, string> = {
  high: 'bg-red-100 text-red-700 border border-red-200',
  medium: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  low: '',
};
const RISK_LABEL: Record<string, string> = {
  high: '値下げリスク高',
  medium: '値下げリスク中',
  low: '',
};

function CorrectionBadge({ product }: { product: OrderRecommendation['product'] }) {
  if (!product.hasOrderCorrectionPeriod) return null;
  const now = new Date();
  const isPastDeadline = now.getHours() >= product.correctionDeadlineHour;
  return (
    <span
      className={`ml-1 text-xs rounded px-1.5 py-0.5 ${
        isPastDeadline ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
      }`}
    >
      修正{isPastDeadline ? '締切済' : `${product.correctionDeadlineHour}時締切`}
    </span>
  );
}

function factorToPct(factor: number): string {
  const p = Math.round((factor - 1) * 100);
  return p >= 0 ? `+${p}%` : `${p}%`;
}

const WEATHER_KEYS: WeatherType[] = ['晴れ', '曇り', '雨', '雪'];

interface WeatherInfo {
  tempMax: number;
  tempMin: number;
  precipProbability: number | null;
}

export default function OrderPage() {
  const [date, setDate] = useState(toDateString(new Date()));
  const [weather, setWeather] = useState<WeatherType>('曇り');
  const [weatherInfo, setWeatherInfo] = useState<WeatherInfo | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [hasEvent, setHasEvent] = useState(false);
  const [hasSale, setHasSale] = useState(false);
  const [recommendations, setRecommendations] = useState<OrderRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [calculated, setCalculated] = useState(false);
  const [factorSettings, setFactorSettings] = useState<FactorSettings>(DEFAULT_FACTOR_SETTINGS);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => setFactorSettings(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setWeatherInfo(null);
    setWeatherLoading(true);
    fetch(`/api/weather?date=${date}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.weather) {
          setWeather(data.weather as WeatherType);
          setWeatherInfo({ tempMax: data.tempMax, tempMin: data.tempMin, precipProbability: data.precipProbability });
        }
      })
      .catch(() => {})
      .finally(() => setWeatherLoading(false));
  }, [date]);

  async function calculate() {
    setLoading(true);
    const res = await fetch('/api/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, weather, hasEvent, hasSale }),
    });
    setRecommendations(await res.json());
    setLoading(false);
    setCalculated(true);
  }

  const totalOrder = recommendations.reduce((s, r) => s + r.recommendedOrder, 0);
  const selectedWeatherIcon = WEATHER_ICONS[weather];
  const highRiskCount = recommendations.filter((r) => r.markdownRisk === 'high').length;
  const mediumRiskCount = recommendations.filter((r) => r.markdownRisk === 'medium').length;
  const activeVacation = recommendations[0]?.vacationName ?? null;
  const vacationFactor = recommendations[0]?.vacationFactor ?? 1;
  const holidayName = recommendations[0]?.holidayName ?? null;
  const holidayFactor = recommendations[0]?.holidayFactor ?? 1;
  const academicPeriodName = recommendations[0]?.academicPeriodName ?? null;
  const academicFactor = recommendations[0]?.academicFactor ?? 1;
  const academicPeriodType = recommendations[0]?.academicPeriodType ?? null;

  function pct(factor: number) {
    const p = Math.round((factor - 1) * 100);
    return p >= 0 ? `+${p}%` : `${p}%`;
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-800">発注試算</h1>

      {/* Conditions form */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">対象日</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
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
                <span className="text-gray-400 ml-1">自動取得</span>
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {WEATHER_KEYS.map((w) => (
              <button
                key={w}
                onClick={() => setWeather(w)}
                className={`flex flex-col items-center py-3 rounded-xl text-sm font-medium transition-colors border ${
                  weather === w
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-gray-50 text-gray-600 border-gray-100 hover:bg-gray-100'
                }`}
              >
                <span className="text-2xl mb-1">{WEATHER_ICONS[w]}</span>
                <span>{w}</span>
                <span className={`text-xs mt-0.5 ${weather === w ? 'text-green-100' : 'text-gray-400'}`}>
                  {factorToPct(factorSettings.weather[w])}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <label className={`flex-1 flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
            hasEvent ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-100 hover:bg-gray-100'
          }`}>
            <input type="checkbox" checked={hasEvent} onChange={(e) => setHasEvent(e.target.checked)} className="w-4 h-4 accent-blue-600" />
            <div>
              <div className="text-sm font-medium text-gray-800">🎪 近隣イベントあり</div>
              <div className="text-xs text-gray-400">{factorToPct(factorSettings.event)} 補正</div>
            </div>
          </label>
          <label className={`flex-1 flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
            hasSale ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-100 hover:bg-gray-100'
          }`}>
            <input type="checkbox" checked={hasSale} onChange={(e) => setHasSale(e.target.checked)} className="w-4 h-4 accent-purple-600" />
            <div>
              <div className="text-sm font-medium text-gray-800">🏷️ セール実施</div>
              <div className="text-xs text-gray-400">{factorToPct(factorSettings.sale)} 補正</div>
            </div>
          </label>
        </div>

        <button
          onClick={calculate}
          disabled={loading}
          className="w-full bg-green-600 text-white py-3 rounded-xl font-bold text-base hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          {loading ? '計算中...' : '発注数を試算する'}
        </button>
      </div>

      {/* Results */}
      {calculated && (
        <>
          {recommendations.length === 0 ? (
            <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 text-center text-gray-400">
              <div className="text-4xl mb-2">📦</div>
              <div>商品マスタに商品を登録してください</div>
            </div>
          ) : (
            <>
              {/* Holiday banner */}
              {holidayName && holidayFactor < 1 && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-center gap-2">
                  <span className="text-lg">🎌</span>
                  <div>
                    <span className="text-sm font-medium text-orange-800">{holidayName}</span>
                    <span className="text-sm text-orange-600 ml-2">祝日補正 {pct(holidayFactor)} 適用中</span>
                  </div>
                </div>
              )}

              {/* Academic period banner */}
              {academicPeriodName && academicFactor !== 1 && (
                <div className={`border rounded-xl p-3 flex items-center gap-2 ${
                  academicPeriodType === 'vacation' || academicPeriodType === 'closed'
                    ? 'bg-indigo-50 border-indigo-200'
                    : academicPeriodType === 'exam'
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-green-50 border-green-200'
                }`}>
                  <span className="text-lg">
                    {academicPeriodType === 'vacation' ? '🏖️' : academicPeriodType === 'exam' ? '📝' : academicPeriodType === 'event' ? '🎉' : '🔒'}
                  </span>
                  <div>
                    <span className={`text-sm font-medium ${
                      academicPeriodType === 'vacation' || academicPeriodType === 'closed' ? 'text-indigo-800'
                      : academicPeriodType === 'exam' ? 'text-yellow-800' : 'text-green-800'
                    }`}>{academicPeriodName}</span>
                    <span className={`text-sm ml-2 ${
                      academicPeriodType === 'vacation' || academicPeriodType === 'closed' ? 'text-indigo-600'
                      : academicPeriodType === 'exam' ? 'text-yellow-600' : 'text-green-600'
                    }`}>学年歴補正 {pct(academicFactor)} 適用中</span>
                  </div>
                </div>
              )}

              {/* Fallback vacation banner (legacy VacationPeriod) */}
              {activeVacation && !academicPeriodName && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex items-center gap-2">
                  <span className="text-lg">🎓</span>
                  <div>
                    <span className="text-sm font-medium text-indigo-800">{activeVacation}</span>
                    <span className="text-sm text-indigo-600 ml-2">
                      大学休暇補正 {pct(vacationFactor)} 適用中
                    </span>
                  </div>
                </div>
              )}

              {/* Summary banner */}
              <div className="bg-green-600 rounded-xl p-4 text-white">
                <div className="text-sm opacity-80 mb-1">合計推奨発注数</div>
                <div className="text-4xl font-bold">{totalOrder} 個</div>
                <div className="text-xs opacity-70 mt-2">
                  補正: 天気{selectedWeatherIcon}{pct(recommendations[0]?.weatherFactor ?? 1)}
                  {holidayName && holidayFactor < 1 ? ` / 祝日${pct(holidayFactor)}` : ''}
                  {academicPeriodName && academicFactor !== 1 ? ` / 学年歴${pct(academicFactor)}` : ''}
                  {activeVacation && !academicPeriodName ? ` / 大学休暇${pct(vacationFactor)}` : ''}
                  {hasEvent ? ` / イベント${factorToPct(factorSettings.event)}` : ''}
                  {hasSale ? ` / セール${factorToPct(factorSettings.sale)}` : ''}
                </div>
              </div>

              {/* Risk summary */}
              {(highRiskCount > 0 || mediumRiskCount > 0) && (
                <div className={`rounded-xl p-4 ${highRiskCount > 0 ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                  <div className={`font-semibold text-sm mb-1 ${highRiskCount > 0 ? 'text-red-700' : 'text-yellow-700'}`}>
                    ⚠️ 値下げリスクのある商品があります
                  </div>
                  <div className="text-xs text-gray-600">
                    {highRiskCount > 0 && <span className="text-red-600 font-medium">高リスク {highRiskCount}品</span>}
                    {highRiskCount > 0 && mediumRiskCount > 0 && ' ／ '}
                    {mediumRiskCount > 0 && <span className="text-yellow-600 font-medium">中リスク {mediumRiskCount}品</span>}
                    &nbsp;— 発注数を推奨値の下限寄りに調整することを検討してください
                  </div>
                </div>
              )}

              {/* Table */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-700">商品別推奨発注数</h2>
                  <p className="text-xs text-gray-400 mt-0.5">推奨数の左右の数字が許容範囲（最小〜最大）です</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-2 text-gray-500 font-medium">商品名</th>
                        <th className="text-right px-3 py-2 text-gray-500 font-medium">平均需要</th>
                        <th className="text-right px-3 py-2 text-gray-500 font-medium">季節補正</th>
                        <th className="text-center px-3 py-2 font-bold" style={{ color: '#047857' }}>
                          推奨（範囲）
                        </th>
                        <th className="text-center px-3 py-2 text-gray-500 font-medium">リスク</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recommendations.map((rec) => (
                        <tr
                          key={rec.product.id}
                          className={`border-t border-gray-50 hover:bg-gray-50 ${
                            rec.markdownRisk === 'high' ? 'bg-red-50/50' :
                            rec.markdownRisk === 'medium' ? 'bg-yellow-50/30' : ''
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-800">
                              {rec.product.name}
                              {rec.product.isDeliItem && (
                                <span className="ml-1 text-xs bg-blue-100 text-blue-600 rounded px-1 py-0.5">
                                  {rec.product.deliverySlotCount}便
                                </span>
                              )}
                              <CorrectionBadge product={rec.product} />
                            </div>
                            <div className="text-xs text-gray-400">{rec.product.category}</div>
                          </td>
                          <td className="px-3 py-3 text-right text-gray-400">{rec.avgDemand}</td>
                          <td className="px-3 py-3 text-right text-gray-400">
                            {rec.seasonalFactor !== 1 ? (
                              <span className={rec.seasonalFactor > 1 ? 'text-blue-600' : 'text-orange-500'}>
                                {pct(rec.seasonalFactor)}
                              </span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <span className="text-xs text-gray-400">{rec.minOrder}</span>
                              <span className="font-bold text-xl" style={{ color: '#047857' }}>
                                {rec.recommendedOrder}
                              </span>
                              <span className="text-xs text-gray-400">{rec.maxOrder}</span>
                            </div>
                            <div className="text-xs text-gray-300 mt-0.5">
                              最小&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;最大
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            {rec.markdownRisk !== 'low' && (
                              <div className="flex flex-col items-center gap-1">
                                <span className={`text-xs rounded-full px-2 py-0.5 ${RISK_STYLE[rec.markdownRisk]}`}>
                                  {RISK_LABEL[rec.markdownRisk]}
                                </span>
                                {rec.markdownRiskReason && (
                                  <span className="text-xs text-gray-400">{rec.markdownRiskReason}</span>
                                )}
                              </div>
                            )}
                            {rec.markdownRisk === 'low' && (
                              <span className="text-xs text-gray-300">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Deli slot breakdown */}
              {recommendations.some((r) => r.product.isDeliItem && r.product.deliverySlotCount > 1) && (
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                  <h3 className="text-sm font-semibold text-blue-700 mb-3">デリ商品 便別目安発注数</h3>
                  <div className="space-y-2">
                    {recommendations
                      .filter((r) => r.product.isDeliItem && r.product.deliverySlotCount > 1)
                      .map((rec) => {
                        const slots = rec.product.deliverySlotCount;
                        const perSlot = Math.ceil(rec.recommendedOrder / slots);
                        return (
                          <div key={rec.product.id} className="flex items-center gap-2 text-sm">
                            <span className="font-medium text-gray-700 w-32 truncate">{rec.product.name}</span>
                            <div className="flex gap-1">
                              {Array.from({ length: slots }, (_, i) => (
                                <span key={i} className="bg-white border border-blue-200 text-blue-700 rounded px-2 py-0.5 text-xs">
                                  {i + 1}便: {i === slots - 1 ? rec.recommendedOrder - perSlot * (slots - 1) : perSlot}個
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                  <p className="text-xs text-blue-500 mt-2">※ 均等分割の目安です。実際は各便の賞味期限・在庫状況に応じて調整してください。</p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
