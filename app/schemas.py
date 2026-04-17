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
    threat_score: float
    anomaly_flag: int
    updated_at: datetime


class HexGridSignals(BaseModel):
    conflict_intensity: float
    total_fatalities: int
    firms_signal: float
    gdelt_sentiment: float


class HexGridItem(BaseModel):
    hex_id: str
    lat: float
    lng: float
    threat_score: float
    anomaly_flag: int
    signals: HexGridSignals
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
