"""Presentation only: interpret saved flags, never recompute scores or infer outcomes from text."""
from copy import deepcopy

NOTICE = 'Screening does not establish a diagnosis. A below-threshold score cannot rule out concerns.'

def present(report, category=None, example=False):
    result = deepcopy(report)
    if result.get('presentation'):
        return result
    q = result.get('questionnaire') or {}
    flag = q.get('meets_threshold')
    if flag is True:
        outcome = 'At or above the screening threshold'
        meaning = 'The answers reached the questionnaire’s screening threshold. This suggests that a fuller assessment may be helpful.'
        next_step = 'Discuss this result and your concerns with a qualified health professional, who can advise about further assessment.'
    elif flag is False:
        outcome = 'Below the screening threshold'
        meaning = 'The answers did not reach the questionnaire’s screening threshold. This is one part of understanding development and everyday experiences.'
        next_step = 'If you have concerns, discuss them with a qualified health professional even with a below-threshold score.'
    else:
        outcome = 'Original outcome retained'
        meaning = 'This older record does not contain a structured threshold outcome. Its original interpretation is available in Technical details; it has not been rescored.'
        next_step = 'A qualified health professional can help you understand this older record alongside your current concerns.'
    cards = {m['id']: m for m in result.get('modalities', [])}
    recordings = []
    for mid, label, extra in [('gaze','Eye-gaze recording',None),('speech','Voice recording','speech_emotion'),('facial','Facial snapshot','facial_expression')]:
        base = cards.get(mid, {})
        eye_example = example and mid == 'gaze' and cards.get('eye_tracker', {}).get('output') is not None
        if eye_example:
            base = cards['eye_tracker']
            label = 'Eye-tracker research example'
        model = cards.get(extra, {}) if extra else base
        status = base.get('status', 'not_provided')
        measured = bool(base.get('measurements')) and status not in ('failed_quality','analysis_failed','insufficient_data')
        available = status not in ('failed_quality','insufficient_data','analysis_failed') and model.get('status') == 'available_experimental' and model.get('output') is not None
        if status == 'skipped':
            plain, text = 'Skipped', 'You chose to continue without this recording.'
        elif measured or available or status == 'measurements_available':
            plain = 'Analysed'
            text = {'gaze':'The recording was processed by the experimental gaze model.', 'speech':('Acoustic measurements were taken from the recording.' if measured else 'A research model classified the supplied audio.'), 'facial':('A face was detected and image quality was checked.' if measured else 'A research model classified the supplied snapshot.')}[mid]
            if eye_example:
                text = 'An experimental result was saved for an eye-tracker recording. Its input is different from a webcam recording.'
            if extra and available:
                predicted = model['output'].get('label')
                if predicted:
                    noun = 'expression' if mid == 'facial' else 'voice-emotion'
                    text += f' The model’s closest {noun} label was {predicted}.'
                text += ' This research classification does not describe autism or the person’s internal feelings.'
            elif extra:
                text += ' No research classification was provided; the measurements are still available in Technical details.'
        elif status in ('failed_quality','insufficient_data','out_of_domain','insufficient_quality'):
            plain = 'Recording needs another attempt'
            domain = (base.get('measurements') or {}).get('domain') or {}
            if status == 'out_of_domain' or domain.get('status') in ('out_of_domain','marginal'):
                plain = 'Could not analyse'
                text = 'The recording was outside the model’s supported range, so no model result was provided.'
            else:
                text = 'The recording did not meet the checks needed for this analysis. You can try again in a new screening or continue with the questionnaire result.'
        elif status == 'not_provided':
            plain, text = 'Could not analyse', 'No recording analysis is available in this saved record.'
        else:
            plain, text = 'Could not analyse', 'The analysis service or required model could not provide a result. Your questionnaire result is still available.'
        if plain == 'Recording needs another attempt' and mid != 'gaze':
            text = ('The recording was too short or unclear for analysis. ' if mid == 'speech' else 'A usable face could not be detected in the snapshot. ') + 'You can try again in a new screening; the questionnaire result is unchanged.'
        recordings.append({'id':mid,'label':label,'status':plain,'summary':text})
    result['presentation'] = {'version':'plain-language-v1','category':category or q.get('category'),
        'title':'Your screening summary','outcome':outcome,'meaning':meaning,'next_step':next_step,'notice':NOTICE,
        'score_text':f"{q['total_score']} / {q['max_score']}" if q.get('total_score') is not None and q.get('max_score') is not None else 'Unavailable',
        'threshold_text':f"Screening threshold: {q['threshold']}" if q.get('threshold') is not None else 'Original threshold unavailable',
        'score_accessible_label':f"Score {q['total_score']} out of {q['max_score']}" if q.get('total_score') is not None and q.get('max_score') is not None else 'Score unavailable',
        'instrument':q.get('instrument') or 'Historical screening record','recordings':recordings,
        'is_example':example,'provenance_label':'Recorded research example' if example else 'Saved screening',
        'provenance_note':'These examples use separate dataset participants and synthetic questionnaire answers. They do not describe one live person.' if example else 'Only the saved questionnaire score determines the screening result. Optional recordings provide separate research information.'}
    return result
