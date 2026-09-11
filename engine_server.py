"""JW EDS Local Voice Engine v1.5

Local-only FastAPI server for zero-shot voice cloning with Resemble AI Chatterbox.
The browser sends a reference WAV + text; the server returns generated WAV audio.
No provider API key or subscription is required after the model weights are downloaded.
"""
from __future__ import annotations

import importlib.util
import os
import tempfile
import threading
from pathlib import Path
from typing import Dict, Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles

ROOT = Path(__file__).resolve().parent
app = FastAPI(title="JW EDS Local Voice Engine", version="1.5")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

_MODEL_LOCK = threading.Lock()
_MODELS: Dict[str, Any] = {}


def chatterbox_installed() -> bool:
    return importlib.util.find_spec("chatterbox") is not None


def best_device() -> str:
    try:
        import torch
        if torch.cuda.is_available():
            return "cuda"
        if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
            return "mps"
    except Exception:
        pass
    return "cpu"


def get_model(kind: str):
    kind = "turbo" if kind == "turbo" else "nano"
    if kind in _MODELS:
        return _MODELS[kind]
    if not chatterbox_installed():
        raise RuntimeError("Chatterbox is not installed. Run SETUP_ENGINE first.")

    from chatterbox.tts_turbo import ChatterboxTurboTTS

    device = best_device()
    # Nano is the same Turbo architecture selected with nano=True.
    if kind == "nano":
        model = ChatterboxTurboTTS.from_pretrained(device=device, nano=True)
    else:
        model = ChatterboxTurboTTS.from_pretrained(device=device)
    _MODELS[kind] = model
    return model


@app.get("/health")
def health():
    return {
        "ok": True,
        "engine": "JW EDS Local Voice Engine",
        "version": "1.5",
        "chatterbox_installed": chatterbox_installed(),
        "device": best_device(),
        "models_loaded": sorted(_MODELS.keys()),
    }


def _generate(audio_bytes: bytes, text: str, model_kind: str) -> bytes:
    text = (text or "").strip()
    if not text:
        raise ValueError("Text is empty.")
    if len(text) > 2500:
        raise ValueError("Text is longer than the 2500 character limit.")
    if not audio_bytes:
        raise ValueError("Reference audio is empty.")

    ref_path = None
    out_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as ref:
            ref.write(audio_bytes)
            ref_path = ref.name
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as out:
            out_path = out.name

        with _MODEL_LOCK:
            model = get_model(model_kind)
            wav = model.generate(text, audio_prompt_path=ref_path)
            import torchaudio as ta
            ta.save(out_path, wav, model.sr)

        return Path(out_path).read_bytes()
    finally:
        for p in (ref_path, out_path):
            if p:
                try:
                    Path(p).unlink(missing_ok=True)
                except Exception:
                    pass


@app.post("/synthesize")
async def synthesize(
    audio: UploadFile = File(...),
    text: str = Form(...),
    model: str = Form("nano"),
):
    if model not in {"nano", "turbo"}:
        raise HTTPException(status_code=400, detail="Model must be nano or turbo.")
    audio_bytes = await audio.read()
    if len(audio_bytes) > 100 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Reference audio exceeds 100 MB.")
    try:
        result = _generate(audio_bytes, text, model)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return Response(
        content=result,
        media_type="audio/wav",
        headers={"Content-Disposition": "attachment; filename=jweds-cloned-speech.wav"},
    )


# Compatibility endpoint retained for older JW EDS frontends.
@app.post("/clone/preview")
async def clone_preview(
    audio: UploadFile = File(...),
    text: str = Form(...),
    model: str = Form("nano"),
):
    return await synthesize(audio=audio, text=text, model=model)


# Mount the PWA last so API routes above take precedence.
app.mount("/", StaticFiles(directory=str(ROOT), html=True), name="pwa")


if __name__ == "__main__":
    import uvicorn
    host = os.environ.get("JWEDS_HOST", "127.0.0.1")
    port = int(os.environ.get("JWEDS_PORT", "8765"))
    print(f"JW EDS Audio Engine: http://{host}:{port}")
    print("First voice generation may download/load the selected Chatterbox model.")
    uvicorn.run(app, host=host, port=port, log_level="info")
