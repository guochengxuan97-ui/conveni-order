import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const [key, ...rest] = line.split('=');
    if (key && rest.length > 0) process.env[key.trim()] = rest.join('=').trim();
  }
}
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY === 'your_api_key_here') {
  console.error('エラー: .env.local に ANTHROPIC_API_KEY を設定してください');
  process.exit(1);
}

import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ── 定数 ─────────────────────────────────────────────
const LAT = 35.5847;
const LON = 139.3721;
const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

// ── WMOコード → 天気文字列 ────────────────────────────
const WMO_LABELS = {
  0: '快晴', 1: '晴れ', 2: '晴れ時々曇', 3: '曇り',
  45: '霧', 48: '霧',
  51: '霧雨（弱）', 53: '霧雨', 55: '霧雨（強）',
  61: '雨（弱）', 63: '雨', 65: '雨（強）',
  71: '雪（弱）', 73: '雪', 75: '雪（強）', 77: '雪粒',
  80: '雨のち曇', 81: 'にわか雨', 82: 'にわか雨（強）',
  85: 'にわか雪', 86: 'にわか雪（強）',
  95: '雷雨', 96: '雷雨（ひょう）', 99: '雷雨（大ひょう）',
};

function wmoToLabel(code) {
  return WMO_LABELS[code] ?? `不明(${code})`;
}

function wmoToCategory(code) {
  if (code <= 1) return '晴れ';
  if (code <= 3 || code === 45 || code === 48) return '曇り';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return '雪';
  return '雨';
}

// ── ステップ1：Open-Meteoから天気取得 ─────────────────
console.log('【ステップ1】Open-Meteoから天気データを取得中...');

const TRAIN_START = '2026-04-12';
const TRAIN_END   = '2026-05-02';
const PRED_START  = '2026-05-03';
const PRED_END    = '2026-05-09';
const ALL_START   = TRAIN_START;
const ALL_END     = PRED_END;

const today = new Date().toISOString().split('T')[0];
const pastDays = Math.ceil((Date.parse(today) - Date.parse(ALL_START)) / 86400000);

const meteoUrl = new URL('https://api.open-meteo.com/v1/forecast');
meteoUrl.searchParams.set('latitude', String(LAT));
meteoUrl.searchParams.set('longitude', String(LON));
meteoUrl.searchParams.set('daily', [
  'weathercode',
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_probability_max',
  'precipitation_sum',
].join(','));
meteoUrl.searchParams.set('timezone', 'Asia/Tokyo');
meteoUrl.searchParams.set('past_days', String(Math.min(pastDays + 1, 92)));
meteoUrl.searchParams.set('forecast_days', '16');

const meteoRes = await fetch(meteoUrl.toString());
if (!meteoRes.ok) throw new Error(`Open-Meteo APIエラー: ${meteoRes.status}`);
const meteoJson = await meteoRes.json();

const weatherByDate = {};
for (let i = 0; i < meteoJson.daily.time.length; i++) {
  const date = meteoJson.daily.time[i];
  if (date < ALL_START || date > ALL_END) continue;
  weatherByDate[date] = {
    date,
    code: meteoJson.daily.weathercode[i],
    label: wmoToLabel(meteoJson.daily.weathercode[i]),
    category: wmoToCategory(meteoJson.daily.weathercode[i]),
    tempMax: Math.round(meteoJson.daily.temperature_2m_max[i]),
    tempMin: Math.round(meteoJson.daily.temperature_2m_min[i]),
    precipProb: meteoJson.daily.precipitation_probability_max?.[i] ?? null,
    precipSum: Math.round((meteoJson.daily.precipitation_sum[i] ?? 0) * 10) / 10,
  };
}

