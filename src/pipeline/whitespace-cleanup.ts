import type { PipelineStep } from './index';

/**
 * Collapse runs of 3+ consecutive newlines to exactly 2, trim leading/trailing
 * whitespace, and collapse 2+ consecutive spaces to 1 (outside code blocks).
 *
 * Code blocks (``` ... ```) are preserved verbatim.
 */
function cleanupWhitespace(text: string): string {
  // Split text into code-block segments and non-code segments
  const parts = text.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~)/g);

  const processed = parts.map((part, i) => {
    // Even indices are outside code blocks; odd indices are code blocks
    if (i % 2 === 1) {
      // Inside a code block — preserve as-is
      return part;
    }
    // Outside code blocks:
    // 1. Collapse 3+ newlines to 2
    let s = part.replace(/\n{3,}/g, '\n\n');
    // 2. Collapse 2+ spaces (not newlines) to 1
    s = s.replace(/[ \t]{2,}/g, ' ');
    return s;
  });

  return processed.join('').trim();
}

/** Step 9 — Whitespace Cleanup (order 9) */
export const whitespaceCleanupStep: PipelineStep = {
  id: 'whitespace-cleanup',
  order: 9,
  enabled: true,
  predicate(): boolean {
    return true;
  },
  transform(text: string): string {
    return cleanupWhitespace(text);
  },
};
