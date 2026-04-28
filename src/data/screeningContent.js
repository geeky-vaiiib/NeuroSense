export const CATEGORY_ORDER = ['adult', 'child', 'toddler'];

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
  adult: {
    label: 'Adult',
    shortLabel: 'Adult Track',
    accent: '#3D5A80',
    accentSoft: 'rgba(61, 90, 128, 0.10)',
    accentBorder: '#D4DDEA',
    entryTitle: 'Adult self-screening',
    entryDescription: 'For adults 18 and older completing their own ASD screening.',
    introTitle: 'Adult self-report intake',
    introDescription:
      'This track assumes the respondent is completing the screening independently and wants an adult-context interpretation.',
    consentTitle: 'Adult consent and privacy',
    consentDescription:
      'Review the consent items below before starting the adult self-report questionnaire.',
    consentItems: [
      'I am completing this screening for myself.',
      'I understand this adult screening is a triage tool and not a diagnosis.',
      'I understand my responses will be processed by the adult screening model.',
      'I have read the privacy notice and understand how my data is used.',
    ],
    demographics: {
      subjectNameLabel: 'Your name',
      respondentNameLabel: 'Preferred contact name',
      respondentRelationshipLabel: 'Respondent relationship',
      ageLabel: 'Your age',
      genderLabel: 'Your gender',
      ethnicityLabel: 'Your ethnicity',
      familyAsdLabel: 'Family history of ASD',
      jaundiceLabel: 'History of neonatal jaundice',
      respondentRelationshipValue: 'Self',
    },
    questionnaireTitle: 'Adult AQ-10 questionnaire',
    questionnaireDescription:
      'Answer each item based on your own day-to-day experience over the last several months.',
    reviewTitle: 'Review your adult self-report',
    reviewDescription:
      'Confirm your details and answers before we run the adult model pipeline.',
    resultsTitle: 'Adult Screening Result',
    riskCopy: {
      High:
        'This adult self-report screening shows a high concentration of ASD-related traits. A clinician-led adult follow-up assessment is recommended.',
      Moderate:
        'This adult self-report screening shows several ASD-related traits. A structured adult follow-up assessment may be helpful.',
      Low:
        'This adult self-report screening shows a lower concentration of ASD-related traits at this time. Continue monitoring if concerns remain.',
    },
    diagnosisCopy: {
      High: 'Adult ASD traits flagged — follow-up recommended',
      Moderate: 'Adult ASD traits present — review recommended',
      Low: 'Lower adult ASD likelihood on screening',
    },
    screeningTool: 'Adult AQ-10',
    trackSummary: 'Self-report',
    modalityConfidence: [
      { id: 'questionnaire', label: 'Adult self-report', pct: 84 },
      { id: 'demographics', label: 'Adult demographics', pct: 72 },
      { id: 'family-history', label: 'Family history signal', pct: 66 },
      { id: 'xai-ready', label: 'Explainability readiness', pct: 91 },
    ],
  },
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
  },
  toddler: {
    label: 'Toddler',
    shortLabel: 'Toddler Track',
    accent: '#9B59B6',
    accentSoft: 'rgba(155, 89, 182, 0.10)',
    accentBorder: '#E8D5F5',
    entryTitle: 'Toddler early screening',
    entryDescription: 'For parents or guardians completing an early ASD screening for a child aged 0\u20134 years.',
    introTitle: 'Toddler Q-CHAT-10 intake',
    introDescription:
      'This track is completed by a parent or guardian on behalf of a toddler. Each question asks about your child\'s typical day-to-day behaviour over the past month.',
    consentTitle: 'Parental consent \u2014 toddler screening',
    consentDescription:
      'Because this screening involves a child under 5, parental or guardian consent is required before any data is collected or processed.',
    consentItems: [
      'I am the parent or legal guardian of the toddler being assessed.',
      'I understand this is an early screening tool, not a clinical diagnosis.',
      'I consent to this data being processed by the toddler screening model under the DPDP Act 2023.',
      'I have read and understood the privacy notice and data retention policy.',
    ],
    demographics: {
      subjectNameLabel: "Child's name (optional)",
      respondentNameLabel: 'Your name (parent/guardian)',
      respondentRelationshipLabel: 'Your relationship to the child',
      ageLabel: "Child's age (in years, e.g. 1, 2, 3)",
      genderLabel: "Child's sex",
      ethnicityLabel: "Child's ethnicity",
      familyAsdLabel: 'Family history of ASD',
      jaundiceLabel: 'Did the child have jaundice at birth?',
      respondentRelationshipValue: 'Parent / Guardian',
    },
    questionnaireTitle: 'Q-CHAT-10 \u2014 Toddler Questionnaire',
    questionnaireDescription:
      'Answer each item based on what you typically observe in your child over the past month. There are no right or wrong answers.',
    reviewTitle: 'Review your toddler Q-CHAT-10',
    reviewDescription:
      'Confirm the details below before we run the toddler screening model. The result is a screening score only \u2014 it is not a diagnosis.',
    resultsTitle: 'Toddler Early Screening Result',
    riskCopy: {
      High: 'This caregiver-completed toddler screening shows a high concentration of early ASD-related traits. A developmental paediatrician review is recommended as early as possible.',
      Moderate: 'This caregiver-completed toddler screening shows several early traits associated with ASD. A paediatric follow-up assessment is recommended.',
      Low: 'This caregiver-completed toddler screening shows fewer early ASD-related traits at this time. Continue routine developmental monitoring.',
    },
    diagnosisCopy: {
      High: 'Toddler early ASD traits flagged \u2014 urgent developmental review recommended',
      Moderate: 'Toddler early ASD traits present \u2014 paediatric review recommended',
      Low: 'Lower toddler ASD likelihood on screening',
    },
    screeningTool: 'Q-CHAT-10',
    trackSummary: 'Caregiver report',
    modalityConfidence: [
      { id: 'questionnaire',         label: 'Q-CHAT-10 caregiver report',    pct: 88 },
      { id: 'developmental-history', label: 'Early developmental milestones', pct: 82 },
      { id: 'birth-context',         label: 'Birth and family context',       pct: 74 },
      { id: 'xai-ready',            label: 'Explainability readiness',       pct: 91 },
    ],
  },
};

