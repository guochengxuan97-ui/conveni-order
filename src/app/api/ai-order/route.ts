import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getProducts, getSalesRecords, getVacationPeriods } from '@/lib/dataStore';
import { WeatherType } from '@/lib/types';
import { getActiveVacation } from '@/lib/orderAlgorithm';

const client = new Anthropic();

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

function getWeekDates(startDate: string, weekIndex: number): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(startDate, weekIndex * 7 + i));
}

function extractJson(text: string): string | null {
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) return codeBlock[1].trim();
  const jsonObj = text.match(/\{[\s\S]*\}/);
  return jsonObj ? jsonObj[0] : null;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { startDate, week4Weather } = body as {
    startDate: string;
    week4Weather: { date: string; weather: WeatherType }[];
  };

  if (!startDate) {
    return NextResponse.json({ error: '開始日が必要です' }, { status: 400 });
  }

  const [products, allSales, vacations] = await Promise.all([
    getProducts(),
    getSalesRecords(),
    getVacationPeriods(),
  ]);
  if (products.length === 0) {
    return NextResponse.json({ error: '商品マスタが空です' }, { status: 400 });
  }

  const week1Dates = getWeekDates(startDate, 0);
  const week2Dates = getWeekDates(startDate, 1);
  const week3Dates = getWeekDates(startDate, 2);
  const week4Dates = getWeekDates(startDate, 3);

  const trainingDates = [...week1Dates, ...week2Dates, ...week3Dates];
  const trainingSales = allSales.filter((s) => trainingDates.includes(s.date));
  const validationSales = allSales.filter((s) => week4Dates.includes(s.date));

  const week4WeatherMap = Object.fromEntries(
    week4Weather.map((w) => [w.date, w.weather])
  );

  // Build structured training data
  const trainingData = trainingDates.map((date) => {
    const daySales = trainingSales.filter((s) => s.date === date);
    const dayOfWeek = DAY_NAMES[new Date(date).getDay()];
    const detectedWeather = daySales.find((s) => s.weather)?.weather ?? '不明';
    return {
      date,
      dayOfWeek,
      weather: detectedWeather,
      products: products.map((p) => {
        const r = daySales.find((s) => s.productId === p.id);
        return {
          id: p.id,
          name: p.name,
          category: p.category,
          sold: r?.sold ?? 0,
          wasted: r?.wasted ?? 0,
          stockout: r?.stockout ?? 0,
          markedDown: r?.markedDown ?? 0,
          markdownAmount: r?.markdownAmount ?? 0,
          ordered: r?.ordered ?? 0,
        };
      }),
    };
  });

  const week4Targets = week4Dates.map((date) => {
    const vacation = getActiveVacation(date, vacations);
    return {
      date,
      dayOfWeek: DAY_NAMES[new Date(date).getDay()],
      weather: week4WeatherMap[date] ?? '曇り',
      vacationName: vacation?.name ?? null,
      vacationReductionPct: vacation?.reductionPct ?? null,
    };
  });

  const vacationNote = vacations.length > 0
    ? `\n【店舗固有情報：大学休暇期間補正】\nこの店舗は法政大学入口店です。大学の長期休暇中は学生客が大幅に減少します。\n登録済み休暇期間:\n${vacations.map((v) => `- ${v.name}（${v.dateFrom}〜${v.dateTo}）: -${v.reductionPct}%補正`).join('\n')}\n予測対象に休暇期間が含まれる場合は、必ずその補正率を適用してください。`
    : '';

  const systemPrompt = `あなたはコンビニのデリカ商品の発注最適化AIです。
過去の販売実績データを分析し、次週の最適な発注数を予測します。${vacationNote}

【分析する指標】
- 販売数（実際に売れた数）
- 廃棄数（売れ残り）→ 過発注を示す
- 欠品数（売り切れによる機会損失）→ 過少発注を示す
- 値下げ数・値下げ額（ロス金額）→ 高い場合は発注過多または需要予測の誤り
- 天気（晴れ/曇り/雨/雪）→ 天気による需要変動
- 曜日パターン → 曜日別の需要傾向

【最適発注の目標】
廃棄ゼロ・欠品ゼロを目指しつつ、過去のパターンから最も合理的な発注数を導く。

必ずJSON形式のみで回答してください。説明文・マークダウンは不要です。`;

  const userMessage = `## 商品リスト
${products.map((p) => `- ID: "${p.id}" | 商品名: "${p.name}" | カテゴリ: ${p.category}`).join('\n')}

## 学習データ（過去3週間・21日分）
${JSON.stringify(trainingData, null, 2)}

## 予測対象（4週目の日付・曜日・天気）
${JSON.stringify(week4Targets, null, 2)}

以下のJSON形式のみで回答してください：
{
  "analysis": "学習データから読み取ったパターンの分析（200文字以内）",
  "predictions": [
    {
      "date": "YYYY-MM-DD",
      "products": [
        {
          "productId": "商品IDをそのまま使用",
          "productName": "商品名",
          "recommendedOrder": 発注数（整数）,
          "reason": "予測根拠（30文字以内）"
        }
      ]
    }
  ]
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    });

    const rawText =
      response.content[0].type === 'text' ? response.content[0].text : '';

    const jsonStr = extractJson(rawText);
    if (!jsonStr) {
      return NextResponse.json(
        { error: 'AI応答のJSON解析に失敗しました', raw: rawText },
        { status: 500 }
      );
    }

    let aiResult: {
      analysis: string;
      predictions: Array<{
        date: string;
        products: Array<{
          productId: string;
          productName: string;
          recommendedOrder: number;
          reason?: string;
        }>;
      }>;
    };

    try {
      aiResult = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json(
        { error: 'JSONのパースに失敗しました', raw: rawText },
        { status: 500 }
      );
    }

    // Compare predictions with actual week 4 data
    const comparison = aiResult.predictions.map((dayPred) => {
      const actualDaySales = validationSales.filter((s) => s.date === dayPred.date);
      const target = week4Targets.find((t) => t.date === dayPred.date);
      return {
        date: dayPred.date,
        dayOfWeek: target?.dayOfWeek ?? '',
        weather: target?.weather ?? '曇り',
        products: dayPred.products.map((pred) => {
          const actual = actualDaySales.find((s) => s.productId === pred.productId);
          return {
            productId: pred.productId,
            productName: pred.productName,
            recommendedOrder: pred.recommendedOrder,
            reason: pred.reason ?? '',
            actualOrdered: actual?.ordered ?? null,
            actualSold: actual?.sold ?? null,
            difference:
              actual != null ? pred.recommendedOrder - actual.ordered : null,
          };
        }),
      };
    });

    // Accuracy metrics (only where actual data exists)
    const compared = comparison.flatMap((d) =>
      d.products.filter((p) => p.actualOrdered !== null)
    );

    const mae =
      compared.length > 0
        ? compared.reduce((sum, p) => sum + Math.abs(p.difference!), 0) /
          compared.length
        : null;

    const withinTwo =
      compared.length > 0
        ? (compared.filter((p) => Math.abs(p.difference!) <= 2).length /
            compared.length) *
          100
        : null;

    return NextResponse.json({
      analysis: aiResult.analysis,
      comparison,
      accuracy: {
        mae: mae !== null ? Math.round(mae * 10) / 10 : null,
        withinTwoPercent: withinTwo !== null ? Math.round(withinTwo) : null,
        totalCompared: compared.length,
      },
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheCreation: response.usage.cache_creation_input_tokens ?? 0,
        cacheRead: response.usage.cache_read_input_tokens ?? 0,
      },
    });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Claude APIエラー: ${error.message}` },
        { status: error.status ?? 500 }
      );
    }
    throw error;
  }
}