console.log('取得完了。学習期間の天気:');
console.log('日付         天気(詳細)      最高 最低 降水確率 降水量');
console.log('─'.repeat(62));
for (const date of Object.keys(weatherByDate).filter(d => d <= TRAIN_END)) {
  const w = weatherByDate[date];
  const d = new Date(date);
  const label = `${d.getMonth()+1}/${d.getDate()}(${DAY_NAMES[d.getDay()]})`;
  console.log(
    `${label.padEnd(12)} ${w.label.padEnd(14)} ${String(w.tempMax).padStart(3)}° ${String(w.tempMin).padStart(3)}°` +
    (w.precipProb !== null ? ` ${String(w.precipProb).padStart(5)}%` : '    N/A') +
    ` ${String(w.precipSum).padStart(5)}mm`
  );
}
console.log('');
console.log('試算期間の天気:');
console.log('日付         天気(詳細)      最高 最低 降水確率 降水量');
console.log('─'.repeat(62));
for (const date of Object.keys(weatherByDate).filter(d => d >= PRED_START)) {
  const w = weatherByDate[date];
  const d = new Date(date);
  const label = `${d.getMonth()+1}/${d.getDate()}(${DAY_NAMES[d.getDay()]})`;
  console.log(
    `${label.padEnd(12)} ${w.label.padEnd(14)} ${String(w.tempMax).padStart(3)}° ${String(w.tempMin).padStart(3)}°` +
    (w.precipProb !== null ? ` ${String(w.precipProb).padStart(5)}%` : '    N/A') +
    ` ${String(w.precipSum).padStart(5)}mm`
  );
}
console.log('');

// ── ステップ2：学習データ（販売実績 + 天気を合わせる）────
const salesData = [
  { date: '2026-04-12', ordered: 280, sold: 280, wasted: 0,  markedDown: 40 },
  { date: '2026-04-13', ordered: 160, sold: 160, wasted: 0,  markedDown: 32 },
  { date: '2026-04-14', ordered: 181, sold: 181, wasted: 0,  markedDown: 11 },
  { date: '2026-04-15', ordered: 178, sold: 178, wasted: 0,  markedDown:  1 },
  { date: '2026-04-16', ordered: 195, sold: 195, wasted: 0,  markedDown: 19 },
  { date: '2026-04-17', ordered: 182, sold: 182, wasted: 0,  markedDown: 42 },
  { date: '2026-04-18', ordered: 273, sold: 273, wasted: 0,  markedDown: 25 },
  { date: '2026-04-19', ordered: 426, sold: 426, wasted:  0, markedDown: 11 },
  { date: '2026-04-20', ordered: 203, sold: 203, wasted:  0, markedDown: 18 },
  { date: '2026-04-21', ordered: 188, sold: 186, wasted:  2, markedDown: 33 },
  { date: '2026-04-22', ordered: 174, sold: 174, wasted:  0, markedDown:  9 },
  { date: '2026-04-23', ordered: 159, sold: 158, wasted:  1, markedDown:  8 },
  { date: '2026-04-24', ordered: 203, sold: 200, wasted:  3, markedDown: 58 },
  { date: '2026-04-25', ordered: 274, sold: 269, wasted:  5, markedDown: 40 },
  { date: '2026-04-26', ordered: 249, sold: 248, wasted:  1, markedDown: 30 },
  { date: '2026-04-27', ordered: 145, sold: 145, wasted:  0, markedDown: 10 },
  { date: '2026-04-28', ordered: 192, sold: 192, wasted:  0, markedDown:  0 },
  { date: '2026-04-29', ordered: 246, sold: 234, wasted: 12, markedDown: 34 },
  { date: '2026-04-30', ordered: 158, sold: 155, wasted:  3, markedDown: 35 },
  { date: '2026-05-01', ordered: 143, sold: 143, wasted:  0, markedDown: 36 },
  { date: '2026-05-02', ordered: 281, sold: 281, wasted:  0, markedDown:  0 },
];

