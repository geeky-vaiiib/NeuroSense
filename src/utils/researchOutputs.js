export const isResearchClassification = (output) => ['facial_expression', 'speech_emotion'].includes(output?.kind);
export function researchClassScores(output) {
  if (!isResearchClassification(output) || !output.class_scores || typeof output.class_scores !== 'object') return [];
  return Object.entries(output.class_scores).map(([label, value]) => ({ label,
    text: typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? `${(value * 100).toFixed(1)}%` : 'Unavailable' }));
}
