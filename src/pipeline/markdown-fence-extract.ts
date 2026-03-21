import type { PipelineStep } from './index';
import type { CodeBlock } from '../types';

/** Matches a single fenced code block (``` or ~~~), with optional language tag. */
const FENCE_PATTERN = /^(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)\n?\1\s*$/gm;

/**
 * Find all fenced code blocks in text.
 * Returns an array of CodeBlock objects.
 */
export function findFencedBlocks(text: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  FENCE_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = FENCE_PATTERN.exec(text)) !== null) {
    const lang = match[2].trim() || undefined;
    const code = match[3];
    blocks.push({ code, language: lang, index });
    index++;
  }
  return blocks;
}

/** Returns true if text contains at least one fence block. */
function hasFence(text: string): boolean {
  FENCE_PATTERN.lastIndex = 0;
  return FENCE_PATTERN.test(text);
}

/** Step 6 — Markdown Fence Extract (order 6) */
export const markdownFenceExtractStep: PipelineStep = {
  id: 'markdown-fence-extract',
  order: 6,
  enabled: true,
  predicate(text: string): boolean {
    return hasFence(text);
  },
  transform(text: string): string {
    const blocks = findFencedBlocks(text);
    // Only extract when there is exactly one fence block
    if (blocks.length !== 1) {
      return text;
    }
    return blocks[0].code;
  },
};
