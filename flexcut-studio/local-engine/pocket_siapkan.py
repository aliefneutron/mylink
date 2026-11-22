# /// script
# requires-python = ">=3.10,<3.15"
# dependencies = [
#   "pocket-tts",
#   "huggingface_hub",
# ]
# ///
"""Unduh model Pocket TTS Indonesian (±0,5 GB) sekali saja ke cache Hugging Face.

Model: https://huggingface.co/tryzz889/pocket-tts-indonesian (CC-BY-4.0)
Dasar: kyutai/pocket-tts. Data latih: LEMAS Project.
"""
from huggingface_hub import snapshot_download

REPO = "anak10thn/pocket-tts-indonesian"
REV = "17257664e384561c957b02ac92edd1a24807f0e5"

print("• Mengunduh model Pocket TTS Indonesian (±0,5 GB)…", flush=True)
path = snapshot_download(REPO, revision=REV,
                         allow_patterns=["indonesian_6l.yaml", "6l/*", "tokenizer.model"])
print(f"• Model tersimpan di {path}", flush=True)
print("• Selesai. Model siap dipakai.", flush=True)
