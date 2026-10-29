"""Provision the pinned offline pack from a local resource folder or a verified Mac installer."""
import argparse
import importlib.util
import json
import os
import platform
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("standard_package", ROOT / "scripts/prepare-standard-package.py")
standard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(standard)


def download_verified(url, target, expected, size=None):
    """Interrupted or corrupt downloads never replace a cached valid artifact."""
    target = Path(target)
    if target.is_file() and standard.digest(target) == expected:
        return target
    target.parent.mkdir(parents=True, exist_ok=True)
    # Stable, hash-scoped partials survive a disconnected or cancelled setup.
    temporary = target.with_name(target.name + "." + expected[:16] + ".partial")
    download_lock = target.with_name(target.name + ".download.lock")
    try:
        descriptor = os.open(download_lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError as error:
        raise ValueError(f"Another download owns {download_lock}. Confirm it has stopped before removing a stale lock.") from error
    os.close(descriptor)
    try:
        temporary.touch(exist_ok=True)
        complete = temporary.stat().st_size > 0 and standard.digest(temporary) == expected
        if not complete:
            # Each retry recalculates the resume offset. Curl's implicit retries
            # can truncate a nearly complete large model after a timeout.
            for attempt in range(3):
                try:
                    subprocess.run(["curl", "--fail", "--location", "--proto", "=https", "--proto-redir", "=https",
                                    "--connect-timeout", "15", "--max-time", "1800", "--retry", "0",
                                    "--continue-at", "-", "--silent", "--show-error",
                                    "--output", str(temporary), url], check=True)
                    break
                except subprocess.CalledProcessError:
                    if attempt == 2:
                        raise
        if size is not None and temporary.stat().st_size != size:
            temporary.unlink()
            raise ValueError("Resource download has an unexpected size")
        if standard.digest(temporary) != expected:
            temporary.unlink()
            raise ValueError("Resource download failed SHA256 verification")
        temporary.replace(target)
    finally:
        if temporary.is_file() and temporary.stat().st_size == 0:
            temporary.unlink()
        download_lock.unlink(missing_ok=True)
    return target


def provision(source, destination, speech_platform, download_speech=False):
    """Only the repository's pinned file list is copied; app settings and sessions are excluded."""
    source, destination = Path(source).resolve(), Path(destination).resolve()
    detection = standard.load_lock(source=source)
    standard.validate(source, detection)
    lock = standard.load_lock(speech_platform, source=source)
    speech_file = next(path for path in lock["files"] if path.startswith("models/whisper/"))
    speech_path = source / speech_file
    if speech_path.is_file() and standard.digest(speech_path) == lock["files"][speech_file]:
        return standard.prepare(source, destination, lock)
    if not download_speech:
        raise ValueError(f"Missing or changed local speech model: {speech_file}. Supply a complete resource folder or use --download-speech while connected.")
    # Compose a complete candidate without modifying the supplied source folder.
    with tempfile.TemporaryDirectory(prefix="soteria-offline-") as temporary:
        candidate = Path(temporary)
        for relative in detection["files"]:
            target = candidate / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source / relative, target)
        speech = json.loads((ROOT / f"data/whisper-{speech_platform}.lock.json").read_text())
        url = f'https://huggingface.co/ggerganov/whisper.cpp/resolve/{speech["speech"]["source_revision"]}/{Path(speech_file).name}'
        cached = download_verified(url, destination.parent / "downloads" / Path(speech_file).name, lock["files"][speech_file])
        (candidate / speech_file).parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(cached, candidate / speech_file)
        return standard.prepare(candidate, destination, lock)


def bootstrap(destination, speech_platform, cache, download_speech=False):
    if platform.system() != "Darwin":
        raise ValueError("Automatic upstream bootstrap currently requires macOS. Use --source with a complete resource folder on Windows.")
    pinned = json.loads((ROOT / "data/offline-bootstrap.lock.json").read_text())["mac"]
    archive = download_verified(pinned["url"], cache / "upstream-offline-rc3.dmg", pinned["sha256"], pinned["bytes"])
    # Mount read-only and never execute the upstream app or its installer.
    with tempfile.TemporaryDirectory(prefix="soteria-resources-") as temporary:
        mount = Path(temporary) / "mount"
        mount.mkdir()
        subprocess.run(["hdiutil", "attach", "-readonly", "-nobrowse", "-mountpoint", str(mount), str(archive)], check=True)
        try:
            candidates = list(mount.glob("*.app/Contents/Resources"))
            if len(candidates) != 1:
                raise ValueError("Expected exactly one app resource directory in the pinned installer")
            return provision(candidates[0], destination, speech_platform, download_speech)
        finally:
            subprocess.run(["hdiutil", "detach", str(mount)], check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--source", type=Path, help="A complete verified resource directory; no network required")
    source.add_argument("--from-upstream", action="store_true", help="Download and verify the pinned upstream Mac resource artifact")
    parser.add_argument("--platform", choices=["mac", "windows"], default="windows" if platform.system() == "Windows" else "mac")
    parser.add_argument("--destination", type=Path, default=ROOT / "build-resources/standard")
    parser.add_argument("--cache", type=Path, default=ROOT / "build-resources/downloads")
    parser.add_argument("--download-speech", action="store_true", help="Explicitly permit downloading the pinned speech model if missing")
    args = parser.parse_args()
    # Refuse overlapping setup processes before any large download or replacement.
    args.destination.parent.mkdir(parents=True, exist_ok=True)
    lock_path = args.destination.parent / (args.destination.name + ".setup.lock")
    try:
        descriptor = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError:
        parser.exit(1, f"Offline setup is already locked: {lock_path}. If a previous process crashed, confirm it has stopped before removing this lock.\n")
    try:
        os.close(descriptor)
        if args.source:
            manifest = provision(args.source, args.destination, args.platform, args.download_speech)
        else:
            manifest = bootstrap(args.destination, args.platform, args.cache, args.download_speech)
        print(json.dumps({"destination": str(args.destination.resolve()), "speech": manifest["speech"], "translations": manifest["translations"]}, indent=2))
        print("Offline resources are ready. Restart the desktop app, then open Settings > Offline readiness.")
    finally:
        lock_path.unlink(missing_ok=True)


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        raise SystemExit(f"Offline setup failed: {error}") from error
