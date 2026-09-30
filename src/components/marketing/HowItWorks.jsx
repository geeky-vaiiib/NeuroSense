/**
 * "How it works": five stages, each with its own visual language, joined by animated connectors,
 * ending in the Screening Insight. Explanatory only (no data).
 */
import useReducedMotion from '../ui/useReducedMotion';

const Q = '#6366F1', G = '#0891B2', S = '#0D9488', F = '#0B7A85';

function Frame({ children }) {
  return <svg viewBox="0 0 132 84" width="100%" height="84" aria-hidden="true" style={{ overflow: 'visible' }}>{children}</svg>;
}

function QuestionnaireVisual({ anim }) {
  return (
    <Frame>
      {[14, 34, 54].map((y, i) => (
        <g key={y}>
          <circle cx="16" cy={y} r="5" fill="none" stroke={Q} strokeWidth="1.6" opacity={i === 1 ? 1 : 0.45} />
          {i === 1 && <circle cx="16" cy={y} r="2.4" fill={Q} />}
          <rect x="30" y={y - 3} width={[70, 54, 62][i]} height="6" rx="3" fill={Q} opacity={i === 1 ? 0.5 : 0.18} />
        </g>
      ))}
      <path d="M104 72l6 6 12-14" fill="none" stroke={Q} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="30" strokeDashoffset={anim ? undefined : 0} style={anim ? { animation: 'ns-draw 2.6s ease-in-out infinite' } : undefined} />
    </Frame>
  );
}
function GazeVisual({ anim }) {
  const path = 'M18 58 L44 30 L70 50 L96 24 L112 44';
  return (
    <Frame>
      <path d="M6 42C24 12 108 12 126 42C108 72 24 72 6 42Z" fill="none" stroke={G} strokeWidth="1.6" opacity="0.5" />
      <circle cx="66" cy="42" r="14" fill="none" stroke={G} strokeWidth="1.4" opacity="0.5" />
      <path d={path} fill="none" stroke={G} strokeWidth="1.6" strokeDasharray="3 5" opacity="0.85" className={anim ? 'ns-signal-path' : undefined} />
      {[[18, 58], [44, 30], [70, 50], [96, 24], [112, 44]].map(([x, y], i) => (<circle key={i} cx={x} cy={y} r="3" fill={G} opacity={0.4 + i * 0.12} />))}
      <circle r="4.4" fill={G}>{anim && <animateMotion dur="5s" repeatCount="indefinite" path={path} />}</circle>
    </Frame>
  );
}
function SpeechVisual({ anim }) {
  const hs = [10, 22, 34, 26, 44, 30, 40, 20, 32, 14, 24, 12];
  return (
    <Frame>
      {hs.map((h, i) => (
        <rect key={i} x={6 + i * 10.4} y={42 - h / 2} width="5" height={h} rx="2.5" fill={S} opacity={0.35 + (h / 44) * 0.65}
          style={anim ? { transformBox: 'fill-box', transformOrigin: 'center', animation: `ns-bar ${1.2 + (i % 5) * 0.2}s ease-in-out ${i * 0.08}s infinite` } : undefined} />
      ))}
    </Frame>
  );
}
function FusionVisual({ anim }) {
  const src = [[10, 14], [10, 42], [10, 70], [34, 28], [34, 56]];
  return (
    <Frame>
      {src.map(([x, y], i) => (<path key={i} d={`M${x} ${y} C 60 ${y}, 70 42, 96 42`} fill="none" stroke={F} strokeWidth="1.3" opacity="0.6" className={anim ? 'ns-signal-path' : undefined} />))}
      {src.map(([x, y], i) => (<circle key={i} cx={x} cy={y} r="3.2" fill={F} opacity="0.55" />))}
      <circle cx="106" cy="42" r="15" fill="none" stroke={F} strokeWidth="1.5" />
      <circle cx="106" cy="42" r="6" fill={F} className={anim ? 'ns-node-pulse' : undefined} />
    </Frame>
  );
}

