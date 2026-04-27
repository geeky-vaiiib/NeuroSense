/**
 * Results.jsx
 * SHAP-explained screening results with waterfall feature visualization.
 */

import React, { useState, useEffect } from 'react';
import { useShap } from '../hooks/useShap';
import { MOCK_CASES } from '../data/mockData';
import RiskBadge from '../components/RiskBadge';
import Modal from '../components/Modal';

const styles = {
  page: { display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' },
  caseSelector: {
    display: 'flex',
    gap: 'var(--space-3)',
    overflowX: 'auto',
    paddingBottom: 'var(--space-2)',
  },
  caseChip: (active) => ({
    flexShrink: 0,
    padding: 'var(--space-2) var(--space-4)',
    borderRadius: 'var(--radius-full)',
    border: `1.5px solid ${active ? 'var(--color-primary)' : 'var(--color-neutral-200)'}`,
    backgroundColor: active ? 'var(--color-primary-muted)' : 'var(--color-bg-card)',
    fontSize: 'var(--font-size-sm)',
    fontFamily: 'var(--font-mono)',
    fontWeight: active ? 'var(--font-weight-semibold)' : 'var(--font-weight-normal)',
    color: active ? 'var(--color-primary-dark)' : 'var(--color-neutral-600)',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
  }),
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 340px',
    gap: 'var(--space-6)',
    alignItems: 'start',
  },
  panel: {
    backgroundColor: 'var(--color-bg-card)',
    border: '1px solid var(--color-neutral-200)',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--space-6)',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-6)',
  },
  panelTitle: {
    fontSize: 'var(--font-size-base)',
    fontWeight: 'var(--font-weight-semibold)',
    color: 'var(--color-neutral-800)',
  },
  featureBar: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-3)',
  },
  featureRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
  },
  featureName: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-neutral-600)',
    width: '200px',
    flexShrink: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  barTrack: {
    flex: 1,
    height: '8px',
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'var(--color-neutral-100)',
    overflow: 'visible',
    position: 'relative',
  },
  shapValue: {
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--font-size-xs)',
    width: '48px',
    textAlign: 'right',
    flexShrink: 0,
  },
};

