// sitrep-to-json.js
// Deterministically parses a sitrep-style report file (like the CNS Alpha
// Appendix B sitreps) into a single JSON object keyed by ISO timestamp.
// No LLM / Ollama required — pure text parsing, so output is exact and
// reproducible every run.
//
// Usage:
//   node sitrep-to-json.js
//   node sitrep-to-json.js path/to/other-file.txt
//   node sitrep-to-json.js output.txt output.json
//
// Requirements:
//   - Node.js 14+ (no external dependencies)
//
// NOTE: This parser is written against the specific layout in your document:
//   ⚓ CNS ALPHA — DAY n (dd Mon yy)
//   --- SITREP nn | AM/PM | HHMM IST (EF) ---
//   1. Basic Details / 2. Intelligence Report (ESM / Radar / Visual) /
//   3. Fuel Status / 4. A/C State / 5. Weather / 6. Extra Info
// If your real file deviates from this layout in places, adjust the
// SECTION_HEADERS / regexes below to match.

const fs = require("fs");
const path = require("path");

const MONTHS = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

const SECTION_HEADERS = {
  "1. basic details": "basic_details",
  "2. intelligence report": "intelligence_report",
  "3. fuel status": "fuel_status",
  "4. a/c state": "ac_state",
  "5. weather": "weather",
  "6. extra info": "extra_info",
};

const SUB_HEADERS = {
  esm: "esm",
  radar: "radar",
  visual: "visual",
};

function toISODate(dateStr, timeStr) {
  // dateStr like "01 Mar 26", timeStr like "0800"
  const m = dateStr.trim().match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2,4})/);
  if (!m) return null;
  const [, day, monAbbr, yr] = m;
  const month = MONTHS[monAbbr.toLowerCase()];
  const year = yr.length === 2 ? `20${yr}` : yr;
  const hh = timeStr.slice(0, 2);
  const mm = timeStr.slice(2, 4);
  return `${year}-${month}-${day.padStart(2, "0")}T${hh}:${mm}:00`;
}

function isBullet(line) {
  return /^[●○◦]/.test(line.trim());
}

function bulletDepth(line) {
  const t = line.trim();
  if (t.startsWith("○") || t.startsWith("◦")) return 1;
  if (t.startsWith("●")) return 0;
  return 0;
}

function cleanBullet(line) {
  return line.trim().replace(/^[●○◦]\s*/, "").trim();
}

// Split a "Label: value" bullet into a [key, value] pair, or return null
// if it doesn't look like key:value (e.g. it's a free-text note).
function splitKeyValue(text) {
  const idx = text.indexOf(":");
  if (idx !== -1) {
    const key = text.slice(0, idx).trim();
    const value = text.slice(idx + 1).trim();
    // Guard against splitting on things like "0.83" or times "08:00" as keys
    if (key && key.length <= 60 && !/^\d/.test(key)) return [key, value];
  }
  // Fall back to en-dash/hyphen separator, e.g. "Available – 936 T / 78%"
  const dashMatch = text.match(/^([A-Za-z][A-Za-z0-9 /%()]{1,40}?)\s+[–-]\s+(.+)$/);
  if (dashMatch) {
    return [dashMatch[1].trim(), dashMatch[2].trim()];
  }
  return null;
}

// PDF-extracted text often wraps a single sentence across multiple lines
// (and sometimes across a page-break marker). This joins those continuation
// lines back into the logical line they belong to, so bullets/values don't
// get truncated or split into spurious extra "notes".
function mergeWrappedLines(rawLines) {
  const NEW_LOGICAL_LINE = new RegExp(
    "^(" +
      "⚓|" + // day header
      "-{2,}|" + // sitrep header / page marker delimiters
      "[●○◦]|" + // bullets
      "\\d+\\.\\s|" + // "1. Basic Details"
      "ESM$|Radar$|Visual$" + // sub-headers (exact, checked separately below too)
      ")",
    "i"
  );

  const merged = [];
  for (const raw of rawLines) {
    const line = raw.replace(/\s+$/g, "");
    const trimmed = line.trim();

    if (!trimmed) continue; // drop blank lines entirely; they never carry content
    if (/^-{2,}\s*PAGE\s*\d+\s*-{2,}$/i.test(trimmed)) continue; // drop page markers

    const isNewLogical =
      NEW_LOGICAL_LINE.test(trimmed) ||
      /^(ESM|Radar|Visual)$/i.test(trimmed) ||
      /^SITREP\s+\d+/i.test(trimmed);

    if (isNewLogical || merged.length === 0) {
      merged.push(trimmed);
    } else {
      // Continuation of the previous logical line — join with a space.
      merged[merged.length - 1] = merged[merged.length - 1] + " " + trimmed;
    }
  }
  return merged;
}

function toSnakeKey(label) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseEmitterLine(text) {
  // "Emitter 001: S-band long-range air search radar, bearing 192°, strength 8/10 → probable correlation..."
  const m = text.match(/^Emitter\s+(\d+):\s*(.+)$/i);
  if (!m) return { raw: text };
  const [, id, rest] = m;
  const [beforeArrow, afterArrow] = rest.split("→").map((s) => s && s.trim());

  const entry = { emitter: id };
  const parts = beforeArrow.split(",").map((s) => s.trim());
  entry.description = parts[0] || null;
  for (const part of parts.slice(1)) {
    const bearingMatch = part.match(/bearing\s+([\d.]+°(?:[–-][\d.]+°)?)/i);
    const strengthMatch = part.match(/strength\s+(fluctuating\s+)?([\d./–-]+)/i);
    if (bearingMatch) entry.bearing = bearingMatch[1];
    else if (strengthMatch) entry.strength = (strengthMatch[1] || "") + strengthMatch[2];
    else if (part) (entry.notes = entry.notes || []).push(part);
  }
  if (afterArrow) entry.correlation = afterArrow;
  return entry;
}

