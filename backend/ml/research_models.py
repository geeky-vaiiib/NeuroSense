"""Versioned expression/emotion research models. No diagnostic targets or fusion."""
from __future__ import annotations
import numpy as np
import torch
from torch import nn

FACE_CLASSES = ('neutral','happy','sad','fearful','angry','surprised','disgusted')
SPEECH_CLASSES = ('neutral','calm','happy','sad','angry','fearful','disgust','surprised')
FACE_SCHEMA = 'face-gray64-clahe-v1'
SPEECH_SCHEMA = 'audio16k-trim30db-mel64-hop512-4s-v1'
GAZE_SCHEMA = 'eye-tracker-screen-pixels20hz-4s-centered-v1'

class CompactCNN(nn.Module):
    def __init__(self, classes):
        super().__init__()
        self.features=nn.Sequential(nn.Conv2d(1,16,3,padding=1),nn.BatchNorm2d(16),nn.ReLU(),nn.MaxPool2d(2),
            nn.Conv2d(16,32,3,padding=1),nn.BatchNorm2d(32),nn.ReLU(),nn.MaxPool2d(2),
            nn.Conv2d(32,64,3,padding=1),nn.BatchNorm2d(64),nn.ReLU(),nn.MaxPool2d(2),nn.AdaptiveAvgPool2d((4,4)))
        self.head=nn.Sequential(nn.Flatten(),nn.Linear(1024,128),nn.ReLU(),nn.Dropout(.3),nn.Linear(128,classes))
    def forward(self,x): return self.head(self.features(x))

class EyeTrackerBiLSTM(nn.Module):
    def __init__(self):
        super().__init__();self.lstm=nn.LSTM(2,24,batch_first=True,bidirectional=True);self.head=nn.Linear(96,2)
    def forward(self,x):
        h,_=self.lstm(x);return self.head(torch.cat([h.mean(1),h.max(1).values],1))

def face_input(bgr):
    """Shared detector/crop; explicit no-face rejection, never centre-crop success."""
    from .cv_preprocessing import preprocess_frame
    r=preprocess_frame(bgr,target_size=64)
    if not r['face_found'] or r['image'] is None: return None
    return (r['image'].astype(np.float32)[None]/127.5-1)

def audio_inputs(wave, sr):
    import librosa
    wave=np.asarray(wave,dtype=np.float32)
    if wave.ndim!=1 or sr<=0 or not np.isfinite(wave).all(): raise ValueError('invalid audio')
    if sr!=16000: wave=librosa.resample(wave,orig_sr=sr,target_sr=16000)
    if not len(wave) or float(np.max(np.abs(wave)))<1e-5: raise ValueError('silent audio')
    wave,_=librosa.effects.trim(wave,top_db=30)
    # Whole recording split into <=4s chunks; grouping is assigned before this call.
    chunks=[wave[i:i+64000] for i in range(0,len(wave),64000)]
    mel,stats=[],[]
    for w in chunks:
        if len(w)<1600: continue
        w=np.pad(w,(0,max(0,64000-len(w))))
        s=librosa.feature.melspectrogram(y=w,sr=16000,n_fft=1024,hop_length=512,n_mels=64,power=2)
        db=librosa.power_to_db(s,ref=np.max,top_db=80)
        mel.append((db/40+1)[None].astype(np.float32))
        mfcc=librosa.feature.mfcc(S=db,n_mfcc=20)
        stats.append(np.r_[mfcc.mean(1),mfcc.std(1),librosa.feature.zero_crossing_rate(w).mean(),
                           np.sqrt(np.mean(w*w)),librosa.feature.spectral_centroid(y=w,sr=16000).mean()])
    if not mel: raise ValueError('no usable audio chunks')
    return np.stack(mel),np.mean(stats,axis=0).astype(np.float32)
