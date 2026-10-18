"""Download the two human-labelled datasets used to check the areas.

- eTRIMS Image Database v1 (Korč & Förstner 2009, TR-IGG-P-2009-01, University
  of Bonn): "Data provided here may be used for research purposes."
- CMP Facade Database, base set (Tyleček & Šára 2013, Proc. GCPR): CC BY-SA.

Both go into .cache/validation/ (ignored by git) and are never published.
Files already present with the right SHA-256 are skipped.
"""

import hashlib
import sys
import urllib.request
import zipfile

from common import CACHE

DIR = CACHE / "validation"
FILES = {
    "etrims-db_v1.zip": (
        "https://www.ipb.uni-bonn.de/projects/etrims_db/downloads/etrims-db_v1.zip",
        "cc69aa500375e2add7f19c3490be4bf8838eef25f201b4e673c63837e0785ddf",
        "etrims",
    ),
    "CMP_facade_DB_base.zip": (
        "https://cmp.felk.cvut.cz/~tylecr1/facade/CMP_facade_DB_base.zip",
        "5cff59b2156dad44e00777ee43960357b44c1522bd2f8701e52bc6026305a29a",
        "cmp",
    ),
}


def sha256(path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    DIR.mkdir(parents=True, exist_ok=True)
    for name, (url, expected, folder) in FILES.items():
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
        if not (DIR / folder).exists():
            with zipfile.ZipFile(path) as z:
                z.extractall(DIR / folder)
            print(f"{name}: extracted to {(DIR / folder).relative_to(CACHE.parent)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
