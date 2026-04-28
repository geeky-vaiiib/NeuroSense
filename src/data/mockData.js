import {
  CATEGORY_CONTENT,
  QUESTION_BANK,
  buildAq10Score,
  categoryLabel,
  deriveCategoryFromAge,
  getCategoryContent,
  getMixedModalityConfidence,
  validateCategoryAge,
} from './screeningContent';

const STORAGE_KEY = 'neurosense_mock_cases_v2';

const SEEDED_CASES = [
  {
    id: 'NS-A-2026-0412',
    category: 'adult',
    subjectName: 'Jordan A.',
    respondentName: 'Jordan A.',
    respondentRelationship: 'Self',
    age: 34,
    gender: 'Non-binary',
    ethnicity: 'South Asian',
    jaundice: 'No',
    familyAsd: 'Yes',
    riskLevel: 'High',
    riskScore: 0.86,
    aq10Score: 8,
    status: 'reviewed',
    diagnosis: 'Adult ASD traits flagged — follow-up recommended',
    screeningDate: '2026-04-21',
    referralDate: '2026-04-18',
    clinician: 'Dr. Priya Mehta',
    screeningTool: 'Adult AQ-10',
    completedScreenings: ['Adult AQ-10', 'RAADS-R follow-up'],
    notes:
      'Adult self-report highlighted sensory sensitivity, pattern-based interests, and social inference strain.',
    modelUsed: 'adult_MockProxy',
    isMock: true,
    dataSource: 'mock',
    tags: ['adult-track', 'self-report', 'high-risk', 'mock-pipeline'],
    answers: {
      A1: 'Definitely agree',
      A2: 'Slightly disagree',
      A3: 'Definitely disagree',
      A4: 'Slightly disagree',
      A5: 'Definitely disagree',
      A6: 'Definitely disagree',
      A7: 'Definitely agree',
      A8: 'Definitely agree',
      A9: 'Definitely disagree',
      A10: 'Definitely agree',
    },
    // ── Multimodal: Gaze + Speech ──────────────────
    gaze_skipped: false,
    gaze_features: {
      mean_fixation_duration: 145,
      social_attention_ratio: 0.31,
      gaze_variability: 0.38,
      scanpath_length: 1.82,
      stimulus_transitions: 3,
    },
    gaze_mock: true,
    gaze_interpretation:
      'Gaze patterns show reduced social attention and elevated fixation variability, consistent with ASD-related eye movement profiles.',
    speech_skipped: false,
    speech_features: {
      pitch_mean: 142.3,
      pitch_std: 16.8,
      voiced_fraction: 0.44,
      speech_rate: 1.9,
      energy_mean: 0.0312,
      energy_std: 0.0188,
      mfcc_mean: [-312.4, -68.2, 12.3, -4.1, 8.7, -2.3, 5.1, -1.8, 3.2, -0.9, 1.4, -0.5, 0.8],
      mfcc_std: [42.1, 18.3, 9.2, 6.4, 5.8, 4.3, 3.9, 3.1, 2.8, 2.4, 2.1, 1.9, 1.7],
    },
    speech_mock: true,
    speech_interpretation:
      'Speech analysis identified atypical prosodic and acoustic features consistent with ASD-related communication patterns.',
    speech_flags: [
      'Reduced pitch variability (monotone prosody)',
      'Low speech density \u2014 extended silences detected',
    ],
  },
  {
    id: 'NS-A-2026-0416',
    category: 'adult',
    subjectName: 'Sam T.',
    respondentName: 'Sam T.',
    respondentRelationship: 'Self',
    age: 28,
    gender: 'Male',
    ethnicity: 'White-Caucasian',
    jaundice: 'No',
    familyAsd: 'No',
    riskLevel: 'Moderate',
    riskScore: 0.58,
    aq10Score: 5,
    status: 'pending-review',
    diagnosis: 'Adult ASD traits present — review recommended',
    screeningDate: '2026-04-16',
    referralDate: '2026-04-14',
    clinician: 'Dr. Lena Torres',
    screeningTool: 'Adult AQ-10',
    completedScreenings: ['Adult AQ-10'],
    notes:
      'Adult self-report suggests mixed social inference and attention-switching challenges.',
    modelUsed: 'adult_MockProxy',
    isMock: true,
    dataSource: 'mock',
    tags: ['adult-track', 'self-report', 'moderate-risk', 'mock-pipeline'],
    answers: {
      A1: 'Slightly agree',
      A2: 'Slightly agree',
      A3: 'Definitely disagree',
      A4: 'Slightly disagree',
      A5: 'Slightly disagree',
      A6: 'Slightly agree',
      A7: 'Slightly agree',
      A8: 'Slightly agree',
      A9: 'Slightly disagree',
      A10: 'Slightly agree',
    },
  },
  {
    id: 'NS-A-2026-0408',
    category: 'adult',
    subjectName: 'Alex K.',
    respondentName: 'Alex K.',
    respondentRelationship: 'Self',
    age: 41,
    gender: 'Male',
    ethnicity: 'Mixed / Multiracial',
    jaundice: 'No',
    familyAsd: 'No',
    riskLevel: 'Low',
    riskScore: 0.22,
    aq10Score: 2,
    status: 'closed',
    diagnosis: 'Lower adult ASD likelihood on screening',
    screeningDate: '2026-04-08',
    referralDate: '2026-04-05',
    clinician: 'Dr. James Okafor',
    screeningTool: 'Adult AQ-10',
    completedScreenings: ['Adult AQ-10'],
    notes:
      'Low adult score with stronger social interpretation and flexible task switching.',
    modelUsed: 'adult_MockProxy',
    isMock: true,
    dataSource: 'mock',
    tags: ['adult-track', 'self-report', 'low-risk', 'mock-pipeline'],
    answers: {
      A1: 'Slightly disagree',
      A2: 'Definitely agree',
      A3: 'Slightly agree',
      A4: 'Definitely agree',
      A5: 'Slightly agree',
      A6: 'Slightly agree',
      A7: 'Slightly disagree',
      A8: 'Slightly disagree',
      A9: 'Definitely agree',
      A10: 'Slightly disagree',
    },
  },
  {
    id: 'NS-C-2026-0422',
    category: 'child',
    subjectName: 'Aria P.',
    respondentName: 'Nina P.',
    respondentRelationship: 'Mother',
    age: 7,
    gender: 'Female',
    ethnicity: 'East Asian',
    jaundice: 'Yes',
    familyAsd: 'Yes',
    riskLevel: 'High',
    riskScore: 0.91,
    aq10Score: 9,
    status: 'in-progress',
    diagnosis: 'Child ASD traits flagged — developmental follow-up recommended',
    screeningDate: '2026-04-22',
    referralDate: '2026-04-20',
    clinician: 'Dr. Priya Mehta',
    screeningTool: 'Child AQ-10',
    completedScreenings: ['Child AQ-10', 'SRS-2 follow-up'],
    notes:
      'Caregiver report highlights sensory sensitivity, rigid interests, and difficulty reading social cues.',
    modelUsed: 'child_MockProxy',
    isMock: true,
    dataSource: 'mock',
    tags: ['child-track', 'caregiver-report', 'high-risk', 'mock-pipeline'],
    answers: {
      A1: 'Definitely agree',
      A2: 'Definitely disagree',
      A3: 'Definitely disagree',
      A4: 'Slightly disagree',
      A5: 'Definitely disagree',
      A6: 'Definitely disagree',
      A7: 'Definitely agree',
      A8: 'Definitely agree',
      A9: 'Definitely disagree',
      A10: 'Definitely agree',
    },
    // ── Multimodal: Gaze skipped, Speech captured ──
    gaze_skipped: true,
    speech_skipped: false,
    speech_features: {
      pitch_mean: 198.7,
      pitch_std: 54.3,
      voiced_fraction: 0.61,
      speech_rate: 3.2,
      energy_mean: 0.0445,
      energy_std: 0.0201,
      mfcc_mean: [-298.1, -52.4, 8.9, -2.7, 6.1, -1.4, 3.8, -0.9, 2.1, -0.4, 0.9, -0.2, 0.4],
      mfcc_std: [38.9, 15.7, 8.1, 5.9, 5.2, 3.8, 3.4, 2.7, 2.4, 2.1, 1.8, 1.6, 1.4],
    },
    speech_mock: true,
    speech_interpretation:
      'Speech acoustic features are within typical range for this age group.',
    speech_flags: [],
  },
  {
    id: 'NS-C-2026-0414',
    category: 'child',
    subjectName: 'Leo D.',
    respondentName: 'Marcos D.',
    respondentRelationship: 'Father',
    age: 12,
    gender: 'Male',
    ethnicity: 'South Asian',
    jaundice: 'No',
    familyAsd: 'Yes',
    riskLevel: 'Moderate',
    riskScore: 0.61,
    aq10Score: 5,
    status: 'pending-review',
    diagnosis: 'Child ASD traits present — monitoring recommended',
    screeningDate: '2026-04-14',
    referralDate: '2026-04-11',
    clinician: 'Dr. Lena Torres',
    screeningTool: 'Child AQ-10',
    completedScreenings: ['Child AQ-10'],
    notes:
      'Caregiver report points to transition difficulty and variable peer communication.',
    modelUsed: 'child_MockProxy',
    isMock: true,
    dataSource: 'mock',
    tags: ['child-track', 'caregiver-report', 'moderate-risk', 'mock-pipeline'],
    answers: {
      A1: 'Slightly agree',
      A2: 'Slightly agree',
      A3: 'Slightly disagree',
      A4: 'Slightly agree',
      A5: 'Slightly disagree',
      A6: 'Slightly disagree',
      A7: 'Definitely agree',
      A8: 'Slightly agree',
      A9: 'Slightly disagree',
      A10: 'Slightly agree',
    },
  },
  {
    id: 'NS-C-2026-0409',
    category: 'child',
    subjectName: 'Mira K.',
    respondentName: 'Sara K.',
    respondentRelationship: 'Guardian',
    age: 4,
    gender: 'Female',
    ethnicity: 'South Asian',
    jaundice: 'No',
    familyAsd: 'No',
    riskLevel: 'Low',
    riskScore: 0.18,
    aq10Score: 1,
    status: 'closed',
    diagnosis: 'Lower child ASD likelihood on screening',
    screeningDate: '2026-04-09',
    referralDate: '2026-04-07',
    clinician: 'Dr. James Okafor',
    screeningTool: 'Child AQ-10',
    completedScreenings: ['Child AQ-10'],
    notes:
      'Caregiver report reflects age-appropriate development with ongoing routine monitoring only.',
    modelUsed: 'child_MockProxy',
    isMock: true,
    dataSource: 'mock',
    tags: ['child-track', 'caregiver-report', 'low-risk', 'mock-pipeline'],
    answers: {
      A1: 'Slightly disagree',
      A2: 'Definitely agree',
      A3: 'Slightly agree',
      A4: 'Definitely agree',
      A5: 'Slightly agree',
      A6: 'Slightly agree',
      A7: 'Slightly disagree',
      A8: 'Slightly disagree',
      A9: 'Definitely agree',
      A10: 'Slightly disagree',
    },
  },
  {
    id: 'NS-T-2026-0418',
    category: 'toddler',
    subjectName: 'Leo M.',
    respondentName: 'Sarah M.',
    respondentRelationship: 'Mother',
    age: 2,
    gender: 'Male',
    ethnicity: 'South Asian',
    jaundice: 'No',
    familyAsd: 'Yes',
    riskLevel: 'High',
    riskScore: 0.89,
    aq10Score: 8,
    status: 'in-progress',
    diagnosis: 'Toddler early ASD traits flagged \u2014 urgent developmental review recommended',
    screeningDate: '2026-04-18',
    referralDate: '2026-04-18',
    clinician: 'Dr. Priya Mehta',
    screeningTool: 'Q-CHAT-10',
    completedScreenings: ['Q-CHAT-10'],
    notes: 'Caregiver reports limited eye contact, no pointing gesture, and no pretend play at 24 months. Family history positive.',
    modelUsed: 'toddler_MockProxy',
    isMock: true,
    dataSource: 'mock',
    tags: ['toddler-track', 'caregiver-report', 'high-risk', 'mock-pipeline'],
    answers: {
      A1: 'Slightly disagree',
      A2: 'Definitely disagree',
      A3: 'Definitely disagree',
      A4: 'Definitely disagree',
      A5: 'Definitely disagree',
      A6: 'Slightly disagree',
      A7: 'Slightly disagree',
      A8: 'Definitely disagree',
      A9: 'Definitely disagree',
      A10: 'Definitely agree',
    },
  },
  {
    id: 'NS-T-2026-0410',
    category: 'toddler',
    subjectName: 'Zara R.',
    respondentName: 'Anita R.',
    respondentRelationship: 'Mother',
    age: 3,
    gender: 'Female',
    ethnicity: 'East Asian',
    jaundice: 'No',
    familyAsd: 'No',
    riskLevel: 'Low',
    riskScore: 0.18,
    aq10Score: 2,
    status: 'reviewed',
    diagnosis: 'Lower toddler ASD likelihood on screening',
    screeningDate: '2026-04-10',
    referralDate: '2026-04-10',
    clinician: 'Dr. Lena Torres',
    screeningTool: 'Q-CHAT-10',
    completedScreenings: ['Q-CHAT-10'],
    notes: 'Good eye contact, pointing present, pretend play observed. Low risk on Q-CHAT-10.',
    modelUsed: 'toddler_MockProxy',
    isMock: true,
    dataSource: 'mock',
    tags: ['toddler-track', 'caregiver-report', 'low-risk', 'mock-pipeline'],
    answers: {
      A1: 'Definitely agree',
      A2: 'Definitely agree',
      A3: 'Slightly agree',
      A4: 'Definitely agree',
      A5: 'Slightly agree',
      A6: 'Definitely agree',
      A7: 'Slightly agree',
      A8: 'Slightly agree',
      A9: 'Definitely agree',
      A10: 'Slightly disagree',
    },
  },
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRiskLevel(score) {
  if (score >= 0.7) return 'High';
  if (score >= 0.4) return 'Moderate';
  return 'Low';
}

function getRiskScore(category, aq10Score) {
  let multiplier;
  if (category === 'toddler') {
    multiplier = 1.4;
  } else if (category === 'child') {
    multiplier = 1.15;
  } else {
    multiplier = 1.1;
  }
  return Number(Math.min((aq10Score / 10) * multiplier, 1).toFixed(2));
}

function toStorageCase(record) {
  const category = record.category ?? deriveCategoryFromAge(record.age ?? record.demo?.age ?? 18);
  const content = getCategoryContent(category);
  const demo = {
    subjectName: record.demo?.subjectName ?? record.subjectName ?? '',
    respondentName:
      record.demo?.respondentName ??
      record.respondentName ??
      record.subjectName ??
      '',
    respondentRelationship:
      record.demo?.respondentRelationship ??
      record.respondentRelationship ??
      content.demographics.respondentRelationshipValue,
    age: Number(record.demo?.age ?? record.age ?? 18),
    gender: record.demo?.gender ?? record.gender ?? 'Prefer not to say',
    ethnicity: record.demo?.ethnicity ?? record.ethnicity ?? 'Other',
    jaundice: record.demo?.jaundice ?? record.jaundice ?? 'No',
    familyAsd: record.demo?.familyAsd ?? record.familyAsd ?? 'No',
  };
  const aq10Score = record.aq10Score ?? buildAq10Score(record.answers ?? {}, category);
  const riskScore = Number((record.riskScore ?? getRiskScore(category, aq10Score)).toFixed(2));
  const riskLevel = record.riskLevel ?? getRiskLevel(riskScore);
  const interpretation = record.interpretation ?? content.riskCopy[riskLevel];

  return {
    id: record.id,
    category,
    categoryLabel: categoryLabel(category),
    subjectName: demo.subjectName || `${categoryLabel(category)} screening case`,
    respondentName:
      demo.respondentName ||
      demo.subjectName ||
      `${categoryLabel(category)} screening case`,
    respondentRelationship: demo.respondentRelationship,
    age: demo.age,
    gender: demo.gender,
    ethnicity: demo.ethnicity,
    jaundice: demo.jaundice,
    familyAsd: demo.familyAsd,
    riskLevel,
    riskScore,
    aq10Score,
    status: record.status ?? 'pending-review',
    diagnosis: record.diagnosis ?? content.diagnosisCopy[riskLevel],
    screeningDate: record.screeningDate ?? new Date().toISOString().slice(0, 10),
    referralDate:
      record.referralDate ??
      record.screeningDate ??
      new Date().toISOString().slice(0, 10),
    createdAt: record.createdAt ?? new Date().toISOString(),
    updatedAt: record.updatedAt ?? new Date().toISOString(),
    clinician: record.clinician ?? 'Awaiting clinician assignment',
    screeningTool: record.screeningTool ?? content.screeningTool,
    completedScreenings: record.completedScreenings ?? [content.screeningTool],
    modelUsed: record.modelUsed ?? `${category}_MockProxy`,
    isMock: record.isMock ?? true,
    dataSource: record.dataSource ?? (record.isMock === false ? 'model' : 'mock'),
    tags:
      record.tags ??
      [
        `${category}-track`,
        category === 'adult' ? 'self-report' : 'caregiver-report',
        `${riskLevel.toLowerCase()}-risk`,
        record.isMock === false ? 'live-model' : 'mock-pipeline',
      ],
    notes: record.notes ?? content.riskCopy[riskLevel],
    interpretation,
    demo,
    answers: clone(record.answers ?? {}),
    // Multimodal pass-through
    gaze_features: record.gaze_features ?? null,
    gaze_mock: record.gaze_mock ?? true,
    gaze_interpretation: record.gaze_interpretation ?? '',
    gaze_skipped: record.gaze_skipped ?? true,
    speech_features: record.speech_features ?? null,
    speech_mock: record.speech_mock ?? true,
    speech_interpretation: record.speech_interpretation ?? '',
    speech_flags: record.speech_flags ?? [],
    speech_skipped: record.speech_skipped ?? true,
  };
}

function answerContribution(question, answer) {
  const positive = answer === 'Definitely agree' || answer === 'Slightly agree';
  const magnitude =
    answer === 'Definitely agree' || answer === 'Definitely disagree' ? 0.18 : 0.11;
  const traitPositive = ['A1', 'A7', 'A8', 'A10'].includes(question.id);
  const directionPositive = traitPositive ? positive : !positive;
  const signed = Number((directionPositive ? magnitude : -magnitude / 1.5).toFixed(2));

  return {
    feature: question.featureLabel,
    shapValue: signed,
    direction: signed >= 0 ? 'positive' : 'negative',
  };
}

function buildExplanation(record) {
  const questions = QUESTION_BANK[record.category];
  const answerInsights = questions
    .map((question) => answerContribution(question, record.answers?.[question.id]))
    .sort((left, right) => Math.abs(right.shapValue) - Math.abs(left.shapValue));

  const demographicInsights = [];
  if (record.familyAsd === 'Yes') {
    demographicInsights.push({
      feature: 'Family ASD history',
      shapValue: 0.13,
      direction: 'positive',
    });
  }
  if (record.jaundice === 'Yes') {
    demographicInsights.push({
      feature:
        record.category === 'child'
          ? 'Birth jaundice history'
          : 'Neonatal jaundice history',
      shapValue: 0.08,
      direction: 'positive',
    });
  }
  demographicInsights.push({
    feature:
      record.category === 'toddler'
        ? 'Toddler age in months'
        : record.category === 'child'
          ? 'Child age at screening'
          : 'Adult age at screening',
    shapValue: (record.category === 'child' && record.age < 8) || record.category === 'toddler' ? 0.06 : -0.04,
    direction:
      (record.category === 'child' && record.age < 8) || record.category === 'toddler' ? 'positive' : 'negative',
  });

  const shap = [...answerInsights, ...demographicInsights]
    .sort((left, right) => Math.abs(right.shapValue) - Math.abs(left.shapValue))
    .slice(0, 6);

  const lime = shap.map((item) => ({
    feature: item.feature,
    weight: Number((item.shapValue * 0.72).toFixed(2)),
    direction: item.direction,
    plainEnglish:
      item.direction === 'positive'
        ? `${item.feature} pushed the ${record.category} model toward a higher-risk result.`
        : `${item.feature} helped lower the ${record.category} model risk estimate.`,
  }));

  const gazeScore = record.gaze_features?.social_attention_ratio != null
    ? (1.0 - Math.min(record.gaze_features.social_attention_ratio / 0.7, 1.0)) * 0.4 +
      Math.min((record.gaze_features.gaze_variability ?? 0) / 0.5, 1.0) * 0.25 +
      Math.min((record.gaze_features.scanpath_length ?? 0) / 2.0, 1.0) * 0.20 +
      (1.0 - Math.min((record.gaze_features.mean_fixation_duration ?? 0) / 300, 1.0)) * 0.15
    : null;

  return {
    caseId: record.id,
    category: record.category,
    categoryLabel: record.categoryLabel,
    modelUsed: record.modelUsed,
    isMock: record.isMock,
    dataSource: record.dataSource,
    shap,
    lime,
    summary: `${record.interpretation} The strongest contributing signals were ${shap
      .slice(0, 2)
      .map((item) => item.feature.toLowerCase())
      .join(' and ')}.`,
    generatedAt: record.updatedAt,
    // Multimodal explanation data
    gaze_interpretation: record.gaze_interpretation || '',
    speech_interpretation: record.speech_interpretation || '',
    speech_flags: record.speech_flags || [],
    modality_scores: {
      questionnaire: record.riskScore,
      facial: null,
      gaze: gazeScore != null ? Number(gazeScore.toFixed(4)) : null,
      speech: record.speech_features ? (record.speech_mock ? 0.64 : null) : null,
    },
  };
}

function normaliseCase(record) {
  const storageCase = toStorageCase(record);
  return {
    ...storageCase,
    explanation: buildExplanation(storageCase),
  };
}

function loadStoredCases() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normaliseCase);
  } catch {
    return [];
  }
}

