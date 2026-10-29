"""Exercise provisioning and failed downloads using isolated synthetic resource packs."""
import hashlib
import importlib.util
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import test_standard_package as fixtures

spec = importlib.util.spec_from_file_location("offline_setup", Path(__file__).with_name("setup-offline.py"))
offline = importlib.util.module_from_spec(spec)
spec.loader.exec_module(offline)


class OfflineSetupTests(unittest.TestCase):
    def setUp(self):
        fixtures.StandardPackageTests.setUp(self)
        speech = self.source / "models/whisper/test.bin"
        speech.parent.mkdir(parents=True)
        speech.write_bytes(b"verified speech")
        self.complete = {"files": {**self.lock["files"], "models/whisper/test.bin": offline.standard.digest(speech)}, "speech": {"model": "test", "language": "en"}}

    def locks(self, speech_platform=None, source=None):
        return self.complete if speech_platform else self.lock

    def test_complete_local_source_provisions_without_network(self):
        with patch.object(offline.standard, "load_lock", side_effect=self.locks), patch.object(offline.subprocess, "run") as network:
            result = offline.provision(self.source, self.destination, "mac")
        network.assert_not_called()
        self.assertEqual(result["speech"]["model"], "test")
        self.assertTrue((self.destination / "models/whisper/test.bin").is_file())

    def test_missing_speech_preserves_existing_pack_and_never_downloads_implicitly(self):
        offline.standard.prepare(self.source, self.destination, self.complete)
        before = (self.destination / "standard-package.json").read_bytes()
        (self.source / "models/whisper/test.bin").unlink()
        with patch.object(offline.standard, "load_lock", side_effect=self.locks), patch.object(offline.subprocess, "run") as network:
            with self.assertRaisesRegex(ValueError, "speech model"):
                offline.provision(self.source, self.destination, "mac")
        network.assert_not_called()
        self.assertEqual((self.destination / "standard-package.json").read_bytes(), before)

    def test_failed_download_does_not_replace_previous_cached_file(self):
        target = self.root / "cached.dmg"
        target.write_bytes(b"previous")
        with patch.object(offline.subprocess, "run", side_effect=subprocess.CalledProcessError(22, "curl")):
            with self.assertRaises(subprocess.CalledProcessError):
                offline.download_verified("https://example.invalid/resource", target, "0" * 64)
        self.assertEqual(target.read_bytes(), b"previous")
        self.assertEqual(list(self.root.glob("*.partial")), [])

    def test_corrupt_download_is_rejected_before_publication(self):
        target = self.root / "download.dmg"
        def write_corrupt(command, **_):
            Path(command[command.index("--output") + 1]).write_bytes(b"corrupt")
        with patch.object(offline.subprocess, "run", side_effect=write_corrupt):
            with self.assertRaisesRegex(ValueError, "SHA256"):
                offline.download_verified("https://example.invalid/resource", target, "0" * 64)
        self.assertFalse(target.exists())

    def test_failed_directory_publish_restores_the_previous_pack(self):
        standard = offline.standard
        standard.prepare(self.source, self.destination, self.complete)
        before = (self.destination / "standard-package.json").read_bytes()
        rename = Path.rename
        def fail_stage(path, target):
            if path.name == "pack":
                raise OSError("simulated disk failure")
            return rename(path, target)
        with patch.object(Path, "rename", fail_stage):
            with self.assertRaisesRegex(OSError, "disk failure"):
                standard.prepare(self.source, self.destination, self.complete)
        self.assertEqual((self.destination / "standard-package.json").read_bytes(), before)

    def test_interrupted_publish_recovers_backup_before_retry(self):
        standard = offline.standard
        standard.prepare(self.source, self.destination, self.complete)
        self.destination.rename(self.destination.with_name("output.previous"))
        standard.prepare(self.source, self.destination, self.complete)
        self.assertTrue((self.destination / "standard-package.json").is_file())

    def test_timed_out_download_resumes_partial_bytes_before_verifying(self):
        target = self.root / "resume.dmg"
        payload = b"complete verified resource"
        attempts = []
        def transfer(command, **_):
            partial = Path(command[command.index("--output") + 1])
            attempts.append(partial.read_bytes())
            if len(attempts) == 1:
                partial.write_bytes(payload[:7])
                raise subprocess.CalledProcessError(28, "curl")
            self.assertIn("--continue-at", command)
            with partial.open("ab") as stream:
                stream.write(payload[7:])
        with patch.object(offline.subprocess, "run", side_effect=transfer):
            offline.download_verified("https://example.invalid/resource", target, hashlib.sha256(payload).hexdigest(), len(payload))
        self.assertEqual(attempts, [b"", payload[:7]])
        self.assertEqual(target.read_bytes(), payload)

    def test_disconnected_setup_retains_partial_bytes_for_the_next_run(self):
        target = self.root / "retry.dmg"
        payload = b"verified resource for next run"
        checksum = hashlib.sha256(payload).hexdigest()
        def disconnect(command, **_):
            partial = Path(command[command.index("--output") + 1])
            if not partial.stat().st_size:
                partial.write_bytes(payload[:8])
            raise subprocess.CalledProcessError(28, "curl")
        with patch.object(offline.subprocess, "run", side_effect=disconnect):
            with self.assertRaises(subprocess.CalledProcessError):
                offline.download_verified("https://example.invalid/resource", target, checksum)
        self.assertFalse(target.exists())
        def resume(command, **_):
            partial = Path(command[command.index("--output") + 1])
            self.assertEqual(partial.read_bytes(), payload[:8])
            with partial.open("ab") as stream:
                stream.write(payload[8:])
        with patch.object(offline.subprocess, "run", side_effect=resume):
            offline.download_verified("https://example.invalid/resource", target, checksum)
        self.assertEqual(target.read_bytes(), payload)

    def test_repackaging_preserves_pinned_database_bytes(self):
        offline.standard.prepare(self.source, self.destination, self.complete)
        expected = self.complete["files"]["data/rhema.db"]
        self.assertEqual(offline.standard.digest(self.destination / "data/rhema.db"), expected)
        offline.standard.prepare(self.destination, self.destination, self.complete)
        self.assertEqual(offline.standard.digest(self.destination / "data/rhema.db"), expected)

    def test_journal_sidecars_cannot_change_the_pinned_bible(self):
        (self.source / "data/rhema.db-wal").write_bytes(b"unverified journal")
        with self.assertRaisesRegex(ValueError, "journal sidecars"):
            offline.standard.prepare(self.source, self.destination, self.complete)
        self.assertFalse(self.destination.exists())

    def test_copy_time_corruption_cannot_become_a_new_trusted_manifest(self):
        standard = offline.standard
        standard.prepare(self.source, self.destination, self.complete)
        before = (self.destination / "standard-package.json").read_bytes()
        copy = offline.shutil.copyfile
        def corrupt_copy(source, target):
            result = copy(source, target)
            if Path(target).name == "rhema.db":
                with fixtures.closing(fixtures.sqlite3.connect(target)) as database:
                    database.execute("PRAGMA user_version=123")
            return result
        with patch.object(offline.shutil, "copyfile", side_effect=corrupt_copy):
            with self.assertRaisesRegex(ValueError, "Missing or changed resource: data/rhema.db"):
                standard.prepare(self.source, self.destination, self.complete)
        self.assertEqual((self.destination / "standard-package.json").read_bytes(), before)
