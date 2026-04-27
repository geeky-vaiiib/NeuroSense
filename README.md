# NeuroSense

NeuroSense is now a dual-track ASD screening product with first-class `adult` and `child` categories across the Vite/React frontend, FastAPI backend, mock data layer, case storage, explainability, and model training pipeline.

## What changed

- Adult and child screenings are separate experiences with different copy, routing, validation, and interpretation.
- The backend routes screening requests to category-specific model artifacts and returns category/model metadata in screening, case, dashboard, and explainability responses.
- Case records now persist category, respondent context, model info, and questionnaire data in `backend/cases_db.json`.
- Frontend pages use one shared contract for screening, results, cases, dashboard, and mock fallback behavior.

## Architecture

### Frontend

- `src/pages/Screening.jsx`
  Category-first wizard with `/app/screening` entry selection and `/app/screening/:category` routes.
- `src/pages/Results.jsx`
  Category-aware results page with SHAP/LIME panels, model tags, and respondent metadata.
- `src/pages/Cases.jsx`
  Case history with adult/child filtering and visible category badges.
- `src/pages/Dashboard.jsx`
  Mixed adult/child dashboard with category filters and pipeline confidence summaries.
- `src/data/screeningContent.js`
  Central adult/child copy, question wording, validation helpers, and modality metadata.
- `src/data/mockData.js`
  Seeded adult/child records plus local mock submission persistence when the backend is unavailable.

### Backend

- `backend/core/categories.py`
  Central category registry, age validation, category labels, interpretation copy, and feature labels.
- `backend/core/cases_store.py`
  Canonical case normalization, persistence, summaries, and dashboard aggregation.
- `backend/routers/screening.py`
  Category-aware screening submission and case creation.
- `backend/routers/cases.py`
  Case list, case detail, and dashboard summary endpoints.
- `backend/routers/explainability.py`
  Category-aware SHAP/LIME payloads with model/data-source metadata.
- `backend/ml/config.py`
  Shared artifact and dataset paths for adult and child pipelines.

## API contract

### Screening request

`POST /screening/screen`

```json
{
  "category": "adult",
  "demo": {
    "subjectName": "Jordan A.",
    "respondentName": "Jordan A.",
    "respondentRelationship": "Self",
    "age": 34,
    "gender": "Non-binary",
    "ethnicity": "South Asian",
    "jaundice": "No",
    "familyAsd": "Yes"
  },
  "answers": {
    "A1": "Definitely agree"
  },
  "aq10Score": 8
}
```

### Core response fields

These now stay consistent across screening results, case responses, and explainability:

- `category`
- `categoryLabel`
- `modelUsed`
- `isMock`
- `dataSource`
- `riskLevel`
- `aq10Score`

## Running the app

### Frontend

```bash
npm install
npm run dev
```

### Backend

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
```

The frontend expects the backend at `http://localhost:8000`.

## Model training

Training is category-specific and writes separate artifacts for each pipeline.

### Expected datasets

- `backend/data/asd_screening_adult.csv`
- `backend/data/asd_screening_child.csv`

Adult training also accepts the legacy fallback dataset:

- `backend/data/asd_screening.csv`

### Commands

```bash
python3 -m backend.data.train_model --category adult
python3 -m backend.data.train_model --category child
python3 -m backend.data.train_model
```

### Outputs

- `backend/ml/model_adult.pkl`
- `backend/ml/encoders_adult.pkl`
- `backend/ml/background_adult.npy`
- `backend/ml/model_child.pkl`
- `backend/ml/encoders_child.pkl`
- `backend/ml/background_child.npy`

The background arrays are used to give LIME a category-aware reference sample.

## Mock mode

If the backend is unavailable, the frontend falls back to seeded adult/child mock cases and still preserves:

- category badges
- category validation
- category-specific copy
- model/data-source tags
- result and explainability payload shape

Mock submissions are saved locally in browser storage so newly created demo cases still appear in cases, dashboard, and results.

## Verification

Recommended checks from the repo root:

```bash
npm run lint
npm run build
env PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m compileall backend
python3 -c "from backend.main import app; print(app.title)"
```

## Future extension

The category registry and artifact configuration are intentionally structured so future tracks can be added without reworking the routing or storage model. For now, scope is intentionally limited to:

- `adult`
- `child`
