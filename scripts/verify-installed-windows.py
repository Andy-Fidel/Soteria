"""Verify an internal Windows NSIS installation without microphone or paid calls."""
import argparse
import ctypes
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time

spec = importlib.util.spec_from_file_location("standard", Path(__file__).with_name("prepare-standard-package.py"))
standard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(standard)


def signature(path):
    # Pass the path through the environment, never through PowerShell source text.
    env = dict(os.environ, MANNA_SIGNATURE_PATH=str(path))
    code = "$s=Get-AuthenticodeSignature -LiteralPath $env:MANNA_SIGNATURE_PATH; @{status=[string]$s.Status;subject=[string]$s.SignerCertificate.Subject}|ConvertTo-Json -Compress"
    return json.loads(subprocess.run(["powershell.exe", "-NoProfile", "-Command", code], env=env, check=True, capture_output=True, text=True).stdout)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("installer", type=Path)
    parser.add_argument("--speech-audio", required=True, type=Path)
    parser.add_argument("--install-dir", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--require-publisher", help="Expected certificate subject text; also requires a valid signature")
    args = parser.parse_args()
    if sys.platform != "win32":
        raise RuntimeError("Run the Windows installer check on Windows.")
    installed = args.install_dir.resolve()
    if installed.exists():
        raise ValueError("Refusing to overwrite an existing installation")
    installer = args.installer.resolve()
    install_signature = signature(installer)
    if args.require_publisher and (install_signature["status"] != "Valid" or args.require_publisher not in install_signature["subject"]):
        raise ValueError("Installer publisher signature is not valid")
    subprocess.run([str(installer), "/S", f"/D={installed}"], check=True, timeout=180)
    executable = installed / "app.exe"
    if not executable.is_file():
        raise ValueError("NSIS did not install app.exe")
    app_signature = signature(executable)
    if args.require_publisher and (app_signature["status"] != "Valid" or args.require_publisher not in app_signature["subject"]):
        raise ValueError("Application publisher signature is not valid")
    manifest = json.loads((installed / "standard-package.json").read_text())
    if manifest["speech"]["model"] != "Base English":
        raise ValueError("Windows package must include Base English")
    standard.validate(installed, manifest)
    for name in ("vcruntime140.dll", "msvcp140.dll"):
        if not (installed / name).is_file():
            raise ValueError(f"Missing app-local Microsoft runtime: {name}")
    # Exclude checkout, build tools and third-party PATH entries during execution.
    environment = dict(os.environ, PATH=os.pathsep.join((str(installed), str(Path(os.environ["SystemRoot"]) / "System32"), os.environ["SystemRoot"])))
    started = time.perf_counter()
    with tempfile.TemporaryDirectory(prefix="manna-verify-") as temporary:
        process = subprocess.run([str(executable), "--verify-package", "--verify-whisper-audio", str(args.speech_audio.resolve())], cwd=temporary, env=environment, capture_output=True, text=True, encoding="utf-8", timeout=180)
    if process.returncode:
        raise RuntimeError(f"Installed app failed ({process.returncode}): {(process.stdout + process.stderr)[-8000:]}")
    line = next((line for line in process.stdout.splitlines() if line.startswith("MANNA_PACKAGE_CHECK=")), None)
    if not line:
        raise ValueError("Installed app did not return a verification report")
    report = json.loads(line.split("=", 1)[1])
    if not report["passed"] or report["default_speech_provider"] != "whisper" or not report["speech"]["transcript"]:
        raise ValueError("Installed offline speech and detection check failed")
    if Path(report["resources"]).resolve() != installed:
        raise ValueError("Check did not use installed resources")
    standard.validate(installed, manifest)
    if list(installed.rglob("*-wal")) or list(installed.rglob("*-shm")):
        raise ValueError("App wrote SQLite journals into resources")
    ndi = ctypes.WinDLL(str(installed / "sdk/ndi/windows/Processing.NDI.Lib.x64.dll"))
    ndi.NDIlib_version.restype = ctypes.c_char_p
    ndi_version = ndi.NDIlib_version().decode()
    report.update(installer=str(installer), installer_sha256=standard.digest(installer), installer_bytes=installer.stat().st_size,
                  install_signature=install_signature, app_signature=app_signature, publisher_verified=bool(args.require_publisher),
                  installed=str(installed), resources_unchanged=True, provider_calls=False, ndi_version=ndi_version,
                  process_wall_seconds=round(time.perf_counter()-started, 3), restricted_path=True)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2)+"\n")
    print(json.dumps({"passed":True,"publisher_verified":bool(args.require_publisher),"report":str(args.report)}))


if __name__ == "__main__":
    main()
