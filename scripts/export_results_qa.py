"""Non-identifying synthetic contract fixtures; no participant predictions or evaluation."""
import json
from pathlib import Path
from backend.core.reports import build_report
from backend.core.report_presentation import present
from backend.ml.questionnaire_score import score_questionnaire
from backend.ml.modality_status import questionnaire_state

def build():
    reports={}
    for category in ['adult','child','toddler']:
        answers={f'Q{i}':'A' for i in range(1,11)} if category=='toddler' else {f'A{i}':'Definitely agree' for i in range(1,11)}
        q=score_questionnaire(category,answers)
        states=[questionnaire_state(q,None)]+[{'id':mid,'status':'skipped','output':None} for mid in ['gaze','speech','facial']]
        record={'id':f'QA-{category}','category':category,'created_at':'2026-11-06T12:00:00Z','questionnaire_basis':q,'interpretation':q['interpretation'],'modality_states':states}
        reports[category]=build_report(record)
    partial={'id':'QA-partial','category':'adult','created_at':'2026-11-06T12:00:00Z','questionnaire_basis':reports['adult']['questionnaire'],'modality_states':[
        {'id':'gaze','status':'failed_quality','measurements':{'domain':{'status':'out_of_domain'}}},
        {'id':'speech','status':'measurements_available','measurements':{'pitch_mean':180.123456}},
        {'id':'facial','status':'measurements_available','measurements':{'face_detected':True}},
        {'id':'facial_expression','status':'available_experimental','output':{'label':'happy','class_scores':{'happy':.625,'sad':.375}},'model':{'version':'QA-mocked-model','weights_sha256':'QA-HASH-DO-NOT-SHOW-BY-DEFAULT'}}]}
    reports['partial']=build_report(partial)
    reports['legacy']=present({'case_id':'QA-legacy','report_version':'historical','generated_at':'2020-01-01','questionnaire':None,'modalities':[],'screening_conclusion':'Original historical interpretation.','summary':[],'formatting':'Original values retained.'})
    example=json.loads(Path('backend/reports/research/recorded_demo_example.json').read_text())
    reports['example']=present(example,example=True)
    return reports

if __name__=='__main__':Path('src/test/fixtures/resultsReports.json').write_text(json.dumps(build(),indent=2)+'\n')
