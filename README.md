# GeoSentinel Backend 

FastAPI + SQLite backend for geospatial threat intelligence demos covering the Caucasus and Central Asia region.

## What is included

- ACLED-compatible ingestion path (`scripts/seed_db.py --acled data/acled.csv`)
- Fallback synthetic event generation for offline demo
- H3 hex assignment per event
- Weighted threat score computation
- Isolation Forest anomaly flags
- REST API endpoints:
  - `GET /hexgrid`
  - `GET /hex/{id}`
  - `POST /alert`
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
