import type { PipelineStep } from './index';

/** Step 1 — Unicode Normalization (order 1) */
export const unicodeNormalizeStep: PipelineStep = {
  id: 'unicode-normalize',
  order: 1,
  enabled: true,
  predicate: () => true,
  transform(text: string): string {
    // Strip UTF-8 BOM (U+FEFF) from start
    let result = text.startsWith('\uFEFF') ? text.slice(1) : text;

    // Replace unusual Unicode whitespace with ASCII space (U+0020)
    // U+00A0 (NBSP), U+2002 (EN SPACE), U+2003 (EM SPACE), U+2009 (THIN SPACE)
    // U+200B (ZWSP), U+200C (ZWNJ), U+200D (ZWJ), U+3000 (IDEOGRAPHIC SPACE)
    result = result.replace(/[\u00A0\u2002\u2003\u2009\u200B\u200C\u200D\u3000]/g, ' ');

    // Remove Unicode control characters U+0000–U+001F, except:
    //   U+0009 (TAB), U+000A (LF), U+000D (CR)
    result = result.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

    // Normalize to NFC
    result = result.normalize('NFC');

    return result;
  },
};
