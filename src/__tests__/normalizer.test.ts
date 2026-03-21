import { describe, it, expect } from 'vitest';
import {
  normalize,
  extractJSON,
  extractCode,
  extractAll,
  detect,
  createNormalizer,
} from '../normalizer';

// ── normalize() ───────────────────────────────────────────────────────────────

describe('normalize()', () => {
  it('returns a NormalizeResult with text and meta', () => {
    const result = normalize('hello world');
    expect(result).toHaveProperty('text');
    expect(result).toHaveProperty('meta');
    expect(result).toHaveProperty('type');
    expect(result).toHaveProperty('confidence');
  });

  it('passes plain text through unchanged (after whitespace cleanup)', () => {
    const result = normalize('hello world');
    expect(result.text).toBe('hello world');
    expect(result.type).toBe('text');
  });

  it('strips thinking blocks and returns clean text', () => {
    const input = '<thinking>Let me think...</thinking>\n{"answer": 42}';
    const result = normalize(input);
    expect(result.text).not.toContain('<thinking>');
    expect(result.meta.thinkingBlocksRemoved).toBe(true);
  });

  it('extracts JSON from a fenced code block', () => {
    const input = 'Sure! Here\'s the JSON:\n\n```json\n{"name": "Alice", "age": 30}\n```\n\nLet me know if you need anything.';
    const result = normalize(input);
    expect(result.json).toEqual({ name: 'Alice', age: 30 });
    expect(result.type).toBe('json');
  });

  it('detects JSON type when output is raw JSON', () => {
    const result = normalize('{"key": "value", "num": 1}');
    expect(result.type).toBe('json');
    expect(result.json).toEqual({ key: 'value', num: 1 });
  });

  it('detects code type for fenced code block', () => {
    const result = normalize('```typescript\nconst x = 1;\n```');
    expect(result.type).toBe('code');
  });

  it('records stepsApplied in meta', () => {
    const result = normalize('hello\n\n\n\nworld');
    expect(result.meta.stepsApplied).toContain('unicode-normalize');
    expect(result.meta.stepsApplied).toContain('whitespace-cleanup');
  });

  it('collapses multiple blank lines via whitespace-cleanup', () => {
    const result = normalize('line1\n\n\n\nline2');
    expect(result.text).toBe('line1\n\nline2');
  });

  it('respects step disable override', () => {
    const input = '<thinking>hidden</thinking>answer';
    const result = normalize(input, { steps: { 'thinking-block-removal': false } });
    expect(result.text).toContain('<thinking>');
    expect(result.meta.thinkingBlocksRemoved).toBe(false);
  });

  it('meta.durationMs is a non-negative number', () => {
    const result = normalize('test');
    expect(result.meta.durationMs).toBeGreaterThanOrEqual(0);
  });
});

// ── extractJSON() ─────────────────────────────────────────────────────────────

describe('extractJSON()', () => {
  it('parses a raw JSON object', () => {
    const result = extractJSON<{ x: number }>('{"x": 42}');
    expect(result).toEqual({ x: 42 });
  });

  it('parses a JSON array', () => {
    const result = extractJSON<number[]>('[1, 2, 3]');
    expect(result).toEqual([1, 2, 3]);
  });

  it('extracts JSON from surrounding text', () => {
    const result = extractJSON<{ name: string }>('Here is the data: {"name": "Bob"} — done.');
    expect(result).toEqual({ name: 'Bob' });
  });

  it('extracts JSON from a thinking-wrapped response', () => {
    const input = '<thinking>processing</thinking>\n{"result": true}';
    const result = extractJSON<{ result: boolean }>(input);
    expect(result).toEqual({ result: true });
  });

  it('returns undefined when no JSON found', () => {
    expect(extractJSON('no json here')).toBeUndefined();
  });

  it('repairs trailing comma and parses successfully', () => {
    const result = extractJSON<{ a: number }>('{"a": 1,}');
    expect(result).toEqual({ a: 1 });
  });

  it('returns raw string when raw: true', () => {
    const result = extractJSON('{"a": 1}', { raw: true });
    expect(typeof result).toBe('string');
    expect(result).toContain('"a"');
  });
});

// ── extractCode() ─────────────────────────────────────────────────────────────

