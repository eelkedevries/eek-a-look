"""Download LabelMeFacade for the rhythm comparison of prompt 053.

Fröhlich, B., Rodner, E. & Denzler, J. (2010). A fast approach for pixelwise
labeling of facade images. ICPR 2010. https://github.com/cvjena/labelmefacade

945 street-level façade photos from LabelMe (100 train, 845 test) with colour
label images. "All images should only be used for non-commercial and research
experiments"; the repository has no licence file. Everything stays in
.cache/labelmefacade/ (ignored by git) and is never published.

GitHub builds commit archives on demand without promising identical bytes, so
the check is on files inside the archive: the split lists and the README.
"""

import hashlib
import sys
import tarfile
import urllib.request

from shared import CACHE

COMMIT = "a0dbc272351f9d6914805fbba62d75740308f52f"  # master, 2016-10-24
ARCHIVE = CACHE / f"labelmefacade-{COMMIT[:7]}.tar.gz"
DIR = CACHE / "labelmefacade"
EXPECTED = {  # SHA-256 of the files used, at COMMIT
    "train.txt": "3a28b2922153ccc1a960f45cd0b7ff227a33f2d54f0b9c2c2bda14cfd5dd76c4",
    "test.txt": "a3abc4e31e8bb36bcf968b731b1255e5213dc91062a0229c240e764b55eb0297",
    "README.md": "ae3afddd9b9d1c9c6f37cf59271e34c313a41d87d3a5607da0c55fa83ed4f70c",
}
# Colour codes from the dataset README (R:G:B).
COLOURS = {"various": (0, 0, 0), "building": (128, 0, 0), "car": (128, 0, 128), "door": (128, 128, 0),
           "pavement": (128, 128, 128), "road": (128, 64, 0), "sky": (0, 128, 128), "vegetation": (0, 128, 0),
           "window": (0, 0, 128)}


def sha256(path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    CACHE.mkdir(parents=True, exist_ok=True)
    if not ARCHIVE.exists():
        print(f"downloading cvjena/labelmefacade@{COMMIT[:7]} …", flush=True)
        urllib.request.urlretrieve(f"https://codeload.github.com/cvjena/labelmefacade/tar.gz/{COMMIT}", ARCHIVE)
    if not DIR.exists():
        with tarfile.open(ARCHIVE) as tar:
            top = tar.getnames()[0].split("/")[0]
            tar.extractall(CACHE, filter="data")
        (CACHE / top).rename(DIR)
    failed = False
    for name, expected in EXPECTED.items():
        actual = sha256(DIR / name)
        failed |= expected is not None and actual != expected
        print(f"{name}: {actual}" + ("" if expected in (None, actual) else f" (expected {expected})"))
    print(f"{len(list((DIR / 'images').glob('*')))} images, {len(list((DIR / 'labels').glob('*')))} label files")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
