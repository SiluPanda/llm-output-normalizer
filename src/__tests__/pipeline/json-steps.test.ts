import { describe, it, expect } from 'vitest';
import { jsonExtractStep, extractJsonString } from '../../pipeline/json-extract';
import { jsonRepairStep, repairJson } from '../../pipeline/json-repair';

// ── JSON Extract ──────────────────────────────────────────────────────────────

describe('jsonExtractStep', () => {
  it('has correct id and order', () => {
    expect(jsonExtractStep.id).toBe('json-extract');
    expect(jsonExtractStep.order).toBe(7);
    expect(jsonExtractStep.enabled).toBe(true);
  });

  it('predicate returns true when text contains {', () => {
    expect(jsonExtractStep.predicate('{"key": 1}')).toBe(true);
  });

  it('predicate returns true when text contains [', () => {
    expect(jsonExtractStep.predicate('[1, 2, 3]')).toBe(true);
  });

  it('predicate returns false for plain text', () => {
    expect(jsonExtractStep.predicate('hello world')).toBe(false);
  });

  it('returns valid JSON unchanged', () => {
    const input = '{"name": "Alice"}';
    expect(jsonExtractStep.transform(input)).toBe('{"name": "Alice"}');
  });

  it('extracts JSON from surrounding text', () => {
    const input = 'Here is the result: {"name": "Bob"} — as requested.';
    const result = jsonExtractStep.transform(input);
    expect(result).toBe('{"name": "Bob"}');
  });

  it('extracts JSON from a ```json fence', () => {
    const input = '```json\n{"x": 1}\n```';
    const result = jsonExtractStep.transform(input);
    expect(result).toBe('{"x": 1}');
  });

  it('returns text unchanged when no valid JSON found', () => {
    const input = 'no json here {broken';
    const result = jsonExtractStep.transform(input);
    expect(result).toBe(input);
  });
});

describe('extractJsonString', () => {
  it('returns the whole string when it is valid JSON', () => {
    expect(extractJsonString('{"a": 1}')).toBe('{"a": 1}');
  });

  it('extracts JSON object embedded in text', () => {
    const result = extractJsonString('prefix {"a": 1} suffix');
    expect(result).toBe('{"a": 1}');
  });

  it('extracts JSON array', () => {
    const result = extractJsonString('result: [1, 2, 3]');
    expect(result).toBe('[1, 2, 3]');
  });

  it('returns null when no valid JSON present', () => {
    expect(extractJsonString('no json')).toBeNull();
  });

  it('extracts from json fence block', () => {
    const input = '```json\n{"key": "value"}\n```';
    expect(extractJsonString(input)).toBe('{"key": "value"}');
  });

  it('handles nested objects', () => {
    const result = extractJsonString('data: {"a": {"b": 2}}');
    expect(result).toBe('{"a": {"b": 2}}');
  });
});

// ── JSON Repair ───────────────────────────────────────────────────────────────

describe('jsonRepairStep', () => {
  it('has correct id and order', () => {
    expect(jsonRepairStep.id).toBe('json-repair');
    expect(jsonRepairStep.order).toBe(8);
    expect(jsonRepairStep.enabled).toBe(true);
  });

  it('predicate returns true for text starting with {', () => {
    expect(jsonRepairStep.predicate('{broken')).toBe(true);
  });

  it('predicate returns true for text starting with [', () => {
    expect(jsonRepairStep.predicate('[1, 2,')).toBe(true);
  });

  it('predicate returns false for plain text', () => {
    expect(jsonRepairStep.predicate('hello')).toBe(false);
  });

  it('returns valid JSON unchanged', () => {
    const input = '{"valid": true}';
    expect(jsonRepairStep.transform(input)).toBe(input);
  });

  it('removes trailing comma before }', () => {
    const repaired = repairJson('{"a": 1,}');
    expect(repaired).toBe('{"a": 1}');
    expect(() => JSON.parse(repaired)).not.toThrow();
  });

  it('removes trailing comma before ]', () => {
    const repaired = repairJson('[1, 2, 3,]');
    expect(repaired).toBe('[1, 2, 3]');
    expect(() => JSON.parse(repaired)).not.toThrow();
  });

  it('closes unclosed brace', () => {
    const repaired = repairJson('{"a": 1');
    expect(repaired).toBe('{"a": 1}');
    expect(() => JSON.parse(repaired)).not.toThrow();
  });

  it('closes unclosed bracket', () => {
    const repaired = repairJson('[1, 2, 3');
    expect(repaired).toBe('[1, 2, 3]');
    expect(() => JSON.parse(repaired)).not.toThrow();
  });

  it('closes nested unclosed braces', () => {
    const repaired = repairJson('{"a": {"b": 1}');
    expect(repaired).toBe('{"a": {"b": 1}}');
    expect(() => JSON.parse(repaired)).not.toThrow();
  });

  it('handles already-valid JSON without modification', () => {
    const input = '{"a": 1, "b": [1, 2, 3]}';
    const repaired = repairJson(input);
    expect(repaired).toBe(input);
  });

  it('repairs incomplete key-value pair by inserting null', () => {
    const result = repairJson('{"key": ');
    expect(() => JSON.parse(result)).not.toThrow();
    expect(JSON.parse(result)).toEqual({ key: null });
  });

  it('repairs trailing comma after bracket closure', () => {
    const result = repairJson('{"a": 1, ');
    expect(() => JSON.parse(result)).not.toThrow();
    expect(JSON.parse(result)).toEqual({ a: 1 });
  });
});
