/**
 * Diagnostic.jsx — Developer-only diagnostic page for verifying end-to-end flow.
 * Accessible at /app/diagnostic (not linked from sidebar).
 */
import { useCallback, useState } from 'react';
import { healthApi, casesApi, screeningApi, explainApi } from '../services/api';
import { generatePDF } from '../utils/generatePDF';

/* ── Shared styles ───────────────────────────────────────── */
const STATUS = {
  idle:    { border: '#D4A84B', bg: '#FFF8EA', label: 'Pending' },
  running: { border: '#A0A0A0', bg: '#F5F5F5', label: 'Running…' },
  pass:    { border: '#5E7A67', bg: '#F0F7F2', label: 'Pass' },
  fail:    { border: '#C83232', bg: '#FFF0F0', label: 'Fail' },
};

function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.idle;
  return (
    <span style={{
      padding: '2px 10px', borderRadius: '999px', fontSize: '0.7rem',
      fontWeight: 700, fontFamily: 'var(--font-mono)',
      backgroundColor: s.bg, color: s.border, border: `1px solid ${s.border}`,
    }}>{s.label}</span>
  );
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 14, height: 14, borderRadius: '50%',
      border: '2px solid var(--color-neutral-300)',
      borderTopColor: 'var(--color-primary)',
      animation: 'spin 0.7s linear infinite',
    }} />
  );
}

function Card({ title, status, children }) {
  const s = STATUS[status] || STATUS.idle;
  return (
    <section style={{
      backgroundColor: 'var(--color-bg-card)',
      border: '1px solid var(--color-neutral-200)',
      borderLeft: `4px solid ${s.border}`,
      borderRadius: '14px',
      padding: '20px 22px',
      boxShadow: 'var(--shadow-xs)',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: '12px',
      }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--color-neutral-900)' }}>{title}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {status === 'running' && <Spinner />}
          <StatusBadge status={status} />
        </div>
      </div>
      <div style={{ fontSize: '0.85rem', color: 'var(--color-neutral-700)', lineHeight: 1.7 }}>
        {children}
      </div>
    </section>
  );
}

function Row({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '4px 0' }}>
      <span style={{ color: 'var(--color-neutral-500)' }}>{label}</span>
      <strong style={{
        color: 'var(--color-neutral-800)', textAlign: 'right',
        fontFamily: mono ? 'var(--font-mono)' : 'inherit',
      }}>{value}</strong>
    </div>
  );
}

/* ── Test payload ────────────────────────────────────────── */
const TEST_PAYLOAD = {
  category: 'adult',
  demo: { age: 30, gender: 'Male', jaundice: 'No', familyAsd: 'No', subjectName: 'Test Subject' },
  answers: {
    A1: 'Definitely agree', A2: 'Slightly disagree', A3: 'Slightly disagree',
    A4: 'Slightly disagree', A5: 'Slightly disagree', A6: 'Slightly disagree',
    A7: 'Definitely agree', A8: 'Definitely agree', A9: 'Slightly disagree',
    A10: 'Definitely agree',
  },
  aq10Score: 4,
};