describe('extractCode()', () => {
  it('extracts the first code block', () => {
    const input = '```typescript\nconst x = 1;\n```';
    const result = extractCode(input);
    expect(result).toBeDefined();
    expect(result?.code).toBe('const x = 1;');
    expect(result?.language).toBe('typescript');
  });

  it('returns undefined when no code block is present', () => {
    expect(extractCode('plain text')).toBeUndefined();
  });

  it('includes language tag', () => {
    const result = extractCode('```python\nprint("hello")\n```');
    expect(result?.language).toBe('python');
  });

  it('handles code block with no language tag', () => {
    const result = extractCode('```\nraw code\n```');
    expect(result?.code).toBe('raw code');
    expect(result?.language).toBeUndefined();
  });

  it('returns the first block when multiple are present', () => {
    const input = '```js\nfirst();\n```\n\n```py\nsecond()\n```';
    const result = extractCode(input);
    expect(result?.language).toBe('js');
  });
});

// ── extractAll() ──────────────────────────────────────────────────────────────

describe('extractAll()', () => {
  it('returns json, code, text, and meta fields', () => {
    const result = extractAll('hello');
    expect(result).toHaveProperty('json');
    expect(result).toHaveProperty('code');
    expect(result).toHaveProperty('text');
    expect(result).toHaveProperty('meta');
  });

  it('extracts all code blocks', () => {
    const input = '```js\nfoo()\n```\n\n```py\nbar()\n```';
    const result = extractAll(input);
    expect(result.code).toHaveLength(2);
    expect(result.code[0].language).toBe('js');
    expect(result.code[1].language).toBe('py');
  });

  it('extracts JSON from a json-fenced block', () => {
    const input = '```json\n{"key": "value"}\n```';
    const result = extractAll(input);
    expect(result.json).toHaveLength(1);
    expect(result.json[0]).toEqual({ key: 'value' });
  });

  it('returns empty arrays when no structured data found', () => {
    const result = extractAll('just plain text here');
    expect(result.json).toEqual([]);
    expect(result.code).toEqual([]);
  });
});

// ── detect() ──────────────────────────────────────────────────────────────────

describe('detect()', () => {
  it('detects JSON type', () => {
    const result = detect('{"a": 1}');
    expect(result.type).toBe('json');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('detects code type for fenced code', () => {
    const result = detect('```ts\nconst x = 1;\n```');
    expect(result.type).toBe('code');
  });

  it('detects text type for plain text', () => {
    const result = detect('Hello, this is plain text.');
    expect(result.type).toBe('text');
  });

  it('detects preamble', () => {
    const result = detect("Sure! Here's the result:\n{}");
    expect(result.hasPreamble).toBe(true);
  });

  it('detects no preamble for clean text', () => {
    const result = detect('{"key": 1}');
    expect(result.hasPreamble).toBe(false);
  });

  it('detects postamble', () => {
    const result = detect('Some content\nI hope this helps!');
    expect(result.hasPostamble).toBe(true);
  });

  it('detects thinking blocks', () => {
    const result = detect('<thinking>hidden</thinking>answer');
    expect(result.hasThinkingBlocks).toBe(true);
  });

  it('detects XML artifacts', () => {
    const result = detect('<antArtifact type="code">code here</antArtifact>');
    expect(result.hasXmlArtifacts).toBe(true);
  });

  it('detects fences and their languages', () => {
    const result = detect('```python\ncode\n```');
    expect(result.hasFences).toBe(true);
    expect(result.fenceCount).toBe(1);
    expect(result.fenceLanguages).toContain('python');
  });

  it('returns fenceCount 0 for text without fences', () => {
    const result = detect('plain text');
    expect(result.hasFences).toBe(false);
    expect(result.fenceCount).toBe(0);
  });
});

// ── createNormalizer() ────────────────────────────────────────────────────────

describe('createNormalizer()', () => {
  it('returns a Normalizer object with all methods', () => {
    const n = createNormalizer();
    expect(typeof n.normalize).toBe('function');
    expect(typeof n.extractJSON).toBe('function');
    expect(typeof n.extractCode).toBe('function');
    expect(typeof n.extractAll).toBe('function');
    expect(typeof n.detect).toBe('function');
  });

  it('bound normalize() works', () => {
    const n = createNormalizer();
    const result = n.normalize('{"x": 1}');
    expect(result.type).toBe('json');
  });

  it('bound options are applied', () => {
    const n = createNormalizer({ steps: { 'thinking-block-removal': false } });
    const result = n.normalize('<thinking>hidden</thinking>answer');
    expect(result.text).toContain('<thinking>');
  });

  it('bound extractJSON() works', () => {
    const n = createNormalizer();
    expect(n.extractJSON('{"v": 99}')).toEqual({ v: 99 });
  });

  it('bound detect() works', () => {
    const n = createNormalizer();
    const result = n.detect('{"a": 1}');
    expect(result.type).toBe('json');
  });
});
