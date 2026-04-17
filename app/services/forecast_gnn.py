from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import h3
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

from app.config import BASE_DIR
from app.database import get_connection
from app.services.scoring import HexSignals, compute_conflict_intensity, compute_threat_score

MODEL_DIR = BASE_DIR / "models"
MODEL_TEMPLATE = "gnn_forecast_h{horizon}.pt"

STATIC_FEATURES = [
    "firms_signal",
    "gdelt_sentiment",
    "population_density",
    "population_vulnerability",
    "environmental_risk",
    "economic_activity",
    "anomaly_flag",
]

DYNAMIC_FEATURES = [
    "event_count_lb",
    "fatalities_lb",
    "conflict_intensity_lb",
    "mean_sentiment_lb",
]

FEATURE_NAMES = DYNAMIC_FEATURES + STATIC_FEATURES

try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F

    TORCH_AVAILABLE = True
except ModuleNotFoundError:
    torch = None
    nn = None
    F = None
    TORCH_AVAILABLE = False


def _require_torch() -> None:
    if TORCH_AVAILABLE:
        return
    raise RuntimeError(
        "PyTorch is required for GNN forecast training/inference but is not installed. "
        "Use a Python version supported by torch (recommended 3.11 or 3.12) and install dependencies again."
    )


@dataclass
class TemporalDataset:
    x: np.ndarray  # [samples, seq_len, num_nodes, num_features]
    y_score: np.ndarray  # [samples, num_nodes]
    y_escalation: np.ndarray  # [samples, num_nodes]
    anchors: list[datetime]
    hex_ids: list[str]
    current_scores: np.ndarray  # [samples, num_nodes]


if TORCH_AVAILABLE:
    class GraphConv(nn.Module):
        def __init__(self, in_dim: int, out_dim: int) -> None:
            super().__init__()
            self.linear = nn.Linear(in_dim, out_dim)

        def forward(self, x: torch.Tensor, adjacency: torch.Tensor) -> torch.Tensor:
            # x: [B, N, F], adjacency: [N, N]
            aggregated = torch.einsum("ij,bjf->bif", adjacency, x)
            return self.linear(aggregated)


    class SpatioTemporalGNN(nn.Module):
        def __init__(self, in_dim: int, hidden_dim: int = 64, rnn_dim: int = 64) -> None:
            super().__init__()
            self.gcn1 = GraphConv(in_dim, hidden_dim)
            self.gcn2 = GraphConv(hidden_dim, hidden_dim)
            self.temporal = nn.GRU(input_size=hidden_dim, hidden_size=rnn_dim, batch_first=True)
            self.score_head = nn.Linear(rnn_dim, 1)
            self.escalation_head = nn.Linear(rnn_dim, 1)

        def forward(self, x_seq: torch.Tensor, adjacency: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
            # x_seq: [B, T, N, F]
            bsz, steps, nodes, _ = x_seq.shape
            encoded_steps = []
            for t in range(steps):
                xt = x_seq[:, t, :, :]
                ht = F.relu(self.gcn1(xt, adjacency))
                ht = F.relu(self.gcn2(ht, adjacency))
                encoded_steps.append(ht)

            # [B, T, N, H] -> [B*N, T, H]
            h_seq = torch.stack(encoded_steps, dim=1)
            h_seq = h_seq.permute(0, 2, 1, 3).reshape(bsz * nodes, steps, -1)

            _, hidden = self.temporal(h_seq)
            last = hidden[-1]  # [B*N, rnn_dim]

            score = self.score_head(last).reshape(bsz, nodes)
            escalation_logit = self.escalation_head(last).reshape(bsz, nodes)
            escalation_prob = torch.sigmoid(escalation_logit)

            # Clamp scores to valid 0-100 range for stability.
            return torch.clamp(score, 0.0, 100.0), escalation_prob
else:
    class SpatioTemporalGNN:  # pragma: no cover - used only when torch is missing.
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            _require_torch()


def _model_path(horizon_days: int) -> Path:
    return MODEL_DIR / MODEL_TEMPLATE.format(horizon=horizon_days)


def _fetch_hex_static() -> pd.DataFrame:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT
                h.hex_id,
                h.firms_signal,
                h.gdelt_sentiment,
                h.population_density,
                h.population_vulnerability,
                h.environmental_risk,
                h.economic_activity,
                h.anomaly_flag,
                h.threat_score,
                COALESCE(AVG(e.latitude), 0) AS lat,
                COALESCE(AVG(e.longitude), 0) AS lng
            FROM hex_cells h
            LEFT JOIN events e ON e.hex_id = h.hex_id
            GROUP BY
                h.hex_id,
                h.firms_signal,
                h.gdelt_sentiment,
                h.population_density,
                h.population_vulnerability,
                h.environmental_risk,
                h.economic_activity,
                h.anomaly_flag,
                h.threat_score
            ORDER BY h.hex_id
            """
        ).fetchall()
    return pd.DataFrame([dict(r) for r in rows])


def _fetch_events() -> pd.DataFrame:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT
                hex_id,
                event_date,
                fatalities,
                COALESCE(sentiment, 0.0) AS sentiment
            FROM events
            """
        ).fetchall()
    if not rows:
        return pd.DataFrame(columns=["hex_id", "event_date", "fatalities", "sentiment"])

    df = pd.DataFrame([dict(r) for r in rows])
    df["event_date"] = pd.to_datetime(df["event_date"], utc=True, errors="coerce")
    df = df.dropna(subset=["event_date", "hex_id"]).copy()
    df["fatalities"] = pd.to_numeric(df["fatalities"], errors="coerce").fillna(0).astype(float)
    df["sentiment"] = pd.to_numeric(df["sentiment"], errors="coerce").fillna(0.0).astype(float)
    return df


