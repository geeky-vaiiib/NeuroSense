/**
 * Q-CHAT-10, one question per screen. Wording and option labels come from the canonical config
 * (src/data/qchat10.config.json, generated from backend/ml/qchat10.py); the answer sent to the server is the option LETTER.
 * No auto-advance: the caregiver moves on with Next, can go Back, and is told plainly if an answer is missing.
 */
import { useEffect, useRef, useState } from 'react';

export default function ToddlerQuestionFlow({ items, answers, onAnswer, onFinish, onExit, startAt }) {
  const first = items.findIndex((q) => !answers[q.id]);
  const [index, setIndex] = useState(startAt ?? (first === -1 ? 0 : first));
  const [missing, setMissing] = useState(false);
  const headingRef = useRef(null);
  const q = items[index];
  const answered = items.filter((x) => answers[x.id]).length;
  const last = index === items.length - 1;

  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, [index]);

  const next = () => {
    if (!answers[q.id]) { setMissing(true); return; }
    setMissing(false);
    if (last) onFinish(); else setIndex(index + 1);
  };
  const back = () => { setMissing(false); if (index === 0) onExit(); else setIndex(index - 1); };
  const choose = (value) => { setMissing(false); onAnswer(q.id, value); };
  const onKey = (e, i) => {
    if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(e.key)) return;
    e.preventDefault();
    const n = (i + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1) + q.options.length) % q.options.length;
    const el = e.currentTarget.parentElement.children[n];
    el.focus(); choose(q.options[n].value);
  };

  return (
    <div>
      <p style={{ fontSize: '0.95rem', color: 'var(--ns-n700)', fontWeight: 600, marginBottom: 10 }} aria-live="polite">
        Question {index + 1} of {items.length}
      </p>
      <div role="progressbar" aria-label="Questions answered" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={answered}
        aria-valuetext={`${answered} of ${items.length} answered`} style={{ display: 'flex', gap: 4, marginBottom: 28 }}>
        {items.map((x, i) => (
          <span key={x.id} aria-hidden="true" style={{ flex: 1, height: 6, borderRadius: 6, background: answers[x.id] ? 'var(--ns-instrument)' : 'var(--ns-n200)', outline: i === index ? '2px solid var(--ns-instrument-light)' : 'none', outlineOffset: 2 }} />
        ))}
      </div>

      <h2 ref={headingRef} tabIndex={-1} id={`tq-${q.id}`} style={{ fontSize: 'clamp(1.3rem, 2.8vw, 1.75rem)', lineHeight: 1.35, letterSpacing: '-0.01em', outline: 'none', maxWidth: '36ch' }}>
        {q.text}
      </h2>
      {q.helper && <p id={`tqh-${q.id}`} style={{ margin: '10px 0 0', fontSize: '1rem', lineHeight: 1.6, color: 'var(--ns-n600)', maxWidth: '52ch' }}>{q.helper}</p>}

      <div role="radiogroup" aria-labelledby={`tq-${q.id}`} aria-describedby={q.helper ? `tqh-${q.id}` : undefined} aria-required="true" style={{ display: 'grid', gap: 12, marginTop: 24 }}>
        {q.options.map((opt, i) => {
          const active = answers[q.id] === opt.value;
          return (
            <button key={opt.value} type="button" role="radio" aria-checked={active}
              tabIndex={active || (!answers[q.id] && i === 0) ? 0 : -1}
              onClick={() => choose(opt.value)} onKeyDown={(e) => onKey(e, i)} className="tq-choice" data-active={active}>
              <span className="tq-choice__dot" aria-hidden="true" />
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>

      {missing && <p role="alert" style={{ marginTop: 16, color: 'var(--ns-risk-high-text)', fontSize: '0.95rem' }}>Please choose the answer that fits best before moving on. You can go back and change any answer later.</p>}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 28 }}>
        <button type="button" className="btn btn-secondary" onClick={back}>← Back</button>
        <button type="button" className="btn btn-primary" onClick={next}>{last ? 'Review answers' : 'Next →'}</button>
      </div>

      <style>{`
        .tq-choice{display:flex;align-items:center;gap:14px;width:100%;min-height:56px;text-align:left;padding:14px 18px;border-radius:14px;border:1.5px solid var(--ns-n200);background:#fff;font-size:1.05rem;font-weight:500;color:var(--ns-n800);cursor:pointer}
        .tq-choice:hover{border-color:var(--ns-n400)}
        .tq-choice:focus-visible{outline:3px solid var(--ns-instrument-light);outline-offset:2px}
        .tq-choice__dot{width:22px;height:22px;border-radius:50%;border:2px solid var(--ns-n300);flex-shrink:0}
        .tq-choice[data-active=true]{border-color:var(--ns-instrument);background:var(--ns-instrument-dim);color:var(--ns-n900);font-weight:600}
        .tq-choice[data-active=true] .tq-choice__dot{border-color:var(--ns-instrument);background:var(--ns-instrument);box-shadow:inset 0 0 0 4px #fff}
      `}</style>
    </div>
  );
}
