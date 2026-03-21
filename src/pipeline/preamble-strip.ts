import type { PipelineStep } from './index';

/** Preamble patterns — lines that LLMs often emit before the actual content. */
const PREAMBLE_PATTERNS: RegExp[] = [
  /^Sure[!,.]?\s*/i,
  /^Of course[!,.]?\s*/i,
  /^Certainly[!,.]?\s*/i,
  /^Absolutely[!,.]?\s*/i,
  /^I'd be happy\b/i,
  /^I'd be glad\b/i,
  /^I'm happy to\b/i,
  /^I'm glad to\b/i,
  /^Here is\b/i,
  /^Here's\b/i,
  /^Here are\b/i,
  /^Below is\b/i,
  /^Below are\b/i,
  /^The following\b/i,
  /^As requested[,!.]?\s*/i,
  /^As you requested[,!.]?\s*/i,
  /^Great[!,.]?\s*Here\b/i,
  /^No problem[!,.]?\s*/i,
];

/** Returns true if the given line looks like a preamble. */
function isPreambleLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed === '') return true; // blank lines between preamble are skippable
  // Conservative: never strip a line that looks like it contains JSON or code
  if (trimmed.includes('{') || trimmed.includes('[') || trimmed.startsWith('```')) {
    return false;
  }
  return PREAMBLE_PATTERNS.some((p) => p.test(trimmed));
}

/** Detects presence of preamble at the start of the text. */
function hasPreamble(text: string): boolean {
  const lines = text.split('\n');
  // Check only the first 3 non-empty lines
  let checked = 0;
  for (const line of lines) {
    if (line.trim() === '') continue;
    if (isPreambleLine(line)) return true;
    checked++;
    if (checked >= 3) break;
  }
  return false;
}

/** Step 4 — Preamble Strip (order 4) */
export const preambleStripStep: PipelineStep = {
  id: 'preamble-strip',
  order: 4,
  enabled: true,
  predicate(text: string): boolean {
    return hasPreamble(text);
  },
  transform(text: string): string {
    const lines = text.split('\n');
    let stripCount = 0;
    let nonPreambleSeen = false;

    // Only strip up to first 3 lines that match preamble; stop at first non-preamble
    for (let i = 0; i < lines.length && !nonPreambleSeen; i++) {
      const line = lines[i];
      if (line.trim() === '') {
        // blank line: count only after we've started stripping
        if (stripCount > 0) stripCount++;
        else stripCount++; // leading blank lines are fine to skip
      } else if (isPreambleLine(line) && stripCount < 3) {
        stripCount++;
      } else {
        nonPreambleSeen = true;
      }
    }

    const stripped = lines.slice(stripCount).join('\n');
    return stripped.trimStart();
  },
};
