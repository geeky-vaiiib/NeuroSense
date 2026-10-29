import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { NeuroSenseLogo } from '../branding/NeuroSenseLogo';
import ProgressIndicator from './ProgressIndicator';
import MetricCard from './MetricCard';
import RiskGauge from '../results/RiskGauge';
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
});

describe('explanation panel', () => {
  const features = [
    { feature: 'Child age', shapValue: 0.4, direction: 'positive' },
    { feature: 'Notices small sounds', shapValue: -0.2, direction: 'negative' },
  ];
  it('splits factors by direction and reveals technical detail on demand', () => {
    render(<ExplanationPanel features={features} lime={[{ feature: 'Child age', weight: 0.3, plainEnglish: 'Older age raised the model output.', direction: 'positive' }]} modelUsed="child_AdaBoost" category="child" />);
    expect(screen.getByText(/Factors raising the model output/)).toBeInTheDocument();
    expect(screen.getByText('+0.40')).toBeInTheDocument();
    expect(screen.getByText('-0.20')).toBeInTheDocument();
    expect(screen.queryByText('LIME local explanation')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /technical view/i }));
    expect(screen.getByText('LIME local explanation')).toBeInTheDocument();
    expect(screen.getByText('child_AdaBoost')).toBeInTheDocument();
  });

  it('keeps the score explanation and the model explanation apart, and says when the model explanation is unavailable', () => {
    const scoreExplanation = { instrument: 'AQ-10 (child, caregiver-completed)', total_score: 1, max_score: 10, threshold: 7,
      items: [{ id: 'A1', answer: 'Definitely agree', scores_on: 'agree', points: 1 }, { id: 'A2', answer: 'Definitely agree', scores_on: 'disagree', points: 0 }] };
    render(<ExplanationPanel features={[]} lime={[]} category="child" scoreExplanation={scoreExplanation}
      modelExplanation={{ available: false, reason: 'No questionnaire ML model is loaded on the server.', scope: 'Describes the model, not the result.' }} />);
    expect(screen.getByText(/How the questionnaire score was formed/)).toBeInTheDocument();
    expect(screen.getByText(/does not decide the result/)).toBeInTheDocument();
    expect(screen.getByText(/Model explanation unavailable: No questionnaire ML model/)).toBeInTheDocument();
    expect(screen.queryByText(/Factors raising/)).not.toBeInTheDocument();
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
