"""Stage verified local detection resources. No downloads or model regeneration."""
import argparse
import hashlib
import json
import shutil
import sqlite3
import struct
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_lock(speech_platform=None, source=None):
    lock = json.loads((ROOT / "data/standard-package.lock.json").read_text())
    # The installer ships a read-only SQLite snapshot, whose header differs from
    # the original source DB. Accept only this independently pinned published hash.
    if source is not None:
        snapshot = json.loads((ROOT / "data/offline-bootstrap.lock.json").read_text())["database_snapshot_sha256"]
        database = Path(source) / "data/rhema.db"
        if database.is_file() and digest(database) == snapshot:
            lock["files"]["data/rhema.db"] = snapshot
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
    database_path = source / "data/rhema.db"
    if any(Path(str(database_path) + suffix).exists() for suffix in ("-wal", "-shm", "-journal")):
        raise ValueError("Bible resources must be a standalone database without journal sidecars")
    with database_path.open("rb") as stream:
        if stream.read(20)[18:20] != bytes((1, 1)):
            raise ValueError("The pinned Bible database must use DELETE journal mode before packaging")
    model = source / "models/fallback-minilm/model.onnx"
    tokenizer = source / "models/fallback-minilm/tokenizer.json"
    counts = {}
    database = sqlite3.connect(database_path.resolve().as_uri() + "?mode=ro&immutable=1", uri=True)
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
    previous = destination.with_name(destination.name + ".previous")
    if previous.exists():
        if destination.exists() or not (previous / "standard-package.json").is_file():
            raise ValueError(f"Previous resource backup needs review before setup can continue: {previous}")
        previous.rename(destination)
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
            # Validation requires a pinned, standalone DELETE-mode DB. Copy it
            # byte-for-byte: SQLite backup rewrites its header differently across hosts.
            shutil.copyfile(source / relative, target)
        manifest = dict(version=1, model="MiniLM-L6-v2", dimension=384, translations=counts, files={relative: digest(stage / relative) for relative in lock["files"]})
        if "speech" in lock:
            manifest["speech"] = lock["speech"]
        (stage / "standard-package.json").write_text(json.dumps(manifest, indent=2) + "\n")
        validate(stage, lock)
        if destination.exists():
            destination.rename(previous)
        try:
            stage.rename(destination)
        except OSError:
            if previous.exists():
                previous.rename(destination)
            raise
        if previous.exists():
            shutil.rmtree(previous)
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    existing = ROOT / "build-resources/standard"
    parser.add_argument("--source", type=Path, default=existing if (existing / "standard-package.json").is_file() else ROOT)
    parser.add_argument("--destination", type=Path, default=ROOT / "build-resources/standard")
    speech = parser.add_mutually_exclusive_group()
    speech.add_argument("--with-whisper-mac", action="store_true")
    speech.add_argument("--with-whisper-windows", action="store_true")
    args = parser.parse_args()
    speech_platform = "mac" if args.with_whisper_mac else "windows" if args.with_whisper_windows else None
    # Revalidating the staged offline pack must not silently drop its speech model.
    manifest_path = args.source / "standard-package.json"
    if speech_platform is None and manifest_path.is_file():
        speech_model = json.loads(manifest_path.read_text()).get("speech", {}).get("model")
        speech_platform = {"Small English Q8": "mac", "Base English": "windows"}.get(speech_model)
    lock = load_lock(speech_platform, args.source)
    manifest = prepare(args.source, args.destination, lock)
    print(json.dumps({"destination": str(args.destination), "translations": manifest["translations"], "bytes": sum((args.destination / relative).stat().st_size for relative in manifest["files"])}))
