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


class HexGridResponse(BaseModel):
    generated_at: datetime
    count: int
    items: list[HexCell]


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
