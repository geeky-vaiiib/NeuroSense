import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import CategoryBadge from '../components/CategoryBadge';
import Modal from '../components/Modal';
import RiskBadge from '../components/RiskBadge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { casesApi } from '../services/api';

const CATEGORY_FILTERS = ['all', 'adult', 'child', 'toddler'];
const RISK_FILTERS = ['all', 'High', 'Moderate', 'Low'];

function FilterChip({ label, active, onClick }) {
  return (
    <Button variant={active ? 'outline' : 'ghost'} size="sm" onClick={onClick}
      style={{ borderRadius:'var(--radius-pill)', ...(active ? { background:'var(--clr-primary-dim)', color:'var(--clr-primary)', borderColor:'var(--clr-primary)' } : {}) }}>
      {label}
    </Button>
  );
}

function CaseCard({ record, onOpen, onViewResults }) {
  return (
    <Card padding="var(--sp-4)">
      <div style={{ display:'flex', justifyContent:'space-between', gap:'var(--sp-3)', alignItems:'center' }}>
        <div style={{ display:'grid', gap:'var(--sp-2)' }}>
          <div style={{ display:'flex', gap:'var(--sp-2)', flexWrap:'wrap' }}>
            <CategoryBadge category={record.category} size="sm" />
            <RiskBadge level={record.riskLevel} size="sm" showScore score={record.riskScore} />
          </div>
          <div>
            <strong style={{ color:'var(--clr-text-primary)' }}>{record.subjectName || 'Unnamed case'}</strong>
            <p style={{ margin:'var(--sp-1) 0 0', fontFamily:'var(--font-mono)', fontSize:'var(--text-xs)', color:'var(--clr-text-muted)' }}>{record.id}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => onViewResults(record.id)}>Open result</Button>
      </div>

      <p style={{ margin:'var(--sp-3) 0', color:'var(--clr-text-secondary)', lineHeight:1.6 }}>{record.diagnosis}</p>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, minmax(0, 1fr))', gap:'var(--sp-3)' }}>
        {[['Age', record.age], ['Respondent', record.respondentRelationship || 'N/A'], ['Tool', record.screeningTool]].map(([l, v]) => (
          <div key={l}>
            <p style={{ margin:'0 0 var(--sp-1)', fontSize:'var(--text-xs)', fontWeight:600, letterSpacing:'0.05em', textTransform:'uppercase', color:'var(--clr-text-muted)' }}>{l}</p>
            <strong style={{ color:'var(--clr-text-primary)', fontSize:'var(--text-sm)' }}>{v}</strong>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:'var(--sp-2)', flexWrap:'wrap', marginTop:'var(--sp-3)' }}>
        {record.tags?.map(tag => (
          <span key={tag} style={{ padding:'3px 10px', borderRadius:'var(--radius-pill)', background:'var(--clr-surface-3)', color:'var(--clr-text-muted)', fontSize:'var(--text-xs)', fontFamily:'var(--font-mono)' }}>{tag}</span>
        ))}
      </div>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'var(--sp-3)' }}>
        <span style={{ color:'var(--clr-text-muted)', fontSize:'var(--text-sm)' }}>{record.dataSource === 'mock' ? 'Mock mode' : 'Live model'}</span>
        <Button variant="ghost" size="sm" onClick={() => onOpen(record)}>View details</Button>
      </div>
    </Card>
  );
}

