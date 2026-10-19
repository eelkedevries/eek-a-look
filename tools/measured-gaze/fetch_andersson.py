"""Download the Andersson et al. (2017) photos and hand-labelled recordings into .cache/andersson/.

Andersson, Larsson, Holmqvist, Stridh & Nyström (2017), Behavior Research
Methods 49, 616–637, doi:10.3758/s13428-016-0738-9. The authors released the
software, data and stimuli under the GNU GPL v3 in
github.com/richardandersson/EyeMovementDetectorEvaluation; the files are
taken from one pinned commit and checked against their SHA-256 sums. Files
already present with the right sum are skipped.

Downloaded: the four photos that have recordings, coder MN's labels of the 14
photo recordings used in the article (with Zemblys et al.'s 2018 correction of
one file, as the repository advises), coder RA's labels of the same
recordings for the coder check, and the licence.
"""

import hashlib
import sys
import urllib.parse
import urllib.request
from pathlib import Path

CACHE = Path(__file__).resolve().parent / ".cache" / "andersson"
REPOSITORY = "richardandersson/EyeMovementDetectorEvaluation"
COMMIT = "3e12416ab3fd6254c81811cf03f8e5d67c5d7129"
RAW = f"https://raw.githubusercontent.com/{REPOSITORY}/{COMMIT}/"
ARTICLE = "annotated_data/data used in the article/img/"
FILES = {
    "LICENSE": "589ed823e9a84c56feb95ac58e7cf384626b9cbf4fda2a907bc36e103de1bad2",
    "Stimuli/images/Rome1024x768.png": "6ec3bcc0e47b05bf0d09d708dbb8749dc6b71efde681eff034aa71fceab02cbf",
    "Stimuli/images/Europe1024x768.png": "28ca1ffb26422e54be4be5b9216abf27e0acf0f076518f91d64702e6473ac2a7",
    "Stimuli/images/vy1024x768.png": "1bcfd03d1fd368ab359971683a124c21905ebfbc8e434135f2a4386fda6aefc3",
    "Stimuli/images/konijntjes1024x768.png": "5a90f1ca0f12b9751c39a947c29579fce1687de0b3f95079c37420efb82ac494",
    "annotated_data/fix_by_Zemblys2018/UH29_img_Europe_labelled_FIX_MN.mat": "e8ce5b7c0ecad662f72f7331f3ed0ffa2c88c677d90b6ad888de03552e5873f6",
    ARTICLE + "TH34_img_Europe_labelled_MN.mat": "df5535b2629921de02790353592499ca7b0671e9d428b414916c41284c0dd6a8",
    ARTICLE + "TH34_img_Europe_labelled_RA.mat": "f7f9f948f60272e9843da818396d8c536a0f946a4137a1de351a0a765c54c4f6",
    ARTICLE + "TH34_img_vy_labelled_MN.mat": "7ebd92057d5b5966e692dc62fd864198e3d21b0a6deb79c6118c1de5975e5117",
    ARTICLE + "TH34_img_vy_labelled_RA.mat": "cde33394e1e4c1a478ee877aa886853f952d7ee848a5691e43a92593a533aec2",
    ARTICLE + "TL20_img_konijntjes_labelled_MN.mat": "643b06746646946a9843e9dca2ad60710a3695b3c8f2635bbbc70abec947e207",
    ARTICLE + "TL20_img_konijntjes_labelled_RA.mat": "7ba9ecdb07f511bd1d4259f1bc80b7599b0adf5380b8be423173b6b7733518a0",
    ARTICLE + "TL28_img_konijntjes_labelled_MN.mat": "c7c5d5a61c63fea97c40c43cd2314066e32f2a6ea8dbdc8f5b94bc5b73729880",
    ARTICLE + "TL28_img_konijntjes_labelled_RA.mat": "d34dc1a645496f4c89cb60f0a32507504ae216f79736734216c9db2eb208b70e",
    ARTICLE + "UH21_img_Rome_labelled_MN.mat": "6647f5817795bb91e062c7ad06f6ac8ff1405833026a984d67d69bc5738210d5",
    ARTICLE + "UH21_img_Rome_labelled_RA.mat": "c3d906c653b89ed14a8366de20507004685c639ee2852b27a7b3bffd4fcbc2e6",
    ARTICLE + "UH27_img_vy_labelled_MN.mat": "f37f7ee3e39858cf7081e77a3b4a62b2349dd4a8ee7deb4f16644fe549242d9d",
    ARTICLE + "UH27_img_vy_labelled_RA.mat": "3dbc3bdddc4cb03f762404cdec44e67a2978f11144cd154fc3968a8b041e9bc1",
    ARTICLE + "UH29_img_Europe_labelled_RA.mat": "c7e02fdc283663c4c834d8e25eb6b7875179abab810a2938b5d6e4f4648cbfbe",
    ARTICLE + "UH33_img_vy_labelled_MN.mat": "7bc2ab16a4bad90ff36f367c6ef5f2026eb8ca43bb07b79a2b88e9814a380c02",
    ARTICLE + "UH33_img_vy_labelled_RA.mat": "259707b98ce32e90f56550df8e5ebd15b1de17759fb5c73fe02a96e49288e5b4",
    ARTICLE + "UH47_img_Europe_labelled_MN.mat": "1197e58b44bb9ffac8b764569b7f8ce4462e7be16c443a6d1e402120ce3c8380",
    ARTICLE + "UH47_img_Europe_labelled_RA.mat": "08733d1a7d2b243a5b01cfa8fff5baa94e819fdf2c169308d318ea8d1d5685b5",
    ARTICLE + "UL23_img_Europe_labelled_MN.mat": "445dd8bb179abb0b9b7253995447fc22692a41f0e6188a98861a68685ad1663b",
    ARTICLE + "UL23_img_Europe_labelled_RA.mat": "014973fce81fffc6c4ab91a61a6ee544f940aa6c5c540d2ba680050196fbff2c",
    ARTICLE + "UL31_img_konijntjes_labelled_MN.mat": "eac5c89e682fd4b9412210ac812d2c1b0b238412e06406b162f02de3e121ecda",
    ARTICLE + "UL31_img_konijntjes_labelled_RA.mat": "7f95a3a4d15f9b1caff329c2736c3a0f4ddb46acd951b5890ae37c813b87bb5d",
    ARTICLE + "UL39_img_konijntjes_labelled_MN.mat": "e56dd212d43d2846c4dc52e13ae5507d4e118d1abd7a23455738126eb8750328",
    ARTICLE + "UL39_img_konijntjes_labelled_RA.mat": "f75e68aff149286f32faf2c77d63552ea17d65dbc53cf79e99feedb4751db3bb",
    ARTICLE + "UL43_img_Rome_labelled_MN.mat": "3721cd1e97e5ac289f422b3dba8fc76874a833f74297305268518b3b428923d5",
    ARTICLE + "UL43_img_Rome_labelled_RA.mat": "678692b2b00dcb3f768ae61475809ed43273709b71ceb0ae369191c79a227195",
    ARTICLE + "UL47_img_konijntjes_labelled_MN.mat": "48498e71d1558d54d5d152a9a06b43919dc248cec81b40e6240f7901cc0bf98f",
    ARTICLE + "UL47_img_konijntjes_labelled_RA.mat": "3fffafc527bfae24c323c9dbb8033c1107ec53c866d56c596be68ddf38305a6d",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    for name, expected in FILES.items():
        path = CACHE / name
        if path.exists() and sha256(path) == expected:
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        partial = path.with_name(path.name + ".part")
        urllib.request.urlretrieve(RAW + urllib.parse.quote(name), partial)
        actual = sha256(partial)
        if actual != expected:
            partial.unlink()
            print(f"{name}: SHA-256 {actual} does not match {expected}", file=sys.stderr)
            return 1
        partial.replace(path)
        print(f"{name}: downloaded, SHA-256 OK")
    print(f"{len(FILES)} files present in {CACHE.relative_to(CACHE.parents[1])}, SHA-256 OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
