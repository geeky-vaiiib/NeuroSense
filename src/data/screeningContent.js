import aq10 from "./aq10.config.json";
export const CATEGORY_ORDER = ['child', 'adult'];

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
    entryDescription: 'For a parent or guardian completing an ASD screening for a child aged 4 to 11.',
    introTitle: 'Caregiver-guided child intake',
    introDescription:
      'This track assumes a caregiver is answering on behalf of a child and needs child-context interpretation.',
    consentTitle: 'Child consent and privacy',
    consentDescription:
      'Review the consent items below before starting the caregiver-completed child questionnaire.',
    consentItems: [
      'I am the parent, guardian, or primary caregiver for the child being screened.',
      'I understand this child screening is a triage tool and not a diagnosis.',
      'I understand my answers determine a server-computed questionnaire score; any model output is supplementary.',
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
      'Confirm your details and answers before the server scores the questionnaire.',
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
  }
};

export const QUESTION_BANK = Object.fromEntries(Object.entries(aq10).map(([category, config]) => [category, config.questions]));

// Scoring is done by the server (backend/ml/questionnaire_score.py); the browser never computes a total or a risk level.

export function categoryLabel(category) {
  return CATEGORY_CONTENT[category]?.label ?? CATEGORY_CONTENT.child.label;
}

export function getCategoryContent(category) {
  return CATEGORY_CONTENT[category] ?? CATEGORY_CONTENT.child;
}

export function deriveCategoryFromAge(age) {
  return age >= 18 ? 'adult' : age >= 4 && age <= 11 ? 'child' : null;
}

export function validateCategoryAge(category, age) {
  const cfg = aq10[category];
  if (!cfg || !Number.isInteger(age) || age < cfg.ageMin || age > cfg.ageMax)
    return { valid: false, message: category === 'adult' ? 'Adult screening requires a whole-number age from 18 to 120 years.' : 'Child screening is intended for individuals aged 4 to 11 years.' };
  return { valid: true, message: '' };
}

CATEGORY_CONTENT.adult = {
  ...CATEGORY_CONTENT.child,
  label: 'Adult', shortLabel: 'Adult Track', screeningTool: 'Adult AQ-10', trackSummary: 'Self-report',
  introTitle: 'Adult self-report', introDescription: 'AQ-10 for adults aged 18 or older without a learning disability. Research prototype; not a diagnosis.',
  consentTitle: 'Adult consent and privacy', consentDescription: 'Review before completing your questionnaire.',
  consentItems: ['I am completing this questionnaire about myself.', 'I understand screening is not a diagnosis.', 'I understand the server computes the score and optional models do not determine the result.', 'I understand my answers and derived measurements are saved to my account.'],
  demographics: { ...CATEGORY_CONTENT.child.demographics, subjectNameLabel: 'Your name', respondentNameLabel: 'Respondent name', respondentRelationshipValue: 'Self', respondentRelationshipLabel: 'Respondent relationship', ageLabel: 'Your age', genderLabel: 'Your gender', ethnicityLabel: 'Your ethnicity' },
  questionnaireTitle: 'Adult AQ-10 questionnaire', questionnaireDescription: 'Choose one answer per item about yourself.',
  reviewTitle: 'Review your screening', reviewDescription: 'Check the answers before sending them to the server.',
};
