import { useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmitterEntry {
  emitter: string;
  description?: string | null;
  bearing?: string;
  strength?: string;
  notes?: string[];
  correlation?: string;
  raw?: string;
}

export interface RadarEntry {
  label?: string;
  value?: string;
  note?: string;
  details?: string[];
  parent?: string;
}

export interface SitrepData {
  sitrep_no: string;
  session: string;
  date: string | null;
  time: string;
  timezone: string;
  basic_details: Record<string, string | string[]>;
  intelligence_report: { esm: EmitterEntry[]; radar: RadarEntry[]; visual: string[] };
  fuel_status: Record<string, string | string[]>;
  ac_state: Record<string, string | string[]>;
  weather: Record<string, string | string[]>;
  extra_info: string[];
}

export type SitrepResult = Record<string, SitrepData>;

export interface UseSitrepReaderReturn {
  result: SitrepResult | null;
  isLoading: boolean;
  error: string | null;
  progress: string;
  readPDF: (file: File) => Promise<void>;
  reset: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS: Record<string, string> = {
  jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",
  jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12",
};

const SECTION_HEADERS: Record<string, string> = {
  "1. basic details":       "basic_details",
  "2. intelligence report": "intelligence_report",
  "3. fuel status":         "fuel_status",
  "4. a/c state":           "ac_state",
  "5. weather":             "weather",
  "6. extra info":          "extra_info",
};

const SUB_HEADERS: Record<string, string> = { esm:"esm", radar:"radar", visual:"visual" };

// ─── PDF text extraction ──────────────────────────────────────────────────────
// pdfjs is imported dynamically here so it never runs on the server (avoids
// the "DOMMatrix is not defined" SSR crash from pdfjs-dist's top-level eval).

async function extractTextFromPDF(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

  const lines: string[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();

    const lineMap = new Map<number, { x: number; str: string }[]>();
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const ti = item as any;
      if (!ti.str.trim()) continue;
      const y = Math.round(ti.transform[5] * 10) / 10;
      if (!lineMap.has(y)) lineMap.set(y, []);
      lineMap.get(y)!.push({ x: ti.transform[4], str: ti.str });
    }

    const sortedY = [...lineMap.keys()].sort((a, b) => b - a);
    for (const y of sortedY) {
      const line = lineMap.get(y)!
        .sort((a, b) => a.x - b.x)
        .map(o => o.str)
        .join("");
      if (line.trim()) lines.push(line);
    }
  }

  return lines.join("\n");
}

// ─── Parser ───────────────────────────────────────────────────────────────────

function toISODate(dateStr: string, timeStr: string): string | null {
  const m = dateStr.trim().match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2,4})/);
  if (!m) return null;
  const [, day, monAbbr, yr] = m;
  const month = MONTHS[monAbbr.toLowerCase()];
  const year = yr.length === 2 ? `20${yr}` : yr;
  return `${year}-${month}-${day.padStart(2,"0")}T${timeStr.slice(0,2)}:${timeStr.slice(2,4)}:00`;
}

function isBullet(line: string)    { return /^[●○◦]/.test(line.trim()); }
function bulletDepth(line: string) { const t = line.trim(); return (t.startsWith("○") || t.startsWith("◦")) ? 1 : 0; }
function cleanBullet(line: string) { return line.trim().replace(/^[●○◦]\s*/, "").trim(); }

function splitKeyValue(text: string): [string, string] | null {
  const idx = text.indexOf(":");
  if (idx !== -1) {
    const key = text.slice(0, idx).trim();
    const value = text.slice(idx + 1).trim();
    if (key && key.length <= 60 && !/^\d/.test(key)) return [key, value];
  }
  const dash = text.match(/^([A-Za-z][A-Za-z0-9 /%()]{1,40}?)\s+[–-]\s+(.+)$/);
  if (dash) return [dash[1].trim(), dash[2].trim()];
  return null;
}

function mergeWrappedLines(rawLines: string[]): string[] {
  const NEW_LOGICAL = /^(⚓|-{2,}|[●○◦]|\d+\.\s|ESM$|Radar$|Visual$)/i;
  const merged: string[] = [];
  for (const raw of rawLines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (/^-{2,}\s*PAGE\s*\d+\s*-{2,}$/i.test(trimmed)) continue;
    const isNew =
      NEW_LOGICAL.test(trimmed) ||
      /^(ESM|Radar|Visual)$/i.test(trimmed) ||
      /^SITREP\s+\d+/i.test(trimmed);
    if (isNew || merged.length === 0) merged.push(trimmed);
    else merged[merged.length - 1] += " " + trimmed;
  }
  return merged;
}