const STAGES = [
  { id: 'questionnaire', n: '01', title: 'Questionnaire', text: 'A structured AQ-10 / Q-CHAT-10 questionnaire scored by a trained model.', color: Q, Visual: QuestionnaireVisual },
  { id: 'gaze', n: '02', title: 'Gaze', text: 'Calibrated webcam gaze paths and fixations while viewing a short picture task.', color: G, Visual: GazeVisual },
  { id: 'speech', n: '03', title: 'Speech', text: 'A short voice sample analysed for prosody and acoustic patterns.', color: S, Visual: SpeechVisual },
  { id: 'fusion', n: '04', title: 'AI fusion', text: 'Signals that pass quality checks are combined; unavailable ones are never guessed.', color: F, Visual: FusionVisual },
];

export default function HowItWorks() {
  const reduced = useReducedMotion();
  return (
    <div>
      <ol className="ns-hiw" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {STAGES.map((s, i) => (
          <li key={s.id} className="ns-hiw__item">
            <div className="ns-card ns-card--interactive ns-hiw__card" style={{ '--stage': s.color }}>
              <div className="ns-hiw__top">
                <span style={{ fontFamily: 'var(--font-data)', fontSize: '0.7rem', letterSpacing: '0.14em', color: s.color, fontWeight: 600 }}>{s.n}</span>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} aria-hidden="true" />
              </div>
              <div style={{ padding: '6px 0 2px' }}><s.Visual anim={!reduced} /></div>
              <h3 style={{ fontSize: '1rem', margin: '10px 0 6px' }}>{s.title}</h3>
              <p style={{ fontSize: '0.85rem', lineHeight: 1.55, color: 'var(--ns-n600)' }}>{s.text}</p>
            </div>
            {i < STAGES.length - 1 && (
              <svg className="ns-hiw__link" viewBox="0 0 40 12" aria-hidden="true">
                <path d="M0 6H38" stroke={s.color} strokeWidth="1.6" strokeDasharray="4 6" className={reduced ? undefined : 'ns-signal-path'} />
                <path d="M33 1l6 5-6 5" fill="none" stroke={s.color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </li>
        ))}
      </ol>

      <div className="ns-hiw__insight ns-dark">
        <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="rgba(34,211,238,0.1)" stroke="#22D3EE" strokeOpacity=".7" /><path d="M11 20h16M21 13l7 7-7 7" fill="none" stroke="#22D3EE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <div>
          <p className="ns-eyebrow ns-eyebrow--dark" style={{ marginBottom: 4 }}>Screening insight</p>
          <p style={{ fontSize: '0.95rem', color: '#C9D5E8', maxWidth: 'none' }}>
            One overall indicator, the contribution and data quality of every signal, and a plain-language explanation of what drove it — for a clinician to review.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes ns-draw{0%{stroke-dashoffset:30}45%,100%{stroke-dashoffset:0}}
        @keyframes ns-scanline{from{stroke-dashoffset:0}to{stroke-dashoffset:-210}}
        .ns-scanline{animation:ns-scanline 3.4s linear infinite}
        .ns-hiw{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0 0}
        .ns-hiw__item{position:relative;display:flex;padding:0 10px}
        .ns-hiw__card{padding:16px 16px 18px;width:100%;border-top:2px solid var(--stage)}
        .ns-hiw__top{display:flex;justify-content:space-between;align-items:center}
        .ns-hiw__link{position:absolute;right:-16px;top:52px;width:32px;height:10px;z-index:2}
        .ns-hiw__insight{margin-top:22px;border-radius:16px;padding:20px 22px;display:flex;gap:16px;align-items:center;border:1px solid rgba(148,163,184,.18)}
        @media (max-width:1100px){.ns-hiw{grid-template-columns:repeat(2,minmax(0,1fr));gap:18px 0}.ns-hiw__link{display:none}}
        @media (max-width:620px){.ns-hiw{grid-template-columns:1fr}.ns-hiw__item{padding:0}}
      `}</style>
    </div>
  );
}
