import { describe, it, expect } from 'vitest';
import { unicodeNormalizeStep } from '../../pipeline/unicode-normalize';

function apply(text: string): string {
  return unicodeNormalizeStep.transform(text);
}

describe('unicodeNormalizeStep', () => {
  it('has correct id and order', () => {
    expect(unicodeNormalizeStep.id).toBe('unicode-normalize');
    expect(unicodeNormalizeStep.order).toBe(1);
    expect(unicodeNormalizeStep.enabled).toBe(true);
  });

  it('predicate always returns true', () => {
    expect(unicodeNormalizeStep.predicate('')).toBe(true);
    expect(unicodeNormalizeStep.predicate('hello')).toBe(true);
  });

  it('strips UTF-8 BOM from the start', () => {
    expect(apply('\uFEFFhello')).toBe('hello');
  });

  it('does not strip BOM in middle of string', () => {
    expect(apply('hel\uFEFFlo')).toBe('hel\uFEFFlo');
  });

  it('replaces non-breaking space (U+00A0) with ASCII space', () => {
    expect(apply('hello\u00A0world')).toBe('hello world');
  });

  it('replaces em space (U+2003) with ASCII space', () => {
    expect(apply('a\u2003b')).toBe('a b');
  });

  it('replaces en space (U+2002) with ASCII space', () => {
    expect(apply('a\u2002b')).toBe('a b');
  });

  it('replaces thin space (U+2009) with ASCII space', () => {
    expect(apply('a\u2009b')).toBe('a b');
  });

  it('removes zero-width space (U+200B)', () => {
    expect(apply('a\u200Bb')).toBe('a b');
  });

  it('removes zero-width non-joiner (U+200C)', () => {
    expect(apply('a\u200Cb')).toBe('a b');
  });

  it('removes zero-width joiner (U+200D)', () => {
    expect(apply('a\u200Db')).toBe('a b');
  });

  it('replaces ideographic space (U+3000) with ASCII space', () => {
    expect(apply('a\u3000b')).toBe('a b');
  });

  it('removes control characters U+0000-U+001F except tab, LF, CR', () => {
    // U+0001 (SOH) is removed
    expect(apply('\u0001hello')).toBe('hello');
    // U+0007 (BEL) is removed
    expect(apply('a\u0007b')).toBe('ab');
    // U+001F (US) is removed
    expect(apply('a\u001Fb')).toBe('ab');
  });

  it('preserves tab (U+0009)', () => {
    expect(apply('a\tb')).toBe('a\tb');
  });

  it('preserves newline (U+000A)', () => {
    expect(apply('a\nb')).toBe('a\nb');
  });

  it('preserves carriage return (U+000D)', () => {
    expect(apply('a\rb')).toBe('a\rb');
  });

  it('applies NFC normalization', () => {
    // café decomposed (NFD: e + combining accent) -> NFC (é as single char)
    const nfd = 'cafe\u0301'; // decomposed
    const nfc = 'caf\u00E9';  // composed
    expect(apply(nfd)).toBe(nfc);
  });

  it('passes through already-clean ASCII text unchanged', () => {
    const clean = 'Hello, world! This is clean text.\n  With a tab:\there.';
    expect(apply(clean)).toBe(clean);
  });

  it('handles empty string', () => {
    expect(apply('')).toBe('');
  });

  it('handles BOM-only string', () => {
    expect(apply('\uFEFF')).toBe('');
  });

  it('applies all transformations in one pass', () => {
    const input = '\uFEFFhello\u00A0world\u200B\u0001test';
    // BOM stripped, NBSP->space, ZWSP->space, SOH removed
    expect(apply(input)).toBe('hello world test');
  });
});
