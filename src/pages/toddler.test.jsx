import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QCHAT10, TODDLER_ITEMS, validateAgeMonths, routeForAge } from '../data/toddler';
import ToddlerQuestionFlow from '../components/screening/ToddlerQuestionFlow';
import ToddlerResults from '../components/results/ToddlerResults';
import RiskBadge from '../components/RiskBadge';
import ToddlerScreening from './ToddlerScreening';
import ScreeningStart from './ScreeningStart';

const submit = vi.fn();
vi.mock('../hooks/useScreening', () => ({ useScreening: () => ({ submit: (...a) => submit(...a), loading: false, error: mockError.value }) }));
const mockError = { value: null };

// Expected wording and option order are written out here, independently of the generated config.
const OPTION_SETS = {
  freq: ['Many times a day', 'A few times a day', 'A few times a week', 'Less than once a week', 'Never'],
  always: ['Always', 'Usually', 'Sometimes', 'Rarely', 'Never'],
  ease: ['Very easy', 'Quite easy', 'Quite difficult', 'Very difficult', 'Impossible'],
  words: ['Very typical', 'Quite typical', 'Slightly unusual', 'Very unusual', "My child doesn't speak"],
};
const EXPECTED = [
  ['Q1', 1, 'Does your child look at you when you call his/her name?', 'always'],
  ['Q2', 2, 'How easy is it for you to get eye contact with your child?', 'ease'],
  ['Q3', 5, 'Does your child point to indicate that s/he wants something? (e.g. a toy that is out of reach)', 'freq'],
  ['Q4', 6, 'Does your child point to share interest with you? (e.g. pointing at an interesting sight)', 'freq'],
  ['Q5', 9, 'Does your child pretend? (e.g. care for dolls, talk on a toy phone)', 'freq'],
  ['Q6', 10, "Does your child follow where you're looking?", 'freq'],
  ['Q7', 15, 'If you or someone else in the family is visibly upset, does your child show signs of wanting to comfort them? (e.g. stroking hair, hugging them)', 'always'],
  ['Q8', 17, "Would you describe your child's first words as:", 'words'],
  ['Q9', 19, 'Does your child use simple gestures? (e.g. wave goodbye)', 'freq'],
  ['Q10', 25, 'Does your child stare at nothing with no apparent purpose?', 'freq'],
];

describe('canonical questionnaire config', () => {
  it('has the ten published Q-CHAT-10 items with official wording, item-specific options in printed order and letter values', () => {
    expect(TODDLER_ITEMS).toHaveLength(10);
    EXPECTED.forEach(([id, q25, text, set], i) => {
      const it = TODDLER_ITEMS[i];
      expect(it.id).toBe(id); expect(it.qchat25).toBe(q25); expect(it.text).toBe(text);
      expect(it.options.map((o) => o.label)).toEqual(OPTION_SETS[set]);
      expect(it.options.map((o) => o.value)).toEqual(['A', 'B', 'C', 'D', 'E']);
      expect(it.helper.length).toBeGreaterThan(10);
    });
    expect(QCHAT10.ageMonthsMin).toBe(18); expect(QCHAT10.ageMonthsMax).toBe(24); expect(QCHAT10.officialThreshold).toBe(3);
  });
  it('helper lines never recommend an answer', () => {
    for (const it of TODDLER_ITEMS) expect(it.helper).not.toMatch(/\b(should|best answer|correct|normal|most children|worry)\b/i);
  });
});

