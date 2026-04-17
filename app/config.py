from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "geosentinel.db"
H3_RESOLUTION = 5  # Manipur-focused view with finer-grained threat aggregation.
