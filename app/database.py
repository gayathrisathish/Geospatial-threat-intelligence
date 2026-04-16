import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Generator

from app.config import DB_PATH


def ensure_data_dir() -> None:
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)


@contextmanager
def get_connection() -> Generator[sqlite3.Connection, None, None]:
    ensure_data_dir()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_schema() -> None:
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source TEXT NOT NULL,
                event_date TEXT NOT NULL,
                event_type TEXT NOT NULL,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                fatalities INTEGER NOT NULL DEFAULT 0,
                sentiment REAL,
                signal_strength REAL,
                hex_id TEXT NOT NULL,
                metadata_json TEXT
            )
            """
        )
        cur.execute("CREATE INDEX IF NOT EXISTS idx_events_hex_id ON events(hex_id)")

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS hex_cells (
                hex_id TEXT PRIMARY KEY,
                event_count INTEGER NOT NULL,
                total_fatalities INTEGER NOT NULL,
                conflict_intensity REAL NOT NULL,
                firms_signal REAL NOT NULL,
                gdelt_sentiment REAL NOT NULL,
                threat_score REAL NOT NULL,
                anomaly_flag INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL
            )
            """
        )

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                hex_id TEXT NOT NULL,
                threat_score REAL NOT NULL,
                threshold REAL NOT NULL,
                alert_type TEXT NOT NULL,
                created_at TEXT NOT NULL,
                details TEXT
            )
            """
        )
