// Japanese national holiday calculator
// Reference: Cabinet Office https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function getNthWeekday(year: number, month: number, weekday: number, n: number): number | null {
  let count = 0;
  for (let d = 1; d <= 31; d++) {
    const date = new Date(year, month - 1, d);
    if (date.getMonth() !== month - 1) break;
    if (date.getDay() === weekday) {
      count++;
      if (count === n) return d;
    }
  }
  return null;
}

function getVernalEquinoxDay(year: number): number {
  return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function getAutumnalEquinoxDay(year: number): number {
  return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split('T')[0];
}

export function getJapaneseHolidays(year: number): Map<string, string> {
  const map = new Map<string, string>();

  function add(month: number, day: number, name: string) {
    map.set(toDateStr(year, month, day), name);
  }

  // Fixed holidays
  add(1, 1, '元日');
  add(2, 11, '建国記念の日');
  add(2, 23, '天皇誕生日');
  add(4, 29, '昭和の日');
  add(5, 3, '憲法記念日');
  add(5, 4, 'みどりの日');
  add(5, 5, 'こどもの日');
  add(8, 11, '山の日');
  add(11, 3, '文化の日');
  add(11, 23, '勤労感謝の日');

  // Moveable holidays (n-th weekday)
  const comingOfAge = getNthWeekday(year, 1, 1, 2);   // 2nd Mon of Jan
  if (comingOfAge) add(1, comingOfAge, '成人の日');

  const marineDay = getNthWeekday(year, 7, 1, 3);     // 3rd Mon of Jul
  if (marineDay) add(7, marineDay, '海の日');

  const respectDay = getNthWeekday(year, 9, 1, 3);    // 3rd Mon of Sep
  if (respectDay) add(9, respectDay, '敬老の日');

  const sportsDay = getNthWeekday(year, 10, 1, 2);    // 2nd Mon of Oct
  if (sportsDay) add(10, sportsDay, 'スポーツの日');

  // Equinox holidays (formula-based approximation)
  add(3, getVernalEquinoxDay(year), '春分の日');
  add(9, getAutumnalEquinoxDay(year), '秋分の日');

  // Substitute holidays (振替休日): holiday on Sunday → next Monday
  const origDates = Array.from(map.keys()).sort();
  for (const dateStr of origDates) {
    const d = new Date(dateStr);
    if (d.getDay() === 0) {
      let sub = addDays(dateStr, 1);
      while (map.has(sub)) sub = addDays(sub, 1);
      map.set(sub, '振替休日');
    }
  }

  // 国民の休日: weekday sandwiched between two holidays (e.g., Sep in some years)
  const allDates = Array.from(map.keys()).sort();
  for (const dateStr of allDates) {
    const prev = addDays(dateStr, -1);
    const next = addDays(dateStr, 1);
    if (map.has(prev) && map.has(next) && !map.has(dateStr)) {
      const d = new Date(dateStr);
      if (d.getDay() !== 0) map.set(dateStr, '国民の休日');
    }
  }

  return map;
}