def _normalize_adjacency(adjacency: np.ndarray) -> np.ndarray:
    a = adjacency + np.eye(adjacency.shape[0], dtype=np.float32)
    degree = np.sum(a, axis=1)
    inv_sqrt = np.where(degree > 0.0, 1.0 / np.sqrt(degree), 0.0).astype(np.float32)
    normalized = a * inv_sqrt[:, None] * inv_sqrt[None, :]
    return np.nan_to_num(normalized, nan=0.0, posinf=0.0, neginf=0.0)


def build_adjacency(hex_ids: list[str]) -> np.ndarray:
    id_to_idx = {hid: i for i, hid in enumerate(hex_ids)}
    adjacency = np.zeros((len(hex_ids), len(hex_ids)), dtype=np.float32)

    for hid in hex_ids:
        i = id_to_idx[hid]
        adjacency[i, i] = 1.0
        for n in h3.grid_disk(hid, 1):
            j = id_to_idx.get(n)
            if j is not None:
                adjacency[i, j] = 1.0
                adjacency[j, i] = 1.0

    return _normalize_adjacency(adjacency)


def _proxy_threat(event_count: int, fatalities: float, row: pd.Series) -> float:
    signals = HexSignals(
        event_count=int(event_count),
        total_fatalities=int(max(0, fatalities)),
        firms_signal=float(row["firms_signal"]),
        gdelt_sentiment=float(row["gdelt_sentiment"]),
        population_density=float(row["population_density"]),
        population_vulnerability=float(row["population_vulnerability"]),
        environmental_risk=float(row["environmental_risk"]),
        economic_activity=float(row["economic_activity"]),
    )
    return compute_threat_score(signals)


