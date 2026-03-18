# llm-output-normalizer -- Specification

## 1. Overview

`llm-output-normalizer` is a deterministic text processing library that cleans, extracts, and repairs structured data from raw LLM output. It accepts the raw string response from any language model -- whether it contains conversational preambles, markdown code fences, thinking blocks, XML wrapper tags, malformed JSON, or any combination thereof -- and applies a configurable pipeline of normalization steps to produce clean, usable output in a single function call. The result is either a parsed JSON object, an extracted code block with its language tag, a cleaned text string, or all of the above, depending on the extraction mode.

The gap this package fills is specific and well-defined. Every developer who integrates an LLM into an application writes the same boilerplate post-processing code. An API call to GPT-4o requesting JSON comes back as `"Sure! Here's the JSON you requested:\n\n```json\n{\"name\": \"Alice\"}\n```\n\nLet me know if you need anything else!"` -- and the developer needs just the parsed object `{"name": "Alice"}`. An API call to Claude requesting code comes back with a conversational introduction, a thinking block, the code inside markdown fences, and a closing remark -- and the developer needs just the code string. An API call to a local model returns JSON with trailing commas, single-quoted strings, and an unquoted key -- and the developer needs valid, parseable JSON. Every team writes regex to strip fences, indexOf logic to find JSON boundaries, try-catch wrappers around JSON.parse, and ad-hoc string replacements to remove "Sure!" prefixes. This boilerplate is repeated across thousands of codebases, is consistently buggy in edge cases, and is never comprehensive enough to handle the full range of LLM output quirks.

Existing tools address fragments of this problem but not the whole. `jaison` is a fault-tolerant JSON parser that repairs malformed JSON (trailing commas, single quotes, unquoted keys, Chinese full-width punctuation) with 100% success on its 250,000-case test suite -- but it only parses JSON strings you hand it; it does not extract JSON from surrounding prose, strip markdown fences, or remove conversational preambles. `jsonrepair` provides streaming JSON repair with support for missing brackets, trailing commas, and single quotes -- but it similarly operates on isolated JSON strings, not on raw LLM responses wrapped in prose. `dirty-json` is a permissive parser using a hand-written LR(1) parser and regex-based lexer, but it is unmaintained (last published 5 years ago), potentially vulnerable to ReDoS attacks, and handles only JSON parsing, not extraction. `best-effort-json-parser` recovers partial JSON from truncated responses and handles comments -- but again, only JSON, and only after you have already extracted the JSON substring. `json5` parses a superset of JSON that allows comments, trailing commas, and unquoted keys -- useful for parsing human-authored config, but not designed for the specific malformations LLMs produce (prose wrappers, markdown fences, thinking blocks). On the Python side, `llm-output-parser` extracts JSON and XML from unstructured LLM text, but there is no equivalent comprehensive npm package. LangChain's output parsers (`StructuredOutputParser`, `PydanticOutputParser`) require Zod schemas and are tightly coupled to the LangChain framework. The Vercel AI SDK's structured output uses Zod for schema enforcement but focuses on the generation constraint side, not post-hoc cleanup of unconstrained responses.

`llm-output-normalizer` provides a single, framework-independent package that handles the entire pipeline: Unicode normalization, thinking block removal, XML artifact unwrapping, preamble stripping, postamble stripping, markdown fence extraction, JSON extraction from prose, JSON repair, and whitespace cleanup. It works with output from any LLM provider (OpenAI, Anthropic, Google, Mistral, local models) because it operates on the final text string, not on provider-specific response structures. It requires no API keys, no schema definitions, and no external LLM calls. It runs in microseconds, making it suitable for high-throughput production pipelines. It provides both a TypeScript/JavaScript API for programmatic use and a CLI for piping LLM output through normalization in shell scripts.

The design philosophy is progressive extraction with graceful fallback. The pipeline applies normalization steps in a fixed order, each step building on the output of the previous one. If JSON extraction is requested but no JSON is found, the function returns the cleaned text rather than throwing. If JSON is found but cannot be repaired, the raw extracted string is returned alongside the parse error. Every step is individually toggleable, so developers who only need fence stripping can skip the JSON repair step, and developers who only need JSON extraction can skip preamble stripping. The default configuration applies all steps, providing the most comprehensive cleanup in a single call.

---

## 2. Goals and Non-Goals

### Goals

- Provide a single function (`normalize`) that accepts a raw LLM output string and returns a cleaned string with all conversational wrappers, markdown fences, thinking blocks, and whitespace noise removed.
- Provide an extraction function (`extractJSON`) that finds, extracts, and parses JSON from raw LLM output -- including JSON embedded in prose, wrapped in markdown fences, decorated with preambles and postambles, or containing common malformations (trailing commas, single quotes, unquoted keys, comments, truncation).
- Provide a code extraction function (`extractCode`) that extracts code blocks from markdown fences and returns the code string with its detected language tag.
- Provide a detection function (`detect`) that analyzes raw LLM output and reports what type of content it contains (JSON, code, plain text, markdown) with a confidence score.
- Apply only deterministic, rule-based transformations. No LLM calls, no model inference, no network access. The same input always produces the same output.
- Handle the full spectrum of LLM output quirks across all major providers: OpenAI's structured output leaking through markdown fences, Anthropic's thinking blocks and XML artifacts, Google Gemini's response wrapping, and local models' inconsistent formatting.
- Repair common JSON malformations without requiring a schema: trailing commas, single-quoted strings, unquoted keys, JavaScript-style comments, `NaN`/`Infinity` literals, and truncated output from max_tokens cutoff.
- Support streaming normalization through a buffer-based API that accumulates chunks and applies normalization when sufficient content is available.
- Provide a CLI (`llm-output-normalizer`) that reads from stdin and writes cleaned output to stdout, enabling shell pipeline integration.
- Keep dependencies minimal: zero runtime dependencies. All functionality is implemented using Node.js built-in modules and hand-written parsers.
- Work with any LLM provider's output. The package operates on plain strings, not provider-specific response objects.

### Non-Goals

- **Not a JSON schema validator.** This package extracts and parses JSON from LLM output. It does not validate that the parsed JSON conforms to a specific schema. Use `zod`, `ajv`, `io-ts`, or similar libraries for schema validation after extraction. `llm-output-normalizer` gets you from raw LLM text to a parsed JavaScript object; schema validation is the next step.
- **Not a structured output enforcer.** This package does not constrain LLM generation at the token level. OpenAI's structured output mode, Anthropic's tool_use, and constrained decoding libraries prevent malformed output at generation time. `llm-output-normalizer` cleans up output after generation -- it is the fallback for when structured output is unavailable, impractical, or insufficient.
- **Not a prompt engineering tool.** This package does not modify prompts to improve output formatting. It operates entirely on the output side. Use `prompt-optimize` or `prompt-lint` for prompt-side improvements.
- **Not a general-purpose JSON repair library.** While this package includes JSON repair capabilities, they are tuned for LLM-specific malformations. For general-purpose JSON repair (arbitrary user input, legacy system output, data migration), use `jsonrepair` or `jaison` directly.
- **Not a markdown parser.** This package extracts content from markdown code fences and strips basic markdown formatting. It does not parse full markdown into an AST. Use `remark`, `marked`, or `markdown-it` for comprehensive markdown processing.
- **Not a provider SDK.** This package does not make API calls to LLM providers, does not parse provider-specific response envelopes (the `choices[0].message.content` from OpenAI or the `content[0].text` from Anthropic), and does not handle streaming at the HTTP/SSE layer. It operates on the extracted text content that you get from any provider SDK.

---

## 3. Target Users and Use Cases

### AI Application Developers

Developers building applications that call LLM APIs and need to extract structured data from responses. They request JSON from GPT-4o, Claude, or Gemini, receive it wrapped in conversational prose and markdown fences, and need a reliable way to get the parsed object. This is the primary audience. A typical integration is: `const data = extractJSON<MyType>(response.choices[0].message.content)`.

### Pipeline and Workflow Builders

Teams building multi-step LLM pipelines where the output of one model call feeds into the next. Each intermediate step may produce output wrapped in fences or decorated with explanatory text. `llm-output-normalizer` sits between pipeline stages as a normalization layer, ensuring each stage receives clean input regardless of the previous model's output quirks.

### Tool-Calling Post-Processors

Developers building MCP servers, function-calling integrations, or agent frameworks where LLM-generated tool arguments arrive as raw text that may contain markdown formatting, thinking artifacts, or malformed JSON. The tool execution layer needs clean, parsed arguments. `llm-output-normalizer` bridges the gap between the raw LLM output and the tool's expected input format.

### Local Model Integrators

Developers using open-source models (Llama, Mistral, Phi, Qwen) via Ollama, vLLM, llama.cpp, or similar inference servers. Local models are more prone to formatting inconsistencies than commercial APIs -- they may omit closing brackets, mix JSON with explanatory text, use single quotes, or include JavaScript comments. `llm-output-normalizer` handles these quirks without requiring model-specific prompt engineering.

### CLI and Shell Script Authors

Engineers who pipe LLM output through shell pipelines. `echo "prompt" | llm-api-call | llm-output-normalizer --json | jq '.name'` -- the CLI bridges LLM output and standard Unix text processing tools.

### Testing and Evaluation Frameworks

Teams that collect LLM responses for evaluation and need to normalize the output before comparison. Two responses that differ only in preamble text ("Sure! Here's the answer: 42" vs. "The answer is 42") should be treated as equivalent. `llm-output-normalizer` strips the noise so comparison logic operates on the actual content.

---

## 4. Core Concepts

### Normalization Pipeline

The normalization pipeline is the central concept in `llm-output-normalizer`. It is an ordered sequence of transformation steps applied to raw LLM output. Each step addresses a specific category of noise or formatting artifact. Steps run sequentially in a fixed order: each step receives the output of the previous step and produces input for the next. The order is significant -- thinking blocks must be removed before preamble detection (otherwise the thinking block text confuses the preamble heuristics), and markdown fences must be extracted before JSON extraction (otherwise the fence markers interfere with bracket matching).

Every step has a unique ID, a description of what it does, a predicate that determines whether it applies to the current input, and a toggle that allows disabling it. The pipeline is configured once (via options or a factory function) and then applied to every LLM output that passes through it.

### Extraction Modes

An extraction mode specifies what type of content to extract from the normalized output. The mode determines which pipeline steps are relevant and what return type the extraction function produces.

- **`json`**: The pipeline targets JSON extraction. After normalization, the pipeline finds JSON in the remaining text, repairs it if necessary, and returns a parsed JavaScript object.
- **`code`**: The pipeline targets code block extraction. After normalization, the pipeline extracts the content of the first (or specified) code fence and returns it as a string with its language tag.
- **`text`**: The pipeline targets clean text. All normalization steps run (preamble/postamble stripping, thinking block removal, etc.) but no structural extraction is performed. The result is a clean string.
- **`auto`**: The pipeline detects the output type (JSON, code, or text) and applies the appropriate extraction automatically. This is the default mode.
- **`all`**: The pipeline extracts all identifiable structured elements -- every JSON object and every code block -- and returns them as arrays alongside the cleaned text.

### Normalization Step

A normalization step is a single, named transformation in the pipeline. Each step has:

- **Step ID**: a unique kebab-case identifier (e.g., `unicode-normalize`, `thinking-block-removal`).
- **Order**: a fixed integer determining when this step runs relative to others.
- **Predicate**: a fast check that determines whether the step is applicable to the current text (e.g., the thinking block removal step checks for `<thinking` before doing any work).
- **Transform function**: the logic that modifies the text.
- **Enabled flag**: a boolean toggle, configurable per step.

### JSON Repair Strategy

JSON repair is the process of transforming malformed JSON text into valid JSON that can be parsed by `JSON.parse`. LLMs produce a specific and well-documented set of JSON malformations that differ from general-purpose "invalid JSON" scenarios. The repair strategy addresses these LLM-specific patterns: trailing commas (the model generates a list and adds a comma after the last item), single-quoted strings (the model confuses JavaScript and JSON syntax), unquoted keys (same confusion), JavaScript-style comments (the model adds explanatory comments inside JSON), `NaN`/`Infinity`/`undefined` literals (the model uses JavaScript values), and truncated output (the model hits max_tokens and produces incomplete JSON). Each repair is applied conservatively -- the repair engine modifies only what is necessary to make the JSON valid, preserving the intended structure and values.

### Confidence Score

Several functions in `llm-output-normalizer` return a confidence score (0.0 to 1.0) indicating how certain the extraction is. A confidence of 1.0 means the output was unambiguously the detected type (e.g., the entire output was a valid JSON object with no surrounding text). A confidence of 0.5 means the output was ambiguous (e.g., JSON was found embedded in prose, but the extraction required heuristics). A confidence below 0.3 means the detection is uncertain and the caller should verify the result. Confidence scores enable callers to implement fallback logic: "if JSON extraction confidence is below 0.5, ask the model to retry."

---

## 5. Normalization Pipeline

The pipeline applies nine steps in the following fixed order. Each step is described with its ID, purpose, conditions for activation, behavior, and examples.

### 5.1 `unicode-normalize`

**Order**: 1

**What it does**: Removes Unicode artifacts that interfere with subsequent text processing. Specifically: strips the UTF-8 Byte Order Mark (BOM, U+FEFF) from the beginning of the text; replaces unusual Unicode whitespace characters (non-breaking space U+00A0, em space U+2003, en space U+2002, thin space U+2009, zero-width space U+200B, zero-width non-joiner U+200C, zero-width joiner U+200D, ideographic space U+3000) with standard ASCII space (U+0020); removes Unicode control characters (U+0000 through U+001F except tab U+0009, newline U+000A, and carriage return U+000D); normalizes Unicode to NFC form to ensure consistent character representation.

**When it applies**: Always runs as the first step. The predicate always returns true because the step is a fast no-op on clean input (a single regex test on the full string).

**Why it matters**: LLM API responses occasionally contain BOM characters (especially when the provider's backend processes UTF-8-with-BOM files), non-breaking spaces (common when responses are rendered through web interfaces before being returned), and zero-width characters (artifacts of Unicode normalization mismatches between the model's tokenizer and the API's serialization layer). These invisible characters break exact-match comparisons, confuse JSON.parse (a BOM before `{` is a syntax error), and cause subtle bugs in downstream text processing.

**Example**:
```
Input:  "\uFEFF  Sure, here is the JSON:\n\n{\"name\": \"Alice\"}"
         ^BOM  ^nbsp
Output: " Sure, here is the JSON:\n\n{\"name\": \"Alice\"}"
```

**Default**: Enabled. Cannot be disabled -- this step is always-on because subsequent steps assume clean Unicode input.

---

### 5.2 `thinking-block-removal`

**Order**: 2

**What it does**: Removes LLM thinking/reasoning blocks that appear in the output when extended thinking or chain-of-thought reasoning is enabled. Detected patterns:

| Pattern | Source |
|---|---|
| `<thinking>...</thinking>` | Common chain-of-thought format, Anthropic few-shot examples |
| `<antThinking>...</antThinking>` | Anthropic internal reasoning blocks (ANTML markup) |
| `<reflection>...</reflection>` | Reflection-based reasoning patterns |
| `<scratchpad>...</scratchpad>` | Scratchpad reasoning from fine-tuned models |
| `<reasoning>...</reasoning>` | Generic reasoning wrapper used by some model providers |
| `<inner_monologue>...</inner_monologue>` | Inner monologue format used by some agent frameworks |
| `<thought>...</thought>` | Alternative thinking tag |

The removal is performed by matching opening and closing tags (case-insensitive) and removing everything between them, including the tags themselves. Nested thinking blocks are handled correctly by matching the outermost pair. Multiple thinking blocks in a single response are all removed.

**When it applies**: The predicate checks for the presence of any opening thinking tag pattern using a single regex scan. If no thinking tags are found, the step is skipped (zero cost).

**Why it matters**: When Anthropic's extended thinking is enabled, Claude's API returns thinking content blocks alongside text content blocks. In the structured API response, these are separate content blocks and can be filtered programmatically. But when responses are serialized to strings (logging, caching, database storage, chat history), thinking blocks end up inline in the text. Many agent frameworks and chat applications serialize the full response and pass it downstream. The consuming code needs the answer, not the reasoning process. Local models fine-tuned with chain-of-thought data often embed `<thinking>` blocks directly in their text output with no separate content block mechanism.

**Example**:
```
Input:
<thinking>
The user wants me to return a JSON object with the user's name.
I should format it correctly.
</thinking>

Here is the result:

{"name": "Alice"}

Output:

Here is the result:

{"name": "Alice"}
```

**Default**: Enabled.

---

### 5.3 `xml-artifact-unwrap`

**Order**: 3

**What it does**: Detects and unwraps content enclosed in XML wrapper tags that LLMs use to delimit their "actual" output from surrounding commentary. Detected wrapper tags:

| Tag | Usage |
|---|---|
| `<artifact>...</artifact>` | Claude's artifact system for standalone content |
| `<result>...</result>` | Common "here is the result" wrapper |
| `<answer>...</answer>` | Common "here is the answer" wrapper |
| `<output>...</output>` | Common "here is the output" wrapper |
| `<response>...</response>` | Wrapper used by some fine-tuned models |
| `<code>...</code>` | HTML-style code wrapper (distinct from markdown fences) |
| `<json>...</json>` | Explicit JSON content wrapper |
| `<data>...</data>` | Data content wrapper |

The unwrapping extracts the content inside the tags and discards the tags and any text outside them. If multiple wrapper tags are present, the innermost wrapper's content is extracted. If no recognized wrapper tags are found, the text passes through unchanged.

**When it applies**: The predicate checks for the presence of any recognized opening wrapper tag. This is a fast regex check that short-circuits if no wrapper tags are present.

**Why this is separate from thinking block removal**: Thinking blocks contain reasoning to discard. Artifact/wrapper tags contain the actual content to keep. The semantic difference requires separate handling: thinking blocks are stripped entirely, while artifact tags are unwrapped to expose their inner content.

**Example**:
```
Input:
I've created the JSON object you requested.

<artifact type="application/json" title="User Data">
{"name": "Alice", "age": 30}
</artifact>

Let me know if you'd like me to modify anything.

Output:
{"name": "Alice", "age": 30}
```

**Default**: Enabled.

---

### 5.4 `preamble-strip`

**Order**: 4

**What it does**: Removes conversational preamble text that LLMs prepend to their actual output. Preambles are the polite, explanatory introductions that models generate before the content the developer actually requested. The step identifies and removes text that matches known preamble patterns from the beginning of the output, up to the first line of structural content (JSON, code fence, list, or substantive text).

**Complete preamble pattern catalog**:

| Pattern Category | Examples |
|---|---|
| Affirmative + delivery | "Sure! Here's the JSON you requested:", "Sure, here is the code:", "Sure thing! Here's what I came up with:" |
| Certainty + delivery | "Certainly! Here is the result:", "Certainly, here's the JSON:", "Of course! Here is the output:" |
| Acknowledgment + delivery | "Here's the JSON:", "Here is the code you asked for:", "Here's what I came up with:", "Here you go:" |
| Explanation + delivery | "Based on your request, here is the JSON:", "Based on the information provided, here's the output:", "Given the requirements, here is the result:" |
| Compliance | "I've generated the following JSON:", "I've created the code below:", "I've prepared the following output:" |
| Role affirmation | "As requested, here is the JSON:", "As you specified, here's the result:" |
| Transition phrases | "Great question! Let me provide the answer:", "Let me help with that:", "I'd be happy to help!" |
| Bare introductions | "The result is:", "The output is:", "The JSON is:", "The code is:" |

**Detection heuristics**: The preamble detector operates line by line from the start of the text. A line is classified as preamble if it:

1. Matches one of the known preamble patterns (case-insensitive regex match).
2. Is a short line (under 200 characters) that ends with a colon and is followed by a blank line and then structural content.
3. Is an empty line between a preamble line and structural content.

The detector stops when it encounters:
- A line starting with `{`, `[`, `<`, or `` ``` `` (structural content).
- A line that is longer than 200 characters and does not match any preamble pattern.
- A line that appears to be part of the actual content (contains multiple sentences, technical terminology, or structured formatting).

**What it preserves**: The first line of actual content is never removed. If the model's response starts directly with content (no preamble), the step is a no-op. If the entire response is a single line that happens to match a preamble pattern ("Sure, here is the result"), it is not removed because there is no subsequent content -- the line itself is the response.

**Configurable**: Users can add custom preamble patterns via the `customPreamblePatterns` option (array of RegExp). Users can set a `preambleSensitivity` option (`strict`, `normal`, `aggressive`) that controls how liberally text is classified as preamble:
- `strict`: Only exact matches from the built-in pattern catalog.
- `normal` (default): Built-in patterns plus short introductory lines ending with colons.
- `aggressive`: Strips all text before the first structural element (JSON, code fence, list).

**Example**:
```
Input:
Sure! Here's the JSON you requested:

{"name": "Alice", "age": 30}

Output:
{"name": "Alice", "age": 30}
```

**Default**: Enabled.

---

### 5.5 `postamble-strip`

**Order**: 5

**What it does**: Removes conversational postamble text that LLMs append after their actual output. Postambles are the polite closing remarks, offers of further assistance, and disclaimers that models add at the end of their responses.

**Complete postamble pattern catalog**:

| Pattern Category | Examples |
|---|---|
| Offers of assistance | "Let me know if you need anything else!", "Feel free to ask if you have any questions.", "Don't hesitate to reach out if you need more help." |
| Hopes | "I hope this helps!", "I hope that's what you were looking for!", "Hope this is useful!" |
| Availability | "I'm here if you need further assistance.", "Happy to help with anything else!" |
| Explanatory coda | "This JSON follows the schema you specified.", "The code above implements the function you described.", "Note that this is just one possible implementation." |
| Disclaimers | "Please review the code before using in production.", "Make sure to test this thoroughly.", "This is a simplified example and may need adjustments." |
| Sign-offs | "Best regards,", "Good luck!", "Cheers!" |

**Detection heuristics**: The postamble detector operates line by line from the end of the text, working backwards. A line is classified as postamble if it:

1. Matches one of the known postamble patterns (case-insensitive regex match).
2. Is a short line (under 200 characters) following a blank line that follows structural content, and contains conversational language indicators ("let me know", "hope", "feel free", "happy to", "don't hesitate").
3. Is an empty line between structural content and a postamble line.

The detector stops when it encounters:
- A line ending with `}`, `]`, `` ``` ``, or `>` (structural content).
- A line that appears to be part of the actual content.

**Example**:
```
Input:
{"name": "Alice", "age": 30}

Let me know if you need anything else! I hope this helps.

Output:
{"name": "Alice", "age": 30}
```

**Default**: Enabled.

---

### 5.6 `markdown-fence-extract`

**Order**: 6

**What it does**: Detects markdown code fences and extracts their content. Supports the following fence formats:

| Format | Example |
|---|---|
| Triple backtick with language | `` ```json\n{...}\n``` `` |
| Triple backtick without language | `` ```\n{...}\n``` `` |
| Triple tilde with language | `~~~python\ndef foo():\n~~~` |
| Triple tilde without language | `~~~\ndef foo():\n~~~` |

The step extracts the content between the opening and closing fence markers. The language tag (if present) is captured and returned as metadata. If multiple code fences are present, the behavior depends on the extraction mode:

- In `json` mode: the fence tagged `json` is preferred; if no `json` fence exists, the first fence whose content starts with `{` or `[` is used; if neither, the first fence is used.
- In `code` mode: the first fence is extracted by default, or a specific fence can be selected by language tag or index.
- In `all` mode: all fences are extracted and returned as an array.
- In `text` or `auto` mode: if the entire response is a single code fence (with optional preamble/postamble already stripped), the fence content replaces the fenced text.

**Nested fence handling**: If a code fence contains another code fence (common when the LLM generates markdown documentation that includes code examples), the outer fence is matched by counting fence delimiters. The inner fence is treated as literal text within the outer fence content. Backtick fences can nest inside tilde fences and vice versa without ambiguity.

**Edge cases**:
- Unclosed fences: if an opening fence marker is found but no closing marker, the content from the opening marker to the end of the text is extracted (the model likely hit max_tokens mid-response).
- Fence with only whitespace content: treated as an empty code block, not extracted in `json` mode.
- Multiple backtick fences: fences delimited by four or more backticks (`````) are handled by matching the same number of backticks for the closing delimiter.

**Example**:
```
Input:
Here's the code:

```python
def greet(name):
    return f"Hello, {name}!"
```

Output (code mode):
{ code: 'def greet(name):\n    return f"Hello, {name}!"', language: 'python' }
```

**Default**: Enabled.

---

### 5.7 `json-extract`

**Order**: 7

**What it does**: Finds and extracts JSON from text that may contain non-JSON content surrounding it. This step handles the common case where the LLM returns JSON embedded in explanatory prose, even after preamble/postamble stripping and fence extraction have done their work.

**Extraction algorithm** (bracket matching with state machine):

1. Scan the text for the first unquoted `{` or `[` character. These are candidate JSON start positions.
2. From each candidate start position, run a state machine that tracks:
   - **Nesting depth**: incremented by `{` and `[`, decremented by `}` and `]`.
   - **String state**: whether the scanner is inside a JSON string (between unescaped `"` characters). Characters inside strings do not affect nesting depth.
   - **Escape state**: whether the previous character was a backslash (the next character is escaped).
3. When nesting depth returns to zero, the scanner has found a complete JSON value. The substring from the start position to the current position (inclusive) is the JSON candidate.
4. Attempt to parse the candidate with `JSON.parse`. If it succeeds, return the parsed value.
5. If `JSON.parse` fails, pass the candidate to the JSON repair step (5.8) before retrying.
6. If multiple JSON candidates exist, the behavior depends on configuration:
   - `strategy: 'first'` (default): return the first successfully parsed JSON.
   - `strategy: 'largest'`: return the JSON candidate with the most characters.
   - `strategy: 'all'`: return all successfully parsed JSON values as an array.

**Why a state machine instead of regex**: Regular expressions cannot reliably match nested brackets. A regex like `/\{.*\}/s` greedily matches from the first `{` to the last `}`, which fails when the text contains multiple JSON objects or when curly braces appear in prose. A regex like `/\{[^}]*\}/` fails on nested objects. The state machine correctly handles arbitrary nesting depth, strings containing bracket characters, and escaped characters within strings.

**Handling multiple JSON objects**: When the LLM output contains multiple JSON objects (e.g., "Here are two examples: {...} and {...}"), the extraction finds all top-level JSON values. The `strategy` option determines which one is returned from `extractJSON`. The `extractAll` function always returns all of them.

**Example**:
```
Input:
The user data is as follows:

{"name": "Alice", "hobbies": ["reading", "coding"]}

And here is the metadata:

{"created": "2024-01-15", "version": 2}

Output (strategy: 'first'):
{"name": "Alice", "hobbies": ["reading", "coding"]}

Output (strategy: 'all'):
[{"name": "Alice", "hobbies": ["reading", "coding"]}, {"created": "2024-01-15", "version": 2}]
```

**Default**: Enabled (only active in `json`, `auto`, and `all` extraction modes).

---

### 5.8 `json-repair`

**Order**: 8

**What it does**: Repairs common JSON malformations produced by LLMs so that the result can be parsed by `JSON.parse`. This step runs only when `JSON.parse` fails on an extracted JSON candidate. It applies repairs in a specific order designed to handle LLM-specific patterns.

**Repair operations** (applied in order):

| Repair | What it fixes | Example |
|---|---|---|
| Strip comments | `//` line comments and `/* */` block comments inside JSON | `{"name": "Alice" // the user}` becomes `{"name": "Alice"}` |
| Single quotes to double quotes | Single-quoted strings | `{'name': 'Alice'}` becomes `{"name": "Alice"}` |
| Quote unquoted keys | Bare identifier keys | `{name: "Alice"}` becomes `{"name": "Alice"}` |
| Remove trailing commas | Commas before `}` or `]` | `{"a": 1, "b": 2,}` becomes `{"a": 1, "b": 2}` |
| Fix double commas | Consecutive commas from deleted items | `[1,,2,3]` becomes `[1,2,3]` |
| Replace JS literals | `undefined`, `NaN`, `Infinity`, `-Infinity` | `{"val": undefined}` becomes `{"val": null}` |
| Fix unescaped newlines | Literal newlines inside string values | `{"text": "line1\nline2"}` (literal newline) gets the newline escaped |
| Fix unescaped control chars | Tab, backspace, etc. inside string values | Control characters are escaped to `\t`, `\b`, etc. |
| Normalize full-width punctuation | Chinese/Japanese full-width colons, commas, brackets | `{"name"："Alice"，"age"：30}` becomes `{"name": "Alice", "age": 30}` |
| Close truncated strings | String missing closing quote at end of input | `{"name": "Ali` becomes `{"name": "Ali"}` |
| Close truncated containers | Missing closing `}` or `]` at end of input | `{"name": "Alice"` becomes `{"name": "Alice"}` |
| Remove markdown emphasis | Bold/italic markers that leaked into JSON values | `{"name": "**Alice**"}` becomes `{"name": "Alice"}` |

**Truncated JSON recovery**: When an LLM hits its `max_tokens` limit, the output may be cut off mid-JSON. The repair engine detects truncation by checking whether the input ends without reaching nesting depth zero. It then applies minimal completions:
- If inside a string, adds the closing quote.
- If inside an array, adds the closing `]` (with appropriate nesting).
- If inside an object with a value in progress, completes the value (null for unknown) and adds the closing `}`.
- Multiple levels of nesting are closed in order.

The goal is to recover as much of the valid data as possible. The truncation point is recorded in the result metadata so the caller knows the data may be incomplete.

**Repair aggressiveness levels**:
- `conservative` (default): Only repairs that are unambiguously correct. Trailing commas, comment removal, and truncation completion.
- `moderate`: Adds single-quote-to-double-quote conversion, unquoted key quoting, and JS literal replacement.
- `aggressive`: Adds full-width punctuation normalization, markdown emphasis removal, and speculative repairs for heavily malformed output.

**Example**:
```
Input:
{
  name: 'Alice',
  age: 30,
  // This is a comment
  hobbies: ['reading', 'coding',],
  score: NaN,
}

Output (after repair):
{
  "name": "Alice",
  "age": 30,
  "hobbies": ["reading", "coding"],
  "score": null
}
```

**Default**: Enabled (only active when JSON.parse fails on an extracted candidate).

---

### 5.9 `whitespace-cleanup`

**Order**: 9

**What it does**: Applies final whitespace normalization to the output: trims leading and trailing whitespace from the entire string, collapses three or more consecutive newlines into two (preserving paragraph breaks but removing excessive blank lines), normalizes line endings to `\n` (replacing `\r\n` and `\r`), and removes trailing whitespace from individual lines.

**When it applies**: Always runs as the last step on string output. Skipped when the output is a parsed JSON object (JSON extraction returns parsed objects, not strings).

**Why it runs last**: Earlier pipeline steps may leave behind blank lines or trailing whitespace. For example, removing a thinking block may leave two blank lines where the block was. Removing a preamble may leave a blank line at the start. This step ensures the final output is clean regardless of which previous steps ran.

**Example**:
```
Input:
"\n\n\n{"name": "Alice"}\n\n\n\n"

Output:
"{"name": "Alice"}"
```

**Default**: Enabled.

---

### 5.10 Pipeline Summary Table

| Order | Step ID | What It Does | Default |
|---|---|---|---|
| 1 | `unicode-normalize` | Strip BOM, normalize whitespace chars, remove control chars | Always on |
| 2 | `thinking-block-removal` | Remove `<thinking>`, `<antThinking>`, `<scratchpad>`, etc. | Enabled |
| 3 | `xml-artifact-unwrap` | Unwrap `<artifact>`, `<result>`, `<answer>`, `<output>`, etc. | Enabled |
| 4 | `preamble-strip` | Remove "Sure! Here's..." and similar conversational prefixes | Enabled |
| 5 | `postamble-strip` | Remove "Let me know if..." and similar conversational suffixes | Enabled |
| 6 | `markdown-fence-extract` | Extract content from `` ```lang...``` `` code fences | Enabled |
| 7 | `json-extract` | Find JSON in prose using bracket-matching state machine | Enabled |
| 8 | `json-repair` | Fix trailing commas, single quotes, unquoted keys, truncation | Enabled |
| 9 | `whitespace-cleanup` | Trim, normalize line endings, collapse excessive blank lines | Enabled |

---

## 6. Extraction Modes

### `json` Mode

**Target**: Extract and parse a JSON value from the LLM output.

**Return type**: The parsed JavaScript value (object, array, string, number, boolean, or null).

**Pipeline behavior**: All normalization steps run. After normalization, if the remaining text is a valid JSON value, it is parsed and returned. If not, the JSON extraction step (5.7) searches for JSON in the text. If JSON is found but malformed, the JSON repair step (5.8) attempts to fix it.

**Fallback**: If no JSON can be extracted, the function returns `undefined` (for `extractJSON`) or the `result.json` field is `undefined` in the `normalize` result. The raw cleaned text is always available as a fallback.

**Type parameter**: `extractJSON<T>` accepts a generic type parameter for the return type. This provides compile-time type safety when the caller knows the expected JSON shape. No runtime validation is performed -- use `zod` or similar for that.

### `code` Mode

**Target**: Extract a code block from markdown fences.

**Return type**: An object `{ code: string, language?: string }` containing the extracted code and its language tag.

**Pipeline behavior**: All normalization steps run. After normalization, the markdown fence extraction step extracts the code block content and language tag.

**Selection**: When multiple code blocks are present, the first is returned by default. The `codeBlockIndex` option selects a specific block by index. The `codeBlockLanguage` option selects the first block matching a specific language tag.

**Fallback**: If no code fence is found, the cleaned text is returned as the `code` value with `language` set to `undefined`.

### `text` Mode

**Target**: Clean text output -- remove all LLM noise without extracting structural content.

**Return type**: A string.

**Pipeline behavior**: All normalization steps run except `json-extract` and `json-repair`. Markdown fences are extracted (their content replaces the fenced block in the output). The result is the cleaned text.

**Use case**: When the LLM response is prose and the caller needs clean text without conversational wrappers, thinking blocks, or unnecessary formatting.

### `auto` Mode (Default)

**Target**: Detect the output type and apply the appropriate extraction.

**Return type**: A discriminated union based on detected type.

**Detection logic**:
1. Run normalization steps 1-6 (through fence extraction).
2. Examine the remaining text:
   - If it starts with `{` or `[` (after trimming whitespace) and parses as valid JSON: classified as `json`.
   - If a markdown fence was extracted in step 6: classified as `code` (unless the fence content is JSON, in which case classified as `json`).
   - Otherwise: classified as `text`.
3. Apply the appropriate extraction for the detected type.

**Confidence**: The detection includes a confidence score. Pure JSON with no surrounding text gets confidence 1.0. JSON extracted from a markdown fence gets confidence 0.9. JSON extracted from prose gets confidence 0.7. Text with no structural content gets confidence 1.0 (it is definitively text).

### `all` Mode

**Target**: Extract every identifiable structured element from the output.

**Return type**: `{ json: any[], code: CodeBlock[], text: string }`.

**Pipeline behavior**: All normalization steps run. Every JSON object and code block found in the text is extracted and returned as arrays. The `text` field contains the remaining text after all extractions. This mode is useful when the LLM response contains multiple JSON objects or code blocks and the caller needs all of them.

### `markdown` Mode

**Target**: Clean markdown output -- strip code fences that wrap the entire response (where the LLM wrapped its entire markdown answer in a `` ```markdown `` fence) but preserve internal markdown formatting.

**Return type**: A string containing clean markdown.

**Pipeline behavior**: Normalization steps 1-5 run. The fence extraction step runs only if the entire remaining text (after preamble/postamble stripping) is a single code fence with a `markdown` or `md` language tag, or no language tag at all. Internal code fences are preserved.

**Use case**: When the LLM is asked to generate markdown but wraps the entire response in a code fence: `` ```markdown\n# Title\n\nContent with `code` and\n```python\ncode_block\n```\n``` ``. The outer fence is stripped; the inner Python fence is preserved.

---

## 7. Preamble and Postamble Detection

### Preamble Pattern Catalog

The following patterns are detected as preambles. Patterns are case-insensitive and allow flexible punctuation (comma or no comma after the initial word, exclamation mark or period or colon at the end). The regex patterns use word boundaries and optional whitespace to match natural variations.

**Category 1: Affirmative + Here is/Here's**

```
Sure[,!.]* [Hh]ere['']?s? (?:the |your |a )?.*[:.]
```

Matches: "Sure! Here's the JSON:", "Sure, here is your code:", "Sure. Here's a solution:", "Sure here is the result."

**Category 2: Certainty + Here is/Here's**

```
(?:Certainly|Of course|Absolutely|Definitely)[,!.]* [Hh]ere['']?s? .*[:.]
```

Matches: "Certainly! Here is the JSON:", "Of course, here's the code:", "Absolutely! Here's the result:"

**Category 3: Transition + delivery**

```
(?:Great|Good) (?:question|request)[,!.]* (?:[Hh]ere|[Ll]et me).*[:.]
```

Matches: "Great question! Here's the answer:", "Good request, let me provide that:"

**Category 4: Compliance acknowledgment**

```
I(?:'ve| have) (?:generated|created|prepared|built|written|produced|made) (?:the |a |your )?.*(?:below|following|for you).*[:.]
```

Matches: "I've generated the following JSON:", "I have created the code below:", "I've prepared the output for you:"

**Category 5: Bare introductions**

```
(?:The |Here is the |Here's the )(?:result|output|response|JSON|code|answer|solution|data)(?: is)?[:.]
```

Matches: "The result is:", "Here is the JSON:", "Here's the output:"

**Category 6: Let me / I'll / I'd be happy**

```
(?:Let me|I'll|I'd be happy to|I would be happy to|Allow me to) .*[:.]
```

Matches: "Let me provide the JSON:", "I'll generate that for you:", "I'd be happy to help with that:"

**Category 7: Based on / Given / According to**

```
(?:Based on|Given|According to|Per|As per) (?:your |the )?.*(?:here|below|following).*[:.]
```

Matches: "Based on your request, here is the JSON:", "Given the requirements, here's the output:"

### Postamble Pattern Catalog

**Category 1: Offers of assistance**

```
(?:Let me know|Feel free|Don't hesitate) (?:if|to) .*[.!]
```

**Category 2: Hopes and wishes**

```
(?:I hope|Hope) (?:this|that|it) .*[.!]
```

**Category 3: Notes and disclaimers**

```
(?:Note|Please note|Keep in mind|Be aware|Remember) (?:that )?.*[.!]
```

**Category 4: Explanatory coda** (starting after structural content)

```
(?:This|The above|The code|The JSON|The output) (?:above )?(?:is|was|should|will|follows|implements|represents) .*[.!]
```

**Category 5: Availability and sign-offs**

```
(?:I'm here|Happy to|Glad to|Best regards|Good luck|Cheers|Have a great)[,!. ].*
```

### Sensitivity Levels

| Level | Behavior |
|---|---|
| `strict` | Only removes text matching the exact patterns in the catalog. Lowest false-positive rate. May leave some unusual preambles unstripped. |
| `normal` (default) | Catalog patterns plus heuristic detection: short lines (under 200 characters) ending with colons, followed by a blank line and structural content, are treated as preambles. Good balance of coverage and precision. |
| `aggressive` | Removes all text before the first structural element (opening `{`, `[`, `` ``` ``, or a line matching a recognizable content pattern). Highest coverage but may strip content that was not a preamble. |

---

## 8. JSON Extraction and Repair

### Bracket Matching Algorithm

The JSON extraction algorithm is a single-pass state machine that scans the input text from left to right. It maintains three state variables:

- **depth** (integer, starts at 0): the current nesting depth of JSON containers (`{` and `[`).
- **inString** (boolean, starts at false): whether the scanner is currently inside a JSON string value.
- **escaped** (boolean, starts at false): whether the previous character was an escape character (`\`).

The algorithm proceeds as follows:

```
function findJSON(text):
  candidates = []
  for each position i in text:
    char = text[i]

    if escaped:
      escaped = false
      continue

    if char == '\\' and inString:
      escaped = true
      continue

    if char == '"' and not escaped:
      inString = !inString
      continue

    if inString:
      continue

    if char == '{' or char == '[':
      if depth == 0:
        startPos = i
      depth++
    else if char == '}' or char == ']':
      depth--
      if depth == 0:
        candidates.push(text.substring(startPos, i + 1))

  return candidates
```

This algorithm correctly handles:
- Nested objects and arrays to arbitrary depth.
- Bracket characters inside string values (ignored because `inString` is true).
- Escaped quote characters inside strings (ignored because `escaped` is true).
- Multiple top-level JSON values in the same text.

It does not handle:
- JSON values that are bare strings, numbers, booleans, or null (these are not enclosed in brackets). This is acceptable because LLMs almost always return JSON objects or arrays, not bare primitives.
- Single-quoted strings (handled by the repair step after extraction).

### Multiple JSON Handling

When the extraction finds multiple JSON candidates, the `strategy` option determines the return value:

| Strategy | Behavior | Use Case |
|---|---|---|
| `first` (default) | Return the first successfully parsed candidate. | Most common: the LLM returns one JSON object, possibly followed by prose or a second example. |
| `largest` | Return the candidate with the most characters. | When the LLM returns a small metadata object and a large data object, and you want the data. |
| `all` | Return all successfully parsed candidates as an array. | When the LLM returns multiple JSON objects and you need all of them. |
| `schema` | Return the first candidate that matches a provided structural check. | When you know the shape of the JSON you want and the response contains multiple candidates. |

### Repair Pipeline Detail

When `JSON.parse` fails on an extracted candidate, the repair pipeline runs. Each repair operation is attempted in order. After each operation, `JSON.parse` is retried. If it succeeds, the remaining repairs are skipped (minimal intervention principle). If all repairs have been applied and `JSON.parse` still fails, the candidate is considered unrepairable and the next candidate (if any) is tried.

The repair operations, in order:

1. **Comment removal**: Strip `//` line comments and `/* */` block comments. This is first because comments are the most common reason for parse failure in otherwise well-formed JSON.

2. **Trailing comma removal**: Remove commas before `}` and `]`. Second most common LLM error.

3. **Double comma removal**: Replace `,,` with `,`. Occurs when the LLM deletes a value but leaves both surrounding commas.

4. **Single-to-double quote conversion**: Replace single-quoted strings with double-quoted strings, handling escaped single quotes within the strings. Requires a state machine to avoid replacing single quotes inside double-quoted strings.

5. **Unquoted key quoting**: Detect bare identifiers in key position (word characters before a colon) and wrap them in double quotes. Requires care to avoid quoting keys that are already quoted.

6. **JavaScript literal replacement**: Replace `undefined` with `null`, `NaN` with `null`, `Infinity` with `1e308`, `-Infinity` with `-1e308`. These replacements are made only when the literal appears in a value position (after `:` or inside `[`), not inside string values.

7. **Full-width punctuation normalization**: Replace full-width characters with their ASCII equivalents. Covers Chinese/Japanese punctuation: `：` to `:`, `，` to `,`, `｛` to `{`, `｝` to `}`, `［` to `[`, `］` to `]`, `"` and `"` to `"`.

8. **Unescaped string repair**: Fix literal newlines, tabs, and other control characters inside string values by escaping them.

9. **Truncation completion**: If the JSON is truncated (nesting depth is not zero at end of input), add the necessary closing characters. Close any open string, then close containers in reverse nesting order.

### Truncated JSON Recovery

Truncated JSON is a specific and important case. When an LLM hits its `max_tokens` limit, the response is cut off abruptly. The output may end like:

```json
{"users": [{"name": "Alice", "age": 30}, {"name": "Bob", "age
```

The recovery algorithm:

1. Run the bracket-matching state machine to determine the state at the end of input: current depth, whether inside a string, and the stack of open containers.
2. If inside a string, append `"` to close it.
3. If the last non-whitespace character suggests a key-value pair in progress (e.g., the string just closed was a key and was followed by `:`), append `null` as the value.
4. Close each open container in reverse order: `}` for objects, `]` for arrays.
5. Record the truncation point and the number of completed levels in the result metadata.

The recovered JSON is valid and parseable, but the caller should check the `truncated` flag in the result metadata to know that data may be missing.

---

## 9. API Surface

### Installation

```bash
npm install llm-output-normalizer
```

### No Runtime Dependencies

`llm-output-normalizer` has zero runtime dependencies. All functionality -- regex pattern matching, state machine parsing, JSON repair, Unicode normalization -- is implemented using Node.js built-in modules and hand-written code. This keeps the package lightweight, avoids supply chain risk, and ensures broad compatibility across Node.js versions 18+.

### Main Export: `normalize`

The primary API. Accepts raw LLM output and options, runs the normalization pipeline, and returns the cleaned result.

```typescript
import { normalize } from 'llm-output-normalizer';

const result = normalize(
  'Sure! Here\'s the JSON:\n\n```json\n{"name": "Alice"}\n```\n\nHope this helps!',
);

console.log(result.text);
// '{"name": "Alice"}'

console.log(result.json);
// { name: 'Alice' }

console.log(result.type);
// 'json'

console.log(result.confidence);
// 0.95
```

### JSON Extraction: `extractJSON`

Extracts and parses JSON from raw LLM output. Returns the parsed value or `undefined` if no JSON is found. Accepts a generic type parameter for compile-time type safety.

```typescript
import { extractJSON } from 'llm-output-normalizer';

interface User {
  name: string;
  age: number;
}

const user = extractJSON<User>(
  'Here is the user data:\n\n{"name": "Alice", "age": 30}\n\nLet me know if you need changes.',
);

console.log(user);
// { name: 'Alice', age: 30 }

// With repair:
const repaired = extractJSON(
  '{name: "Alice", age: 30, hobbies: ["reading",]}',
);

console.log(repaired);
// { name: 'Alice', age: 30, hobbies: ['reading'] }
```

### Code Extraction: `extractCode`

Extracts a code block from markdown fences. Returns the code string and language tag.

```typescript
import { extractCode } from 'llm-output-normalizer';

const result = extractCode(
  'Here\'s the function:\n\n```typescript\nfunction greet(name: string) {\n  return `Hello, ${name}!`;\n}\n```',
);

console.log(result.code);
// 'function greet(name: string) {\n  return `Hello, ${name}!`;\n}'

console.log(result.language);
// 'typescript'
```

### Extract All: `extractAll`

Extracts all JSON objects and code blocks from the output.

```typescript
import { extractAll } from 'llm-output-normalizer';

const result = extractAll(
  'Here are two configurations:\n\n```json\n{"env": "dev"}\n```\n\nAnd:\n\n```json\n{"env": "prod"}\n```\n\nUse whichever fits.',
);

console.log(result.json);
// [{ env: 'dev' }, { env: 'prod' }]

console.log(result.code);
// [{ code: '{"env": "dev"}', language: 'json' }, { code: '{"env": "prod"}', language: 'json' }]

console.log(result.text);
// 'Here are two configurations:\n\nAnd:\n\nUse whichever fits.'
```

### Detection: `detect`

Analyzes raw LLM output and reports what type of content it contains, without performing extraction.

```typescript
import { detect } from 'llm-output-normalizer';

const info = detect('```json\n{"name": "Alice"}\n```');

console.log(info.type);
// 'json'

console.log(info.confidence);
// 0.95

console.log(info.hasPreamble);
// false

console.log(info.hasPostamble);
// false

console.log(info.hasFences);
// true

console.log(info.hasThinkingBlocks);
// false
```

### Factory: `createNormalizer`

Creates a configured normalizer instance with preset options. Useful when processing multiple LLM outputs with the same configuration, avoiding repeated option parsing.

```typescript
import { createNormalizer } from 'llm-output-normalizer';

const normalizer = createNormalizer({
  mode: 'json',
  repair: 'moderate',
  jsonStrategy: 'first',
  steps: {
    'preamble-strip': { sensitivity: 'aggressive' },
    'postamble-strip': false,  // disable postamble stripping
  },
});

const result1 = normalizer.normalize(llmOutput1);
const result2 = normalizer.normalize(llmOutput2);
const json1 = normalizer.extractJSON<Config>(llmOutput3);
```

### Type Definitions

```typescript
// ── Extraction Mode ─────────────────────────────────────────────────

/** The extraction mode determines what type of content to extract. */
type ExtractionMode = 'json' | 'code' | 'text' | 'auto' | 'all' | 'markdown';

/** Strategy for handling multiple JSON candidates. */
type JsonStrategy = 'first' | 'largest' | 'all';

/** Sensitivity level for preamble/postamble detection. */
type PreambleSensitivity = 'strict' | 'normal' | 'aggressive';

/** Aggressiveness level for JSON repair. */
type RepairLevel = 'conservative' | 'moderate' | 'aggressive';

// ── Options ─────────────────────────────────────────────────────────

/** Options for the normalize function. */
interface NormalizeOptions {
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

/** Configuration for an individual pipeline step. */
interface StepConfig {
  /** Whether this step is enabled. */
  enabled?: boolean;

  /** Step-specific options (varies by step). */
  [key: string]: unknown;
}

/** Options for extractJSON. */
interface ExtractJSONOptions extends NormalizeOptions {
  /**
   * If true, return the raw JSON string instead of parsing it.
   * Useful when you need the string for further processing.
   * Default: false.
   */
  raw?: boolean;
}

// ── Result Types ────────────────────────────────────────────────────

/** Result of the normalize function. */
interface NormalizeResult {
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

/** An extracted code block. */
interface CodeBlock {
  /** The code content (without fence markers). */
  code: string;

  /** The language tag from the fence, if present. */
  language?: string;
}

/** Metadata about the normalization process. */
interface NormalizeMeta {
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
}

/** Result of the extractAll function. */
interface ExtractAllResult {
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
interface DetectResult {
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

// ── Normalizer Instance ─────────────────────────────────────────────

/** A configured normalizer instance created by createNormalizer(). */
interface Normalizer {
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
```

---

## 10. Streaming Support

### Problem

LLM responses are often streamed token by token or chunk by chunk via SSE (Server-Sent Events) or WebSocket connections. The raw chunks are text fragments that do not individually constitute valid output. A preamble like "Sure! Here's the JSON:" may arrive across three chunks: `"Sure! He"`, `"re's the J"`, `"SON:\n\n{"`. The pipeline cannot reliably normalize partial chunks because any individual chunk lacks the context needed to determine what is preamble, what is content, and where fences begin and end.

### Solution: BufferedNormalizer

`llm-output-normalizer` provides a `BufferedNormalizer` class for streaming scenarios. It accumulates chunks in an internal buffer and applies normalization only when the buffer contains enough content to process reliably, or when the stream ends.

```typescript
import { createBufferedNormalizer } from 'llm-output-normalizer';

const buffered = createBufferedNormalizer({ mode: 'json' });

// Feed chunks as they arrive from the LLM stream
for await (const chunk of llmStream) {
  buffered.write(chunk);
}

// Finalize: flush the buffer and run the full pipeline
const result = buffered.end();

console.log(result.json);
// The parsed JSON value
```

### How It Works

1. **Accumulation phase**: The `write(chunk)` method appends each chunk to an internal string buffer. No normalization occurs during this phase because the input is incomplete.

2. **Optional early detection**: After each `write`, the buffered normalizer checks whether enough content has accumulated to make a preliminary type detection. If a complete JSON object or code fence is detected in the buffer, the `onPartial` callback (if configured) fires with the partial extraction. This enables displaying early results in streaming UIs.

3. **Finalization**: The `end()` method signals that no more chunks will arrive. The full normalization pipeline runs on the accumulated buffer, producing the same result as calling `normalize()` on the complete text.

### API

```typescript
interface BufferedNormalizerOptions extends NormalizeOptions {
  /**
   * Optional callback invoked when a complete structural element is
   * detected in the buffer before the stream ends. Receives a partial
   * NormalizeResult. Useful for early rendering in streaming UIs.
   */
  onPartial?: (partial: NormalizeResult) => void;
}

interface BufferedNormalizer {
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
```

### Streaming JSON Repair

For JSON responses specifically, the buffered normalizer can detect a complete JSON structure before the stream ends. This is useful because many LLM responses contain a JSON object followed by postamble text. The buffered normalizer detects when the JSON object is complete (bracket depth returns to zero) and can fire the `onPartial` callback without waiting for the postamble.

For truncated streams (the connection drops or the model is interrupted), calling `end()` on an incomplete buffer applies truncation recovery from the JSON repair step, returning the best possible partial result.

---

## 11. Configuration

### Step Enable/Disable

Every pipeline step can be individually enabled or disabled via the `steps` option:

```typescript
normalize(output, {
  steps: {
    'thinking-block-removal': false,    // disable thinking block removal
    'json-repair': false,               // disable JSON repair
    'preamble-strip': {                 // configure with options
      enabled: true,
      sensitivity: 'aggressive',
    },
  },
});
```

### Per-Step Configuration Options

| Step ID | Option | Type | Default | Description |
|---|---|---|---|---|
| `preamble-strip` | `sensitivity` | `PreambleSensitivity` | `'normal'` | How aggressively to detect preambles |
| `preamble-strip` | `customPatterns` | `RegExp[]` | `[]` | Additional preamble patterns |
| `postamble-strip` | `sensitivity` | `PreambleSensitivity` | `'normal'` | How aggressively to detect postambles |
| `postamble-strip` | `customPatterns` | `RegExp[]` | `[]` | Additional postamble patterns |
| `json-repair` | `level` | `RepairLevel` | `'moderate'` | How aggressively to repair JSON |
| `json-extract` | `strategy` | `JsonStrategy` | `'first'` | How to handle multiple JSON candidates |
| `markdown-fence-extract` | `preferLanguage` | `string` | `undefined` | Prefer fences with this language tag |
| `xml-artifact-unwrap` | `customTags` | `string[]` | `[]` | Additional XML tags to treat as artifacts |
| `thinking-block-removal` | `customTags` | `string[]` | `[]` | Additional tags to treat as thinking blocks |

### Configuration Presets

`llm-output-normalizer` provides named presets for common use cases:

```typescript
import { normalize, presets } from 'llm-output-normalizer';

// Minimal: only fence extraction and whitespace cleanup
normalize(output, presets.minimal);

// Strict JSON: all steps enabled, aggressive repair, first JSON
normalize(output, presets.strictJSON);

// Clean text: all cleanup steps, no JSON/code extraction
normalize(output, presets.cleanText);

// Passthrough: only unicode normalization and whitespace cleanup
normalize(output, presets.passthrough);
```

| Preset | Steps Enabled | Mode | Repair Level | Use Case |
|---|---|---|---|---|
| `minimal` | unicode, fences, whitespace | auto | conservative | Simple fence stripping |
| `strictJSON` | all | json | aggressive | Maximum JSON extraction reliability |
| `cleanText` | unicode, thinking, xml, preamble, postamble, whitespace | text | N/A | Clean prose output |
| `passthrough` | unicode, whitespace | text | N/A | Minimal cleanup only |
| `default` | all | auto | moderate | Comprehensive cleanup (the default) |

---

## 12. CLI Interface

### Installation and Invocation

```bash
# Global install
npm install -g llm-output-normalizer
llm-output-normalizer < response.txt

# npx (no install)
npx llm-output-normalizer < response.txt

# Package script
# package.json: { "scripts": { "clean-output": "llm-output-normalizer --json" } }
```

### CLI Binary Name

`llm-output-normalizer`

### Commands and Flags

```
llm-output-normalizer [options]

Input (reads from stdin by default):
  --file <path>          Read input from a file instead of stdin.

Mode options:
  --json                 Extract JSON and output the parsed value
                         (pretty-printed). Exit code 1 if no JSON found.
  --code                 Extract code block and output the code string.
                         Exit code 1 if no code fence found.
  --text                 Clean text output (strip all wrappers, no extraction).
  --auto                 Auto-detect content type (default).
  --all                  Extract all JSON and code blocks as a JSON array.
  --markdown             Clean markdown output.

JSON options:
  --strategy <strategy>  JSON strategy: first, largest, all.
                         Default: first.
  --repair <level>       JSON repair level: conservative, moderate, aggressive.
                         Default: moderate.
  --raw-json             Output the raw JSON string instead of pretty-printing.

Preamble options:
  --preamble <level>     Preamble sensitivity: strict, normal, aggressive.
                         Default: normal.
  --no-preamble          Disable preamble stripping.
  --no-postamble         Disable postamble stripping.

Step control:
  --disable <step>       Disable a specific pipeline step (repeatable).
                         Example: --disable thinking-block-removal
  --only <steps>         Run only the specified steps (comma-separated).
                         Example: --only markdown-fence-extract,json-extract

Output options:
  --format <format>      Output format: text, json, meta.
                         text: output the cleaned result (default).
                         json: output the full NormalizeResult as JSON.
                         meta: output only the metadata as JSON.
  --compact              Output compact JSON (no pretty-printing).
  --no-color             Disable colored output in meta mode.

General:
  --version              Print version and exit.
  --help                 Print help and exit.
```

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success. Content was extracted/cleaned. |
| `1` | Extraction failed. No JSON found (in --json mode) or no code fence found (in --code mode). The cleaned text is still output to stdout. |
| `2` | Configuration error. Invalid flags, file not found, or read failure. |

### Usage Examples

```bash
# Extract JSON from an LLM response file
cat response.txt | llm-output-normalizer --json

# Pipe through jq for further processing
echo '{"prompt": "give me json"}' | llm-api-call | llm-output-normalizer --json | jq '.name'

# Extract Python code from a Claude response
llm-output-normalizer --code --file claude-response.txt > extracted.py

# Get full metadata about what was normalized
llm-output-normalizer --format meta < response.txt

# Strip preamble and postamble only, keep everything else
llm-output-normalizer --text --only preamble-strip,postamble-strip,whitespace-cleanup < response.txt

# Aggressive JSON extraction from messy local model output
llm-output-normalizer --json --repair aggressive --preamble aggressive < ollama-output.txt
```

### Stdin/Stdout Pipeline

The CLI is designed for Unix pipeline composition. Input is read from stdin (or `--file`), output goes to stdout. Metadata and errors go to stderr. This enables clean piping:

```bash
# LLM call -> normalize -> validate -> process
llm-call "generate user JSON" \
  | llm-output-normalizer --json \
  | json-schema-validate user.schema.json \
  | process-user-data
```

---

## 13. Error Handling

### Design Principle

`llm-output-normalizer` never throws on valid input. If the input string cannot be processed as the requested type, the function returns a result indicating failure rather than throwing an exception. This design ensures that the package can be used in production pipelines without try-catch wrappers around every call.

### Failure Modes

| Scenario | Behavior | Result |
|---|---|---|
| `extractJSON` finds no JSON | Returns `undefined` | Caller checks for `undefined` |
| `extractJSON` finds JSON but repair fails | Returns `undefined`, error details in meta | Caller checks meta for repair errors |
| `extractCode` finds no code fence | Returns `undefined` | Caller checks for `undefined` |
| `normalize` in `auto` mode finds nothing structural | Returns `{ type: 'text', text: cleanedInput }` | Clean text is always available |
| Input is empty string | Returns `{ type: 'text', text: '', confidence: 1.0 }` | Valid empty result |
| Input is `null` or `undefined` | Throws `TypeError` | Only invalid-argument case that throws |
| Regex catastrophic backtracking | Timeout after 100ms per step; step is skipped | Logged to meta |

### Error Details in Metadata

The `meta` field of every result contains enough information for debugging. If JSON repair was attempted but failed, `meta.jsonRepairs` lists the repairs that were tried. If a pipeline step was skipped due to an error, `meta.stepsApplied` will not include that step, and `meta.errors` (an array of `{ step: string, error: string }`) will explain why.

```typescript
interface NormalizeMeta {
  // ... (fields from section 9)

  /** Errors encountered during normalization (non-fatal). */
  errors?: Array<{ step: string; error: string }>;
}
```

### Defensive Regex

All regular expressions used in the pipeline are designed to avoid catastrophic backtracking (ReDoS). Patterns use possessive quantifiers or atomic groups where available, avoid nested quantifiers on overlapping character classes, and are tested against pathological inputs. Each regex operation has an implicit timeout: if a single step takes longer than 100ms, it is aborted and the text passes through unchanged.

---

## 14. Testing Strategy

### Test Fixture Design

The test suite is built around a comprehensive collection of real-world LLM output fixtures. Each fixture is a raw LLM response string paired with the expected extraction result. Fixtures are organized by the type of noise they contain.

### Fixture Categories

**Preamble fixtures** (one fixture per preamble pattern):
- "Sure! Here's the JSON you requested:\n\n{...}"
- "Certainly! Here is the code:\n\n```python\n...\n```"
- "Based on your request, here is the result:\n\n{...}"
- "I've generated the following JSON:\n\n{...}"
- (One fixture for each pattern in the catalog -- approximately 30 fixtures)

**Postamble fixtures** (one fixture per postamble pattern):
- "{...}\n\nLet me know if you need anything else!"
- "```python\n...\n```\n\nI hope this helps!"
- "{...}\n\nPlease review the code before using in production."
- (Approximately 20 fixtures)

**Fence fixtures**:
- JSON in ```json fence
- Code in ```python fence
- Code in ```typescript fence
- Bare ``` fence (no language tag)
- ~~~ tilde fence
- Multiple fences in one response
- Nested fences (documentation containing code examples)
- Unclosed fence (truncated response)
- Four-backtick fence (`````)

**JSON repair fixtures**:
- Trailing commas in objects
- Trailing commas in arrays
- Single-quoted strings
- Unquoted keys
- JavaScript comments (line and block)
- `undefined`, `NaN`, `Infinity` literals
- Full-width Chinese punctuation
- Truncated JSON at various depths
- Multiple malformations in a single JSON value
- Double commas from deleted values

**Thinking block fixtures**:
- `<thinking>...</thinking>` with JSON answer
- `<antThinking>...</antThinking>` with code answer
- Multiple thinking blocks interspersed with content
- Nested thinking tags (thinking block containing XML)

**XML artifact fixtures**:
- `<artifact>` with JSON content
- `<result>` with code content
- `<answer>` with text content
- Nested artifacts

**Combined fixtures** (multiple issues in one response):
- Preamble + fence + postamble + JSON
- Thinking block + preamble + fence + JSON repair + postamble
- XML artifact + preamble + malformed JSON
- Multiple fences with preambles and postambles between them

**Edge case fixtures**:
- Empty string input
- Input that is pure valid JSON (no noise)
- Input that is pure text (no structure)
- Input that looks like JSON but is not ("this is {not} JSON")
- Input with Unicode BOM
- Input with unusual whitespace characters
- Very large input (100KB+ of JSON)
- Deeply nested JSON (50+ levels)
- JSON with very long string values (10KB+)

### Test Organization

Tests are organized by function and by fixture category:

```
src/__tests__/
  normalize.test.ts          -- Tests for the normalize function
  extractJSON.test.ts        -- Tests for JSON extraction
  extractCode.test.ts        -- Tests for code extraction
  extractAll.test.ts         -- Tests for extractAll
  detect.test.ts             -- Tests for content detection
  pipeline/
    unicode.test.ts          -- Unicode normalization step
    thinking.test.ts         -- Thinking block removal step
    xmlArtifact.test.ts      -- XML artifact unwrapping step
    preamble.test.ts         -- Preamble stripping step
    postamble.test.ts        -- Postamble stripping step
    fences.test.ts           -- Markdown fence extraction step
    jsonExtract.test.ts      -- JSON extraction step
    jsonRepair.test.ts       -- JSON repair step
    whitespace.test.ts       -- Whitespace cleanup step
  streaming.test.ts          -- BufferedNormalizer tests
  cli.test.ts                -- CLI integration tests
  fixtures/
    preambles.ts             -- Preamble test fixtures
    postambles.ts            -- Postamble test fixtures
    fences.ts                -- Fence test fixtures
    jsonRepair.ts            -- JSON repair test fixtures
    thinking.ts              -- Thinking block test fixtures
    combined.ts              -- Combined-issue test fixtures
    edgeCases.ts             -- Edge case test fixtures
```

### Test Runner

`vitest` (already configured in `package.json`).

---

## 15. Performance

### Design Constraints

`llm-output-normalizer` is designed to process LLM output in microseconds, not milliseconds. A typical LLM API call takes 500ms to 30 seconds. The normalization step should be imperceptible -- less than 1ms for typical output (under 10KB), less than 10ms for large output (up to 1MB).

### Optimization Strategy

**Single-pass where possible**: The pipeline steps are designed to minimize repeated scanning of the text. Unicode normalization, thinking block removal, and preamble stripping each make a single pass through the text. JSON extraction uses a single-pass state machine.

**Early termination**: Each step's predicate runs first to determine if the step is applicable. If the text does not contain `<thinking`, the thinking block removal step returns immediately. If the text does not start with a known preamble pattern, preamble stripping returns immediately. These fast-path checks use `indexOf` or simple regex tests.

**No backtracking regex**: All regex patterns are designed to be linear-time. No nested quantifiers, no overlapping alternations, no patterns that can cause catastrophic backtracking. Where a regex would need to be complex, a hand-written scanner (state machine or indexOf loop) is used instead.

**Lazy compilation**: Regular expressions used by the pipeline are compiled once at module load time (or on first use via lazy initialization) and reused across calls. There is no regex compilation cost per normalize() call.

**Memory efficiency**: The pipeline modifies strings in place (via replacement) rather than building intermediate object representations. For large inputs, this avoids allocating multiple large string copies. The bracket-matching state machine operates on the input string without copying it.

### Benchmarks

Target performance on typical inputs (measured on a 2024 MacBook Pro, Node.js 22):

| Input Size | Content | Expected Time |
|---|---|---|
| 200 bytes | JSON with preamble + fence | < 0.05ms |
| 2KB | Code with thinking block + preamble + postamble | < 0.1ms |
| 10KB | Large JSON with multiple malformations | < 0.5ms |
| 100KB | Very large JSON response | < 5ms |
| 1MB | Massive output (stress test) | < 50ms |

---

## 16. Dependencies

### Runtime Dependencies

None. `llm-output-normalizer` has zero runtime dependencies. All functionality -- Unicode processing, regex pattern matching, state machine parsing, JSON repair -- is implemented using Node.js built-in APIs (`String.prototype.normalize`, `RegExp`, `JSON.parse`).

### Development Dependencies

| Package | Purpose |
|---|---|
| `typescript` | TypeScript compiler |
| `vitest` | Test runner |
| `eslint` | Linting |
| `@types/node` | Node.js type definitions |

### Peer Dependencies

None.

### Why Zero Dependencies

The package processes arbitrary user-provided strings through regex and state machine logic. Keeping the dependency tree at zero eliminates supply chain risk, ensures the package works in any Node.js 18+ environment without installation issues, and keeps the installed size minimal. The JSON repair logic is purpose-built for LLM output patterns and is simpler than general-purpose JSON repair libraries (which handle a broader range of malformations that LLMs do not produce).

---

## 17. File Structure

```
llm-output-normalizer/
  package.json
  tsconfig.json
  SPEC.md
  README.md
  src/
    index.ts                       -- Public API exports
    normalize.ts                   -- normalize() function, pipeline orchestration
    extractJSON.ts                 -- extractJSON() function
    extractCode.ts                 -- extractCode() function
    extractAll.ts                  -- extractAll() function
    detect.ts                      -- detect() function
    factory.ts                     -- createNormalizer(), createBufferedNormalizer()
    buffered.ts                    -- BufferedNormalizer class
    types.ts                       -- All TypeScript type definitions
    presets.ts                     -- Named configuration presets
    pipeline/
      index.ts                     -- Pipeline runner (step sequencing)
      unicode-normalize.ts         -- Step 1: Unicode normalization
      thinking-block-removal.ts    -- Step 2: Thinking block removal
      xml-artifact-unwrap.ts       -- Step 3: XML artifact unwrapping
      preamble-strip.ts            -- Step 4: Preamble stripping
      postamble-strip.ts           -- Step 5: Postamble stripping
      markdown-fence-extract.ts    -- Step 6: Markdown fence extraction
      json-extract.ts              -- Step 7: JSON extraction (bracket matching)
      json-repair.ts               -- Step 8: JSON repair
      whitespace-cleanup.ts        -- Step 9: Whitespace cleanup
    patterns/
      preambles.ts                 -- Preamble regex patterns
      postambles.ts                -- Postamble regex patterns
      thinking-tags.ts             -- Thinking block tag patterns
      xml-artifacts.ts             -- XML artifact tag patterns
    cli.ts                         -- CLI entry point
  src/__tests__/
    normalize.test.ts
    extractJSON.test.ts
    extractCode.test.ts
    extractAll.test.ts
    detect.test.ts
    pipeline/
      unicode.test.ts
      thinking.test.ts
      xmlArtifact.test.ts
      preamble.test.ts
      postamble.test.ts
      fences.test.ts
      jsonExtract.test.ts
      jsonRepair.test.ts
      whitespace.test.ts
    streaming.test.ts
    cli.test.ts
    fixtures/
      preambles.ts
      postambles.ts
      fences.ts
      jsonRepair.ts
      thinking.ts
      combined.ts
      edgeCases.ts
  dist/                            -- Compiled output (generated by tsc)
```

---

## 18. Implementation Roadmap

### Phase 1: Core Pipeline (v0.1.0)

Implement the foundation: pipeline orchestration, all nine normalization steps, and the primary API functions.

1. **Types and pipeline runner**: Define all TypeScript types (`types.ts`) and implement the pipeline runner that sequences steps (`pipeline/index.ts`).
2. **Unicode normalization** (step 1): BOM removal, whitespace normalization, control character removal, NFC normalization.
3. **Thinking block removal** (step 2): Pattern matching and removal for all documented thinking tag formats.
4. **XML artifact unwrapping** (step 3): Tag detection and content extraction for artifact/result/answer/output tags.
5. **Preamble stripping** (step 4): Full pattern catalog implementation with sensitivity levels.
6. **Postamble stripping** (step 5): Full pattern catalog implementation.
7. **Markdown fence extraction** (step 6): Backtick and tilde fence parsing, language tag extraction, nested fence handling.
8. **JSON extraction** (step 7): Bracket-matching state machine, multiple candidate handling, strategy selection.
9. **JSON repair** (step 8): All repair operations in order, repair level configuration, truncation recovery.
10. **Whitespace cleanup** (step 9): Trim, newline normalization, blank line collapsing.
11. **Public API**: `normalize()`, `extractJSON()`, `extractCode()`, `extractAll()`, `detect()`.
12. **Tests**: Full test suite with fixtures for every step and every function.

### Phase 2: Configuration and Factory (v0.2.0)

Add the configuration layer and factory functions.

1. **createNormalizer()**: Factory function that creates configured normalizer instances.
2. **Presets**: Named configuration presets (minimal, strictJSON, cleanText, passthrough).
3. **Per-step configuration**: Individual step options (sensitivity, repair level, custom patterns).
4. **Custom patterns**: Support for user-defined preamble/postamble patterns and custom XML tags.

### Phase 3: Streaming and CLI (v0.3.0)

Add streaming support and the CLI interface.

1. **BufferedNormalizer**: Streaming accumulation, finalization, partial detection callbacks.
2. **CLI**: stdin reading, flag parsing, output formatting, exit codes.
3. **CLI integration tests**: End-to-end tests for CLI invocation.

### Phase 4: Polish and Ecosystem (v1.0.0)

Production readiness.

1. **Performance optimization**: Benchmark suite, hot path optimization, lazy regex compilation.
2. **Edge case hardening**: ReDoS testing, pathological input testing, very large input testing.
3. **Documentation**: Comprehensive README with usage examples for every common scenario.
4. **Ecosystem integration examples**: Usage with OpenAI SDK, Anthropic SDK, Vercel AI SDK, LangChain.

---

## 19. Example Use Cases

### Before/After: JSON in Markdown Fence with Preamble and Postamble

**Raw LLM output**:
```
Sure! Here's the user data you requested:

```json
{
  "name": "Alice",
  "age": 30,
  "email": "alice@example.com"
}
```

Let me know if you need anything else!
```

**After `extractJSON(output)`**:
```json
{
  "name": "Alice",
  "age": 30,
  "email": "alice@example.com"
}
```

---

### Before/After: Malformed JSON from Local Model

**Raw LLM output**:
```
Here is the config:

{
  name: 'my-app',
  version: '1.0',
  dependencies: ['express', 'lodash',],
  // database config
  db: {
    host: 'localhost',
    port: 5432,
    ssl: undefined,
  },
}
```

**After `extractJSON(output)`**:
```json
{
  "name": "my-app",
  "version": "1.0",
  "dependencies": ["express", "lodash"],
  "db": {
    "host": "localhost",
    "port": 5432,
    "ssl": null
  }
}
```

---

### Before/After: Code with Thinking Block

**Raw LLM output**:
```
<thinking>
The user wants a Python function to calculate Fibonacci numbers.
I should use an iterative approach for efficiency.
Let me write a clean implementation.
</thinking>

Here's the implementation:

```python
def fibonacci(n: int) -> int:
    if n <= 1:
        return n
    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b
```

This uses an iterative approach with O(n) time complexity and O(1) space.
```

**After `extractCode(output)`**:
```python
def fibonacci(n: int) -> int:
    if n <= 1:
        return n
    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b
```

Language: `python`

---

### Before/After: Truncated JSON Recovery

**Raw LLM output** (max_tokens hit):
```
{"users": [{"name": "Alice", "age": 30, "roles": ["admin", "editor"]}, {"name": "Bob", "age": 25, "roles": ["vi
```

**After `extractJSON(output)`**:
```json
{"users": [{"name": "Alice", "age": 30, "roles": ["admin", "editor"]}, {"name": "Bob", "age": 25, "roles": ["vi"]}]}
```

Metadata: `{ jsonTruncated: true, jsonRepairs: ['closed-truncated-string', 'closed-truncated-array', 'closed-truncated-object', 'closed-truncated-array', 'closed-truncated-object'] }`

---

### Before/After: XML Artifact Wrapper

**Raw LLM output**:
```
I've created the configuration for your deployment.

<artifact type="application/json" title="Deployment Config">
{
  "service": "web-api",
  "replicas": 3,
  "region": "us-east-1"
}
</artifact>

You can apply this configuration using `kubectl apply -f config.json`.
```

**After `extractJSON(output)`**:
```json
{
  "service": "web-api",
  "replicas": 3,
  "region": "us-east-1"
}
```

---

### Before/After: Multiple JSON Objects

**Raw LLM output**:
```
Here are the two configurations:

Development:
{"env": "development", "debug": true, "port": 3000}

Production:
{"env": "production", "debug": false, "port": 8080}
```

**After `extractAll(output)`**:
```json
{
  "json": [
    {"env": "development", "debug": true, "port": 3000},
    {"env": "production", "debug": false, "port": 8080}
  ],
  "code": [],
  "text": "Here are the two configurations:\n\nDevelopment:\n\nProduction:"
}
```

---

### Before/After: Clean Text with Conversational Wrappers

**Raw LLM output**:
```
Great question! Let me provide a thorough analysis.

The architecture follows a microservices pattern with three core services:
the API gateway handles routing, the auth service manages JWT tokens,
and the data service provides CRUD operations against PostgreSQL.

The main bottleneck is the synchronous database queries in the data
service, which block the event loop under high concurrency.

I hope this analysis helps! Let me know if you'd like me to dive
deeper into any specific aspect.
```

**After `normalize(output, { mode: 'text' })`**:
```
The architecture follows a microservices pattern with three core services:
the API gateway handles routing, the auth service manages JWT tokens,
and the data service provides CRUD operations against PostgreSQL.

The main bottleneck is the synchronous database queries in the data
service, which block the event loop under high concurrency.
```

---

### Before/After: Full-Width Chinese Punctuation in JSON

**Raw LLM output**:
```
{"name"："张三"，"age"：25，"city"："北京"}
```

**After `extractJSON(output)`**:
```json
{"name": "张三", "age": 25, "city": "北京"}
```

---

### Before/After: Pipeline Integration

```typescript
import { extractJSON } from 'llm-output-normalizer';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const UserSchema = z.object({
  name: z.string(),
  age: z.number().int().positive(),
  email: z.string().email(),
});

const response = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Generate a sample user as JSON.' }],
});

const rawText = response.content[0].type === 'text'
  ? response.content[0].text
  : '';

// Step 1: Extract and repair JSON from raw LLM output
const parsed = extractJSON(rawText);

// Step 2: Validate against schema
const user = UserSchema.parse(parsed);

// user is now a typed, validated object
console.log(user.name);
```
