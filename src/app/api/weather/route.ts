import { NextRequest, NextResponse } from 'next/server';
import { WeatherType } from '@/lib/types';

const LAT = 35.5847;
const LON = 139.3721;
const TZ = 'Asia/Tokyo';

export interface DayWeather {
  date: string;
  weather: WeatherType;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  precipProbability: number | null;
}

function wmoToWeatherType(code: number): WeatherType {
  if (code <= 1) return '晴れ';
  if (code <= 3 || code === 45 || code === 48) return '曇り';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return '雪';
  return '雨';
}

async function fetchWeatherRange(startDate: string, endDate: string): Promise<DayWeather[]> {
  const today = new Date().toISOString().split('T')[0];
  const pastDays = Math.max(
    0,
    Math.floor((Date.parse(today) - Date.parse(startDate)) / 86400000)
  );
  const futureDays = Math.max(
    1,
    Math.ceil((Date.parse(endDate) - Date.parse(today)) / 86400000) + 1
  );

  if (pastDays > 92) {
    throw new Error('過去90日以上のデータは取得できません');
  }

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(LAT));
  url.searchParams.set('longitude', String(LON));
  url.searchParams.set('daily', 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max');
  url.searchParams.set('timezone', TZ);
  url.searchParams.set('past_days', String(Math.min(pastDays, 92)));
  url.searchParams.set('forecast_days', String(Math.min(Math.max(futureDays, 1), 16)));

  const res = await fetch(url.toString(), { next: { revalidate: 1800 } });
  if (!res.ok) throw new Error(`Open-Meteo APIエラー: ${res.status}`);
  const json = await res.json();

  const times: string[] = json.daily.time;
  const results: DayWeather[] = [];

  for (let i = 0; i < times.length; i++) {
    if (times[i] < startDate || times[i] > endDate) continue;
    results.push({
      date: times[i],
      weather: wmoToWeatherType(json.daily.weathercode[i]),
      weatherCode: json.daily.weathercode[i],
      tempMax: Math.round(json.daily.temperature_2m_max[i]),
      tempMin: Math.round(json.daily.temperature_2m_min[i]),
      precipProbability: json.daily.precipitation_probability_max?.[i] ?? null,
    });
  }

  return results;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get('date');
  const startParam = searchParams.get('start');
  const endParam = searchParams.get('end');

  try {
    if (dateParam) {
      const results = await fetchWeatherRange(dateParam, dateParam);
      if (results.length === 0) {
        return NextResponse.json(
          { error: '指定した日付のデータがありません（最大92日前まで対応）' },
          { status: 404 }
        );
      }
      return NextResponse.json(results[0]);
    }

    if (startParam && endParam) {
      const results = await fetchWeatherRange(startParam, endParam);
      return NextResponse.json(results);
    }

    return NextResponse.json(
      { error: 'dateまたはstart/endパラメータが必要です' },
      { status: 400 }
    );
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