def build_temporal_dataset(
    horizon_days: int,
    seq_len: int = 4,
    anchor_step_days: int = 7,
    lookback_days: int = 14,
) -> tuple[TemporalDataset, np.ndarray]:
    static_df = _fetch_hex_static()
    if static_df.empty:
        raise ValueError("No hex_cells found. Seed database before training GNN.")

    events_df = _fetch_events()
    if events_df.empty:
        raise ValueError("No events found. Seed database before training GNN.")

    hex_ids = static_df["hex_id"].tolist()
    static_df = static_df.set_index("hex_id").loc[hex_ids].reset_index()

    min_date = events_df["event_date"].min().to_pydatetime()
    max_date = events_df["event_date"].max().to_pydatetime()

    start_anchor = min_date + timedelta(days=lookback_days)
    end_anchor = max_date - timedelta(days=horizon_days)

    anchors: list[datetime] = []
    current = start_anchor
    while current <= end_anchor:
        anchors.append(current)
        current += timedelta(days=anchor_step_days)

    if len(anchors) < (seq_len + 5):
        raise ValueError(
            "Not enough temporal snapshots to train. Add more historical events or reduce seq_len/horizon."
        )

    # Build per-anchor node features and labels.
    snapshot_features: list[np.ndarray] = []
    snapshot_current_scores: list[np.ndarray] = []
    snapshot_future_scores: list[np.ndarray] = []

    for anchor in anchors:
        lb_start = anchor - timedelta(days=lookback_days)
        fut_end = anchor + timedelta(days=horizon_days)

        lb_events = events_df[(events_df["event_date"] >= lb_start) & (events_df["event_date"] < anchor)]
        fut_events = events_df[(events_df["event_date"] >= anchor) & (events_df["event_date"] < fut_end)]

        lb_group = lb_events.groupby("hex_id").agg(
            event_count_lb=("hex_id", "count"),
            fatalities_lb=("fatalities", "sum"),
            mean_sentiment_lb=("sentiment", "mean"),
        )
        fut_group = fut_events.groupby("hex_id").agg(
            event_count_fut=("hex_id", "count"),
            fatalities_fut=("fatalities", "sum"),
        )

        features_t = []
        current_t = []
        future_t = []

        for _, row in static_df.iterrows():
            hid = row["hex_id"]
            lb = lb_group.loc[hid] if hid in lb_group.index else None
            fut = fut_group.loc[hid] if hid in fut_group.index else None

            ev_lb = int(lb["event_count_lb"]) if lb is not None else 0
            fat_lb = float(lb["fatalities_lb"]) if lb is not None else 0.0
            sent_lb = float(lb["mean_sentiment_lb"]) if lb is not None else 0.0
            ci_lb = compute_conflict_intensity(ev_lb, int(max(0, fat_lb)))

            feature_vec = [
                float(ev_lb),
                float(fat_lb),
                float(ci_lb),
                float(sent_lb),
                float(row["firms_signal"]),
                float(row["gdelt_sentiment"]),
                float(row["population_density"]),
                float(row["population_vulnerability"]),
                float(row["environmental_risk"]),
                float(row["economic_activity"]),
                float(row["anomaly_flag"]),
            ]

            ev_fut = int(fut["event_count_fut"]) if fut is not None else 0
            fat_fut = float(fut["fatalities_fut"]) if fut is not None else 0.0

            current_score = _proxy_threat(ev_lb, fat_lb, row)
            future_score = _proxy_threat(ev_fut, fat_fut, row)

            features_t.append(feature_vec)
            current_t.append(current_score)
            future_t.append(future_score)

        snapshot_features.append(np.array(features_t, dtype=np.float32))
        snapshot_current_scores.append(np.array(current_t, dtype=np.float32))
        snapshot_future_scores.append(np.array(future_t, dtype=np.float32))

    # Sequence samples.
    x_samples = []
    y_score_samples = []
    y_escalation_samples = []
    current_score_samples = []
    sample_anchors: list[datetime] = []

    for i in range(seq_len - 1, len(anchors)):
        x_seq = np.stack(snapshot_features[i - seq_len + 1 : i + 1], axis=0)
        y_score = snapshot_future_scores[i]
        curr = snapshot_current_scores[i]
        y_esc = (y_score > curr).astype(np.float32)

        x_samples.append(x_seq)
        y_score_samples.append(y_score)
        y_escalation_samples.append(y_esc)
        current_score_samples.append(curr)
        sample_anchors.append(anchors[i])

    dataset = TemporalDataset(
        x=np.stack(x_samples, axis=0),
        y_score=np.stack(y_score_samples, axis=0),
        y_escalation=np.stack(y_escalation_samples, axis=0),
        anchors=sample_anchors,
        hex_ids=hex_ids,
        current_scores=np.stack(current_score_samples, axis=0),
    )

    adjacency = build_adjacency(hex_ids)
    return dataset, adjacency


