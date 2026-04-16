from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.database import get_connection, init_schema
from app.schemas import AlertRequest, AlertResponse, HexDetailResponse, HexGridResponse
from app.services.scoring import classify_alert

app = FastAPI(title="GeoSentinel API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    init_schema()


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "geosentinel-api"}


@app.get("/hexgrid", response_model=HexGridResponse)
def get_hexgrid(min_score: float = 0.0) -> HexGridResponse:
    with get_connection() as conn:
        cur = conn.execute(
            """
            SELECT
                hex_id,
                event_count,
                total_fatalities,
                conflict_intensity,
                firms_signal,
                gdelt_sentiment,
                threat_score,
                anomaly_flag,
                updated_at
            FROM hex_cells
            WHERE threat_score >= ?
            ORDER BY threat_score DESC
            """,
            (min_score,),
        )
        rows = [dict(row) for row in cur.fetchall()]

    return {
        "generated_at": datetime.now(tz=timezone.utc),
        "count": len(rows),
        "items": rows,
    }


@app.get("/hex/{hex_id}", response_model=HexDetailResponse)
def get_hex_detail(hex_id: str) -> HexDetailResponse:
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
                threat_score,
                anomaly_flag,
                updated_at
            FROM hex_cells
            WHERE hex_id = ?
            """,
            (hex_id,),
        ).fetchone()
        if not cell:
            raise HTTPException(status_code=404, detail="Hex cell not found")

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
        "cell": dict(cell),
        "recent_events": [dict(event) for event in events],
    }


@app.post("/alert", response_model=AlertResponse)
def post_alert(body: AlertRequest) -> AlertResponse:
    now = datetime.now(tz=timezone.utc)
    with get_connection() as conn:
        cell = conn.execute(
            """
            SELECT threat_score, conflict_intensity, firms_signal, gdelt_sentiment
            FROM hex_cells
            WHERE hex_id = ?
            """,
            (body.hex_id,),
        ).fetchone()
        if not cell:
            raise HTTPException(status_code=404, detail="Hex cell not found")

        threat_score = float(cell["threat_score"])
        crossed = threat_score >= body.threshold
        alert_type = classify_alert(
            conflict_intensity=float(cell["conflict_intensity"]),
            firms_signal=float(cell["firms_signal"]),
            gdelt_sentiment=float(cell["gdelt_sentiment"]),
        )
        if not crossed:
            alert_type = "none"

        conn.execute(
            """
            INSERT INTO alerts (hex_id, threat_score, threshold, alert_type, created_at, details)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                body.hex_id,
                threat_score,
                body.threshold,
                alert_type,
                now.isoformat(),
                "auto-generated from /alert endpoint",
            ),
        )

    return {
        "hex_id": body.hex_id,
        "threat_score": threat_score,
        "threshold": body.threshold,
        "crossed": crossed,
        "alert_type": alert_type,
        "created_at": now,
    }
