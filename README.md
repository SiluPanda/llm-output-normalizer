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

### High-Level API

#### `normalize(input, options?): NormalizeResult`

Runs the full normalization pipeline on raw LLM output. Returns a `NormalizeResult` containing:
- `text` — the cleaned output text
- `json` — parsed JSON value (if JSON was detected)
- `code` — extracted code block (if a code fence was detected)
- `type` — detected content type: `'json' | 'code' | 'text' | 'markdown'`
- `confidence` — detection confidence (0.0–1.0)
- `meta` — detailed metadata about what the pipeline did

```ts
import { normalize } from 'llm-output-normalizer';

const result = normalize(rawOutput, {
  mode: 'json',
  jsonStrategy: 'largest',
  repair: 'aggressive',
  preambleSensitivity: 'strict',
  steps: {
    'thinking-block-removal': true,
    'preamble-strip': { enabled: true },
    'json-repair': false,
  },
});
```

#### `extractJSON<T>(input, options?): T | undefined`

Extract and parse the first valid JSON value from raw LLM output. Returns the parsed value or `undefined` if no valid JSON is found. Repairs common JSON issues (trailing commas, unclosed brackets) before parsing.

```ts
import { extractJSON } from 'llm-output-normalizer';

const data = extractJSON<{ name: string }>(`
<thinking>Let me think...</thinking>
\`\`\`json
{"name": "Alice",}
\`\`\`
`);
// => { name: 'Alice' }

// Get the raw JSON string instead of parsing
const raw = extractJSON('{"a": 1}', { raw: true }); // => '{"a": 1}'
```

#### `extractCode(input): CodeBlock | undefined`

Find and return the first markdown fence code block. Returns `{ code, language?, index? }` or `undefined`.

```ts
import { extractCode } from 'llm-output-normalizer';

const block = extractCode('```typescript\nconst x = 1;\n```');
// => { code: 'const x = 1;', language: 'typescript', index: 0 }
```

#### `extractAll(input): ExtractAllResult`

Extract all JSON values and code blocks in a single pass. Returns `{ json, code, text, meta }`.

```ts
import { extractAll } from 'llm-output-normalizer';

const result = extractAll(response);
result.json  // unknown[]  — all parsed JSON values
result.code  // CodeBlock[] — all code blocks
result.text  // string     — text with fences stripped
```

#### `detect(input): DetectResult`

Detect the content type and structural features without transforming the text.

```ts
import { detect } from 'llm-output-normalizer';

const info = detect(rawOutput);
info.type              // 'json' | 'code' | 'text' | 'markdown'
info.confidence        // 0.0–1.0
info.hasPreamble       // boolean
info.hasPostamble      // boolean
info.hasFences         // boolean
info.fenceCount        // number
info.fenceLanguages    // string[]
info.hasThinkingBlocks // boolean
info.hasXmlArtifacts   // boolean
info.jsonCandidateCount // number
```

#### `createNormalizer(options?): Normalizer`

Create a reusable normalizer instance bound to a specific configuration.

```ts
import { createNormalizer } from 'llm-output-normalizer';

const n = createNormalizer({ mode: 'json', repair: 'conservative' });

n.normalize(rawOutput);
n.extractJSON(rawOutput);
n.extractCode(rawOutput);
n.extractAll(rawOutput);
n.detect(rawOutput);
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

| Order | Step | Description |
|-------|------|-------------|
| 1 | `unicode-normalize` | Strip BOM, normalize whitespace chars to ASCII space, remove control chars, NFC normalize |
| 2 | `thinking-block-removal` | Remove `<thinking>`, `<antThinking>`, `<reflection>`, `<scratchpad>`, `<reasoning>`, `<inner_monologue>`, `<thought>` blocks |
| 3 | `xml-artifact-unwrap` | Unwrap `<antArtifact ...>content</antArtifact>` and `<artifact>` tags, keeping inner content |
| 4 | `preamble-strip` | Remove leading lines matching common LLM preamble patterns ("Sure!", "Here is", "Of course", etc.) |
| 5 | `postamble-strip` | Remove trailing lines matching common LLM postamble patterns ("I hope this helps", "Let me know if", etc.) |
| 6 | `markdown-fence-extract` | When exactly one fence block is present, extract its content and strip the fence markers |
| 7 | `json-extract` | Find the first/best valid JSON object or array using whole-text parse, fence extraction, or bracket-matching |
| 8 | `json-repair` | Conservative JSON repair: remove trailing commas, close unclosed strings and brackets |
| 9 | `whitespace-cleanup` | Collapse 3+ consecutive newlines to 2, collapse 2+ spaces to 1 (outside code blocks), trim |

## Extraction Modes

The `normalize()` function supports several extraction modes via the `mode` option:

- **`auto`** (default) — Runs full pipeline, detects content type automatically
- **`json`** — Optimized for JSON extraction with repair
- **`code`** — Extracts code blocks from markdown fences
- **`text`** — Strips all structural elements, returns clean text
- **`all`** — Extracts all JSON values and code blocks
- **`markdown`** — Preserves markdown structure, strips only noise

## Configuration

```ts
import { normalize } from 'llm-output-normalizer';

const result = normalize(rawOutput, {
  mode: 'json',
  jsonStrategy: 'largest',       // 'first' | 'largest' | 'all'
  repair: 'aggressive',          // 'conservative' | 'moderate' | 'aggressive'
  preambleSensitivity: 'strict', // 'strict' | 'normal' | 'aggressive'
  steps: {
    'thinking-block-removal': true,
    'preamble-strip': { enabled: true },
    'json-repair': false,
  },
});
```

## Requirements

- Node.js >= 18

## License

MIT