def _split_indices(num_samples: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    train_end = int(num_samples * 0.7)
    val_end = int(num_samples * 0.85)

    idx = np.arange(num_samples)
    return idx[:train_end], idx[train_end:val_end], idx[val_end:]


def train_gnn_model(
    horizon_days: int,
    epochs: int = 120,
    lr: float = 1e-3,
    hidden_dim: int = 64,
    rnn_dim: int = 64,
    seq_len: int = 4,
) -> dict[str, Any]:
    _require_torch()
    dataset, adjacency_np = build_temporal_dataset(horizon_days=horizon_days, seq_len=seq_len)

    x = dataset.x
    y_score = dataset.y_score
    y_esc = dataset.y_escalation

    train_idx, val_idx, test_idx = _split_indices(x.shape[0])

    if len(train_idx) < 2 or len(val_idx) < 1 or len(test_idx) < 1:
        raise ValueError("Not enough samples for train/val/test split. Add more data.")

    scaler = StandardScaler()
    x_train_flat = x[train_idx].reshape(-1, x.shape[-1])
    scaler.fit(x_train_flat)

    x_scaled = scaler.transform(x.reshape(-1, x.shape[-1])).reshape(x.shape).astype(np.float32)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = SpatioTemporalGNN(in_dim=x.shape[-1], hidden_dim=hidden_dim, rnn_dim=rnn_dim).to(device)

    adjacency = torch.tensor(adjacency_np, dtype=torch.float32, device=device)

    x_tensor = torch.tensor(x_scaled, dtype=torch.float32, device=device)
    y_score_tensor = torch.tensor(y_score, dtype=torch.float32, device=device)
    y_esc_tensor = torch.tensor(y_esc, dtype=torch.float32, device=device)

    optimizer = torch.optim.Adam(model.parameters(), lr=lr)

    best_val = float("inf")
    best_state: dict[str, torch.Tensor] | None = None

    for _ in range(epochs):
        model.train()
        optimizer.zero_grad()

        pred_score, pred_esc = model(x_tensor[train_idx], adjacency)
        loss_score = F.mse_loss(pred_score, y_score_tensor[train_idx])
        loss_esc = F.binary_cross_entropy(pred_esc, y_esc_tensor[train_idx])
        loss = loss_score + (0.35 * loss_esc)

        loss.backward()
        optimizer.step()

        model.eval()
        with torch.no_grad():
            val_pred_score, val_pred_esc = model(x_tensor[val_idx], adjacency)
            val_loss_score = F.mse_loss(val_pred_score, y_score_tensor[val_idx])
            val_loss_esc = F.binary_cross_entropy(val_pred_esc, y_esc_tensor[val_idx])
            val_loss = float((val_loss_score + (0.35 * val_loss_esc)).item())
            if val_loss < best_val:
                best_val = val_loss
                best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}

    if best_state is None:
        raise RuntimeError("Training failed to produce a model state.")

    model.load_state_dict(best_state)
    model.eval()

    with torch.no_grad():
        test_pred_score, test_pred_esc = model(x_tensor[test_idx], adjacency)
        mae = float(torch.mean(torch.abs(test_pred_score - y_score_tensor[test_idx])).item())
        rmse = float(torch.sqrt(torch.mean((test_pred_score - y_score_tensor[test_idx]) ** 2)).item())
        acc = float(
            torch.mean(((test_pred_esc > 0.5).float() == y_esc_tensor[test_idx]).float()).item()
        )

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    path = _model_path(horizon_days)

    payload = {
        "state_dict": model.state_dict(),
        "hex_ids": dataset.hex_ids,
        "feature_names": FEATURE_NAMES,
        "adjacency": adjacency_np,
        "horizon_days": horizon_days,
        "seq_len": seq_len,
        "hidden_dim": hidden_dim,
        "rnn_dim": rnn_dim,
        "feature_mean": scaler.mean_.astype(np.float32),
        "feature_scale": scaler.scale_.astype(np.float32),
        "created_at": datetime.now(tz=timezone.utc).isoformat(),
        "metrics": {
            "mae": mae,
            "rmse": rmse,
            "escalation_accuracy": acc,
            "best_val_loss": best_val,
        },
    }
    torch.save(payload, path)

    return {
        "model_path": str(path),
        "horizon_days": horizon_days,
        "metrics": payload["metrics"],
        "samples": int(x.shape[0]),
        "nodes": int(x.shape[2]),
    }


