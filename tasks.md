# llm-output-normalizer — Task Breakdown

## Phase 1: Project Scaffolding & Types

- [x] **Install dev dependencies** — Install `typescript`, `vitest`, `eslint`, and `@types/node` as dev dependencies. Verify `npm run build`, `npm run test`, and `npm run lint` scripts work (even if they produce empty output). | Status: done

- [x] **Define all TypeScript types in `src/types.ts`** — Create the types file with all interfaces and type aliases from the spec: `ExtractionMode`, `JsonStrategy`, `PreambleSensitivity`, `RepairLevel`, `NormalizeOptions`, `StepConfig`, `ExtractJSONOptions`, `NormalizeResult`, `CodeBlock`, `NormalizeMeta` (including the `errors` array field), `ExtractAllResult`, `DetectResult`, `Normalizer`, `BufferedNormalizerOptions`, `BufferedNormalizer`. Ensure all fields, optionality markers, and JSDoc comments match the spec exactly. | Status: done

- [x] **Implement pipeline step interface and runner in `src/pipeline/index.ts`** — Define the `PipelineStep` interface with fields: `id` (kebab-case string), `order` (integer), `predicate` (fast applicability check), `transform` (the transformation function), and `enabled` (boolean toggle). Implement the pipeline runner function that accepts an array of steps and input text, runs steps sequentially in order, skips disabled steps and steps whose predicate returns false, records which steps were applied in metadata, and handles per-step timeout (100ms abort with graceful fallback). | Status: done

- [x] **Set up `src/index.ts` as the public API barrel export** — Export all public functions (`normalize`, `extractJSON`, `extractCode`, `extractAll`, `detect`, `createNormalizer`, `createBufferedNormalizer`), all public types, and the `presets` object. This file should re-export from the individual module files. | Status: done

---

## Phase 2: Pipeline Steps — Implementation

### Step 1: Unicode Normalization

- [x] **Implement `src/pipeline/unicode-normalize.ts`** — Implement the unicode-normalize step (order 1). Must: strip UTF-8 BOM (U+FEFF) from the start of the string; replace unusual Unicode whitespace characters (U+00A0, U+2003, U+2002, U+2009, U+200B, U+200C, U+200D, U+3000) with ASCII space (U+0020); remove Unicode control characters (U+0000-U+001F) except tab (U+0009), newline (U+000A), and carriage return (U+000D); normalize Unicode to NFC form. Predicate always returns true. This step cannot be disabled. | Status: done

- [x] **Write tests for unicode normalization in `src/__tests__/pipeline/unicode.test.ts`** — Test BOM removal, non-breaking space replacement, zero-width character removal, control character removal (except tab/newline/CR), NFC normalization, and passthrough of clean input. | Status: done

### Step 2: Thinking Block Removal

- [x] **Create thinking tag patterns in `src/patterns/thinking-tags.ts`** — Define regex patterns for all documented thinking block tags: `<thinking>`, `<antThinking>`, `<reflection>`, `<scratchpad>`, `<reasoning>`, `<inner_monologue>`, `<thought>`. Patterns must be case-insensitive and match opening/closing tag pairs. | Status: done

- [ ] **Implement `src/pipeline/thinking-block-removal.ts`** — Implement the thinking-block-removal step (order 2). Must match outermost tag pairs, remove everything between tags including the tags themselves, handle multiple thinking blocks in a single response, handle nested thinking blocks by matching outermost pair, and support custom tags via `customTags` step config option. Predicate checks for presence of any opening thinking tag using a fast regex scan. | Status: not_done

- [ ] **Write tests for thinking block removal in `src/__tests__/pipeline/thinking.test.ts`** — Test each tag type (`<thinking>`, `<antThinking>`, `<reflection>`, `<scratchpad>`, `<reasoning>`, `<inner_monologue>`, `<thought>`), multiple thinking blocks, nested tags, case insensitivity, content preservation around blocks, custom tags, and no-op when no thinking tags present. | Status: not_done

### Step 3: XML Artifact Unwrapping

- [ ] **Create XML artifact tag patterns in `src/patterns/xml-artifacts.ts`** — Define the list of recognized wrapper tags: `artifact`, `result`, `answer`, `output`, `response`, `code`, `json`, `data`. | Status: not_done

