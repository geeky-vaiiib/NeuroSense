import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CategoryBadge from '../components/CategoryBadge';
import RiskBadge from '../components/RiskBadge';
import MetricCard from '../components/ui/MetricCard';
import StatusBadge from '../components/ui/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { casesApi } from '../services/api';

const I = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' };

function ModalityRow({ item }) {
  const pct = item.total ? Math.round((item.available / item.total) * 100) : 0;
  const fused = item.total ? Math.round((item.used_in_fusion / item.total) * 100) : 0;
  return (
    <li style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
        <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--ns-n800)' }}>{item.label}</span>
        <span style={{ fontFamily: 'var(--font-data)', fontSize: '0.78rem', color: 'var(--ns-n600)' }}>
          {item.available}/{item.total} sessions
        </span>
      </div>
      <div role="img" aria-label={`${item.label}: signal available in ${item.available} of ${item.total} sessions, used in the final result in ${item.used_in_fusion}`}
        style={{ position: 'relative', height: 8, borderRadius: 8, background: 'var(--ns-n150)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: 'var(--ns-instrument-light)', opacity: 0.35, borderRadius: 8 }} />
        <div style={{ position: 'absolute', inset: 0, width: `${fused}%`, background: 'var(--ns-instrument)', borderRadius: 8, transition: 'width 600ms ease' }} />
      </div>
      <span style={{ fontSize: '0.74rem', color: 'var(--ns-n500)' }}>
        {item.used_in_fusion} used in the final indicator · {item.available - item.used_in_fusion} shown as supplemental
      </span>
    </li>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await casesApi.dashboard({});
        if (active) setSummary(data);
      } catch (e) {
        if (active) setError(e.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const t = summary?.totals;
  const first = (user?.name || '').split(' ')[0];
  const recent = summary?.recentCases ?? [];
  const status = summary?.modalityStatus ?? [];

  return (
    <main id="dashboard-page" className="ns-page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <p className="ns-eyebrow" style={{ marginBottom: 8 }}>Overview</p>
          <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.15rem)', letterSpacing: '-0.03em' }}>{first ? `Welcome back, ${first}` : 'Welcome back'}</h1>
          <p style={{ marginTop: 8, color: 'var(--ns-n600)', fontSize: '0.95rem', maxWidth: '58ch' }}>
            Your screening sessions, the signals behind them, and the results that need attention.
          </p>
        </div>
        <Link to="/app/screening" className="btn btn-primary">
          <svg {...I} width="16" height="16"><path d="M12 5v14M5 12h14" /></svg>
          New screening
        </Link>
      </header>

      {error && (
        <div role="alert" className="ns-card" style={{ padding: '16px 18px', borderColor: 'var(--ns-risk-high-border)', background: 'var(--ns-risk-high-bg)' }}>
          <strong style={{ color: 'var(--ns-risk-high-text)' }}>We couldn&apos;t load your dashboard.</strong>
          <p style={{ marginTop: 4, fontSize: '0.88rem', color: 'var(--ns-n700)' }}>{error}</p>
        </div>
      )}

      {/* Primary metrics */}
      <section aria-label="Key figures" className="ns-dash-metrics">
        {loading && !t ? [0, 1, 2, 3].map((i) => <div key={i} className="ns-skeleton" style={{ height: 132 }} />) : (
          <>
            <MetricCard label="Screening sessions" value={t ? t.totalCases : null} hint="all time" icon={<svg {...I}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>} />
            <MetricCard label="Awaiting review" value={t ? t.awaitingReview : null} status={t && t.awaitingReview > 0 ? 'Needs attention' : 'All reviewed'} statusTone={t && t.awaitingReview > 0 ? 'warn' : 'ok'} icon={<svg {...I}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>} />
            <MetricCard label="High-risk indicators" value={t ? t.highRisk : null} status={t && t.highRisk > 0 ? 'Clinician review advised' : 'None flagged'} statusTone={t && t.highRisk > 0 ? 'bad' : 'ok'} icon={<svg {...I}><path d="M12 3l9 16H3L12 3z" /><path d="M12 10v4M12 17v.01" /></svg>} />
            <MetricCard label="Average AQ-10" value={t && t.totalCases ? t.averageAq10Score : null} unit={t && t.totalCases ? '/ 10' : ''} hint={t && !t.totalCases ? 'No sessions yet' : 'questionnaire score'} unavailableText="No data yet" icon={<svg {...I}><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></svg>} />
          </>
        )}
      </section>

      <section className="ns-dash-grid">
        {/* Recent sessions */}
        <div className="ns-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '22px 24px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: '1.1rem' }}>Recent screening sessions</h2>
              <p style={{ marginTop: 4, color: 'var(--ns-n500)', fontSize: '0.84rem' }}>Open a session to see its full result and explanation.</p>
            </div>
            <Link to="/app/cases" className="btn btn-ghost btn-sm">View all</Link>
          </div>
          {loading && !summary ? (
            <div style={{ padding: '0 24px 24px', display: 'grid', gap: 10 }}>{[0, 1, 2].map((i) => <div key={i} className="ns-skeleton" style={{ height: 54 }} />)}</div>
          ) : recent.length === 0 ? (
            <div style={{ padding: '36px 24px 44px', textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, margin: '0 auto 14px', borderRadius: 16, background: 'var(--ns-instrument-dim)', color: 'var(--ns-instrument)', display: 'grid', placeItems: 'center' }}>
                <svg {...I} width="26" height="26"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 9h8M8 13h8M8 17h4" /></svg>
              </div>
              <h3 style={{ fontSize: '1rem' }}>No screening sessions yet</h3>
              <p style={{ margin: '6px auto 18px', maxWidth: 360, color: 'var(--ns-n500)', fontSize: '0.88rem' }}>Completed screenings appear here with their result, risk level and the signals that contributed.</p>
              <Link to="/app/screening" className="btn btn-primary btn-sm">Start a screening</Link>
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: '0 8px 8px' }}>
              {recent.map((r) => (
                <li key={r.id}>
                  <button
                    type="button" onClick={() => navigate(`/app/results/${r.id}`)} className="ns-dash-row"
                    aria-label={`Open result for ${r.subjectName || 'unnamed case'}, ${r.riskLevel} risk`}
                  >
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 600, fontSize: '0.92rem', color: 'var(--ns-n900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.subjectName || 'Unnamed case'}</span>
                      <span style={{ display: 'block', fontFamily: 'var(--font-data)', fontSize: '0.7rem', color: 'var(--ns-n500)', marginTop: 2 }}>{r.id} · {r.screeningDate}</span>
                    </span>
                    <span className="ns-dash-row__meta"><CategoryBadge category={r.category} size="sm" /></span>
                    <span><RiskBadge level={r.riskLevel} size="sm" showScore score={r.riskScore} /></span>
                    <StatusBadge tone={r.status === 'pending-review' ? 'warn' : 'muted'}>{String(r.status).replace('-', ' ')}</StatusBadge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Modality status + data quality (computed from the user's stored sessions) */}
        <aside className="ns-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <h2 style={{ fontSize: '1.1rem' }}>Modality status</h2>
            <p style={{ marginTop: 4, color: 'var(--ns-n500)', fontSize: '0.84rem' }}>How often each signal was captured and trusted enough to inform the result.</p>
          </div>
          {status.length === 0 || !t?.totalCases ? (
            <p style={{ fontSize: '0.88rem', color: 'var(--ns-n500)' }}>Modality status appears after your first completed screening.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 18 }}>
              {status.map((m) => <ModalityRow key={m.id} item={m} />)}
            </ul>
          )}
          <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--ns-n200)' }}>
            <p style={{ fontSize: '0.74rem', color: 'var(--ns-n500)', maxWidth: 'none', lineHeight: 1.55 }}>
              <strong style={{ color: 'var(--ns-n700)' }}>Data quality:</strong> a signal that is skipped, fails quality checks or comes from a model that has not met its validation threshold is shown here as supplemental, and never changes the final indicator.
            </p>
          </div>
        </aside>
      </section>

      <style>{`
        .ns-dash-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
        .ns-dash-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(0,1fr);gap:20px;align-items:start}
        .ns-dash-row{width:100%;display:grid;grid-template-columns:minmax(0,1.6fr) auto auto auto;align-items:center;gap:14px;padding:12px 16px;border-radius:12px;text-align:left;transition:background var(--ease-fast)}
        .ns-dash-row:hover{background:var(--ns-n100)}
        @media (max-width:1100px){.ns-dash-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.ns-dash-grid{grid-template-columns:1fr}}
        @media (max-width:640px){.ns-dash-metrics{grid-template-columns:1fr}.ns-dash-row{grid-template-columns:minmax(0,1fr) auto}.ns-dash-row__meta{display:none}.ns-dash-row>*:last-child{grid-column:1/-1}}
      `}</style>
    </main>
  );
}
