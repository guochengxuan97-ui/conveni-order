import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { sql } from '@vercel/postgres';
import { initializeDatabase } from '@/lib/db';
import { Product, SalesRecord, VacationPeriod, EventRecord, SaleCampaign, AcademicCalendarData } from '@/lib/types';

function readJson<T>(filename: string, fallback: T): T {
  const file = path.join(process.cwd(), 'data', filename);
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

export async function POST(req: Request) {
  const secret = process.env.MIGRATE_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    await initializeDatabase();

    const products = readJson<Product[]>('products.json', []);
    const sales = readJson<SalesRecord[]>('sales.json', []);
    const events = readJson<EventRecord[]>('events.json', []);
    const campaigns = readJson<SaleCampaign[]>('sales-campaigns.json', []);
    const vacations = readJson<VacationPeriod[]>('vacations.json', []);
    const calendar = readJson<AcademicCalendarData | null>('academic-calendar.json', null);
    const settings = readJson<Record<string, unknown> | null>('settings.json', null);

    // Products
    await sql`DELETE FROM products`;
    for (const p of products) {
      await sql`
        INSERT INTO products (
          id, name, category, default_order, shelf_life, is_deli_item, delivery_slot_count,
          over_order_tolerance, under_order_tolerance, has_order_correction_period,
          correction_deadline_hour, price, cost, markdown_rules, created_at
        ) VALUES (
          ${p.id}, ${p.name}, ${p.category ?? '弁当'}, ${p.defaultOrder ?? 10}, ${p.shelfLife ?? 1},
          ${p.isDeliItem ?? false}, ${p.deliverySlotCount ?? 1}, ${p.overOrderTolerance ?? 2},
          ${p.underOrderTolerance ?? 1}, ${p.hasOrderCorrectionPeriod ?? false}, ${p.correctionDeadlineHour ?? 10},
          ${p.price ?? null}, ${p.cost ?? null},
          ${JSON.stringify(p.markdownRules ?? [])}::jsonb, ${p.createdAt ?? new Date().toISOString()}
        )
      `;
    }

    // Sales records
    await sql`DELETE FROM sales_records`;
    for (const r of sales) {
      await sql`
        INSERT INTO sales_records (id, date, product_id, sold, wasted, stockout, ordered, marked_down, markdown_amount, weather)
        VALUES (
          ${r.id}, ${r.date ?? ''}, ${r.productId ?? ''}, ${r.sold ?? 0}, ${r.wasted ?? 0},
          ${r.stockout ?? 0}, ${r.ordered ?? 0}, ${r.markedDown ?? 0}, ${r.markdownAmount ?? 0},
          ${r.weather ?? null}
        )
      `;
    }

    // Events
    await sql`DELETE FROM events`;
    for (const e of events) {
      await sql`INSERT INTO events (id, name, date, note) VALUES (${e.id}, ${e.name}, ${e.date}, ${e.note ?? ''})`;
    }

    // Sale campaigns
    await sql`DELETE FROM sale_campaigns`;
    for (const c of campaigns) {
      await sql`
        INSERT INTO sale_campaigns (id, name, date_from, date_to, note)
        VALUES (${c.id}, ${c.name}, ${c.dateFrom}, ${c.dateTo}, ${c.note ?? ''})
      `;
    }

    // Vacation periods
    await sql`DELETE FROM vacation_periods`;
    for (const v of vacations) {
      await sql`
        INSERT INTO vacation_periods (id, name, date_from, date_to, reduction_pct, note)
        VALUES (${v.id}, ${v.name}, ${v.dateFrom}, ${v.dateTo}, ${v.reductionPct ?? 15}, ${v.note ?? ''})
      `;
    }

    // Academic calendar
    if (calendar) {
      await sql`
        INSERT INTO academic_calendar (academic_year, fetched_at, source_url, periods)
        VALUES (${calendar.academicYear}, ${calendar.fetchedAt}, ${calendar.sourceUrl}, ${JSON.stringify(calendar.periods)}::jsonb)
        ON CONFLICT (academic_year) DO UPDATE SET
          fetched_at = EXCLUDED.fetched_at,
          source_url = EXCLUDED.source_url,
          periods = EXCLUDED.periods
      `;
    }

    // Settings
    if (settings) {
      const w = (settings.weather ?? {}) as Record<string, number>;
      await sql`
        INSERT INTO settings (id, weather_sunny, weather_cloudy, weather_rainy, weather_snowy, event_factor, sale_factor, holiday_factor)
        VALUES (
          'default',
          ${w['晴れ'] ?? 1.05}, ${w['曇り'] ?? 1.00}, ${w['雨'] ?? 0.85}, ${w['雪'] ?? 0.75},
          ${(settings.event as number) ?? 1.25}, ${(settings.sale as number) ?? 1.20}, ${(settings.holiday as number) ?? 0.80}
        )
        ON CONFLICT (id) DO UPDATE SET
          weather_sunny = EXCLUDED.weather_sunny,
          weather_cloudy = EXCLUDED.weather_cloudy,
          weather_rainy = EXCLUDED.weather_rainy,
          weather_snowy = EXCLUDED.weather_snowy,
          event_factor = EXCLUDED.event_factor,
          sale_factor = EXCLUDED.sale_factor,
          holiday_factor = EXCLUDED.holiday_factor
      `;
    }

    return NextResponse.json({
      ok: true,
      imported: {
        products: products.length,
        salesRecords: sales.length,
        events: events.length,
        campaigns: campaigns.length,
        vacations: vacations.length,
        hasCalendar: !!calendar,
        hasSettings: !!settings,
      },
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 }
    );
  }
}