function parseFile(fileContent) {
  const rawLines = fileContent.split(/\r?\n/);
  const lines = mergeWrappedLines(rawLines);

  const result = {};
  let currentDate = null;
  let currentSitrep = null; // { key, data, currentSection, currentSubSection }

  function commitSitrep() {
    if (currentSitrep && currentSitrep.key) {
      result[currentSitrep.key] = currentSitrep.data;
    }
    currentSitrep = null;
  }

  for (let rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Day header: "⚓ CNS ALPHA — DAY 1 (01 Mar 26)"
    const dayMatch = line.match(/DAY\s+\d+\s*\(([^)]+)\)/i);
    if (dayMatch) {
      currentDate = dayMatch[1].trim();
      continue;
    }

    // Sitrep header: "--- SITREP 01 | AM | 0800 IST (EF) ---"
    const sitrepMatch = line.match(
      /SITREP\s+(\d+)\s*\|\s*(AM|PM)\s*\|\s*(\d{3,4})\s*([A-Z]+)\s*\(([^)]+)\)/i
    );
    if (sitrepMatch) {
      commitSitrep();
      const [, no, session, time, tzLabel, tzDesignator] = sitrepMatch;
      const paddedTime = time.padStart(4, "0");
      const iso = toISODate(currentDate || "", paddedTime);
      let key = iso || `unknown_${no}_${session}`;
      // Disambiguate collisions
      let suffix = 2;
      const baseKey = key;
      while (result[key]) {
        key = `${baseKey}_${suffix}`;
        suffix++;
      }
      currentSitrep = {
        key,
        currentSection: null,
        currentSubSection: null,
        data: {
          sitrep_no: no,
          session,
          date: currentDate,
          time: `${paddedTime.slice(0, 2)}:${paddedTime.slice(2, 4)}`,
          timezone: `${tzLabel} (${tzDesignator})`,
          basic_details: {},
          intelligence_report: { esm: [], radar: [], visual: [] },
          fuel_status: {},
          ac_state: {},
          weather: {},
          extra_info: [],
        },
      };
      continue;
    }

    if (!currentSitrep) continue; // skip preamble/title lines before first sitrep

    const lowerLine = line.toLowerCase();

    // Section header?
    const sectionKey = Object.keys(SECTION_HEADERS).find((h) => lowerLine === h);
    if (sectionKey) {
      currentSitrep.currentSection = SECTION_HEADERS[sectionKey];
      currentSitrep.currentSubSection = null;
      continue;
    }

    // Sub-section header inside Intelligence Report (ESM / Radar / Visual)?
    if (currentSitrep.currentSection === "intelligence_report" && SUB_HEADERS[lowerLine]) {
      currentSitrep.currentSubSection = SUB_HEADERS[lowerLine];
      continue;
    }

    if (!currentSitrep.currentSection) continue; // stray line, ignore

    const section = currentSitrep.currentSection;
    const sub = currentSitrep.currentSubSection;
    const depth = bulletDepth(line);
    const isBul = isBullet(line);
    const text = isBul ? cleanBullet(line) : line;

    if (section === "intelligence_report") {
      if (sub === "esm") {
        if (depth === 0 && /^Emitter\s+\d+:/i.test(text)) {
          currentSitrep.data.intelligence_report.esm.push(parseEmitterLine(text));
        } else if (currentSitrep.data.intelligence_report.esm.length) {
          const last =
            currentSitrep.data.intelligence_report.esm[
              currentSitrep.data.intelligence_report.esm.length - 1
            ];
          (last.notes = last.notes || []).push(text);
        }
      } else if (sub === "radar") {
        const radarArr = currentSitrep.data.intelligence_report.radar;
        if (depth === 1 && radarArr.length) {
          const last = radarArr[radarArr.length - 1];
          if (typeof last === "object" && last.value !== undefined) {
            last.details = last.details || [];
            last.details.push(text);
          } else {
            radarArr.push({ note: text, parent: "sub-item" });
          }
        } else {
          const kv = splitKeyValue(text);
          if (kv) radarArr.push({ label: kv[0], value: kv[1] });
          else radarArr.push({ note: text });
        }
      } else if (sub === "visual") {
        currentSitrep.data.intelligence_report.visual.push(text);
      }
      continue;
    }

    if (section === "extra_info") {
      currentSitrep.data.extra_info.push(text);
      continue;
    }

    // basic_details / fuel_status / ac_state / weather: mostly "Label: value" bullets
    if (["basic_details", "fuel_status", "ac_state", "weather"].includes(section)) {
      const kv = splitKeyValue(text);
      if (kv) {
        currentSitrep.data[section][toSnakeKey(kv[0])] = kv[1];
      } else {
        (currentSitrep.data[section]._notes = currentSitrep.data[section]._notes || []).push(text);
      }
      continue;
    }
  }

  commitSitrep();
  return result;
}

function main() {
  const inputPath = process.argv[2] || "output.txt";
  const outputPath = process.argv[3] || "output.json";

  const resolvedInput = path.resolve(inputPath);
  const resolvedOutput = path.resolve(outputPath);

  if (!fs.existsSync(resolvedInput)) {
    console.error(`File not found: ${resolvedInput}`);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(resolvedInput, "utf-8");
  if (!fileContent.trim()) {
    console.error("File is empty. Nothing to convert.");
    process.exit(1);
  }

  const parsed = parseFile(fileContent);
  const count = Object.keys(parsed).length;

  fs.writeFileSync(resolvedOutput, JSON.stringify(parsed, null, 2), "utf-8");
  console.log(`Parsed ${count} sitrep(s). Saved to ${resolvedOutput}`);
}

main();