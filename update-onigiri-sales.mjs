import { readFileSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';

const SALES_FILE = './data/sales.json';

const rawData = [
  // Week 1: 4/12-4/18
  { date: '2026-04-12', ordered: 280, sold: 280, wasted: 0, markedDown: 40 },
  { date: '2026-04-13', ordered: 160, sold: 160, wasted: 0, markedDown: 32 },
  { date: '2026-04-14', ordered: 181, sold: 181, wasted: 0, markedDown: 11 },
  { date: '2026-04-15', ordered: 178, sold: 178, wasted: 0, markedDown: 1  },
  { date: '2026-04-16', ordered: 195, sold: 195, wasted: 0, markedDown: 19 },
  { date: '2026-04-17', ordered: 182, sold: 182, wasted: 0, markedDown: 42 },
  { date: '2026-04-18', ordered: 273, sold: 273, wasted: 0, markedDown: 25 },
  // Week 2: 4/19-4/25
  { date: '2026-04-19', ordered: 426, sold: 426, wasted: 0,  markedDown: 11 },
  { date: '2026-04-20', ordered: 203, sold: 203, wasted: 0,  markedDown: 18 },
  { date: '2026-04-21', ordered: 188, sold: 186, wasted: 2,  markedDown: 33 },
  { date: '2026-04-22', ordered: 174, sold: 174, wasted: 0,  markedDown: 9  },
  { date: '2026-04-23', ordered: 159, sold: 158, wasted: 1,  markedDown: 8  },
  { date: '2026-04-24', ordered: 203, sold: 200, wasted: 3,  markedDown: 58 },
  { date: '2026-04-25', ordered: 274, sold: 269, wasted: 5,  markedDown: 40 },
  // Week 3: 4/26-5/2
  { date: '2026-04-26', ordered: 249, sold: 248, wasted: 1,  markedDown: 30 },
  { date: '2026-04-27', ordered: 145, sold: 145, wasted: 0,  markedDown: 10 },
  { date: '2026-04-28', ordered: 192, sold: 192, wasted: 0,  markedDown: 0  },
  { date: '2026-04-29', ordered: 246, sold: 234, wasted: 12, markedDown: 34 },
  { date: '2026-04-30', ordered: 158, sold: 155, wasted: 3,  markedDown: 35 },
  { date: '2026-05-01', ordered: 143, sold: 143, wasted: 0,  markedDown: 36 },
  { date: '2026-05-02', ordered: 281, sold: 281, wasted: 0,  markedDown: 0  },
  // Week 4: 5/3-5/9
  { date: '2026-05-03', ordered: 297, sold: 257, wasted: 7,  markedDown: 7  },
  { date: '2026-05-04', ordered: 235, sold: 225, wasted: 11, markedDown: 11 },
  { date: '2026-05-05', ordered: 226, sold: 253, wasted: 1,  markedDown: 1  },
  { date: '2026-05-06', ordered: 181, sold: 179, wasted: 0,  markedDown: 0  },
  { date: '2026-05-07', ordered: 189, sold: 182, wasted: 0,  markedDown: 0  },
  { date: '2026-05-08', ordered: 158, sold: 174, wasted: 1,  markedDown: 1  },
  { date: '2026-05-09', ordered: 268, sold: 269, wasted: 1,  markedDown: 1  },
];

const current = JSON.parse(readFileSync(SALES_FILE, 'utf-8'));

// Remove all existing onigiri-all records
const others = current.filter(r => r.productId !== 'onigiri-all');

// Build fresh onigiri records
const onigiriRecords = rawData.map(d => ({
  id: randomUUID(),
  date: d.date,
  productId: 'onigiri-all',
  ordered: d.ordered,
  sold: d.sold,
  wasted: d.wasted,
  stockout: 0,
  markedDown: d.markedDown,
  markdownAmount: 0,
}));

const merged = [...others, ...onigiriRecords].sort((a, b) =>
  a.date.localeCompare(b.date) || a.productId.localeCompare(b.productId)
);

writeFileSync(SALES_FILE, JSON.stringify(merged, null, 2), 'utf-8');

console.log(`✓ onigiri-allレコード: ${onigiriRecords.length}件を書き込みました`);
console.log(`  対象期間: 2026-04-12 〜 2026-05-09`);
console.log(`  既存の他商品レコード: ${others.length}件を保持`);
console.log(`  合計: ${merged.length}件`);
