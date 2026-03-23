import type { PipelineStep } from './index';

/** Returns true if the text looks like a JSON object or array that may be malformed. */
function looksLikeMalformedJson(text: string): boolean {
  const t = text.trim();
  return (t.startsWith('{') || t.startsWith('['));
}

/**
 * Conservative JSON repair:
 * 1. Remove trailing commas before `}` or `]`
 * 2. Close unclosed strings (if string count is odd, append `"`)
 * 3. Close unclosed brackets/braces
 *
 * Only operates when text starts with `{` or `[`.
 */
export function repairJson(text: string): string {
  let s = text.trim();

  // If it already parses, no repair needed
  try {
    JSON.parse(s);
    return s;
  } catch {
    // fall through to repair
  }

  // Step 1: Remove trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, '$1');

  // Step 2: Fix unclosed strings — count unescaped double-quotes
  // This is a simplified heuristic: count non-escaped `"` chars
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') {
      inString = !inString;
    }
  }
  // If we ended inside a string (inString is true), close it
  if (inString) {
    s = s + '"';
  }

  // Step 2.5: Handle incomplete key-value pairs (e.g., {"key": )
  s = s.replace(/:\s*$/, ': null');

  // Step 3: Close unclosed brackets/braces
  const stack: string[] = [];
  inString = false;
  escaped = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') {
      if (stack[stack.length - 1] === ch) stack.pop();
    }
  }

  // Append closing chars in reverse order
  for (let i = stack.length - 1; i >= 0; i--) {
    s = s + stack[i];
  }

  // Re-run trailing comma cleanup after bracket closure
  s = s.replace(/,\s*([}\]])/g, '$1');

  return s;
}

/** Step 8 — JSON Repair (order 8) */
export const jsonRepairStep: PipelineStep = {
  id: 'json-repair',
  order: 8,
  enabled: true,
  predicate(text: string): boolean {
    return looksLikeMalformedJson(text);
  },
  transform(text: string): string {
    return repairJson(text);
  },
};