function saveStoredCases(cases) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cases.map(toStorageCase)));
}

function getAllCases() {
  const merged = new Map();
  SEEDED_CASES.map(normaliseCase).forEach((record) => merged.set(record.id, record));
  loadStoredCases().forEach((record) => merged.set(record.id, record));

  return [...merged.values()].sort((left, right) =>
    right.screeningDate.localeCompare(left.screeningDate)
  );
}

function toSummary(record) {
  return {
    id: record.id,
    category: record.category,
    categoryLabel: record.categoryLabel,
    subjectName: record.subjectName,
    respondentName: record.respondentName,
    respondentRelationship: record.respondentRelationship,
    age: record.age,
    gender: record.gender,
    riskLevel: record.riskLevel,
    riskScore: record.riskScore,
    screeningDate: record.screeningDate,
    status: record.status,
    diagnosis: record.diagnosis,
    screeningTool: record.screeningTool,
    modelUsed: record.modelUsed,
    isMock: record.isMock,
    dataSource: record.dataSource,
    tags: record.tags,
  };
}

function toDetail(record) {
  return {
    ...toSummary(record),
    referralDate: record.referralDate,
    clinician: record.clinician,
    completedScreenings: record.completedScreenings,
    aq10Score: record.aq10Score,
    notes: record.notes,
    interpretation: record.interpretation,
    demo: record.demo,
    answers: record.answers,
    // Multimodal fields
    gaze_features: record.gaze_features,
    gaze_mock: record.gaze_mock,
    gaze_interpretation: record.gaze_interpretation,
    gaze_skipped: record.gaze_skipped,
    speech_features: record.speech_features,
    speech_mock: record.speech_mock,
    speech_interpretation: record.speech_interpretation,
    speech_flags: record.speech_flags,
    speech_skipped: record.speech_skipped,
  };
}

