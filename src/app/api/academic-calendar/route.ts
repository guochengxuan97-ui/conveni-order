import { NextRequest, NextResponse } from 'next/server';
import { getAcademicCalendar, saveAcademicCalendar } from '@/lib/dataStore';
import { AcademicPeriod, AcademicPeriodType } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

const FETCH_URLS = [
  'https://www.hosei.ac.jp/tama/',
  'https://www.hosei.ac.jp/tama/campuslife/',
];

const PERIOD_TYPE_DEFAULTS: Record<string, { type: AcademicPeriodType; factor: number }> = {
  '授業': { type: 'class', factor: 1.0 },
  '講義': { type: 'class', factor: 1.0 },
  '試験': { type: 'exam', factor: 0.85 },
  'テスト': { type: 'exam', factor: 0.85 },
  '夏季休暇': { type: 'vacation', factor: 0.75 },
  '夏休み': { type: 'vacation', factor: 0.75 },
  '冬季休暇': { type: 'vacation', factor: 0.75 },
  '冬休み': { type: 'vacation', factor: 0.75 },
  '春季休暇': { type: 'vacation', factor: 0.75 },
  '春休み': { type: 'vacation', factor: 0.75 },
  'GW': { type: 'vacation', factor: 0.80 },
  'ゴールデンウィーク': { type: 'vacation', factor: 0.80 },
  'オープンキャンパス': { type: 'event', factor: 1.15 },
  '入学式': { type: 'event', factor: 1.10 },
  '卒業式': { type: 'event', factor: 1.10 },
  '創立記念': { type: 'closed', factor: 0.65 },
};

function detectPeriodType(name: string): { type: AcademicPeriodType; factor: number } {
  for (const [keyword, config] of Object.entries(PERIOD_TYPE_DEFAULTS)) {
    if (name.includes(keyword)) return config;
  }
  return { type: 'class', factor: 1.0 };
}

// Parse Japanese date strings like "4月7日" or "4月7日（火）"
function parseJpDate(text: string, year: number): string | null {
  const m = text.match(/(\d{1,2})月\s*(\d{1,2})日/);
  if (!m) return null;
  const month = parseInt(m[1]);
  const day = parseInt(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Try to extract academic periods from HTML content
function parseHtml(html: string, year: number): AcademicPeriod[] {
  const periods: AcademicPeriod[] = [];

  // Look for date range patterns: "4月7日〜7月22日" or "4月7日～7月22日"
  const rangePattern = /(.{2,20})[　 ]*(\d{1,2})月(\d{1,2})日[（(][^)）]*[)）]?\s*[〜～－\-–]\s*(\d{1,2})月(\d{1,2})日/g;
  let match: RegExpExecArray | null;

  while ((match = rangePattern.exec(html)) !== null) {
    const context = match[1].trim();
    const m1 = parseInt(match[2]);
    const d1 = parseInt(match[3]);
    const m2 = parseInt(match[4]);
    const d2 = parseInt(match[5]);

    const y1 = m1 >= 4 ? year : year + 1;
    const y2 = m2 >= 4 ? (m1 >= m2 ? year + 1 : year) : year + 1;

    const dateFrom = `${y1}-${String(m1).padStart(2, '0')}-${String(d1).padStart(2, '0')}`;
    const dateTo = `${y2}-${String(m2).padStart(2, '0')}-${String(d2).padStart(2, '0')}`;

    const { type, factor } = detectPeriodType(context);

    if (dateFrom <= dateTo) {
      periods.push({
        id: uuidv4(),
        type,
        name: context.replace(/[　\s]+/g, ' ').trim(),
        dateFrom,
        dateTo,
        orderFactor: factor,
        source: 'auto',
        note: '',
      });
    }
  }

  return periods;
}

async function fetchAndParse(year: number): Promise<{ periods: AcademicPeriod[]; sourceUrl: string; error?: string }> {
  for (const url of FETCH_URLS) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(10000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ConveniOrderBot/1.0)' },
      });
      if (!res.ok) continue;
      const html = await res.text();
      const periods = parseHtml(html, year);
      if (periods.length > 0) {
        return { periods, sourceUrl: url };
      }

      // Look for a link to the calendar page and follow it
      const calendarLinkPattern = /href="([^"]*(?:gakureki|nenpyo|calendar|academic|学年歴|年暦)[^"]*)"/gi;
      const links: string[] = [];
      let linkMatch: RegExpExecArray | null;
      while ((linkMatch = calendarLinkPattern.exec(html)) !== null) {
        const href = linkMatch[1];
        links.push(href.startsWith('http') ? href : new URL(href, url).href);
      }

      for (const link of links.slice(0, 3)) {
        try {
          const linkRes = await fetch(link, {
            signal: AbortSignal.timeout(8000),
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ConveniOrderBot/1.0)' },
          });
          if (!linkRes.ok) continue;
          const linkHtml = await linkRes.text();
          const linkPeriods = parseHtml(linkHtml, year);
          if (linkPeriods.length > 0) {
            return { periods: linkPeriods, sourceUrl: link };
          }
        } catch {
          continue;
        }
      }
    } catch {
      continue;
    }
  }

  return {
    periods: [],
    sourceUrl: FETCH_URLS[0],
    error: 'ウェブサイトからの自動取得に失敗しました。手動で入力してください。\n参照先: https://www.hosei.ac.jp/tama/',
  };
}

export async function GET() {
  return NextResponse.json(await getAcademicCalendar());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const calendar = await getAcademicCalendar();

  if (body.action === 'fetch') {
    // Auto-fetch from Hosei website
    const year = body.year ?? new Date().getFullYear();
    const { periods, sourceUrl, error } = await fetchAndParse(year);

    if (error) {
      return NextResponse.json({ error }, { status: 422 });
    }

    // Merge: keep manual entries, replace auto entries
    const manualPeriods = calendar.periods.filter((p) => p.source === 'manual');
    const updated = {
      ...calendar,
      academicYear: year,
      fetchedAt: new Date().toISOString(),
      sourceUrl,
      periods: [...manualPeriods, ...periods],
    };
    await saveAcademicCalendar(updated);
    return NextResponse.json(updated);
  }

  // Add a period manually
  const newPeriod: AcademicPeriod = {
    id: uuidv4(),
    type: body.type,
    name: body.name,
    dateFrom: body.dateFrom,
    dateTo: body.dateTo,
    orderFactor: Number(body.orderFactor) || 1.0,
    source: 'manual',
    note: body.note ?? '',
  };
  const updated = { ...calendar, periods: [...calendar.periods, newPeriod] };
  await saveAcademicCalendar(updated);
  return NextResponse.json(newPeriod, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const calendar = await getAcademicCalendar();

  if (body.action === 'setYear') {
    await saveAcademicCalendar({ ...calendar, academicYear: body.year });
    return NextResponse.json({ ok: true });
  }

  const updated = {
    ...calendar,
    periods: calendar.periods.map((p) =>
      p.id === body.id
        ? { ...p, type: body.type, name: body.name, dateFrom: body.dateFrom, dateTo: body.dateTo, orderFactor: Number(body.orderFactor) || p.orderFactor, note: body.note ?? p.note, source: 'manual' as const }
        : p
    ),
  };
  await saveAcademicCalendar(updated);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const calendar = await getAcademicCalendar();
  await saveAcademicCalendar({ ...calendar, periods: calendar.periods.filter((p) => p.id !== id) });
  return NextResponse.json({ ok: true });
}
