/**
 * Modality states for a case, exactly as the backend stored them (never recomputed in the browser).
 * Cases recorded before server-side scoring (scoring_version missing) have no stored states: they get a clearly
 * marked "legacy" view built only from their stored fields.
 */
export const isServerScored = (c) => Boolean(c?.scoring_version);

export function modalityStates(c) {
  if (!c) return [];
  if (Array.isArray(c.modality_states) && c.modality_states.length) return c.modality_states;
  const comps = c.modality_breakdown || [];
  const legacy = (id, label) => {
    const comp = comps.find((x) => x.modality === id);
    const has = Boolean(comp?.available);
    return {
      id, label, legacy: true, status: has ? 'legacy_recorded' : 'not_provided',
      status_label: has ? 'Recorded before status contract' : 'Not recorded',
      in_result: false, eligible_for_result: false,
      output: has && typeof comp.score === 'number' ? { kind: 'legacy_stored_value', value: comp.score } : null,
      reason: has ? 'Older record: this value was stored by an earlier version and is shown as recorded.' : null,
    };
  };
  return [legacy('questionnaire', 'Questionnaire'), legacy('gaze', 'Eye gaze'), legacy('speech', 'Speech'), legacy('facial', 'Facial')];
}

export const outputPct = (state) => (typeof state?.output?.value === 'number' ? `${Math.round(state.output.value * 100)}%` : null);
