/**
 * Screening.jsx — Upgraded tool cards: colour bands, Popular badge,
 * condition chips, estimated time bar, session flow.
 */
import React, { useState } from 'react';
import { useScreening } from '../hooks/useScreening';
import RiskBadge from '../components/RiskBadge';

const CONDITION_COLORS = {
  'Autism Spectrum':       { color: '#7C9A85', bg: 'rgba(124,154,133,0.1)',  border: 'rgba(124,154,133,0.25)' },
  'ADHD':                  { color: '#B8873A', bg: 'rgba(184,135,58,0.08)', border: 'rgba(184,135,58,0.22)' },
  'Executive Function':    { color: '#8A8178', bg: 'rgba(138,129,120,0.1)', border: 'rgba(138,129,120,0.22)' },
  'Dyslexia / Dyscalculia':{ color: '#5E7A67', bg: 'rgba(94,122,103,0.1)',  border: 'rgba(94,122,103,0.22)' },
  'Substance Use':         { color: '#C0555A', bg: 'rgba(192,85,90,0.08)',  border: 'rgba(192,85,90,0.20)' },
  'Autism / Social':       { color: '#7C9A85', bg: 'rgba(124,154,133,0.1)', border: 'rgba(124,154,133,0.25)' },
};

const POPULAR = ['RAADS-R', 'ASRS-v1.1'];