export const QUESTION_BANK = {
  adult: [
    { id: 'A1', prompt: 'I often notice small sounds when others do not.', featureLabel: 'Sensitivity to small sounds' },
    { id: 'A2', prompt: 'I usually focus on the whole picture instead of small details.', featureLabel: 'Whole-picture focus' },
    { id: 'A3', prompt: 'I find it easy to do more than one thing at once.', featureLabel: 'Multitasking ease' },
    { id: 'A4', prompt: 'If interrupted, I can return to what I was doing quickly.', featureLabel: 'Task switching after interruption' },
    { id: 'A5', prompt: 'I find it easy to read between the lines in conversation.', featureLabel: 'Reading between the lines' },
    { id: 'A6', prompt: 'I can usually tell when someone is getting bored with what I am saying.', featureLabel: 'Recognising disengagement' },
    { id: 'A7', prompt: 'I find it easy to understand what characters are thinking or feeling.', featureLabel: 'Interpreting characters’ intentions' },
    { id: 'A8', prompt: 'I like collecting detailed information about categories of things.', featureLabel: 'Collecting detailed categories' },
    { id: 'A9', prompt: 'I find it easy to work out what someone is thinking by looking at their face.', featureLabel: 'Reading facial cues' },
    { id: 'A10', prompt: 'I find it easy to understand what someone means even when it is not said directly.', featureLabel: 'Understanding indirect meaning' },
  ],
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
  ],
  toddler: [
    { id: 'A1', prompt: 'Does your child look at you when you call his/her name?', featureLabel: 'Responds to name' },
    { id: 'A2', prompt: 'How easy is it for you to get eye contact with your child?', featureLabel: 'Eye contact' },
    { id: 'A3', prompt: 'Does your child point to indicate that s/he wants something (e.g., a toy that is out of reach)?', featureLabel: 'Protodeclarative pointing (requesting)' },
    { id: 'A4', prompt: 'Does your child point to share interest with you (e.g., pointing at an interesting sight)?', featureLabel: 'Protodeclarative pointing (sharing)' },
    { id: 'A5', prompt: 'Does your child pretend (e.g., care for dolls, talk on a toy phone)?', featureLabel: 'Pretend play' },
    { id: 'A6', prompt: 'Does your child follow where you\'re looking?', featureLabel: 'Follows gaze' },
    { id: 'A7', prompt: 'If you or someone else in the family is visibly upset, does your child show signs of wanting to comfort them?', featureLabel: 'Social comfort response' },
    { id: 'A8', prompt: 'Would you describe your child\'s first words as typical?', featureLabel: 'First words typicality' },
    { id: 'A9', prompt: 'Does your child use simple gestures (e.g., wave goodbye)?', featureLabel: 'Gesture use' },
    { id: 'A10', prompt: 'Does your child stare at nothing with no apparent purpose?', featureLabel: 'Purposeless staring' },
  ],
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
  return CATEGORY_CONTENT[category]?.label ?? CATEGORY_CONTENT.adult.label;
}

export function getCategoryContent(category) {
  return CATEGORY_CONTENT[category] ?? CATEGORY_CONTENT.adult;
}

export function deriveCategoryFromAge(age) {
  const n = Number(age);
  if (n <= 4) return 'toddler';
  if (n < 18) return 'child';
  return 'adult';
}

export function validateCategoryAge(category, age) {
  if (!category) return { valid: true, message: '' };
  if (category === 'adult' && age < 18)
    return { valid: false, message: 'Adult screening is for individuals 18 years and older.' };
  if (category === 'child' && (age < 5 || age > 17))
    return { valid: false, message: 'Child screening is for individuals aged 5 to 17 years.' };
  if (category === 'toddler' && (age < 0 || age > 4))
    return { valid: false, message: 'Toddler screening is for children aged 0 to 4 years. Enter the age in whole years (e.g., 1 for a 12-month-old).' };
  return { valid: true, message: '' };
}

export function buildAq10Score(answers, category = 'adult') {
  const traitIds = category === 'toddler' ? QCHAT_TRAIT_IDS : ASD_TRAIT_IDS;
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
