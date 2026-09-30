import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { NeuroSenseLogo } from '../branding/NeuroSenseLogo';
import ProgressIndicator from './ProgressIndicator';
import MetricCard from './MetricCard';
import RiskGauge from '../results/RiskGauge';
import FusionVisualization from '../results/FusionVisualization';
import ExplanationPanel from '../results/ExplanationPanel';
import QuestionFlow from '../screening/QuestionFlow';

const STEPS = ['Questionnaire', 'Gaze', 'Speech', 'Analysis', 'Results'].map((label, i) => ({ id: String(i), label }));

describe('brand + progress', () => {
  it('logo exposes an accessible name and wordmark', () => {
    render(<NeuroSenseLogo descriptor />);
    expect(screen.getByRole('img', { name: 'NeuroSense' })).toBeInTheDocument();
    expect(screen.getByText('NEUROSENSE')).toBeInTheDocument();
  });

  it('progress shows the real step position only', () => {
    render(<ProgressIndicator steps={STEPS} current={1} />);
    expect(screen.getByText(/Step 2 of 5/)).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /screening progress/i })).toBeInTheDocument();
    expect(document.querySelector('[aria-current="step"]').textContent).toMatch(/Gaze/);
    expect(document.body.textContent).not.toMatch(/\d+%/);   // no invented percentage
  });
});

describe('never invents values', () => {
  it('metric card without a value says unavailable', () => {
    render(<MetricCard label="Average AQ-10" value={null} />);
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
  });

  it('gauge renders "Not available" when the backend gave no value', () => {
    render(<RiskGauge value={null} />);
    expect(screen.getByRole('img', { name: /not available/i })).toBeInTheDocument();
  });

  it('gauge reports exactly the backend value', () => {
    render(<RiskGauge value={0.4345} level="Moderate" />);
    expect(screen.getByRole('img', { name: /43 percent, Moderate/ })).toBeInTheDocument();
  });

  it('fusion diagram marks unavailable signals and shows their status on focus', () => {
    const items = [
      { id: 'questionnaire', label: 'Questionnaire', available: true, used: true, contribution: 1, stateLabel: 'Scored · used', detail: 'Probability 43%.' },
      { id: 'gaze', label: 'Gaze', available: false, used: false, contribution: 0, stateLabel: 'Skipped', detail: 'No usable signal.' },
      { id: 'speech', label: 'Speech', available: false, used: false, contribution: 0, stateLabel: 'Skipped', detail: 'No usable signal.' },
    ];
    render(<FusionVisualization items={items} finalValue={0.4345} level="Moderate" />);
    expect(screen.getByText('43%')).toBeInTheDocument();
    fireEvent.focus(screen.getByLabelText(/^Gaze: Skipped/));
    expect(screen.getByRole('status')).toHaveTextContent('Gaze: No usable signal.');
  });
});

describe('explanation panel', () => {
  const features = [
    { feature: 'Child age', shapValue: 0.4, direction: 'positive' },
    { feature: 'Notices small sounds', shapValue: -0.2, direction: 'negative' },
  ];
  it('splits factors by direction and reveals technical detail on demand', () => {
    render(<ExplanationPanel features={features} lime={[{ feature: 'Child age', weight: 0.3, plainEnglish: 'Older age raised the score.', direction: 'positive' }]} summary="Because." modelUsed="child_AdaBoost" category="child" />);
    expect(screen.getByText(/Factors increasing the score/)).toBeInTheDocument();
    expect(screen.getByText('+0.40')).toBeInTheDocument();
    expect(screen.getByText('-0.20')).toBeInTheDocument();
    expect(screen.queryByText('LIME local explanation')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /technical view/i }));
    expect(screen.getByText('LIME local explanation')).toBeInTheDocument();
    expect(screen.getByText('child_AdaBoost')).toBeInTheDocument();
  });
  it('shows an error state without inventing factors', () => {
    render(<ExplanationPanel features={[]} error="x" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn.t generate the explanation/i);
  });
});

describe('question flow', () => {
  const qs = [{ id: 'A1', prompt: 'First?' }, { id: 'A2', prompt: 'Second?' }];
  it('is a radio group, records the answer and advances', async () => {
    vi.useFakeTimers();
    const onAnswer = vi.fn();
    render(<QuestionFlow questions={qs} answers={{}} onAnswer={onAnswer} options={['Yes', 'No']} />);
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Yes' }));
    expect(onAnswer).toHaveBeenCalledWith('A1', 'Yes');
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(screen.getByText('Second?')).toBeInTheDocument();
    vi.useRealTimers();
  });
});
