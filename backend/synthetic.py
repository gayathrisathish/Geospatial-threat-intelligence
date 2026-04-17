from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd


LAT_MIN = 37.27
LAT_MAX = 53.83
LNG_MIN = 4.58
LNG_MAX = 81.97
START_DATE = date(2017, 12, 30)
END_DATE = date(2026, 3, 28)


def _random_dates(rng: np.random.Generator, count: int) -> list[date]:
    total_days = (END_DATE - START_DATE).days + 1
    offsets = rng.integers(0, total_days, size=count)
    return [START_DATE + timedelta(days=int(offset)) for offset in offsets]


def _build_firms(rng: np.random.Generator) -> pd.DataFrame:
    row_count = int(rng.integers(80, 121))
    dates = _random_dates(rng, row_count)
    acq_minutes = rng.integers(0, 24 * 60, size=row_count)
    acq_time = [f"{m // 60:02d}{m % 60:02d}" for m in acq_minutes]

    firms = pd.DataFrame(
        {
            "latitude": np.round(rng.uniform(LAT_MIN, LAT_MAX, size=row_count), 6),
            "longitude": np.round(rng.uniform(LNG_MIN, LNG_MAX, size=row_count), 6),
            "brightness": np.round(rng.uniform(300.0, 450.0, size=row_count), 2),
            "scan": np.round(rng.uniform(0.7, 1.8, size=row_count), 2),
            "track": np.round(rng.uniform(0.7, 1.8, size=row_count), 2),
            "acq_date": [d.isoformat() for d in dates],
            "acq_time": acq_time,
            "confidence": rng.choice(["nominal", "high"], size=row_count, p=[0.55, 0.45]),
        }
    )
    return firms


def _build_gdelt(rng: np.random.Generator) -> pd.DataFrame:
    row_count = int(rng.integers(60, 81))
    dates = _random_dates(rng, row_count)

    gdelt = pd.DataFrame(
        {
            "date": [d.isoformat() for d in dates],
            "lat": np.round(rng.uniform(LAT_MIN, LAT_MAX, size=row_count), 6),
            "lng": np.round(rng.uniform(LNG_MIN, LNG_MAX, size=row_count), 6),
            "goldstein_scale": np.round(rng.uniform(-10.0, 2.0, size=row_count), 2),
            "num_mentions": rng.integers(1, 51, size=row_count),
            "num_sources": rng.integers(1, 21, size=row_count),
            "avg_tone": np.round(rng.uniform(-15.0, -2.0, size=row_count), 2),
        }
    )
    return gdelt


def main() -> None:
    rng = np.random.default_rng(42)
    out_dir = Path(__file__).resolve().parent / "data"
    out_dir.mkdir(parents=True, exist_ok=True)

    firms_df = _build_firms(rng)
    gdelt_df = _build_gdelt(rng)

    firms_path = out_dir / "firms_sim.csv"
    gdelt_path = out_dir / "gdelt_sim.csv"

    firms_df.to_csv(firms_path, index=False)
    gdelt_df.to_csv(gdelt_path, index=False)

    print(f"Wrote {len(firms_df)} rows to {firms_path}")
    print(f"Wrote {len(gdelt_df)} rows to {gdelt_path}")


if __name__ == "__main__":
    main()