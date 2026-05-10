import { NextRequest, NextResponse } from 'next/server';
import { getProducts, getSalesRecords, getFactorSettings, getVacationPeriods, getAcademicCalendar } from '@/lib/dataStore';
import { calculateRecommendations } from '@/lib/orderAlgorithm';

export async function POST(req: NextRequest) {
  const conditions = await req.json();
  const [products, salesHistory, factorSettings, vacations, academicCalendar] = await Promise.all([
    getProducts(),
    getSalesRecords(),
    getFactorSettings(),
    getVacationPeriods(),
    getAcademicCalendar(),
  ]);

  const recommendations = calculateRecommendations(products, salesHistory, conditions, factorSettings, vacations, academicCalendar);
  return NextResponse.json(recommendations);
}