/* ── Main component ──────────────────────────────────────── */
export default function Diagnostic() {
  // Section states
  const [s1, setS1] = useState({ status: 'idle', data: null, error: null });
  const [s2, setS2] = useState({ status: 'idle', data: null, error: null });
  const [s3, setS3] = useState({ status: 'idle', data: null, error: null });
  const [s4, setS4] = useState({ status: 'idle', data: null, error: null });
  const [s5, setS5] = useState({ status: 'idle', data: null, error: null });

  /* ── Section 1: Backend Health ──────────────────────────── */
  const runHealth = useCallback(async () => {
    setS1({ status: 'running', data: null, error: null });
    try {
      const data = await healthApi.get();
      setS1({ status: data?.status === 'ok' ? 'pass' : 'fail', data, error: null });
      return data;
    } catch (err) {
      setS1({ status: 'fail', data: null, error: err.message || 'Health check failed' });
      return null;
    }
  }, []);

  /* ── Section 2: Mock Data Integrity ─────────────────────── */
  const runMockData = useCallback(async () => {
    setS2({ status: 'running', data: null, error: null });
    try {
      const list = await casesApi.list();
      const arr = Array.isArray(list) ? list : [];
      setS2({ status: 'pass', data: arr, error: null });
      return arr;
    } catch (err) {
      setS2({ status: 'fail', data: null, error: err.message || 'Failed to fetch cases' });
      return null;
    }
  }, []);

  /* ── Section 3: Screening Submission ────────────────────── */
  const runScreening = useCallback(async () => {
    setS3({ status: 'running', data: null, error: null });
    try {
      const result = await screeningApi.submit(TEST_PAYLOAD);
      setS3({ status: 'pass', data: result, error: null });
      return result;
    } catch (err) {
      setS3({ status: 'fail', data: null, error: err.message || 'Screening submission failed' });
      return null;
    }
  }, []);

  /* ── Section 4: Explainability ──────────────────────────── */
  const runExplain = useCallback(async (caseId) => {
    const id = caseId || s3.data?.caseId || s3.data?.id || 'mock-adult-001';
    setS4({ status: 'running', data: null, error: null });
    try {
      const result = await explainApi.get(id);
      setS4({ status: 'pass', data: result, error: null });
      return result;
    } catch (err) {
      setS4({ status: 'fail', data: null, error: err.message || 'Explainability fetch failed' });
      return null;
    }
  }, [s3.data]);

  /* ── Section 5: PDF Generation ──────────────────────────── */
  const runPDF = useCallback(async () => {
    setS5({ status: 'running', data: null, error: null });
    try {
      // Build a test case object from screening result or synthetic
      const caseData = {
        id: s3.data?.caseId || s3.data?.id || 'DIAG-TEST-001',
        category: 'adult',
        categoryLabel: 'Adult (16+)',
        subjectName: 'Test Subject',
        age: 30,
        gender: 'Male',
        riskLevel: s3.data?.riskLevel || 'Moderate',
        riskScore: s3.data?.fusionScore ?? s3.data?.riskScore ?? 0.55,
        aq10Score: 4,
        screeningTool: 'AQ-10 Adult',
        modelUsed: 'AdultXGB v2',
        isMock: true,
        dataSource: 'mock',
        screeningDate: new Date().toISOString().slice(0, 10),
        interpretation: 'This is a diagnostic test case generated by the developer diagnostic page.',
      };
      const explanation = s4.data || {
        shap: [
          { feature: 'A1_Score', shapValue: 0.12, direction: 'positive' },
          { feature: 'A7_Score', shapValue: 0.09, direction: 'positive' },
          { feature: 'Age', shapValue: -0.04, direction: 'negative' },
        ],
        lime: [
          { feature: 'A1_Score', weight: 0.15, direction: 'positive', plainEnglish: 'Response to social attention question increased risk.' },
          { feature: 'A7_Score', weight: 0.10, direction: 'positive', plainEnglish: 'Communication pattern flagged by model.' },
        ],
        summary: 'Diagnostic test — synthetic explanation data.',
        isMock: true,
      };
      await generatePDF(caseData, explanation);
      setS5({ status: 'pass', data: { message: 'PDF generated successfully' }, error: null });
    } catch (err) {
      setS5({ status: 'fail', data: null, error: err.message || 'PDF generation failed' });
    }
  }, [s3.data, s4.data]);

  /* ── Run All ────────────────────────────────────────────── */
  const [runningAll, setRunningAll] = useState(false);
  const runAll = useCallback(async () => {
    setRunningAll(true);
    await runHealth();
    await runMockData();
    const screenResult = await runScreening();
    const caseId = screenResult?.caseId || screenResult?.id;
    await runExplain(caseId);
    await runPDF();
    setRunningAll(false);
  }, [runHealth, runMockData, runScreening, runExplain, runPDF]);

  return (
    <main id="diagnostic-page" style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '780px' }}>

      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '12px',
      }}>
        <div>
          <h1 style={{ margin: '0 0 4px', color: 'var(--color-neutral-900)', fontSize: '1.5rem' }}>
            System Diagnostic
          </h1>
          <p style={{ margin: 0, color: 'var(--color-neutral-500)', fontSize: '0.85rem' }}>
            Developer-only — verifies backend health, data layer, screening pipeline, XAI, and PDF generation.
          </p>
        </div>
        <button
          id="run-all-tests-btn"
          onClick={runAll}
          disabled={runningAll}
          style={{
            padding: '10px 24px', borderRadius: '10px', border: 'none',
            background: runningAll
              ? 'var(--color-neutral-300)'
              : 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))',
            color: 'var(--clr-text-inverse)', fontWeight: 700, fontSize: '0.9rem',
            cursor: runningAll ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-body)',
            display: 'flex', alignItems: 'center', gap: '8px',
            boxShadow: '0 4px 14px rgba(124,154,133,0.30)',
          }}
        >
          {runningAll && <Spinner />}
          {runningAll ? 'Running…' : 'Run All Tests'}
        </button>
      </div>

      {/* Section 1 — Backend Health */}
      <Card title="1 — Backend Health" status={s1.status}>
        <button onClick={runHealth} disabled={s1.status === 'running'} style={btnStyle}>
          {s1.status === 'running' ? 'Checking…' : 'Re-check'}
        </button>
        {s1.error && (
          <div style={{ marginTop: '8px' }}>
            <Row label="Error" value={s1.error} />
            <span style={mockBadge}>Mock fallback active</span>
          </div>
        )}
        {s1.data && (
          <div style={{ marginTop: '8px' }}>
            <Row label="Status" value={s1.data.status || '—'} mono />
            <Row label="Version" value={s1.data.version || '—'} mono />
            <Row label="Models loaded (adult)" value={s1.data.modelsLoaded?.adult != null ? String(s1.data.modelsLoaded.adult) : '—'} />
            <Row label="Models loaded (child)" value={s1.data.modelsLoaded?.child != null ? String(s1.data.modelsLoaded.child) : '—'} />
          </div>
        )}
      </Card>

      {/* Section 2 — Mock Data Integrity */}
      <Card title="2 — Mock Data Integrity" status={s2.status}>
        <button onClick={runMockData} disabled={s2.status === 'running'} style={btnStyle}>
          {s2.status === 'running' ? 'Fetching…' : 'Fetch Cases'}
        </button>
        {s2.error && <Row label="Error" value={s2.error} />}
        {s2.data && (
          <div style={{ marginTop: '8px' }}>
            <Row label="Total cases" value={s2.data.length} mono />
            {s2.data.slice(0, 3).map((c) => (
              <Row
                key={c.id}
                label={c.id}
                value={`${c.category || '—'} · ${c.dataSource || 'unknown'}`}
                mono
              />
            ))}
          </div>
        )}
      </Card>

      {/* Section 3 — Screening Submission Test */}
      <Card title="3 — Screening Submission Test" status={s3.status}>
        <button onClick={runScreening} disabled={s3.status === 'running'} style={btnStyle}>
          {s3.status === 'running' ? 'Submitting…' : 'Run Test Submission'}
        </button>
        {s3.error && <Row label="Error" value={s3.error} />}
        {s3.data && (
          <div style={{ marginTop: '8px' }}>
            <Row label="Case ID" value={s3.data.caseId || s3.data.id || '—'} mono />
            <Row label="Risk level" value={s3.data.riskLevel || '—'} />
            <Row label="Fusion score" value={s3.data.fusionScore ?? s3.data.riskScore ?? '—'} mono />
            <Row label="Is mock" value={String(s3.data.isMock ?? '—')} />
          </div>
        )}
      </Card>

      {/* Section 4 — Explainability Test */}
      <Card title="4 — Explainability Test" status={s4.status}>
        <button onClick={() => runExplain()} disabled={s4.status === 'running'} style={btnStyle}>
          {s4.status === 'running' ? 'Fetching…' : 'Fetch Explanation'}
        </button>
        {s4.error && <Row label="Error" value={s4.error} />}
        {s4.data && (
          <div style={{ marginTop: '8px' }}>
            <Row label="SHAP features" value={(s4.data.shap || []).length} mono />
            <Row label="LIME features" value={(s4.data.lime || []).length} mono />
            {(s4.data.shap || []).slice(0, 2).map((f, i) => (
              <Row key={i} label={`SHAP #${i + 1}`} value={f.feature} mono />
            ))}
            <Row
              label="Summary"
              value={(s4.data.summary || '').length > 100
                ? s4.data.summary.slice(0, 100) + '…'
                : s4.data.summary || '—'}
            />
          </div>
        )}
      </Card>

      {/* Section 5 — PDF Generation Test */}
      <Card title="5 — PDF Generation Test" status={s5.status}>
        <button onClick={runPDF} disabled={s5.status === 'running'} style={btnStyle}>
          {s5.status === 'running' ? 'Generating…' : 'Test PDF Generation'}
        </button>
        {s5.error && <Row label="Error" value={s5.error} />}
        {s5.data && (
          <div style={{ marginTop: '8px' }}>
            <Row label="Result" value={s5.data.message} />
          </div>
        )}
      </Card>
    </main>
  );
}

/* ── Shared inline styles ────────────────────────────────── */
const btnStyle = {
  padding: '6px 16px', borderRadius: '8px',
  border: '1px solid var(--color-neutral-200)',
  backgroundColor: 'var(--clr-surface)', color: 'var(--color-neutral-700)',
  fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
  fontFamily: 'var(--font-body)',
};

const mockBadge = {
  display: 'inline-block', marginTop: '6px',
  padding: '3px 10px', borderRadius: '999px',
  backgroundColor: '#FFF3CD', color: '#826A14',
  fontSize: '0.7rem', fontWeight: 700,
  fontFamily: 'var(--font-mono)',
  border: '1px solid #C8A03C',
};
