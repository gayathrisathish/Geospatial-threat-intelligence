import logging
from dataclasses import dataclass

from app.database import get_connection

logger = logging.getLogger(__name__)


@dataclass
class SitrepContext:
    hex_id: str
    threat_score: float
    anomaly: bool
    event_count: int
    fatalities: int
    recent_event_types: list[str]


def get_risk_level(threat_score: float) -> str:
    if threat_score >= 85:
        return "critical"
    if threat_score >= 65:
        return "high"
    if threat_score >= 35:
        return "medium"
    return "low"


def get_recommendation(risk_level: str, anomaly: bool) -> str:
    if risk_level == "critical":
        return "Escalate immediately, coordinate incident response, and increase monitoring cadence."
    if risk_level == "high":
        if anomaly:
            return "Increase analyst review frequency and validate anomaly drivers within 24 hours."
        return "Maintain heightened monitoring and brief stakeholders on emerging risks."
    if risk_level == "medium":
        return "Continue routine monitoring and re-evaluate after the next event update."
    return "No immediate escalation required; continue baseline monitoring."


def build_summary(context: SitrepContext, risk_level: str) -> str:
    anomaly_text = "an anomaly is flagged" if context.anomaly else "no anomaly is currently flagged"
    recent_types = ", ".join(context.recent_event_types[:3]) if context.recent_event_types else "no recent event types"

    return (
        f"Hex {context.hex_id} is assessed as {risk_level.upper()} risk with "
        f"{context.event_count} events and {context.fatalities} reported fatalities. "
        f"Threat score is {context.threat_score:.2f}; {anomaly_text}. "
        f"Recent activity includes {recent_types}."
    )


def get_sitrep_context(hex_id: str) -> SitrepContext | None:
    with get_connection() as conn:
        cell = conn.execute(
            """
            SELECT hex_id, threat_score, anomaly_flag, event_count, total_fatalities
            FROM hex_cells
            WHERE hex_id = ?
            """,
            (hex_id,),
        ).fetchone()

        if not cell:
            logger.info("SITREP requested for missing hex_id=%s", hex_id)
            return None

        event_rows = conn.execute(
            """
            SELECT event_type
            FROM events
            WHERE hex_id = ?
            ORDER BY event_date DESC
            LIMIT 10
            """,
            (hex_id,),
        ).fetchall()

    recent_event_types = [str(row["event_type"]) for row in event_rows if row["event_type"]]

    return SitrepContext(
        hex_id=str(cell["hex_id"]),
        threat_score=float(cell["threat_score"]),
        anomaly=bool(cell["anomaly_flag"]),
        event_count=int(cell["event_count"]),
        fatalities=int(cell["total_fatalities"]),
        recent_event_types=recent_event_types,
    )
