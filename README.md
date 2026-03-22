# llm-output-normalizer

Strip markdown fences, remove thinking blocks, and extract clean structured data from raw LLM output.

[![npm version](https://img.shields.io/npm/v/llm-output-normalizer.svg)](https://www.npmjs.com/package/llm-output-normalizer)
[![npm downloads](https://img.shields.io/npm/dt/llm-output-normalizer.svg)](https://www.npmjs.com/package/llm-output-normalizer)
[![license](https://img.shields.io/npm/l/llm-output-normalizer.svg)](https://github.com/SiluPanda/llm-output-normalizer/blob/master/LICENSE)
[![node](https://img.shields.io/node/v/llm-output-normalizer.svg)](https://nodejs.org)

---

## Description

LLM responses are noisy. A request for JSON comes back as `"Sure! Here's the JSON you requested:\n\n```json\n{\"name\": \"Alice\"}\n```\n\nLet me know if you need anything else!"` -- and your application needs just the parsed object `{"name": "Alice"}`. A request for code arrives wrapped in a thinking block, a conversational introduction, markdown fences, and a closing remark -- and you need just the code string. A local model returns JSON with trailing commas, unclosed brackets, or no closing brace at all -- and you need valid, parseable JSON.

`llm-output-normalizer` solves this with a deterministic, configurable pipeline of nine transformation steps that handles the full spectrum of LLM output quirks across all major providers. It runs in microseconds with zero runtime dependencies, requires no API keys or schema definitions, and works with output from OpenAI, Anthropic, Google, Mistral, local models, or any other source that produces a text string.

---

## Installation

```bash
npm install llm-output-normalizer
```

---

## Quick Start

```ts
import { normalize, extractJSON, extractCode } from 'llm-output-normalizer';

// Full pipeline: strips preamble, extracts from fence, parses JSON
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
console.log(result.confidence); // 0.9

// Direct JSON extraction with automatic repair
const data = extractJSON<{ name: string }>('{"name": "Alice",}');
console.log(data); // { name: 'Alice' }

// Code block extraction
const block = extractCode('```typescript\nconst x: number = 1;\n```');
console.log(block?.code);     // 'const x: number = 1;'
console.log(block?.language); // 'typescript'
```

---

## Features

- **Nine-step normalization pipeline** -- Unicode normalization, thinking block removal, XML artifact unwrapping, preamble stripping, postamble stripping, markdown fence extraction, JSON extraction, JSON repair, and whitespace cleanup, applied in a fixed order.
- **Automatic content type detection** -- Identifies whether LLM output contains JSON, code, markdown, or plain text, with a confidence score from 0.0 to 1.0.
- **JSON extraction and repair** -- Finds JSON embedded in prose using whole-text parsing, fence extraction, and bracket-matching. Repairs trailing commas, unclosed strings, and unclosed brackets/braces.
- **Thinking block removal** -- Strips `<thinking>`, `<antThinking>`, `<reflection>`, `<scratchpad>`, `<reasoning>`, `<inner_monologue>`, and `<thought>` tags and their contents, case-insensitively.
- **XML artifact unwrapping** -- Removes `<antArtifact>` and `<artifact>` wrapper tags, preserving the inner content.
- **Preamble and postamble stripping** -- Detects and removes common LLM conversational prefixes ("Sure!", "Here is", "Of course") and suffixes ("I hope this helps", "Let me know if", "Feel free to").
- **Markdown fence extraction** -- Extracts the content from fenced code blocks, returning the code string and its language tag.
- **Per-step configuration** -- Every pipeline step can be individually enabled or disabled.
- **Reusable normalizer instances** -- Create a pre-configured normalizer and reuse it across multiple calls.
- **Zero runtime dependencies** -- All functionality is implemented with Node.js built-in modules and hand-written parsers.
- **Full TypeScript support** -- Ships with declaration files, declaration maps, and source maps.

---

## API Reference

### `normalize(input, options?)`

Run the full normalization pipeline on raw LLM output.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `input` | `string` | Raw LLM output text |
| `options` | `NormalizeOptions` | Optional configuration (see [Configuration](#configuration)) |

**Returns:** `NormalizeResult`

| Field | Type | Description |
|-------|------|-------------|
| `text` | `string` | The cleaned output text. Always present. |
| `json` | `unknown \| undefined` | Parsed JSON value, if JSON was detected and successfully extracted. |
| `code` | `CodeBlock \| undefined` | Extracted code block, if a code fence was detected. |
| `type` | `'json' \| 'code' \| 'text' \| 'markdown'` | The detected content type. |
| `confidence` | `number` | Confidence score for the type detection (0.0 to 1.0). |
| `meta` | `NormalizeMeta` | Metadata about what the pipeline found and did. |

```ts
import { normalize } from 'llm-output-normalizer';

const result = normalize('<thinking>Let me reason...</thinking>\n{"answer": 42}');
console.log(result.json);                       // { answer: 42 }
console.log(result.meta.thinkingBlocksRemoved); // true
console.log(result.meta.stepsApplied);          // ['unicode-normalize', 'thinking-block-removal', ...]
console.log(result.meta.durationMs);            // 0 (sub-millisecond)
```

---

### `extractJSON<T>(input, options?)`

Extract and parse the first valid JSON value from raw LLM output. Applies the full pipeline (minus markdown fence extraction, which is handled internally), then uses three strategies in order: whole-text parse, fence extraction, and bracket-matching. Repairs common JSON malformations before parsing.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `input` | `string` | Raw LLM output text |
| `options` | `ExtractJSONOptions` | Optional configuration extending `NormalizeOptions` with a `raw` flag |

**Returns:** `T | undefined` -- The parsed JSON value cast to `T`, or `undefined` if no valid JSON is found.

```ts
import { extractJSON } from 'llm-output-normalizer';

// Basic extraction
const obj = extractJSON<{ name: string }>('Here is the data: {"name": "Bob"} -- done.');
console.log(obj); // { name: 'Bob' }

// Extracts through thinking blocks
const data = extractJSON<{ result: boolean }>(
  '<thinking>processing</thinking>\n{"result": true}'
);
console.log(data); // { result: true }

// Repairs trailing commas
const repaired = extractJSON<{ a: number }>('{"a": 1,}');
console.log(repaired); // { a: 1 }

// Returns raw JSON string instead of parsing
const raw = extractJSON('{"a": 1}', { raw: true });
console.log(typeof raw); // 'string'

// Returns undefined when no JSON found
const missing = extractJSON('no json here');
console.log(missing); // undefined
```

---

### `extractCode(input)`

Extract the first markdown fence code block from LLM output. Runs the pipeline with JSON-specific steps disabled, then finds fenced blocks in the result.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `input` | `string` | Raw LLM output text |

**Returns:** `CodeBlock | undefined`

| Field | Type | Description |
|-------|------|-------------|
| `code` | `string` | The code content without fence markers |
| `language` | `string \| undefined` | The language tag from the fence, if present |
| `index` | `number \| undefined` | Zero-based index of this code block in the original output |

```ts
import { extractCode } from 'llm-output-normalizer';

const block = extractCode('```python\nprint("hello")\n```');
console.log(block?.code);     // 'print("hello")'
console.log(block?.language); // 'python'

// No language tag
const raw = extractCode('```\nraw code\n```');
console.log(raw?.code);     // 'raw code'
console.log(raw?.language); // undefined

// Returns undefined when no fence found
const missing = extractCode('plain text');
console.log(missing); // undefined
```

---

### `extractAll(input)`

Extract all JSON values and code blocks from LLM output in a single pass. JSON values are collected from fenced blocks tagged with `json` as well as from bracket-matching the full output. Code blocks are collected from all fenced regions.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `input` | `string` | Raw LLM output text |

**Returns:** `ExtractAllResult`

| Field | Type | Description |
|-------|------|-------------|
| `json` | `unknown[]` | All extracted JSON values |
| `code` | `CodeBlock[]` | All extracted code blocks |
| `text` | `string` | The remaining text after fence markers are stripped |
| `meta` | `NormalizeMeta` | Metadata about the normalization process |

```ts
import { extractAll } from 'llm-output-normalizer';

const result = extractAll(`
Here are two snippets:

\`\`\`json
{"key": "value"}
\`\`\`

\`\`\`python
print("hello")
\`\`\`
`);

console.log(result.json);             // [{ key: 'value' }]
console.log(result.code.length);      // 2
console.log(result.code[0].language); // 'json'
console.log(result.code[1].language); // 'python'
```

---

### `detect(input)`

Detect the content type and structural features of raw LLM output without transforming it. Useful for routing logic or pre-flight checks before deciding how to process a response.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `input` | `string` | Raw LLM output text |

**Returns:** `DetectResult`

| Field | Type | Description |
|-------|------|-------------|
| `type` | `'json' \| 'code' \| 'text' \| 'markdown'` | The detected primary content type |
| `confidence` | `number` | Confidence score (0.0 to 1.0) |
| `hasPreamble` | `boolean` | Whether a conversational preamble was detected |
| `hasPostamble` | `boolean` | Whether a conversational postamble was detected |
| `hasFences` | `boolean` | Whether markdown code fences were detected |
| `fenceCount` | `number` | Number of code fences detected |
| `fenceLanguages` | `string[]` | Language tags detected in code fences |
| `hasThinkingBlocks` | `boolean` | Whether thinking blocks were detected |
| `hasXmlArtifacts` | `boolean` | Whether XML artifact tags were detected |
| `jsonCandidateCount` | `number` | Number of `{` or `[` characters found (heuristic) |

```ts
import { detect } from 'llm-output-normalizer';

const info = detect('Sure! Here\'s the code:\n```python\nprint("hi")\n```\nHope this helps!');
console.log(info.type);              // 'code'
console.log(info.hasPreamble);       // true
console.log(info.hasPostamble);      // true
console.log(info.hasFences);         // true
console.log(info.fenceCount);        // 1
console.log(info.fenceLanguages);    // ['python']
console.log(info.hasThinkingBlocks); // false
```

---

### `createNormalizer(options?)`

Create a reusable normalizer instance bound to a specific configuration. All methods on the returned object use the bound options, with per-call overrides available for `extractJSON`.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `options` | `NormalizeOptions` | Optional default configuration |

**Returns:** `Normalizer`

| Method | Signature | Description |
|--------|-----------|-------------|
| `normalize` | `(input: string) => NormalizeResult` | Run the full pipeline |
| `extractJSON` | `<T>(input: string, options?: ExtractJSONOptions) => T \| undefined` | Extract and parse JSON |
| `extractCode` | `(input: string) => CodeBlock \| undefined` | Extract first code block |
| `extractAll` | `(input: string) => ExtractAllResult` | Extract all structured elements |
| `detect` | `(input: string) => DetectResult` | Detect content type |

```ts
import { createNormalizer } from 'llm-output-normalizer';

const n = createNormalizer({
  steps: { 'thinking-block-removal': true, 'json-repair': false },
});

const result = n.normalize(rawOutput);
const data = n.extractJSON<MyType>(rawOutput);
const code = n.extractCode(rawOutput);
const all = n.extractAll(rawOutput);
const info = n.detect(rawOutput);
```

---

### `runPipeline(steps, input)`

Low-level pipeline runner. Executes an ordered sequence of `PipelineStep` objects against input text. Steps are sorted by their `order` field (ascending) before execution. For each step, if `enabled` is `false` or `predicate(text)` returns `false`, the step is skipped. If `transform` throws, the step is skipped gracefully and the text remains unchanged.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `steps` | `PipelineStep[]` | Array of pipeline steps to execute |
| `input` | `string` | The text to process |

**Returns:** `PipelineRunResult`

| Field | Type | Description |
|-------|------|-------------|
| `output` | `string` | The text after all applicable steps have run |
| `stepsApplied` | `string[]` | IDs of steps that were actually applied, in execution order |

**`PipelineStep` interface:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique kebab-case step identifier |
| `order` | `number` | Execution sequence (lower numbers run first) |
| `enabled` | `boolean` | When `false`, the step is skipped entirely |
| `predicate` | `(text: string) => boolean` | Fast check; if `false`, the step is skipped |
| `transform` | `(text: string) => string` | The transformation to apply |

```ts
import { runPipeline } from 'llm-output-normalizer';
import type { PipelineStep } from 'llm-output-normalizer';

const steps: PipelineStep[] = [
  {
    id: 'strip-prefix',
    order: 1,
    enabled: true,
    predicate: (text) => text.startsWith('RESULT: '),
    transform: (text) => text.replace(/^RESULT: /, ''),
  },
  {
    id: 'trim',
    order: 2,
    enabled: true,
    predicate: () => true,
    transform: (text) => text.trim(),
  },
];

const { output, stepsApplied } = runPipeline(steps, 'RESULT:   some data   ');
console.log(output);       // 'some data'
console.log(stepsApplied); // ['strip-prefix', 'trim']
```

---

## Configuration

The `NormalizeOptions` object controls the behavior of `normalize()`, `extractJSON()`, and `createNormalizer()`.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mode` | `ExtractionMode` | `'auto'` | Extraction mode: `'json'`, `'code'`, `'text'`, `'auto'`, `'all'`, or `'markdown'` |
| `jsonStrategy` | `JsonStrategy` | `'first'` | Strategy for multiple JSON candidates: `'first'`, `'largest'`, or `'all'` |
| `repair` | `RepairLevel` | `'moderate'` | JSON repair aggressiveness: `'conservative'`, `'moderate'`, or `'aggressive'` |
| `preambleSensitivity` | `PreambleSensitivity` | `'normal'` | Preamble detection sensitivity: `'strict'`, `'normal'`, or `'aggressive'` |
| `customPreamblePatterns` | `RegExp[]` | `undefined` | Additional preamble patterns to detect beyond the built-in set |
| `customPostamblePatterns` | `RegExp[]` | `undefined` | Additional postamble patterns to detect beyond the built-in set |
| `steps` | `Record<string, boolean \| StepConfig>` | `undefined` | Per-step enable/disable overrides (keys are step IDs) |
| `codeBlockIndex` | `number` | `0` | For code mode: select a specific code block by zero-based index |
| `codeBlockLanguage` | `string` | `undefined` | For code mode: select the first code block matching this language tag (takes precedence over `codeBlockIndex`) |

The `ExtractJSONOptions` interface extends `NormalizeOptions` with one additional field:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `raw` | `boolean` | `false` | If `true`, return the raw JSON string instead of parsing it |

### Step Configuration

Individual pipeline steps can be toggled via the `steps` option. Keys are step IDs; values are `boolean` (enable/disable) or `StepConfig` objects.

```ts
normalize(input, {
  steps: {
    'thinking-block-removal': false,      // disable this step
    'preamble-strip': { enabled: true },  // enable with StepConfig
    'json-repair': false,                 // disable JSON repair
  },
});
```

Available step IDs: `unicode-normalize`, `thinking-block-removal`, `xml-artifact-unwrap`, `preamble-strip`, `postamble-strip`, `markdown-fence-extract`, `json-extract`, `json-repair`, `whitespace-cleanup`.

---

## Error Handling

`llm-output-normalizer` is designed to be fault-tolerant rather than exception-throwing.

- **`normalize()`** always returns a `NormalizeResult`. If JSON extraction fails, `result.json` is `undefined` and `result.text` contains the cleaned text. Non-fatal errors are recorded in `result.meta.errors`.
- **`extractJSON()`** returns `undefined` when no valid JSON can be found or parsed, rather than throwing.
- **`extractCode()`** returns `undefined` when no fenced code block is found.
- **`extractAll()`** returns empty arrays (`json: []`, `code: []`) when no structured data is found.
- **`detect()`** always returns a complete `DetectResult`; there is no failure case.
- **Pipeline steps** that throw during `predicate()` or `transform()` are skipped gracefully. The text remains unchanged and the step is not recorded in `stepsApplied`. This prevents a single malformed step from breaking the entire pipeline.

The `NormalizeMeta` object attached to results provides full observability into what the pipeline did:

```ts
interface NormalizeMeta {
  stepsApplied: string[];        // Which steps ran
  preambleRemoved: boolean;      // Was preamble detected and removed?
  preambleText?: string;         // The removed preamble text
  postambleRemoved: boolean;     // Was postamble detected and removed?
  postambleText?: string;        // The removed postamble text
  thinkingBlocksRemoved: boolean;
  xmlArtifactsUnwrapped: boolean;
  xmlArtifactTag?: string;
  fencesExtracted: boolean;
  fenceCount: number;            // Fences in the original input
  jsonRepaired: boolean;
  jsonRepairs?: string[];        // List of repairs applied
  jsonTruncated: boolean;
  jsonCandidateCount: number;
  durationMs: number;            // Processing time in milliseconds
  errors: string[];              // Non-fatal errors encountered
}
```

---

## Pipeline Steps

The normalization pipeline processes text through nine steps in fixed order:

| Order | Step ID | Description |
|-------|---------|-------------|
| 1 | `unicode-normalize` | Strips UTF-8 BOM, replaces Unicode whitespace (NBSP, em space, en space, thin space, ZWSP, ZWNJ, ZWJ, ideographic space) with ASCII space, removes control characters (U+0000--U+001F except tab/LF/CR), applies NFC normalization |
| 2 | `thinking-block-removal` | Removes `<thinking>`, `<antThinking>`, `<reflection>`, `<scratchpad>`, `<reasoning>`, `<inner_monologue>`, and `<thought>` blocks and their contents (case-insensitive) |
| 3 | `xml-artifact-unwrap` | Unwraps `<antArtifact ...>content</antArtifact>` and `<artifact ...>content</artifact>` tags, keeping only the inner content |
| 4 | `preamble-strip` | Removes leading lines matching common LLM preamble patterns: "Sure!", "Of course!", "Certainly!", "Absolutely!", "I'd be happy", "I'd be glad", "I'm happy to", "I'm glad to", "Here is", "Here's", "Here are", "Below is", "Below are", "The following", "As requested", "As you requested", "Great! Here", "No problem" |
| 5 | `postamble-strip` | Removes trailing lines matching common LLM postamble patterns: "I hope this helps", "Hope this helps", "Let me know if", "Feel free to", "Please let me know", "Is there anything else", "If you need/have/want", "If you'd like", "Don't hesitate to", "Happy to help", "Any other questions" |
| 6 | `markdown-fence-extract` | When exactly one fenced code block is present, extracts its content and strips the fence markers. Multiple fences are left intact. |
| 7 | `json-extract` | Finds valid JSON using three strategies: (1) parse the whole trimmed text, (2) extract from a `` ```json `` fence, (3) bracket-match from the first `{` or `[` |
| 8 | `json-repair` | Repairs malformed JSON: removes trailing commas before `}` or `]`, closes unclosed strings, closes unclosed brackets and braces |
| 9 | `whitespace-cleanup` | Collapses 3+ consecutive newlines to 2, collapses 2+ consecutive spaces to 1 (outside code blocks), trims leading and trailing whitespace |

Each step has a predicate that short-circuits execution when the step is not applicable, keeping processing fast for inputs that do not require every transformation.

---

## Advanced Usage

### Disabling Specific Pipeline Steps

Disable steps that are not relevant to your use case for faster processing or to preserve specific content:

```ts
import { normalize } from 'llm-output-normalizer';

// Keep thinking blocks in the output
const result = normalize(input, {
  steps: {
    'thinking-block-removal': false,
  },
});

// Only run Unicode normalization and whitespace cleanup
const minimal = normalize(input, {
  steps: {
    'thinking-block-removal': false,
    'xml-artifact-unwrap': false,
    'preamble-strip': false,
    'postamble-strip': false,
    'markdown-fence-extract': false,
    'json-extract': false,
    'json-repair': false,
  },
});
```

### Custom Pipeline Steps

Build custom pipelines by defining your own `PipelineStep` objects and running them with `runPipeline`:

```ts
import { runPipeline } from 'llm-output-normalizer';
import type { PipelineStep } from 'llm-output-normalizer';

const customSteps: PipelineStep[] = [
  {
    id: 'strip-citation-tags',
    order: 1,
    enabled: true,
    predicate: (text) => text.includes('<cite>'),
    transform: (text) => text.replace(/<cite>[\s\S]*?<\/cite>/g, ''),
  },
  {
    id: 'normalize-quotes',
    order: 2,
    enabled: true,
    predicate: () => true,
    transform: (text) => text.replace(/[\u201C\u201D]/g, '"'),
  },
];

const { output } = runPipeline(customSteps, rawLlmOutput);
```

### Pre-configured Normalizer Instance

When processing many responses with the same configuration, create a normalizer instance to avoid re-specifying options:

```ts
import { createNormalizer } from 'llm-output-normalizer';

const jsonNormalizer = createNormalizer({
  steps: {
    'preamble-strip': true,
    'postamble-strip': true,
    'thinking-block-removal': true,
    'json-repair': true,
  },
});

// Reuse across multiple calls
const result1 = jsonNormalizer.extractJSON<MyType>(response1);
const result2 = jsonNormalizer.extractJSON<MyType>(response2);
```

### Content-Type Routing

Use `detect()` to route responses to different processing paths:

```ts
import { detect, extractJSON, extractCode, normalize } from 'llm-output-normalizer';

function processResponse(raw: string) {
  const info = detect(raw);

  switch (info.type) {
    case 'json':
      return { kind: 'data', value: extractJSON(raw) };
    case 'code':
      return { kind: 'code', value: extractCode(raw) };
    default:
      return { kind: 'text', value: normalize(raw).text };
  }
}
```

### Extracting Multiple Code Blocks

Use `extractAll()` when an LLM response contains multiple code blocks:

```ts
import { extractAll } from 'llm-output-normalizer';

const result = extractAll(multiBlockResponse);

for (const block of result.code) {
  console.log(`[${block.language ?? 'unknown'}] ${block.code.slice(0, 50)}...`);
}

for (const jsonValue of result.json) {
  console.log('Parsed JSON:', jsonValue);
}
```

---

## TypeScript

`llm-output-normalizer` is written in TypeScript and ships with full type declarations, declaration maps, and source maps. All public types are exported from the package entry point.

```ts
import type {
  // Options
  ExtractionMode,
  JsonStrategy,
  PreambleSensitivity,
  RepairLevel,
  StepConfig,
  NormalizeOptions,
  ExtractJSONOptions,

  // Results
  CodeBlock,
  NormalizeMeta,
  NormalizeResult,
  ExtractAllResult,
  DetectResult,

  // Instances
  Normalizer,
  BufferedNormalizerOptions,
  BufferedNormalizer,

  // Pipeline
  PipelineStep,
  PipelineRunResult,
} from 'llm-output-normalizer';
```

The `extractJSON` function supports generic type parameters for typed extraction:

```ts
interface User {
  name: string;
  age: number;
}

const user = extractJSON<User>('{"name": "Alice", "age": 30}');
// user is User | undefined
```

---

## License

MIT
