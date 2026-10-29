import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ModalityStatusGrid from './ModalityStatusGrid';
import ScoreMeter from './ScoreMeter';
import ResultBasis from './ResultBasis';
import SpeechMeasurements from './SpeechMeasurements';
import { isServerScored, modalityStates } from '../../utils/caseModalities';

const screeningResult = {
  basis: 'questionnaire_score_only', formula: 'result = questionnaire total score vs threshold', risk_level: 'Low',
  total_score: 3, max_score: 10, threshold: 7, composite_probability: null, weights: null,
  modalities_in_result: ['questionnaire'],
  excluded: [{ id: 'gaze', status: 'available_experimental', status_label: 'Experimental · not used in result', reason: 'x' }],
};
const states = [
  { id: 'questionnaire', label: 'Questionnaire score', status: 'available_scoring_instrument', status_label: 'Scoring rule · used', in_result: true,
    output: { kind: 'screening_score', total: 3, max: 10, threshold: 7 }, quality: null },
  { id: 'gaze', label: 'Eye gaze (OpenFace, experimental)', status: 'available_experimental', status_label: 'Experimental · not used in result', in_result: false,
    output: { kind: 'experimental_classifier_output', value: 0.97 }, reason: 'Excluded from the result: no webcam / labelled deployment validation.',
    model: { version: 'gaze-openface-dasd-v3', validated: false }, quality: { sample_count: 900, valid_sample_count: 890, duration_seconds: 30, data_quality_score: 0.97 } },
  { id: 'speech', label: 'Speech', status: 'model_unavailable', status_label: 'No validated model', in_result: false, output: null, reason: 'no classifier' },
  { id: 'facial', label: 'Facial (face detection only)', status: 'failed_quality', status_label: 'Failed quality check', in_result: false, output: null, measurements: { face_detected: false } },
];

describe('result presentation', () => {
  it('an experimental 97% gaze output is labelled experimental and "not used"; unavailable modalities show no number', () => {
    render(<ModalityStatusGrid states={states} />);
    const gaze = screen.getByLabelText(/^Eye gaze.*Experimental/);
    expect(within(gaze).getByText('Not used for the result')).toBeInTheDocument();
    expect(within(gaze).getByText(/experimental model output — research signal only/)).toBeInTheDocument();
    expect(within(gaze).getByText(/890\/900 usable frames/)).toBeInTheDocument();
    for (const name of [/^Speech/, /^Facial/]) {
      const card = screen.getByLabelText(name);
      expect(within(card).queryByText(/%/)).toBeNull();
      expect(within(card).getByText('No output')).toBeInTheDocument();
      expect(within(card).getByText('Not used for the result')).toBeInTheDocument();
    }
    expect(within(screen.getByLabelText(/^Questionnaire score/)).getByText('Used for the result')).toBeInTheDocument();
  });

  it('shows the stored score and threshold and never a probability', () => {
    render(<ScoreMeter basis={{ total_score: 3, max_score: 10, threshold: 7, instrument: 'AQ-10 (child, caregiver-completed)' }} level="Low" />);
    expect(screen.getByLabelText('Score 3 out of 10')).toBeInTheDocument();
    expect(screen.getByText(/THRESHOLD ≥ 7/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/%/);
  });

  it('states what produced the result and that no composite probability exists', () => {
    render(<ResultBasis result={screeningResult} />);
    expect(screen.getByText(/total 3\/10, threshold ≥ 7/)).toBeInTheDocument();
    expect(screen.getByText(/gaze \(Experimental · not used in result\)/)).toBeInTheDocument();
    expect(screen.getByText(/There is no combined probability or weighting/)).toBeInTheDocument();
  });

  it('speech card shows measurements and status but no score, risk or flags', () => {
    render(<SpeechMeasurements state={{ status_label: 'No validated model' }} features={{ pitch_std: 21.3, pitch_mean: 180, voiced_fraction: 0.6, speech_rate: 3.2, energy_mean: 0.02 }} />);
    expect(screen.getByText('21.3 Hz')).toBeInTheDocument();
    expect(screen.getByText(/produces no screening score/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/risk score|flag/i);
  });

  it('old cases are marked as legacy and nothing is recomputed or promoted to "used"', () => {
    const legacy = { modality_breakdown: [{ modality: 'questionnaire', available: true, score: 0.91 }, { modality: 'gaze', available: false }] };
    expect(isServerScored(legacy)).toBe(false);
    const st = modalityStates(legacy);
    expect(st.find((m) => m.id === 'questionnaire')).toMatchObject({ legacy: true, in_result: false, eligible_for_result: false });
    expect(st.find((m) => m.id === 'gaze').output).toBeNull();
    expect(modalityStates(null)).toEqual([]);
    expect(modalityStates({ modality_states: states })).toBe(states);
  });
});

// ── whole results page against a mocked API: it must show the stored server values only ──
vi.mock('../../services/api', () => {
  const stored = {
    id: 'NS-C-1', category: 'child', categoryLabel: 'Child', subjectName: 'T', riskLevel: 'Low', riskScore: null, aq10Score: 3, age: 8, gender: 'Male',
    screeningTool: 'Child AQ-10', modelUsed: 'child_AdaBoostClassifier', status: 'pending-review', interpretation: 'Lower concentration of traits.',
    scoring_version: 2, fusion_score: null, questionnaire_probability: 0.58, questionnaire_basis: {
      total_score: 3, max_score: 10, threshold: 7, instrument: 'AQ-10 (child, caregiver-completed)', items: [], notice: 'Threshold-based screening score.' },
    screening_result: screeningResult, modality_states: states, modality_breakdown: [], speech_features: {}, gaze_status: 'success',
    gaze_score: 0.97, gaze_quality: { sample_count: 900, valid_sample_count: 890, duration_seconds: 30, valid_sample_ratio: 0.99, tracking_continuity: 1, data_quality_score: 0.97 },
    gaze_features: { prediction: 'asd_signal' }, gaze_fusion_eligible: false, gaze_model_version: 'gaze-openface-dasd-v3' };
  return {
    casesApi: { list: vi.fn(async () => [stored]), get: vi.fn(async () => stored) },
    explainApi: { get: vi.fn(async () => ({ caseId: 'NS-C-1', shap: [], lime: [], summary: 'x', scoreExplanation: null, modelExplanation: { available: false, reason: 'No questionnaire ML model is loaded on the server.', scope: 's' } })) },
    gazeApi: {}, screeningApi: {}, healthApi: {}, authApi: {},
  };
});

describe('Results page consistency', () => {
  beforeEach(() => localStorage.clear());
  it('displays the server total, the status contract and no composite probability', async () => {
    const { default: Results } = await import('../../pages/Results');
    render(<MemoryRouter initialEntries={['/app/results/NS-C-1']}><Routes><Route path="/app/results/:caseId" element={<Results />} /></Routes></MemoryRouter>);
    expect(await screen.findByLabelText('Score 3 out of 10')).toBeInTheDocument();
    expect(screen.getAllByText(/Used for the result/).length).toBe(1);                       // only the questionnaire
    expect(screen.getAllByText(/Not used for the result/).length).toBe(3);
    expect(screen.getByText(/Score against threshold — no combined probability/)).toBeInTheDocument();
    expect(screen.getByText(/Model explanation unavailable: No questionnaire ML model/)).toBeInTheDocument();
    expect(screen.queryByText(/Overall indicator/i)).toBeNull();
    expect(screen.queryByText(/Speech risk score/)).toBeNull();
  });
});