- [ ] **Implement `src/pipeline/xml-artifact-unwrap.ts`** — Implement the xml-artifact-unwrap step (order 3). Must detect recognized wrapper tags, extract content inside the tags and discard tags and text outside them, handle tags with attributes (e.g., `<artifact type="application/json" title="User Data">`), extract innermost wrapper when multiple are nested, pass through unchanged when no recognized tags are found, and support custom tags via `customTags` step config option. Predicate checks for any recognized opening tag. | Status: not_done

- [ ] **Write tests for XML artifact unwrapping in `src/__tests__/pipeline/xmlArtifact.test.ts`** — Test each recognized tag, tags with attributes, nested artifacts, content outside tags being discarded, custom tags, passthrough when no tags present, and case insensitivity. | Status: not_done

### Step 4: Preamble Stripping

- [ ] **Create preamble regex patterns in `src/patterns/preambles.ts`** — Implement all seven preamble pattern categories from the spec: (1) Affirmative + delivery ("Sure! Here's..."), (2) Certainty + delivery ("Certainly! Here is..."), (3) Transition + delivery ("Great question!..."), (4) Compliance acknowledgment ("I've generated..."), (5) Bare introductions ("The result is:"), (6) Let me / I'll / I'd be happy, (7) Based on / Given / According to. Each pattern must be case-insensitive and allow flexible punctuation. | Status: not_done

- [ ] **Implement `src/pipeline/preamble-strip.ts`** — Implement the preamble-strip step (order 4). Must operate line by line from start of text. Classify lines as preamble if they match a known pattern, or are short lines (<200 chars) ending with colon followed by blank line + structural content (in `normal` mode). Stop at structural content (`{`, `[`, `<`, backtick fence), long non-matching lines, or content lines. Never remove the first line of actual content. If the entire response is a single line matching a preamble pattern with no subsequent content, do not remove it. Support three sensitivity levels: `strict` (exact catalog matches only), `normal` (catalog + heuristic colon detection), `aggressive` (strip all text before first structural element). Support `customPreamblePatterns` option. | Status: not_done

- [ ] **Write tests for preamble stripping in `src/__tests__/pipeline/preamble.test.ts`** — Test each preamble pattern category (~30 fixtures), all three sensitivity levels, custom patterns, preservation of content-only input, single-line preamble edge case, blank line handling between preamble and content, and structural content start detection. | Status: not_done

### Step 5: Postamble Stripping

- [ ] **Create postamble regex patterns in `src/patterns/postambles.ts`** — Implement all five postamble pattern categories from the spec: (1) Offers of assistance ("Let me know if..."), (2) Hopes and wishes ("I hope this helps!"), (3) Notes and disclaimers ("Note that..."), (4) Explanatory coda ("This JSON follows..."), (5) Availability and sign-offs ("Best regards,", "Cheers!"). | Status: not_done

- [ ] **Implement `src/pipeline/postamble-strip.ts`** — Implement the postamble-strip step (order 5). Must operate line by line from end of text, working backwards. Classify lines as postamble if they match a known pattern, or are short conversational lines following structural content. Stop at structural content (`}`, `]`, backtick fence, `>`). Support `customPostamblePatterns` option. | Status: not_done

- [ ] **Write tests for postamble stripping in `src/__tests__/pipeline/postamble.test.ts`** — Test each postamble pattern category (~20 fixtures), custom patterns, preservation of content without postamble, postamble after JSON, postamble after code fence, and blank line handling. | Status: not_done

### Step 6: Markdown Fence Extraction

- [ ] **Implement `src/pipeline/markdown-fence-extract.ts`** — Implement the markdown-fence-extract step (order 6). Must support: triple backtick with/without language tag, triple tilde with/without language tag, four+ backtick fences (matching same count for close). Handle mode-dependent behavior: `json` mode prefers `json`-tagged fence, then first fence with `{`/`[` content, then first fence; `code` mode extracts first fence or by `codeBlockIndex`/`codeBlockLanguage`; `all` mode extracts all fences; `text`/`auto` mode replaces single fence with its content. Handle nested fences (backtick inside tilde and vice versa) by counting delimiters. Handle unclosed fences (extract to end of text). Handle fence with only whitespace content (not extracted in `json` mode). Return language tag as metadata. | Status: not_done

