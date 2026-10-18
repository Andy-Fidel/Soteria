# Optional translation search indexes

Run `.venv/bin/python data/prepare-translation-indexes.py --family minilm`
for the MiniLM development fallback, or `--family qwen3` for a full Qwen build.
NIV/NLT `.bin`, `-ids.bin`, and `.json` files are generated here and ignored by Git.
The full bundle includes this directory. Missing or incompatible indexes retain KJV search.
Never copy Qwen vectors into a MiniLM index or omit the generated provenance manifest.