const actuals = [
  { date: '2026-05-03', ordered: 297, sold: 257, wasted:  7 },
  { date: '2026-05-04', ordered: 235, sold: 225, wasted: 11 },
  { date: '2026-05-05', ordered: 226, sold: 253, wasted:  1 },
  { date: '2026-05-06', ordered: 181, sold: 179, wasted:  0 },
  { date: '2026-05-07', ordered: 189, sold: 182, wasted:  0 },
  { date: '2026-05-08', ordered: 158, sold: 174, wasted:  1 },
  { date: '2026-05-09', ordered: 268, sold: 269, wasted:  1 },
];

// ── ステップ4：Claude API で試算 ──────────────────────
const trainingText = salesData.map((r) => {
  const d = new Date(r.date);
  const day = DAY_NAMES[d.getDay()];
  const w = weatherByDate[r.date];
  const isHoliday = r.date === '2026-04-29' ? '（昭和の日・祝日）' : '';
  const weatherStr = w
    ? `${w.label} ${w.tempMax}°/${w.tempMin}° 降水${w.precipSum}mm`
    : '不明';
  return `${r.date}(${day})${isHoliday} [${weatherStr}] 納品:${r.ordered} 販売:${r.sold} 廃棄:${r.wasted} 値下:${r.markedDown}`;
}).join('\n');

const predictionText = actuals.map((r) => {
  const d = new Date(r.date);
  const day = DAY_NAMES[d.getDay()];
  const w = weatherByDate[r.date];
  const holidays = {
    '2026-05-03': '（憲法記念日・GW）',
    '2026-05-04': '（みどりの日・GW）',
    '2026-05-05': '（こどもの日・GW）',
  };
  const holiday = holidays[r.date] ?? '';
  const weatherStr = w
    ? `${w.label} ${w.tempMax}°/${w.tempMin}° 降水${w.precipSum}mm`
    : '不明';
  return `${r.date}(${day})${holiday} [${weatherStr}]`;
}).join('\n');

const systemPrompt = `あなたはコンビニのおにぎり発注最適化AIです。
過去3週間の販売実績と正確な天気データを分析し、次週の最適な納品数を予測します。

【分析ポイント】
- 曜日パターン：土日 > 平日の傾向
- 天気：晴れ・高気温 → 需要増、雨・低気温 → 需要減
- 降水量：多いほど来客減
- 値下数：多い = 過発注のサイン
- 廃棄数：多い = 発注過多
- 連休・祝日：4/29昭和の日の実績を参考に（GW期間は特殊需要）

天気データはOpen-Meteoの実測値を使用しています。

JSON形式のみで回答してください。`;

const userMessage = `## 学習データ（過去3週間 + Open-Meteo実測天気）
${trainingText}

## 試算対象（5/3〜5/9、Open-Meteo実測/予測天気）
${predictionText}

以下のJSON形式のみで回答してください：
{
  "analysis": "パターン分析（300文字以内）",
  "predictions": [
    {
      "date": "YYYY-MM-DD",
      "recommendedOrder": 納品数（整数）,
      "markdownRisk": "高・中・低のいずれか",
      "reason": "根拠（60文字以内）"
    }
  ]
}`;

console.log('【ステップ4】Claude API で試算中...\n');

const response = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 2048,
  system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
  messages: [{ role: 'user', content: userMessage }],
});

const rawText = response.content[0].type === 'text' ? response.content[0].text : '';
const codeBlock = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
const jsonStr = codeBlock ? codeBlock[1].trim() : (rawText.match(/\{[\s\S]*\}/) ?? [null])[0];
if (!jsonStr) { console.error('JSON解析失敗\n', rawText); process.exit(1); }

const result = JSON.parse(jsonStr);

// ── 結果出力 ──────────────────────────────────────────
console.log('═'.repeat(70));
console.log('📊 AIパターン分析（Open-Meteo実測天気使用）');
console.log('─'.repeat(70));
console.log(result.analysis);
console.log('');

