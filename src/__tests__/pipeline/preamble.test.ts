import { describe, it, expect } from 'vitest';
import { preambleStripStep } from '../../pipeline/preamble-strip';
import { postambleStripStep } from '../../pipeline/postamble-strip';

// ── Preamble ──────────────────────────────────────────────────────────────────

describe('preambleStripStep', () => {
  it('has correct id and order', () => {
    expect(preambleStripStep.id).toBe('preamble-strip');
    expect(preambleStripStep.order).toBe(4);
    expect(preambleStripStep.enabled).toBe(true);
  });

  it('predicate returns true for "Sure!" preamble', () => {
    expect(preambleStripStep.predicate("Sure! Here's your answer:\n{}")).toBe(true);
  });

  it('predicate returns false for plain text', () => {
    expect(preambleStripStep.predicate('{"key": "value"}')).toBe(false);
  });

  it('strips "Sure!" preamble line', () => {
    const input = "Sure! Here's the result:\n{\"key\": \"value\"}";
    const result = preambleStripStep.transform(input);
    expect(result).toContain('{"key": "value"}');
    expect(result).not.toMatch(/Sure!/);
  });

  it('strips "Of course" preamble', () => {
    const input = "Of course! Let me help.\n{\"data\": 1}";
    const result = preambleStripStep.transform(input);
    expect(result).toContain('{"data": 1}');
  });

  it('strips "Here is" preamble', () => {
    const input = "Here is the JSON you requested:\n{\"x\": 1}";
    const result = preambleStripStep.transform(input);
    expect(result).toContain('{"x": 1}');
  });

  it('strips "Certainly" preamble', () => {
    const input = "Certainly! Here you go.\nThe answer is 42.";
    const result = preambleStripStep.transform(input);
    expect(result).toContain('The answer is 42.');
    expect(result).not.toMatch(/Certainly/);
  });

  it('preserves content when no preamble is present', () => {
    const input = '{"result": true}';
    expect(preambleStripStep.transform(input)).toBe('{"result": true}');
  });

  it('does not strip more than the preamble lines', () => {
    const input = "Here's the code:\nline one\nline two\nline three";
    const result = preambleStripStep.transform(input);
    expect(result).toContain('line one');
    expect(result).toContain('line two');
    expect(result).toContain('line three');
  });
});

// ── Postamble ─────────────────────────────────────────────────────────────────

describe('postambleStripStep', () => {
  it('has correct id and order', () => {
    expect(postambleStripStep.id).toBe('postamble-strip');
    expect(postambleStripStep.order).toBe(5);
    expect(postambleStripStep.enabled).toBe(true);
  });

  it('predicate returns true for "I hope this helps" postamble', () => {
    expect(postambleStripStep.predicate('Some content\nI hope this helps!')).toBe(true);
  });

  it('predicate returns false for plain text', () => {
    expect(postambleStripStep.predicate('{"key": "value"}')).toBe(false);
  });

  it('strips "I hope this helps!" postamble', () => {
    const input = '{"key": "value"}\nI hope this helps!';
    const result = postambleStripStep.transform(input);
    expect(result).toContain('{"key": "value"}');
    expect(result).not.toMatch(/I hope this helps/);
  });

  it('strips "Let me know if you need anything" postamble', () => {
    const input = 'The answer is 42.\nLet me know if you need more info.';
    const result = postambleStripStep.transform(input);
    expect(result).toContain('The answer is 42.');
    expect(result).not.toMatch(/Let me know/);
  });

  it('strips "Feel free to ask" postamble', () => {
    const input = 'Content here.\nFeel free to ask more questions.';
    const result = postambleStripStep.transform(input);
    expect(result).toContain('Content here.');
    expect(result).not.toMatch(/Feel free to/);
  });

  it('preserves content when no postamble is present', () => {
    const input = '{"result": true}';
    expect(postambleStripStep.transform(input)).toBe('{"result": true}');
  });

  it('does not strip the main content', () => {
    const input = 'First line.\nSecond line.\nThird line.\nLet me know if you need help.';
    const result = postambleStripStep.transform(input);
    expect(result).toContain('First line.');
    expect(result).toContain('Second line.');
    expect(result).toContain('Third line.');
  });
});
