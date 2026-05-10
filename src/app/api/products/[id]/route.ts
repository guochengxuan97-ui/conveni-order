import { NextRequest, NextResponse } from 'next/server';
import { getProducts, saveProducts } from '@/lib/dataStore';

type Params = Promise<{ id: string }>;

export async function PUT(req: NextRequest, { params }: { params: Params }) {
  const { id } = await params;
  const body = await req.json();
  const products = await getProducts();
  const index = products.findIndex((p) => p.id === id);

  if (index === -1) {
    return NextResponse.json({ error: '商品が見つかりません' }, { status: 404 });
  }

  products[index] = {
    ...products[index],
    name: body.name,
    category: body.category,
    defaultOrder: Number(body.defaultOrder) || products[index].defaultOrder,
    shelfLife: Number(body.shelfLife) || products[index].shelfLife,
    isDeliItem: Boolean(body.isDeliItem),
    deliverySlotCount: ([1, 2, 3].includes(Number(body.deliverySlotCount))
      ? Number(body.deliverySlotCount)
      : products[index].deliverySlotCount) as 1 | 2 | 3,
    overOrderTolerance: Number(body.overOrderTolerance) ?? products[index].overOrderTolerance,
    underOrderTolerance: Number(body.underOrderTolerance) ?? products[index].underOrderTolerance,
    hasOrderCorrectionPeriod: Boolean(body.hasOrderCorrectionPeriod),
    correctionDeadlineHour: Number(body.correctionDeadlineHour) || products[index].correctionDeadlineHour,
    price: body.price != null && body.price !== '' ? Number(body.price) : undefined,
    cost: body.cost != null && body.cost !== '' ? Number(body.cost) : undefined,
    markdownRules: Array.isArray(body.markdownRules) ? body.markdownRules : [],
  };
  await saveProducts(products);

  return NextResponse.json(products[index]);
}

export async function DELETE(req: NextRequest, { params }: { params: Params }) {
  const { id } = await params;
  const products = await getProducts();
  const filtered = products.filter((p) => p.id !== id);

  if (filtered.length === products.length) {
    return NextResponse.json({ error: '商品が見つかりません' }, { status: 404 });
  }

  await saveProducts(filtered);
  return NextResponse.json({ success: true });
}
