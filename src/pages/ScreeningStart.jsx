/** Chooses the questionnaire from the child's age. An age with no questionnaire is explained, never silently re-routed. */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AGE_MAX, AGE_MIN, routeForAge } from '../data/toddler';

export default function ScreeningStart() {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('months');
  const [message, setMessage] = useState('');

  function go(e) {
    e.preventDefault();
    const r = routeForAge(value, unit);
    if (r.track) navigate(r.path); else setMessage(r.message);
  }

  return (
    <main id="screening-start" style={{ maxWidth: 720, margin: '0 auto', width: '100%' }}>
      <h1 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', letterSpacing: '-0.02em' }}>Start a screening</h1>
      <p style={{ marginTop: 12, color: 'var(--ns-n600)', lineHeight: 1.6 }}>Tell us how old the child is and we’ll open the matching questionnaire.</p>
      <form onSubmit={go} className="ns-card" style={{ marginTop: 22, padding: 24, display: 'grid', gap: 16 }} aria-label="Find the right questionnaire">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ flex: '1 1 160px' }}>
            <span className="field-label">Child’s age</span>
            <input className="field-input" inputMode="decimal" value={value} onChange={(e) => { setValue(e.target.value); setMessage(''); }} />
          </label>
          <label style={{ flex: '0 0 140px' }}>
            <span className="field-label">In</span>
            <select className="field-select" value={unit} onChange={(e) => { setUnit(e.target.value); setMessage(''); }}>
              <option value="months">months</option><option value="years">years</option>
            </select>
          </label>
          <button type="submit" className="btn btn-primary">Continue</button>
        </div>
        {message && <p role="alert" style={{ margin: 0, color: 'var(--ns-risk-high-text)' }}>{message}</p>}
      </form>
      <div style={{ display: 'grid', gap: 12, marginTop: 22, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <button type="button" className="ns-card" style={{ padding: 20, textAlign: 'left', cursor: 'pointer', display: 'block', width: '100%' }} onClick={() => navigate('/app/screening/toddler')}>
          <strong>Toddler · {AGE_MIN}–{AGE_MAX} months</strong>
          <span style={{ display: 'block', marginTop: 6, color: 'var(--ns-n600)', fontSize: '0.92rem' }}>Q-CHAT-10 parent questionnaire (ten questions)</span>
        </button>
        <button type="button" className="ns-card" style={{ padding: 20, textAlign: 'left', cursor: 'pointer', display: 'block', width: '100%' }} onClick={() => navigate('/app/screening/child')}>
          <strong>Child · 4–11 years</strong>
          <span style={{ display: 'block', marginTop: 6, color: 'var(--ns-n600)', fontSize: '0.92rem' }}>AQ-10 caregiver questionnaire</span>
        </button>
      </div>
    </main>
  );
}
