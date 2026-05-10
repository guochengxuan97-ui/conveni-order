import { NextRequest, NextResponse } from 'next/server';
import { getProducts, saveProducts } from '@/lib/dataStore';
import { Product } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  const products = await getProducts();
  return NextResponse.json(products);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const products = await getProducts();

  const newProduct: Product = {
    id: uuidv4(),
    name: body.name,
    category: body.category,
    defaultOrder: Number(body.defaultOrder) || 10,
    shelfLife: Number(body.shelfLife) || 1,
    isDeliItem: Boolean(body.isDeliItem),
    deliverySlotCount: ([1, 2, 3].includes(Number(body.deliverySlotCount))
      ? Number(body.deliverySlotCount)
      : 1) as 1 | 2 | 3,
    overOrderTolerance: Number(body.overOrderTolerance) ?? 2,
    underOrderTolerance: Number(body.underOrderTolerance) ?? 1,
    hasOrderCorrectionPeriod: Boolean(body.hasOrderCorrectionPeriod),
    correctionDeadlineHour: Number(body.correctionDeadlineHour) || 10,
    price: body.price != null && body.price !== '' ? Number(body.price) : undefined,
    cost: body.cost != null && body.cost !== '' ? Number(body.cost) : undefined,
    markdownRules: Array.isArray(body.markdownRules) ? body.markdownRules : [],
    createdAt: new Date().toISOString(),
  };

  products.push(newProduct);
  await saveProducts(products);

  return NextResponse.json(newProduct, { status: 201 });
}
