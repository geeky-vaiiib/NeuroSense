/**
 * Toddler (Q-CHAT-10) result. Renders ONLY what the server stored for the case:
 *   A. the questionnaire score and its official interpretation, B. the separate preliminary model output,
 *   C. the status of the other signals, D. the stored record, and an optional technical panel.
 * Nothing is computed here.
 */
import ModalityStatusGrid from './ModalityStatusGrid';
import { modalityStates } from '../../utils/caseModalities';

const pct = (x) => (typeof x === 'number' ? x.toFixed(2) : '—');
const ci = (v, c) => (typeof v === 'number' ? `${pct(v)}${c ? ` (95% CI ${pct(c[0])}–${pct(c[1])})` : ''}` : '—');

export default function ToddlerResults({ c, explanation, explanationLoading }) {
  const basis = c.questionnaire_basis;
  const model = c.questionnaire_model;
  const states = modalityStates(c).map((s) => (s.id !== 'questionnaire' && s.status === 'skipped'
    ? { ...s, reason: 'Not part of the toddler questionnaire.' } : s));
  if (!basis) {
    return <section className="panel" role="alert">This toddler record has no stored questionnaire score, so it cannot be displayed as a Q-CHAT-10 result.</section>;
  }
  const shap = explanation?.shap || [];
  const meExpl = explanation?.modelExplanation;
  return (
    <div style={{ display: 'grid', gap: 24 }} data-testid="toddler-results">
      <section className="ns-card" style={{ padding: 'clamp(20px, 3vw, 32px)' }} aria-labelledby="t-score">
        <p className="ns-eyebrow">A · Questionnaire score</p>
        <h2 id="t-score" style={{ fontSize: '1.3rem', marginTop: 4 }}>Q-CHAT-10 score</h2>
        <p style={{ margin: '12px 0 0', fontFamily: 'var(--font-heading)', fontSize: '2.6rem', fontWeight: 600 }} aria-label={`Score ${basis.total_score} out of ${basis.max_score}`}>
          {basis.total_score}<span style={{ fontSize: '1.2rem', color: 'var(--ns-n500)' }}> out of {basis.max_score}</span>
        </p>
        <p style={{ marginTop: 10, fontSize: '1.02rem', lineHeight: 1.7, color: 'var(--ns-n800)', maxWidth: '62ch' }}>{basis.interpretation}</p>
        <p style={{ marginTop: 8, fontSize: '0.88rem', color: 'var(--ns-n600)', lineHeight: 1.6, maxWidth: '70ch' }}>
          How it is scored: each question gives 1 point when the answer is in the direction the checklist marks as less typical. Ten questions, so the highest score is {basis.max_score}.
          The checklist’s own guidance is that a score of {basis.threshold} or above may lead a health professional to consider a fuller assessment. ({basis.threshold_source}.)
          This score is a screening result. It is not a diagnosis.
        </p>
        <h3 style={{ fontSize: '1rem', marginTop: 22 }}>Your answers</h3>
        <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'grid', gap: 8 }}>
          {basis.items.map((it) => (
            <li key={it.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--ns-n200)', background: it.points ? 'var(--ns-signal-dim)' : 'transparent', fontSize: '0.92rem' }}>
              <span><span style={{ color: 'var(--ns-n500)' }}>{it.id.slice(1)}. </span>{it.question}<br /><strong>{it.answer_label}</strong></span>
              <span style={{ fontFamily: 'var(--font-data)', whiteSpace: 'nowrap' }} aria-label={it.points ? 'scored 1 point' : 'scored 0 points'}>{it.points ? '+1' : '0'}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="ns-card" style={{ padding: 'clamp(20px, 3vw, 32px)' }} aria-labelledby="t-model">
        <p className="ns-eyebrow">B · Research model output (separate from the score)</p>
        <h2 id="t-model" style={{ fontSize: '1.3rem', marginTop: 4 }}>{model?.available ? 'Preliminary model result' : 'Model result unavailable'}</h2>
        {model?.available ? (
          <>
            <p style={{ marginTop: 10, fontSize: '1.02rem', lineHeight: 1.7, maxWidth: '62ch' }}>
              {model.above_threshold
                ? 'These answers look more like the answers of the autism group in the research data than like the comparison group.'
                : 'These answers look more like the answers of the comparison group in the research data than like the autism group.'}
            </p>
            <p style={{ marginTop: 6, fontSize: '0.92rem', color: 'var(--ns-n700)' }}>
              Similarity value: <strong style={{ fontFamily: 'var(--font-data)' }}>{pct(model.value)}</strong> (the model’s cut-off is {pct(model.decision_threshold)}).
              This is <strong>not</strong> the chance that your child has autism.
            </p>
            <p style={{ marginTop: 10 }}><span style={{ padding: '4px 10px', borderRadius: 999, background: 'var(--ns-n150)', fontSize: '0.8rem', fontWeight: 600 }}>Experimental · not clinically validated</span></p>
            <p style={{ marginTop: 10, fontSize: '0.88rem', color: 'var(--ns-n600)', lineHeight: 1.6, maxWidth: '70ch' }}>
              This model was trained on one study of Polish toddlers. Good results in that study do not show that it works for other children. It does not change the questionnaire score above.
            </p>
            <details style={{ marginTop: 14 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--ns-instrument)' }}>Technical details</summary>
              <div style={{ marginTop: 10, fontSize: '0.86rem', lineHeight: 1.7, color: 'var(--ns-n700)' }}>
                <p>Model: {model.model_version} ({model.algorithm}, inputs: {model.config}).</p>
                <p>Held-out test (n={model.evaluation.holdout_n}): AUC {ci(model.evaluation.holdout_auc, model.evaluation.holdout_auc_ci95)}; sensitivity {ci(model.evaluation.holdout_sensitivity, model.evaluation.holdout_sensitivity_ci95)}; specificity {ci(model.evaluation.holdout_specificity, model.evaluation.holdout_specificity_ci95)}. The official Q-CHAT-10 points scored AUC {pct(model.evaluation.official_rule_holdout_auc)} on the same children, so the model is not shown to be better than the checklist.</p>
                <ul style={{ paddingLeft: 18 }}>{model.caveats.map((t) => <li key={t}>{t}</li>)}</ul>
                <p>Data: {model.dataset}</p>
              </div>
            </details>
          </>
        ) : (
          <p role="status" style={{ marginTop: 10, lineHeight: 1.7, maxWidth: '62ch' }}>
            The research model could not produce a result for this screening{model?.reason ? ` (${model.reason})` : ''}. The questionnaire score above is unaffected.
          </p>
        )}
      </section>

      <section aria-labelledby="t-signals">
        <p className="ns-eyebrow">C · Other signals</p>
        <h2 id="t-signals" style={{ fontSize: '1.15rem', marginBottom: 6 }}>Signals and their status</h2>
        <p style={{ margin: '0 0 14px', color: 'var(--ns-n600)', fontSize: '0.88rem', maxWidth: '70ch' }}>
          The toddler questionnaire does not include eye-gaze, speech or face recordings. Those tools are still experimental, are not validated for toddlers, and never change this result.
        </p>
        <ModalityStatusGrid states={states} />
      </section>

      <section className="ns-card" style={{ padding: 24 }} aria-labelledby="t-stored">
        <p className="ns-eyebrow">D · Saved record</p>
        <h2 id="t-stored" style={{ fontSize: '1.1rem', marginTop: 4 }}>What was saved</h2>
        <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, margin: '14px 0 0' }}>
          {[['Case ID', c.id], ['Child’s age', `${c.age_months} months`], ['Saved on', (c.screeningDate || c.created_at || '').slice(0, 10) || 'Not recorded'], ['Scored by', 'the server (version ' + c.scoring_version + ')']].map(([k, v]) => (
            <div key={k}><dt style={{ fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ns-n500)' }}>{k}</dt><dd style={{ margin: '4px 0 0', fontWeight: 600 }}>{v}</dd></div>
          ))}
        </dl>
        <p style={{ marginTop: 14, fontSize: '0.88rem', color: 'var(--ns-n600)' }}>You can reopen this result any time from the Cases page.</p>
      </section>

      <section className="ns-card" style={{ padding: 24 }} aria-labelledby="t-why">
        <h2 id="t-why" style={{ fontSize: '1.1rem' }}>Which answers moved the model (optional)</h2>
        {explanationLoading ? <p aria-busy="true">Loading…</p>
          : meExpl && meExpl.available === false ? <p role="status" style={{ marginTop: 8, color: 'var(--ns-n600)' }}>Model explanation unavailable: {meExpl.reason}</p>
          : shap.length === 0 ? <p style={{ marginTop: 8, color: 'var(--ns-n600)' }}>No model explanation is available for this case.</p>
          : (
            <>
              <p style={{ marginTop: 8, fontSize: '0.88rem', color: 'var(--ns-n600)', maxWidth: '70ch' }}>{meExpl?.note} Values are in log-odds of the model output; they describe the model, not your child.</p>
              <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'grid', gap: 6 }}>
                {[...shap].sort((a, b) => Math.abs(b.shapValue) - Math.abs(a.shapValue)).map((f) => (
                  <li key={f.feature} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span>{f.feature}</span><span style={{ fontFamily: 'var(--font-data)' }}>{f.shapValue > 0 ? '+' : ''}{f.shapValue.toFixed(2)} {f.shapValue > 0 ? '▲ raised' : '▼ lowered'}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
      </section>
    </div>
  );
}
