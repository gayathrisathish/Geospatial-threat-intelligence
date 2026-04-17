import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.database import get_connection, init_schema
from app.schemas import (
    AlertResponse,
    ChatRequest,
    ChatResponse,
    ForecastRequest,
    ForecastResponse,
    HexDetailResponse,
    HexGridItem,
    SitrepMetrics,
    SitrepRequest,
    SitrepResponse,
)
from app.services.chat_service import answer_question
from app.services.forecast_gnn import forecast_hex_with_trained_gnn
from app.services.scoring import HexSignals, classify_alert, compute_top_risk_drivers
from app.services.sitrep_service import build_summary, get_recommendation, get_risk_level, get_sitrep_context

logger = logging.getLogger(__name__)

app = FastAPI(title="GeoSentinel API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _internal_error(endpoint: str, error: str) -> JSONResponse:
    return JSONResponse(status_code=500, content={"error": error, "endpoint": endpoint})


@app.on_event("startup")
def startup() -> None:
    init_schema()


@app.get("/")
def root() -> dict:
    try:
        return {
            "service": "GeoSentinel API",
            "status": "ok",
            "docs": "/docs",
            "health": "/health",
            "endpoints": [
                "/hexgrid",
                "/hex/{hex_id}",
                "/alert",
                "/sitrep",
                "/chat",
                "/forecast",
            ],
        }
    except HTTPException:
        raise
    except Exception as exc:
        return _internal_error("/", f"failed to build root response: {exc}")


@app.get("/favicon.ico", include_in_schema=False)
def favicon() -> Response:
    try:
        return Response(status_code=204)
    except HTTPException:
        raise
    except Exception as exc:
        return _internal_error("/favicon.ico", f"failed to serve favicon: {exc}")


@app.get("/health")
def health() -> dict:
    try:
        return {"status": "ok", "service": "geosentinel-api"}
    except HTTPException:
        raise
    except Exception as exc:
        return _internal_error("/health", f"failed to build health response: {exc}")


@app.get("/hexgrid", response_model=list[HexGridItem])
def get_hexgrid(min_score: float = 0.0) -> list[HexGridItem]:
    try:
        with get_connection() as conn:
            cur = conn.execute(
                """
                SELECT
                    h.hex_id,
                    ROUND(AVG(e.latitude), 6) AS lat,
                    ROUND(AVG(e.longitude), 6) AS lng,
                    h.threat_score,
                    h.anomaly_flag,
                    h.conflict_intensity,
                    h.total_fatalities,
                    h.firms_signal,
                    h.gdelt_sentiment,
                    h.population_density,
                    h.population_vulnerability,
                    h.environmental_risk,
                    h.economic_activity,
                    h.event_count,
                    MAX(e.event_date) AS last_event
                FROM hex_cells h
                LEFT JOIN events e ON e.hex_id = h.hex_id
                WHERE h.threat_score >= ?
                GROUP BY
                    h.hex_id,
                    h.threat_score,
                    h.anomaly_flag,
                    h.conflict_intensity,
                    h.total_fatalities,
                    h.firms_signal,
                    h.gdelt_sentiment,
                    h.population_density,
                    h.population_vulnerability,
                    h.environmental_risk,
                    h.economic_activity,
                    h.event_count
                ORDER BY h.threat_score DESC
                """,
                (min_score,),
            )
            rows = [dict(row) for row in cur.fetchall()]

        output = []
        for row in rows:
            signal_bundle = HexSignals(
                event_count=int(row["event_count"]),
                total_fatalities=int(row["total_fatalities"]),
                firms_signal=float(row["firms_signal"]),
                gdelt_sentiment=float(row["gdelt_sentiment"]),
                population_density=float(row["population_density"]),
                population_vulnerability=float(row["population_vulnerability"]),
                environmental_risk=float(row["environmental_risk"]),
                economic_activity=float(row["economic_activity"]),
            )

            output.append(
                {
                    "hex_id": row["hex_id"],
                    "lat": row["lat"],
                    "lng": row["lng"],
                    "threat_score": row["threat_score"],
                    "anomaly_flag": row["anomaly_flag"],
                    "signals": {
                        "conflict_intensity": row["conflict_intensity"],
                        "total_fatalities": row["total_fatalities"],
                        "firms_signal": row["firms_signal"],
                        "gdelt_sentiment": row["gdelt_sentiment"],
                        "population_density": row["population_density"],
                        "population_vulnerability": row["population_vulnerability"],
                        "environmental_risk": row["environmental_risk"],
                        "economic_activity": row["economic_activity"],
                    },
                    "risk_drivers": compute_top_risk_drivers(signal_bundle),
                    "event_count": row["event_count"],
                    "last_event": row["last_event"],
                }
            )

        return output
    except HTTPException:
        raise
    except Exception as exc:
        return _internal_error("/hexgrid", f"failed to fetch hex grid: {exc}")


@app.get("/hex/{hex_id}", response_model=HexDetailResponse)
def get_hex_detail(hex_id: str) -> HexDetailResponse:
    try:
        with get_connection() as conn:
            cell = conn.execute(
                """
                SELECT
                    hex_id,
                    event_count,
                    total_fatalities,
                    conflict_intensity,
                    firms_signal,
                    gdelt_sentiment,
                    population_density,
                    population_vulnerability,
                    environmental_risk,
                    economic_activity,
                    threat_score,
                    anomaly_flag,
                    updated_at
                FROM hex_cells
                WHERE hex_id = ?
                """,
                (hex_id,),
            ).fetchone()
            if not cell:
                return JSONResponse(status_code=404, content={"error": "hex not found", "hex_id": hex_id})

            signal_bundle = HexSignals(
                event_count=int(cell["event_count"]),
                total_fatalities=int(cell["total_fatalities"]),
                firms_signal=float(cell["firms_signal"]),
                gdelt_sentiment=float(cell["gdelt_sentiment"]),
                population_density=float(cell["population_density"]),
                population_vulnerability=float(cell["population_vulnerability"]),
                environmental_risk=float(cell["environmental_risk"]),
                economic_activity=float(cell["economic_activity"]),
            )

            events = conn.execute(
                """
                SELECT
                    id,
                    source,
                    event_date,
                    event_type,
                    latitude,
                    longitude,
                    fatalities,
                    sentiment,
                    signal_strength
                FROM events
                WHERE hex_id = ?
                ORDER BY event_date DESC
                LIMIT 25
                """,
                (hex_id,),
            ).fetchall()

        return {
            "cell": {
                **dict(cell),
                "risk_drivers": compute_top_risk_drivers(signal_bundle),
            },
            "recent_events": [dict(event) for event in events],
        }
    except HTTPException:
        raise
    except Exception as exc:
        return _internal_error("/hex/{hex_id}", f"failed to fetch hex detail: {exc}")


@app.post("/alert", response_model=AlertResponse)
def post_alert(body: dict[str, Any]) -> AlertResponse:
    try:
        hex_id = body.get("hex_id") if isinstance(body, dict) else None
        if not hex_id:
            return JSONResponse(status_code=422, content={"error": "hex_id is required"})

        threshold = float(body.get("threshold", 60.0))
        now = datetime.now(tz=timezone.utc)
        with get_connection() as conn:
            cell = conn.execute(
                """
                SELECT
                    threat_score,
                    conflict_intensity,
                    firms_signal,
                    gdelt_sentiment,
                    environmental_risk,
                    economic_activity
                FROM hex_cells
                WHERE hex_id = ?
                """,
                (hex_id,),
            ).fetchone()
            if not cell:
                return JSONResponse(status_code=404, content={"error": "hex not found", "hex_id": hex_id})

            threat_score = float(cell["threat_score"])
            crossed = threat_score >= threshold
            alert_type = classify_alert(
                conflict_intensity=float(cell["conflict_intensity"]),
                firms_signal=float(cell["firms_signal"]),
                gdelt_sentiment=float(cell["gdelt_sentiment"]),
                environmental_risk=float(cell["environmental_risk"]),
                economic_activity=float(cell["economic_activity"]),
            )
            if not crossed:
                alert_type = "none"

            conn.execute(
                """
                INSERT INTO alerts (hex_id, threat_score, threshold, alert_type, created_at, details)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    hex_id,
                    threat_score,
                    threshold,
                    alert_type,
                    now.isoformat(),
                    "auto-generated from /alert endpoint",
                ),
            )

        return {
            "hex_id": hex_id,
            "threat_score": threat_score,
            "threshold": threshold,
            "crossed": crossed,
            "alert_type": alert_type,
            "created_at": now,
        }
    except HTTPException:
        raise
    except Exception as exc:
        return _internal_error("/alert", f"failed to process alert request: {exc}")


@app.post("/sitrep", response_model=SitrepResponse)
def post_sitrep(payload: SitrepRequest) -> SitrepResponse:
    try:
        context = get_sitrep_context(payload.hex_id)
        if context is None:
            raise HTTPException(status_code=404, detail=f"hex not found: {payload.hex_id}")

        risk_level = get_risk_level(context.threat_score)
        summary = build_summary(context, risk_level)
        recommendation = get_recommendation(context, risk_level)

        metrics = SitrepMetrics(
            event_count=context.event_count,
            fatalities=context.fatalities,
            threat_score=context.threat_score,
            anomaly=context.anomaly,
            population_density=context.population_density,
            environmental_risk=context.environmental_risk,
            economic_activity=context.economic_activity,
        )

        # Maintain compatibility with frontend components currently expecting a single text blob.
        sitrep_text = (
            "SITUATION REPORT (SITREP)\n"
            f"HEX SECTOR: {context.hex_id}\n"
            "CLASSIFICATION: UNCLASSIFIED\n\n"
            f"SUMMARY: {summary}\n"
            f"METRICS: events={metrics.event_count}, fatalities={metrics.fatalities}, "
            f"threat_score={metrics.threat_score:.2f}, anomaly={metrics.anomaly}, "
            f"population_density={metrics.population_density:.1f}, "
            f"environmental_risk={metrics.environmental_risk:.1f}, "
            f"economic_activity={metrics.economic_activity:.1f}\n"
            f"RISK LEVEL: {risk_level.upper()}\n"
            f"RECOMMENDATION: {recommendation}"
        )

        return SitrepResponse(
            hex_id=context.hex_id,
            summary=summary,
            metrics=metrics,
            risk_level=risk_level,
            recommendation=recommendation,
            sitrep=sitrep_text,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to build sitrep for hex_id=%s", payload.hex_id)
        raise HTTPException(status_code=500, detail=f"failed to generate sitrep: {exc}")


@app.post("/chat", response_model=ChatResponse)
def post_chat(payload: ChatRequest) -> ChatResponse:
    try:
        question = payload.question.strip()
        if not question:
            raise HTTPException(status_code=422, detail="question is required")

        answer, context_used = answer_question(question=question, hex_id=payload.hex_id)

        return ChatResponse(answer=answer, context_used=context_used)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to answer chat question")
        raise HTTPException(status_code=500, detail=f"failed to generate chat response: {exc}")


@app.post("/forecast", response_model=ForecastResponse)
def post_forecast(payload: ForecastRequest) -> ForecastResponse:
    try:
        result = forecast_hex_with_trained_gnn(payload.hex_id)
        return ForecastResponse(**result)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to generate forecast for hex_id=%s", payload.hex_id)
        raise HTTPException(status_code=500, detail=f"failed to generate forecast: {exc}")