function buildCaseId(category) {
  const dateToken = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const suffix = Math.random().toString(16).slice(2, 6).toUpperCase();
  const prefix = category === 'toddler' ? 'T' : category === 'child' ? 'C' : 'A';
  return `NS-${prefix}-${dateToken}-${suffix}`;
}

export function getMockCaseSummaries(category) {
  return getAllCases()
    .filter((record) => !category || record.category === category)
    .map(toSummary);
}

export function getMockCaseDetail(caseId) {
  const record = getAllCases().find((item) => item.id === caseId);
  if (!record) {
    throw new Error(`Case ${caseId} not found in mock data.`);
  }
  return toDetail(record);
}

export function getMockExplanation(caseId) {
  const record = getAllCases().find((item) => item.id === caseId);
  if (!record) {
    throw new Error(`Case ${caseId} not found in mock explanation store.`);
  }
  return clone(record.explanation);
}

export function getMockDashboardSummary(category) {
  const records = getAllCases().filter(
    (record) => !category || record.category === category
  );
  const totalCases = records.length;
  const adultCases = records.filter((record) => record.category === 'adult').length;
  const childCases = records.filter((record) => record.category === 'child').length;
  const highRisk = records.filter((record) => record.riskLevel === 'High').length;
  const moderateRisk = records.filter(
    (record) => record.riskLevel === 'Moderate'
  ).length;
  const lowRisk = records.filter((record) => record.riskLevel === 'Low').length;
  const awaitingReview = records.filter((record) =>
    ['pending-review', 'in-progress'].includes(record.status)
  ).length;
  const mockCases = records.filter((record) => record.isMock).length;
  const averageRiskScore = totalCases
    ? Number(
        (
          records.reduce((sum, record) => sum + record.riskScore, 0) / totalCases
        ).toFixed(2)
      )
    : 0;
  const averageAq10Score = totalCases
    ? Number(
        (
          records.reduce((sum, record) => sum + record.aq10Score, 0) / totalCases
        ).toFixed(1)
      )
    : 0;

  const toddlerCases = records.filter((record) => record.category === 'toddler').length;

  return {
    categoryFilter: category ?? 'all',
    totals: {
      totalCases,
      adultCases,
      childCases,
      toddlerCases,
      highRisk,
      moderateRisk,
      lowRisk,
      awaitingReview,
      mockCases,
      averageRiskScore,
      averageAq10Score,
    },
    recentCases: records.slice(0, 5).map(toSummary),
    categoryBreakdown: [
      { category: 'adult', label: 'Adult', count: adultCases },
      { category: 'child', label: 'Child', count: childCases },
      { category: 'toddler', label: 'Toddler', count: toddlerCases },
    ],
    modalityConfidence: category
      ? CATEGORY_CONTENT[category]?.modalityConfidence ??
        getMixedModalityConfidence()
      : getMixedModalityConfidence(),
  };
}

