/**
 * NeuroSense signature visual: four signal streams (questionnaire, gaze, speech, behaviour)
 * flowing into one fusion node and out as a screening insight.
 *
 * Decorative / explanatory only: it carries no data. Real per-case data lives in
 * results/FusionVisualization. `highlight` dims the other streams (hover/focus interaction).
 */
import { useState } from 'react';
import useReducedMotion from './useReducedMotion';

const STREAMS = [
  { id: 'questionnaire', label: 'QUESTIONNAIRE', sub: 'structured responses', y: 130, color: '#A5B4FC' },
  { id: 'gaze', label: 'GAZE', sub: 'attention paths', y: 290, color: '#22D3EE' },
  { id: 'speech', label: 'SPEECH', sub: 'voice patterns', y: 450, color: '#5EEAD4' },
];
const HUB = { x: 418, y: 290 };
const OUT = { x: 664, y: 290 };

function Glyph({ id, color, animate }) {
  const c = { stroke: color, strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' };
  if (id === 'questionnaire') {
    return (
      <g>
        <line x1="0" y1="-10" x2="26" y2="-10" {...c} opacity="0.9" />
        <line x1="0" y1="0" x2="20" y2="0" {...c} opacity="0.55" />
        <line x1="0" y1="10" x2="24" y2="10" {...c} opacity="0.55" />
        <path d="M30 -13l3 3 6-7" {...c} />
      </g>
    );
  }
  if (id === 'gaze') {
    return (
      <g>
        <path d="M0 0C8-11 32-11 40 0C32 11 8 11 0 0Z" {...c} />
        <circle cx="20" cy="0" r="4" fill={color} />
        <path d="M4 12L14 6L22 12L34 4" {...c} opacity="0.55" strokeDasharray="2 3" />
      </g>
    );
  }
  if (id === 'speech') {
    const hs = [6, 14, 22, 12, 20, 9, 16];
    return (
      <g>
        {hs.map((h, i) => (
          <rect
            key={i} x={i * 6} y={-h / 2} width="3" height={h} rx="1.5" fill={color}
            style={animate ? { transformBox: 'fill-box', transformOrigin: 'center', animation: `ns-bar ${1.1 + (i % 4) * 0.22}s ease-in-out ${i * 0.09}s infinite` } : undefined}
          />
        ))}
      </g>
    );
  }
  return (
    <g>
      <polyline points="0,8 8,-2 15,5 23,-10 31,0 40,-6" {...c} />
      <circle cx="23" cy="-10" r="2.2" fill={color} />
    </g>
  );
}

export default function SignalVisualization({ highlight: controlled, onHighlight, interactive = true, style }) {
  const reduced = useReducedMotion();
  const [local, setLocal] = useState(null);
  const highlight = controlled !== undefined ? controlled : local;
  const set = (id) => { setLocal(id); onHighlight?.(id); };
  const dim = (id) => (highlight && highlight !== id ? 0.22 : 1);
  const paths = STREAMS.map((s) => `M176 ${s.y} C 300 ${s.y}, 300 ${HUB.y}, ${HUB.x - 62} ${HUB.y}`);

  return (
    <div style={{ width: '100%', ...style }}>
      <svg viewBox="0 0 720 580" role="img" aria-label="Diagram: questionnaire, gaze and speech signals flow into a fusion node that produces a screening insight." style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
        <defs>
          <radialGradient id="svHub" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#22D3EE" stopOpacity="0.35" />
            <stop offset="1" stopColor="#22D3EE" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="svOut" x1="0" x2="1">
            <stop offset="0" stopColor="#22D3EE" stopOpacity="0.9" />
            <stop offset="1" stopColor="#5EEAD4" stopOpacity="0.9" />
          </linearGradient>
        </defs>

        <circle cx={HUB.x} cy={HUB.y} r="150" fill="url(#svHub)" />
        <circle cx={HUB.x} cy={HUB.y} r="84" stroke="rgba(148,163,184,0.22)" strokeWidth="1" fill="none" />
        <circle
          cx={HUB.x} cy={HUB.y} r="72" stroke="rgba(34,211,238,0.55)" strokeWidth="1.2" fill="none" strokeDasharray="3 9"
          style={reduced ? undefined : { transformOrigin: `${HUB.x}px ${HUB.y}px`, animation: 'ns-rotate 40s linear infinite' }}
        />

        {STREAMS.map((s, i) => (
          <g key={s.id} opacity={dim(s.id)} style={{ transition: 'opacity 240ms ease' }}>
            <path d={paths[i]} stroke={s.color} strokeOpacity="0.28" strokeWidth="1.2" fill="none" />
            <path d={paths[i]} stroke={s.color} strokeWidth="1.6" fill="none" className={reduced ? undefined : 'ns-signal-path'} strokeLinecap="round" style={{ animationDelay: `${i * 0.25}s` }} />
            {!reduced && (
              <circle r="3.4" fill={s.color}>
                <animateMotion dur={`${4.2 + i * 0.5}s`} begin="0s" repeatCount="indefinite" path={paths[i]} />
              </circle>
            )}
          </g>
        ))}

        {STREAMS.map((s) => (
          <g
            key={s.id} transform={`translate(24 ${s.y - 34})`} opacity={dim(s.id)} style={{ transition: 'opacity 240ms ease' }}
            onMouseEnter={interactive ? () => set(s.id) : undefined} onMouseLeave={interactive ? () => set(null) : undefined}
            onFocus={interactive ? () => set(s.id) : undefined} onBlur={interactive ? () => set(null) : undefined} tabIndex={interactive ? 0 : undefined}
          >
            <rect width="152" height="68" rx="14" fill="rgba(17,27,48,0.85)" stroke={s.color} strokeOpacity="0.4" />
            <g transform="translate(20 34)"><Glyph id={s.id} color={s.color} animate={!reduced} /></g>
            <text className="ns-sv-label" x="72" y="30" fill="#E6ECF5" fontFamily="var(--font-data)" fontSize="11.5" letterSpacing="1.6" fontWeight="600">{s.label}</text>
            <text className="ns-sv-label" x="72" y="48" fill="#8FA3C0" fontFamily="var(--font-body)" fontSize="11">{s.sub}</text>
          </g>
        ))}

        <g transform={`translate(${HUB.x} ${HUB.y})`}>
          <circle r="58" fill="#0B1220" stroke="rgba(34,211,238,0.7)" strokeWidth="1.4" />
          <path d="M-42 0C-24-27 24-27 42 0C24 27-24 27-42 0Z" stroke="#E6ECF5" strokeOpacity="0.7" strokeWidth="1.6" fill="none" />
          <path d="M-17 17L-17 -17L17 17L17 -17" stroke="url(#svOut)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          {[[-17, 17], [-17, -17], [17, 17], [17, -17]].map(([x, y], i) => (<circle key={i} cx={x} cy={y} r="4.2" fill="#0B1220" stroke="#22D3EE" strokeWidth="1.8" />))}
          <circle r="6.5" fill="#22D3EE" className={reduced ? undefined : 'ns-node-pulse'} />
          <circle r="2.4" fill="#0B1220" />
          <text className="ns-sv-label" y="86" textAnchor="middle" fill="#8FA3C0" fontFamily="var(--font-data)" fontSize="11" letterSpacing="2">MULTIMODAL FUSION</text>
        </g>

        <path d={`M${HUB.x + 60} ${HUB.y} L ${OUT.x - 40} ${OUT.y}`} stroke="url(#svOut)" strokeWidth="1.8" className={reduced ? undefined : 'ns-signal-path'} strokeLinecap="round" />
        <g transform={`translate(${OUT.x} ${OUT.y})`}>
          <circle r="34" fill="rgba(34,211,238,0.08)" stroke="rgba(34,211,238,0.6)" strokeWidth="1.2" />
          <path d="M-12 0h24M4-8l8 8-8 8" stroke="#22D3EE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <text className="ns-sv-label" y="58" textAnchor="middle" fill="#E6ECF5" fontFamily="var(--font-data)" fontSize="11" letterSpacing="1.6" fontWeight="600">SCREENING</text>
          <text className="ns-sv-label" y="73" textAnchor="middle" fill="#E6ECF5" fontFamily="var(--font-data)" fontSize="11" letterSpacing="1.6" fontWeight="600">INSIGHT</text>
        </g>
      </svg>

      <ul className="ns-sv-legend" aria-label="Signal streams">
        {STREAMS.map((s) => (
          <li key={s.id}><span style={{ background: s.color }} />{s.label.charAt(0) + s.label.slice(1).toLowerCase()}</li>
        ))}
        <li><span style={{ background: '#22D3EE' }} />Fusion → screening insight</li>
      </ul>
      <style>{`
        .ns-sv-legend{display:none;list-style:none;margin:10px 0 0;padding:0;gap:6px 14px;flex-wrap:wrap;font-size:.78rem;color:#9FB0C8}
        .ns-sv-legend li{display:flex;align-items:center;gap:7px}
        .ns-sv-legend span{width:8px;height:8px;border-radius:50%}
        @media (max-width:640px){.ns-sv-label{display:none}.ns-sv-legend{display:flex}}
      `}</style>
    </div>
  );
}
