import type { PipelineStep } from './index';

/** Detects the presence of XML artifact wrapper tags. */
const XML_ARTIFACT_PREDICATE = /<antArtifact|<artifact\b/i;

/**
 * Strips outer <antArtifact ...>content</antArtifact> wrappers, keeping only
 * the inner content. Also handles plain <artifact>...</artifact>.
 */
function unwrapArtifacts(text: string): string {
  // antArtifact with optional attributes
  let result = text.replace(/<antArtifact[^>]*>([\s\S]*?)<\/antArtifact>/gi, '$1');
  // plain artifact tag
  result = result.replace(/<artifact[^>]*>([\s\S]*?)<\/artifact>/gi, '$1');
  return result;
}

/** Step 3 — XML Artifact Unwrap (order 3) */
export const xmlArtifactUnwrapStep: PipelineStep = {
  id: 'xml-artifact-unwrap',
  order: 3,
  enabled: true,
  predicate(text: string): boolean {
    return XML_ARTIFACT_PREDICATE.test(text);
  },
  transform(text: string): string {
    return unwrapArtifacts(text);
  },
};
