from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.forecast_gnn import train_gnn_model


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train spatio-temporal GNN forecast models (7/14/30 day)")
    parser.add_argument(
        "--horizons",
        type=int,
        nargs="+",
        default=[7, 14, 30],
        help="Forecast horizons in days (default: 7 14 30)",
    )
    parser.add_argument("--epochs", type=int, default=120, help="Training epochs per horizon")
    parser.add_argument("--lr", type=float, default=1e-3, help="Learning rate")
    parser.add_argument("--hidden-dim", type=int, default=64, help="Hidden dimension for graph layers")
    parser.add_argument("--rnn-dim", type=int, default=64, help="Hidden dimension for temporal GRU")
    parser.add_argument("--seq-len", type=int, default=4, help="Number of historical windows per sample")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    results = []

    for horizon in args.horizons:
        print(f"Training horizon={horizon} days...")
        result = train_gnn_model(
            horizon_days=horizon,
            epochs=args.epochs,
            lr=args.lr,
            hidden_dim=args.hidden_dim,
            rnn_dim=args.rnn_dim,
            seq_len=args.seq_len,
        )
        results.append(result)
        print(json.dumps(result, indent=2))

    print("\nTraining complete for all requested horizons.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
