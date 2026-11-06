"""Backend-only report assembly. Never rescore or replace a saved historical report."""
from copy import deepcopy
try:
    from ..schemas.report import ResearchReport, ReportModality, ReportValue
except ImportError:
    from schemas.report import ResearchReport, ReportModality, ReportValue

LABELS = {
    'questionnaire': 'Questionnaire score', 'questionnaire_model': 'Supplementary questionnaire model',
    'gaze': 'Webcam gaze (experimental)', 'eye_tracker': 'Eye-tracker gaze-v1 (separate research workflow)',
    'facial': 'Facial detection and image quality', 'facial_expression': 'Facial expression (CNN, experimental)',
    'speech': 'Acoustic measurements / ASD speech classifier', 'speech_emotion': 'Speech emotion (CNN, experimental)',
}
UNITS = {'sample_rate_hz': 'Hz', 'window_duration_s': 's', 'pitch_mean': 'Hz', 'pitch_std': 'Hz', 'duration_s': 's', 'duration_ms': 'ms',
         'speech_rate': 'proxy units (not syllables/s)', 'sample_rate': 'Hz', 'fps': 'frames/s', 'image_width': 'px', 'image_height': 'px',
         'mean_brightness': 'gray levels (0–255)', 'sharpness_laplacian_var': 'gray-level variance',
         'face_brightness':'gray levels (0–255)', 'face_sharpness':'gray-level variance at 64x64', 'spectral_flatness_median':'ratio', 'clipped_sample_fraction':'fraction', 'voiced_fraction': 'fraction', 'energy_mean': 'normalized RMS', 'energy_std': 'normalized RMS'}
AVAILABLE = {'available_experimental', 'available_scoring_instrument'}

def value(name, raw, unit=None, percent=False):
    if raw is None: text = 'Unavailable'
    elif isinstance(raw, bool): text = 'Yes' if raw else 'No'
    elif isinstance(raw, (float, int)):
        text = f'{raw * 100:.1f}%' if percent else (str(raw) if isinstance(raw, int) else f'{raw:.3f}')
    else: text = str(raw)
    if unit and raw is not None: text += f' {unit}'
    labels={'pitch_mean':'Mean pitch','pitch_std':'Pitch variation','speech_rate':'Speech-rate proxy','voiced_fraction':'Voiced fraction','energy_mean':'Mean audio energy','energy_std':'Audio energy variation','image_width':'Image width','image_height':'Image height','mean_brightness':'Image brightness','sharpness_laplacian_var':'Image sharpness','face_detected':'Face detected','valid_sample_ratio':'Usable frame fraction','sample_count':'Recorded frame count','valid_sample_count':'Usable frame count','data_quality_score':'Recording quality (not confidence)','Model schema':'Input format','Model weights_sha256':'Checkpoint SHA-256'}
    label=labels.get(name,labels.get(name.split('.')[-1]))
    return ReportValue(name=name, value=raw, unit=unit, text=text,display_label=label)

def measurements(values, prefix=''):
    rows = []
    for key, raw in (values or {}).items():
        name = f'{prefix}{key}'
        if isinstance(raw, dict): rows.extend(measurements(raw, name + '.'))
        else: rows.append(value(name, raw, UNITS.get(key)))
    return rows

