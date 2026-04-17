import logging
from dataclasses import dataclass

from app.database import get_connection
from app.services.scoring import HexSignals, compute_top_risk_drivers

logger = logging.getLogger(__name__)


@dataclass
class SitrepContext:
    hex_id: str
    threat_score: float
    anomaly: bool
    event_count: int
    fatalities: int
    population_density: float
    population_vulnerability: float
    environmental_risk: float
    economic_activity: float
    recent_event_types: list[str]
    risk_drivers: dict[str, float]


def get_risk_level(threat_score: float) -> str:
    if threat_score >= 85:
        return "critical"
    if threat_score >= 65:
        return "high"
    if threat_score >= 35:
        return "medium"
    return "low"


def get_recommendation(context: SitrepContext, risk_level: str) -> str:
    if risk_level == "critical":
        return "Escalate immediately, coordinate incident response, and increase monitoring cadence."
    if risk_level == "high":
        if context.anomaly:
            return "Increase analyst review frequency and validate anomaly drivers within 24 hours."
        if context.environmental_risk >= 70:
            return "Coordinate environmental impact checks and increase field verification cadence."
        return "Maintain heightened monitoring and brief stakeholders on emerging risks."
    if risk_level == "medium":
        if context.economic_activity >= 70:
            return "Track economic disruption indicators and maintain routine monitoring."
        return "Continue routine monitoring and re-evaluate after the next event update."
    return "No immediate escalation required; continue baseline monitoring."


def build_summary(context: SitrepContext, risk_level: str) -> str:
    anomaly_text = "an anomaly is flagged" if context.anomaly else "no anomaly is currently flagged"
    recent_types = ", ".join(context.recent_event_types[:3]) if context.recent_event_types else "no recent event types"
    drivers = ", ".join([f"{name} ({value:.1f}%)" for name, value in context.risk_drivers.items()])
    if not drivers:
        drivers = "insufficient driver data"

    return (
        f"Hex {context.hex_id} is assessed as {risk_level.upper()} risk with "
        f"{context.event_count} events and {context.fatalities} reported fatalities. "
        f"Threat score is {context.threat_score:.2f}; {anomaly_text}. "
        f"Population density is {context.population_density:.1f} with vulnerability {context.population_vulnerability:.2f}; "
        f"environmental risk is {context.environmental_risk:.1f} and economic activity is {context.economic_activity:.1f}. "
        f"Top risk drivers are {drivers}. "
        f"Recent activity includes {recent_types}."
    )


def get_sitrep_context(hex_id: str) -> SitrepContext | None:
    with get_connection() as conn:
        cell = conn.execute(
            """
            SELECT
                hex_id,
                threat_score,
                anomaly_flag,
                event_count,
                total_fatalities,
                firms_signal,
                gdelt_sentiment,
                population_density,
                population_vulnerability,
                environmental_risk,
                economic_activity
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

    return SitrepContext(
        hex_id=str(cell["hex_id"]),
        threat_score=float(cell["threat_score"]),
        anomaly=bool(cell["anomaly_flag"]),
        event_count=int(cell["event_count"]),
        fatalities=int(cell["total_fatalities"]),
        population_density=float(cell["population_density"]),
        population_vulnerability=float(cell["population_vulnerability"]),
        environmental_risk=float(cell["environmental_risk"]),
        economic_activity=float(cell["economic_activity"]),
        recent_event_types=recent_event_types,
        risk_drivers=compute_top_risk_drivers(signal_bundle),
    )
