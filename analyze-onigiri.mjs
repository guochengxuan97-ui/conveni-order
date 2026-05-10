import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load API key from .env.local
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const [key, ...rest] = line.split('=');
    if (key && rest.length > 0) {
      process.env[key.trim()] = rest.join('=').trim();
    }
  }
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY === 'your_api_key_here') {
  console.error('エラー: .env.local に ANTHROPIC_API_KEY を設定してください');
  process.exit(1);
}

import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const DATA_DIR = path.join(__dirname, 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const SALES_FILE = path.join(DATA_DIR, 'sales.json');

// ── 1. おにぎり商品を登録 ─────────────────────────────
const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
const PRODUCT_ID = 'onigiri-all';

if (!products.find((p) => p.id === PRODUCT_ID)) {
  products.push({
    id: PRODUCT_ID,
    name: 'おにぎり（全種）',
    category: 'おにぎり・おむすび',
    defaultOrder: 200,
    shelfLife: 1,
    isDeliItem: true,
    deliverySlotCount: 1,
    overOrderTolerance: 10,
    underOrderTolerance: 5,
    hasOrderCorrectionPeriod: false,
    correctionDeadlineHour: 10,
    markdownRules: [],
    createdAt: new Date().toISOString(),
  });
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
  console.log('✅ おにぎり商品を登録しました');
} else {
  console.log('ℹ️  おにぎり商品はすでに登録済みです');
}

// ── 2. 21日分の販売実績を登録 ─────────────────────────
const rawSales = [
  // 1週目
  { date: '2026-04-12', weather: '曇り', detailedWeather: '曇のち晴', tempHi: 23, tempLo: 10, ordered: 280, sold: 280, wasted: 0, markedDown: 40 },
  { date: '2026-04-13', weather: '晴れ', detailedWeather: '晴',       tempHi: 24, tempLo:  9, ordered: 160, sold: 160, wasted: 0, markedDown: 32 },
  { date: '2026-04-14', weather: '晴れ', detailedWeather: '晴',       tempHi: 24, tempLo: 10, ordered: 181, sold: 181, wasted: 0, markedDown: 11 },
  { date: '2026-04-15', weather: '曇り', detailedWeather: '曇のち雨',  tempHi: 22, tempLo: 14, ordered: 178, sold: 178, wasted: 0, markedDown:  1 },
  { date: '2026-04-16', weather: '晴れ', detailedWeather: '晴のち雨',  tempHi: 25, tempLo: 11, ordered: 195, sold: 195, wasted: 0, markedDown: 19 },
  { date: '2026-04-17', weather: '晴れ', detailedWeather: '晴',       tempHi: 20, tempLo: 10, ordered: 182, sold: 182, wasted: 0, markedDown: 42 },
  { date: '2026-04-18', weather: '晴れ', detailedWeather: '晴',       tempHi: 24, tempLo:  8, ordered: 273, sold: 273, wasted: 0, markedDown: 25 },
  // 2週目
  { date: '2026-04-19', weather: '晴れ', detailedWeather: '晴',       tempHi: 27, tempLo: 11, ordered: 426, sold: 426, wasted:  0, markedDown: 11 },
  { date: '2026-04-20', weather: '晴れ', detailedWeather: '晴時々曇',  tempHi: 26, tempLo: 14, ordered: 203, sold: 203, wasted:  0, markedDown: 18 },
  { date: '2026-04-21', weather: '曇り', detailedWeather: '曇のち晴',  tempHi: 24, tempLo: 11, ordered: 188, sold: 186, wasted:  2, markedDown: 33 },
  { date: '2026-04-22', weather: '晴れ', detailedWeather: '晴時々曇',  tempHi: 22, tempLo:  8, ordered: 174, sold: 174, wasted:  0, markedDown:  9 },
  { date: '2026-04-23', weather: '曇り', detailedWeather: '曇のち雨',  tempHi: 17, tempLo: 12, ordered: 159, sold: 158, wasted:  1, markedDown:  8 },
  { date: '2026-04-24', weather: '雨',   detailedWeather: '雨',       tempHi: 21, tempLo: 12, ordered: 203, sold: 200, wasted:  3, markedDown: 58 },
  { date: '2026-04-25', weather: '曇り', detailedWeather: '曇のち晴',  tempHi: 19, tempLo: 10, ordered: 274, sold: 269, wasted:  5, markedDown: 40 },
  // 3週目
  { date: '2026-04-26', weather: '晴れ', detailedWeather: '晴',       tempHi: 23, tempLo:  8, ordered: 249, sold: 248, wasted:  1, markedDown: 30 },
  { date: '2026-04-27', weather: '雨',   detailedWeather: '雨のち曇',  tempHi: 22, tempLo: 12, ordered: 145, sold: 145, wasted:  0, markedDown: 10 },
  { date: '2026-04-28', weather: '晴れ', detailedWeather: '晴時々曇',  tempHi: 26, tempLo:  9, ordered: 192, sold: 192, wasted:  0, markedDown:  0 },
  { date: '2026-04-29', weather: '曇り', detailedWeather: '曇のち雨',  tempHi: 19, tempLo: 13, ordered: 246, sold: 234, wasted: 12, markedDown: 34 },
  { date: '2026-04-30', weather: '雨',   detailedWeather: '雨のち晴',  tempHi: 15, tempLo: 10, ordered: 158, sold: 155, wasted:  3, markedDown: 35 },
  { date: '2026-05-01', weather: '雨',   detailedWeather: '雨のち晴',  tempHi: 21, tempLo: 10, ordered: 143, sold: 143, wasted:  0, markedDown: 36 },
  { date: '2026-05-02', weather: '晴れ', detailedWeather: '晴のち曇',  tempHi: 28, tempLo:  9, ordered: 281, sold: 281, wasted:  0, markedDown:  0 },
];

const existingSales = JSON.parse(fs.readFileSync(SALES_FILE, 'utf8'));
const targetDates = rawSales.map((r) => r.date);
const filteredSales = existingSales.filter(
  (s) => !(s.productId === PRODUCT_ID && targetDates.includes(s.date))
);

const newRecords = rawSales.map((r) => ({
  id: crypto.randomUUID(),
  date: r.date,
  productId: PRODUCT_ID,
  sold: r.sold,
  wasted: r.wasted,
  stockout: 0,
  ordered: r.ordered,
  markedDown: r.markedDown,
  markdownAmount: 0,
  weather: r.weather,
}));

fs.writeFileSync(SALES_FILE, JSON.stringify([...filteredSales, ...newRecords], null, 2));
console.log(`✅ ${newRecords.length}日分の販売実績を登録しました`);

// ── 3. Claude API で試算 ─────────────────────────────
const week4Targets = [
  { date: '2026-05-03', day: '日', detailedWeather: '曇',      tempHi: 26, tempLo: 13, holiday: '憲法記念日（GW）' },
  { date: '2026-05-04', day: '月', detailedWeather: '晴のち雨', tempHi: 30, tempLo: 15, holiday: 'みどりの日（GW）' },
  { date: '2026-05-05', day: '火', detailedWeather: '晴',       tempHi: 25, tempLo: 12, holiday: 'こどもの日（GW）' },
  { date: '2026-05-06', day: '水', detailedWeather: '曇',       tempHi: 21, tempLo: 11, holiday: null },
  { date: '2026-05-07', day: '木', detailedWeather: '晴',       tempHi: 27, tempLo: 13, holiday: null },
  { date: '2026-05-08', day: '金', detailedWeather: '曇',       tempHi: 26, tempLo: 15, holiday: null },
  { date: '2026-05-09', day: '土', detailedWeather: '晴時々曇', tempHi: 24, tempLo: 12, holiday: null },
];

const trainingText = rawSales.map((r) => {
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const d = new Date(r.date);
  const day = dayNames[d.getDay()];
  const isHoliday = r.date === '2026-04-29' ? '（昭和の日・祝日）' : '';
  return `${r.date}(${day})${isHoliday} 天気:${r.detailedWeather} 気温:${r.tempHi}/${r.tempLo}℃ 納品:${r.ordered} 販売:${r.sold} 廃棄:${r.wasted} 値下:${r.markedDown}`;
}).join('\n');

const predictionText = week4Targets.map((t) => {
  const holidayNote = t.holiday ? `（${t.holiday}）` : '';
  return `${t.date}(${t.day})${holidayNote} 天気:${t.detailedWeather} 気温:${t.tempHi}/${t.tempLo}℃`;
}).join('\n');

const systemPrompt = `あなたはコンビニのおにぎり発注最適化AIです。
過去3週間の販売実績を分析し、次週の最適な納品数（発注数）を予測します。

【重要な観点】
- 曜日パターン：土日は平日より大幅に多い傾向
- 天気影響：雨・気温低下 → 来客減 → 販売減
- 気温：高い日（25℃超）はアイテム需要増の傾向
- 値下数：多い日 = 過発注のサイン
- 廃棄数：多い日 = 発注過多のサイン
- 祝日・連休：通常と異なる需要パターン（4/29昭和の日の実績を参考に）

【納品数の目標】廃棄ゼロ・欠品ゼロを目指し、値下リスクを最小化する

必ずJSON形式のみで回答してください。`;

const userMessage = `## 過去3週間の販売実績（おにぎり全種合計）
${trainingText}

## 試算してほしい期間（5/3〜5/9）
${predictionText}
※5/3〜5/5はゴールデンウィーク（憲法記念日・みどりの日・こどもの日）

以下のJSON形式のみで回答してください：
{
  "analysis": "学習データから読み取ったパターン分析（300文字以内）",
  "predictions": [
    {
      "date": "YYYY-MM-DD",
      "day": "曜日",
      "recommendedOrder": 納品数（整数）,
      "markdownRisk": "高・中・低のいずれか",
      "reason": "予測根拠（50文字以内）"
    }
  ]
}`;

console.log('\n🤖 Claude API に試算をリクエスト中...\n');

const response = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 2048,
  system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
  messages: [{ role: 'user', content: userMessage }],
});

