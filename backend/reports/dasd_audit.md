# DASD audit

- Participants: **82** (ASD 57, TD 25); frames: 41002
- Official split: {'ASD': {'test': 19, 'train': 38}, 'TD': {'test': 8, 'train': 17}}
- Labels: ADOS-2 (README); folders abnormal=ASD(57) normal=TD(25); class_indices.json 0->abnormal 1->normal
- all files are named normal_<n>.csv, also inside abnormal/ -> labels come from folders only
- Metadata: none: no age, sex, ADOS score, stimulus id or session info
- Stimulus: NOT provided. README: children did the experiment at home with a parent; stimulus/task unknown
- Missing data (% of rows NaN): {'gaze_angle_x': 0.0, 'gaze_angle_y': 0.0, 'confidence': 0.0, 'pose_Rx': 0.0, 'pose_Ry': 0.0, 'pose_Rz': 0.0, 'pose_Tz': 0.0}; success flag mean 1.0
- success==1 for every row: frames where OpenFace failed were already removed -> gaps are the only trace of lost tracking

## Per class
```
       participants  frames  dur_mean  dur_min  dur_max  fps_mean  conf_mean  success_mean
label                                                                                     
ASD              57   33226    26.197    10.28    65.56    22.412      0.957           1.0
TD               25    7776    12.643     7.16    18.88    24.434      0.965           1.0
```

## Confounds
- duration-only AUC (ASD positive): **0.915**; frame-rate-only AUC: 0.806
- recording length / frame rate alone separate the classes -> the model must see fixed-length windows on a fixed-rate grid

## Feature inventory
| FEATURE | SOURCE | TYPE | USED FOR MODEL? |
|---|---|---|---|
| gaze_angle_x / gaze_angle_y | OpenFace gaze (radians, camera frame) | continuous | YES (+ derived velocity) |
| gaze_0_*, gaze_1_* | OpenFace per-eye direction vectors | continuous | no (redundant with gaze_angle) |
| confidence, success | OpenFace tracking | continuous / binary | quality gate only |
| timestamp | OpenFace | seconds | resampling grid |
| pose_Rx/Ry/Rz | OpenFace head rotation | continuous | candidate (selected by dev CV) |
| pose_Tx/Ty/Tz | head translation / camera distance | continuous | NO (camera-distance confound) |
| eye_lmk_*, x_/y_/X_/Y_/Z_, p_*, AU* | landmarks, shape, AUs | continuous | no |