def build_report(record):
    basis = deepcopy(record.get('questionnaire_basis'))
    states = {s['id']: deepcopy(s) for s in record.get('modality_states', [])}
    if basis:
        states.setdefault('questionnaire', {'status':'available_scoring_instrument','status_label':'Saved questionnaire score',
            'output':{'kind':'screening_score','total':basis.get('total_score'),'max':basis.get('max_score'),'threshold':basis.get('threshold'),'meets_threshold':basis.get('meets_threshold')},
            'reason':'Saved questionnaire scoring basis. Original values retained.'})
    mo = record.get('questionnaire_model')
    states['questionnaire_model'] = {'status': 'available_experimental' if mo else 'model_unavailable',
        'output': {'kind': 'supplementary_model', 'value': mo.get('probability'), 'original_model_output':deepcopy(mo),
                   'meaning': 'Cohort output, not population probability.' if record['category']=='toddler' else 'Models score-derived labels, not diagnostic probability.'} if mo else None,
        'model': {'version': mo.get('model_version') or mo.get('model_used'), **(mo.get('model_provenance') or {})} if mo else None}
    cards = []
    for mid, label in LABELS.items():
        s = states.get(mid, {})
        parent = states.get('facial' if mid == 'facial_expression' else 'speech', {})
        status = s.get('status') or ('skipped' if mid in ('facial_expression','speech_emotion') and parent.get('status')=='skipped' else 'not_provided')
        output = s.get('output') if status in AVAILABLE else None
        reason = s.get('reason') or ('Only the server questionnaire score determines screening.' if mid=='questionnaire' else 'Excluded from screening: separate experimental task or no usable output.')
        if mid=='eye_tracker' and not output: reason = 'Separate screen-pixel workflow; incompatible with webcam angles. No eye-tracker recording submitted in this screening.'
        if mid in ('facial', 'speech') and status == 'model_unavailable' and s.get('measurements'):
            status = 'measurements_available'
            s['status_label'] = 'Measurements available; ASD classifier unavailable'
        rows = []
        if mid=='questionnaire' and basis:
            rows = [value('Instrument', basis.get('instrument')), value('Scoring version', basis.get('scoring_version')),
                    ReportValue(name='Score',value=basis.get('total_score'),unit='points',text=f"{basis['total_score']}/{basis['max_score']} points" if basis.get('total_score') is not None and basis.get('max_score') is not None else 'Unavailable', accessible_label=None),
                    value('Threshold',basis.get('threshold'),'points'),value('Threshold rule',f"Score >= {basis['threshold']} points" if basis.get('threshold') is not None else 'Original threshold unavailable'),value('Interpretation',basis.get('interpretation'))]
        elif output:
            if 'label' in output: rows.append(value('Predicted class',output['label']))
            if 'value' in output: rows.append(value('Model output (not population probability)',output['value']))
            for name, score in output.get('class_scores',{}).items(): rows.append(value(name,score,percent=True))
        if mid=='questionnaire' and basis:
            s['quality']={'answered_items':len(basis.get('items', [])), 'required_items':10}
        model = s.get('model')
        if mid=='questionnaire' and basis:
            rows += [value('Scoring source',basis.get('source')),value('Source accessed',basis.get('source_accessed')),value('Instrument notice',basis.get('notice'))]
        if model:
            for k in ('version','schema','weights_sha256'): rows.append(value('Model '+k, model.get(k)))
        rows += measurements(s.get('quality'), 'quality.') + measurements(s.get('measurements'), 'measurements.')
        if mid=='gaze': rows += measurements({k:record.get('gaze_features',{}).get(k) for k in ('recording_timing','timings_s')})
        limitations = ['Not clinically validated. Does not establish diagnosis.']
        if mid != 'questionnaire': limitations.append('Experimental output; task, age, device and language transfer may be unsupported. Class scores are not population probabilities.')
        if mid=='questionnaire_model' and mo and mo.get('caveats'): limitations.extend(mo['caveats'])
        if output and output.get('meaning'): limitations.append(output['meaning'])
        cards.append(ReportModality(id=mid,label=label,status=status,status_label=s.get('status_label') or status.replace('_',' '),
            output=output, model=model, quality=s.get('quality'), measurements=s.get('measurements'),
            included_in_screening=mid=='questionnaire' and basis is not None, inclusion_reason=reason,limitations=limitations,values=rows))
    conclusion = record.get('interpretation') or 'Original interpretation unavailable; not rescored.'
    summary = [conclusion, 'These analyses describe different tasks. No diagnostic fusion or average of model scores is calculated.']
    for card in cards[1:]:
        finding = next((v.text for v in card.values if v.name in ('Predicted class','Model output (not population probability)')), None)
        summary.append(f'{card.label}: {card.status_label}.' + (f' Output: {finding}.' if finding else '') + ' ' + card.inclusion_reason)
    try:
        from .report_presentation import present
    except ImportError:
        from core.report_presentation import present
    report = ResearchReport(case_id=record['id'],generated_at=record['created_at'],questionnaire=basis,
                          screening_conclusion=conclusion,summary=summary,modalities=cards).model_dump(mode='json')
    view = present(report, record.get('category'))
    if not basis and record.get('aq10_score') is not None:
        view['presentation']['score_text'] = f"{record['aq10_score']} points (original maximum unavailable)"
        view['presentation']['score_accessible_label'] = f"Stored score {record['aq10_score']} points"
    return view
