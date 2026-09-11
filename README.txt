JW EDS Audio Engine v1.7

Changes:
- MP3 upload hardened for iPad Files providers by normalising MIME types from the filename.
- My Libraries now includes saved cloned voice profiles.
- Saved voice packs open with audio preview and a Use this voice action.
- Phrase libraries open into a detail view; Robbo reveals the bundled phrase list.

JW EDS AUDIO ENGINE v1.6 — iPAD ON-DEVICE VOICE CLONE
=====================================================

THIS VERSION FIXES THE iPAD ISSUE
--------------------------------
v1.5 expected a Python voice server at 127.0.0.1:8765. On an iPad that address
points back to the iPad itself, so the neural engine could never be connected.

v1.6 makes the default clone engine browser-native. It runs Pocket TTS ONNX
directly inside Safari in a Web Worker. No Python server, API key, Gemini,
ElevenLabs or subscription is required for the on-device path.

HOW TO USE ON iPAD
------------------
1. Host these flat PWA files over HTTPS and open the site in current Safari.
2. Clone Voice -> record or upload a clean sample (roughly 3–10 seconds works well).
3. Tick the permission box and Save voice profile.
4. Under Generate speech with a saved clone, select the saved voice.
5. Leave Generation engine on “This iPad / browser”.
6. Tap Prepare iPad voice engine. The first setup downloads about 150 MB.
7. Enter any English text and tap Generate speech.
8. Play the result or Download WAV.

FIRST RUN / OFFLINE
-------------------
The first run needs internet access because the quantized ONNX model and ONNX
Runtime are downloaded from their public hosts. The model assets are stored in
Safari Cache Storage. Later runs can use the cached model without a paid API;
Safari may still evict cached assets if the device is low on storage.

TECHNICAL ENGINE
----------------
- Pocket TTS English 2026-04
- INT8 ONNX models
- Browser Web Worker inference
- WebAssembly execution (Safari compatible; no WebGPU dependency)
- Approx. model download with voice cloning: ~150 MB
- Raw voice samples remain in JW EDS IndexedDB on the device
- Generated output is WAV

COMPANION COMPUTER (OPTIONAL)
-----------------------------
The old Chatterbox/Python companion scripts remain in the package as an
advanced alternative. They are NOT required on iPad. If used, choose
“Companion computer” and use the computer's LAN address, not 127.0.0.1.

VOICE SAFETY
------------
Only clone your own voice or a voice you have explicit permission to use.

FLAT PACKAGE
------------
Every file in this ZIP is at the archive root. There are no folders inside.
