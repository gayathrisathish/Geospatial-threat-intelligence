from dataclasses import dataclass


@dataclass
class HexSignals:
    event_count: int
    total_fatalities: int
    firms_signal: float
    gdelt_sentiment: float
    population_density: float
    population_vulnerability: float
    environmental_risk: float
    economic_activity: float


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _normalize_signals(signals: HexSignals) -> dict[str, float]:
    conflict_intensity = compute_conflict_intensity(signals.event_count, signals.total_fatalities)
    firms_norm = _clamp(signals.firms_signal / 100.0, 0.0, 1.0)
    # Support both common sentiment ranges: [-1, 1] and [-10, 10].
    sentiment = _clamp(signals.gdelt_sentiment, -10.0, 10.0)
    sentiment_risk = (10.0 - sentiment) / 20.0

    density_norm = _clamp(signals.population_density / 1200.0, 0.0, 1.0)
    vulnerability_norm = _clamp(signals.population_vulnerability, 0.0, 1.0)
    population_exposure = (0.6 * density_norm) + (0.4 * vulnerability_norm)

    environmental_norm = _clamp(signals.environmental_risk / 100.0, 0.0, 1.0)
    economic_norm = _clamp(signals.economic_activity / 100.0, 0.0, 1.0)

    return {
        "conflict_intensity": conflict_intensity,
        "firms_signal": firms_norm,
        "gdelt_sentiment": sentiment_risk,
        "population_exposure": population_exposure,
        "environmental_risk": environmental_norm,
        "economic_activity": economic_norm,
    }


def compute_score_breakdown(signals: HexSignals) -> dict[str, float]:
    normalized = _normalize_signals(signals)

    weights = {
        "conflict_intensity": 0.35,
        "firms_signal": 0.15,
        "gdelt_sentiment": 0.10,
        "population_exposure": 0.15,
        "environmental_risk": 0.15,
        "economic_activity": 0.10,
    }

    return {key: round(normalized[key] * weights[key], 6) for key in weights}


def compute_conflict_intensity(event_count: int, total_fatalities: int) -> float:
    event_pressure = min(1.0, event_count / 10.0)
    fatality_pressure = min(1.0, total_fatalities / 50.0)
    return round((0.6 * event_pressure) + (0.4 * fatality_pressure), 4)


def compute_threat_score(signals: HexSignals) -> float:
    weighted = sum(compute_score_breakdown(signals).values())
    return round(weighted * 100.0, 2)


def compute_top_risk_drivers(signals: HexSignals, top_n: int = 3) -> dict[str, float]:
    breakdown = compute_score_breakdown(signals)
    total = sum(breakdown.values())
    if total <= 0:
        return {}

    contribution_percent = {
        key: round((value / total) * 100.0, 1)
        for key, value in breakdown.items()
    }

    sorted_drivers = sorted(contribution_percent.items(), key=lambda item: item[1], reverse=True)
    return dict(sorted_drivers[:top_n])


def classify_alert(
    conflict_intensity: float,
    firms_signal: float,
    gdelt_sentiment: float,
    environmental_risk: float,
    economic_activity: float,
) -> str:
    if conflict_intensity >= 0.65:
        return "conflict"
    if environmental_risk >= 75:
        return "environmental"
    if economic_activity >= 75 and conflict_intensity >= 0.4:
        return "economic"
    if firms_signal >= 70:
        return "infrastructure"
    if gdelt_sentiment <= -0.30:
        return "political"
    return "watch"
