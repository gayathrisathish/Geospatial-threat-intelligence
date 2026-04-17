import argparse
import json
import random
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import h3
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import DB_PATH, H3_RESOLUTION
from app.database import get_connection, init_schema
from app.services.anomaly import compute_anomaly_flags
from app.services.scoring import HexSignals, compute_conflict_intensity, compute_threat_score


REGION_LAT_MIN = 37.27
REGION_LAT_MAX = 53.83
REGION_LNG_MIN = 4.58
REGION_LNG_MAX = 81.97


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build GeoSentinel SQLite database")
    parser.add_argument(
        "--acled",
        type=str,
        default="data/acled.csv",
        help="Path to ACLED CSV file. Falls back to generated demo events when missing.",
    )
    parser.add_argument("--rows", type=int, default=250, help="Synthetic event rows if ACLED is absent")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Skip confirmation prompt before wiping existing database rows.",
    )
    return parser.parse_args()


def run_signal_generators() -> None:
    root_dir = Path(__file__).resolve().parents[1]
    synthetic_script = root_dir / "backend" / "synthetic.py"
    if not synthetic_script.exists():
        raise FileNotFoundError(f"Required synthetic generator not found: {synthetic_script}")

    print(f"Running synthetic generator: {synthetic_script}")
    subprocess.run([sys.executable, "synthetic.py"], cwd=synthetic_script.parent, check=True)


def confirm_wipe(force: bool) -> bool:
    geosignal_path = DB_PATH.with_name("geosignal.db")
    existing_db_names = [p.name for p in (DB_PATH, geosignal_path) if p.exists()]
    if not existing_db_names:
        return True

    warning = (
        "Warning: existing DB file(s) "
        f"{', '.join(existing_db_names)} detected; seed will wipe events/hex_cells/alerts in {DB_PATH.name}."
    )
    if force:
        print(f"{warning} Proceeding due to --force.")
        return True

    print(warning)
    answer = input("Continue? [y/N]: ").strip().lower()
    if answer in {"y", "yes"}:
        return True

    print("Seed aborted; database left unchanged.")
    return False


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
        out.loc[:, "latitude"] = pd.to_numeric(out["latitude"], errors="coerce")
        out.loc[:, "longitude"] = pd.to_numeric(out["longitude"], errors="coerce")
        out.loc[:, "fatalities"] = pd.to_numeric(out["fatalities"], errors="coerce").fillna(0)
        out = out[
            out["latitude"].between(REGION_LAT_MIN, REGION_LAT_MAX)
            & out["longitude"].between(REGION_LNG_MIN, REGION_LNG_MAX)
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
    hex_ids = []
    for _, row in out.iterrows():
        try:
            hex_id = h3.latlng_to_cell(float(row["latitude"]), float(row["longitude"]), H3_RESOLUTION)
            hex_ids.append(hex_id)
        except (ValueError, TypeError):
            hex_ids.append(None)
    out["hex_id"] = hex_ids
    return out


def build_hex_metrics(events_df: pd.DataFrame) -> pd.DataFrame:
    grouped = (
        events_df.groupby("hex_id", as_index=False)
        .agg(
            event_count=("hex_id", "count"),
            total_fatalities=("fatalities", "sum"),
            mean_lat=("latitude", "mean"),
            mean_lng=("longitude", "mean"),
        )
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

    def _population_density(row: pd.Series) -> float:
        rng = random.Random(f"pop-density:{row['hex_id']}")
        urban_factor = 1.0 + (abs(float(row["mean_lng"]) - 45.0) / 100.0)
        baseline = rng.uniform(70.0, 780.0) * urban_factor
        boosted = baseline + (float(row["event_count"]) * 18.0)
        return round(max(25.0, min(1500.0, boosted)), 2)

    def _population_vulnerability(row: pd.Series) -> float:
        rng = random.Random(f"pop-vuln:{row['hex_id']}")
        base = rng.uniform(0.20, 0.75)
        event_effect = min(0.2, float(row["event_count"]) / 60.0)
        fatality_effect = min(0.2, float(row["total_fatalities"]) / 600.0)
        return round(max(0.0, min(1.0, base + event_effect + fatality_effect)), 3)

    grouped["population_density"] = grouped.apply(_population_density, axis=1)
    grouped["population_vulnerability"] = grouped.apply(_population_vulnerability, axis=1)

    grouped["environmental_risk"] = grouped.apply(
        lambda row: round(
            max(
                0.0,
                min(
                    100.0,
                    (0.55 * float(row["firms_signal"]))
                    + (0.20 * float(row["event_count"]) * 4.5)
                    + random.Random(f"env:{row['hex_id']}").uniform(8.0, 30.0),
                ),
            ),
            2,
        ),
        axis=1,
    )

    grouped["economic_activity"] = grouped.apply(
        lambda row: round(
            max(
                0.0,
                min(
                    100.0,
                    random.Random(f"econ:{row['hex_id']}").uniform(20.0, 75.0)
                    + (float(row["event_count"]) * 1.8)
                    + (abs(float(row["mean_lng"]) - 50.0) / 7.0),
                ),
            ),
            2,
        ),
        axis=1,
    )

    # Compute conflict_intensity
    conflict_intensities = []
    for _, row in grouped.iterrows():
        ci = compute_conflict_intensity(int(row["event_count"]), int(row["total_fatalities"]))
        conflict_intensities.append(ci)
    grouped["conflict_intensity"] = conflict_intensities

    # Compute threat_score
    threat_scores = []
    for _, row in grouped.iterrows():
        ts = compute_threat_score(
            HexSignals(
                event_count=int(row["event_count"]),
                total_fatalities=int(row["total_fatalities"]),
                firms_signal=float(row["firms_signal"]),
                gdelt_sentiment=float(row["gdelt_sentiment"]),
                population_density=float(row["population_density"]),
                population_vulnerability=float(row["population_vulnerability"]),
                environmental_risk=float(row["environmental_risk"]),
                economic_activity=float(row["economic_activity"]),
            )
        )
        threat_scores.append(ts)
    grouped["threat_score"] = threat_scores

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
            "population_density",
            "population_vulnerability",
            "environmental_risk",
            "economic_activity",
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
                population_density,
                population_vulnerability,
                environmental_risk,
                economic_activity,
                threat_score,
                anomaly_flag,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    row["hex_id"],
                    int(row["event_count"]),
                    int(row["total_fatalities"]),
                    float(row["conflict_intensity"]),
                    float(row["firms_signal"]),
                    float(row["gdelt_sentiment"]),
                    float(row["population_density"]),
                    float(row["population_vulnerability"]),
                    float(row["environmental_risk"]),
                    float(row["economic_activity"]),
                    float(row["threat_score"]),
                    int(row["anomaly_flag"]),
                    row["updated_at"],
                )
                for _, row in metrics_df.iterrows()
            ],
        )


def main() -> None:
    args = _parse_args()
    if not confirm_wipe(args.force):
        return

    # 1) Generate offline FIRMS + GDELT simulation CSVs.
    run_signal_generators()

    # 2) Initialize schema and continue ingestion/scoring pipeline.
    init_schema()

    events = load_or_generate_events(Path(args.acled), args.rows)
    events = add_hex_ids(events)
    metrics = build_hex_metrics(events)
    persist(events, metrics)

    print(f"Seed complete: {len(events)} events, {len(metrics)} hex cells")


if __name__ == "__main__":
    main()
