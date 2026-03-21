import { describe, it, expect } from 'vitest';
import { thinkingBlockRemovalStep } from '../../pipeline/thinking-block-removal';

function apply(text: string): string {
  return thinkingBlockRemovalStep.transform(text);
}

describe('thinkingBlockRemovalStep', () => {
  it('has correct id and order', () => {
    expect(thinkingBlockRemovalStep.id).toBe('thinking-block-removal');
    expect(thinkingBlockRemovalStep.order).toBe(2);
    expect(thinkingBlockRemovalStep.enabled).toBe(true);
  });

  it('predicate returns true when thinking tag is present', () => {
    expect(thinkingBlockRemovalStep.predicate('<thinking>hello</thinking>')).toBe(true);
  });

  it('predicate returns false when no thinking tag is present', () => {
    expect(thinkingBlockRemovalStep.predicate('plain text')).toBe(false);
  });

  it('removes a <thinking> block', () => {
    const input = '<thinking>Internal reasoning here</thinking>\nActual answer.';
    expect(apply(input)).toBe('\nActual answer.');
  });

  it('removes a <reflection> block', () => {
    const input = '<reflection>some reflection</reflection>Answer';
    expect(apply(input)).toBe('Answer');
  });

  it('removes a <scratchpad> block', () => {
    const input = '<scratchpad>notes</scratchpad>Result';
    expect(apply(input)).toBe('Result');
  });

  it('removes a <reasoning> block', () => {
    const input = '<reasoning>step by step</reasoning>Final.';
    expect(apply(input)).toBe('Final.');
  });

  it('removes a <thought> block', () => {
    const input = '<thought>interim thought</thought>Answer';
    expect(apply(input)).toBe('Answer');
  });

  it('removes multiple thinking blocks', () => {
    const input = '<thinking>first</thinking>mid<thinking>second</thinking>end';
    expect(apply(input)).toBe('midend');
  });

  it('is case-insensitive for tag names', () => {
    const input = '<THINKING>uppercase</THINKING>content';
    expect(apply(input)).toBe('content');
  });

  it('passes through text with no thinking tags unchanged', () => {
    expect(apply('Hello, world!')).toBe('Hello, world!');
  });

  it('handles empty thinking block', () => {
    const input = '<thinking></thinking>after';
    expect(apply(input)).toBe('after');
  });

  it('handles multiline thinking block content', () => {
    const input = '<thinking>\nline1\nline2\n</thinking>\nAnswer';
    expect(apply(input)).toBe('\nAnswer');
  });
});
