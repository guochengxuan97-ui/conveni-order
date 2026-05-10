import { NextRequest, NextResponse } from 'next/server';
import { getFactorSettings, saveFactorSettings } from '@/lib/dataStore';

export async function GET() {
  const settings = await getFactorSettings();
  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  await saveFactorSettings(body);
  return NextResponse.json(body);
}