console.log('═'.repeat(70));
console.log('📦 5/3〜5/9 推奨納品数 vs 実績比較');
console.log('─'.repeat(70));
console.log('日付        天気(実測)     AI推奨  実際 差分  リスク  根拠');
console.log('─'.repeat(70));

let totalAbsDiff = 0;
let withinTwo = 0;

for (const pred of result.predictions) {
  const d = new Date(pred.date);
  const day = DAY_NAMES[d.getDay()];
  const label = `${d.getMonth()+1}/${d.getDate()}(${day})`;
  const actual = actuals.find(a => a.date === pred.date);
  const w = weatherByDate[pred.date];
  const weatherStr = w ? `${w.label}`.padEnd(10) : '不明'.padEnd(10);

  const diff = actual ? pred.recommendedOrder - actual.ordered : null;
  const absDiff = diff !== null ? Math.abs(diff) : 0;
  totalAbsDiff += absDiff;
  if (diff !== null && absDiff <= 2) withinTwo++;

  const diffStr = diff === null ? '  N/A' :
    diff > 0 ? `  +${diff}` : diff === 0 ? '  ±0' : `  ${diff}`;
  const diffColor = diff === null ? '' :
    absDiff <= 10 ? '' : absDiff <= 20 ? '⚠️' : '❌';
  const risk = pred.markdownRisk === '高' ? '🔴高' : pred.markdownRisk === '中' ? '🟡中' : '🟢低';

  console.log(
    `${label.padEnd(10)} ${weatherStr} ${String(pred.recommendedOrder).padStart(5)}個` +
    (actual ? `  ${String(actual.ordered).padStart(4)}個 ${diffStr.padStart(5)} ${diffColor}` : '     N/A') +
    `  ${risk}  ${pred.reason}`
  );
}

// ── 精度サマリー ─────────────────────────────────────
const n = actuals.length;
const mae = Math.round(totalAbsDiff / n * 10) / 10;
const withinTwoPct = Math.round(withinTwo / n * 100);

console.log('─'.repeat(70));
console.log(`\n📈 精度サマリー（AI推奨 vs 実際の納品数）`);
console.log(`  平均絶対誤差（MAE）: ${mae}個`);
console.log(`  ±2個以内の的中率 : ${withinTwoPct}% (${withinTwo}/${n}日)`);
console.log('');

// ── 実績の振り返り ────────────────────────────────────
console.log('📋 実績の振り返り（ヒンドサイト）');
console.log('─'.repeat(70));
console.log('日付        AI推奨  実際納品  実際販売  廃棄  評価');
console.log('─'.repeat(70));

for (const pred of result.predictions) {
  const d = new Date(pred.date);
  const day = DAY_NAMES[d.getDay()];
  const label = `${d.getMonth()+1}/${d.getDate()}(${day})`;
  const actual = actuals.find(a => a.date === pred.date);
  if (!actual) continue;

  const stockout = actual.sold > actual.ordered ? actual.sold - actual.ordered : 0;
  const excess = actual.wasted;
  let eval_ = '✅';
  if (excess >= 10) eval_ = '🔴過発注';
  else if (excess >= 5) eval_ = '🟡やや過多';
  else if (stockout > 10) eval_ = '🔴欠品大';
  else if (stockout > 0) eval_ = '🟡欠品';
  else if (excess > 0) eval_ = '🟡わずか廃棄';

  console.log(
    `${label.padEnd(10)} ${String(pred.recommendedOrder).padStart(5)}個` +
    `  ${String(actual.ordered).padStart(6)}個` +
    `  ${String(actual.sold).padStart(6)}個` +
    `  ${String(actual.wasted).padStart(3)}個` +
    `  ${eval_}`
  );
}

console.log('');
console.log(`トークン: 入力 ${response.usage.input_tokens.toLocaleString()} + キャッシュ書込 ${(response.usage.cache_creation_input_tokens ?? 0).toLocaleString()} / 出力 ${response.usage.output_tokens.toLocaleString()}`);
