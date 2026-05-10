import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { ProductCategory } from '@/lib/types';

const client = new Anthropic();
const CATEGORIES: ProductCategory[] = ['弁当', 'おにぎり・おむすび', 'サンドイッチ', 'サラダ', 'パスタ', 'その他'];

export async function POST(req: NextRequest) {
  const { base64, mimeType } = await req.json();
  if (!base64) return NextResponse.json({ error: '画像が必要です' }, { status: 400 });

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType ?? 'image/jpeg', data: base64 },
          },
          {
            type: 'text',
            text: `この画像から商品情報を読み取り、以下のJSON形式のみで回答してください（説明不要）：
{"name":"商品名","category":"弁当|おにぎり・おむすび|サンドイッチ|サラダ|パスタ|その他","price":価格か null,"shelfLife":賞味期限日数か null}
・category は必ず上記6つのいずれか1つを選んでください
・price は税込み価格の数値（円）、読み取れなければ null
・shelfLife はコンビニ食品なら通常1（日）、それ以外は null`,
          },
        ],
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const match = text.match(/\{[\s\S]*?\}/);
    if (!match) throw new Error('JSON not found in response');
    const data = JSON.parse(match[0]);
    if (!CATEGORIES.includes(data.category)) data.category = 'その他';
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