function ShapBarChart({ features, maxVal }) {
  return (
    <div style={styles.featureBar} role="list" aria-label="SHAP feature importances">
      {features.map((f) => {
        const absMax = maxVal || Math.max(...features.map((x) => Math.abs(x.value)));
        const width = Math.abs(f.value) / absMax * 100;
        const isPositive = f.direction === 'positive';
        const color = isPositive ? 'var(--color-risk-high)' : 'var(--color-risk-low)';

        return (
          <div key={f.name} style={styles.featureRow} role="listitem" aria-label={`${f.name}: ${f.value > 0 ? '+' : ''}${f.value.toFixed(2)}`}>
            <span style={styles.featureName} title={f.name}>{f.name}</span>
            <div style={styles.barTrack}>
              <div
                style={{
                  position: 'absolute',
                  height: '8px',
                  width: `${width}%`,
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: color,
                  opacity: 0.85,
                  left: 0,
                  top: 0,
                  transition: 'width 600ms cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              />
            </div>
            <span style={{ ...styles.shapValue, color }}>
              {f.value > 0 ? '+' : ''}{f.value.toFixed(2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function Results() {
  const { fetchExplanation, explanations, loading, getSortedFeatures } = useShap();
  const [selectedCaseId, setSelectedCaseId] = useState(MOCK_CASES[0].id);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    fetchExplanation(selectedCaseId);
  }, [selectedCaseId, fetchExplanation]);

  const selectedCase = MOCK_CASES.find((c) => c.id === selectedCaseId);
  const explanation = explanations[selectedCaseId];
  const features = getSortedFeatures(selectedCaseId);
  const isLoading = loading[selectedCaseId];

  return (
    <main id="results-page" style={styles.page}>
      {/* Case selector */}
      <nav aria-label="Case selection" style={styles.caseSelector}>
        {MOCK_CASES.map((c) => (
          <button
            key={c.id}
            id={`case-selector-${c.id}`}
            style={styles.caseChip(c.id === selectedCaseId)}
            onClick={() => setSelectedCaseId(c.id)}
            aria-pressed={c.id === selectedCaseId}
          >
            {c.id} — {c.patientName}
          </button>
        ))}
      </nav>

      {selectedCase && (
        <div style={styles.grid}>
          {/* SHAP Panel */}
          <div style={styles.panel}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={styles.panelTitle}>SHAP Feature Contributions</span>
              {explanation?.mock && (
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-neutral-400)', fontFamily: 'var(--font-mono)' }}>
                  demo data
                </span>
              )}
            </div>

            {/* Score gauge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-neutral-400)', marginBottom: 'var(--space-1)' }}>Risk Score</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-neutral-900)' }}>
                  {Math.round(selectedCase.riskScore * 100)}<span style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-neutral-400)' }}>%</span>
                </div>
              </div>
              <RiskBadge level={selectedCase.riskLevel} size="lg" />
            </div>

            {isLoading ? (
              <div style={{ textAlign: 'center', color: 'var(--color-neutral-400)', padding: 'var(--space-8)' }}>
                Loading SHAP values…
              </div>
            ) : (
              <ShapBarChart features={features} />
            )}

            <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--font-size-xs)', color: 'var(--color-neutral-400)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: 'var(--color-risk-high)', display: 'inline-block' }} />
                Increases risk
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: 'var(--color-risk-low)', display: 'inline-block' }} />
                Decreases risk
              </span>
            </div>

            <button
              id="view-full-explanation-btn"
              onClick={() => setModalOpen(true)}
              style={{
                padding: 'var(--space-3) var(--space-5)',
                borderRadius: 'var(--radius-lg)',
                border: '1.5px solid var(--color-primary)',
                backgroundColor: 'transparent',
                color: 'var(--color-primary-dark)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-medium)',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >
              View Full Explanation
            </button>
          </div>

          {/* Case Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={styles.panel}>
              <span style={styles.panelTitle}>Case Summary</span>
              <dl style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {[
                  ['Patient', selectedCase.patientName],
                  ['Age', selectedCase.age],
                  ['Clinician', selectedCase.clinician],
                  ['Diagnosis', selectedCase.diagnosis],
                  ['Screening Date', selectedCase.screeningDate],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                    <dt style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-neutral-400)', textTransform: 'uppercase', letterSpacing: 'var(--letter-spacing-wide)' }}>{label}</dt>
                    <dd style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-neutral-700)', fontWeight: 'var(--font-weight-medium)', textAlign: 'right' }}>{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div style={styles.panel}>
              <span style={styles.panelTitle}>Notes</span>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-neutral-600)', lineHeight: 'var(--line-height-relaxed)' }}>
                {selectedCase.notes}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Full Explanation Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Full SHAP Explanation"
        subtitle={`Case ${selectedCaseId} · ${selectedCase?.diagnosis}`}
        size="lg"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <p style={{ color: 'var(--color-neutral-600)', fontSize: 'var(--font-size-sm)' }}>
            SHAP (SHapley Additive exPlanations) values show how each feature pushes the model output
            above or below the base value of <code style={{ fontFamily: 'var(--font-mono)' }}>{explanation?.baseValue}</code>.
          </p>
          {features.length > 0 && <ShapBarChart features={features} />}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-sm)', color: 'var(--color-neutral-500)', borderTop: '1px solid var(--color-neutral-200)', paddingTop: 'var(--space-4)' }}>
            <span>Base value: {explanation?.baseValue}</span>
            <span>Output: <strong style={{ color: 'var(--color-neutral-800)' }}>{explanation?.outputValue}</strong></span>
          </div>
        </div>
      </Modal>
    </main>
  );
}
