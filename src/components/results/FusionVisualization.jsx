/**
 * How the signals combined into the screening insight -- driven only by stored backend data.
 * Line weight = the modality's share of the final result (contribution); dashed grey = unavailable
 * or supplemental (did not influence the result). Hover/focus a modality to isolate it.
 */
import { useState } from 'react';
import useReducedMotion from '../ui/useReducedMotion';

const POS = {
  questionnaire: { x: 100, y: 56 },
  gaze: { x: 100, y: 150 },
  speech: { x: 100, y: 244 },
};
const HUB = { x: 400, y: 150 };
const COLORS = { questionnaire: '#A5B4FC', gaze: '#22D3EE', speech: '#5EEAD4', facial: '#FCD34D' };

export default function FusionVisualization({ items, finalValue, level }) {
  const reduced = useReducedMotion();
  const [hot, setHot] = useState(null);
  const dim = (id) => (hot && hot !== id ? 0.25 : 1);
  const hasFinal = typeof finalValue === 'number';
  const active = items.find((i) => i.id === hot);

  return (
    <div>
      <svg viewBox="0 0 640 300" width="100%" role="group" aria-label="Fusion diagram: contribution of each signal to the final screening insight" style={{ overflow: 'visible' }}>
        {items.map((it) => {
          const p = POS[it.id];
          const used = it.used && (it.contribution ?? 0) > 0;
          const w = used ? 1.5 + it.contribution * 7 : 1.2;
          const d = `M${p.x + 92} ${p.y} C 280 ${p.y}, 290 ${HUB.y}, ${HUB.x - 46} ${HUB.y}`;
          return (
            <g key={it.id} opacity={dim(it.id)} style={{ transition: 'opacity 200ms' }}>
              <path d={d} fill="none" stroke={used ? COLORS[it.id] : '#64748B'} strokeOpacity={used ? 0.35 : 0.5} strokeWidth={w} strokeLinecap="round" />
              {used && <path d={d} fill="none" stroke={COLORS[it.id]} strokeWidth={Math.max(w * 0.4, 1.4)} strokeLinecap="round" className={reduced ? undefined : 'ns-signal-path'} />}
              {!used && <path d={d} fill="none" stroke="#64748B" strokeWidth="1.2" strokeDasharray="2 7" strokeLinecap="round" />}
            </g>
          );
        })}

        {items.map((it) => {
          const p = POS[it.id];
          return (
            <g
              key={it.id} transform={`translate(${p.x - 92} ${p.y - 30})`} opacity={dim(it.id)} tabIndex={0} style={{ transition: 'opacity 200ms', outline: 'none' }}
              onMouseEnter={() => setHot(it.id)} onMouseLeave={() => setHot(null)} onFocus={() => setHot(it.id)} onBlur={() => setHot(null)}
              aria-label={`${it.label}: ${it.stateLabel}${it.used ? `, contributes ${(it.contribution * 100).toFixed(0)} percent` : ''}`}
            >
              <rect width="184" height="60" rx="14" fill="rgba(17,27,48,0.9)" stroke={it.available ? COLORS[it.id] : '#475569'} strokeOpacity={it.available ? 0.55 : 0.6} strokeDasharray={it.available ? undefined : '4 4'} />
              <circle cx="20" cy="30" r="5" fill={it.available ? COLORS[it.id] : '#475569'} />
              <text x="36" y="26" fill="#E6ECF5" fontFamily="var(--font-data)" fontSize="11" letterSpacing="1.2" fontWeight="600">{it.label.toUpperCase()}</text>
              <text x="36" y="44" fill={it.available ? '#9FB0C8' : '#7F92AF'} fontFamily="var(--font-body)" fontSize="11.5">
                {it.stateLabel}
              </text>
            </g>
          );
        })}

        <g transform={`translate(${HUB.x} ${HUB.y})`}>
          <circle r="66" fill="rgba(34,211,238,0.06)" stroke="rgba(34,211,238,0.55)" strokeWidth="1.3" />
          <circle r="52" fill="#0B1220" stroke="rgba(148,163,184,0.25)" />
          <text y={hasFinal ? 2 : 6} textAnchor="middle" fill="#F4F7FB" fontFamily="var(--font-heading)" fontWeight="600" fontSize={hasFinal ? 30 : 14}>
            {hasFinal ? `${Math.round(finalValue * 100)}%` : 'n/a'}
          </text>
          <text y="24" textAnchor="middle" fill="#8FA3C0" fontFamily="var(--font-data)" fontSize="9" letterSpacing="1.6">FUSION</text>
        </g>

        <path d={`M${HUB.x + 68} ${HUB.y} H 548`} stroke="#22D3EE" strokeWidth="1.6" strokeLinecap="round" className={reduced ? undefined : 'ns-signal-path'} />
        <g transform={`translate(548 ${HUB.y - 30})`}>
          <rect width="88" height="60" rx="14" fill="rgba(34,211,238,0.08)" stroke="rgba(34,211,238,0.6)" />
          <text x="44" y="26" textAnchor="middle" fill="#E6ECF5" fontFamily="var(--font-data)" fontSize="9.5" letterSpacing="1.2" fontWeight="600">INSIGHT</text>
          <text x="44" y="44" textAnchor="middle" fill="#22D3EE" fontFamily="var(--font-heading)" fontSize="13" fontWeight="600">{level || '—'}</text>
        </g>
      </svg>

      <p role="status" style={{ minHeight: 44, marginTop: 8, fontSize: '0.84rem', lineHeight: 1.55, color: '#9FB0C8', maxWidth: 'none' }}>
        {active
          ? `${active.label}: ${active.detail}`
          : 'Hover or focus a signal to see its status, data quality and share of the final result. Dashed grey lines did not influence the result.'}
      </p>
    </div>
  );
}