function toSnakeKey(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function parseEmitterLine(text: string): EmitterEntry {
  const m = text.match(/^Emitter\s+(\d+):\s*(.+)$/i);
  if (!m) return { raw: text, emitter: "?" };
  const [, id, rest] = m;
  const [beforeArrow, afterArrow] = rest.split("→").map(s => s?.trim());
  const entry: EmitterEntry = { emitter: id };
  const parts = beforeArrow.split(",").map(s => s.trim());
  entry.description = parts[0] || null;
  for (const part of parts.slice(1)) {
    const bm = part.match(/bearing\s+([\d.]+°(?:[–-][\d.]+°)?)/i);
    const sm = part.match(/strength\s+(fluctuating\s+)?([\d./–-]+)/i);
    if (bm) entry.bearing = bm[1];
    else if (sm) entry.strength = (sm[1] || "") + sm[2];
    else if (part) (entry.notes ??= []).push(part);
  }
  if (afterArrow) entry.correlation = afterArrow;
  return entry;
}

function parseSitrep(text: string): SitrepResult {
  const lines = mergeWrappedLines(text.split(/\r?\n/));
  const result: SitrepResult = {};
  let currentDate: string | null = null;
  let cur: {
    key: string;
    currentSection: string | null;
    currentSubSection: string | null;
    data: SitrepData;
  } | null = null;

  function commit() {
    if (cur) result[cur.key] = cur.data;
    cur = null;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const dayMatch = line.match(/DAY\s+\d+\s*\(([^)]+)\)/i);
    if (dayMatch) { currentDate = dayMatch[1].trim(); continue; }

    const sitMatch = line.match(
      /SITREP\s+(\d+)\s*\|\s*(AM|PM)\s*\|\s*(\d{3,4})\s*([A-Z]+)\s*\(([^)]+)\)/i
    );
    if (sitMatch) {
      commit();
      const [, no, session, time, tzLabel, tzDes] = sitMatch;
      const pt = time.padStart(4, "0");
      const iso = toISODate(currentDate || "", pt);
      let key = iso || `unknown_${no}_${session}`;
      let suf = 2;
      const base = key;
      while (result[key]) { key = `${base}_${suf}`; suf++; }
      cur = {
        key,
        currentSection: null,
        currentSubSection: null,
        data: {
          sitrep_no: no, session, date: currentDate,
          time: `${pt.slice(0,2)}:${pt.slice(2,4)}`,
          timezone: `${tzLabel} (${tzDes})`,
          basic_details: {}, fuel_status: {}, ac_state: {}, weather: {},
          intelligence_report: { esm: [], radar: [], visual: [] },
          extra_info: [],
        },
      };
      continue;
    }

    if (!cur) continue;
    const lc = line.toLowerCase();

    const sectionKey = Object.keys(SECTION_HEADERS).find(h => lc === h);
    if (sectionKey) {
      cur.currentSection = SECTION_HEADERS[sectionKey];
      cur.currentSubSection = null;
      continue;
    }

    if (cur.currentSection === "intelligence_report" && SUB_HEADERS[lc]) {
      cur.currentSubSection = SUB_HEADERS[lc];
      continue;
    }

    if (!cur.currentSection) continue;

    const section = cur.currentSection;
    const sub = cur.currentSubSection;
    const depth = bulletDepth(line);
    const isBul = isBullet(line);
    const text = isBul ? cleanBullet(line) : line;

    if (section === "intelligence_report") {
      const ir = cur.data.intelligence_report;
      if (sub === "esm") {
        if (depth === 0 && /^Emitter\s+\d+:/i.test(text)) ir.esm.push(parseEmitterLine(text));
        else if (ir.esm.length) (ir.esm[ir.esm.length - 1].notes ??= []).push(text);
      } else if (sub === "radar") {
        if (depth === 1 && ir.radar.length) {
          const last = ir.radar[ir.radar.length - 1] as any;
          if (last.value !== undefined) (last.details ??= []).push(text);
          else ir.radar.push({ note: text, parent: "sub-item" });
        } else {
          const kv = splitKeyValue(text);
          if (kv) ir.radar.push({ label: kv[0], value: kv[1] });
          else ir.radar.push({ note: text });
        }
      } else if (sub === "visual") {
        ir.visual.push(text);
      }
      continue;
    }

    if (section === "extra_info") { cur.data.extra_info.push(text); continue; }

    if (["basic_details","fuel_status","ac_state","weather"].includes(section)) {
      const kv = splitKeyValue(text);
      const sec = cur.data[section as keyof SitrepData] as Record<string, any>;
      if (kv) sec[toSnakeKey(kv[0])] = kv[1];
      else (sec._notes ??= []).push(text);
    }
  }

  commit();
  return result;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSitrepReader(): UseSitrepReaderReturn {
  const [result, setResult] = useState<SitrepResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");

  const readPDF = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Only .pdf files are supported.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      setProgress("Extracting text from PDF…");
      const text = await extractTextFromPDF(file);

      setProgress("Parsing sitrep structure…");
      const parsed = parseSitrep(text);
      const count = Object.keys(parsed).length;

      if (count === 0) throw new Error("No sitreps found — check PDF format matches expected layout.");
      setResult(parsed);
      setProgress(`Parsed ${count} sitrep${count !== 1 ? "s" : ""}.`);
    } catch (err: any) {
      setError(err?.message ?? "Unknown error during parsing.");
      setProgress("");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setProgress("");
    setIsLoading(false);
  }, []);

  return { result, isLoading, error, progress, readPDF, reset };
}