// llm-output-normalizer — Pipeline runner

export interface PipelineStep {
  /** Unique kebab-case step ID (e.g. 'unicode-normalize'). */
  id: string;
  /** Determines execution sequence — lower numbers run first. */
  order: number;
  /** When false the step is skipped entirely. */
  enabled: boolean;
  /** Fast check — if this returns false the step is skipped. */
  predicate: (text: string) => boolean;
  /** The actual transformation to apply to the text. */
  transform: (text: string) => string;
}

export interface PipelineRunResult {
  /** The text after all enabled, applicable steps have run. */
  output: string;
  /** IDs of every step that was actually applied, in execution order. */
  stepsApplied: string[];
}

/**
 * Run a sequence of pipeline steps on the given input text.
 *
 * Steps are sorted by their `order` field (ascending) before execution.
 * For each step:
 *   - If `enabled` is false, skip.
 *   - If `predicate(currentText)` returns false, skip.
 *   - Otherwise apply `transform`. If the transform throws, skip gracefully
 *     (the step is not added to stepsApplied, and the text remains unchanged).
 */
export function runPipeline(steps: PipelineStep[], input: string): PipelineRunResult {
  const sorted = [...steps].sort((a, b) => a.order - b.order);

  let current = input;
  const stepsApplied: string[] = [];

  for (const step of sorted) {
    if (!step.enabled) {
      continue;
    }

    let predicateResult: boolean;
    try {
      predicateResult = step.predicate(current);
    } catch {
      // If the predicate itself throws, skip the step gracefully.
      continue;
    }

    if (!predicateResult) {
      continue;
    }

    try {
      const transformed = step.transform(current);
      current = transformed;
      stepsApplied.push(step.id);
    } catch {
      // Step threw — skip gracefully, keep current text unchanged.
    }
  }

  return { output: current, stepsApplied };
}