describe('age handling', () => {
  it.each([['18', true], ['24', true], ['17', false], ['25', false], ['', false], ['abc', false], ['20.5', false], ['-20', false], ['2', false]])('validateAgeMonths(%s) -> %s', (raw, ok) => {
    const r = validateAgeMonths(raw);
    expect(r.valid).toBe(ok);
    if (!ok) expect(r.message.length).toBeGreaterThan(5);
  });
  it('routes by age and never silently converts an unsupported age', () => {
    expect(routeForAge(20, 'months').track).toBe('toddler');
    expect(routeForAge(1.5, 'years').track).toBe('toddler');
    expect(routeForAge(6, 'years').track).toBe('child');
    for (const [v, u] of [[30, 'months'], [2.5, 'years'], [12, 'months'], [20, 'years'], [0, 'months']]) {
      const r = routeForAge(v, u); expect(r.track).toBeNull(); expect(r.message).toBeTruthy();
    }
  });
  it('the start page explains an unsupported age instead of opening a questionnaire', () => {
    render(<MemoryRouter><ScreeningStart /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Child’s age'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/don’t have a questionnaire for this age/);
  });
});

describe('question flow', () => {
  it('shows one question with its helper, its own options, and a progress label; stores the option LETTER', () => {
    const onAnswer = vi.fn();
    render(<ToddlerQuestionFlow items={TODDLER_ITEMS} answers={{}} onAnswer={onAnswer} onFinish={() => {}} onExit={() => {}} />);
    expect(screen.getByText('Question 1 of 10')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: EXPECTED[0][2] })).toBeInTheDocument();
    expect(screen.getByText(TODDLER_ITEMS[0].helper)).toBeInTheDocument();
    const group = screen.getByRole('radiogroup');
    expect(group).toHaveAccessibleName(EXPECTED[0][2]);
    expect(within(group).getAllByRole('radio').map((r) => r.textContent)).toEqual(OPTION_SETS.always);
    fireEvent.click(screen.getByRole('radio', { name: 'Rarely' }));
    expect(onAnswer).toHaveBeenCalledWith('Q1', 'D');
  });
  it('does not advance without an answer, and says why', () => {
    render(<ToddlerQuestionFlow items={TODDLER_ITEMS} answers={{}} onAnswer={() => {}} onFinish={() => {}} onExit={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(screen.getByRole('alert')).toHaveTextContent(/choose the answer that fits best/);
    expect(screen.getByText('Question 1 of 10')).toBeInTheDocument();
  });
  it('Next / Back move between questions and each question shows its own options; last button reviews', () => {
    const all = Object.fromEntries(TODDLER_ITEMS.map((q) => [q.id, 'A']));
    const finish = vi.fn();
    render(<ToddlerQuestionFlow items={TODDLER_ITEMS} answers={all} onAnswer={() => {}} onFinish={finish} onExit={() => {}} startAt={0} />);
    EXPECTED.forEach(([, , text, set], i) => {
      expect(screen.getByRole('heading', { name: text })).toBeInTheDocument();
      expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual(OPTION_SETS[set]);
      if (i < 9) fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Review answers' }));
    expect(finish).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Back/ }));
    expect(screen.getByText('Question 9 of 10')).toBeInTheDocument();
  });
  it('arrow keys move through the options like a native radio group', () => {
    const onAnswer = vi.fn();
    render(<ToddlerQuestionFlow items={TODDLER_ITEMS} answers={{ Q1: 'A' }} onAnswer={onAnswer} onFinish={() => {}} onExit={() => {}} startAt={0} />);
    const first = screen.getAllByRole('radio')[0];
    expect(first).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(onAnswer).toHaveBeenCalledWith('Q1', 'B');
  });
});

