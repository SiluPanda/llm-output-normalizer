import type { PipelineStep } from './index';

/** Postamble patterns — trailing lines LLMs often add after the actual content. */
const POSTAMBLE_PATTERNS: RegExp[] = [
  /^I hope (this|that) helps?\b/i,
  /^Hope this helps?\b/i,
  /^Let me know if\b/i,
  /^Feel free to\b/i,
  /^Please let me know\b/i,
  /^Is there anything else\b/i,
  /^If you (need|have|want)\b/i,
  /^If you'd like\b/i,
  /^Don't hesitate to\b/i,
  /^Let me know (if|whether)\b/i,
  /^Happy to help\b/i,
  /^Any (other|more) questions\b/i,
];

/** Returns true if a trimmed line looks like a postamble. */
function isPostambleLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed === '') return true;
  return POSTAMBLE_PATTERNS.some((p) => p.test(trimmed));
}

/** Detects the presence of postamble at the end of the text. */
function hasPostamble(text: string): boolean {
  const lines = text.split('\n');
  // scan from the end; check up to 3 non-empty lines
  let checked = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (line.trim() === '') continue;
    if (isPostambleLine(line)) return true;
    checked++;
    if (checked >= 3) break;
  }
  return false;
}

/** Step 5 — Postamble Strip (order 5) */
export const postambleStripStep: PipelineStep = {
  id: 'postamble-strip',
  order: 5,
  enabled: true,
  predicate(text: string): boolean {
    return hasPostamble(text);
  },
  transform(text: string): string {
    const lines = text.split('\n');
    let endIndex = lines.length;

    // Walk from end; strip trailing postamble lines (up to 5)
    let stripped = 0;
    for (let i = lines.length - 1; i >= 0 && stripped < 5; i--) {
      const line = lines[i];
      if (isPostambleLine(line)) {
        endIndex = i;
        stripped++;
      } else {
        break;
      }
    }

    return lines.slice(0, endIndex).join('\n').trimEnd();
  },
};
