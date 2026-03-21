/**
 * Regex patterns for detecting and removing thinking block tags.
 * All tags are matched case-insensitively.
 */

export const THINKING_TAG_NAMES = [
  'thinking',
  'antThinking',
  'reflection',
  'scratchpad',
  'reasoning',
  'inner_monologue',
  'thought',
] as const;

export type ThinkingTagName = (typeof THINKING_TAG_NAMES)[number];

/**
 * Builds a regex that matches an outermost thinking block of the given tag name.
 * Matches <tag>...</tag> pairs case-insensitively (non-greedy inner content).
 */
export function buildThinkingTagPattern(tagName: string): RegExp {
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`<${escaped}>[\\s\\S]*?<\\/${escaped}>`, 'gi');
}

/**
 * Combined pattern that matches any thinking block opening tag.
 * Used as a fast predicate check before running the full removal logic.
 */
export const THINKING_TAG_PREDICATE = new RegExp(
  `<(?:${THINKING_TAG_NAMES.join('|')})>`,
  'i',
);

/**
 * Array of per-tag removal patterns (one per tag name).
 */
export const THINKING_TAG_PATTERNS: RegExp[] = THINKING_TAG_NAMES.map(buildThinkingTagPattern);
