"""Toddler-specific recording policy. No child/adult classifier, training prior or domain gate.

Shared media decoding/detection/acoustic utilities are measurements, not trained toddler
predictions. Tracking thresholds below are engineering hygiene only, not age validation.
"""
from datetime import datetime, timezone
import numpy as np


class ToddlerGazeMeasurements:
    def _base(self, session_id):
        return dict(modality='gaze', status='unavailable', model_status='unavailable',
                    model_version='toddler-measurements-v1', dataset='No training dataset; descriptive measurements only',
                    feature_schema_version='toddler-openface-measurements-v1', session_id=session_id,
                    input_population='toddler', analyzed_at=datetime.now(timezone.utc).isoformat(),
                    probability=None,prediction=None,score=None,quality=None,descriptive=None,
                    domain={'status':'unsupported_population'},features={},explanation=None,fusion_eligible=False)

    def _fail(self, base, status, code, reason, detail=''):
        return {**base,'status':status,'error_code':code,'reason':reason,'detail':detail}

    def analyze_frames(self, df, session_id=None):
        base=self._base(session_id)
        df=df.rename(columns=lambda c:c.strip())
        required=['timestamp','confidence','success','gaze_angle_x','gaze_angle_y']
        if any(c not in df for c in required):
            return self._fail(base,'unavailable','TODDLER_GAZE_SCHEMA','OpenFace measurement columns are missing.')
        values=df[required].to_numpy(dtype=float)
        valid=np.isfinite(values).all(1)&(values[:,1]>=.8)&(values[:,2]==1)
        # Reject duplicate/reversed timestamps without borrowing learned preprocessing.
        valid &= np.r_[True,np.diff(values[:,0])>0] if len(values) else np.array([],dtype=bool)
        rows=df.loc[valid];n=len(rows);total=len(df);ratio=n/total if total else 0.
        duration=float(rows.timestamp.iloc[-1]-rows.timestamp.iloc[0]) if n>=2 else 0.
        continuity=float(np.mean(np.diff(rows.timestamp)<=.25)) if n>=2 else 0.
        passed=n>=2 and duration>0 and ratio>=.5
        base['quality']=dict(valid=passed,reason=None if passed else 'insufficient_tracking',error_code=None,
            sample_count=total,valid_sample_count=n,valid_sample_ratio=ratio,
            mean_confidence=float(rows.confidence.mean()) if n else None,tracking_continuity=continuity,
            duration_seconds=duration,window_count=0,data_quality_score=ratio,rejected={'unusable_frames':total-n},warnings=[])
        channels={}
        for key,col in [('gaze_x','gaze_angle_x'),('gaze_y','gaze_angle_y'),('head_yaw','pose_Ry'),('head_pitch','pose_Rx'),('head_roll','pose_Rz')]:
            if n>=2 and col in rows:
                angles=np.rad2deg(rows[col].to_numpy(dtype=float));angles=angles[np.isfinite(angles)]
                if len(angles)>=2:channels[key]={'std_deg':float(angles.std(ddof=1)), 'typical_range_deg':float(np.percentile(angles,95)-np.percentile(angles,5))}
        if channels:base['descriptive']={'channels':channels,'unit':'degrees','basis':f'{n} valid tracked frames',
            'disclaimer':'Descriptive toddler recording measurements only. No calibrated screen position, fixation, eye contact or developmental classification. Quality score is usable-frame fraction.'}
        return self._fail(base,'measurements_available' if passed else 'insufficient_quality',
            'TODDLER_CLASSIFIER_NOT_INSTALLED' if passed else 'TODDLER_TRACKING_INSUFFICIENT',
            'Toddler movement measurements retained; no toddler gaze classifier is installed.' if passed else 'Too few reliable face/gaze measurements; try a comfortable well-lit setup or skip.')


def analyze_toddler_speech(payload, mime):
    from .speech_engine import analyze_speech
    return analyze_speech(payload,mime,measurements_only=True)


def analyze_toddler_face(payload):
    from .facial_engine import analyze_face
    result=analyze_face(payload,research_enabled=False)
    if result['status']=='model_unavailable':
        result['reason']='Toddler facial detection and quality measurements retained; no toddler expression classifier is installed.'
    return result
