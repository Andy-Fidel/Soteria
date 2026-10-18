# Optional MiniLM fallback resources

`data/prepare-translation-indexes.py --family minilm` copies the local MiniLM
model, tokenizer, KJV vectors and IDs here after preparing NIV/NLT. The full
bundle includes this directory so the measured fallback works without a source
checkout. Binary resources stay outside Git. Missing files use the existing
legacy development paths; no model is downloaded automatically.
