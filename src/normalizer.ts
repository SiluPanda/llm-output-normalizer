// llm-output-normalizer — High-level API
import { runPipeline } from './pipeline/index';
import type { PipelineStep } from './pipeline/index';
import { unicodeNormalizeStep } from './pipeline/unicode-normalize';
import { thinkingBlockRemovalStep } from './pipeline/thinking-block-removal';
import { xmlArtifactUnwrapStep } from './pipeline/xml-artifact-unwrap';
import { preambleStripStep } from './pipeline/preamble-strip';
import { postambleStripStep } from './pipeline/postamble-strip';
import { markdownFenceExtractStep } from './pipeline/markdown-fence-extract';
import { jsonExtractStep } from './pipeline/json-extract';
import { jsonRepairStep } from './pipeline/json-repair';
import { whitespaceCleanupStep } from './pipeline/whitespace-cleanup';
import { findFencedBlocks } from './pipeline/markdown-fence-extract';
import { extractJsonString } from './pipeline/json-extract';
import { repairJson } from './pipeline/json-repair';
import { THINKING_TAG_PREDICATE } from './patterns/thinking-tags';
import type {
  NormalizeOptions,
  NormalizeResult,
  NormalizeMeta,
  ExtractJSONOptions,
  CodeBlock,
  ExtractAllResult,
  DetectResult,
  Normalizer,
} from './types';

// ── Step registry ─────────────────────────────────────────────────────────────

const ALL_STEPS: PipelineStep[] = [
  unicodeNormalizeStep,
  thinkingBlockRemovalStep,
  xmlArtifactUnwrapStep,
  preambleStripStep,
  postambleStripStep,
  markdownFenceExtractStep,
  jsonExtractStep,
  jsonRepairStep,
  whitespaceCleanupStep,
];

// ── Internal helpers ──────────────────────────────────────────────────────────

function buildSteps(options?: NormalizeOptions): PipelineStep[] {
  if (!options?.steps) return ALL_STEPS.map((s) => ({ ...s }));

  return ALL_STEPS.map((step) => {
    const override = options.steps![step.id];
    if (override === undefined) return { ...step };
    if (typeof override === 'boolean') return { ...step, enabled: override };
    // StepConfig object
    const enabled = override.enabled !== undefined ? !!override.enabled : step.enabled;
    return { ...step, enabled };
  });
}

function buildMeta(
  stepsApplied: string[],
  original: string,
  durationMs: number,
): NormalizeMeta {
  // Count fences in original
  const fenceBlocks = findFencedBlocks(original);
  const fenceCount = fenceBlocks.length;

  return {
    stepsApplied,
    preambleRemoved: stepsApplied.includes('preamble-strip'),
    preambleText: undefined,
    postambleRemoved: stepsApplied.includes('postamble-strip'),
    postambleText: undefined,
    thinkingBlocksRemoved: stepsApplied.includes('thinking-block-removal'),
    xmlArtifactsUnwrapped: stepsApplied.includes('xml-artifact-unwrap'),
    xmlArtifactTag: undefined,
    fencesExtracted: stepsApplied.includes('markdown-fence-extract'),
    fenceCount,
    jsonRepaired: stepsApplied.includes('json-repair'),
    jsonRepairs: undefined,
    jsonTruncated: false,
    jsonCandidateCount: countJsonCandidates(original),
    durationMs,
    errors: [],
  };
}

function countJsonCandidates(text: string): number {
  // Count occurrences of top-level { or [ that could start JSON
  let count = 0;
  for (const ch of text) {
    if (ch === '{' || ch === '[') count++;
  }
  return count;
}

