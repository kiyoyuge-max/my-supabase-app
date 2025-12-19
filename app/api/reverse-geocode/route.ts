import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  if (!lat || !lon) {
    return NextResponse.json({ error: 'lat/lon required' }, { status: 400 });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'Missing GOOGLE_MAPS_API_KEY' }, { status: 500 });
  }

  // 番地寄りを優先（ROOFTOP / RANGE_INTERPOLATED）
  const url =
    `https://maps.googleapis.com/maps/api/geocode/json` +
    `?latlng=${encodeURIComponent(`${lat},${lon}`)}` +
    `&language=ja&region=jp` +
    `&result_type=street_address|premise` +
    `&location_type=ROOFTOP|RANGE_INTERPOLATED` +
    `&key=${encodeURIComponent(key)}`;

  const r = await fetch(url, { cache: 'no-store' });
  const data = await r.json();

  return NextResponse.json(data, { status: 200 });
}
