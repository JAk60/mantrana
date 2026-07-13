import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import path from 'path';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'mission', 'demo_01.json');
    const raw = readFileSync(filePath, 'utf-8');
    const missionConfig = JSON.parse(raw);

    const res = await fetch('http://localhost:8000/api/mission-reliability/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(missionConfig),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }

    const result = await res.json();
    return NextResponse.json({ result, config: missionConfig });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Failed' }, { status: 500 });
  }
}