function detectType(text: string): { type: NormalizeResult['type']; confidence: number } {
  const trimmed = text.trim();
  if (!trimmed) return { type: 'text', confidence: 1.0 };

  // Try parsing as JSON
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(trimmed);
      return { type: 'json', confidence: 0.95 };
    } catch {
      // might be malformed JSON — lower confidence
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        return { type: 'json', confidence: 0.5 };
      }
    }
  }

  // Detect markdown fences
  if (/```|~~~/.test(trimmed)) {
    const blocks = findFencedBlocks(trimmed);
    if (blocks.length > 0) {
      // Check if the fence contains code (non-JSON language or no language)
      const firstBlock = blocks[0];
      if (!firstBlock.language || firstBlock.language.toLowerCase() !== 'json') {
        return { type: 'code', confidence: 0.9 };
      }
      return { type: 'json', confidence: 0.85 };
    }
    return { type: 'markdown', confidence: 0.7 };
  }

  // Detect markdown headings / lists
  if (/^#{1,6}\s/m.test(trimmed) || /^\*\s|^-\s|^\d+\.\s/m.test(trimmed)) {
    return { type: 'markdown', confidence: 0.7 };
  }

  return { type: 'text', confidence: 0.8 };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Run the full normalization pipeline on raw LLM output.
 */
export function normalize(input: string, options?: NormalizeOptions): NormalizeResult {
  const start = Date.now();
  const steps = buildSteps(options);
  const { output, stepsApplied } = runPipeline(steps, input);
  const durationMs = Date.now() - start;

  const meta = buildMeta(stepsApplied, input, durationMs);

  // Detect type and optionally parse JSON.
  // If markdown-fence-extract was applied, the output is now the raw code content;
  // use the original input's fence info to determine if this was a code block.
  let type: NormalizeResult['type'];
  let confidence: number;

  if (stepsApplied.includes('markdown-fence-extract')) {
    const originalBlocks = findFencedBlocks(input);
    const singleBlock = originalBlocks.length === 1 ? originalBlocks[0] : null;
    if (singleBlock) {
      const lang = singleBlock.language?.toLowerCase();
      if (lang === 'json') {
        type = 'json';
        confidence = 0.9;
      } else {
        type = 'code';
        confidence = 0.9;
      }
    } else {
      const detected = detectType(output);
      type = detected.type;
      confidence = detected.confidence;
    }
  } else {
    const detected = detectType(output);
    type = detected.type;
    confidence = detected.confidence;
  }

  let json: unknown = undefined;
  let code: CodeBlock | undefined = undefined;

  if (type === 'json') {
    try {
      json = JSON.parse(output.trim());
    } catch {
      // Not parseable after pipeline — try extracting
      const candidate = extractJsonString(output);
      if (candidate) {
        try { json = JSON.parse(candidate); } catch { /* ignore */ }
      }
    }
  }

  if (type === 'code') {
    const blocks = findFencedBlocks(output);
    if (blocks.length > 0) {
      const idx = options?.codeBlockIndex ?? 0;
      if (options?.codeBlockLanguage) {
        code = blocks.find((b) => b.language === options.codeBlockLanguage) ?? blocks[idx];
      } else {
        code = blocks[idx] ?? blocks[0];
      }
    }
  }

  return { text: output, json, code, type, confidence, meta };
}

/**
 * Extract and parse the first valid JSON from raw LLM output.
 * Returns undefined if no valid JSON is found.
 */
export function extractJSON<T = unknown>(
  input: string,
  options?: ExtractJSONOptions,
): T | undefined {
  // Run a pipeline focused on JSON extraction
  const jsonSteps = buildSteps({
    ...options,
    steps: {
      ...options?.steps,
      'markdown-fence-extract': false, // we want to extract from fences manually
    },
  });
  const { output } = runPipeline(jsonSteps, input);

  // Find the best JSON string candidate from the output
  let candidate: string | null = null;

  // Try the whole output first
  const trimmedOutput = output.trim();
  try {
    JSON.parse(trimmedOutput);
    candidate = trimmedOutput;
  } catch { /* fall through */ }

  // Try bracket-match extraction if whole-output parse failed
  if (!candidate) {
    candidate = extractJsonString(output);
    if (!candidate) return undefined;
  }

  // Optionally repair
  const toparse = repairJson(candidate);

  if (options?.raw) return toparse as unknown as T;

  try {
    return JSON.parse(toparse) as T;
  } catch {
    return undefined;
  }
}

/**
 * Extract the first markdown fence code block from LLM output.
 * Returns undefined if no fence block is found.
 */
export function extractCode(input: string): CodeBlock | undefined {
  // Run pipeline without json-specific steps
  const steps = buildSteps({
    steps: {
      'json-extract': false,
      'json-repair': false,
      'markdown-fence-extract': false,
    },
  });
  const { output } = runPipeline(steps, input);
  const blocks = findFencedBlocks(output);
  return blocks.length > 0 ? blocks[0] : undefined;
}

/**
 * Extract all JSON values and code blocks from LLM output.
 */
export function extractAll(input: string): ExtractAllResult {
  const start = Date.now();
  const steps = buildSteps({
    steps: {
      'markdown-fence-extract': false,
      'json-extract': false,
      'json-repair': false,
    },
  });
  const { output, stepsApplied } = runPipeline(steps, input);
  const durationMs = Date.now() - start;
  const meta = buildMeta(stepsApplied, input, durationMs);

  // Extract all code blocks
  const code = findFencedBlocks(output);

  // Extract all JSON candidates
  const jsonValues: unknown[] = [];
  // Try each code block whose language is json
  for (const block of code) {
    if (block.language?.toLowerCase() === 'json') {
      try {
        jsonValues.push(JSON.parse(block.code));
      } catch { /* skip */ }
    }
  }
  // Strip fence markers for prose text and prose JSON extraction
  let text = output;
  if (code.length > 0) {
    // Replace all fences with their content for a cleaner text view
    const fenceGlobal = /(`{3,}|~{3,})[^\n]*\n([\s\S]*?)\n?\1\s*/gm;
    text = output.replace(fenceGlobal, '').trim();
  }

  // Also try bracket-matching the prose (fences stripped) for additional JSON
  const rawJson = extractJsonString(text);
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      // Avoid duplicates by comparing serialized form
      const serialized = JSON.stringify(parsed);
      const isDuplicate = jsonValues.some(v => JSON.stringify(v) === serialized);
      if (!isDuplicate) jsonValues.push(parsed);
    } catch { /* skip */ }
  }

  return { json: jsonValues, code, text, meta };
}