const rawText = response.content[0].type === 'text' ? response.content[0].text : '';

// JSON extraction
let jsonStr = null;
const codeBlock = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
if (codeBlock) jsonStr = codeBlock[1].trim();
else {
  const match = rawText.match(/\{[\s\S]*\}/);
  if (match) jsonStr = match[0];
}

if (!jsonStr) {
  console.error('JSON解析失敗。生の応答:');
  console.log(rawText);
  process.exit(1);
}

const result = JSON.parse(jsonStr);

// ── 4. 結果出力 ─────────────────────────────
console.log('═'.repeat(60));
console.log('📊 AIパターン分析');
console.log('─'.repeat(60));
console.log(result.analysis);
console.log('');
console.log('═'.repeat(60));
console.log('📦 5/3〜5/9 推奨納品数');
console.log('─'.repeat(60));
console.log('日付         推奨数  値下げリスク  予測根拠');
console.log('─'.repeat(60));

for (const p of result.predictions) {
  const d = new Date(p.date);
  const label = `${d.getMonth() + 1}/${d.getDate()}(${p.day ?? ['日','月','火','水','木','金','土'][d.getDay()]})`;
  const risk = p.markdownRisk === '高' ? '🔴高' : p.markdownRisk === '中' ? '🟡中' : '🟢低';
  console.log(`${label.padEnd(12)} ${String(p.recommendedOrder).padStart(4)}個  ${risk.padEnd(8)}  ${p.reason}`);
}

console.log('─'.repeat(60));
console.log(`\nトークン使用量: 入力 ${response.usage.input_tokens.toLocaleString()} + キャッシュ書込 ${(response.usage.cache_creation_input_tokens ?? 0).toLocaleString()} / 出力 ${response.usage.output_tokens.toLocaleString()}`);