export default function Cases() {
  const navigate = useNavigate();
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [records, setRecords] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function loadCases() {
      setLoading(true); setError('');
      try {
        const list = await casesApi.list(categoryFilter === 'all' ? {} : { category: categoryFilter });
        if (active) setRecords(list);
      } catch (e) { if (active) setError(e.message); }
      finally { if (active) setLoading(false); }
    }
    loadCases();
    return () => { active = false; };
  }, [categoryFilter]);

  const filteredRecords = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter(r => {
      const matchesRisk = riskFilter === 'all' || r.riskLevel === riskFilter;
      const matchesQuery = !q || r.id.toLowerCase().includes(q) || (r.subjectName || '').toLowerCase().includes(q) || (r.respondentName || '').toLowerCase().includes(q) || (r.diagnosis || '').toLowerCase().includes(q);
      return matchesRisk && matchesQuery;
    });
  }, [query, records, riskFilter]);

  return (
    <motion.main id="cases-page" initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.45, ease:[0.16,1,0.3,1] }}
      style={{ display:'flex', flexDirection:'column', gap:'var(--sp-6)', paddingTop:'calc(68px + var(--sp-8))', maxWidth:1280, margin:'0 auto', paddingInline:'clamp(1.25rem, 4vw, 3rem)' }}>

      <Card glow>
        <div style={{ display:'flex', justifyContent:'space-between', gap:'var(--sp-4)', flexWrap:'wrap', alignItems:'center', marginBottom:'var(--sp-4)' }}>
          <div>
            <h1 style={{ margin:'0 0 var(--sp-2)', fontSize:'var(--text-2xl)', fontWeight:700, letterSpacing:'-0.03em', color:'var(--clr-text-primary)', fontFamily:'var(--font-display)' }}>Case history</h1>
            <p style={{ margin:0, fontSize:'var(--text-sm)', color:'var(--clr-text-secondary)', lineHeight:1.6 }}>Filter across adult, child, and toddler case records.</p>
          </div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:'var(--text-xs)', color:'var(--clr-text-muted)' }}>
            {filteredRecords.length} case{filteredRecords.length === 1 ? '' : 's'}
          </div>
        </div>

        <div style={{ display:'grid', gap:'var(--sp-3)' }}>
          <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by case ID, subject, respondent, or diagnosis"
            style={{ width:'100%', minHeight:44, padding:'0 var(--sp-4)', borderRadius:'var(--radius-md)', border:'1px solid var(--clr-border)', background:'var(--clr-surface)', color:'var(--clr-text-primary)', fontSize:'var(--text-sm)', fontFamily:'var(--font-body)', outline:'none' }} />
          <div style={{ display:'flex', gap:'var(--sp-2)', flexWrap:'wrap' }}>
            {CATEGORY_FILTERS.map(f => <FilterChip key={f} label={f === 'all' ? 'All categories' : f[0].toUpperCase() + f.slice(1)} active={categoryFilter === f} onClick={() => setCategoryFilter(f)} />)}
          </div>
          <div style={{ display:'flex', gap:'var(--sp-2)', flexWrap:'wrap' }}>
            {RISK_FILTERS.map(f => <FilterChip key={f} label={f === 'all' ? 'All risk levels' : f} active={riskFilter === f} onClick={() => setRiskFilter(f)} />)}
          </div>
        </div>
      </Card>

      {error && <Card hover={false} style={{ borderColor:'var(--clr-danger)', background:'var(--clr-danger-dim)' }}><p style={{ margin:0, color:'var(--clr-danger)', fontWeight:600 }}>{error}</p></Card>}

      <Card hover={false}>
        {loading ? <p style={{ margin:0, color:'var(--clr-text-muted)' }}>Loading case history…</p>
         : filteredRecords.length === 0 ? <div style={{ textAlign:'center', color:'var(--clr-text-muted)', padding:'var(--sp-10) 0' }}>No cases match the current filters.</div>
         : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))', gap:'var(--sp-4)' }}>
            {filteredRecords.map(r => <CaseCard key={r.id} record={r} onOpen={setSelectedCase} onViewResults={id => navigate(`/app/results/${id}`)} />)}
          </div>
        )}
      </Card>

      <Modal open={Boolean(selectedCase)} onClose={() => setSelectedCase(null)} title={selectedCase?.subjectName || 'Case details'} subtitle={selectedCase ? `${selectedCase.id} · ${selectedCase.diagnosis}` : ''} size="lg">
        {selectedCase && (
          <div style={{ display:'grid', gap:'var(--sp-4)' }}>
            <div style={{ display:'flex', gap:'var(--sp-3)', flexWrap:'wrap' }}>
              <CategoryBadge category={selectedCase.category} size="lg" />
              <RiskBadge level={selectedCase.riskLevel} size="lg" showScore score={selectedCase.riskScore} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap:'var(--sp-3)' }}>
              {[['Subject', selectedCase.subjectName || 'N/A'], ['Respondent', selectedCase.respondentName || 'N/A'], ['Relationship', selectedCase.respondentRelationship || 'N/A'], ['Date', selectedCase.screeningDate], ['Tool', selectedCase.screeningTool], ['Source', selectedCase.dataSource === 'mock' ? 'Mock' : 'Live']].map(([l, v]) => (
                <div key={l} style={{ borderRadius:'var(--radius-md)', border:'1px solid var(--clr-border-subtle)', background:'var(--clr-surface)', padding:'var(--sp-3)' }}>
                  <p style={{ margin:'0 0 var(--sp-1)', fontSize:'var(--text-xs)', fontWeight:600, letterSpacing:'0.05em', textTransform:'uppercase', color:'var(--clr-text-muted)' }}>{l}</p>
                  <strong style={{ color:'var(--clr-text-primary)' }}>{v}</strong>
                </div>
              ))}
            </div>
            <div>
              <p style={{ margin:'0 0 var(--sp-2)', fontSize:'var(--text-base)', fontWeight:600, color:'var(--clr-text-primary)' }}>Diagnosis summary</p>
              <p style={{ margin:0, color:'var(--clr-text-secondary)', lineHeight:1.7 }}>{selectedCase.diagnosis}</p>
            </div>
          </div>
        )}
      </Modal>
    </motion.main>
  );
}
