"""Compare portable scalar and SSE3 speech kernels with identical generated audio."""
import json
import os
from pathlib import Path
import subprocess
import time

root = Path(__file__).resolve().parents[1]
output = root / 'artifacts/speech-probe'
output.mkdir(parents=True, exist_ok=True)
audio = root / 'artifacts/speech.s16le'
manifest = output / 'manifest.json'
manifest.write_text(json.dumps({'sample_rate':16000,'channels':1,'clips':[{'label':'generated English scripture','path':str(audio),'source_start_s':0,'duration_s':audio.stat().st_size/32000}]}))
model = root / 'artifacts/windows-sources/models/whisper/ggml-base.en.bin'
reports = []
for profile, toolchain in [('scalar','windows-cpu.cmake'),('sse3','windows-cpu-sse3.cmake')]:
    env = dict(os.environ, CMAKE_TOOLCHAIN_FILE=str(root/'scripts'/toolchain), CMAKE_POLICY_VERSION_MINIMUM='3.5', STATIC_VCRUNTIME='false')
    subprocess.run(['cargo','clean','--manifest-path','src-tauri/Cargo.toml','--release','--target','x86_64-pc-windows-msvc','-p','whisper-rs-sys'], env=env, check=True)
    subprocess.run(['cargo','build','--manifest-path','src-tauri/Cargo.toml','--release','--target','x86_64-pc-windows-msvc','-p','rhema-stt','--features','whisper','--example','whisper_benchmark','--locked'], env=env, check=True)
    exe = root/'src-tauri/target/x86_64-pc-windows-msvc/release/examples/whisper_benchmark.exe'
    started = time.perf_counter()
    with (output/f'{profile}.log').open('wb') as log:
        try:
            result = subprocess.run([str(exe),str(model),str(manifest),'cpu','4'], env=env, stdout=log, stderr=subprocess.STDOUT, timeout=120)
            status = result.returncode
        except subprocess.TimeoutExpired:
            status = 'timeout at 120 seconds'
    reports.append({'profile':profile,'status':status,'wall_seconds':round(time.perf_counter()-started,3)})
    (output/'results.json').write_text(json.dumps(reports,indent=2)+'\n')
    print(json.dumps(reports[-1]),flush=True)
