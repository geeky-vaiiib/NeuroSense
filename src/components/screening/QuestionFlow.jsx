/**
 * One question at a time: large text, radio-group answers (arrow keys work), auto-advance,
 * and a dot rail showing answered / current / unanswered. State stays in the parent (`answers`).
 */
import { useEffect, useRef, useState } from 'react';

export default function QuestionFlow({ questions, answers, onAnswer, options }) {
  const firstOpen = questions.findIndex((q) => !answers[q.id]);
  const [index, setIndex] = useState(firstOpen === -1 ? 0 : firstOpen);
  const headingRef = useRef(null);
  const advanceTimer = useRef(null);
  const q = questions[index];
  const answered = questions.filter((x) => answers[x.id]).length;

  useEffect(() => () => clearTimeout(advanceTimer.current), []);
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, [index]);

  const choose = (opt) => {
    onAnswer(q.id, opt);
    clearTimeout(advanceTimer.current);
    if (index < questions.length - 1) advanceTimer.current = setTimeout(() => setIndex((i) => Math.min(i + 1, questions.length - 1)), 320);
  };

  const onKey = (e, i) => {
    if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(e.key)) return;
    e.preventDefault();
    const next = (i + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length;
    e.currentTarget.parentElement.children[next].focus();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <span style={{ fontFamily: 'var(--font-data)', fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ns-n500)' }}>
          Question {index + 1} of {questions.length}
        </span>
        <span style={{ fontSize: '0.78rem', color: 'var(--ns-n500)' }}>{answered} answered</span>
      </div>
      <div role="progressbar" aria-label="Questions answered" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={answered}
        style={{ display: 'flex', gap: 4, marginBottom: 28 }}>
        {questions.map((x, i) => (
          <button
            key={x.id} type="button" onClick={() => setIndex(i)} aria-label={`Go to question ${i + 1}${answers[x.id] ? ' (answered)' : ''}`} aria-current={i === index ? 'step' : undefined}
            style={{
              flex: 1, height: 6, borderRadius: 6, transition: 'background var(--ease-base)',
              background: answers[x.id] ? 'var(--ns-instrument)' : 'var(--ns-n200)',
              outline: i === index ? '2px solid var(--ns-instrument-light)' : 'none', outlineOffset: 2,
            }}
          />
        ))}
      </div>

      <div key={q.id} className="ns-reveal" style={{ animationDuration: '320ms' }}>
        <h2 ref={headingRef} tabIndex={-1} id={`q-${q.id}`} style={{ fontSize: 'clamp(1.25rem, 2.6vw, 1.7rem)', lineHeight: 1.3, letterSpacing: '-0.02em', outline: 'none', maxWidth: '34ch' }}>
          {q.prompt}
        </h2>
        <div role="radiogroup" aria-labelledby={`q-${q.id}`} style={{ display: 'grid', gap: 10, marginTop: 26 }}>
          {options.map((opt, i) => {
            const active = answers[q.id] === opt;
            return (
              <button
                key={opt} type="button" role="radio" aria-checked={active}
                tabIndex={active || (!answers[q.id] && i === 0) ? 0 : -1}
                onClick={() => choose(opt)} onKeyDown={(e) => onKey(e, i)}
                className="ns-choice" data-active={active}
              >
                <span className="ns-choice__dot" aria-hidden="true" />
                <span>{opt}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 26 }}>
        <button type="button" className="btn btn-ghost btn-sm" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>← Previous</button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={index === questions.length - 1} onClick={() => setIndex((i) => i + 1)}>Next →</button>
      </div>

      <style>{`
        .ns-choice{display:flex;align-items:center;gap:14px;width:100%;text-align:left;padding:15px 18px;border-radius:14px;border:1.5px solid var(--ns-n200);background:#fff;font-size:1rem;font-weight:500;color:var(--ns-n800);transition:border-color .15s,background .15s,box-shadow .15s,transform .15s}
        .ns-choice:hover{border-color:var(--ns-n400);box-shadow:var(--sh-sm)}
        .ns-choice:active{transform:scale(.995)}
        .ns-choice__dot{width:20px;height:20px;border-radius:50%;border:2px solid var(--ns-n300);flex-shrink:0;display:grid;place-items:center;transition:all .15s}
        .ns-choice[data-active=true]{border-color:var(--ns-instrument);background:var(--ns-instrument-dim);color:var(--ns-n900);font-weight:600}
        .ns-choice[data-active=true] .ns-choice__dot{border-color:var(--ns-instrument);background:var(--ns-instrument);box-shadow:inset 0 0 0 4px #fff}
      `}</style>
    </div>
  );
}
