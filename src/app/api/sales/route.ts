import { NextRequest, NextResponse } from 'next/server';
import { getSalesRecords, saveSalesRecords } from '@/lib/dataStore';
import { SalesRecord } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const productId = searchParams.get('productId');

  let records = await getSalesRecords();
  if (date) records = records.filter((r) => r.date === date);
  if (productId) records = records.filter((r) => r.productId === productId);

  return NextResponse.json(records);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const records = await getSalesRecords();

  if (!Array.isArray(body)) {
    return NextResponse.json({ error: '配列で送信してください' }, { status: 400 });
  }

  const date = body[0]?.date;
  if (!date) {
    return NextResponse.json({ error: '日付が必要です' }, { status: 400 });
  }

  const filtered = records.filter((r) => r.date !== date);

  const newRecords: SalesRecord[] = body
    .filter((item) =>
      item.ordered > 0 || item.sold > 0 || item.wasted > 0 ||
      item.stockout > 0 || item.markedDown > 0 || item.markdownAmount > 0
    )
    .map((item) => ({
      id: uuidv4(),
      date: item.date,
      productId: item.productId,
      sold: Number(item.sold) || 0,
      wasted: Number(item.wasted) || 0,
      stockout: Number(item.stockout) || 0,
      ordered: Number(item.ordered) || 0,
      markedDown: Number(item.markedDown) || 0,
      markdownAmount: Number(item.markdownAmount) || 0,
      weather: item.weather ?? undefined,
    }));

  await saveSalesRecords([...filtered, ...newRecords]);
  return NextResponse.json(newRecords, { status: 201 });
}
