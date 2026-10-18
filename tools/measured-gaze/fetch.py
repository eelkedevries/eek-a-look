"""Download the eye-tracking data and the urban photos into .cache/.

Wilming et al. (2017), Scientific Data 4, 160126, doi:10.1038/sdata.2016.126.
Data and stimuli are CC0 1.0; Zenodo record 5017807 mirrors Dryad
doi:10.5061/dryad.9pf75. Files already present with the right MD5 are skipped.
"""

import hashlib
import sys
import urllib.request
from pathlib import Path

CACHE = Path(__file__).resolve().parent / ".cache"
RECORD = "https://zenodo.org/api/records/5017807/files"
FILES = {
    "etdb_v1.0.hdf5": "473684bb542257e35cb1782a3d098079",
    "Stimuli_8.zip": "1e87c119c4b96ca192719e3acd8866dc",
}


def md5(path: Path) -> str:
    digest = hashlib.md5()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    CACHE.mkdir(parents=True, exist_ok=True)
    for name, expected in FILES.items():
        path = CACHE / name
        if path.exists() and md5(path) == expected:
            print(f"{name}: present, MD5 OK")
            continue
        print(f"{name}: downloading …", flush=True)
        partial = path.with_name(path.name + ".part")
        urllib.request.urlretrieve(f"{RECORD}/{name}/content", partial)
        actual = md5(partial)
        if actual != expected:
            partial.unlink()
            print(f"{name}: MD5 {actual} does not match {expected}", file=sys.stderr)
            return 1
        partial.replace(path)
        print(f"{name}: {path.stat().st_size / 1e6:.0f} MB, MD5 OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
