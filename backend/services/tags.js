/**
 * Tags are stored as one space-separated string, the same way HomeBank's CSV carries them.
 * Accepts a string ("food #trip, work") or an array; returns a clean, de-duplicated string.
 */
export const MAX_TAGS = 20;
export const MAX_TAG_LENGTH = 40;

export function normalizeTags(input) {
  const raw = Array.isArray(input) ? input.join(' ') : String(input ?? '');
  const seen = new Set();
  const out = [];
  for (const piece of raw.split(/[\s,;]+/)) {
    // Characters that would break CSV export or the space-separated format are dropped
    const tag = piece.replace(/^#+/, '').replace(/[;"'\\]/g, '').slice(0, MAX_TAG_LENGTH);
    if (!tag || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    out.push(tag);
    if (out.length >= MAX_TAGS) break;
  }
  return out.join(' ');
}

export const mergeTags = (a, b) => normalizeTags(`${a || ''} ${b || ''}`);
