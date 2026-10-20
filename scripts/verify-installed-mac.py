"""Install a new internal app from a DMG and verify its actual detection commands."""
import argparse
import importlib.util
import json
import plistlib
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("standard", Path(__file__).with_name("prepare-standard-package.py"))
standard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(standard)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dmg", type=Path)
    parser.add_argument("--install-dir", type=Path, default=ROOT / "artifacts/installed")
    parser.add_argument("--report", type=Path, default=ROOT / "artifacts/standard-mac-check.json")
    args = parser.parse_args()
    installed = args.install_dir.resolve() / "Manna Internal.app"
    if installed.exists():
        raise ValueError(f"Refusing to overwrite an existing installation: {installed}")
    args.install_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="manna-installed-check-") as temporary:
        mount = Path(temporary) / "volume"
        mount.mkdir()
        subprocess.run(["hdiutil", "attach", "-readonly", "-nobrowse", "-mountpoint", str(mount), str(args.dmg.resolve())], check=True, capture_output=True)
        try:
            subprocess.run(["ditto", str(mount / "Manna Internal.app"), str(installed)], check=True)
        finally:
            subprocess.run(["hdiutil", "detach", str(mount)], check=True, capture_output=True)
        subprocess.run(["codesign", "--verify", "--deep", "--strict", str(installed)], check=True, capture_output=True)
        resources = installed / "Contents/Resources"
        manifest = json.loads((resources / "standard-package.json").read_text())
        standard.validate(resources, manifest)
        with (installed / "Contents/Info.plist").open("rb") as stream:
            info = plistlib.load(stream)
        if info["CFBundleIdentifier"] != "com.manna.internal":
            raise ValueError("Unexpected application identity")
        executable = installed / "Contents/MacOS" / info["CFBundleExecutable"]
        process = subprocess.run([str(executable), "--verify-package"], cwd=temporary, text=True, capture_output=True, timeout=180)
        output = process.stdout + "\n" + process.stderr
        if process.returncode:
            raise RuntimeError(f"Installed application failed ({process.returncode}): {output[-6000:]}")
        line = next((line for line in process.stdout.splitlines() if line.startswith("MANNA_PACKAGE_CHECK=")), None)
        if not line:
            raise ValueError("Installed application did not return a verification report")
        report = json.loads(line.split("=", 1)[1])
        if report["resources"] != str(resources) or not report["passed"]:
            raise ValueError("Verification did not use the installed resources")
        for translation in ("NIV", "NLT"):
            count = manifest["translations"][translation]
            if f"Loaded {translation} semantic index ({count} vectors)" not in output:
                raise ValueError(f"Installed app did not load the {translation} semantic index")
        standard.validate(resources, manifest)
        if list(resources.rglob("*-wal")) or list(resources.rglob("*-shm")):
            raise ValueError("Application wrote SQLite journals into its resources")
        report.update(dmg=str(args.dmg.resolve()), dmg_sha256=standard.digest(args.dmg), installed=str(installed), ad_hoc_signature_verified=True, resources_unchanged=True, provider_calls=False)
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2) + "\n")
        print(json.dumps({"passed": True, "installed": str(installed), "report": str(args.report)}))


if __name__ == "__main__":
    main()
