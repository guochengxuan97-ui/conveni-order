'use client';
import { useState, useEffect } from 'react';
import { WeatherType } from '@/lib/types';

const WEATHER_OPTIONS: WeatherType[] = ['晴れ', '曇り', '雨', '雪'];
const WEATHER_ICONS: Record<WeatherType, string> = {
  '晴れ': '☀️', '曇り': '☁️', '雨': '🌧️', '雪': '❄️',
};
const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

function getWeekDates(startDate: string, weekIndex: number): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(startDate, weekIndex * 7 + i));
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${DAY_NAMES[d.getUTCDay()]})`;
}

function defaultStartDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 28);
  return d.toISOString().split('T')[0];
}

interface ProductComparison {
  productId: string;
  productName: string;
  recommendedOrder: number;
  reason: string;
  actualOrdered: number | null;
  actualSold: number | null;
  difference: number | null;
}

interface DayComparison {
  date: string;
  dayOfWeek: string;
  weather: WeatherType;
  products: ProductComparison[];
}

interface AiResult {
  analysis: string;
  comparison: DayComparison[];
  accuracy: {
    mae: number | null;
    withinTwoPercent: number | null;
    totalCompared: number;
  };
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheCreation: number;
    cacheRead: number;
  };
}

interface DayWeatherInfo {
  tempMax: number;
  tempMin: number;
  precipProbability: number | null;
}

export default function AiOrderPage() {
  const [startDate, setStartDate] = useState(defaultStartDate());
  const [week4Weather, setWeek4Weather] = useState<Record<string, WeatherType>>({});
  const [week4WeatherInfo, setWeek4WeatherInfo] = useState<Record<string, DayWeatherInfo>>({});
  const [week4WeatherLoading, setWeek4WeatherLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const week1Dates = getWeekDates(startDate, 0);
  const week2Dates = getWeekDates(startDate, 1);
  const week3Dates = getWeekDates(startDate, 2);
  const week4Dates = getWeekDates(startDate, 3);

  // Initialize week4 weather defaults
  useEffect(() => {
    const init: Record<string, WeatherType> = {};
    week4Dates.forEach((date) => {
      if (!week4Weather[date]) init[date] = '曇り';
    });
    if (Object.keys(init).length > 0) {
      setWeek4Weather((prev) => ({ ...prev, ...init }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate]);

  // Auto-load week4 weather: first from stored sales data, then from Open-Meteo
  useEffect(() => {
    setWeek4WeatherInfo({});
    const start = week4Dates[0];
    const end = week4Dates[week4Dates.length - 1];

    // Fetch Open-Meteo weather for week 4 range
    setWeek4WeatherLoading(true);
    fetch(`/api/weather?start=${start}&end=${end}`)
      .then((r) => r.json())
      .then((data: Array<{ date: string; weather: WeatherType; tempMax: number; tempMin: number; precipProbability: number | null }>) => {
        if (!Array.isArray(data)) return;
        const weatherUpdates: Record<string, WeatherType> = {};
        const infoUpdates: Record<string, DayWeatherInfo> = {};
        for (const d of data) {
          weatherUpdates[d.date] = d.weather;
          infoUpdates[d.date] = { tempMax: d.tempMax, tempMin: d.tempMin, precipProbability: d.precipProbability };
        }
        setWeek4Weather((prev) => ({ ...weatherUpdates, ...prev }));
        setWeek4WeatherInfo(infoUpdates);
      })
      .catch(() => {})
      .finally(() => setWeek4WeatherLoading(false));

    // Override with stored sales data (takes priority over auto-fetch)
    (async () => {
      const weatherUpdates: Record<string, WeatherType> = {};
      for (const date of week4Dates) {
        const res = await fetch(`/api/sales?date=${date}`);
        const records = await res.json();
        const w = records.find((r: { weather?: WeatherType }) => r.weather)?.weather;
        if (w) weatherUpdates[date] = w;
      }
      if (Object.keys(weatherUpdates).length > 0) {
        setWeek4Weather((prev) => ({ ...prev, ...weatherUpdates }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate]);

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    setResult(null);

    const week4WeatherArr = week4Dates.map((date) => ({
      date,
      weather: week4Weather[date] ?? '曇り',
    }));

    try {
      const res = await fetch('/api/ai-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, week4Weather: week4WeatherArr }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'エラーが発生しました');
        return;
      }
      setResult(data);
    } catch {
      setError('通信エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }

  const hasActualData = result && result.accuracy.totalCompared > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">AI発注推奨</h1>
        <p className="text-sm text-gray-500 mt-1">
          過去3週間の実績からClaudeが4週目の最適発注数を予測します
        </p>
      </div>

      {/* Period Setup */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-4">
        <h2 className="font-semibold text-gray-700">分析期間の設定</h2>

        <div>
          <label className="text-sm text-gray-600 mb-1 block">1週目の開始日</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setResult(null); }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="grid grid-cols-4 gap-2 text-xs text-center text-gray-500">
          <div className="bg-blue-50 rounded-lg p-2">
            <div className="font-medium text-blue-700 mb-1">1週目（学習）</div>
            <div>{formatDate(week1Dates[0])} 〜 {formatDate(week1Dates[6])}</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-2">
            <div className="font-medium text-blue-700 mb-1">2週目（学習）</div>
            <div>{formatDate(week2Dates[0])} 〜 {formatDate(week2Dates[6])}</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-2">
            <div className="font-medium text-blue-700 mb-1">3週目（学習）</div>
            <div>{formatDate(week3Dates[0])} 〜 {formatDate(week3Dates[6])}</div>
          </div>
          <div className="bg-emerald-50 rounded-lg p-2">
            <div className="font-medium text-emerald-700 mb-1">4週目（予測対象）</div>
            <div>{formatDate(week4Dates[0])} 〜 {formatDate(week4Dates[6])}</div>
          </div>
        </div>

        {/* Week 4 Weather Input */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-medium text-gray-700">4週目の天気（予測に使用）</h3>
            {week4WeatherLoading && (
              <span className="text-xs text-blue-500 flex items-center gap-1">
                <span className="inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                天気取得中...
              </span>
            )}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {week4Dates.map((date) => {
              const info = week4WeatherInfo[date];
              return (
                <div key={date} className="text-center">
                  <div className="text-xs text-gray-400 mb-1">{formatDate(date)}</div>
                  {info && (
                    <div className="text-xs text-blue-500 mb-1">
                      {info.tempMax}°/{info.tempMin}°
                      {info.precipProbability !== null && (
                        <span className="text-gray-400"> 💧{info.precipProbability}%</span>
                      )}
                    </div>
                  )}
                  <select
                    value={week4Weather[date] ?? '曇り'}
                    onChange={(e) =>
                      setWeek4Weather((prev) => ({
                        ...prev,
                        [date]: e.target.value as WeatherType,
                      }))
                    }
                    className="w-full text-xs border border-gray-200 rounded px-1 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    {WEATHER_OPTIONS.map((w) => (
                      <option key={w} value={w}>{WEATHER_ICONS[w]} {w}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>

        <button
          onClick={runAnalysis}
          disabled={loading}
          className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              AI分析中...（数秒かかります）
            </>
          ) : (
            '🤖 AI分析を実行'
          )}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {result && (
        <>
          {/* Analysis Summary */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="text-xs text-emerald-600 font-medium mb-1">AIパターン分析</div>
            <p className="text-sm text-emerald-900">{result.analysis}</p>
          </div>

          {/* Accuracy Metrics (only if actual data exists) */}
          {hasActualData && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                <div className="text-xs text-gray-500 mb-1">平均絶対誤差（MAE）</div>
                <div className="text-2xl font-bold text-gray-800">
                  {result.accuracy.mae !== null ? `${result.accuracy.mae}個` : 'N/A'}
                </div>
                <div className="text-xs text-gray-400">小さいほど精度が高い</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                <div className="text-xs text-gray-500 mb-1">許容誤差内（±2個）</div>
                <div className={`text-2xl font-bold ${
                  (result.accuracy.withinTwoPercent ?? 0) >= 70 ? 'text-green-600' :
                  (result.accuracy.withinTwoPercent ?? 0) >= 50 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {result.accuracy.withinTwoPercent !== null
                    ? `${result.accuracy.withinTwoPercent}%`
                    : 'N/A'}
                </div>
                <div className="text-xs text-gray-400">70%以上で実用レベル</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                <div className="text-xs text-gray-500 mb-1">比較件数</div>
                <div className="text-2xl font-bold text-gray-800">
                  {result.accuracy.totalCompared}件
                </div>
                <div className="text-xs text-gray-400">実績データあり</div>
              </div>
            </div>
          )}

          {!hasActualData && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-800 text-sm">
              4週目の実績データがないため精度検証はできません。発注数予測のみ表示します。
            </div>
          )}

          {/* Comparison Table */}
          {result.comparison.map((day) => (
            <div key={day.date} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
                <span className="font-semibold text-gray-800">{formatDate(day.date)}</span>
                <span className="text-sm text-gray-500">
                  {WEATHER_ICONS[day.weather]} {day.weather}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-4 py-2 text-gray-500 font-medium">商品名</th>
                      <th className="text-center px-3 py-2 text-emerald-600 font-medium">AI推奨発注</th>
                      {hasActualData && (
                        <>
                          <th className="text-center px-3 py-2 text-gray-500 font-medium">実際の発注</th>
                          <th className="text-center px-3 py-2 text-gray-500 font-medium">差異</th>
                          <th className="text-center px-3 py-2 text-gray-500 font-medium">実売数</th>
                        </>
                      )}
                      <th className="text-left px-3 py-2 text-gray-400 font-normal text-xs">予測根拠</th>
                    </tr>
                  </thead>
                  <tbody>
                    {day.products.map((p, idx) => {
                      const diff = p.difference;
                      const diffColor =
                        diff === null
                          ? 'text-gray-400'
                          : Math.abs(diff) <= 2
                          ? 'text-green-600'
                          : Math.abs(diff) <= 4
                          ? 'text-yellow-600'
                          : 'text-red-600';

                      return (
                        <tr
                          key={p.productId}
                          className={idx > 0 ? 'border-t border-gray-50' : ''}
                        >
                          <td className="px-4 py-2.5 font-medium text-gray-800">
                            {p.productName}
                          </td>
                          <td className="px-3 py-2.5 text-center font-bold text-emerald-700">
                            {p.recommendedOrder}個
                          </td>
                          {hasActualData && (
                            <>
                              <td className="px-3 py-2.5 text-center text-gray-600">
                                {p.actualOrdered !== null ? `${p.actualOrdered}個` : '—'}
                              </td>
                              <td className={`px-3 py-2.5 text-center font-medium ${diffColor}`}>
                                {diff !== null
                                  ? diff > 0
                                    ? `+${diff}`
                                    : diff === 0
                                    ? '±0'
                                    : `${diff}`
                                  : '—'}
                              </td>
                              <td className="px-3 py-2.5 text-center text-gray-500">
                                {p.actualSold !== null ? `${p.actualSold}個` : '—'}
                              </td>
                            </>
                          )}
                          <td className="px-3 py-2.5 text-xs text-gray-400">
                            {p.reason}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Token Usage */}
          <div className="text-xs text-gray-400 text-right">
            トークン使用量: 入力 {result.usage.inputTokens.toLocaleString()}
            {result.usage.cacheRead > 0 && ` + キャッシュ読込 ${result.usage.cacheRead.toLocaleString()}`}
            {result.usage.cacheCreation > 0 && ` + キャッシュ書込 ${result.usage.cacheCreation.toLocaleString()}`}
            {' / 出力 '}{result.usage.outputTokens.toLocaleString()}
          </div>
        </>
      )}
    </div>
  );
}
