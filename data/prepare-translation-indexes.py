#!/usr/bin/env python3
"""Build NIV/NLT indexes with the exact local ONNX model used at runtime.

Run from repo root: .venv/bin/python data/prepare-translation-indexes.py --family minilm
Uses local files only. Original Bible data is opened read-only.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import shutil
import time

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

ROOT = Path(__file__).resolve().parent.parent


def sha256(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--family', choices=['minilm', 'qwen3'], default='minilm')
    parser.add_argument('--translations', nargs='+', default=['NIV', 'NLT'])
    parser.add_argument('--force', action='store_true')
    args = parser.parse_args()
    if args.family == 'minilm':
        model = ROOT / 'models/all-MiniLM-L6-v2/onnx/model.onnx'
        tokenizer_path = ROOT / 'models/all-MiniLM-L6-v2/tokenizer.json'
        stem = 'kjv-minilm-l6-v2'
    else:
        model = ROOT / 'models/qwen3-embedding-0.6b-int8/model_quantized.onnx'
        if not model.exists():
            model = ROOT / 'models/qwen3-embedding-0.6b/model.onnx'
        tokenizer_path = ROOT / 'models/qwen3-embedding-0.6b/tokenizer.json'
        stem = 'kjv-qwen3-0.6b'
    identity = dict(version=1, model_sha256=sha256(model), tokenizer_sha256=sha256(tokenizer_path),
                    max_tokens=128, prefix='', pooling='sentence_embedding-or-mean')
    tokenizer = Tokenizer.from_file(str(tokenizer_path))
    pad_id = tokenizer.token_to_id('[PAD]') or 0
    tokenizer.enable_padding(pad_id=pad_id, pad_token=tokenizer.id_to_token(pad_id))
    tokenizer.enable_truncation(max_length=128)
    options = ort.SessionOptions()
    options.intra_op_num_threads = max(1, (os.cpu_count() or 4) // 2)
    options.inter_op_num_threads = 2
    session = ort.InferenceSession(str(model), options, providers=['CPUExecutionProvider'])
    inputs = {entry.name for entry in session.get_inputs()}
    outputs = {entry.name for entry in session.get_outputs()}
    output = next((name for name in ['sentence_embedding', 'last_hidden_state', 'token_embeddings'] if name in outputs), None)
    if output is None or not inputs.issubset({'input_ids', 'attention_mask', 'token_type_ids', 'position_ids'}):
        raise ValueError('Not a supported embedding graph')
    conn = sqlite3.connect(f'file:{ROOT / "data/rhema.db"}?mode=ro&immutable=1', uri=True)
    for abbreviation in args.translations:
        row = conn.execute('SELECT id FROM translations WHERE abbreviation=? AND language=?', (abbreviation, 'en')).fetchone()
        if not row:
            raise ValueError(f'Missing English translation {abbreviation}')
        records = conn.execute('SELECT id,text FROM verses WHERE translation_id=? ORDER BY id', row).fetchall()
        if not records:
            raise ValueError(f'No verses for {abbreviation}')
        directory = ROOT / 'embeddings/translation-indexes'
        directory.mkdir(parents=True, exist_ok=True)
        base = directory / f'{stem}-{abbreviation.lower()}'
        emb_path, ids_path, meta_path = Path(str(base)+'.bin'), Path(str(base)+'-ids.bin'), Path(str(base)+'.json')
        expected = dict(identity, translation=abbreviation)
        if not args.force and meta_path.exists() and emb_path.exists() and ids_path.exists():
            metadata = json.loads(meta_path.read_text())
            if all(metadata.get(key) == value for key, value in expected.items()) and metadata.get('vectors_sha256') == sha256(emb_path) and metadata.get('ids_sha256') == sha256(ids_path):
                print(f'{abbreviation}: verified existing index', flush=True)
                continue
        started = time.perf_counter()
        vectors = []
        for start in range(0, len(records), 32):
            batch = tokenizer.encode_batch([text for _, text in records[start:start+32]])
            ids = np.array([entry.ids for entry in batch], dtype=np.int64)
            mask = np.array([entry.attention_mask for entry in batch], dtype=np.int64)
            feeds = {'input_ids': ids, 'attention_mask': mask}
            if 'token_type_ids' in inputs:
                feeds['token_type_ids'] = np.array([entry.type_ids for entry in batch], dtype=np.int64)
            if 'position_ids' in inputs:
                feeds['position_ids'] = np.broadcast_to(np.arange(ids.shape[1], dtype=np.int64), ids.shape).copy()
            result = session.run([output], feeds)[0].astype(np.float32)
            if result.ndim == 3:
                expanded = mask[:, :, None].astype(np.float32)
                result = (result * expanded).sum(axis=1) / expanded.sum(axis=1).clip(min=1)
            result /= np.linalg.norm(result, axis=1, keepdims=True).clip(min=1e-12)
            if not np.isfinite(result).all():
                raise ValueError('Non-finite model output')
            vectors.append(result)
            if start % 3200 == 0:
                print(f'{abbreviation}: {start}/{len(records)} verses', flush=True)
        matrix = np.concatenate(vectors)
        # Publish metadata last: interrupted writes are never accepted by the app.
        matrix.astype('<f4').tofile(str(emb_path)+'.tmp')
        np.array([vid for vid, _ in records], dtype='<i8').tofile(str(ids_path)+'.tmp')
        os.replace(str(emb_path)+'.tmp', emb_path)
        os.replace(str(ids_path)+'.tmp', ids_path)
        metadata = dict(expected, dimension=matrix.shape[1], count=len(records), vectors_sha256=sha256(emb_path), ids_sha256=sha256(ids_path))
        Path(str(meta_path)+'.tmp').write_text(json.dumps(metadata, indent=2)+'\n')
        os.replace(str(meta_path)+'.tmp', meta_path)
        print(f'{abbreviation}: complete in {time.perf_counter()-started:.1f}s', flush=True)
    conn.close()
    if args.family == 'minilm':
        fallback = ROOT / 'models/fallback-minilm'
        fallback.mkdir(parents=True, exist_ok=True)
        for source, filename in [(model, 'model.onnx'), (tokenizer_path, 'tokenizer.json'),
                                 (ROOT / f'embeddings/{stem}.bin', f'{stem}.bin'),
                                 (ROOT / f'embeddings/{stem}-ids.bin', f'{stem}-ids.bin')]:
            target = fallback / filename
            if not target.exists() or sha256(source) != sha256(target):
                temporary = Path(str(target)+'.tmp')
                shutil.copyfile(source, temporary)
                os.replace(temporary, target)
        print('MiniLM fallback bundle resources ready', flush=True)


if __name__ == '__main__':
    main()
