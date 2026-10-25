"""Predict scanpaths with DeepGaze3.5-VL for the six images of the Example section, on an 8 GB GPU.

DeepGaze3.5-VL (Agrawal, Bethge & Kümmerer, 2026) is a LoRA adapter on InternVL3.5-8B that writes a scanpath as
text: fixations on a 0–99 grid, in order. The published model runs in bf16 (about 17 GB); here the language
model's linear layers are quantised to 4-bit NF4 so that it fits in 8 GB (the owner's choice for prompt 076). The
vision encoder, projector, output layer and LoRA adapter stay unquantised, and the input embeddings run on the
CPU. This is a deviation from the published model, recorded in every output file.

The repository's code and adapter are downloaded at run time into .cache/ and never copied into eek-a-look
(non-commercial research licence); the base model comes from Hugging Face. Only the scanpaths are published.

The image becomes 13 tiles of 448 × 448 px (about 3,500 prompt tokens), so the prompt is run through the model once
per image and each scanpath is drawn from a copy of its cache, one at a time, with its own seed.

Writes public/precomputed/deepgaze35-vl/<photo>.json. With --check, regenerates the first draws of every image and
compares them with the stored file instead.
"""

import argparse
import importlib.metadata
import json
import re
import sys
import time
import urllib.request

from common import CACHE, EXAMPLES, FIXATIONS_PER_PATH, REPO, SCANPATHS_OUT, SCANPATHS_PER_IMAGE, photos, seed_for, sha256, write_json

REPOSITORY = "Susmit-A/DeepGaze3.5-VL"
COMMIT = "5cd84d2225beb92e77617b1ee5c5480cae948ab7"
SOURCES = ["LICENSE", "predict_scanpath.py", "evaluate_vllm_unified.py", "model/combined_adapter/adapter_config.json"]
ADAPTER = "model/combined_adapter/adapter_model.safetensors"
# From the repository's Git LFS pointer at COMMIT.
ADAPTER_SHA256 = "6d9e20ab9c34c9d642be9f75dca9eb10dc3e41251b0e358e5f3042f66a61b346"
BASE_MODEL = "OpenGVLab/InternVL3_5-8B-HF"
BASE_REVISION = "741a7d03020411e666c6109218ab71e08151ef86"
CHECKOUT = CACHE / f"DeepGaze3.5-VL-{COMMIT[:7]}"
# Stop rather than loop for ever if the model rarely writes a valid scanpath.
MAX_DRAWS_PER_KEPT = 5
CHECK_DRAWS = 10
# As predict_scanpath.py: room for the requested fixations.
MAX_NEW_TOKENS = 16 * FIXATIONS_PER_PATH + 16


def fetch_repository() -> None:
    """The four files the run needs and the adapter, at the pinned commit; the adapter checked against its LFS hash."""
    for path in SOURCES:
        target = CHECKOUT / path
        if not target.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            urllib.request.urlretrieve(f"https://raw.githubusercontent.com/{REPOSITORY}/{COMMIT}/{path}", target)
    target = CHECKOUT / ADAPTER
    if not target.exists() or sha256(target) != ADAPTER_SHA256:
        print("Downloading the DeepGaze3.5-VL adapter (349 MB) …")
        partial = target.with_suffix(".partial")
        urllib.request.urlretrieve(f"https://media.githubusercontent.com/media/{REPOSITORY}/{COMMIT}/{ADAPTER}", partial)
        if sha256(partial) != ADAPTER_SHA256:
            partial.unlink()
            raise SystemExit("The adapter's SHA-256 does not match the repository's LFS pointer.")
        partial.rename(target)