function ToolCard({ tool, onStart, isActive }) {
  const [hov, setHov] = useState(false);
  const cc = CONDITION_COLORS[tool.targetCondition] || CONDITION_COLORS['Executive Function'];
  const pop = POPULAR.includes(tool.id);

  return (
    <article
      id={`tool-card-${tool.id}`}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        backgroundColor: 'var(--color-bg-card)',
        border: `1px solid ${hov ? cc.border : 'var(--color-neutral-200)'}`,
        borderRadius: '14px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        boxShadow: hov ? 'var(--shadow-md)' : 'var(--shadow-xs)',
        transform: hov ? 'translateY(-2px)' : 'none',
        transition: 'all 220ms cubic-bezier(.4,0,.2,1)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Colour band top */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
        backgroundColor: cc.color, opacity: 0.75,
      }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        {/* Icon square */}
        <div style={{
          width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
          backgroundColor: cc.bg, border: `1px solid ${cc.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.125rem',
        }}>
          {tool.targetCondition === 'Autism Spectrum' || tool.targetCondition === 'Autism / Social' ? '🧠' :
           tool.targetCondition === 'ADHD' ? '⚡' :
           tool.targetCondition === 'Executive Function' ? '📊' :
           tool.targetCondition === 'Dyslexia / Dyscalculia' ? '📖' : '🔍'}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-neutral-900)' }}>
              {tool.id}
            </span>
            {pop && (
              <span style={{
                padding: '1px 7px', borderRadius: '999px',
                backgroundColor: 'var(--color-primary-muted)',
                color: 'var(--color-primary-dark)',
                fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>Popular</span>
            )}
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--color-neutral-500)', marginTop: '2px', lineHeight: 1.3 }}>
            {tool.fullName}
          </div>
        </div>
      </div>

      {/* Condition tag */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px', alignSelf: 'flex-start',
        padding: '3px 10px', borderRadius: '6px',
        backgroundColor: cc.bg, border: `1px solid ${cc.border}`,
        fontSize: '0.75rem', fontWeight: 600, color: cc.color,
      }}>
        {tool.targetCondition}
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: '16px' }}>
        {[
          { icon: '⏱', label: tool.duration },
          { icon: '❓', label: `${tool.questions} questions` },
          { icon: '✅', label: 'Validated' },
        ].map(({ icon, label }) => (
          <span key={label} style={{
            fontSize: '0.75rem', color: 'var(--color-neutral-500)',
            display: 'flex', alignItems: 'center', gap: '4px',
          }}>
            <span style={{ fontSize: '12px' }}>{icon}</span>
            {label}
          </span>
        ))}
      </div>

      {/* Progress bar (time estimate) */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
          <span style={{ fontSize: '0.6875rem', color: 'var(--color-neutral-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estimated time</span>
          <span style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: cc.color, fontWeight: 600 }}>{tool.duration}</span>
        </div>
        <div style={{ height: '5px', borderRadius: '999px', backgroundColor: 'var(--color-neutral-100)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: '999px',
            backgroundColor: cc.color,
            width: `${Math.min(100, (tool.questions / 80) * 100)}%`,
            transition: 'width 600ms',
          }} />
        </div>
      </div>

      {/* CTA */}
      <button
        id={`start-screening-${tool.id}`}
        onClick={() => onStart(tool)}
        style={{
          height: '38px', borderRadius: '10px', border: 'none',
          background: isActive
            ? 'var(--color-neutral-200)'
            : `linear-gradient(135deg, ${cc.color}, ${cc.color}cc)`,
          color: isActive ? 'var(--color-neutral-500)' : '#fff',
          fontSize: '0.875rem', fontWeight: 600,
          cursor: isActive ? 'not-allowed' : 'pointer',
          fontFamily: 'var(--font-body)',
          transition: 'all 150ms',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        }}
        disabled={isActive}
        aria-label={`Start ${tool.id} screening`}
      >
        {isActive ? 'Session Active' : (
          <>
            Start Screening
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
          </>
        )}
      </button>
    </article>
  );
}

export default function Screening() {
  const { availableTools, activeTool, selectTool, progress, result, isSubmitting, submitScreening, resetSession } = useScreening();
  const [patientId] = useState(`PAT-${Date.now().toString(36).toUpperCase()}`);

  if (result) {
    return (
      <main id="screening-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'center', paddingTop: '40px' }}>
        <div style={{
          width: '100%', maxWidth: '520px',
          backgroundColor: 'var(--color-bg-card)',
          border: '1px solid var(--color-neutral-200)',
          borderRadius: '20px', padding: '40px',
          textAlign: 'center', boxShadow: 'var(--shadow-lg)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px',
        }}>
          <div style={{ fontSize: '3rem' }}>🎉</div>
          <div>
            <h2 style={{ fontSize: '1.375rem', fontWeight: 700, margin: '0 0 6px', color: 'var(--color-neutral-900)' }}>Screening Complete</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-neutral-500)' }}>Session {result.sessionId}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <RiskBadge level={result.riskLevel} size="lg" showScore score={result.score} />
            <p style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)', maxWidth: '340px', lineHeight: 1.6 }}>
              {result.recommendation}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={resetSession} style={{
              padding: '10px 22px', borderRadius: '10px', border: 'none',
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))',
              color: '#fff', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.875rem',
            }}>Start Another</button>
            <button onClick={() => window.location.href = '/app/results'} style={{
              padding: '10px 22px', borderRadius: '10px',
              border: '1px solid var(--color-neutral-200)',
              backgroundColor: 'var(--color-bg)', color: 'var(--color-neutral-700)',
              fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.875rem',
            }}>View Results →</button>
          </div>
        </div>
      </main>
    );
  }

  if (activeTool) {
    const cc = CONDITION_COLORS[activeTool.targetCondition] || CONDITION_COLORS['Executive Function'];
    return (
      <main id="screening-active" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Session card */}
        <div style={{
          backgroundColor: 'var(--color-bg-card)',
          border: '1px solid var(--color-neutral-200)',
          borderRadius: '16px', padding: '28px',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div style={{
              padding: '3px 12px', borderRadius: '999px',
              backgroundColor: cc.bg, border: `1px solid ${cc.border}`,
              fontSize: '0.75rem', fontWeight: 700, color: cc.color,
              fontFamily: 'var(--font-mono)',
            }}>{activeTool.id}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)' }}>{activeTool.fullName}</div>
            <div style={{ marginLeft: 'auto', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--color-neutral-400)' }}>
              Patient: {patientId}
            </div>
          </div>

          {/* Progress */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--color-neutral-600)', fontWeight: 500 }}>Administration Progress</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: cc.color, fontWeight: 700 }}>{Math.round(progress)}%</span>
            </div>
            <div style={{ height: '8px', borderRadius: '999px', backgroundColor: 'var(--color-neutral-100)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: '999px',
                background: `linear-gradient(90deg, ${cc.color}, ${cc.color}aa)`,
                width: `${progress}%`, transition: 'width 500ms',
              }} />
            </div>
          </div>

          <p style={{ fontSize: '0.875rem', color: 'var(--color-neutral-500)', lineHeight: 1.6 }}>
            Administer the {activeTool.fullName} ({activeTool.questions} items) to the patient.
            Mark responses and submit to generate the AI-assisted risk report.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            id="submit-screening-btn"
            onClick={() => submitScreening(patientId)}
            disabled={isSubmitting}
            style={{
              padding: '11px 28px', borderRadius: '10px', border: 'none',
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))',
              color: '#fff', fontWeight: 600, cursor: isSubmitting ? 'wait' : 'pointer',
              fontFamily: 'var(--font-body)', fontSize: '0.9375rem',
              boxShadow: '0 4px 14px rgba(124,154,133,0.30)',
              opacity: isSubmitting ? 0.75 : 1,
            }}
          >
            {isSubmitting ? 'Generating Report…' : 'Submit & Generate Report →'}
          </button>
          <button
            id="cancel-screening-btn"
            onClick={resetSession}
            style={{
              padding: '11px 22px', borderRadius: '10px',
              border: '1px solid var(--color-neutral-200)',
              backgroundColor: 'var(--color-bg)', color: 'var(--color-neutral-600)',
              cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.875rem',
            }}
          >Cancel</button>
        </div>
      </main>
    );
  }

  return (
    <main id="screening-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Intro banner */}
      <div style={{
        padding: '20px 24px',
        backgroundColor: 'var(--color-primary-subtle)',
        border: '1px solid var(--border-primary)',
        borderRadius: '12px',
        display: 'flex', alignItems: 'center', gap: '14px',
      }}>
        <span style={{ fontSize: '1.5rem' }}>🧬</span>
        <div>
          <div style={{ fontWeight: 600, color: 'var(--color-neutral-800)', fontSize: '0.9375rem' }}>Select a Screening Tool</div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--color-neutral-500)', marginTop: '2px' }}>
            Choose a validated instrument below. Each generates a SHAP-explained risk report on completion.
          </div>
        </div>
      </div>

      {/* Tool grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
        gap: '16px',
      }}>
        {availableTools.map((tool) => (
          <ToolCard
            key={tool.id}
            tool={tool}
            onStart={selectTool}
            isActive={!!activeTool}
          />
        ))}
      </div>
    </main>
  );
}
