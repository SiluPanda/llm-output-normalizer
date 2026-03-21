// llm-output-normalizer — Type definitions

// ── Extraction Mode ──────────────────────────────────────────────────

/** The extraction mode determines what type of content to extract. */
export type ExtractionMode = 'json' | 'code' | 'text' | 'auto' | 'all' | 'markdown';

/** Strategy for handling multiple JSON candidates. */
export type JsonStrategy = 'first' | 'largest' | 'all';

/** Sensitivity level for preamble/postamble detection. */
export type PreambleSensitivity = 'strict' | 'normal' | 'aggressive';

/** Aggressiveness level for JSON repair. */
export type RepairLevel = 'conservative' | 'moderate' | 'aggressive';

// ── Options ──────────────────────────────────────────────────────────

/** Configuration for an individual pipeline step. */
export interface StepConfig {
  /** Whether this step is enabled. */
  enabled?: boolean;

  /** Step-specific options (varies by step). */
  [key: string]: unknown;
}

/** Options for the normalize function. */
export interface NormalizeOptions {
  /**
   * Extraction mode. Determines what type of content to extract.
   * Default: 'auto'.
   */
  mode?: ExtractionMode;

  /**
   * Strategy for handling multiple JSON candidates.
   * Only relevant in 'json' and 'auto' modes.
   * Default: 'first'.
   */
  jsonStrategy?: JsonStrategy;

  /**
   * JSON repair aggressiveness.
   * Default: 'moderate'.
   */
  repair?: RepairLevel;

  /**
   * Preamble detection sensitivity.
   * Default: 'normal'.
   */
  preambleSensitivity?: PreambleSensitivity;

  /**
   * Custom preamble patterns to detect (in addition to built-in patterns).
   * Each pattern should match a complete preamble line.
   */
  customPreamblePatterns?: RegExp[];

  /**
   * Custom postamble patterns to detect (in addition to built-in patterns).
   */
  customPostamblePatterns?: RegExp[];

  /**
   * Per-step configuration overrides.
   * Keys are step IDs. Values are booleans (enable/disable) or
   * step-specific configuration objects.
   */
  steps?: Record<string, boolean | StepConfig>;

  /**
   * For 'code' mode: select a specific code block by zero-based index.
   * Default: 0 (first code block).
   */
  codeBlockIndex?: number;

  /**
   * For 'code' mode: select the first code block matching this language tag.
   * Takes precedence over codeBlockIndex if both are specified.
   */
  codeBlockLanguage?: string;
}

/** Options for extractJSON. */
export interface ExtractJSONOptions extends NormalizeOptions {
  /**
   * If true, return the raw JSON string instead of parsing it.
   * Useful when you need the string for further processing.
   * Default: false.
   */
  raw?: boolean;
}

// ── Result Types ─────────────────────────────────────────────────────

/** An extracted code block. */
export interface CodeBlock {
  /** The code content (without fence markers). */
  code: string;

  /** The language tag from the fence, if present. */
  language?: string;

  /** Zero-based index of this code block in the original output. */
  index?: number;
}

/** Metadata about the normalization process. */
export interface NormalizeMeta {
  /** Which pipeline steps were applied. */
  stepsApplied: string[];

  /** Whether preamble text was detected and removed. */
  preambleRemoved: boolean;

  /** The removed preamble text, if any. */
  preambleText?: string;

  /** Whether postamble text was detected and removed. */
  postambleRemoved: boolean;

  /** The removed postamble text, if any. */
  postambleText?: string;

  /** Whether thinking blocks were detected and removed. */
  thinkingBlocksRemoved: boolean;

  /** Whether XML artifact tags were unwrapped. */
  xmlArtifactsUnwrapped: boolean;

  /** The unwrapped XML tag name, if any. */
  xmlArtifactTag?: string;

  /** Whether markdown fences were detected and extracted. */
  fencesExtracted: boolean;

