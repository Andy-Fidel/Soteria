"""Compare portable scalar and SSE3 speech kernels with identical generated audio."""
import json
import os
from pathlib import Path
import subprocess
import time
import shutil

root = Path(__file__).resolve().parents[1]
output = root / 'artifacts/speech-probe'
output.mkdir(parents=True, exist_ok=True)
audio = root / 'artifacts/speech.s16le'
manifest = output / 'manifest.json'
manifest.write_text(json.dumps({'sample_rate':16000,'channels':1,'clips':[{'label':'generated English scripture','path':str(audio),'source_start_s':0,'duration_s':audio.stat().st_size/32000}]}))
model = root / 'artifacts/windows-sources/models/whisper/ggml-base.en.bin'
reports = []
for profile, toolchain in [('sse3','windows-cpu-sse3.cmake'),('avx2','windows-cpu-avx2-probe.cmake')]:
    env = dict(os.environ, CMAKE_TOOLCHAIN_FILE=str(root/'scripts'/toolchain), CMAKE_POLICY_VERSION_MINIMUM='3.5', STATIC_VCRUNTIME='false')
    subprocess.run(['cargo','clean','--manifest-path','src-tauri/Cargo.toml','--release','--target','x86_64-pc-windows-msvc','-p','whisper-rs-sys'], env=env, check=True)
    subprocess.run(['cargo','build','--manifest-path','src-tauri/Cargo.toml','--release','--target','x86_64-pc-windows-msvc','-p','rhema-stt','--features','whisper','--example','whisper_benchmark','--locked'], env=env, check=True)
    exe = root/'src-tauri/target/x86_64-pc-windows-msvc/release/examples/whisper_benchmark.exe'
    # Save actual compiler flags, not just requested settings.
    for cache in (root/'src-tauri/target/x86_64-pc-windows-msvc/release/build').glob('whisper-rs-sys-*/out/build/CMakeCache.txt'):
        shutil.copyfile(cache, output/f'{profile}-CMakeCache.txt')
    for project in (root/'src-tauri/target/x86_64-pc-windows-msvc/release/build').glob('whisper-rs-sys-*/out/build/ggml/src/ggml.vcxproj'):
        shutil.copyfile(project, output/f'{profile}-ggml.vcxproj')
    for threads in (1, 2):
        started = time.perf_counter()
        with (output/f'{profile}-{threads}.log').open('wb') as log:
            try:
                result = subprocess.run([str(exe),str(model),str(manifest),'cpu',str(threads)], env=env, stdout=log, stderr=subprocess.STDOUT, timeout=60)
                status = result.returncode
            except subprocess.TimeoutExpired:
                status = 'timeout at 60 seconds'
        reports.append({'profile':profile,'threads':threads,'status':status,'wall_seconds':round(time.perf_counter()-started,3)})
        (output/'results.json').write_text(json.dumps(reports,indent=2)+'\n')
        print(json.dumps(reports[-1]),flush=True)
