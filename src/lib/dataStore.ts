import { sql } from '@vercel/postgres';
import { initializeDatabase } from './db';
import {
  Product,
  SalesRecord,
  FactorSettings,
  DEFAULT_FACTOR_SETTINGS,
  EventRecord,
  SaleCampaign,
  VacationPeriod,
  AcademicCalendarData,
} from './types';

let initPromise: Promise<void> | null = null;

async function ensureDb(): Promise<void> {
  if (!initPromise) {
    initPromise = initializeDatabase();
  }
  await initPromise;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToProduct(row: any): Product {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    defaultOrder: row.default_order,
    shelfLife: row.shelf_life,
    isDeliItem: row.is_deli_item,
    deliverySlotCount: row.delivery_slot_count,
    overOrderTolerance: row.over_order_tolerance,
    underOrderTolerance: row.under_order_tolerance,
    hasOrderCorrectionPeriod: row.has_order_correction_period,
    correctionDeadlineHour: row.correction_deadline_hour,
    price: row.price ?? undefined,
    cost: row.cost ?? undefined,
    markdownRules: row.markdown_rules ?? [],
    createdAt: row.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToSalesRecord(row: any): SalesRecord {
  return {
    id: row.id,
    date: row.date,
    productId: row.product_id,
    sold: row.sold,
    wasted: row.wasted,
    stockout: row.stockout,
    ordered: row.ordered,
    markedDown: row.marked_down,
    markdownAmount: row.markdown_amount,
    weather: row.weather ?? undefined,
  };
}

// --- Products ---

export async function getProducts(): Promise<Product[]> {
  await ensureDb();
  const { rows } = await sql`SELECT * FROM products ORDER BY created_at`;
  return rows.map(rowToProduct);
}

export async function saveProducts(products: Product[]): Promise<void> {
  await ensureDb();
  await sql`DELETE FROM products`;
  for (const p of products) {
    await sql`
      INSERT INTO products (
        id, name, category, default_order, shelf_life, is_deli_item, delivery_slot_count,
        over_order_tolerance, under_order_tolerance, has_order_correction_period,
        correction_deadline_hour, price, cost, markdown_rules, created_at
      ) VALUES (
        ${p.id}, ${p.name}, ${p.category}, ${p.defaultOrder}, ${p.shelfLife},
        ${p.isDeliItem}, ${p.deliverySlotCount}, ${p.overOrderTolerance},
        ${p.underOrderTolerance}, ${p.hasOrderCorrectionPeriod}, ${p.correctionDeadlineHour},
        ${p.price ?? null}, ${p.cost ?? null},
        ${JSON.stringify(p.markdownRules)}::jsonb, ${p.createdAt}
      )
    `;
  }
}

// --- Sales Records ---

export async function getSalesRecords(): Promise<SalesRecord[]> {
  await ensureDb();
  const { rows } = await sql`SELECT * FROM sales_records ORDER BY date, product_id`;
  return rows.map(rowToSalesRecord);
}

export async function saveSalesRecords(records: SalesRecord[]): Promise<void> {
  await ensureDb();
  await sql`DELETE FROM sales_records`;
  for (const r of records) {
    await sql`
      INSERT INTO sales_records (
        id, date, product_id, sold, wasted, stockout, ordered, marked_down, markdown_amount, weather
      ) VALUES (
        ${r.id}, ${r.date}, ${r.productId}, ${r.sold}, ${r.wasted}, ${r.stockout},
        ${r.ordered}, ${r.markedDown}, ${r.markdownAmount}, ${r.weather ?? null}
      )
    `;
  }
}

// --- Factor Settings ---

export async function getFactorSettings(): Promise<FactorSettings> {
  await ensureDb();
  const { rows } = await sql`SELECT * FROM settings WHERE id = 'default'`;
  if (rows.length === 0) return { ...DEFAULT_FACTOR_SETTINGS };
  const row = rows[0];
  return {
    weather: {
      '晴れ': row.weather_sunny,
      '曇り': row.weather_cloudy,
      '雨': row.weather_rainy,
      '雪': row.weather_snowy,
    },
    event: row.event_factor,
    sale: row.sale_factor,
    holiday: row.holiday_factor,
  };
}

export async function saveFactorSettings(settings: FactorSettings): Promise<void> {
  await ensureDb();
  await sql`
    INSERT INTO settings (id, weather_sunny, weather_cloudy, weather_rainy, weather_snowy, event_factor, sale_factor, holiday_factor)
    VALUES (
      'default',
      ${settings.weather['晴れ']}, ${settings.weather['曇り']},
      ${settings.weather['雨']}, ${settings.weather['雪']},
      ${settings.event}, ${settings.sale}, ${settings.holiday}
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

// --- Events ---

export async function getEvents(): Promise<EventRecord[]> {
  await ensureDb();
  const { rows } = await sql`SELECT * FROM events ORDER BY date`;
  return rows.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    date: row.date as string,
    note: row.note as string,
  }));
}

export async function saveEvents(events: EventRecord[]): Promise<void> {
  await ensureDb();
  await sql`DELETE FROM events`;
  for (const e of events) {
    await sql`INSERT INTO events (id, name, date, note) VALUES (${e.id}, ${e.name}, ${e.date}, ${e.note})`;
  }
}

// --- Sale Campaigns ---

export async function getSaleCampaigns(): Promise<SaleCampaign[]> {
  await ensureDb();
  const { rows } = await sql`SELECT * FROM sale_campaigns ORDER BY date_from`;
  return rows.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    dateFrom: row.date_from as string,
    dateTo: row.date_to as string,
    note: row.note as string,
  }));
}

export async function saveSaleCampaigns(campaigns: SaleCampaign[]): Promise<void> {
  await ensureDb();
  await sql`DELETE FROM sale_campaigns`;
  for (const c of campaigns) {
    await sql`
      INSERT INTO sale_campaigns (id, name, date_from, date_to, note)
      VALUES (${c.id}, ${c.name}, ${c.dateFrom}, ${c.dateTo}, ${c.note})
    `;
  }
}

// --- Vacation Periods ---

export async function getVacationPeriods(): Promise<VacationPeriod[]> {
  await ensureDb();
  const { rows } = await sql`SELECT * FROM vacation_periods ORDER BY date_from`;
  return rows.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    dateFrom: row.date_from as string,
    dateTo: row.date_to as string,
    reductionPct: row.reduction_pct as number,
    note: row.note as string,
  }));
}

export async function saveVacationPeriods(vacations: VacationPeriod[]): Promise<void> {
  await ensureDb();
  await sql`DELETE FROM vacation_periods`;
  for (const v of vacations) {
    await sql`
      INSERT INTO vacation_periods (id, name, date_from, date_to, reduction_pct, note)
      VALUES (${v.id}, ${v.name}, ${v.dateFrom}, ${v.dateTo}, ${v.reductionPct}, ${v.note})
    `;
  }
}

// --- Academic Calendar ---

const DEFAULT_ACADEMIC_CALENDAR: AcademicCalendarData = {
  academicYear: 2026,
  fetchedAt: null,
  sourceUrl: 'https://www.hosei.ac.jp/tama/',
  periods: [],
};

export async function getAcademicCalendar(): Promise<AcademicCalendarData> {
  await ensureDb();
  const { rows } = await sql`SELECT * FROM academic_calendar ORDER BY academic_year DESC LIMIT 1`;
  if (rows.length === 0) return { ...DEFAULT_ACADEMIC_CALENDAR };
  const row = rows[0];
  return {
    academicYear: row.academic_year as number,
    fetchedAt: (row.fetched_at as string | null) ?? null,
    sourceUrl: row.source_url as string,
    periods: row.periods as AcademicCalendarData['periods'],
  };
}

export async function saveAcademicCalendar(data: AcademicCalendarData): Promise<void> {
  await ensureDb();
  await sql`
    INSERT INTO academic_calendar (academic_year, fetched_at, source_url, periods)
    VALUES (${data.academicYear}, ${data.fetchedAt}, ${data.sourceUrl}, ${JSON.stringify(data.periods)}::jsonb)
    ON CONFLICT (academic_year) DO UPDATE SET
      fetched_at = EXCLUDED.fetched_at,
      source_url = EXCLUDED.source_url,
      periods = EXCLUDED.periods
  `;
}
