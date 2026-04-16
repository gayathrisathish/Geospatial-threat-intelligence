from typing import Iterable

import pandas as pd
from sklearn.ensemble import IsolationForest


FEATURE_COLUMNS = [
    "event_count",
    "total_fatalities",
    "conflict_intensity",
    "firms_signal",
    "gdelt_sentiment",
    "threat_score",
]


def compute_anomaly_flags(rows: Iterable[dict]) -> pd.DataFrame:
    df = pd.DataFrame(rows)
    if df.empty:
        return df

    if len(df) < 5:
        df["anomaly_flag"] = 0
        return df

    model = IsolationForest(
        contamination=0.15,
        random_state=42,
        n_estimators=200,
    )
    predictions = model.fit_predict(df[FEATURE_COLUMNS])
    df["anomaly_flag"] = (predictions == -1).astype(int)
    return df