  /** Number of code fences found in the original output. */
  fenceCount: number;

  /** Whether JSON repair was applied. */
  jsonRepaired: boolean;

  /** List of repairs applied to JSON, if any. */
  jsonRepairs?: string[];

  /** Whether the JSON was truncated and recovered. */
  jsonTruncated: boolean;

  /** Total number of JSON candidates found. */
  jsonCandidateCount: number;

  /** Processing time in milliseconds. */
  durationMs: number;

  /** Errors encountered during processing (non-fatal). */
  errors: string[];
}

/** Result of the normalize function. */
export interface NormalizeResult {
  /** The cleaned text output. Always present. */
  text: string;

  /** Parsed JSON value, if JSON was detected and successfully extracted. */
  json?: unknown;

  /** Extracted code block, if a code fence was detected. */
  code?: CodeBlock;

  /** The detected content type. */
  type: 'json' | 'code' | 'text' | 'markdown';

  /** Confidence score for the type detection (0.0 to 1.0). */
  confidence: number;

  /** Metadata about what the pipeline found and did. */
  meta: NormalizeMeta;
}

/** Result of the extractAll function. */
export interface ExtractAllResult {
  /** All extracted JSON values. */
  json: unknown[];

  /** All extracted code blocks. */
  code: CodeBlock[];

  /** The remaining text after all extractions. */
  text: string;

  /** Metadata about the normalization process. */
  meta: NormalizeMeta;
}

/** Result of the detect function. */
export interface DetectResult {
  /** The detected primary content type. */
  type: 'json' | 'code' | 'text' | 'markdown';

  /** Confidence score for the detection (0.0 to 1.0). */
  confidence: number;

  /** Whether a preamble was detected. */
  hasPreamble: boolean;

  /** Whether a postamble was detected. */
  hasPostamble: boolean;

  /** Whether markdown code fences were detected. */
  hasFences: boolean;

  /** Number of code fences detected. */
  fenceCount: number;

  /** Language tags detected in code fences. */
  fenceLanguages: string[];

  /** Whether thinking blocks were detected. */
  hasThinkingBlocks: boolean;

  /** Whether XML artifact tags were detected. */
  hasXmlArtifacts: boolean;

  /** Number of JSON candidates detected (without parsing them). */
  jsonCandidateCount: number;
}

// ── Normalizer Instance ──────────────────────────────────────────────

/** A configured normalizer instance created by createNormalizer(). */
export interface Normalizer {
  /** Normalize raw LLM output using this instance's configuration. */
  normalize(input: string): NormalizeResult;

  /** Extract JSON using this instance's configuration. */
  extractJSON<T = unknown>(input: string, options?: ExtractJSONOptions): T | undefined;

  /** Extract code using this instance's configuration. */
  extractCode(input: string): CodeBlock | undefined;

  /** Extract all structured elements using this instance's configuration. */
  extractAll(input: string): ExtractAllResult;

  /** Detect content type using this instance's configuration. */
  detect(input: string): DetectResult;
}

// ── Buffered / Streaming Normalizer ──────────────────────────────────

/** Options for the buffered streaming normalizer. */
export interface BufferedNormalizerOptions extends NormalizeOptions {
  /**
   * Optional callback invoked when a complete structural element is
   * detected in the buffer before the stream ends. Receives a partial
   * NormalizeResult. Useful for early rendering in streaming UIs.
   */
  onPartial?: (partial: NormalizeResult) => void;
}

/** A buffer-based normalizer for streaming LLM responses. */
export interface BufferedNormalizer {
  /** Append a chunk to the internal buffer. */
  write(chunk: string): void;

  /** Signal end of stream. Runs the full pipeline and returns the result. */
  end(): NormalizeResult;

  /** Reset the buffer for reuse. */
  reset(): void;

  /** Get the current buffer contents without processing. */
  peek(): string;

  /** Get the current buffer length. */
  readonly length: number;
}
