import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import CategoryBadge from '../components/CategoryBadge';
import RiskBadge from '../components/RiskBadge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { casesApi } from '../services/api';

const FILTERS = ['all', 'adult', 'child', 'toddler'];

function FilterChip({ label, active, onClick }) {
  return (
    <Button variant={active ? 'outline' : 'ghost'} size="sm" onClick={onClick}
      style={{ borderRadius:'var(--radius-pill)', ...(active ? { background:'var(--clr-primary-dim)', color:'var(--clr-primary)', borderColor:'var(--clr-primary)' } : {}) }}>
      {label}
    </Button>
  );
}

function StatCard({ label, value, helper }) {
  return (
    <Card hover={false} padding="var(--sp-4)">
      <div style={{ fontSize:'var(--text-3xl)', fontWeight:300, letterSpacing:'-0.04em', lineHeight:1, fontFamily:'var(--font-display)', color:'var(--clr-text-primary)' }}>{value}</div>
      <div style={{ marginTop:'var(--sp-2)', fontSize:'var(--text-xs)', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--clr-text-muted)' }}>{label}</div>
      <div style={{ marginTop:'var(--sp-1)', fontSize:'var(--text-xs)', color:'var(--clr-text-muted)', lineHeight:1.5 }}>{helper}</div>
    </Card>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function loadSummary() {
      setLoading(true); setError('');
      try {
        const data = await casesApi.dashboard(categoryFilter === 'all' ? {} : { category: categoryFilter });
        if (active) setSummary(data);
      } catch (e) { if (active) setError(e.message); }
      finally { if (active) setLoading(false); }
    }
    loadSummary();
    return () => { active = false; };
  }, [categoryFilter]);

  const totals = summary?.totals ?? { totalCases:0, adultCases:0, childCases:0, highRisk:0, awaitingReview:0, mockCases:0, averageRiskScore:0, averageAq10Score:0 };
  const statCards = [
    { label: categoryFilter === 'adult' ? 'Adult cases' : categoryFilter === 'child' ? 'Child cases' : categoryFilter === 'toddler' ? 'Toddler cases' : 'All cases', value: totals.totalCases, helper: 'Current dashboard scope' },
    { label: 'High risk', value: totals.highRisk, helper: 'Flagged for elevated attention' },
    { label: 'Awaiting review', value: totals.awaitingReview, helper: 'Pending clinician follow-up' },
    { label: 'Avg AQ-10', value: totals.averageAq10Score, helper: 'Average questionnaire score' },
  ];

  return (
    <motion.main id="dashboard-page" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.45, ease:[0.16,1,0.3,1] }}
      style={{ display:'flex', flexDirection:'column', gap:'var(--sp-6)', paddingTop:'calc(68px + var(--sp-8))', maxWidth:1280, margin:'0 auto', paddingInline:'clamp(1.25rem, 4vw, 3rem)' }}>

      <Card glow>
        <div style={{ display:'flex', justifyContent:'space-between', gap:'var(--sp-4)', flexWrap:'wrap', alignItems:'flex-start', marginBottom:'var(--sp-4)' }}>
          <div>
            <h1 style={{ margin:'0 0 var(--sp-2)', fontSize:'var(--text-2xl)', fontWeight:700, letterSpacing:'-0.03em', color:'var(--clr-text-primary)', fontFamily:'var(--font-display)' }}>Overview</h1>
            <p style={{ margin:0, fontSize:'var(--text-sm)', color:'var(--clr-text-secondary)', lineHeight:1.6 }}>Track screening activity with category-aware counts.</p>
          </div>
          <div style={{ display:'flex', gap:'var(--sp-2)', flexWrap:'wrap' }}>
            {FILTERS.map(f => <FilterChip key={f} label={f === 'all' ? 'All' : f[0].toUpperCase() + f.slice(1)} active={categoryFilter === f} onClick={() => setCategoryFilter(f)} />)}
          </div>
        </div>
        {loading ? <p style={{ margin:0, color:'var(--clr-text-muted)' }}>Loading…</p> : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:'var(--sp-4)' }}>
            {statCards.map(c => <StatCard key={c.label} {...c} />)}
          </div>
        )}
      </Card>

      {error && <Card hover={false} style={{ borderColor:'var(--clr-danger)', background:'var(--clr-danger-dim)' }}><p style={{ margin:0, color:'var(--clr-danger)', fontWeight:600 }}>{error}</p></Card>}

      <section style={{ display:'grid', gridTemplateColumns:'1.1fr 1fr', gap:'var(--sp-6)' }}>
        <Card>
          <h2 style={{ margin:'0 0 var(--sp-2)', fontSize:'var(--text-base)', fontWeight:600, color:'var(--clr-text-primary)' }}>Category mix</h2>
          <p style={{ margin:'0 0 var(--sp-4)', fontSize:'var(--text-xs)', color:'var(--clr-text-muted)' }}>Counts remain visible even while filtering.</p>
          <div style={{ display:'grid', gap:'var(--sp-3)' }}>
            {(summary?.categoryBreakdown ?? []).map(item => (
              <div key={item.category} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'var(--sp-3)', padding:'var(--sp-3) var(--sp-4)', borderRadius:'var(--radius-md)', border:'1px solid var(--clr-border-subtle)', background:'var(--clr-surface)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'var(--sp-3)' }}>
                  <CategoryBadge category={item.category} size="md" />
                  <span style={{ color:'var(--clr-text-primary)', fontWeight:600, fontSize:'var(--text-sm)' }}>{item.label}</span>
                </div>
                <strong style={{ fontFamily:'var(--font-mono)', fontSize:'var(--text-xs)', color:'var(--clr-text-primary)' }}>{item.count}</strong>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 style={{ margin:'0 0 var(--sp-2)', fontSize:'var(--text-base)', fontWeight:600, color:'var(--clr-text-primary)' }}>Pipeline confidence</h2>
          <p style={{ margin:'0 0 var(--sp-4)', fontSize:'var(--text-xs)', color:'var(--clr-text-muted)' }}>Adapts to the active category filter.</p>
          <div style={{ display:'grid', gap:'var(--sp-4)' }}>
            {(summary?.modalityConfidence ?? []).map(item => (
              <div key={item.id}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'var(--sp-2)' }}>
                  <span style={{ color:'var(--clr-text-primary)', fontWeight:600, fontSize:'var(--text-sm)' }}>{item.label}</span>
                  <span style={{ color:'var(--clr-primary)', fontFamily:'var(--font-mono)', fontSize:'var(--text-xs)' }}>{item.pct}%</span>
                </div>
                <div style={{ height:8, borderRadius:'var(--radius-pill)', background:'var(--clr-surface-3)', overflow:'hidden' }}>
                  <motion.div initial={{ width:0 }} animate={{ width:`${item.pct}%` }} transition={{ duration:0.8, ease:[0.16,1,0.3,1] }}
                    style={{ height:'100%', borderRadius:'var(--radius-pill)', background:'var(--grad-cta)' }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <Card glow>
        <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', alignItems:'center', marginBottom:'var(--sp-4)' }}>
          <div>
            <h2 style={{ margin:'0 0 var(--sp-2)', fontSize:'var(--text-base)', fontWeight:600, color:'var(--clr-text-primary)' }}>Recent cases</h2>
            <p style={{ margin:0, fontSize:'var(--text-xs)', color:'var(--clr-text-muted)' }}>Each row retains its category tag for quick routing.</p>
          </div>
          <Link to="/app/cases" style={{ color:'var(--clr-primary)', fontWeight:700, textDecoration:'none', fontSize:'var(--text-sm)' }}>View all →</Link>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr>
              {['Case','Category','Age','Risk','Date','Status'].map(h => (
                <th key={h} style={{ textAlign:'left', padding:'var(--sp-3)', color:'var(--clr-text-muted)', fontSize:'var(--text-xs)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', borderBottom:'1px solid var(--clr-border-subtle)' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {(summary?.recentCases ?? []).map(r => (
                <tr key={r.id} onClick={() => navigate(`/app/results/${r.id}`)} style={{ cursor:'pointer', borderBottom:'1px solid var(--clr-border-subtle)' }}>
                  <td style={{ padding:'var(--sp-4) var(--sp-3)' }}>
                    <strong style={{ color:'var(--clr-text-primary)' }}>{r.subjectName || 'Unnamed'}</strong>
                    <div style={{ fontFamily:'var(--font-mono)', fontSize:'var(--text-xs)', color:'var(--clr-text-muted)', marginTop:'var(--sp-1)' }}>{r.id}</div>
                  </td>
                  <td style={{ padding:'var(--sp-4) var(--sp-3)' }}><CategoryBadge category={r.category} size="sm" /></td>
                  <td style={{ padding:'var(--sp-4) var(--sp-3)', color:'var(--clr-text-secondary)' }}>{r.age}</td>
                  <td style={{ padding:'var(--sp-4) var(--sp-3)' }}><RiskBadge level={r.riskLevel} size="sm" showScore score={r.riskScore} /></td>
                  <td style={{ padding:'var(--sp-4) var(--sp-3)', color:'var(--clr-text-muted)' }}>{r.screeningDate}</td>
                  <td style={{ padding:'var(--sp-4) var(--sp-3)', color:'var(--clr-text-muted)' }}>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </motion.main>
  );
}
