"""Stage verified local detection resources. No downloads or model regeneration."""
import argparse
import hashlib
import json
import shutil
import sqlite3
import struct
import tempfile
from contextlib import closing
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_lock(speech_platform=None):
    lock = json.loads((ROOT / "data/standard-package.lock.json").read_text())
    if speech_platform is not None:
        if speech_platform not in ("mac", "windows"):
            raise ValueError("Unsupported speech package platform")
        speech = json.loads((ROOT / f"data/whisper-{speech_platform}.lock.json").read_text())
        lock["files"].update(speech["files"])
        lock["speech"] = speech["speech"]
    return lock


def digest(path):
    result = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


def validate(source, lock):
    for relative, expected in lock["files"].items():
        path = source / relative
        if not path.is_file() or digest(path) != expected:
            raise ValueError(f"Missing or changed resource: {relative}")
    model = source / "models/fallback-minilm/model.onnx"
    tokenizer = source / "models/fallback-minilm/tokenizer.json"
    counts = {}
    database = sqlite3.connect((source / "data/rhema.db").resolve().as_uri() + "?mode=ro", uri=True)
    try:
        for translation in ("KJV", "NIV", "NLT"):
            stem = "models/fallback-minilm/kjv-minilm-l6-v2" if translation == "KJV" else f"embeddings/translation-indexes/kjv-minilm-l6-v2-{translation.lower()}"
            vectors, ids = source / (stem + ".bin"), source / (stem + "-ids.bin")
            raw_ids = ids.read_bytes()
            if len(raw_ids) % 8 or vectors.stat().st_size != len(raw_ids) // 8 * 384 * 4:
                raise ValueError(f"Invalid {translation} vector/ID lengths")
            actual = [item[0] for item in struct.iter_unpack("<q", raw_ids)]
            expected = [item[0] for item in database.execute("SELECT v.id FROM verses v JOIN translations t ON t.id=v.translation_id WHERE t.abbreviation=? ORDER BY v.id", (translation,))]
            if not actual or actual != expected:
                raise ValueError(f"{translation} IDs do not match the database")
            counts[translation] = len(actual)
            if translation != "KJV":
                metadata = json.loads((source / (stem + ".json")).read_text())
                expected_metadata = dict(version=1, translation=translation, dimension=384, count=len(actual), max_tokens=128, prefix="", pooling="sentence_embedding-or-mean", model_sha256=digest(model), tokenizer_sha256=digest(tokenizer), vectors_sha256=digest(vectors), ids_sha256=digest(ids))
                if any(metadata.get(key) != value for key, value in expected_metadata.items()):
                    raise ValueError(f"{translation} provenance mismatch")
    finally:
        database.close()
    return counts


def prepare(source, destination, lock):
    counts = validate(source, lock)
    destination.parent.mkdir(parents=True, exist_ok=True)
    # Only replace an existing directory owned by this script.
    if destination.exists() and not (destination / "standard-package.json").is_file():
        raise ValueError(f"Refusing to replace an unrecognized directory: {destination}")
    with tempfile.TemporaryDirectory(dir=destination.parent, prefix="standard-") as temporary:
        stage = Path(temporary) / "pack"
        stage.mkdir()
        for relative in lock["files"]:
            target = stage / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            if relative == "data/rhema.db":
                with closing(sqlite3.connect((source / relative).resolve().as_uri() + "?mode=ro", uri=True)) as original:
                    with closing(sqlite3.connect(target)) as snapshot:
                        original.backup(snapshot)
                        snapshot.execute("PRAGMA journal_mode=DELETE")
            else:
                shutil.copyfile(source / relative, target)
        manifest = dict(version=1, model="MiniLM-L6-v2", dimension=384, translations=counts, files={relative: digest(stage / relative) for relative in lock["files"]})
        if "speech" in lock:
            manifest["speech"] = lock["speech"]
        (stage / "standard-package.json").write_text(json.dumps(manifest, indent=2) + "\n")
        validate(stage, manifest)
        if destination.exists():
            shutil.rmtree(destination)
        stage.rename(destination)
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=ROOT)
    parser.add_argument("--destination", type=Path, default=ROOT / "build-resources/standard")
    speech = parser.add_mutually_exclusive_group()
    speech.add_argument("--with-whisper-mac", action="store_true")
    speech.add_argument("--with-whisper-windows", action="store_true")
    args = parser.parse_args()
    lock = load_lock("mac" if args.with_whisper_mac else "windows" if args.with_whisper_windows else None)
    manifest = prepare(args.source, args.destination, lock)
    print(json.dumps({"destination": str(args.destination), "translations": manifest["translations"], "bytes": sum((args.destination / relative).stat().st_size for relative in manifest["files"])}))
