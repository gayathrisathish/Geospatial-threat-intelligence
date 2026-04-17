# GeoSentinel Backend 

FastAPI + SQLite backend for geospatial threat intelligence demos covering the Caucasus and Central Asia region.

## What is included

- ACLED-compatible ingestion path (`scripts/seed_db.py --acled data/acled.csv`)
- Fallback synthetic event generation for offline demo
- H3 hex assignment per event
- Weighted threat score computation
- Population, environmental, and economic prototype signals per hex
- Isolation Forest anomaly flags
- Risk-driver explainability (top contributing factors)
- REST API endpoints:
  - `GET /hexgrid`
  - `GET /hex/{id}`
  - `POST /alert`
  - `POST /forecast`
  - `GET /health`

## Quick start

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python scripts/seed_db.py
uvicorn app.main:app --reload
```

API docs: http://127.0.0.1:8000/docs

## GNN forecasting

This repo now includes a trainable spatio-temporal GNN forecast pipeline:

- Training script: `scripts/train_gnn.py`
- Model/data service: `app/services/forecast_gnn.py`
- API endpoint: `POST /forecast`

Train all horizons (7/14/30 days):

```bash
python scripts/train_gnn.py --epochs 120
```

Request a forecast:

```bash
curl -X POST "http://127.0.0.1:8000/forecast" \
  -H "Content-Type: application/json" \
  -d '{"hex_id":"85283083fffffff"}'
```

PyTorch compatibility note:

- Forecast training/inference requires PyTorch.
- Use Python 3.11 or 3.12 for the most reliable torch wheel support.

## Data notes

- Coverage: Caucasus and Central Asia (Armenia, Azerbaijan, Georgia, Kazakhstan, Kyrgyzstan, Tajikistan, Turkmenistan, Uzbekistan)
- Data source: ACLED (Armed Conflict Location & Event Data Project)
- SQLite DB is stored at `data/geosentinel.db`
- If `data/acled.csv` exists with columns below, the seed script ingests it:
  - `event_date`, `latitude`, `longitude`, `fatalities`, `event_type`
- If no ACLED file is present, synthetic conflict events are generated (lat 37.27–53.83°N, lng 4.58–81.97°E)

## Example API calls

```bash
curl "http://127.0.0.1:8000/hexgrid?min_score=40"
curl "http://127.0.0.1:8000/hex/84754a9ffffffff"
curl -X POST "http://127.0.0.1:8000/alert" \
  -H "Content-Type: application/json" \
  -d '{"hex_id":"84754a9ffffffff", "threshold": 60}'
```
