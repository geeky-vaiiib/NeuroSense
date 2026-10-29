/**
 * Two different explanations, kept apart:
 *   1. scoreExplanation  - how the questionnaire total (which decides the result) was formed, item by item.
 *   2. modelExplanation  - SHAP / LIME for the questionnaire ML model's output (a model of the scoring rule).
 * Values are displayed exactly as computed server-side; nothing is recalculated.
 */
import { useState } from 'react';

function Bars({ items, color, max }) {
  if (items.length === 0) return <p style={{ fontSize: '0.86rem', color: 'var(--ns-n500)' }}>None of the top factors pushed in this direction.</p>;
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
      {items.map((it) => (
        <li key={`${it.feature}-${it.shapValue}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 5, fontSize: '0.88rem' }}>
            <span style={{ fontWeight: 600, color: 'var(--ns-n800)' }}>{it.feature}</span>
            <span style={{ fontFamily: 'var(--font-data)', fontSize: '0.78rem', color: 'var(--ns-n600)' }}>{it.shapValue > 0 ? '+' : ''}{it.shapValue.toFixed(2)}</span>
          </div>
          <div style={{ height: 8, borderRadius: 8, background: 'var(--ns-n150)', overflow: 'hidden' }} aria-hidden="true">
            <div style={{ width: `${Math.max((Math.abs(it.shapValue) / max) * 100, 5)}%`, height: '100%', borderRadius: 8, background: color, transition: 'width 600ms ease' }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function ExplanationPanel({ features, lime, loading, error, modelUsed, category, scoreExplanation, modelExplanation }) {
  const [technical, setTechnical] = useState(false);
  const up = features.filter((f) => f.direction === 'positive');
  const down = features.filter((f) => f.direction !== 'positive');
  const max = Math.max(...features.map((f) => Math.abs(f.shapValue)), 0.01);

  return (
    <section className="ns-card" style={{ padding: 'clamp(20px, 3vw, 32px)' }} aria-labelledby="why-title">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <p className="ns-eyebrow" style={{ marginBottom: 8 }}>Explainable AI</p>
          <h2 id="why-title" style={{ fontSize: '1.35rem' }}>How the score was formed, and what the model did</h2>
        </div>
        <div role="group" aria-label="Explanation detail level" style={{ display: 'inline-flex', padding: 3, borderRadius: 10, background: 'var(--ns-n150)' }}>
          {[['Plain language', false], ['Technical view', true]].map(([label, val]) => (
            <button key={label} type="button" aria-pressed={technical === val} onClick={() => setTechnical(val)}
              style={{ padding: '6px 12px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600, color: technical === val ? 'var(--ns-n900)' : 'var(--ns-n500)', background: technical === val ? '#fff' : 'transparent', boxShadow: technical === val ? 'var(--sh-sm)' : 'none' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p role="alert" style={{ marginTop: 18, color: 'var(--ns-risk-high-text)', fontSize: '0.9rem' }}>We couldn&apos;t generate the explanation for this case. The result itself is unaffected.</p>
      ) : loading ? (
        <div style={{ marginTop: 20, display: 'grid', gap: 10 }} aria-busy="true" aria-label="Loading explanation">{[0, 1, 2, 3].map((i) => <div key={i} className="ns-skeleton" style={{ height: 26 }} />)}</div>
      ) : (
        <>
          {scoreExplanation ? (
            <div style={{ marginTop: 18 }}>
              <h3 style={{ fontSize: '1rem' }}>1 · How the questionnaire score was formed <span style={{ fontWeight: 400, color: 'var(--ns-n500)' }}>(this decides the result)</span></h3>
              <p style={{ margin: '6px 0 12px', fontSize: '0.88rem', color: 'var(--ns-n600)' }}>
                {scoreExplanation.instrument}: <strong>{scoreExplanation.total_score}/{scoreExplanation.max_score}</strong>; threshold ≥ {scoreExplanation.threshold}.
                Each item earns one point when the answer is in the scoring direction shown.
              </p>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 8 }}>
                {scoreExplanation.items.map((it) => (
                  <li key={it.id} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid var(--ns-n200)', background: it.points ? 'var(--ns-signal-dim)' : 'transparent', fontSize: '0.82rem' }}>
                    <strong>{it.id}</strong> · {it.answer} <span style={{ color: 'var(--ns-n500)' }}>(scores on {it.scores_on})</span>
                    <span style={{ float: 'right', fontFamily: 'var(--font-data)' }}>{it.points ? '+1' : '0'}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p style={{ marginTop: 18, color: 'var(--ns-n500)', fontSize: '0.88rem' }}>A per-item score explanation is not available for this case.</p>
          )}

          <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--ns-n200)' }}>
            <h3 style={{ fontSize: '1rem' }}>2 · Model explanation <span style={{ fontWeight: 400, color: 'var(--ns-n500)' }}>(SHAP and LIME — does not decide the result)</span></h3>
            {modelExplanation?.scope && <p style={{ margin: '6px 0 0', fontSize: '0.84rem', color: 'var(--ns-n600)', lineHeight: 1.6, maxWidth: '72ch' }}>{modelExplanation.scope}</p>}
            {modelExplanation?.note && <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: 'var(--ns-n500)' }}>{modelExplanation.note}</p>}
          </div>

          {modelExplanation && modelExplanation.available === false ? (
            <p role="status" style={{ marginTop: 16, color: 'var(--ns-n600)', fontSize: '0.9rem' }}>Model explanation unavailable: {modelExplanation.reason}</p>
          ) : features.length === 0 ? (
            <p style={{ marginTop: 20, color: 'var(--ns-n500)' }}>No feature contributions are available for this case.</p>
          ) : (
            <div className="ns-xai-cols">
              <div>
                <h3 style={{ fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, color: 'var(--ns-risk-high-text)' }}>
                  <span aria-hidden="true">▲</span> Factors raising the model output
                </h3>
                <Bars items={up} color="var(--ns-risk-high)" max={max} />
              </div>
              <div>
                <h3 style={{ fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, color: 'var(--ns-instrument)' }}>
                  <span aria-hidden="true">▼</span> Factors lowering the model output
                </h3>
                <Bars items={down} color="var(--ns-instrument-light)" max={max} />
              </div>
            </div>
          )}

          {technical && (
            <div style={{ marginTop: 26, paddingTop: 22, borderTop: '1px solid var(--ns-n200)', display: 'grid', gap: 20 }}>
              <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, margin: 0 }}>
                {[['Track', category], ['Model', modelUsed || '—'], ['Explains', 'ML model output (not the result)'], ['Methods', 'SHAP + LIME']].map(([k, v]) => (
                  <div key={k}><dt style={{ fontFamily: 'var(--font-data)', fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ns-n500)' }}>{k}</dt>
                    <dd style={{ margin: '4px 0 0', fontSize: '0.88rem', fontWeight: 600, color: 'var(--ns-n800)', wordBreak: 'break-word' }}>{v}</dd></div>
                ))}
              </dl>
              <div>
                <h3 style={{ fontSize: '0.9rem', marginBottom: 12 }}>LIME local explanation</h3>
                {lime?.length ? (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
                    {lime.map((it) => (
                      <li key={`${it.feature}-${it.weight}`} style={{ paddingBottom: 12, borderBottom: '1px solid var(--ns-n150)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                          <strong style={{ fontSize: '0.88rem' }}>{it.feature}</strong>
                          <span style={{ fontFamily: 'var(--font-data)', fontSize: '0.78rem', color: 'var(--ns-n600)' }}>{it.weight > 0 ? '+' : ''}{it.weight.toFixed(2)}</span>
                        </div>
                        <p style={{ marginTop: 4, fontSize: '0.85rem', color: 'var(--ns-n600)', lineHeight: 1.55, maxWidth: 'none' }}>{it.plainEnglish}</p>
                      </li>
                    ))}
                  </ul>
                ) : <p style={{ fontSize: '0.86rem', color: 'var(--ns-n500)' }}>No LIME output is available for this case.</p>}
              </div>
            </div>
          )}
        </>
      )}

      <details style={{ marginTop: 24 }}>
        <summary style={{ cursor: 'pointer', fontSize: '0.86rem', fontWeight: 600, color: 'var(--ns-instrument)' }}>How to interpret this</summary>
        <div style={{ marginTop: 10, fontSize: '0.86rem', lineHeight: 1.7, color: 'var(--ns-n600)', maxWidth: '72ch' }}>
          <p>In section 2, each bar shows how much one 0/1 item point or demographic detail moved the questionnaire ML model&apos;s output for <em>this</em> case. Bars pointing up raised the model output; bars pointing down lowered it.</p>
          <p style={{ marginTop: 8 }}>The model was trained on labels that are a threshold on the same score, so it largely restates the scoring rule; these explanations describe the model, not the child, and are not evidence of cause. They do not explain gaze, speech or facial measurements, and they do not diagnose.</p>
        </div>
      </details>
      <style>{`.ns-xai-cols{display:grid;grid-template-columns:1fr 1fr;gap:clamp(20px,4vw,48px);margin-top:26px}@media (max-width:700px){.ns-xai-cols{grid-template-columns:1fr}}`}</style>
    </section>
  );
}
