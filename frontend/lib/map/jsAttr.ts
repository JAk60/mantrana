/**
 * Produces a single-quoted JS string literal that is safe to embed inside
 * a double-quoted HTML attribute (e.g. onclick="...").
 *
 * JSON.stringify() is NOT safe here — it always emits double quotes,
 * which prematurely terminate a double-quoted onclick="" attribute the
 * instant the string contains a `"`.
 */
export function jsStringLiteralForAttr(str: string): string {
  const jsEscaped = str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

  // Defensive: escape any leftover double quotes for HTML-attribute safety.
  const htmlSafe = jsEscaped.replace(/"/g, '&quot;');

  return `'${htmlSafe}'`;
}