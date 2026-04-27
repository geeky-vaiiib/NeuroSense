/**
 * Screening.jsx
 * Manage and administer neurodevelopmental screening assessments.
 */

import React, { useState } from 'react';
import { useScreening } from '../hooks/useScreening';
import RiskBadge from '../components/RiskBadge';

const conditionColors = {
  ASD: 'var(--color-primary)',
  ADHD: 'var(--color-risk-moderate)',
  'Executive Function': 'var(--color-secondary)',
  Dyslexia: 'var(--color-risk-high)',
};

const styles = {
  page: { display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' },
  toolsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 'var(--space-5)',
  },
  toolCard: (active) => ({
    backgroundColor: 'var(--color-bg-card)',
    border: `1.5px solid ${active ? 'var(--color-primary)' : 'var(--color-neutral-200)'}`,
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--space-6)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-4)',
    cursor: 'pointer',
    transition: 'all var(--transition-base)',
    boxShadow: active ? 'var(--shadow-primary)' : 'var(--shadow-sm)',
    backgroundColor: active ? 'var(--color-primary-subtle)' : 'var(--color-bg-card)',
  }),
  toolName: {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 'var(--font-weight-bold)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--color-neutral-900)',
  },
  toolFullName: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-neutral-500)',
    lineHeight: 'var(--line-height-snug)',
  },
  conditionTag: (condition) => ({
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 'var(--radius-full)',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 'var(--font-weight-semibold)',
    fontFamily: 'var(--font-mono)',
    color: conditionColors[condition] || 'var(--color-secondary)',
    backgroundColor: `${conditionColors[condition] || 'var(--color-secondary)'}18`,
    letterSpacing: 'var(--letter-spacing-wide)',
  }),
  metaRow: {
    display: 'flex',
    gap: 'var(--space-4)',
  },
  metaItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  metaLabel: {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-neutral-400)',
    letterSpacing: 'var(--letter-spacing-wide)',
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: 'var(--font-size-sm)',
    fontFamily: 'var(--font-mono)',
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-neutral-700)',
  },
  startBtn: {
    marginTop: 'auto',
    padding: 'var(--space-3) var(--space-5)',
    borderRadius: 'var(--radius-lg)',
    border: 'none',
    backgroundColor: 'var(--color-primary)',
    color: '#fff',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-semibold)',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
    fontFamily: 'var(--font-body)',
    letterSpacing: 'var(--letter-spacing-wide)',
    width: '100%',
    boxShadow: 'var(--shadow-primary)',
  },
  sessionPanel: {
    backgroundColor: 'var(--color-bg-card)',
    border: '1px solid var(--color-neutral-200)',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--space-8)',
    boxShadow: 'var(--shadow-md)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-6)',
  },
  progressBar: {
    height: '6px',
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'var(--color-neutral-200)',
    overflow: 'hidden',
  },
  progressFill: (pct) => ({
    height: '100%',
    width: `${pct}%`,
    borderRadius: 'var(--radius-full)',
    background: 'linear-gradient(90deg, var(--color-primary-dark), var(--color-primary))',
    transition: 'width var(--transition-slow)',
  }),
  resultCard: {
    backgroundColor: 'var(--color-bg)',
    border: '1px solid var(--color-neutral-200)',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--space-6)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-4)',
    alignItems: 'center',
    textAlign: 'center',
  },
};

export default function Screening() {
  const {
    availableTools,
    activeTool,
    activeToolId,
    progress,
    result,
    isSubmitting,
    selectTool,
    submitScreening,
    reset,
  } = useScreening();

  const [patientId] = useState('NS-2024-DEMO');

  const handleStart = (toolId) => {
    selectTool(toolId);
  };

  const handleSubmit = async () => {
    await submitScreening(patientId);
  };

  if (result) {
    return (
      <main id="screening-page" style={styles.page}>
        <div style={styles.sessionPanel}>
          <div style={styles.resultCard}>
            <div style={{ fontSize: 'var(--font-size-4xl)' }}>✓</div>
            <h2 style={{ color: 'var(--color-neutral-900)' }}>Screening Complete</h2>
            <RiskBadge level={result.riskLevel} size="lg" showScore score={result.riskLevel === 'high' ? 0.87 : result.riskLevel === 'moderate' ? 0.63 : 0.18} />
            <p style={{ color: 'var(--color-neutral-500)', fontSize: 'var(--font-size-sm)' }}>
              Session ID: <code style={{ fontFamily: 'var(--font-mono)' }}>{result.sessionId}</code>
            </p>
            {result.mock && <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-neutral-400)' }}>Demo mode — backend not connected</p>}
            <button id="screening-reset-btn" onClick={reset} style={{ ...styles.startBtn, width: 'auto', padding: 'var(--space-3) var(--space-8)' }}>
              Start Another Screening
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (activeTool) {
    return (
      <main id="screening-session-page" style={styles.page}>
        <div style={styles.sessionPanel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={styles.conditionTag(activeTool.targetCondition)}>{activeTool.targetCondition}</span>
              <h2 style={{ marginTop: 'var(--space-3)', color: 'var(--color-neutral-900)' }}>{activeTool.fullName}</h2>
              <p style={{ color: 'var(--color-neutral-500)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-1)' }}>
                {activeTool.questions} questions · Est. {activeTool.duration}
              </p>
            </div>
            <button id="screening-cancel-btn" onClick={reset} style={{ ...styles.startBtn, width: 'auto', backgroundColor: 'var(--color-neutral-200)', color: 'var(--color-neutral-700)', boxShadow: 'none' }}>
              Cancel
            </button>
          </div>

          {/* Progress */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-neutral-400)' }}>Progress</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', color: 'var(--color-neutral-600)' }}>{progress}%</span>
            </div>
            <div style={styles.progressBar}>
              <div style={styles.progressFill(progress)} />
            </div>
          </div>

          <p style={{ color: 'var(--color-neutral-500)', textAlign: 'center', padding: 'var(--space-8) 0' }}>
            Screening questions would render here. Connect your question bank to proceed.
          </p>

          <button
            id="screening-submit-btn"
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{ ...styles.startBtn, opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
          >
            {isSubmitting ? 'Submitting…' : 'Submit Screening'}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main id="screening-page" style={styles.page}>
      <p style={{ color: 'var(--color-neutral-500)' }}>
        Select a validated neurodevelopmental screening tool to begin an assessment session.
      </p>

      <div style={styles.toolsGrid}>
        {availableTools.map((tool) => (
          <div key={tool.id} style={styles.toolCard(activeToolId === tool.id)} role="article">
            <div>
              <span style={styles.conditionTag(tool.targetCondition)}>{tool.targetCondition}</span>
            </div>
            <div>
              <div style={styles.toolName}>{tool.name}</div>
              <div style={styles.toolFullName}>{tool.fullName}</div>
            </div>
            <div style={styles.metaRow}>
              <div style={styles.metaItem}>
                <span style={styles.metaLabel}>Duration</span>
                <span style={styles.metaValue}>{tool.duration}</span>
              </div>
              <div style={styles.metaItem}>
                <span style={styles.metaLabel}>Questions</span>
                <span style={styles.metaValue}>{tool.questions}</span>
              </div>
            </div>
            <button
              id={`start-screening-${tool.id}`}
              style={styles.startBtn}
              onClick={() => handleStart(tool.id)}
              aria-label={`Start ${tool.name} screening`}
            >
              Start Screening →
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
