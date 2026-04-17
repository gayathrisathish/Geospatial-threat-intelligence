import argparse
import json
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import h3
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import H3_RESOLUTION
from app.database import get_connection, init_schema
from app.services.anomaly import compute_anomaly_flags
from app.services.scoring import HexSignals, compute_conflict_intensity, compute_threat_score


MANIPUR_LAT_MIN = 23.8
MANIPUR_LAT_MAX = 25.7
MANIPUR_LNG_MIN = 93.0
MANIPUR_LNG_MAX = 94.8


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build GeoSentinel SQLite database")
    parser.add_argument(
        "--acled",
        type=str,
        default="data/acled.csv",
        help="Path to ACLED CSV file. Falls back to generated demo events when missing.",
    )
    parser.add_argument("--rows", type=int, default=250, help="Synthetic event rows if ACLED is absent")
    return parser.parse_args()


def load_or_generate_events(acled_path: Path, row_count: int) -> pd.DataFrame:
    if acled_path.exists():
        df = pd.read_csv(acled_path)
        rename_map = {
            "event_date": "event_date",
            "latitude": "latitude",
            "longitude": "longitude",
            "fatalities": "fatalities",
            "event_type": "event_type",
        }
        missing = [col for col in rename_map if col not in df.columns]
        if missing:
            raise ValueError(f"ACLED CSV missing required columns: {missing}")

        out = df[list(rename_map.keys())].copy()
        out["latitude"] = pd.to_numeric(out["latitude"], errors="coerce")
        out["longitude"] = pd.to_numeric(out["longitude"], errors="coerce")
        out["fatalities"] = pd.to_numeric(out["fatalities"], errors="coerce").fillna(0)
        out = out[
            out["latitude"].between(MANIPUR_LAT_MIN, MANIPUR_LAT_MAX)
            & out["longitude"].between(MANIPUR_LNG_MIN, MANIPUR_LNG_MAX)
        ].copy()
        out["source"] = "acled"
        out["sentiment"] = None
        out["signal_strength"] = None
        return out

    random.seed(42)
    regions = [
        (33.89, 35.50),  # Eastern Mediterranean
        (49.44, 32.06),  # Eastern Europe
        (15.50, 32.56),  # Sahel
        (35.68, 51.41),  # Middle East
        (24.71, 46.67),  # Gulf
    ]
    start = datetime.now(tz=timezone.utc) - timedelta(days=40)
    rows = []
    for i in range(row_count):
        lat0, lon0 = random.choice(regions)
        rows.append(
            {
                "source": "acled_sim",
                "event_date": (start + timedelta(hours=6 * i)).date().isoformat(),
                "event_type": random.choice(["Violence", "Protest", "Strategic development"]),
                "latitude": round(lat0 + random.uniform(-1.8, 1.8), 6),
                "longitude": round(lon0 + random.uniform(-1.8, 1.8), 6),
                "fatalities": max(0, int(random.gauss(4.5, 3.0))),
                "sentiment": None,
                "signal_strength": None,
            }
        )
    return pd.DataFrame(rows)


def add_hex_ids(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["hex_id"] = out.apply(
        lambda r: h3.latlng_to_cell(float(r["latitude"]), float(r["longitude"]), H3_RESOLUTION), axis=1
    )
    return out


def build_hex_metrics(events_df: pd.DataFrame) -> pd.DataFrame:
    grouped = (
        events_df.groupby("hex_id", as_index=False)
        .agg(event_count=("hex_id", "count"), total_fatalities=("fatalities", "sum"))
        .reset_index(drop=True)
        .copy()
    )

    random.seed(99)
    grouped = grouped.assign(
        firms_signal=grouped["event_count"].apply(
            lambda c: max(0.0, min(100.0, random.gauss(35 + c * 3.0, 18.0)))
        ),
        gdelt_sentiment=grouped["event_count"].apply(
            lambda c: max(-1.0, min(1.0, random.gauss(-0.05 * c, 0.35)))
        ),
    )

    grouped = grouped.assign(
        conflict_intensity=grouped.apply(
            lambda r: compute_conflict_intensity(int(r["event_count"]), int(r["total_fatalities"])), axis=1
        )
    )
    grouped = grouped.assign(
        threat_score=grouped.apply(
            lambda r: compute_threat_score(
                HexSignals(
                    event_count=int(r["event_count"]),
                    total_fatalities=int(r["total_fatalities"]),
                    firms_signal=float(r["firms_signal"]),
                    gdelt_sentiment=float(r["gdelt_sentiment"]),
                )
            ),
            axis=1,
        )
    )

    with_flags = compute_anomaly_flags(grouped.to_dict(orient="records"))
    with_flags["updated_at"] = datetime.now(tz=timezone.utc).isoformat()

    return with_flags[
        [
            "hex_id",
            "event_count",
            "total_fatalities",
            "conflict_intensity",
            "firms_signal",
            "gdelt_sentiment",
            "threat_score",
            "anomaly_flag",
            "updated_at",
        ]
    ]


def persist(events_df: pd.DataFrame, metrics_df: pd.DataFrame) -> None:
    with get_connection() as conn:
        conn.execute("DELETE FROM events")
        conn.execute("DELETE FROM hex_cells")
        conn.execute("DELETE FROM alerts")

        conn.executemany(
            """
            INSERT INTO events (
                source,
                event_date,
                event_type,
                latitude,
                longitude,
                fatalities,
                sentiment,
                signal_strength,
                hex_id,
                metadata_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    row["source"],
                    row["event_date"],
                    row["event_type"],
                    float(row["latitude"]),
                    float(row["longitude"]),
                    int(row["fatalities"]),
                    None if pd.isna(row["sentiment"]) else float(row["sentiment"]),
                    None if pd.isna(row["signal_strength"]) else float(row["signal_strength"]),
                    row["hex_id"],
                    json.dumps({"seeded": True}),
                )
                for _, row in events_df.iterrows()
            ],
        )

        conn.executemany(
            """
            INSERT INTO hex_cells (
                hex_id,
                event_count,
                total_fatalities,
                conflict_intensity,
                firms_signal,
                gdelt_sentiment,
                threat_score,
                anomaly_flag,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    row["hex_id"],
                    int(row["event_count"]),
                    int(row["total_fatalities"]),
                    float(row["conflict_intensity"]),
                    float(row["firms_signal"]),
                    float(row["gdelt_sentiment"]),
                    float(row["threat_score"]),
                    int(row["anomaly_flag"]),
                    row["updated_at"],
                )
                for _, row in metrics_df.iterrows()
            ],
        )


def main() -> None:
    args = _parse_args()
    init_schema()

    events = load_or_generate_events(Path(args.acled), args.rows)
    events = add_hex_ids(events)
    metrics = build_hex_metrics(events)
    persist(events, metrics)

    print(f"Seed complete: {len(events)} events, {len(metrics)} hex cells")


if __name__ == "__main__":
    main()