describe('toddler screening page', () => {
  beforeEach(() => { submit.mockReset(); mockError.value = null; });
  const renderPage = () => render(<MemoryRouter initialEntries={['/app/screening/toddler']}><Routes>
    <Route path="/app/screening/toddler" element={<ToddlerScreening />} /><Route path="/app/results/:id" element={<p>RESULT PAGE</p>} /><Route path="/app/screening" element={<p>START</p>} /></Routes></MemoryRouter>);

  async function reachQuestions(age = '20') {
    fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    fireEvent.change(screen.getByLabelText(/Age in months/), { target: { value: age } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  }
  it('blocks an out-of-range age with a plain message', () => {
    renderPage(); reachQuestions('26');
    expect(screen.getByRole('alert')).toHaveTextContent(/designed for children aged 18 to 24 months/);
    expect(screen.queryByText('How to answer')).toBeNull();
  });
  it('submits the canonical payload (letters, ageMonths) with no client score, then opens the stored case', async () => {
    submit.mockResolvedValue({ caseId: 'NS-T-1' });
    renderPage(); reachQuestions('20');
    fireEvent.click(screen.getByRole('button', { name: 'Begin the questions' }));
    const picks = [3, 2, 0, 3, 0, 1, 0, 0, 2, 4];
    picks.forEach((p, i) => {
      fireEvent.click(screen.getAllByRole('radio')[p]);
      fireEvent.click(screen.getByRole('button', { name: i < 9 ? /Next/ : 'Review answers' }));
    });
    expect(screen.getByRole('heading', { name: 'Check your answers' })).toBeInTheDocument();
    expect(screen.getByText(/20 months/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Send my answers' }));
    await waitFor(() => expect(screen.getByText('RESULT PAGE')).toBeInTheDocument());
    const payload = submit.mock.calls[0][0];
    expect(payload.category).toBe('toddler');
    expect(payload.demo.ageMonths).toBe(20);
    expect(payload.answers).toEqual({ Q1: 'D', Q2: 'C', Q3: 'A', Q4: 'D', Q5: 'A', Q6: 'B', Q7: 'A', Q8: 'A', Q9: 'C', Q10: 'E' });
    expect(payload.gazeSkipped && payload.speechSkipped && payload.facialSkipped).toBe(true);
    for (const k of ['aq10Score', 'riskLevel', 'modelOutput', 'questionnaireProbability', 'score', 'total']) expect(payload).not.toHaveProperty(k);
  });
  it('shows a recoverable error and keeps the answers when the API fails', () => {
    mockError.value = 'The server could not be reached.';
    renderPage(); reachQuestions('20');
    fireEvent.click(screen.getByRole('button', { name: 'Begin the questions' }));
    for (let i = 0; i < 10; i++) { fireEvent.click(screen.getAllByRole('radio')[0]); fireEvent.click(screen.getByRole('button', { name: i < 9 ? /Next/ : 'Review answers' })); }
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn’t send your answers.*please try again/s);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

const items = TODDLER_ITEMS.map((q, i) => ({ id: q.id, question: q.text, answer: 'C', answer_label: q.options[2].label, points: i < 4 ? 1 : 0 }));
const basis = { instrument: 'Q-CHAT-10', total_score: 4, max_score: 10, threshold: 3, threshold_source: 'ARC Q-CHAT-10 form', interpretation: 'Score at or above the Q-CHAT-10 cut-point of 3: x', items };
const modelOk = { available: true, value: 0.64, decision_threshold: 0.5, above_threshold: true, model_version: 'toddler-qchat10-polish-v1', algorithm: 'LR', config: 'A', caveats: ['caveat one'], dataset: 'Polish cohort',
  evaluation: { holdout_n: 63, holdout_auc: 0.93, holdout_auc_ci95: [0.87, 0.98], holdout_sensitivity: 0.88, holdout_sensitivity_ci95: [0.75, 0.97], holdout_specificity: 0.79, holdout_specificity_ci95: [0.64, 0.94], official_rule_holdout_auc: 0.92 } };
const states = [
  { id: 'questionnaire', label: 'Questionnaire score', status: 'available_scoring_instrument', status_label: 'Scoring rule · used', in_result: true, output: { kind: 'screening_score', total: 4, max: 10, threshold: 3 } },
  { id: 'gaze', label: 'Eye gaze', status: 'skipped', status_label: 'Skipped', in_result: false, output: null },
  { id: 'speech', label: 'Speech', status: 'skipped', status_label: 'Skipped', in_result: false, output: null },
  { id: 'facial', label: 'Facial (face detection only)', status: 'skipped', status_label: 'Skipped', in_result: false, output: null },
];
const caseRec = (over = {}) => ({ id: 'NS-T-1', category: 'toddler', age_months: 20, scoring_version: 3, screeningDate: '2026-10-29', questionnaire_basis: basis, questionnaire_model: modelOk, modality_states: states, ...over });

describe('toddler results', () => {
  it('shows the stored score, the separate model section and honest other-signal status', () => {
    render(<ToddlerResults c={caseRec()} explanation={{ shap: [{ feature: 'Eye contact', shapValue: 0.7 }], modelExplanation: { available: true, note: 'Association, not causation.' } }} />);
    expect(screen.getByLabelText('Score 4 out of 10')).toBeInTheDocument();
    expect(screen.getByText(/not a diagnosis/i)).toBeInTheDocument();
    expect(screen.getByText(/Experimental · not clinically validated/)).toBeInTheDocument();
    expect(screen.getByText(/the chance that your child has autism/i)).toBeInTheDocument();
    expect(screen.getByText('20 months')).toBeInTheDocument();
    for (const name of [/^Eye gaze/, /^Speech/, /^Facial/]) {
      const card = screen.getByLabelText(name);
      expect(within(card).getByText('Not used for the result')).toBeInTheDocument();
      expect(within(card).queryByText(/\d+ \/ 10/)).toBeNull();           // the questionnaire score never appears under another modality
    }
    expect(screen.queryByText(/High risk|Moderate risk|Low risk/)).toBeNull();
  });
  it('model unavailable: says so, keeps the questionnaire score, shows no number', () => {
    render(<ToddlerResults c={caseRec({ questionnaire_model: null })} explanation={{ shap: [], modelExplanation: { available: false, reason: 'no model' } }} />);
    expect(screen.getByRole('heading', { name: 'Model result unavailable' })).toBeInTheDocument();
    expect(screen.getByLabelText('Score 4 out of 10')).toBeInTheDocument();
    expect(screen.queryByText(/Similarity value/)).toBeNull();
    expect(screen.getByText(/Model explanation unavailable: no model/)).toBeInTheDocument();
  });
  it('renders the stored values exactly as returned (no client recomputation)', () => {
    render(<ToddlerResults c={caseRec({ questionnaire_basis: { ...basis, total_score: 9 } })} explanation={null} />);
    expect(screen.getByLabelText('Score 9 out of 10')).toBeInTheDocument();       // items still say 4 points; the server value is shown
  });
  it('toddler badge never uses High/Moderate/Low risk wording', () => {
    render(<><RiskBadge level="High" category="toddler" /><RiskBadge level="Low" category="toddler" /></>);
    expect(screen.getByText('At or above threshold')).toBeInTheDocument();
    expect(screen.getByText('Below threshold')).toBeInTheDocument();
  });
});
