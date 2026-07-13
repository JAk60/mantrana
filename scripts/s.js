/**
 * pdf2json_extract.js
 *
 * Test script for the `pdf2json` npm library.
 * Parses a PDF and reconstructs readable text from it.
 *
 * pdf2json's built-in getRawTextContent() can return empty text on some
 * PDFs (e.g. ones using Type3 / custom glyph fonts). This script works
 * around that by reading the raw Texts[] arrays in the parsed JSON and
 * reconstructing lines using each text run's y/x coordinates.
 *
 * Usage:
 *   npm install pdf2json
 *   node pdf2json_extract.js <input.pdf> [output.txt]
 */

const fs = require("fs");
const path = require("path");
const PDFParser = require("pdf2json");

const inputPath = process.argv[2];
const outputTxtPath = process.argv[3] || "extracted.txt";
const outputJsonPath = outputTxtPath.replace(/\.txt$/, "") + ".json";

if (!inputPath) {
  console.error("Usage: node pdf2json_extract.js <input.pdf> [output.txt]");
  process.exit(1);
}

function decodeRun(run) {
  try {
    return decodeURIComponent(run.T);
  } catch (e) {
    // Some PDFs contain malformed escape sequences; fall back to raw text.
    return run.T;
  }
}

function reconstructText(pdfData) {
  const out = [];

  pdfData.Pages.forEach((page, pageIndex) => {
    // Group text fragments into lines by rounded y-coordinate
    const lineMap = new Map();

    page.Texts.forEach(t => {
      const y = Math.round(t.y * 10) / 10; // tolerance for same-line text
      const str = t.R.map(decodeRun).join("");
      if (!lineMap.has(y)) lineMap.set(y, []);
      lineMap.get(y).push({ x: t.x, str });
    });

    const sortedY = [...lineMap.keys()].sort((a, b) => a - b);

    out.push(`\n----- PAGE ${pageIndex + 1} -----`);
    sortedY.forEach(y => {
      const line = lineMap
        .get(y)
        .sort((a, b) => a.x - b.x)
        .map(o => o.str)
        .join("");
      if (line.trim().length) out.push(line);
    });
  });

  return out.join("\n");
}

const pdfParser = new PDFParser();

pdfParser.on("pdfParser_dataError", errData => {
  console.error("ERROR parsing PDF:", errData.parserError);
  process.exit(1);
});

pdfParser.on("pdfParser_dataReady", pdfData => {
  // Save raw parsed JSON for inspection
  fs.writeFileSync(outputJsonPath, JSON.stringify(pdfData, null, 2));

  // Reconstruct human-readable text
  const text = reconstructText(pdfData);
  fs.writeFileSync(outputTxtPath, text);

  console.log("=== pdf2json extraction complete ===");
  console.log("Input file :", inputPath);
  console.log("Pages      :", pdfData.Pages.length);
  console.log("Text length:", text.length, "chars");
  console.log("Raw JSON   ->", path.resolve(outputJsonPath));
  console.log("Text file  ->", path.resolve(outputTxtPath));
  console.log("\n--- Preview (first 500 chars) ---\n");
  console.log(text.slice(0, 500));
});

pdfParser.loadPDF(inputPath);