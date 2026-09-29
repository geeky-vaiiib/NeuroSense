import re

# Fix facial_engine.py
with open('backend/ml/facial_engine.py', 'r') as f:
    facial_content = f.read()
facial_content = facial_content.replace('from ml import cv_preprocessing as _cv', 'from . import cv_preprocessing as _cv')
with open('backend/ml/facial_engine.py', 'w') as f:
    f.write(facial_content)

# Fix preprocessing_pipeline.py
with open('backend/ml/preprocessing_pipeline.py', 'r') as f:
    prep_content = f.read()
prep_content = prep_content.replace('from ml.gaze_engine import compute_gaze_score', 'from .gaze_engine import compute_gaze_score')
prep_content = prep_content.replace('from ml.speech_engine import compute_speech_score', 'from .speech_engine import compute_speech_score')
prep_content = prep_content.replace('from ml.facial_engine import compute_facial_score', 'from .facial_engine import compute_facial_score')
with open('backend/ml/preprocessing_pipeline.py', 'w') as f:
    f.write(prep_content)

# Fix routers/screening.py
with open('backend/routers/screening.py', 'r') as f:
    screening_content = f.read()
screening_content = screening_content.replace('from core.categories import (', 'from ..core.categories import (')
screening_content = screening_content.replace('from ml.fusion_engine import fuse', 'from ..ml.fusion_engine import fuse')
screening_content = screening_content.replace('from ml.model import get_model_registry', 'from ..ml.model import get_model_registry')
with open('backend/routers/screening.py', 'w') as f:
    f.write(screening_content)

# Fix main.py
with open('backend/main.py', 'r') as f:
    main_content = f.read()
main_content = main_content.replace('from core import database', 'from .core import database')
with open('backend/main.py', 'w') as f:
    f.write(main_content)

