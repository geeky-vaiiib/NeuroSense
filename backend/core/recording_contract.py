"""Saved, backend-authored recording stages. Unknown history is never inferred as success."""
from typing import Literal
from pydantic import BaseModel, ConfigDict

class RecordingAnalysis(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    version: Literal['recording-analysis-v1'] = 'recording-analysis-v1'
    capture_status: Literal['received', 'skipped', 'unknown']
    decoding_status: str
    measurement_status: str
    quality_status: str
    model_status: str
    applicability_status: str
    classification_status: str
    output: dict | None = None
    reason: str | None = None
    retry_action: str | None = None


def recording_analysis(mid, base, classifier):
    status = base.get('status', 'not_provided')
    measures = base.get('measurements') or {}
    quality = base.get('quality') or {}
    measured = bool(measures.get('descriptive')) if mid == 'gaze' else bool(measures)
    domain = (measures.get('domain') or {}).get('status')
    skipped = status in ('skipped', 'not_provided')
    valid = quality.get('valid')
    quality_status = ('passed' if valid is True else 'failed' if valid is False else
                      'failed' if status in ('failed_quality', 'insufficient_data') else 'not_assessed')
    output = classifier.get('output') if classifier.get('status') == 'available_experimental' else None
    # Classification cannot override an explicit failed input gate.
    if quality_status == 'failed' or domain == 'out_of_domain':
        output = None
    classifier_failed_quality = classifier.get('status') == 'failed_quality'
    classification = ('available' if output is not None else 'not_requested' if skipped else
                      'withheld' if quality_status == 'failed' or classifier_failed_quality or domain == 'out_of_domain' else
                      'failed' if classifier.get('status') == 'analysis_failed' else 'unavailable')
    reason = None if output is not None else classifier.get('inclusion_reason') or classifier.get('reason') or base.get('inclusion_reason') or base.get('reason')
    reasons = {'model_unavailable': 'The gaze checkpoint is missing or could not be loaded.',
               'motion_outside_training_range': 'Movement is outside the research model’s supported range.',
               'inference_failed': 'Gaze model inference failed; measurements were retained.'}
    reason = reasons.get(reason, reason)
    retry = ('Record again with the face visible throughout in even lighting.' if mid == 'gaze' else
             'Record at least five seconds of audible speech in a quiet room.' if mid == 'speech' else
             'Capture one clearly visible face in even lighting.') if quality_status == 'failed' or classifier_failed_quality else None
    if domain == 'out_of_domain':
        retry = 'No repeat is needed to obtain a score. This recording is outside the research model’s supported range.'
    if classification in ('failed', 'unavailable') and not skipped:
        retry = 'The operator can check the reported service or model error; repeating the recording may not resolve it.'
    return RecordingAnalysis(capture_status='skipped' if status == 'skipped' else 'unknown' if status == 'not_provided' else 'received', decoding_status='decoded' if measured or output is not None else 'not_provided' if skipped else 'unknown',
        measurement_status='available' if measured else 'unavailable', quality_status=quality_status,
        model_status='unavailable' if classifier.get('status') == 'model_unavailable' else 'available' if output is not None or (classifier.get('model') or {}).get('weights_sha256') else 'unknown',
        applicability_status=domain or ('not_assessed' if output is None else 'supported_input_unvalidated_transfer'),
        classification_status=classification, output=output, reason=reason, retry_action=retry).model_dump()
