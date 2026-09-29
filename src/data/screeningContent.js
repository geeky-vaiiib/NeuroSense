export const CATEGORY_ORDER = ['child'];

export const ANSWER_OPTIONS = [
  'Definitely disagree',
  'Slightly disagree',
  'Slightly agree',
  'Definitely agree',
];

export const GENDER_OPTIONS = [
  'Male',
  'Female',
  'Non-binary',
  'Prefer not to say',
];

export const YES_NO_OPTIONS = ['Yes', 'No'];

export const ETHNICITY_OPTIONS = [
  'South Asian',
  'White-Caucasian',
  'East Asian',
  'Middle Eastern',
  'Black',
  'Mixed / Multiracial',
  'Other',
];

export const CATEGORY_CONTENT = {
  child: {
    label: 'Child',
    shortLabel: 'Child Track',
    accent: '#E67E22',
    accentSoft: 'rgba(230, 126, 34, 0.10)',
    accentBorder: '#F8DAB8',
    entryTitle: 'Child caregiver screening',
    entryDescription: 'For a parent or guardian completing an ASD screening for a child under 18.',
    introTitle: 'Caregiver-guided child intake',
    introDescription:
      'This track assumes a caregiver is answering on behalf of a child and needs child-context interpretation.',
    consentTitle: 'Child consent and privacy',
    consentDescription:
      'Review the consent items below before starting the caregiver-completed child questionnaire.',
    consentItems: [
      'I am the parent, guardian, or primary caregiver for the child being screened.',
      'I understand this child screening is a triage tool and not a diagnosis.',
      'I understand my responses will be processed by the child screening model.',
      'I have read the privacy notice and understand how the child’s data is used.',
    ],
    demographics: {
      subjectNameLabel: 'Child’s name',
      respondentNameLabel: 'Parent or guardian name',
      respondentRelationshipLabel: 'Your relationship to the child',
      ageLabel: 'Child’s age',
      genderLabel: 'Child’s gender',
      ethnicityLabel: 'Child’s ethnicity',
      familyAsdLabel: 'Family history of ASD',
      jaundiceLabel: 'History of neonatal jaundice',
      respondentRelationshipValue: 'Parent / Guardian',
    },
    questionnaireTitle: 'Child AQ-10 questionnaire',
    questionnaireDescription:
      'Answer each item based on what you regularly observe in the child’s communication, play, and daily routines.',
    reviewTitle: 'Review your child screening',
    reviewDescription:
      'Confirm your details and answers before we run the child model pipeline.',
    resultsTitle: 'Child Screening Result',
    riskCopy: {
      High:
        'This caregiver-completed child screening shows a high concentration of ASD-related traits. A developmental specialist review is recommended.',
      Moderate:
        'This caregiver-completed child screening shows several traits associated with ASD. A pediatric follow-up assessment may be helpful.',
      Low:
        'This caregiver-completed child screening shows fewer ASD-related traits at this time. Continue routine developmental monitoring if concerns remain.',
    },
    diagnosisCopy: {
      High: 'Child ASD traits flagged — developmental follow-up recommended',
      Moderate: 'Child ASD traits present — monitoring recommended',
      Low: 'Lower child ASD likelihood on screening',
    },
    screeningTool: 'Child AQ-10',
    trackSummary: 'Caregiver report',
    modalityConfidence: [
      { id: 'questionnaire', label: 'Caregiver questionnaire', pct: 81 },
      { id: 'developmental-history', label: 'Developmental history', pct: 78 },
      { id: 'birth-context', label: 'Birth and family context', pct: 69 },
      { id: 'xai-ready', label: 'Explainability readiness', pct: 93 },
    ],
  }
};

export const QUESTION_BANK = {
  child: [
    { id: 'A1', prompt: 'The child notices small sounds that others do not.', featureLabel: 'Child notices small sounds' },
    { id: 'A2', prompt: 'The child usually sees the whole picture rather than getting stuck on small details.', featureLabel: 'Child sees the whole picture' },
    { id: 'A3', prompt: 'The child can manage more than one thing at a time without much difficulty.', featureLabel: 'Child manages multitasking' },
    { id: 'A4', prompt: 'After an interruption, the child can return to the previous activity quickly.', featureLabel: 'Child returns after interruption' },
    { id: 'A5', prompt: 'The child can read between the lines in everyday conversation.', featureLabel: 'Child reads implied meaning' },
    { id: 'A6', prompt: 'The child notices when someone is losing interest in what they are saying.', featureLabel: 'Child notices disengagement' },
    { id: 'A7', prompt: 'The child understands what story characters might be thinking or feeling.', featureLabel: 'Child interprets characters’ intentions' },
    { id: 'A8', prompt: 'The child likes collecting detailed information about categories of things.', featureLabel: 'Child collects detailed categories' },
    { id: 'A9', prompt: 'The child works out what someone is thinking by looking at their face.', featureLabel: 'Child reads facial cues' },
    { id: 'A10', prompt: 'The child understands what someone means even when it is not said directly.', featureLabel: 'Child understands indirect meaning' },
  ]
};

const AGREE_MAP = {
  'Definitely agree': 1,
  'Slightly agree': 1,
  'Definitely disagree': 0,
  'Slightly disagree': 0,
};

const ASD_TRAIT_IDS = new Set(['A1', 'A7', 'A8', 'A10']);

// Q-CHAT-10 (toddler): only A10 is ASD-trait direction
const QCHAT_TRAIT_IDS = new Set(['A10']);

export function categoryLabel(category) {
  return CATEGORY_CONTENT[category]?.label ?? CATEGORY_CONTENT.child.label;
}

export function getCategoryContent(category) {
  return CATEGORY_CONTENT[category] ?? CATEGORY_CONTENT.child;
}

export function deriveCategoryFromAge(age) {
  return 'child';
}

export function validateCategoryAge(category, age) {
  if (age < 4 || age > 11)
    return { valid: false, message: 'Child screening is intended for individuals aged 4 to 11 years.' };
  return { valid: true, message: '' };
}

export function buildAq10Score(answers, category = 'child') {
  const traitIds = ASD_TRAIT_IDS;
  return Object.entries(answers ?? {}).reduce((total, [questionId, answer]) => {
    const agreeScore = AGREE_MAP[answer] ?? 0;
    if (traitIds.has(questionId)) {
      return total + agreeScore;
    }
    return total + (1 - agreeScore);
  }, 0);
}

export function getMixedModalityConfidence() {
  return [
    { id: 'adult-track',   label: 'Adult self-report',      pct: 84 },
    { id: 'child-track',   label: 'Child caregiver report',  pct: 81 },
    { id: 'toddler-track', label: 'Toddler Q-CHAT-10',       pct: 88 },
    { id: 'routing',       label: 'Category model routing',  pct: 89 },
  ];
}
