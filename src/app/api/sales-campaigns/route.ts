import { NextRequest, NextResponse } from 'next/server';
import { getSaleCampaigns, saveSaleCampaigns } from '@/lib/dataStore';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  const campaigns = await getSaleCampaigns();
  return NextResponse.json(campaigns);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const campaigns = await getSaleCampaigns();
  const newCampaign = {
    id: uuidv4(),
    name: String(body.name ?? ''),
    dateFrom: String(body.dateFrom ?? ''),
    dateTo: String(body.dateTo ?? ''),
    note: String(body.note ?? ''),
  };
  campaigns.push(newCampaign);
  await saveSaleCampaigns(campaigns);
  return NextResponse.json(newCampaign, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const campaigns = await getSaleCampaigns();
  const index = campaigns.findIndex((c) => c.id === body.id);
  if (index === -1) {
    return NextResponse.json({ error: 'セールキャンペーンが見つかりません' }, { status: 404 });
  }
  campaigns[index] = {
    id: body.id,
    name: String(body.name ?? ''),
    dateFrom: String(body.dateFrom ?? ''),
    dateTo: String(body.dateTo ?? ''),
    note: String(body.note ?? ''),
  };
  await saveSaleCampaigns(campaigns);
  return NextResponse.json(campaigns[index]);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'idが必要です' }, { status: 400 });
  }
  const campaigns = await getSaleCampaigns();
  const filtered = campaigns.filter((c) => c.id !== id);
  if (filtered.length === campaigns.length) {
    return NextResponse.json({ error: 'セールキャンペーンが見つかりません' }, { status: 404 });
  }
  await saveSaleCampaigns(filtered);
  return NextResponse.json({ success: true });
}
