"""Download the authors' UP-CLIP repository at a pinned commit (prompt 045).

Huang, G., Song, X. & Jiao, H. (2026). From pixels to perception: fine-tuning
vision-language models for semantic urban perception. International Journal of
Digital Earth 19(1), 2677402. https://doi.org/10.1080/17538947.2026.2677402

The repository holds the training script and a 1,000-pair sample of
street-view images from Wuhan with captions. It has no licence file and no
trained checkpoint. Everything goes into .cache/repo/ (ignored by git) and is
never published: not the images, not the captions, not any weights.

GitHub builds commit archives on demand and does not promise identical bytes,
so the check is on the files inside the archive, not on the archive itself.
"""

import hashlib
import sys
import tarfile
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
CACHE = HERE / ".cache"
REPO = CACHE / "repo"
OWNER_REPO = "19883120121i-afk/UP-CLIP"
COMMIT = "ef1bb1841ca09d9c3a0650c2bd901715140f1611"  # "Upload full project with dataset", 2025-11-30
ARCHIVE = CACHE / f"UP-CLIP-{COMMIT[:7]}.tar.gz"
EXPECTED = {  # SHA-256 of the files used, at COMMIT
    "train.py": "aa6c568f4f4a7decc167d797b37f3b633ed1e1d5a4681c72ab0ef2d970643c7e",
    "requirements.txt": "51d8e04e095ebdb5c592afdd97408b0c02e08134548f3d83ca945eba9f90914e",
    "data/dataset-1k.csv": "a89adf9595215b44d225ed8ee93593c8b346a3d209007046dc56d5ed1b6bc7b6",
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    CACHE.mkdir(parents=True, exist_ok=True)
    if not ARCHIVE.exists():
        print(f"downloading {OWNER_REPO}@{COMMIT[:7]} …", flush=True)
        urllib.request.urlretrieve(f"https://codeload.github.com/{OWNER_REPO}/tar.gz/{COMMIT}", ARCHIVE)
    if not REPO.exists():
        with tarfile.open(ARCHIVE) as tar:
            top = tar.getnames()[0].split("/")[0]
            tar.extractall(CACHE, filter="data")
        (CACHE / top).rename(REPO)
    failed = False
    for name, expected in EXPECTED.items():
        actual = sha256(REPO / name)
        ok = expected is None or actual == expected
        failed |= not ok
        print(f"{name}: {actual}{'' if ok else f' (expected {expected})'}")
    images = sorted((REPO / "data" / "image").glob("*.jpg"))
    print(f"{len(images)} sample images in {REPO.relative_to(HERE)}/data/image")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
