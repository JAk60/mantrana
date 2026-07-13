import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

function isValidSlug(slug: string) {
  return /^[a-z0-9_-]+$/i.test(slug);
}

function shipFilePath(slug: string) {
  return path.join(process.cwd(), 'public', 'ships', `${slug}.json`);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: 'Invalid ship id' }, { status: 400 });
  }

  try {
    const raw = await fs.readFile(shipFilePath(slug), 'utf-8');
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: 'Invalid ship id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    await fs.writeFile(shipFilePath(slug), JSON.stringify(body, null, 2), 'utf-8');
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to write file' }, { status: 500 });
  }
}



export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: 'Invalid ship id' }, { status: 400 });
  }

  let body: { timeline?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.timeline || typeof body.timeline !== 'object') {
    return NextResponse.json({ error: 'Body must contain a timeline object' }, { status: 400 });
  }

  const filePath = shipFilePath(slug);
  console.log('[PATCH] resolved path:', filePath);

  let existing: Record<string, any>;
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    existing = JSON.parse(raw);
  } catch (err) {
    console.error('[PATCH] read error:', err);
    return NextResponse.json(
      { error: `Ship file not found: ${filePath}` },
      { status: 404 }
    );
  }

  existing.timeline = { ...(existing.timeline ?? {}), ...body.timeline };

  try {
    await fs.writeFile(filePath, JSON.stringify(existing, null, 2), 'utf-8');
    return NextResponse.json({ ok: true, merged: Object.keys(body.timeline).length });
  } catch (err) {
    console.error('[PATCH] write error:', err);
    return NextResponse.json({ error: 'Failed to write file' }, { status: 500 });
  }
}