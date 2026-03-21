import { describe, it, expectTypeOf } from 'vitest';
import type {
  NormalizeResult,
  CodeBlock,
  DetectResult,
  NormalizeMeta,
} from '../types';

describe('NormalizeResult structure', () => {
  it('has output text field of type string', () => {
    expectTypeOf<NormalizeResult['text']>().toEqualTypeOf<string>();
  });

  it('has meta field of type NormalizeMeta', () => {
    expectTypeOf<NormalizeResult['meta']>().toEqualTypeOf<NormalizeMeta>();
  });

  it('has optional json field', () => {
    expectTypeOf<NormalizeResult['json']>().toEqualTypeOf<unknown>();
  });

  it('has optional code field of type CodeBlock or undefined', () => {
    expectTypeOf<NormalizeResult['code']>().toEqualTypeOf<CodeBlock | undefined>();
  });

  it('has type discriminator field', () => {
    expectTypeOf<NormalizeResult['type']>().toEqualTypeOf<
      'json' | 'code' | 'text' | 'markdown'
    >();
  });

  it('has confidence field of type number', () => {
    expectTypeOf<NormalizeResult['confidence']>().toEqualTypeOf<number>();
  });
});

describe('CodeBlock structure', () => {
  it('has code field of type string', () => {
    expectTypeOf<CodeBlock['code']>().toEqualTypeOf<string>();
  });

  it('has optional language field', () => {
    expectTypeOf<CodeBlock['language']>().toEqualTypeOf<string | undefined>();
  });

  it('has optional index field', () => {
    expectTypeOf<CodeBlock['index']>().toEqualTypeOf<number | undefined>();
  });
});

describe('DetectResult structure', () => {
  it('has type field with correct union', () => {
    expectTypeOf<DetectResult['type']>().toEqualTypeOf<
      'json' | 'code' | 'text' | 'markdown'
    >();
  });

  it('has confidence field of type number', () => {
    expectTypeOf<DetectResult['confidence']>().toEqualTypeOf<number>();
  });

  it('has hasPreamble boolean field', () => {
    expectTypeOf<DetectResult['hasPreamble']>().toEqualTypeOf<boolean>();
  });

  it('has hasPostamble boolean field', () => {
    expectTypeOf<DetectResult['hasPostamble']>().toEqualTypeOf<boolean>();
  });

  it('has hasFences boolean field', () => {
    expectTypeOf<DetectResult['hasFences']>().toEqualTypeOf<boolean>();
  });
});

describe('NormalizeMeta structure', () => {
  it('has stepsApplied array of strings', () => {
    expectTypeOf<NormalizeMeta['stepsApplied']>().toEqualTypeOf<string[]>();
  });

  it('has errors array of strings', () => {
    expectTypeOf<NormalizeMeta['errors']>().toEqualTypeOf<string[]>();
  });

  it('has preambleRemoved boolean', () => {
    expectTypeOf<NormalizeMeta['preambleRemoved']>().toEqualTypeOf<boolean>();
  });

  it('has postambleRemoved boolean', () => {
    expectTypeOf<NormalizeMeta['postambleRemoved']>().toEqualTypeOf<boolean>();
  });

  it('has durationMs number', () => {
    expectTypeOf<NormalizeMeta['durationMs']>().toEqualTypeOf<number>();
  });
});
