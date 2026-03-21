import type { PipelineStep } from './index';

/** Fast predicate: is there any potential JSON opener in the text? */
function hasJsonCandidate(text: string): boolean {
  return text.includes('{') || text.includes('[');
}

/**
 * Attempt to extract a valid JSON string from text using three strategies:
 * 1. Parse the whole trimmed text.
 * 2. Find a ```json ... ``` fence block and parse its contents.
 * 3. Find the first `{` or `[` and use bracket-matching to extract the span.
 *
 * Returns the raw JSON string, or null if no valid JSON is found.
 */
export function extractJsonString(text: string): string | null {
  const trimmed = text.trim();

  // Strategy 1: the entire text is valid JSON
  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    // fall through
  }

  // Strategy 2: find a ```json fence
  const fencePattern = /```(?:json)?\s*\n?([\s\S]*?)\n?```/i;
  const fenceMatch = fencePattern.exec(trimmed);
  if (fenceMatch) {
    const candidate = fenceMatch[1].trim();
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // fall through
    }
  }

  // Strategy 3: bracket-match from first { or [
  const firstBrace = trimmed.indexOf('{');
  const firstBracket = trimmed.indexOf('[');

  let startIndex = -1;
  if (firstBrace === -1 && firstBracket === -1) return null;
  if (firstBrace === -1) startIndex = firstBracket;
  else if (firstBracket === -1) startIndex = firstBrace;
  else startIndex = Math.min(firstBrace, firstBracket);

  const openChar = trimmed[startIndex];
  const closeChar = openChar === '{' ? '}' : ']';

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIndex; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === openChar) depth++;
    else if (ch === closeChar) {
      depth--;
      if (depth === 0) {
        const candidate = trimmed.slice(startIndex, i + 1);
        try {
          JSON.parse(candidate);
          return candidate;
        } catch {
          // Not valid even with bracket matching — give up
          return null;
        }
      }
    }
  }

  return null;
}

/** Step 7 — JSON Extract (order 7) */
export const jsonExtractStep: PipelineStep = {
  id: 'json-extract',
  order: 7,
  enabled: true,
  predicate(text: string): boolean {
    return hasJsonCandidate(text);
  },
  transform(text: string): string {
    const extracted = extractJsonString(text);
    return extracted !== null ? extracted : text;
  },
};
