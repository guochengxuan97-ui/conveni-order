export type ProductCategory =
  | '弁当'
  | 'おにぎり・おむすび'
  | 'サンドイッチ'
  | 'サラダ'
  | 'パスタ'
  | 'その他';

export type WeatherType = '晴れ' | '曇り' | '雨' | '雪';

export interface MarkdownRule {
  hoursBeforeExpiry: number;
  discountAmount: number;
}

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  defaultOrder: number;
  shelfLife: number; // days
  // deli delivery configuration
  isDeliItem: boolean;
  deliverySlotCount: 1 | 2 | 3; // number of daily delivery batches
  // per-product order tolerance
  overOrderTolerance: number; // max extra units above recommendation
  underOrderTolerance: number; // max units below recommendation
  // order correction period
  hasOrderCorrectionPeriod: boolean;
  correctionDeadlineHour: number; // 0–23: hour by which corrections must be made
  // pricing (optional, used for profit loss calculation)
  price?: number; // selling price (yen)
  cost?: number; // cost/purchase price (yen)
  markdownRules: MarkdownRule[];
  createdAt: string;
}

export interface SalesRecord {
  id: string;
  date: string;
  productId: string;
  sold: number;
  wasted: number;
  stockout: number;
  ordered: number;
  markedDown: number; // units sold at markdown price (default 0)
  markdownAmount: number; // total markdown loss in yen (default 0)
  weather?: WeatherType; // weather on this date
}

export interface OrderConditions {
  date: string;
  weather: WeatherType;
  hasEvent: boolean;
  hasSale: boolean;
}

export type MarkdownRisk = 'low' | 'medium' | 'high';

export interface OrderRecommendation {
  product: Product;
  recommendedOrder: number;
  minOrder: number; // recommendedOrder - underOrderTolerance (floored at 1)
  maxOrder: number; // recommendedOrder + overOrderTolerance
  avgDemand: number;
  weatherFactor: number;
  eventFactor: number;
  saleFactor: number;
  seasonalFactor: number;
  vacationFactor: number;
  vacationName: string | null;
  holidayFactor: number;
  holidayName: string | null;
  academicFactor: number;
  academicPeriodName: string | null;
  academicPeriodType: AcademicPeriodType | null;
  markdownRisk: MarkdownRisk;
  markdownRiskReason: string;
}

export interface FactorSettings {
  weather: Record<WeatherType, number>;
  event: number;
  sale: number;
  holiday: number; // factor applied on national holidays during class periods (default 0.80)
}

export const DEFAULT_FACTOR_SETTINGS: FactorSettings = {
  weather: { '晴れ': 1.05, '曇り': 1.00, '雨': 0.85, '雪': 0.75 },
  event: 1.25,
  sale: 1.20,
  holiday: 0.80,
};

export interface EventRecord {
  id: string;
  name: string;
  date: string;
  note: string;
}

export interface SaleCampaign {
  id: string;
  name: string;
  dateFrom: string;
  dateTo: string;
  note: string;
}

export interface VacationPeriod {
  id: string;
  name: string;         // e.g., "GW", "夏休み"
  dateFrom: string;
  dateTo: string;
  reductionPct: number; // 1–50: 発注を何%減らすか
  note: string;
}

export type AcademicPeriodType = 'class' | 'exam' | 'vacation' | 'event' | 'closed';

export interface AcademicPeriod {
  id: string;
  type: AcademicPeriodType;
  name: string;
  dateFrom: string;
  dateTo: string;
  orderFactor: number; // 1.0 = normal, 0.85 = exam, 0.75 = vacation, 1.15 = event
  source: 'auto' | 'manual';
  note: string;
}

export interface AcademicCalendarData {
  academicYear: number;
  fetchedAt: string | null;
  sourceUrl: string;
  periods: AcademicPeriod[];
}