def _latest_sequence_for_inference(
    hex_ids: list[str],
    seq_len: int,
    lookback_days: int = 14,
    anchor_step_days: int = 7,
) -> tuple[np.ndarray, np.ndarray, pd.DataFrame]:
    static_df = _fetch_hex_static().set_index("hex_id").loc[hex_ids].reset_index()
    events_df = _fetch_events()
    if events_df.empty:
        raise ValueError("No events found for inference.")

    max_date = events_df["event_date"].max().to_pydatetime()
    anchors = [max_date - timedelta(days=anchor_step_days * i) for i in range(seq_len - 1, -1, -1)]

    frames = []
    current_scores = []

    for anchor in anchors:
        lb_start = anchor - timedelta(days=lookback_days)
        lb_events = events_df[(events_df["event_date"] >= lb_start) & (events_df["event_date"] < anchor)]

        lb_group = lb_events.groupby("hex_id").agg(
            event_count_lb=("hex_id", "count"),
            fatalities_lb=("fatalities", "sum"),
            mean_sentiment_lb=("sentiment", "mean"),
        )

        frame_rows = []
        score_rows = []
        for _, row in static_df.iterrows():
            hid = row["hex_id"]
            lb = lb_group.loc[hid] if hid in lb_group.index else None

            ev_lb = int(lb["event_count_lb"]) if lb is not None else 0
            fat_lb = float(lb["fatalities_lb"]) if lb is not None else 0.0
            sent_lb = float(lb["mean_sentiment_lb"]) if lb is not None else 0.0
            ci_lb = compute_conflict_intensity(ev_lb, int(max(0, fat_lb)))

            frame_rows.append(
                [
                    float(ev_lb),
                    float(fat_lb),
                    float(ci_lb),
                    float(sent_lb),
                    float(row["firms_signal"]),
                    float(row["gdelt_sentiment"]),
                    float(row["population_density"]),
                    float(row["population_vulnerability"]),
                    float(row["environmental_risk"]),
                    float(row["economic_activity"]),
                    float(row["anomaly_flag"]),
                ]
            )
            score_rows.append(_proxy_threat(ev_lb, fat_lb, row))

        frames.append(np.array(frame_rows, dtype=np.float32))
        current_scores.append(np.array(score_rows, dtype=np.float32))

    x_latest = np.stack(frames, axis=0)  # [T, N, F]
    current_latest = current_scores[-1]  # [N]
    return x_latest, current_latest, static_df


def _confidence_from_prediction(
    predicted_score: float,
    current_score: float,
    node_degree: float,
    max_degree: float,
    horizon_days: int,
) -> float:
    drift = abs(predicted_score - current_score) / 100.0
    degree_ratio = 0.0 if max_degree <= 0 else node_degree / max_degree
    base = 0.58 + (0.22 * degree_ratio) + (0.15 * (1.0 - drift)) - (horizon_days / 180.0)
    return float(max(0.05, min(0.98, base)))


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    dlat = np.radians(lat2 - lat1)
    dlon = np.radians(lon2 - lon1)
    a = (
        np.sin(dlat / 2) ** 2
        + np.cos(np.radians(lat1)) * np.cos(np.radians(lat2)) * np.sin(dlon / 2) ** 2
    )
    c = 2 * np.arctan2(np.sqrt(a), np.sqrt(max(1e-12, 1 - a)))
    return float(r * c)


