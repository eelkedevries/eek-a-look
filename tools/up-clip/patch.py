"""Make the authors' train.py run here, with as few changes as possible (prompt 045).

The authors' repository has no licence file, so their code is not copied into
eek-a-look. This script writes .cache/train_8gb.py from the pinned train.py and
records the changes as train_8gb.diff, which is committed.

Changes:
1. compute_loss accepts num_items_in_batch, which current transformers passes.
2. TrainingArguments no longer takes logging_dir (removed in transformers 5).
3. Two options, off by default, for an 8 GB GPU: --gradient_checkpointing and
   --optim (default "adamw_torch", the authors' optimiser).
"""

import difflib
import sys

from fetch import HERE, REPO

SOURCE = REPO / "train.py"
TARGET = HERE / ".cache" / "train_8gb.py"
DIFF = HERE / "train_8gb.diff"

CHANGES = [
    ("    def compute_loss(self, model, inputs, return_outputs=False):\n",
     "    def compute_loss(self, model, inputs, return_outputs=False, num_items_in_batch=None):\n"),
    ("        logging_dir='./logs',\n", ""),
    ("    parser.add_argument(\"--warmup_steps\", type=int, default=200, help=\"Warmup steps for scheduler\")\n",
     "    parser.add_argument(\"--warmup_steps\", type=int, default=200, help=\"Warmup steps for scheduler\")\n"
     "    parser.add_argument(\"--gradient_checkpointing\", action=\"store_true\", help=\"8 GB GPU: recompute activations\")\n"
     "    parser.add_argument(\"--optim\", type=str, default=\"adamw_torch\", help=\"8 GB GPU: e.g. adamw_bnb_8bit\")\n"),
    ("        weight_decay=0.01,\n",
     "        weight_decay=0.01,\n"
     "        gradient_checkpointing=args.gradient_checkpointing,\n"
     "        optim=args.optim,\n"),
]


def main() -> int:
    original = SOURCE.read_text()
    text = original
    for old, new in CHANGES:
        if text.count(old) != 1:
            print(f"Expected exactly one occurrence of: {old.strip()}", file=sys.stderr)
            return 1
        text = text.replace(old, new)
    TARGET.write_text(text)
    DIFF.write_text("".join(difflib.unified_diff(
        original.splitlines(keepends=True), text.splitlines(keepends=True),
        fromfile="UP-CLIP/train.py", tofile="train_8gb.py", n=1)))
    print(f"wrote {TARGET.relative_to(HERE)} and {DIFF.relative_to(HERE)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
