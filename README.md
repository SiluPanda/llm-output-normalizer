# llm-output-normalizer

Strip markdown fences, thinking blocks, and extract clean data from raw LLM output.

LLM responses are noisy. They contain preamble text, thinking blocks, XML artifact wrappers, markdown fences, malformed JSON, and trailing commentary. This library runs a configurable pipeline of normalization steps to extract the clean, structured data you actually need.

## Installation

```bash
npm install llm-output-normalizer
```

## Quick Start

```ts
import { normalize, extractJSON } from 'llm-output-normalizer';

// normalize() runs the full pipeline and returns structured results
const result = normalize(`
Sure! Here's the JSON you requested:

\`\`\`json
{"name": "Alice", "age": 30}
\`\`\`

Let me know if you need anything else!
`);

console.log(result.text); // '{"name": "Alice", "age": 30}'
console.log(result.json); // { name: 'Alice', age: 30 }
console.log(result.type); // 'json'

// extractJSON() is a convenience wrapper for JSON extraction
const data = extractJSON<{ name: string; age: number }>(`
<thinking>The user wants structured data...</thinking>
{"name": "Bob", "age": 25}
`);

console.log(data); // { name: 'Bob', age: 25 }
```

## Available Exports

### Types

All TypeScript types are exported for use in your own code:

```ts
import type {
  NormalizeOptions,
  NormalizeResult,
  NormalizeMeta,
  CodeBlock,
  DetectResult,
  ExtractAllResult,
  ExtractJSONOptions,
  ExtractionMode,
  JsonStrategy,
  PreambleSensitivity,
  RepairLevel,
  StepConfig,
  Normalizer,
  BufferedNormalizerOptions,
  BufferedNormalizer,
} from 'llm-output-normalizer';
```

### Pipeline Runner

The pipeline runner executes an ordered sequence of transformation steps:

```ts
import { runPipeline } from 'llm-output-normalizer';
import type { PipelineStep, PipelineRunResult } from 'llm-output-normalizer';

const steps: PipelineStep[] = [
  {
    id: 'my-step',
    order: 1,
    enabled: true,
    predicate: (text) => text.includes('target'),
    transform: (text) => text.replace('target', 'replacement'),
  },
];

const result: PipelineRunResult = runPipeline(steps, 'some target text');
console.log(result.output);       // 'some replacement text'
console.log(result.stepsApplied); // ['my-step']
```

The `PipelineStep` interface:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique kebab-case step identifier |
| `order` | `number` | Execution order (lower runs first) |
| `enabled` | `boolean` | When `false`, step is skipped entirely |
| `predicate` | `(text: string) => boolean` | Fast check; if `false`, step is skipped |
| `transform` | `(text: string) => string` | The actual text transformation |

Steps are sorted by `order` before execution. If a step's `transform` throws, it is skipped gracefully and the text remains unchanged.

## Pipeline Steps

The normalization pipeline processes text through these steps in order:

| Order | Step | Status | Description |
|-------|------|--------|-------------|
| 1 | `unicode-normalize` | Done | Strip BOM, normalize whitespace, remove control chars, NFC normalize |
| 2 | `thinking-block-removal` | WIP | Remove `<thinking>`, `<antThinking>`, `<reflection>`, etc. |
| 3 | `xml-artifact-unwrap` | Planned | Unwrap `<artifact>`, `<result>`, `<answer>`, etc. |
| 4 | `preamble-strip` | Planned | Remove "Sure! Here's..." and similar preamble text |
| 5 | `postamble-strip` | Planned | Remove "Let me know if..." and similar postamble text |
| 6 | `markdown-fence-extract` | Planned | Extract content from triple-backtick and tilde fences |
| 7 | `json-extract` | Planned | Find and parse JSON using bracket-matching state machine |
| 8 | `json-repair` | Planned | Fix trailing commas, single quotes, unquoted keys, truncation |
| 9 | `whitespace-cleanup` | Planned | Trim, collapse blank lines, normalize line endings |

## Extraction Modes

The `normalize()` function supports several extraction modes via the `mode` option:

- **`auto`** (default) -- Runs full pipeline, detects content type automatically
- **`json`** -- Optimized for JSON extraction with repair
- **`code`** -- Extracts code blocks from markdown fences
- **`text`** -- Strips all structural elements, returns clean text
- **`all`** -- Extracts all JSON values and code blocks
- **`markdown`** -- Preserves markdown structure, strips only noise

## Configuration

```ts
import { normalize } from 'llm-output-normalizer';

const result = normalize(rawOutput, {
  mode: 'json',
  jsonStrategy: 'largest',    // 'first' | 'largest' | 'all'
  repair: 'aggressive',       // 'conservative' | 'moderate' | 'aggressive'
  preambleSensitivity: 'strict', // 'strict' | 'normal' | 'aggressive'
  steps: {
    'thinking-block-removal': true,
    'preamble-strip': { enabled: true, sensitivity: 'aggressive' },
    'json-repair': false,
  },
});
```

## Requirements

- Node.js >= 18

## License

MIT