/**
 * Detect the content type of raw LLM output without transforming it.
 */
export function detect(input: string): DetectResult {
  const XML_ARTIFACT_PRED = /<antArtifact|<artifact\b/i;

  const fenceBlocks = findFencedBlocks(input);
  const fenceLanguages = fenceBlocks
    .map((b) => b.language)
    .filter((l): l is string => !!l);

  // Check preamble (first 3 lines)
  const lines = input.split('\n');
  const PREAMBLE_PATS = [
    /^Sure[!,.]?\s*/i, /^Of course/i, /^Certainly/i, /^Absolutely/i,
    /^I'd be happy/i, /^Here is/i, /^Here's/i, /^Here are/i,
    /^Below is/i, /^The following/i, /^As requested/i,
  ];
  const POSTAMBLE_PATS = [
    /^I hope (this|that) helps?/i, /^Hope this helps?/i, /^Let me know if/i,
    /^Feel free to/i, /^Please let me know/i, /^Is there anything else/i,
    /^If you (need|have|want)/i, /^Don't hesitate to/i, /^Happy to help/i,
  ];

  let hasPreamble = false;
  let checked = 0;
  for (const line of lines) {
    if (line.trim() === '') continue;
    if (PREAMBLE_PATS.some((p) => p.test(line.trim()))) { hasPreamble = true; break; }
    checked++;
    if (checked >= 3) break;
  }

  let hasPostamble = false;
  checked = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (line.trim() === '') continue;
    if (POSTAMBLE_PATS.some((p) => p.test(line.trim()))) { hasPostamble = true; break; }
    checked++;
    if (checked >= 3) break;
  }

  const { type, confidence } = detectType(input);

  return {
    type,
    confidence,
    hasPreamble,
    hasPostamble,
    hasFences: fenceBlocks.length > 0,
    fenceCount: fenceBlocks.length,
    fenceLanguages,
    hasThinkingBlocks: THINKING_TAG_PREDICATE.test(input),
    hasXmlArtifacts: XML_ARTIFACT_PRED.test(input),
    jsonCandidateCount: countJsonCandidates(input),
  };
}

/**
 * Create a normalizer instance bound to the given options.
 */
export function createNormalizer(options?: NormalizeOptions): Normalizer {
  return {
    normalize: (input: string) => normalize(input, options),
    extractJSON: <T = unknown>(input: string, overrides?: ExtractJSONOptions) =>
      extractJSON<T>(input, { ...options, ...overrides }),
    extractCode: (input: string) => extractCode(input),
    extractAll: (input: string) => extractAll(input),
    detect: (input: string) => detect(input),
  };
}