- [ ] **Write tests for markdown fence extraction in `src/__tests__/pipeline/fences.test.ts`** — Test: JSON in ```json fence, code in ```python fence, bare ``` fence, ~~~ tilde fence, multiple fences, nested fences, unclosed fence, four-backtick fence, fence with whitespace-only content, language tag capture, mode-dependent selection logic, `codeBlockIndex` and `codeBlockLanguage` options. | Status: not_done

### Step 7: JSON Extraction

- [ ] **Implement `src/pipeline/json-extract.ts`** — Implement the json-extract step (order 7) using the bracket-matching state machine algorithm from the spec. Track depth, inString, and escaped state variables. Scan for first unquoted `{` or `[`, track nesting, handle strings and escapes correctly, find complete JSON values when depth returns to zero. Attempt `JSON.parse` on each candidate; if it fails, pass to json-repair step. Support `strategy` option: `first` (default), `largest`, `all`. Handle multiple top-level JSON values in same text. | Status: not_done

- [ ] **Write tests for JSON extraction in `src/__tests__/pipeline/jsonExtract.test.ts`** — Test: JSON embedded in prose, multiple JSON objects, bracket characters inside strings, escaped quotes, nested objects/arrays to deep levels, `first`/`largest`/`all` strategies, no JSON found returns undefined, text that looks like JSON but isn't (e.g., "this is {not} JSON"), pure JSON input. | Status: not_done

### Step 8: JSON Repair

- [ ] **Implement `src/pipeline/json-repair.ts`** — Implement the json-repair step (order 8). Apply repairs in the documented order: (1) strip comments (`//` and `/* */`), (2) remove trailing commas, (3) fix double commas, (4) single-to-double quote conversion (with state machine to avoid replacing inside double-quoted strings), (5) quote unquoted keys (bare identifiers before colons), (6) replace JS literals (`undefined`->null, `NaN`->null, `Infinity`->1e308, `-Infinity`->-1e308, only in value position), (7) full-width punctuation normalization, (8) unescaped string repair (literal newlines, tabs, control chars), (9) truncation completion (close open strings, add null for incomplete key-value pairs, close containers in reverse order). After each repair, retry `JSON.parse` and stop if it succeeds (minimal intervention). Support three repair levels: `conservative` (trailing commas, comments, truncation), `moderate` (adds single quotes, unquoted keys, JS literals), `aggressive` (adds full-width punctuation, markdown emphasis removal, speculative repairs). Record all repairs applied in metadata. | Status: not_done

- [ ] **Write tests for JSON repair in `src/__tests__/pipeline/jsonRepair.test.ts`** — Test each repair operation individually: trailing commas in objects and arrays, single-quoted strings, unquoted keys, line and block comments, `undefined`/`NaN`/`Infinity` literals, full-width Chinese punctuation, truncated JSON at various depths, double commas, unescaped newlines in strings, multiple malformations in one value, markdown emphasis in values, all three repair levels, and the minimal intervention principle (stop after first successful parse). | Status: not_done

### Step 9: Whitespace Cleanup

- [ ] **Implement `src/pipeline/whitespace-cleanup.ts`** — Implement the whitespace-cleanup step (order 9). Must: trim leading and trailing whitespace, collapse three or more consecutive newlines into two, normalize line endings to `\n` (replace `\r\n` and `\r`), remove trailing whitespace from individual lines. Skipped when output is a parsed JSON object. Always runs as the last step. | Status: not_done

- [ ] **Write tests for whitespace cleanup in `src/__tests__/pipeline/whitespace.test.ts`** — Test: leading/trailing whitespace trimming, excessive blank line collapsing, `\r\n` and `\r` normalization, trailing whitespace on individual lines, passthrough of already-clean text, and interaction with previous pipeline steps leaving blank lines. | Status: not_done

---

## Phase 3: Public API Functions

- [ ] **Implement `src/normalize.ts`** — Implement the `normalize()` function. Accepts raw LLM output string and `NormalizeOptions`. Orchestrates the full pipeline, handles extraction mode logic (`auto` detection running steps 1-6 then examining text; `json` mode; `code` mode; `text` mode; `all` mode; `markdown` mode). Returns `NormalizeResult` with `text`, `json`, `code`, `type`, `confidence`, and `meta` fields. Populates all metadata fields: `stepsApplied`, `preambleRemoved`, `preambleText`, `postambleRemoved`, `postambleText`, `thinkingBlocksRemoved`, `xmlArtifactsUnwrapped`, `xmlArtifactTag`, `fencesExtracted`, `fenceCount`, `jsonRepaired`, `jsonRepairs`, `jsonTruncated`, `jsonCandidateCount`, `durationMs`, `errors`. Throws `TypeError` on null/undefined input. Returns valid empty result on empty string. | Status: not_done

- [ ] **Implement `src/extractJSON.ts`** — Implement the `extractJSON<T>()` function. Wraps `normalize()` in `json` mode. Returns the parsed value as `T | undefined`. Supports `ExtractJSONOptions` including `raw` option (return raw JSON string instead of parsed value). Returns `undefined` if no JSON found or repair fails. | Status: not_done

- [ ] **Implement `src/extractCode.ts`** — Implement the `extractCode()` function. Wraps `normalize()` in `code` mode. Returns `CodeBlock | undefined` with `code` string and optional `language` tag. Returns `undefined` if no code fence found. Supports `codeBlockIndex` and `codeBlockLanguage` options. | Status: not_done

- [ ] **Implement `src/extractAll.ts`** — Implement the `extractAll()` function. Wraps `normalize()` in `all` mode. Returns `ExtractAllResult` with `json` array (all extracted JSON values), `code` array (all extracted code blocks), `text` (remaining text after extractions), and `meta`. | Status: not_done

- [ ] **Implement `src/detect.ts`** — Implement the `detect()` function. Analyzes raw LLM output without performing extraction. Returns `DetectResult` with: `type` (json/code/text/markdown), `confidence` (0.0-1.0), `hasPreamble`, `hasPostamble`, `hasFences`, `fenceCount`, `fenceLanguages`, `hasThinkingBlocks`, `hasXmlArtifacts`, `jsonCandidateCount`. Confidence scoring: pure JSON = 1.0, JSON in fence = 0.9, JSON in prose = 0.7, pure text = 1.0. | Status: not_done

- [ ] **Write tests for `normalize()` in `src/__tests__/normalize.test.ts`** — Test all extraction modes (json, code, text, auto, all, markdown), confidence scoring, metadata population, TypeError on null/undefined, empty string handling, auto-detection logic, and combined scenarios (preamble + fence + JSON + postamble). | Status: not_done

- [ ] **Write tests for `extractJSON()` in `src/__tests__/extractJSON.test.ts`** — Test: clean JSON extraction, JSON in fences, JSON in prose, malformed JSON repair, truncated JSON recovery, `raw` option, `undefined` return on no JSON, generic type parameter usage, strategy options. | Status: not_done

- [ ] **Write tests for `extractCode()` in `src/__tests__/extractCode.test.ts`** — Test: code in backtick fence, code in tilde fence, language tag extraction, `codeBlockIndex` selection, `codeBlockLanguage` selection, no fence returns undefined, multiple fences. | Status: not_done

- [ ] **Write tests for `extractAll()` in `src/__tests__/extractAll.test.ts`** — Test: multiple JSON objects extracted, multiple code blocks extracted, remaining text after extractions, mixed JSON and code blocks, empty results when nothing structural. | Status: not_done

- [ ] **Write tests for `detect()` in `src/__tests__/detect.test.ts`** — Test: JSON detection with confidence, code detection, text detection, preamble detection, postamble detection, fence counting, fence language extraction, thinking block detection, XML artifact detection, JSON candidate counting. | Status: not_done

---

## Phase 4: Configuration, Factory & Presets

- [ ] **Implement `src/presets.ts`** — Define named configuration presets: `minimal` (unicode + fences + whitespace, auto mode, conservative repair), `strictJSON` (all steps, json mode, aggressive repair), `cleanText` (unicode + thinking + xml + preamble + postamble + whitespace, text mode), `passthrough` (unicode + whitespace, text mode), `default` (all steps, auto mode, moderate repair). Each preset must be a valid `NormalizeOptions` object. | Status: not_done

- [ ] **Implement `src/factory.ts` — `createNormalizer()`** — Implement the factory function that creates a configured `Normalizer` instance. Accepts `NormalizeOptions`, returns an object with `normalize()`, `extractJSON()`, `extractCode()`, `extractAll()`, and `detect()` methods that use the preset configuration. Options are parsed once at creation time and reused across calls. | Status: not_done

- [ ] **Implement per-step configuration merging** — Ensure the pipeline runner correctly merges per-step options from `NormalizeOptions.steps` into each step's behavior. Support boolean values to enable/disable steps, and `StepConfig` objects with step-specific options (e.g., `sensitivity` for preamble-strip, `level` for json-repair, `customPatterns` for preamble/postamble, `customTags` for thinking/xml, `strategy` for json-extract, `preferLanguage` for markdown-fence-extract). | Status: not_done

- [ ] **Write tests for presets** — Test that each preset produces the expected behavior: `minimal` only runs unicode/fences/whitespace, `strictJSON` extracts JSON aggressively, `cleanText` strips noise without JSON extraction, `passthrough` does minimal cleanup. | Status: not_done

- [ ] **Write tests for `createNormalizer()`** — Test: factory creates working instance, instance methods use configured options, multiple instances with different configs work independently, preset options are applied correctly. | Status: not_done

---

## Phase 5: Streaming Support

- [ ] **Implement `src/buffered.ts` — `BufferedNormalizer` class** — Implement the streaming buffer class. Must provide: `write(chunk)` method that appends to internal buffer, `end()` method that runs full pipeline on accumulated buffer and returns `NormalizeResult`, `reset()` method to clear buffer for reuse, `peek()` method to return current buffer contents without processing, `length` readonly property for current buffer length. Support `onPartial` callback that fires when a complete structural element (JSON object or code fence) is detected in the buffer before stream ends. | Status: not_done

- [ ] **Implement `createBufferedNormalizer()` in `src/factory.ts`** — Add the factory function for creating `BufferedNormalizer` instances. Accepts `BufferedNormalizerOptions` (extends `NormalizeOptions` with `onPartial` callback). | Status: not_done

- [ ] **Implement streaming JSON detection** — Within the buffered normalizer, detect when bracket depth returns to zero in the accumulated buffer (indicating a complete JSON object) and fire `onPartial` callback with early result. Handle truncated streams by applying truncation recovery from json-repair step on `end()`. | Status: not_done

- [ ] **Write tests for `BufferedNormalizer` in `src/__tests__/streaming.test.ts`** — Test: chunk accumulation, `end()` produces same result as `normalize()` on complete text, `reset()` clears buffer, `peek()` returns buffer contents, `length` property, `onPartial` callback fires on complete JSON, truncated stream recovery on `end()`, multiple `write()` calls building up a complete response, reuse after `reset()`. | Status: not_done

---

## Phase 6: CLI

- [ ] **Implement `src/cli.ts` — CLI entry point** — Implement the CLI that reads from stdin (or `--file <path>`). Parse all documented flags: `--json`, `--code`, `--text`, `--auto`, `--all`, `--markdown` (mode options); `--strategy`, `--repair`, `--raw-json` (JSON options); `--preamble`, `--no-preamble`, `--no-postamble` (preamble options); `--disable`, `--only` (step control); `--format`, `--compact`, `--no-color` (output options); `--version`, `--help` (general). Implement exit codes: 0 (success), 1 (extraction failed), 2 (config error). Output cleaned result to stdout, metadata/errors to stderr. Support stdin/stdout pipeline composition. | Status: not_done

- [ ] **Add `bin` field to `package.json`** — Add `"bin": { "llm-output-normalizer": "dist/cli.js" }` to package.json so the CLI is available after global install or via npx. | Status: not_done

- [ ] **Write CLI integration tests in `src/__tests__/cli.test.ts`** — Test: `--json` mode extracts JSON from stdin, `--code` mode extracts code, `--text` mode cleans text, `--format meta` outputs metadata, `--compact` flag, `--file` option, `--disable` and `--only` step control, exit code 0 on success, exit code 1 on extraction failure, exit code 2 on config error, `--version` output, `--help` output, pipeline composition (piped input). | Status: not_done

---

## Phase 7: Test Fixtures

- [ ] **Create preamble test fixtures in `src/__tests__/fixtures/preambles.ts`** — Create ~30 fixtures covering every preamble pattern category. Each fixture has raw input string and expected cleaned output. | Status: not_done

- [ ] **Create postamble test fixtures in `src/__tests__/fixtures/postambles.ts`** — Create ~20 fixtures covering every postamble pattern category. | Status: not_done

- [ ] **Create fence test fixtures in `src/__tests__/fixtures/fences.ts`** — Create fixtures for: JSON in ```json fence, code in language-tagged fences, bare fences, tilde fences, multiple fences, nested fences, unclosed fences, four-backtick fences. | Status: not_done

- [ ] **Create JSON repair test fixtures in `src/__tests__/fixtures/jsonRepair.ts`** — Create fixtures for each repair operation: trailing commas, single quotes, unquoted keys, comments, JS literals, full-width punctuation, truncated JSON at various depths, double commas, multiple malformations combined. | Status: not_done

- [ ] **Create thinking block test fixtures in `src/__tests__/fixtures/thinking.ts`** — Create fixtures for each thinking tag type, multiple blocks, nested tags. | Status: not_done

- [ ] **Create combined test fixtures in `src/__tests__/fixtures/combined.ts`** — Create fixtures with multiple issues: preamble + fence + postamble + JSON, thinking block + preamble + fence + JSON repair + postamble, XML artifact + preamble + malformed JSON, multiple fences with preambles/postambles. | Status: not_done

- [ ] **Create edge case test fixtures in `src/__tests__/fixtures/edgeCases.ts`** — Create fixtures for: empty string, pure valid JSON, pure text, text that looks like JSON but isn't, Unicode BOM input, unusual whitespace characters, very large input (100KB+), deeply nested JSON (50+ levels), JSON with very long string values (10KB+). | Status: not_done

---

## Phase 8: Error Handling & Defensive Coding

- [ ] **Implement TypeError on null/undefined input** — Ensure `normalize()`, `extractJSON()`, `extractCode()`, `extractAll()`, and `detect()` all throw `TypeError` when input is `null` or `undefined`. This is the only case where the library throws. | Status: not_done

- [ ] **Implement non-throwing failure modes** — Ensure `extractJSON()` returns `undefined` (not throws) when no JSON is found or repair fails. Ensure `extractCode()` returns `undefined` when no fence is found. Ensure `normalize()` in `auto` mode returns `{ type: 'text' }` when nothing structural is detected. Ensure empty string returns `{ type: 'text', text: '', confidence: 1.0 }`. | Status: not_done

- [ ] **Implement per-step error handling with timeout** — Each pipeline step must have implicit 100ms timeout. If a step exceeds the timeout, abort the step and pass text through unchanged. Record the skipped step and error in `meta.errors`. Ensure `meta.stepsApplied` does not include skipped steps. | Status: not_done

- [ ] **Implement defensive regex (ReDoS prevention)** — Audit all regex patterns for catastrophic backtracking risk. Avoid nested quantifiers on overlapping character classes. Test all patterns against pathological inputs (e.g., very long strings of repeating characters that match alternation prefixes). | Status: not_done

- [ ] **Write error handling tests** — Test: TypeError on null/undefined, undefined return from extractJSON on no JSON, undefined return from extractCode on no fence, auto mode fallback to text, empty string handling, step timeout behavior, meta.errors population on step failure. | Status: not_done

---

## Phase 9: Performance

- [ ] **Implement lazy regex compilation** — Ensure all regex patterns used by pipeline steps are compiled once at module load time (or on first use via lazy initialization) and reused across calls. No regex compilation per `normalize()` call. | Status: not_done

- [ ] **Implement early termination predicates** — Verify each pipeline step's predicate is a fast check (indexOf or simple regex test) that short-circuits when the step is inapplicable. Verify that the thinking block step checks for `<thinking` before doing work, preamble step checks for known pattern prefixes, etc. | Status: not_done

- [ ] **Implement `durationMs` timing in metadata** — Use `performance.now()` or `Date.now()` to measure total pipeline execution time. Record in `meta.durationMs`. | Status: not_done

- [ ] **Write performance benchmark tests** — Create benchmarks testing normalization speed on inputs of varying sizes: 200 bytes (target <0.05ms), 2KB (target <0.1ms), 10KB (target <0.5ms), 100KB (target <5ms), 1MB (target <50ms). These should be non-blocking tests that verify performance stays within acceptable bounds. | Status: not_done

---

## Phase 10: Extraction Mode Logic

- [ ] **Implement `auto` mode detection logic** — After running normalization steps 1-6, examine remaining text: if starts with `{`/`[` and parses as JSON, classify as `json`; if a markdown fence was extracted and content is not JSON, classify as `code`; if fence content is JSON, classify as `json`; otherwise classify as `text`. Assign confidence scores per spec. | Status: not_done

- [ ] **Implement `markdown` mode** — Run normalization steps 1-5. Run fence extraction only if the entire remaining text (after preamble/postamble strip) is a single code fence with `markdown`/`md` language tag or no tag. Preserve internal code fences. Return clean markdown string. | Status: not_done

- [ ] **Implement `all` mode extraction** — After full normalization, extract every JSON object (using `strategy: 'all'`) and every code block. Return `{ json: [...], code: [...], text: remainingText }`. | Status: not_done

- [ ] **Implement `text` mode pipeline behavior** — Run all normalization steps except `json-extract` and `json-repair`. Markdown fences are extracted (content replaces fenced block). Return cleaned string. | Status: not_done

- [ ] **Write tests for all extraction modes** — Test auto detection with various inputs, markdown mode with outer fence stripping and inner fence preservation, all mode with multiple JSON and code blocks, text mode skipping JSON extraction. | Status: not_done

---

## Phase 11: Documentation & Package Configuration

- [ ] **Create README.md** — Write comprehensive README with: package description, installation, quick start examples (normalize, extractJSON, extractCode, detect), all API functions with signatures and examples, configuration options table, presets documentation, CLI usage with all flags, streaming usage example, error handling guide, and integration examples (OpenAI SDK, Anthropic SDK, Vercel AI SDK). | Status: not_done

- [ ] **Bump version in package.json to 0.1.0** — Verify the version field matches the initial release version from the roadmap. | Status: not_done

- [ ] **Add keywords to package.json** — Add relevant keywords: `llm`, `json`, `extract`, `normalize`, `markdown`, `code-fence`, `json-repair`, `ai`, `openai`, `anthropic`, `claude`, `gpt`, `output-parser`. | Status: not_done

- [ ] **Verify `files` field in package.json** — Ensure the `files` field includes `dist` and the `bin` field points to `dist/cli.js`. Verify that `prepublishOnly` runs `npm run build`. | Status: not_done

- [ ] **Add ESLint configuration** — Set up ESLint with TypeScript support. Ensure `npm run lint` passes on all source files. | Status: not_done

---

## Phase 12: Integration & End-to-End Testing

- [ ] **Write combined/integration tests using combined fixtures** — Test full pipeline with real-world-like LLM outputs that combine multiple issues: thinking blocks + preambles + fences + malformed JSON + postambles. Verify the pipeline produces correct results end to end. | Status: not_done

- [ ] **Write edge case integration tests** — Test: empty string through full pipeline, pure JSON through full pipeline, pure text through full pipeline, very large input (100KB+), deeply nested JSON (50+ levels), response with only whitespace, response that is a single preamble line with no content. | Status: not_done

- [ ] **Verify all spec example use cases** — Implement tests for each Before/After example in spec section 19: JSON in markdown fence with preamble/postamble, malformed JSON from local model, code with thinking block, truncated JSON recovery, XML artifact wrapper, multiple JSON objects, clean text with conversational wrappers, full-width Chinese punctuation. | Status: not_done

- [ ] **Run full test suite and verify all pass** — Execute `npm run test`, `npm run lint`, and `npm run build`. All must pass. Fix any failures. | Status: not_done