export async function submitMockScreening(payload) {
  const category = payload.category ?? deriveCategoryFromAge(payload.demo?.age ?? 18);
  const ageCheck = validateCategoryAge(category, payload.demo?.age);
  if (!ageCheck.valid) {
    throw new Error(ageCheck.message);
  }

  const content = getCategoryContent(category);
  const aq10Score = payload.aq10Score ?? buildAq10Score(payload.answers, category);
  const riskScore = getRiskScore(category, aq10Score);
  const riskLevel = getRiskLevel(riskScore);
  const submittedAt = new Date().toISOString();
  const caseRecord = normaliseCase({
    id: buildCaseId(category),
    category,
    subjectName: payload.demo?.subjectName ?? '',
    respondentName:
      payload.demo?.respondentName ??
      payload.demo?.subjectName ??
      `${categoryLabel(category)} screening case`,
    respondentRelationship:
      payload.demo?.respondentRelationship ??
      content.demographics.respondentRelationshipValue,
    age: Number(payload.demo?.age ?? 18),
    gender: payload.demo?.gender ?? 'Prefer not to say',
    ethnicity: payload.demo?.ethnicity ?? 'Other',
    jaundice: payload.demo?.jaundice ?? 'No',
    familyAsd: payload.demo?.familyAsd ?? 'No',
    riskLevel,
    riskScore,
    aq10Score,
    status: 'pending-review',
    diagnosis: content.diagnosisCopy[riskLevel],
    screeningDate: submittedAt.slice(0, 10),
    referralDate: submittedAt.slice(0, 10),
    createdAt: submittedAt,
    updatedAt: submittedAt,
    clinician: 'Awaiting clinician assignment',
    screeningTool: content.screeningTool,
    completedScreenings: [content.screeningTool],
    notes: content.riskCopy[riskLevel],
    modelUsed: `${category}_MockProxy`,
    isMock: true,
    dataSource: 'mock',
    tags: [
      `${category}-track`,
      category === 'adult' ? 'self-report' : 'caregiver-report',
      `${riskLevel.toLowerCase()}-risk`,
      'mock-pipeline',
    ],
    interpretation: content.riskCopy[riskLevel],
    demo: payload.demo,
    answers: payload.answers,
    // Pass through multimodal payload fields
    gaze_skipped: payload.gazeSkipped ?? true,
    gaze_features: payload.gazeSkipped === false && payload.gazePoints?.length >= 20
      ? {
          mean_fixation_duration: 180,
          social_attention_ratio: 0.42,
          gaze_variability: 0.29,
          scanpath_length: 1.44,
          stimulus_transitions: 5,
        }
      : null,
    gaze_mock: true,
    gaze_interpretation: payload.gazeSkipped === false && payload.gazePoints?.length >= 20
      ? 'Gaze patterns analysed using heuristic model (mock pipeline).'
      : '',
    speech_skipped: payload.speechSkipped ?? true,
    speech_features: payload.speechSkipped === false && payload.audioBase64
      ? {
          pitch_mean: 155.2,
          pitch_std: 28.4,
          voiced_fraction: 0.52,
          speech_rate: 2.8,
          energy_mean: 0.0388,
          energy_std: 0.0195,
          mfcc_mean: [-305.1, -58.3, 10.2, -3.4, 7.5, -1.8, 4.3, -1.2, 2.7, -0.6, 1.1, -0.3, 0.6],
          mfcc_std: [40.5, 17.0, 8.6, 6.1, 5.5, 4.0, 3.6, 2.9, 2.6, 2.2, 1.9, 1.7, 1.5],
        }
      : null,
    speech_mock: true,
    speech_interpretation: payload.speechSkipped === false && payload.audioBase64
      ? 'Speech acoustic features analysed using heuristic model (mock pipeline).'
      : '',
    speech_flags: payload.speechSkipped === false && payload.audioBase64
      ? []
      : [],
  });

  const existing = loadStoredCases().filter((record) => record.id !== caseRecord.id);
  saveStoredCases([caseRecord, ...existing]);
  await delay(650);

  return {
    caseId: caseRecord.id,
    category,
    categoryLabel: caseRecord.categoryLabel,
    status: caseRecord.status,
    riskLevel,
    fusionScore: riskScore,
    aq10Score,
    modelUsed: caseRecord.modelUsed,
    isMock: true,
    dataSource: 'mock',
    interpretation: caseRecord.interpretation,
    gazeInterpretation: caseRecord.gaze_interpretation || null,
    speechInterpretation: caseRecord.speech_interpretation || null,
    speechFlags: caseRecord.speech_flags || [],
    submittedAt,
  };
}

export const MOCK_CASES = getAllCases().map(toDetail);
