from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class HexCell(BaseModel):
    hex_id: str
    event_count: int
    total_fatalities: int
    conflict_intensity: float
    firms_signal: float
    gdelt_sentiment: float
    population_density: float
    population_vulnerability: float
    environmental_risk: float
    economic_activity: float
    threat_score: float
    anomaly_flag: int
    updated_at: datetime
    risk_drivers: dict[str, float] | None = None


class HexGridSignals(BaseModel):
    conflict_intensity: float
    total_fatalities: int
    firms_signal: float
    gdelt_sentiment: float
    population_density: float
    population_vulnerability: float
    environmental_risk: float
    economic_activity: float


class HexGridItem(BaseModel):
    hex_id: str
    lat: float
    lng: float
    threat_score: float
    anomaly_flag: int
    signals: HexGridSignals
    risk_drivers: dict[str, float] | None = None
    event_count: int
    last_event: str | None


class HexDetailResponse(BaseModel):
    cell: HexCell
    recent_events: list[dict[str, Any]]


class AlertRequest(BaseModel):
    hex_id: str = Field(..., description="H3 cell identifier")
    threshold: float = Field(..., ge=0, le=100)


class AlertResponse(BaseModel):
    hex_id: str
    threat_score: float
    threshold: float
    crossed: bool
    alert_type: str
    created_at: datetime


class SitrepRequest(BaseModel):
    hex_id: str = Field(..., description="H3 cell identifier")


class SitrepMetrics(BaseModel):
    event_count: int
    fatalities: int
    threat_score: float
    anomaly: bool
    population_density: float
    environmental_risk: float
    economic_activity: float


class SitrepResponse(BaseModel):
    hex_id: str
    summary: str
    metrics: SitrepMetrics
    risk_level: str
    recommendation: str
    sitrep: str | None = Field(default=None, description="Optional formatted SITREP text for UI compatibility")


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1)
    hex_id: str | None = None


class ChatResponse(BaseModel):
    answer: str
    context_used: bool


class ForecastPoint(BaseModel):
    score: float
    escalation_probability: float
    confidence: float


class ForecastBundle(BaseModel):
    day_7: ForecastPoint
    day_14: ForecastPoint
    day_30: ForecastPoint


class Influencer(BaseModel):
    hex_id: str
    distance_km: float
    contribution: float
    threat_level: float


class ForecastResponse(BaseModel):
    hex_id: str
    current_score: float
    forecast: ForecastBundle
    influenced_by: list[Influencer]


class ForecastRequest(BaseModel):
    hex_id: str = Field(..., description="H3 cell identifier")
