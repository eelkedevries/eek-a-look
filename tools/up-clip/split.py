"""The authors' own train/validation split, rebuilt exactly as train.py makes it:
datasets.Dataset.train_test_split(test_size=0.2, seed=42) on the CSV rows in
order. evaluate.py uses the held-out part as the test pool."""

import hashlib
from pathlib import Path

import pandas as pd
from datasets import Dataset

HERE = Path(__file__).resolve().parent
REPO = HERE / ".cache" / "repo"
CSV = REPO / "data" / "dataset-1k.csv"
IMAGES = REPO / "data" / "image"


def split() -> tuple[pd.DataFrame, pd.DataFrame]:
    """(train rows, held-out rows) of the CSV, each with columns filename, text and the row index."""
    df = pd.read_csv(CSV)
    dataset = Dataset.from_dict({"image_path": df["filename"].tolist(), "caption": df["text"].tolist(),
                                 "row": list(range(len(df)))})
    parts = dataset.train_test_split(test_size=0.2, seed=42)
    return df.iloc[parts["train"]["row"]].copy(), df.iloc[parts["test"]["row"]].copy()


def image_hash(name: str) -> str:
    return hashlib.sha256((IMAGES / name).read_bytes()).hexdigest()
