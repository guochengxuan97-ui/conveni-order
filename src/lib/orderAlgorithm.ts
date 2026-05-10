import { Product, SalesRecord, WeatherType, OrderRecommendation, MarkdownRisk, FactorSettings, DEFAULT_FACTOR_SETTINGS, VacationPeriod, AcademicCalendarData, AcademicPeriodType } from './types';
import { getJapaneseHolidays } from './japaneseHolidays';

export function getActiveVacation(date: string, vacations: VacationPeriod[]): VacationPeriod | null {
  return vacations.find((v) => date >= v.dateFrom && date <= v.dateTo) ?? null;
}

function getActiveAcademicPeriod(date: string, calendar: AcademicCalendarData) {
  // GW / short vacation takes priority over longer class period if both overlap
  const matches = calendar.periods
    .filter((p) => date >= p.dateFrom && date <= p.dateTo)
    .sort((a, b) => {
      // Shorter periods take priority (more specific), vacations/events over class
      const typeOrder: Record<AcademicPeriodType, number> = {
        closed: 0, vacation: 1, event: 2, exam: 3, class: 4,
      };
      return typeOrder[a.type] - typeOrder[b.type];
    });
  return matches[0] ?? null;
}

function getSeasonalFactor(category: string, month: number): number {
  const isSummer = [6, 7, 8].includes(month);
  const isWinter = [12, 1, 2].includes(month);

  if (isSummer) {
    if (category === 'サラダ') return 1.20;
    if (category === 'サンドイッチ') return 1.10;
    if (category === 'パスタ') return 1.05;
    if (category === '弁当') return 0.95;
  }
  if (isWinter) {
    if (category === '弁当') return 1.15;
    if (category === 'おにぎり・おむすび') return 1.10;
    if (category === 'サラダ') return 0.85;
  }
  return 1.00;
}

function calcMarkdownRisk(
  recommended: number,
  avgDemand: number,
  shelfLife: number,
  isDeliItem: boolean,
): { risk: MarkdownRisk; reason: string } {
  if (avgDemand <= 0) return { risk: 'low', reason: '' };

  const ratio = recommended / avgDemand;
  const sensitive = isDeliItem || shelfLife <= 1;
  const highThreshold = sensitive ? 1.35 : 1.55;
  const medThreshold = sensitive ? 1.18 : 1.30;

  if (ratio >= highThreshold) {
    return { risk: 'high', reason: `推奨数が平均需要の${Math.round(ratio * 100)}%（値下げリスク高）` };
  }
  if (ratio >= medThreshold) {
    return { risk: 'medium', reason: `推奨数が平均需要の${Math.round(ratio * 100)}%` };
  }
  return { risk: 'low', reason: '' };
}

export function calculateRecommendations(
  products: Product[],
  salesHistory: SalesRecord[],
  conditions: {
    weather: WeatherType;
    hasEvent: boolean;
    hasSale: boolean;
    date: string;
  },
  factorSettings: FactorSettings = DEFAULT_FACTOR_SETTINGS,
  vacations: VacationPeriod[] = [],
  academicCalendar: AcademicCalendarData = { academicYear: new Date().getFullYear(), fetchedAt: null, sourceUrl: '', periods: [] },
): OrderRecommendation[] {
  const month = new Date(conditions.date).getMonth() + 1;
  const year = new Date(conditions.date).getFullYear();

  // ── Priority 1: National holidays ────────────────────────
  const holidays = getJapaneseHolidays(year);
  const holidayName = holidays.get(conditions.date) ?? null;

  // ── Priority 2: Academic calendar (takes precedence over VacationPeriod) ──
  const academicPeriod = getActiveAcademicPeriod(conditions.date, academicCalendar);
  let academicFactor = 1.0;
  let academicPeriodName: string | null = null;
  let academicPeriodType: AcademicPeriodType | null = null;
  let vacationFactor = 1.0;
  let vacationName: string | null = null;

  if (academicPeriod) {
    academicFactor = academicPeriod.orderFactor;
    academicPeriodName = academicPeriod.name;
    academicPeriodType = academicPeriod.type;
  } else {
    // Fall back to VacationPeriod if no academic period covers this date
    const vacation = getActiveVacation(conditions.date, vacations);
    if (vacation) {
      vacationFactor = 1 - vacation.reductionPct / 100;
      vacationName = vacation.name;
    }
  }

  // Holiday factor: applied when it's a national holiday during a class period
  // (Holidays during vacation are already captured by academicFactor/vacationFactor)
  const isClassDay = !academicPeriod || academicPeriod.type === 'class';
  const isVacationActive = academicFactor < 1.0 || vacationFactor < 1.0;
  const holidayFactor =
    holidayName && isClassDay && !isVacationActive
      ? (factorSettings.holiday ?? DEFAULT_FACTOR_SETTINGS.holiday)
      : 1.0;

  // ── Priority 3: Weather (dampened when high-priority factors apply) ──
  const baseWeatherFactor = factorSettings.weather[conditions.weather];
  // When campus is in vacation/holiday, weather has 50% less effect on demand
  const dampening = isVacationActive || holidayFactor < 1.0 ? 0.5 : 1.0;
  const weatherFactor = 1 + (baseWeatherFactor - 1) * dampening;

  const eventFactor = conditions.hasEvent ? factorSettings.event : 1.00;
  const saleFactor = conditions.hasSale ? factorSettings.sale : 1.00;

  return products.map((product) => {
    const productSales = salesHistory
      .filter((s) => s.productId === product.id)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14);

    let avgDemand: number;
    if (productSales.length === 0) {
      avgDemand = product.defaultOrder;
    } else {
      const totalDemand = productSales.reduce((sum, s) => sum + s.sold + s.stockout, 0);
      avgDemand = totalDemand / productSales.length;
    }

    const seasonalFactor = getSeasonalFactor(product.category, month);
    const rawRecommended =
      avgDemand *
      weatherFactor *
      holidayFactor *
      academicFactor *
      vacationFactor *
      eventFactor *
      saleFactor *
      seasonalFactor;
    const recommendedOrder = Math.max(1, Math.ceil(rawRecommended));

    const minOrder = Math.max(1, recommendedOrder - product.underOrderTolerance);
    const maxOrder = recommendedOrder + product.overOrderTolerance;

    const { risk: markdownRisk, reason: markdownRiskReason } = calcMarkdownRisk(
      recommendedOrder,
      avgDemand,
      product.shelfLife,
      product.isDeliItem,
    );

    return {
      product,
      recommendedOrder,
      minOrder,
      maxOrder,
      avgDemand: Math.round(avgDemand * 10) / 10,
      weatherFactor,
      eventFactor,
      saleFactor,
      seasonalFactor,
      vacationFactor,
      vacationName,
      holidayFactor,
      holidayName,
      academicFactor,
      academicPeriodName,
      academicPeriodType,
      markdownRisk,
      markdownRiskReason,
    };
  });
}
