import { describe, it, expect, vi } from 'vitest';
import { runPipeline } from '../pipeline/index';
import type { PipelineStep } from '../pipeline/index';

// ── Helpers ──────────────────────────────────────────────────────────

function makeStep(
  overrides: Partial<PipelineStep> & Pick<PipelineStep, 'id'>,
): PipelineStep {
  return {
    order: 1,
    enabled: true,
    predicate: () => true,
    transform: (t) => t,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('runPipeline', () => {
  it('returns input unchanged and empty stepsApplied when steps array is empty', () => {
    const result = runPipeline([], 'hello world');
    expect(result.output).toBe('hello world');
    expect(result.stepsApplied).toEqual([]);
  });

  it('returns empty string unchanged when input is empty', () => {
    const step = makeStep({
      id: 'append-x',
      transform: (t) => t + 'X',
    });
    const result = runPipeline([step], '');
    expect(result.output).toBe('X');
    expect(result.stepsApplied).toEqual(['append-x']);
  });

  it('passes empty input through if the only step does not change it', () => {
    const step = makeStep({ id: 'noop', transform: (t) => t });
    const result = runPipeline([step], '');
    expect(result.output).toBe('');
    expect(result.stepsApplied).toEqual(['noop']);
  });

  it('applies a single enabled step that transforms input', () => {
    const step = makeStep({
      id: 'uppercase',
      transform: (t) => t.toUpperCase(),
    });
    const result = runPipeline([step], 'hello');
    expect(result.output).toBe('HELLO');
    expect(result.stepsApplied).toEqual(['uppercase']);
  });

  it('skips a disabled step', () => {
    const step = makeStep({
      id: 'uppercase',
      enabled: false,
      transform: (t) => t.toUpperCase(),
    });
    const result = runPipeline([step], 'hello');
    expect(result.output).toBe('hello');
    expect(result.stepsApplied).toEqual([]);
  });

  it('skips a step whose predicate returns false', () => {
    const step = makeStep({
      id: 'uppercase',
      predicate: () => false,
      transform: (t) => t.toUpperCase(),
    });
    const result = runPipeline([step], 'hello');
    expect(result.output).toBe('hello');
    expect(result.stepsApplied).toEqual([]);
  });

  it('applies a step when predicate returns true and step is enabled', () => {
    const step = makeStep({
      id: 'trim',
      predicate: (t) => t.startsWith(' '),
      transform: (t) => t.trim(),
    });
    const result = runPipeline([step], '  hello  ');
    expect(result.output).toBe('hello');
    expect(result.stepsApplied).toEqual(['trim']);
  });

  it('records only steps that were actually applied in stepsApplied', () => {
    const steps: PipelineStep[] = [
      makeStep({ id: 'skip-me', order: 1, enabled: false, transform: (t) => t + '-A' }),
      makeStep({ id: 'run-me', order: 2, transform: (t) => t + '-B' }),
      makeStep({ id: 'pred-false', order: 3, predicate: () => false, transform: (t) => t + '-C' }),
    ];
    const result = runPipeline(steps, 'start');
    expect(result.output).toBe('start-B');
    expect(result.stepsApplied).toEqual(['run-me']);
  });

  it('runs steps in ascending order regardless of input array order', () => {
    const log: string[] = [];
    const steps: PipelineStep[] = [
      makeStep({ id: 'step-3', order: 3, transform: (t) => { log.push('3'); return t + '3'; } }),
      makeStep({ id: 'step-1', order: 1, transform: (t) => { log.push('1'); return t + '1'; } }),
      makeStep({ id: 'step-2', order: 2, transform: (t) => { log.push('2'); return t + '2'; } }),
    ];
    const result = runPipeline(steps, '');
    expect(log).toEqual(['1', '2', '3']);
    expect(result.output).toBe('123');
    expect(result.stepsApplied).toEqual(['step-1', 'step-2', 'step-3']);
  });

  it('chains steps: output of step N is input to step N+1', () => {
    const steps: PipelineStep[] = [
      makeStep({ id: 'trim', order: 1, transform: (t) => t.trim() }),
      makeStep({ id: 'upper', order: 2, transform: (t) => t.toUpperCase() }),
      makeStep({ id: 'exclaim', order: 3, transform: (t) => t + '!' }),
    ];
    const result = runPipeline(steps, '  hello  ');
    expect(result.output).toBe('HELLO!');
    expect(result.stepsApplied).toEqual(['trim', 'upper', 'exclaim']);
  });

  it('skips a step gracefully when its transform throws', () => {
    const throwing = makeStep({
      id: 'throws',
      order: 1,
      transform: () => { throw new Error('boom'); },
    });
    const safeStep = makeStep({ id: 'safe', order: 2, transform: (t) => t + '-safe' });
    const result = runPipeline([throwing, safeStep], 'input');
    // throwing step did not change text; safe step ran on the unchanged text
    expect(result.output).toBe('input-safe');
    // throwing step is NOT in stepsApplied
    expect(result.stepsApplied).toEqual(['safe']);
  });

  it('skips gracefully when predicate throws', () => {
    const badPredicate = makeStep({
      id: 'bad-pred',
      order: 1,
      predicate: () => { throw new Error('predicate boom'); },
      transform: (t) => t.toUpperCase(),
    });
    const result = runPipeline([badPredicate], 'hello');
    expect(result.output).toBe('hello');
    expect(result.stepsApplied).toEqual([]);
  });

  it('runs both steps with the same order (deterministic by array insertion order)', () => {
    const log: string[] = [];
    const steps: PipelineStep[] = [
      makeStep({ id: 'a', order: 5, transform: (t) => { log.push('a'); return t + 'a'; } }),
      makeStep({ id: 'b', order: 5, transform: (t) => { log.push('b'); return t + 'b'; } }),
    ];
    const result = runPipeline(steps, '');
    // Both must run; insertion order is preserved by stable sort
    expect(result.stepsApplied).toHaveLength(2);
    expect(result.stepsApplied).toContain('a');
    expect(result.stepsApplied).toContain('b');
    expect(result.output).toBe('ab');
  });

  it('predicate receives the current (already-transformed) text, not the original', () => {
    const firstStep = makeStep({
      id: 'prepend',
      order: 1,
      transform: (t) => 'PREFIX:' + t,
    });
    const secondStep = makeStep({
      id: 'check-prefix',
      order: 2,
      // Only runs if the current text starts with PREFIX:
      predicate: (t) => t.startsWith('PREFIX:'),
      transform: (t) => t.replace('PREFIX:', ''),
    });
    const result = runPipeline([firstStep, secondStep], 'hello');
    expect(result.output).toBe('hello');
    expect(result.stepsApplied).toEqual(['prepend', 'check-prefix']);
  });

  it('does not mutate the original steps array order', () => {
    const steps: PipelineStep[] = [
      makeStep({ id: 'z', order: 3, transform: (t) => t }),
      makeStep({ id: 'a', order: 1, transform: (t) => t }),
    ];
    const originalOrder = steps.map((s) => s.id);
    runPipeline(steps, 'x');
    expect(steps.map((s) => s.id)).toEqual(originalOrder);
  });

  it('spy is called for each enabled step', () => {
    const spy1 = vi.fn((t: string) => t);
    const spy2 = vi.fn((t: string) => t);
    const steps: PipelineStep[] = [
      makeStep({ id: 's1', order: 1, transform: spy1 }),
      makeStep({ id: 's2', order: 2, transform: spy2 }),
    ];
    runPipeline(steps, 'data');
    expect(spy1).toHaveBeenCalledOnce();
    expect(spy2).toHaveBeenCalledOnce();
  });
});
