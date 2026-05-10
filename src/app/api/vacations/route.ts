import { NextRequest, NextResponse } from 'next/server';
import { getVacationPeriods, saveVacationPeriods } from '@/lib/dataStore';
import { VacationPeriod } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  return NextResponse.json(await getVacationPeriods());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const vacations = await getVacationPeriods();
  const newVac: VacationPeriod = {
    id: uuidv4(),
    name: body.name,
    dateFrom: body.dateFrom,
    dateTo: body.dateTo,
    reductionPct: Number(body.reductionPct) || 15,
    note: body.note ?? '',
  };
  await saveVacationPeriods([...vacations, newVac]);
  return NextResponse.json(newVac, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const vacations = await getVacationPeriods();
  const updated = vacations.map((v) =>
    v.id === body.id
      ? { ...v, name: body.name, dateFrom: body.dateFrom, dateTo: body.dateTo, reductionPct: Number(body.reductionPct) || v.reductionPct, note: body.note ?? v.note }
      : v
  );
  await saveVacationPeriods(updated);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await saveVacationPeriods((await getVacationPeriods()).filter((v) => v.id !== id));
  return NextResponse.json({ ok: true });
}
