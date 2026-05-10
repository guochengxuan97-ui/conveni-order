import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { base64, mimeType, products } = await req.json();
  if (!base64) return NextResponse.json({ error: '画像が必要です' }, { status: 400 });

  const productList = (products as { id: string; name: string }[])
    .map((p) => `- "${p.name}"（id: "${p.id}"）`)
    .join('\n');

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType ?? 'image/jpeg', data: base64 },
          },
          {
            type: 'text',
            text: `このPOSレポートや販売集計画像から販売データを読み取り、以下のJSON形式のみで回答してください（説明不要）：
{"items":[{"productId":"一致するidまたはnull","productName":"商品名","sold":販売数,"wasted":廃棄数,"markedDown":値下げ販売数,"markdownAmount":値下げ額合計}]}

登録済み商品一覧（商品名で一致するものがあれば productId を設定してください）：
${productList}

・数値が読み取れない場合は 0 を入れてください
・markdownAmount は値下げによる損失額の合計（円）です`,
          },
        ],
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('JSON not found in response');
    return NextResponse.json(JSON.parse(match[0]));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
