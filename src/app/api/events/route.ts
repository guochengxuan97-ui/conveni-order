import { NextRequest, NextResponse } from 'next/server';
import { getEvents, saveEvents } from '@/lib/dataStore';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  const events = await getEvents();
  return NextResponse.json(events);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const events = await getEvents();
  const newEvent = {
    id: uuidv4(),
    name: String(body.name ?? ''),
    date: String(body.date ?? ''),
    note: String(body.note ?? ''),
  };
  events.push(newEvent);
  await saveEvents(events);
  return NextResponse.json(newEvent, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const events = await getEvents();
  const index = events.findIndex((e) => e.id === body.id);
  if (index === -1) {
    return NextResponse.json({ error: 'イベントが見つかりません' }, { status: 404 });
  }
  events[index] = {
    id: body.id,
    name: String(body.name ?? ''),
    date: String(body.date ?? ''),
    note: String(body.note ?? ''),
  };
  await saveEvents(events);
  return NextResponse.json(events[index]);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'idが必要です' }, { status: 400 });
  }
  const events = await getEvents();
  const filtered = events.filter((e) => e.id !== id);
  if (filtered.length === events.length) {
    return NextResponse.json({ error: 'イベントが見つかりません' }, { status: 404 });
  }
  await saveEvents(filtered);
  return NextResponse.json({ success: true });
}