def valid(coords: list[tuple[int, int]], text: str) -> bool:
    """Exactly the requested number of fixations, each coordinate on the 0–99 grid before the parser's clipping."""
    raw = re.findall(r"\((\d+),\s*(\d+)\)", text)
    return len(coords) == FIXATIONS_PER_PATH and len(raw) == FIXATIONS_PER_PATH and all(int(v) <= 99 for pair in raw for v in pair)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--check", action="store_true", help=f"regenerate the first {CHECK_DRAWS} draws of every image and compare them with the stored file")
    parser.add_argument("--only-missing", action="store_true", help="skip images that already have scanpaths")
    parser.add_argument("--only", help="one image id")
    parser.add_argument("--lm-head-4bit", action="store_true", help="also quantise the output layer, if loading runs out of GPU memory (a further deviation)")
    # For testing the code path on a small model on the CPU; never used for the published files.
    parser.add_argument("--base-model", default=BASE_MODEL)
    parser.add_argument("--revision", default=BASE_REVISION)
    parser.add_argument("--no-adapter", action="store_true")
    parser.add_argument("--count", type=int, default=SCANPATHS_PER_IMAGE)
    parser.add_argument("--out", default=str(SCANPATHS_OUT))
    args = parser.parse_args()

    import copy

    import torch
    from pathlib import Path
    from PIL import Image
    from transformers import AutoModelForImageTextToText, AutoProcessor, BitsAndBytesConfig, DynamicCache, GenerationConfig

    out_dir = Path(args.out)
    fetch_repository()
    sys.path.insert(0, str(CHECKOUT))
    from predict_scanpath import build_freeview_prompt  # noqa: E402  (the repository's prompt, verbatim)
    from evaluate_vllm_unified import parse_scanpath_reduced  # noqa: E402

    cuda = torch.cuda.is_available()
    published = args.base_model == BASE_MODEL and not args.no_adapter and cuda
    if not cuda:
        print("No CUDA device: running unquantised on the CPU, for testing only.")
    device = torch.device("cuda" if cuda else "cpu")
    # bf16 as the published model; float32 on a CPU test run, where bf16 is slow.
    dtype = torch.bfloat16 if cuda else torch.float32

    started = time.perf_counter()
    processor = AutoProcessor.from_pretrained(args.base_model, revision=args.revision)
    quantisation = (
        BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_use_double_quant=True,
            bnb_4bit_compute_dtype=torch.bfloat16,
            # Only the language model's linear layers are quantised.
            llm_int8_skip_modules=["vision_tower", "multi_modal_projector"] + ([] if args.lm_head_4bit else ["lm_head"]),
        )
        if cuda
        else None
    )
    model = AutoModelForImageTextToText.from_pretrained(
        args.base_model,
        revision=args.revision,
        dtype=dtype,
        quantization_config=quantisation,
        device_map={"": 0} if cuda else None,
    )
    if not args.no_adapter:
        from peft import PeftModel

        model = PeftModel.from_pretrained(model, str(CHECKOUT / "model" / "combined_adapter"))
    model.eval()
    if cuda:
        # The input embeddings (1.2 GB in bf16) are a table look-up: on the CPU they give the same values and free
        # the GPU memory the 4-bit model needs.
        embeddings = model.get_input_embeddings()
        embeddings.to("cpu")
        embeddings.register_forward_pre_hook(lambda module, inputs: tuple(t.to("cpu") for t in inputs))
        embeddings.register_forward_hook(lambda module, inputs, output: output.to(device))
        torch.cuda.empty_cache()
    print(f"Loaded {args.base_model}{'' if args.no_adapter else ' + DeepGaze3.5-VL adapter'} in {time.perf_counter() - started:.0f} s")

    # Pure sampling from the model's distribution: no top-k, top-p or repetition penalty, whatever the model's defaults.
    generation = GenerationConfig(
        do_sample=True,
        temperature=1.0,
        top_k=0,
        top_p=1.0,
        repetition_penalty=1.0,
        max_new_tokens=MAX_NEW_TOKENS,
        eos_token_id=processor.tokenizer.convert_tokens_to_ids("<|im_end|>"),
        pad_token_id=processor.tokenizer.pad_token_id,
    )
    prompt_text = build_freeview_prompt(FIXATIONS_PER_PATH)
    messages = [{"role": "user", "content": [{"type": "image"}, {"type": "text", "text": prompt_text}]}]
    # As FewShotPromptBuilder in the repository: the chat template with the generation prompt.
    prompt = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)

    @torch.inference_mode()
    def prefill(inputs: dict) -> DynamicCache:
        """The cache of every prompt token but the last, image included; generate() then starts from the last token."""
        cache = DynamicCache()
        model(
            input_ids=inputs["input_ids"][:, :-1],
            attention_mask=inputs["attention_mask"][:, :-1],
            pixel_values=inputs["pixel_values"],
            past_key_values=cache,
            use_cache=True,
            logits_to_keep=1,
        )
        return cache

    @torch.inference_mode()
    def draw(inputs: dict, prefix: DynamicCache, seed: int) -> str:
        torch.manual_seed(seed)
        output = model.generate(
            input_ids=inputs["input_ids"],
            attention_mask=inputs["attention_mask"],
            past_key_values=copy.deepcopy(prefix),
            generation_config=generation,
            use_model_defaults=False,
        )
        return processor.decode(output[0, inputs["input_ids"].shape[1] :], skip_special_tokens=True)

    versions = {p: importlib.metadata.version(p) for p in ("torch", "transformers", "peft", "accelerate", "bitsandbytes")}
    failures = 0
    for photo in photos():
        if args.only and photo["id"] != args.only:
            continue
        target = out_dir / f"{photo['id']}.json"
        if args.only_missing and not args.check and target.exists():
            print(f"{photo['id']}: already done")
            continue
        image_path = EXAMPLES / photo["file"]
        image = Image.open(image_path).convert("RGB")
        inputs = processor(images=[image], text=[prompt], return_tensors="pt").to(device)
        inputs["pixel_values"] = inputs["pixel_values"].to(dtype)
        seed = seed_for(photo["id"])
        t0 = time.perf_counter()
        if cuda:
            torch.cuda.reset_peak_memory_stats()
        prefix = prefill(inputs)

        if args.check:
            stored = json.loads(target.read_text())["scanpaths"]
            texts = [draw(inputs, prefix, seed + j) for j in range(CHECK_DRAWS)]
            fresh = [list(map(list, parse_scanpath_reduced(t))) for t in texts if valid(parse_scanpath_reduced(t), t)]
            n = min(len(fresh), len(stored))
            same = n > 0 and fresh[:n] == stored[:n]
            failures += not same
            print(f"{photo['id']:28} first {CHECK_DRAWS} draws: {n} paths {'reproduced' if same else 'DIFFER'}")
            continue

        kept: list[list[tuple[int, int]]] = []
        rejected: list[str] = []
        drawn = 0
        while len(kept) < args.count:
            if drawn >= MAX_DRAWS_PER_KEPT * args.count:
                print(f"{photo['id']}: only {len(kept)} valid scanpaths in {drawn} draws; last rejected: {rejected[-1]!r}")
                return 1
            text = draw(inputs, prefix, seed + drawn)
            drawn += 1
            coords = parse_scanpath_reduced(text)
            if valid(coords, text):
                kept.append(coords)
            else:
                rejected.append(text.strip())
            if drawn % 10 == 0:
                print(f"  {drawn} draws: {len(kept)} kept, {len(rejected)} rejected, {time.perf_counter() - t0:.0f} s", flush=True)
        seconds = time.perf_counter() - t0
        peak = torch.cuda.max_memory_allocated() / 1e9 if cuda else None
        write_json(
            target,
            {
                "model": "deepgaze35-vl",
                "photo": photo["id"],
                "width": photo["width"],
                "height": photo["height"],
                "grid": 100,
                "settings": {
                    "tool": "tools/scanpaths/scanpaths.py (prompt 076)",
                    "model": "DeepGaze3.5-VL, free-viewing adapter (model/combined_adapter); Agrawal, Bethge & Kümmerer (2026), arXiv:2607.02083",
                    "repository": f"https://github.com/{REPOSITORY} at {COMMIT}",
                    "adapter": None if args.no_adapter else f"{ADAPTER} (sha256 {ADAPTER_SHA256})",
                    "baseModel": f"{args.base_model} at {args.revision}",
                    "published": published,
                    "runtime": "transformers + peft + bitsandbytes (the repository uses vLLM with the adapter merged in bf16)",
                    "versions": versions,
                    "device": torch.cuda.get_device_name(0) if cuda else "CPU",
                    "cuda": torch.version.cuda if cuda else None,
                    "quantisation": (
                        "4-bit NF4 with double quantisation (bitsandbytes), bf16 compute, for the language model's linear layers"
                        + (" and the output layer; vision encoder and projector in bf16" if args.lm_head_4bit else "; vision encoder, projector and output layer in bf16")
                        + "; the LoRA adapter as stored, unmerged; input embeddings in bf16 on the CPU"
                        if cuda
                        else "none (float32 on the CPU, test run)"
                    ),
                    "deviation": (
                        "The published model runs the base model in bf16 with the adapter merged. Quantising the language model to 4 bits changes "
                        "its output probabilities by an amount not measured here, so these scanpaths are draws from an approximation of DeepGaze3.5-VL."
                    ),
                    "prompt": f"build_freeview_prompt({FIXATIONS_PER_PATH}) of predict_scanpath.py at the commit above, in the base model's chat template",
                    "image": f"{image_path.relative_to(REPO).as_posix()} (sha256 {sha256(image_path)}), through the base model's processor with its defaults: {len(inputs['pixel_values'])} tiles of 448 × 448, {inputs['input_ids'].shape[1]} prompt tokens",
                    "sampling": {
                        "temperature": 1.0,
                        "topK": None,
                        "topP": 1.0,
                        "repetitionPenalty": 1.0,
                        "maxNewTokens": MAX_NEW_TOKENS,
                        "seed": seed,
                        "seeds": f"one draw at a time from a copy of the prompt's cache, torch.manual_seed(seed + j) before draw j, for j = 0 … {drawn - 1}",
                    },
                    "drawn": drawn,
                    "rejected": len(rejected),
                    "rejectedExamples": rejected[:5],
                    "rule": f"a draw is kept when it has exactly {FIXATIONS_PER_PATH} fixations with coordinates 0–99; the first {args.count} kept draws are stored, in order",
                    "coordinates": "the model's 0–99 grid, x then y; in pixels x × width / 100 and y × height / 100, as predict_scanpath.py",
                    "seconds": round(seconds, 1),
                    "peakGpuGB": round(peak, 2) if peak else None,
                },
                "scanpaths": [list(map(list, c)) for c in kept],
            },
        )
        print(f"{photo['id']:28} {len(kept)} paths from {drawn} draws ({len(rejected)} rejected) in {seconds:.0f} s" + (f", peak {peak:.1f} GB" if peak else ""))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