def _load_model_payload(horizon_days: int) -> dict[str, Any]:
    _require_torch()
    path = _model_path(horizon_days)
    if not path.exists():
        raise FileNotFoundError(
            f"Model file not found for {horizon_days}d horizon at {path}. Run scripts/train_gnn.py first."
        )
    # Checkpoints are generated by this app's own training script and include numpy arrays,
    # so use trusted full unpickling for compatibility with torch>=2.6 defaults.
    return torch.load(path, map_location="cpu", weights_only=False)


def forecast_hex_with_trained_gnn(hex_id: str) -> dict[str, Any]:
    _require_torch()
    horizons = [7, 14, 30]
    outputs: dict[int, dict[str, Any]] = {}
    influenced_by: list[dict[str, Any]] = []
    current_score_ref: float | None = None

    for horizon in horizons:
        payload = _load_model_payload(horizon)
        hex_ids = payload["hex_ids"]
        if hex_id not in hex_ids:
            raise ValueError(f"hex_id not found in trained graph: {hex_id}")

        adjacency_np = np.array(payload["adjacency"], dtype=np.float32)
        adjacency = torch.tensor(adjacency_np, dtype=torch.float32)

        x_latest, current_scores, static_df = _latest_sequence_for_inference(
            hex_ids=hex_ids,
            seq_len=int(payload["seq_len"]),
        )

        mean = np.array(payload["feature_mean"], dtype=np.float32)
        scale = np.maximum(np.array(payload["feature_scale"], dtype=np.float32), 1e-6)
        x_scaled = (x_latest - mean.reshape(1, 1, -1)) / scale.reshape(1, 1, -1)

        model = SpatioTemporalGNN(
            in_dim=x_scaled.shape[-1],
            hidden_dim=int(payload["hidden_dim"]),
            rnn_dim=int(payload["rnn_dim"]),
        )
        model.load_state_dict(payload["state_dict"])
        model.eval()

        with torch.no_grad():
            score_pred, esc_pred = model(
                torch.tensor(x_scaled, dtype=torch.float32).unsqueeze(0),
                adjacency,
            )

        idx = hex_ids.index(hex_id)
        predicted_score = float(score_pred[0, idx].item())
        escalation_prob = float(esc_pred[0, idx].item())
        current_score = float(current_scores[idx])

        degree = float(np.sum(adjacency_np[idx]))
        max_degree = float(np.max(np.sum(adjacency_np, axis=1)))
        confidence = _confidence_from_prediction(
            predicted_score=predicted_score,
            current_score=current_score,
            node_degree=degree,
            max_degree=max_degree,
            horizon_days=horizon,
        )

        outputs[horizon] = {
            "score": round(max(0.0, min(100.0, predicted_score)), 2),
            "escalation_probability": round(max(0.0, min(1.0, escalation_prob)), 4),
            "confidence": round(confidence, 4),
        }

        if current_score_ref is None:
            current_score_ref = current_score

        # Compute top influencing neighbors from adjacency-weighted current scores.
        if not influenced_by:
            src = static_df[static_df["hex_id"] == hex_id].iloc[0]
            neighbor_scores = []
            for j, n_hex in enumerate(hex_ids):
                if n_hex == hex_id:
                    continue
                w = float(adjacency_np[idx, j])
                if w <= 0.0:
                    continue
                n_row = static_df.iloc[j]
                contribution = w * float(current_scores[j])
                if contribution <= 0:
                    continue
                distance = _haversine_km(
                    float(src["lat"]),
                    float(src["lng"]),
                    float(n_row["lat"]),
                    float(n_row["lng"]),
                )
                neighbor_scores.append(
                    {
                        "hex_id": n_hex,
                        "distance_km": round(distance, 2),
                        "contribution": round(contribution, 2),
                        "threat_level": round(float(current_scores[j]), 2),
                    }
                )

            neighbor_scores.sort(key=lambda item: item["contribution"], reverse=True)
            influenced_by = neighbor_scores[:5]

    if current_score_ref is None:
        raise RuntimeError("Unable to compute current score for forecast response.")

    return {
        "hex_id": hex_id,
        "current_score": round(current_score_ref, 2),
        "forecast": {
            "day_7": outputs[7],
            "day_14": outputs[14],
            "day_30": outputs[30],
        },
        "influenced_by": influenced_by,
    }
