# GeoSentinel Project Presentation Script

## 1. Opening (30-45 seconds)

Good [morning/afternoon], everyone.

Today I am presenting our project, **GeoSentinel**, a geospatial threat intelligence platform designed to monitor high-risk regions, detect abnormal patterns, and support faster risk-informed decision making.

In simple terms, GeoSentinel turns raw event data into a live, map-based operational picture where each H3 hexagon is scored for threat level and flagged when anomalies appear.

---

## 2. What Problem We Are Solving (45-60 seconds)

The core problem is that conflict and risk indicators are often fragmented across different data streams. Teams end up reacting late because they are manually stitching together information.

Our objective is to create one workflow that:

- Ingests geospatial event data.
- Aggregates events spatially using H3 hex cells.
- Computes a transparent threat score.
- Detects unusual behavior using anomaly detection.
- Exposes this intelligence through API endpoints and an interactive operations dashboard.

---

## 3. System Overview (1 minute)

The project is built with two major layers:

- **Backend:** FastAPI + SQLite.
- **Frontend:** React + Vite + Leaflet.

### Backend responsibilities

- Define and initialize database schema.
- Seed and process event data.
- Compute conflict intensity and final threat scores.
- Run anomaly detection.
- Serve REST endpoints for map data, cell detail, and alert creation.

### Frontend responsibilities

- Render interactive hex polygons on a map.
- Display score and anomaly context.
- Show selected hex details and alert feed.
- Provide SITREP and analyst Q&A workflows with backend/mock fallback behavior.

---

## 4. What We Have Actually Built So Far (Detailed) (3-4 minutes)

### 4.1 Data and persistence pipeline

We implemented a full data pipeline that can:

- Read ACLED-compatible CSV input.
- Fall back to synthetic event generation when external data is absent.
- Assign each event to an H3 hex at resolution 5.
- Aggregate per-hex metrics including event count and fatalities.
- Compute conflict intensity and weighted threat score.
- Run Isolation Forest anomaly detection.
- Persist processed events and hex metrics into SQLite.

Database tables currently include:

- `events`
- `hex_cells`
- `alerts`

This gives us a repeatable baseline for both demos and development testing.

### 4.2 Scoring model and alert logic

We implemented deterministic scoring logic with clear components:

- Conflict intensity from event count and fatalities.
- FIRMS-style signal normalization.
- GDELT sentiment-derived risk adjustment.
- Weighted combination into a 0-100 threat score.

Alert typing is also implemented with rule-based classification:

- `conflict`
- `infrastructure`
- `political`
- `watch`

### 4.3 Backend API endpoints implemented and working

Current live endpoints are:

- `GET /health`
- `GET /hexgrid`
- `GET /hex/{hex_id}`
- `POST /alert`

These endpoints provide the backbone for map visualization, drill-down detail, and alert creation.

### 4.4 Frontend dashboard and UX

We completed a rich frontend with:

- Interactive map polygons derived from H3 IDs.
- Threat-based color encoding per cell.
- Selection behavior and map fit-to-data.
- Side panel with details for the selected hex.
- Alert feed to surface threshold crossings.
- SITREP modal and analyst chat panel.

Frontend stack is in place and production build succeeds.

### 4.5 Resilience behavior

A practical strength in our current implementation is graceful fallback:

- Frontend can force mock mode.
- Frontend can also fall back to mock data if backend is unavailable.

This means demos and UI development are not blocked by backend downtime.

---

## 5. Current Reality Check: What Is Partially Complete or Not Done Yet (2-3 minutes)

This is the most important status section.

### 5.1 Endpoint mismatch between frontend and backend

Frontend currently calls `POST /sitrep` and `POST /chat`, but these routes are not present in the current FastAPI app.

What this means:

- SITREP and chat experiences currently depend on mock/fallback responses.
- They look complete in UI, but backend intelligence generation for those two workflows is not yet fully implemented in the active API.

### 5.2 Inconsistent regional framing in code/comments/data generation

There are inconsistencies between:

- README regional claims.
- Config comments (mentioning Manipur).
- Synthetic generation regions and coordinate ranges.

What this means:

- The platform architecture works, but geographic scope messaging needs harmonization so product narrative and data behavior are aligned.

### 5.3 Data quality and production hardening not finished

Not yet completed:

- Strong input validation and schema checks beyond current baseline.
- Automated tests (unit/integration/e2e) at production confidence level.
- Authentication/authorization and role-based access controls.
- Observability stack (structured logging, metrics, tracing dashboards).
- Deployment artifacts and environment-specific configuration for staging/prod.

### 5.4 Model maturity not finished

Current anomaly/scoring are strong MVP logic, but not yet fully matured for production:

- Limited calibration workflow.
- No model drift monitoring loop.
- No formal backtesting/benchmarking report included yet.

---

## 6. What We Plan To Finish Next (Execution Plan) (2-3 minutes)

### Phase 1: Close functional gaps

- Implement real backend routes for `POST /sitrep` and `POST /chat`.
- Connect those outputs to actual cell/event context in database.
- Add error contracts and response schemas for these endpoints.

### Phase 2: Consistency and data reliability

- Standardize geographic scope across README, config comments, and seed logic.
- Add strict validation for incoming CSV columns, ranges, and null handling.
- Improve seed script ergonomics and reproducibility.

### Phase 3: Quality and trust

- Add backend tests for scoring, anomaly, and endpoint behavior.
- Add frontend tests for map interactions and panel workflows.
- Add confidence checks to ensure frontend/backend contract integrity.

### Phase 4: Production readiness

- Introduce authn/authz and API hardening.
- Add telemetry and monitoring.
- Prepare deployment setup and runbooks.

---

## 7. Project Value Today (45-60 seconds)

Even at current stage, GeoSentinel already demonstrates core value:

- End-to-end flow from ingestion to geospatial risk visualization.
- Explainable threat scoring rather than opaque outputs.
- Anomaly detection integrated into an operator-friendly UI.
- Clear architecture that can scale into full intelligence workflows.

So this is not just a concept; it is a functioning MVP with identifiable completion steps.

---

## 8. Closing (30 seconds)

To summarize:

- We have built the core geospatial threat intelligence engine and dashboard.
- We have validated the main data, scoring, anomaly, and alerting pipeline.
- We still need to complete backend SITREP/chat services, strengthen quality gates, and harden for production.

Our next sprint is focused on closing those exact gaps so GeoSentinel transitions from a strong MVP to an operationally reliable platform.

Thank you.

---

## Optional Q&A Add-on (if asked)

If someone asks: **"What is the single biggest risk right now?"**

Suggested answer:

The largest immediate risk is the backend-feature gap for SITREP and chat, because UI capability currently exceeds live API capability there. We have already identified this clearly, and it is first in our completion roadmap.

If someone asks: **"What makes this different from a static map dashboard?"**

Suggested answer:

GeoSentinel is not just visualization. It performs data ingestion, spatial aggregation, weighted scoring, anomaly detection, and alert generation, then exposes drill-down intelligence workflows through APIs and interactive operations UI.
