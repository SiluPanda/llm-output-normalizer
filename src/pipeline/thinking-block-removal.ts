import type { PipelineStep } from './index';
import {
  THINKING_TAG_PATTERNS,
  THINKING_TAG_PREDICATE,
} from '../patterns/thinking-tags';

/** Step 2 — Thinking Block Removal (order 2) */
export const thinkingBlockRemovalStep: PipelineStep = {
  id: 'thinking-block-removal',
  order: 2,
  enabled: true,
  predicate(text: string): boolean {
    return THINKING_TAG_PREDICATE.test(text);
  },
  transform(text: string): string {
    let result = text;
    for (const pattern of THINKING_TAG_PATTERNS) {
      // Reset lastIndex in case the regex is global/sticky
      pattern.lastIndex = 0;
      result = result.replace(pattern, '');
    }
    return result;
  },
};
