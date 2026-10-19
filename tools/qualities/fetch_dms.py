"""Download the DMS46 material model and its taxonomy (prompt 042).

Upchurch, P. & Niu, R. (2022). A dense material segmentation dataset for
indoor and outdoor scene parsing. ECCV 2022. https://github.com/apple/ml-dms-dataset

- dms46_v1.zip: the pre-trained model (TorchScript), under Apple's sample-code
  licence (LICENSE.txt in the repository); trained on labels under CC BY-NC 4.0.
- taxonomy.json at a pinned commit of the repository.

Both go into .cache/dms/ (ignored by git) and are never published. Files
already present with the right SHA-256 are skipped.
"""

import hashlib
import sys
import urllib.request
import zipfile

from shared import CACHE

DIR = CACHE / "dms"
COMMIT = "a379a63e9435e32134a465eb31ecb0aefebed985"
FILES = {
    "dms46_v1.zip": ("https://docs-assets.developer.apple.com/ml-research/datasets/dms/dms46_v1.zip",
                     "3aa3645927148e9ed64571bcbd6997efcc07378eb14690db328b5530de8460c1"),
    "taxonomy.json": (f"https://raw.githubusercontent.com/apple/ml-dms-dataset/{COMMIT}/taxonomy.json",
                      "5fb9f5b6d81b800468db78532a9284f060ddc2e2a44b8214658be797029439ea"),
}


def sha256(path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    DIR.mkdir(parents=True, exist_ok=True)
    for name, (url, expected) in FILES.items():
        path = DIR / name
        if not (path.exists() and sha256(path) == expected):
            print(f"{name}: downloading …", flush=True)
            partial = path.with_name(name + ".part")
            urllib.request.urlretrieve(url, partial)
            actual = sha256(partial)
            if actual != expected:
                partial.unlink()
                print(f"{name}: SHA-256 {actual} does not match {expected}", file=sys.stderr)
                return 1
            partial.replace(path)
        print(f"{name}: SHA-256 OK")
    model = DIR / "DMS46_v1.pt"
    if not model.exists():
        with zipfile.ZipFile(DIR / "dms46_v1.zip") as z:
            for member in z.namelist():
                if member.endswith(".pt"):
                    model.write_bytes(z.read(member))
        print(f"extracted {model.relative_to(CACHE.parent)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
