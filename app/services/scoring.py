from dataclasses import dataclass


@dataclass
class HexSignals:
    event_count: int
    total_fatalities: int
    firms_signal: float
    gdelt_sentiment: float


def compute_conflict_intensity(event_count: int, total_fatalities: int) -> float:
    event_pressure = min(1.0, event_count / 10.0)
    fatality_pressure = min(1.0, total_fatalities / 50.0)
    return round((0.6 * event_pressure) + (0.4 * fatality_pressure), 4)


def compute_threat_score(signals: HexSignals) -> float:
    conflict_intensity = compute_conflict_intensity(signals.event_count, signals.total_fatalities)
    firms_norm = min(1.0, max(0.0, signals.firms_signal / 100.0))
    sentiment_risk = min(1.0, max(0.0, (1.0 - signals.gdelt_sentiment) / 2.0))

    weighted = (0.5 * conflict_intensity) + (0.3 * firms_norm) + (0.2 * sentiment_risk)
    return round(weighted * 100.0, 2)


def classify_alert(conflict_intensity: float, firms_signal: float, gdelt_sentiment: float) -> str:
    if conflict_intensity >= 0.65:
        return "conflict"
    if firms_signal >= 70:
        return "infrastructure"
    if gdelt_sentiment <= -0.30:
        return "political"
    return "watch"
