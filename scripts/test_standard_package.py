"""Offline packaging tests use tiny synthetic resources, never private app data."""
import importlib.util
import json
import sqlite3
import struct
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("standard", Path(__file__).with_name("prepare-standard-package.py"))
standard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(standard)


class StandardPackageTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.source, self.destination = self.root / "source", self.root / "output"
        database = self.source / "data/rhema.db"
        database.parent.mkdir(parents=True)
        with sqlite3.connect(database) as connection:
            connection.executescript("CREATE TABLE translations(id INTEGER, abbreviation TEXT); CREATE TABLE verses(id INTEGER, translation_id INTEGER);")
            for number, name in enumerate(("KJV", "NIV", "NLT"), 1):
                connection.execute("INSERT INTO translations VALUES (?,?)", (number, name))
                connection.execute("INSERT INTO verses VALUES (?,?)", (number * 10, number))
        model = self.source / "models/fallback-minilm/model.onnx"
        model.parent.mkdir(parents=True)
        model.write_bytes(b"synthetic model")
        tokenizer = model.with_name("tokenizer.json")
        tokenizer.write_text("{}")
        for number, translation in enumerate(("KJV", "NIV", "NLT"), 1):
            relative = "models/fallback-minilm/kjv-minilm-l6-v2" if translation == "KJV" else f"embeddings/translation-indexes/kjv-minilm-l6-v2-{translation.lower()}"
            base = self.source / relative
            base.parent.mkdir(parents=True, exist_ok=True)
            vectors, ids = Path(str(base) + ".bin"), Path(str(base) + "-ids.bin")
            vectors.write_bytes(struct.pack("<384f", *([0.25] * 384)))
            ids.write_bytes(struct.pack("<q", number * 10))
            if translation != "KJV":
                Path(str(base) + ".json").write_text(json.dumps(dict(version=1, translation=translation, dimension=384, count=1, max_tokens=128, prefix="", pooling="sentence_embedding-or-mean", model_sha256=standard.digest(model), tokenizer_sha256=standard.digest(tokenizer), vectors_sha256=standard.digest(vectors), ids_sha256=standard.digest(ids))))
        self.lock = dict(files={str(p.relative_to(self.source)): standard.digest(p) for p in self.source.rglob("*") if p.is_file()})

    def test_snapshot_keeps_ids_and_validates_after_source_is_removed(self):
        manifest = standard.prepare(self.source, self.destination, self.lock)
        self.source.rename(self.root / "hidden-source")
        self.assertEqual(standard.validate(self.destination, manifest), {"KJV": 1, "NIV": 1, "NLT": 1})
        with sqlite3.connect(self.destination / "data/rhema.db") as database:
            self.assertEqual(database.execute("PRAGMA journal_mode").fetchone()[0], "delete")
        self.assertFalse(list(self.destination.rglob("*-wal")))

    def test_changed_model_is_rejected_before_replacing_existing_pack(self):
        standard.prepare(self.source, self.destination, self.lock)
        before = (self.destination / "standard-package.json").read_bytes()
        (self.source / "models/fallback-minilm/model.onnx").write_bytes(b"changed")
        with self.assertRaisesRegex(ValueError, "Missing or changed"):
            standard.prepare(self.source, self.destination, self.lock)
        self.assertEqual((self.destination / "standard-package.json").read_bytes(), before)

    def test_wrong_translation_ids_are_rejected_even_with_updated_checksum(self):
        ids = self.source / "models/fallback-minilm/kjv-minilm-l6-v2-ids.bin"
        ids.write_bytes(struct.pack("<q", 20))
        self.lock["files"][str(ids.relative_to(self.source))] = standard.digest(ids)
        with self.assertRaisesRegex(ValueError, "KJV IDs"):
            standard.validate(self.source, self.lock)

    def test_truncated_vectors_are_rejected(self):
        vectors = self.source / "models/fallback-minilm/kjv-minilm-l6-v2.bin"
        vectors.write_bytes(b"partial")
        self.lock["files"][str(vectors.relative_to(self.source))] = standard.digest(vectors)
        with self.assertRaisesRegex(ValueError, "vector/ID lengths"):
            standard.validate(self.source, self.lock)

    def test_unrecognized_destination_is_preserved(self):
        self.destination.mkdir()
        (self.destination / "important.txt").write_text("keep")
        with self.assertRaisesRegex(ValueError, "unrecognized directory"):
            standard.prepare(self.source, self.destination, self.lock)
        self.assertEqual((self.destination / "important.txt").read_text(), "keep")

    def test_wrong_model_provenance_is_rejected_even_with_updated_file_checksum(self):
        metadata = self.source / "embeddings/translation-indexes/kjv-minilm-l6-v2-niv.json"
        value = json.loads(metadata.read_text())
        value["model_sha256"] = "different-model"
        metadata.write_text(json.dumps(value))
        self.lock["files"][str(metadata.relative_to(self.source))] = standard.digest(metadata)
        with self.assertRaisesRegex(ValueError, "NIV provenance mismatch"):
            standard.validate(self.source, self.lock)

    def test_optional_speech_pack_keeps_its_model_and_metadata(self):
        relative = "models/whisper/ggml-small.en-q8_0.bin"
        model = self.source / relative
        model.parent.mkdir(parents=True)
        model.write_bytes(b"synthetic speech model")
        self.lock["files"][relative] = standard.digest(model)
        self.lock["speech"] = {"model": "Small English Q8", "language": "en"}
        manifest = standard.prepare(self.source, self.destination, self.lock)
        self.assertEqual(manifest["speech"], self.lock["speech"])
        self.assertEqual((self.destination / relative).read_bytes(), model.read_bytes())

    def test_changed_speech_model_cannot_replace_a_valid_pack(self):
        relative = "models/whisper/ggml-small.en-q8_0.bin"
        model = self.source / relative
        model.parent.mkdir(parents=True)
        model.write_bytes(b"synthetic speech model")
        self.lock["files"][relative] = standard.digest(model)
        standard.prepare(self.source, self.destination, self.lock)
        previous = (self.destination / "standard-package.json").read_bytes()
        model.write_bytes(b"corrupt speech model")
        with self.assertRaisesRegex(ValueError, "Missing or changed resource"):
            standard.prepare(self.source, self.destination, self.lock)
        self.assertEqual((self.destination / "standard-package.json").read_bytes(), previous)


if __name__ == "__main__":
    unittest.main()
