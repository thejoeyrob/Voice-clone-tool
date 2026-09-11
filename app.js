'use strict';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const state = {
  libraries: JSON.parse(localStorage.getItem('jweds-libraries') || 'null') || [
    { name: "Robbo's Trakway Trivia", type: 'Generated', voice: 'Robbo (Gemini)', phrases: 94, status: 'Ready' },
    { name: 'Site Induction Pack', type: 'Generated', voice: 'Joe (Clone)', phrases: 38, status: 'Ready' }
  ],
  settings: JSON.parse(localStorage.getItem('jweds-settings') || '{}'),
  referenceFile: null,
  referenceBlob: null,
  referenceUrl: null,
  generatedBlob: null,
  generatedUrl: null,
  libraryDetailUrl: null,
  db: null
};

function show(id) {
  $$('.view').forEach(v => v.classList.toggle('active', v.id === id));
  $$('#nav button').forEach(b => b.classList.toggle('active', b.dataset.view === id));
  if (id === 'libraries') renderLibraryHub().catch(err => console.warn('Library refresh failed', err));
  window.scrollTo(0, 0);
}

$$('#nav button').forEach(b => b.onclick = () => show(b.dataset.view));
$$('[data-jump]').forEach(b => b.onclick = () => show(b.dataset.jump));

function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
}

function renderRecentLibraries() {
  const rows = state.libraries.map((x, index) => `<tr>
    <td><b>${escapeHtml(x.name)}</b></td>
    <td>${escapeHtml(x.type)}</td>
    <td>${escapeHtml(x.voice)}</td>
    <td>${x.phrases}</td>
    <td><span class="badge">● ${escapeHtml(x.status)}</span></td>
    <td><button class="miniOpen" data-recent-open="${index}">Open</button></td>
  </tr>`).join('');
  const html = `<table class="table"><thead><tr><th>Name</th><th>Type</th><th>Voice</th><th>Phrases</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
  $('#recentTable').innerHTML = html;
  $$('[data-recent-open]').forEach(btn => btn.onclick = () => {
    show('libraries');
    setTimeout(() => openPhraseLibrary(Number(btn.dataset.recentOpen)), 0);
  });
}
renderRecentLibraries();

async function renderLibraryHub() {
  const profiles = state.db ? (await dbAll()).sort((a,b) => b.created - a.created) : [];
  const voiceCards = profiles.length ? profiles.map(p => `<article class="libraryCard voicePack">
    <div class="libraryIcon">◉</div>
    <div class="libraryCardMain"><span class="libraryType">SAVED CLONED VOICE</span><h3>${escapeHtml(p.name)}</h3>
      <p>${escapeHtml(p.fileName || 'Reference audio')} · ${formatBytes(p.size || p.blob?.size || 0)}${p.duration ? ` · ${formatTime(p.duration)}` : ''}</p>
    </div>
    <button class="primary" data-open-profile="${p.id}">Open</button>
  </article>`).join('') : '<div class="emptyLibrary">No cloned voices saved yet. Create one under <b>Clone Voice</b>.</div>';

  const phraseCards = state.libraries.map((x, index) => `<article class="libraryCard phrasePack">
    <div class="libraryIcon">▣</div>
    <div class="libraryCardMain"><span class="libraryType">PHRASE LIBRARY</span><h3>${escapeHtml(x.name)}</h3>
      <p>${escapeHtml(x.voice)} · ${Number(x.phrases)||0} phrases · ${escapeHtml(x.status)}</p>
    </div>
    <button data-open-library="${index}">Open</button>
  </article>`).join('');

  $('#libraryList').innerHTML = `<div class="librarySection"><div class="librarySectionHead"><h2>Saved Voice Packs</h2><span>${profiles.length}</span></div><div class="libraryHubGrid">${voiceCards}</div></div>
    <div class="librarySection"><div class="librarySectionHead"><h2>Phrase Libraries</h2><span>${state.libraries.length}</span></div><div class="libraryHubGrid">${phraseCards}</div></div>`;

  $$('[data-open-profile]').forEach(btn => btn.onclick = () => openVoicePack(btn.dataset.openProfile));
  $$('[data-open-library]').forEach(btn => btn.onclick = () => openPhraseLibrary(Number(btn.dataset.openLibrary)));
}

function closeLibraryDetail() {
  if (state.libraryDetailUrl) URL.revokeObjectURL(state.libraryDetailUrl);
  state.libraryDetailUrl = null;
  $('#libraryDetail').classList.add('hidden');
  $('#libraryDetailBody').innerHTML = '';
}

async function openVoicePack(id) {
  const p = (await dbAll()).find(x => x.id === id);
  if (!p) return alert('That saved voice pack could not be found on this device.');
  closeLibraryDetail();
  state.libraryDetailUrl = URL.createObjectURL(p.blob);
  $('#libraryDetailTitle').textContent = p.name;
  $('#libraryDetailBody').innerHTML = `<div class="libraryDetailGrid">
    <div><span class="libraryType">CLONED VOICE PACK</span><h3>${escapeHtml(p.name)}</h3>
      <p class="muted">${escapeHtml(p.fileName || 'Reference audio')} · ${formatBytes(p.size || p.blob.size)}${p.duration ? ` · ${formatTime(p.duration)}` : ''}</p>
      <audio controls preload="metadata" src="${state.libraryDetailUrl}"></audio>
    </div>
    <div class="libraryActions"><button class="primary" id="useOpenedVoice">Use this voice</button><button id="playOpenedVoice">Play reference</button></div>
  </div>`;
  $('#libraryDetail').classList.remove('hidden');
  $('#playOpenedVoice').onclick = () => playBlob(p.blob);
  $('#useOpenedVoice').onclick = () => {
    $('#synthVoice').value = p.id;
    $('#profileName').value = p.name;
    loadBlob(p.blob, p.fileName, p.type, p.duration);
    show('clone');
    $('#synthStatus').className = 'statusline good';
    $('#synthStatus').textContent = `“${p.name}” is selected. Type the words you want it to say, then press Generate speech.`;
    setTimeout(() => $('#synthText').focus(), 150);
  };
}

async function openPhraseLibrary(index) {
  const x = state.libraries[index];
  if (!x) return;
  closeLibraryDetail();
  $('#libraryDetailTitle').textContent = x.name;
  let phraseHtml = '';
  if (/robbo/i.test(x.name)) {
    try {
      const d = await fetch('robbos-trakway-trivia.json').then(r => r.json());
      const phrases = Array.isArray(d) ? d : (d.phrases || []);
      phraseHtml = `<div class="phraseScroller">${phrases.map((p,i) => `<div><b>${i+1}.</b> ${escapeHtml(typeof p === 'string' ? p : (p.text || p.phrase || JSON.stringify(p)))}</div>`).join('')}</div>`;
    } catch (_) {
      phraseHtml = '<p class="muted">The bundled phrase list could not be loaded.</p>';
    }
  } else {
    phraseHtml = '<p class="muted">This library record is present, but no individual audio assets have been stored in this browser yet.</p>';
  }
  $('#libraryDetailBody').innerHTML = `<div class="libraryDetailGrid"><div><span class="libraryType">PHRASE LIBRARY</span><h3>${escapeHtml(x.name)}</h3><p>${escapeHtml(x.voice)} · ${Number(x.phrases)||0} phrases · ${escapeHtml(x.status)}</p></div>
    <div class="libraryActions"><button class="primary" id="reusePhraseLibrary">Open in Create Library</button></div></div>${phraseHtml}`;
  $('#libraryDetail').classList.remove('hidden');
  $('#reusePhraseLibrary').onclick = () => {
    show('create');
    $('#libraryName').value = x.name;
    if (/robbo/i.test(x.name)) $('#loadRobbo').click();
  };
}


$('#loadRobbo').onclick = async () => {
  const d = await fetch('robbos-trakway-trivia.json').then(r => r.json());
  $('#libraryName').value = "Robbo's Trakway Trivia";
  $('#gender').value = 'Male';
  $('#age').value = '40s';
  $('#accent').value = 'Chesterfield / Mansfield / Worksop, East Midlands';
  $('#mood').value = 'Energetic game-show host, dry site banter, warm, confident, mischievous';
  $('#description').value = `Use the bundled Robbo's Trakway Trivia phrase library (${Array.isArray(d) ? d.length : (d.phrases?.length || 94)} phrases). Keep each phrase as an individual audio asset.`;
};
$('#robboTile').onclick = () => { show('create'); $('#loadRobbo').click(); };

$('#createForm').onsubmit = (e) => {
  e.preventDefault();
  $('#planOutput').classList.remove('hidden');
  $('#planOutput').innerHTML = `<h2>Phrase plan ready</h2>
    <p><b>${escapeHtml($('#libraryName').value)}</b></p>
    <p>Voice: ${escapeHtml($('#gender').value)}, ${escapeHtml($('#age').value)}, ${escapeHtml($('#accent').value || 'accent not specified')}; ${escapeHtml($('#mood').value || 'neutral delivery')}.</p>
    <p>The next stage is an audition before batch rendering.</p>
    <button class="primary" id="goClone">Continue to voice source</button>`;
  $('#goClone').onclick = () => show($('#voiceSource').value === 'clone' || $('#voiceSource').value === 'saved' ? 'clone' : 'designer');
};

// -------------------- IndexedDB voice profiles --------------------
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('jweds-audio-engine', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('voiceProfiles')) db.createObjectStore('voiceProfiles', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function initDB() {
  try {
    state.db = await openDB();
    await renderProfiles();
  } catch (e) {
    console.warn('IndexedDB unavailable', e);
    $('#synthStatus').className = 'statusline bad';
    $('#synthStatus').textContent = 'This browser could not open local voice storage.';
  }
}

function dbAll() {
  return new Promise((resolve, reject) => {
    if (!state.db) return resolve([]);
    const tx = state.db.transaction('voiceProfiles', 'readonly');
    const req = tx.objectStore('voiceProfiles').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function dbPut(value) {
  return new Promise((resolve, reject) => {
    const tx = state.db.transaction('voiceProfiles', 'readwrite');
    tx.objectStore('voiceProfiles').put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function dbDelete(id) {
  return new Promise((resolve, reject) => {
    const tx = state.db.transaction('voiceProfiles', 'readwrite');
    tx.objectStore('voiceProfiles').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function renderProfiles(preferredId = '') {
  const rows = (await dbAll()).sort((a, b) => b.created - a.created);
  $('#profileList').innerHTML = rows.length ? rows.map(p => `<div class="profileItem">
    <div><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.fileName)} · ${formatBytes(p.size)}${p.duration ? ` · ${formatTime(p.duration)}` : ''}</small></div>
    <div><button data-play="${p.id}">Play</button> <button data-use="${p.id}">Use</button> <button data-delete="${p.id}">Delete</button></div>
  </div>`).join('') : '<span class="muted">No saved profiles yet.</span>';

  const select = $('#synthVoice');
  const previous = preferredId || select.value;
  select.innerHTML = rows.length
    ? rows.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')
    : '<option value="">No saved voices yet</option>';
  if (rows.some(p => p.id === previous)) select.value = previous;
  if ($('#libraries')?.classList.contains('active')) renderLibraryHub().catch(() => {});

  $$('[data-play]').forEach(b => b.onclick = async () => {
    const p = (await dbAll()).find(x => x.id === b.dataset.play);
    if (p) playBlob(p.blob);
  });

  $$('[data-use]').forEach(b => b.onclick = async () => {
    const p = (await dbAll()).find(x => x.id === b.dataset.use);
    if (!p) return;
    loadBlob(p.blob, p.fileName, p.type, p.duration);
    $('#profileName').value = p.name;
    $('#synthVoice').value = p.id;
    $('#synthStatus').className = 'statusline good';
    $('#synthStatus').textContent = `Selected “${p.name}”. Enter text below and press Generate speech.`;
    show('clone');
  });

  $$('[data-delete]').forEach(b => b.onclick = async () => {
    if (!confirm('Delete this saved voice profile from this device?')) return;
    await dbDelete(b.dataset.delete);
    await renderProfiles();
    await renderLibraryHub().catch(() => {});
  });
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1048576).toFixed(2)} MB`;
}

function formatTime(sec) {
  if (!Number.isFinite(sec)) return '';
  sec = Math.round(sec);
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}

function safeAudioFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  return (file.type || '').startsWith('audio/') || ['mp3','m4a','wav','aac','ogg','flac','webm'].includes(ext);
}

function revokeRef() {
  if (state.referenceUrl) {
    URL.revokeObjectURL(state.referenceUrl);
    state.referenceUrl = null;
  }
}

function loadBlob(blob, name = 'Reference audio', type = blob.type || 'audio/*', knownDuration = 0) {
  revokeRef();
  state.referenceBlob = blob;
  state.referenceFile = { name, size: blob.size, type };
  const url = URL.createObjectURL(blob);
  state.referenceUrl = url;
  const a = $('#refAudio');
  a.src = url;
  a.hidden = false;
  $('#fileCard').classList.remove('hidden');
  $('#fileName').textContent = name;
  $('#fileMeta').textContent = `${type || 'audio'} · ${formatBytes(blob.size)}`;
  $('#sampleInfo').className = 'statusline';
  $('#sampleInfo').textContent = 'Loading audio preview…';
  a.onloadedmetadata = () => {
    const duration = Number.isFinite(a.duration) ? a.duration : knownDuration;
    state.referenceFile.duration = duration;
    $('#fileMeta').textContent = `${type || 'audio'} · ${formatBytes(blob.size)}${duration ? ` · ${formatTime(duration)}` : ''}`;
    $('#sampleInfo').className = 'statusline good';
    $('#sampleInfo').textContent = `Reference sample loaded successfully${duration ? ` • ${formatTime(duration)}` : ''}. Save it as a voice profile or generate a test.`;
  };
  a.onerror = () => {
    $('#sampleInfo').className = 'statusline bad';
    $('#sampleInfo').textContent = 'The file was selected, but this browser could not preview the codec. WAV, MP3 or M4A are recommended.';
  };
}

function inferredAudioType(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const map = { mp3:'audio/mpeg', m4a:'audio/mp4', mp4:'audio/mp4', wav:'audio/wav', aac:'audio/aac', ogg:'audio/ogg', oga:'audio/ogg', flac:'audio/flac', webm:'audio/webm' };
  if ((file.type || '').startsWith('audio/')) return file.type;
  return map[ext] || file.type || 'application/octet-stream';
}

function handleFile(file) {
  if (!file) return;
  if (!safeAudioFile(file)) {
    alert('Please choose an audio file such as MP3, M4A, WAV, AAC, OGG or FLAC.');
    $('#audioFile').value = '';
    return;
  }
  if (file.size > 100 * 1024 * 1024) {
    alert('That file is over 100 MB. Please use a shorter voice sample.');
    return;
  }
  const normalizedType = inferredAudioType(file);
  const normalizedBlob = (file.type === normalizedType) ? file : new Blob([file], { type: normalizedType });
  loadBlob(normalizedBlob, file.name, normalizedType);
}

$('#audioFile').addEventListener('change', e => handleFile(e.currentTarget.files?.[0]));
const dz = $('#dropZone');
['dragenter','dragover'].forEach(evt => dz.addEventListener(evt, e => { e.preventDefault(); dz.classList.add('drag'); }));
['dragleave','drop'].forEach(evt => dz.addEventListener(evt, e => { e.preventDefault(); dz.classList.remove('drag'); }));
dz.addEventListener('drop', e => handleFile(e.dataTransfer?.files?.[0]));

$('#removeAudio').onclick = () => {
  revokeRef();
  state.referenceFile = null;
  state.referenceBlob = null;
  $('#refAudio').removeAttribute('src');
  $('#refAudio').load();
  $('#refAudio').hidden = true;
  $('#fileCard').classList.add('hidden');
  $('#audioFile').value = '';
  $('#sampleInfo').className = 'statusline';
  $('#sampleInfo').textContent = 'No reference sample loaded.';
};

function tab(which) {
  const upload = which === 'upload';
  $('#uploadTab').classList.toggle('active', upload);
  $('#recordTab').classList.toggle('active', !upload);
  $('#uploadPane').classList.toggle('active', upload);
  $('#recordPane').classList.toggle('active', !upload);
}
$('#uploadTab').onclick = () => tab('upload');
$('#recordTab').onclick = () => tab('record');

let mediaRecorder, chunks = [], startInt, startT;
$('#recordBtn').onclick = async () => {
  if (mediaRecorder?.state === 'recording') {
    mediaRecorder.stop();
    return;
  }
  if (!$('#consent').checked) {
    alert('Confirm permission to clone the voice first.');
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    alert('Microphone recording is not available in this browser. Use Upload Audio instead.');
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks = [];
    const preferred = ['audio/mp4','audio/webm;codecs=opus','audio/webm'].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported?.(t));
    mediaRecorder = preferred ? new MediaRecorder(stream, { mimeType: preferred }) : new MediaRecorder(stream);
    mediaRecorder.ondataavailable = e => { if (e.data?.size) chunks.push(e.data); };
    mediaRecorder.onstop = () => {
      clearInterval(startInt);
      stream.getTracks().forEach(t => t.stop());
      const type = mediaRecorder.mimeType || chunks[0]?.type || 'audio/webm';
      const ext = type.includes('mp4') ? 'm4a' : 'webm';
      const blob = new Blob(chunks, { type });
      loadBlob(blob, `voice-recording-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.${ext}`, type);
      $('#recordBtn').textContent = '● Record again';
    };
    mediaRecorder.start(250);
    startT = Date.now();
    $('#recordBtn').textContent = '■ Stop recording';
    startInt = setInterval(() => {
      const s = Math.floor((Date.now() - startT) / 1000);
      $('#timer').textContent = formatTime(s);
    }, 250);
  } catch (err) {
    alert('Microphone access was not available: ' + err.message);
  }
};

$('#saveProfile').onclick = async () => {
  if (!$('#consent').checked) return alert('Confirm that you have permission to use this voice.');
  if (!state.referenceBlob) return alert('Upload or record a reference audio sample first.');
  if (!state.db) state.db = await openDB();
  const name = $('#profileName').value.trim() || `Voice ${new Date().toLocaleDateString()}`;
  const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  await dbPut({
    id, name, blob: state.referenceBlob,
    fileName: state.referenceFile?.name || 'reference-audio',
    type: state.referenceFile?.type || state.referenceBlob.type,
    size: state.referenceBlob.size,
    duration: state.referenceFile?.duration || 0,
    created: Date.now()
  });
  $('#sampleInfo').className = 'statusline good';
  $('#sampleInfo').textContent = `Voice profile “${name}” saved. It is now available in Generate speech with a saved clone.`;
  await renderProfiles(id);
  await renderLibraryHub().catch(() => {});
};

function playBlob(blob) {
  const url = URL.createObjectURL(blob);
  const a = new Audio(url);
  a.onended = () => URL.revokeObjectURL(url);
  a.play().catch(() => {});
}

// -------------------- iPad/browser voice engine --------------------
// Pocket TTS runs the voice encoder + TTS model in a Web Worker using ONNX Runtime Web.
// The model files are fetched once from Hugging Face, then cached in Safari Cache Storage.
const POCKET_WORKER_MODULE = 'https://cdn.jsdelivr.net/npm/pocket-tts-js@0.1.0/src/worker.js';

state.browserTts = null;
state.browserEnginePromise = null;
state.browserVoiceRefs = new Map();

function resampleLinear(data, sourceRate, targetRate) {
  if (sourceRate === targetRate) return data;
  const ratio = sourceRate / targetRate;
  const outLength = Math.floor(data.length / ratio);
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const srcIndex = i * ratio;
    const lo = Math.floor(srcIndex);
    const hi = Math.min(lo + 1, data.length - 1);
    const t = srcIndex - lo;
    out[i] = data[lo] * (1 - t) + data[hi] * t;
  }
  return out;
}

class JWPocketTTS {
  constructor(options = {}) {
    this.options = {
      language: options.language || 'english_2026-04',
      quantized: options.quantized !== false,
      voiceCloning: options.voiceCloning !== false,
      modelBaseUrl: (options.modelBaseUrl || 'https://huggingface.co/vlapky/pocket-tts-onnx/resolve/main/onnx').replace(/\/$/, ''),
      ortBaseUrl: options.ortBaseUrl || 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.0/dist/',
      voicesUrl: null,
      maxThreads: options.maxThreads || 4,
      cache: options.cache !== false,
      cacheName: options.cacheName || 'jweds-pocket-tts-v1'
    };
    this.worker = null;
    this.bundle = null;
    this.ready = false;
    this._nextId = 1;
    this._pending = new Map();
    this._onChunk = null;
    this._onProgress = null;
    this._cloneCounter = 0;
    this._bootstrapUrl = null;
  }
  get sampleRate() { return this.bundle?.sampleRate || 24000; }
  _ensureWorker() {
    if (this.worker) return;
    const bootstrap = `import ${JSON.stringify(POCKET_WORKER_MODULE)};`;
    this._bootstrapUrl = URL.createObjectURL(new Blob([bootstrap], { type: 'text/javascript' }));
    this.worker = new Worker(this._bootstrapUrl, { type: 'module' });
    this.worker.onmessage = e => this._handleMessage(e.data);
    this.worker.onerror = e => {
      const err = new Error(e.message || 'On-device voice worker failed to start.');
      for (const p of this._pending.values()) p.reject(err);
      this._pending.clear();
    };
  }
  _handleMessage(msg) {
    if (msg.type === 'ready') { this.bundle = msg.bundle; return; }
    if (msg.type === 'chunk') { this._onChunk?.(msg.audio, msg.meta); return; }
    if (msg.type === 'progress' || msg.type === 'status') { this._onProgress?.(msg); return; }
    if (msg.type === 'result') {
      const p = this._pending.get(msg.id);
      if (p) { this._pending.delete(msg.id); p.resolve(msg.result); }
      return;
    }
    if (msg.type === 'error') {
      const p = this._pending.get(msg.id);
      const err = new Error(msg.error || 'On-device voice engine error.');
      if (p) { this._pending.delete(msg.id); p.reject(err); }
      else {
        for (const pending of this._pending.values()) pending.reject(err);
        this._pending.clear();
      }
    }
  }
  _request(type, payload, transfer = []) {
    this._ensureWorker();
    const id = this._nextId++;
    return new Promise((resolve, reject) => {
      this._pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, type, payload }, transfer);
    });
  }
  async load(onProgress) {
    this._onProgress = onProgress || null;
    await this._request('init', this.options);
    this.ready = true;
    return this.bundle;
  }
  async cloneVoice(audio, opts = {}) {
    let pcm = audio;
    if (opts.inputSampleRate && opts.inputSampleRate !== this.sampleRate) pcm = resampleLinear(audio, opts.inputSampleRate, this.sampleRate);
    const maxSamples = this.sampleRate * 10;
    if (pcm.length > maxSamples) pcm = pcm.slice(0, maxSamples);
    const ref = opts.name || `clone:${++this._cloneCounter}`;
    const transferPcm = pcm.slice();
    const result = await this._request('cloneVoice', { audio: transferPcm, ref }, [transferPcm.buffer]);
    return result.ref;
  }
  async generate(text, opts = {}) {
    if (!opts.voice) throw new Error('A cloned voice must be selected.');
    this._onChunk = opts.onChunk || null;
    try {
      const result = await this._request('generate', { text, voiceRef: opts.voice });
      return result.metrics;
    } finally { this._onChunk = null; }
  }
  destroy() {
    this.worker?.terminate();
    if (this._bootstrapUrl) URL.revokeObjectURL(this._bootstrapUrl);
    this.worker = null;
    this.ready = false;
    this.bundle = null;
    this._pending.clear();
  }
}

function deviceCapabilities() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  return {
    worker: !!window.Worker,
    wasm: typeof WebAssembly !== 'undefined',
    audio: !!AudioCtx,
    cache: 'caches' in window,
    secure: window.isSecureContext || location.hostname === 'localhost' || location.hostname === '127.0.0.1'
  };
}

function updateDeviceCompatibility() {
  const c = deviceCapabilities();
  const ok = c.worker && c.wasm && c.audio && c.secure;
  const el = $('#browserCompat');
  if (!el) return;
  if (ok) {
    el.className = 'statusline deviceGood';
    el.textContent = 'This iPad can run the browser voice engine. First use needs an internet connection to download about 150 MB of model files; the model is then cached on this device.';
  } else {
    const missing = [!c.secure && 'HTTPS', !c.worker && 'Web Worker', !c.wasm && 'WebAssembly', !c.audio && 'Web Audio'].filter(Boolean).join(', ');
    el.className = 'statusline bad';
    el.textContent = `On-device generation is unavailable here${missing ? ` — missing ${missing}` : ''}.`;
  }
}

function progressMessage(info) {
  const wrap = $('#modelProgress');
  const bar = $('#progressBar');
  const text = $('#progressText');
  if (!wrap || !bar || !text) return;
  wrap.classList.remove('hidden');
  if (info.type === 'progress' && info.total) {
    const pct = Math.max(0, Math.min(100, (info.loaded / info.total) * 100));
    bar.style.width = `${pct}%`;
    text.textContent = `${info.fromCache ? 'Loading cached' : 'Downloading'} ${info.label || 'model'} — ${pct.toFixed(0)}%`;
  } else if (info.status === 'loading-runtime') {
    bar.style.width = '5%'; text.textContent = 'Loading speech runtime…';
  } else if (info.status) {
    text.textContent = String(info.status).replace(/-/g, ' ');
  }
}

async function ensureOnDeviceEngine({ askBeforeDownload = false } = {}) {
  if (state.browserTts?.ready) return state.browserTts;
  if (state.browserEnginePromise) return state.browserEnginePromise;
  const c = deviceCapabilities();
  if (!(c.worker && c.wasm && c.audio && c.secure)) throw new Error('This page must run in current Safari over HTTPS and requires WebAssembly/Web Workers.');
  if (askBeforeDownload && !localStorage.getItem('jweds-pocket-model-approved')) {
    const ok = confirm('The first on-device voice generation downloads about 150 MB of model files to this iPad. Continue?');
    if (!ok) throw new Error('Model download cancelled.');
    localStorage.setItem('jweds-pocket-model-approved', '1');
  }
  state.browserEnginePromise = (async () => {
    try {
      $('#localStatus').textContent = 'Preparing on-device engine…';
      $('#localDetail').textContent = 'Downloading/caching the compact Pocket TTS model. Keep Safari open during first setup.';
      if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
      const tts = new JWPocketTTS({ quantized: true, voiceCloning: true, cache: true });
      await tts.load(progressMessage);
      state.browserTts = tts;
      $('#engineDot')?.classList.add('ok');
      $('#localStatus').textContent = 'On-device engine ready';
      $('#localDetail').textContent = 'Pocket TTS · English · INT8 · voice cloning runs inside this browser.';
      $('#modelProgress')?.classList.add('hidden');
      return tts;
    } catch (err) {
      $('#engineDot')?.classList.remove('ok');
      $('#localStatus').textContent = 'On-device engine failed to load';
      $('#localDetail').textContent = err.message || String(err);
      throw err;
    } finally {
      state.browserEnginePromise = null;
    }
  })();
  return state.browserEnginePromise;
}

async function decodeBlobToMono(blob) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) throw new Error('Web Audio is not available on this device.');
  const ctx = new AudioCtx();
  try {
    const buffer = await ctx.decodeAudioData((await blob.arrayBuffer()).slice(0));
    const mono = new Float32Array(buffer.length);
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < data.length; i++) mono[i] += data[i] / buffer.numberOfChannels;
    }
    return { samples: mono, sampleRate: buffer.sampleRate };
  } finally { await ctx.close().catch(() => {}); }
}

function chunksToWavBlob(chunks, sampleRate = 24000) {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new ArrayBuffer(44 + total * 2);
  const view = new DataView(out);
  const write = (o, t) => { for (let i = 0; i < t.length; i++) view.setUint8(o + i, t.charCodeAt(i)); };
  write(0, 'RIFF'); view.setUint32(4, 36 + total * 2, true); write(8, 'WAVE'); write(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  write(36, 'data'); view.setUint32(40, total * 2, true);
  let offset = 44;
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, chunk[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
  }
  return new Blob([out], { type: 'audio/wav' });
}

async function synthesizeOnDevice(profile, text, cacheKey = '') {
  const tts = await ensureOnDeviceEngine({ askBeforeDownload: true });
  let voiceRef = cacheKey ? state.browserVoiceRefs.get(cacheKey) : null;
  if (!voiceRef) {
    $('#synthStatus').className = 'statusline';
    $('#synthStatus').textContent = 'Analysing the saved voice sample on this iPad…';
    const decoded = await decodeBlobToMono(profile.blob);
    voiceRef = await tts.cloneVoice(decoded.samples, { inputSampleRate: decoded.sampleRate, name: cacheKey || undefined });
    if (cacheKey) state.browserVoiceRefs.set(cacheKey, voiceRef);
  }
  const chunks = [];
  $('#synthStatus').className = 'statusline';
  $('#synthStatus').textContent = 'Generating speech on this iPad…';
  await tts.generate(text, { voice: voiceRef, onChunk: audio => chunks.push(new Float32Array(audio)) });
  if (!chunks.length) throw new Error('The engine completed without returning audio.');
  return chunksToWavBlob(chunks, tts.sampleRate);
}

function localBase() {
  if (location.port === '8765') return location.origin.replace(/\/$/, '');
  return ($('#localUrl')?.value || state.settings.localUrl || 'http://127.0.0.1:8765').replace(/\/$/, '');
}

async function audioBlobToWav(blob) {
  if (blob.type === 'audio/wav' || blob.type === 'audio/x-wav') return blob;
  const decoded = await decodeBlobToMono(blob);
  return chunksToWavBlob([decoded.samples], decoded.sampleRate);
}

async function synthesizeCompanion(referenceBlob, text, model = 'nano') {
  const wavRef = await audioBlobToWav(referenceBlob);
  const fd = new FormData();
  fd.append('audio', wavRef, 'reference.wav');
  fd.append('text', text);
  fd.append('model', model);
  const response = await fetch(localBase() + '/synthesize', { method: 'POST', body: fd });
  if (!response.ok) {
    let detail = '';
    try { detail = (await response.json()).detail || ''; } catch (_) { detail = await response.text().catch(() => ''); }
    throw new Error(detail || `Companion engine returned HTTP ${response.status}`);
  }
  return response.blob();
}

async function synthesizeSelected(profile, text, cacheKey = '') {
  if ($('#synthEngine')?.value === 'companion') return synthesizeCompanion(profile.blob, text, 'nano');
  return synthesizeOnDevice(profile, text, cacheKey);
}

function setGenerated(blob) {
  if (state.generatedUrl) URL.revokeObjectURL(state.generatedUrl);
  state.generatedBlob = blob;
  state.generatedUrl = URL.createObjectURL(blob);
  $('#generatedAudio').src = state.generatedUrl;
  $('#synthOutput').classList.remove('hidden');
}

$('#prepareBrowser').onclick = async () => {
  const btn = $('#prepareBrowser');
  const prior = btn.textContent;
  btn.disabled = true; btn.textContent = 'Preparing…';
  try {
    localStorage.setItem('jweds-pocket-model-approved', '1');
    await ensureOnDeviceEngine();
    $('#synthStatus').className = 'statusline good';
    $('#synthStatus').textContent = 'On-device voice engine is ready. Select a saved voice and generate speech.';
  } catch (e) {
    $('#synthStatus').className = 'statusline bad';
    $('#synthStatus').textContent = `Could not prepare the on-device engine: ${e.message}`;
  } finally { btn.disabled = false; btn.textContent = prior; }
};

$('#generateLocal').onclick = async () => {
  if (!state.referenceBlob) return alert('Upload or record a reference audio sample first.');
  if (!$('#consent').checked) return alert('Confirm permission first.');
  const btn = $('#generateLocal');
  const prior = btn.textContent;
  btn.disabled = true; btn.textContent = 'Generating…';
  try {
    const blob = $('#synthEngine')?.value === 'companion'
      ? await synthesizeCompanion(state.referenceBlob, "Ey up! Welcome to Robbo's Trakway Trivia — where knowledge lays the groundwork!", 'nano')
      : await synthesizeOnDevice({ blob: state.referenceBlob }, "Ey up! Welcome to Robbo's Trakway Trivia — where knowledge lays the groundwork!");
    playBlob(blob);
    $('#sampleInfo').className = 'statusline good';
    $('#sampleInfo').textContent = 'Audition generated successfully.';
  } catch (e) {
    $('#sampleInfo').className = 'statusline bad';
    $('#sampleInfo').textContent = `Generation failed: ${e.message}`;
  } finally { btn.disabled = false; btn.textContent = prior; }
};

// -------------------- Generate from saved cloned voice --------------------
$('#synthText').addEventListener('input', () => { $('#synthCount').textContent = `${$('#synthText').value.length} / 2500`; });
$('#robboPrompt').onclick = () => {
  $('#synthText').value = "Ey up! Welcome to Robbo's Trakway Trivia — where knowledge lays the groundwork!";
  $('#synthText').dispatchEvent(new Event('input'));
};

$('#synthBtn').onclick = async () => {
  const id = $('#synthVoice').value;
  const text = $('#synthText').value.trim();
  if (!id) return alert('Save or select a cloned voice first.');
  if (!text) return alert('Enter the words you want the voice to say.');
  const profile = (await dbAll()).find(p => p.id === id);
  if (!profile) return alert('The selected voice profile could not be found.');
  const btn = $('#synthBtn');
  const prior = btn.textContent;
  btn.disabled = true; btn.textContent = 'Generating voice…';
  try {
    const engineName = $('#synthEngine').value === 'device' ? 'this iPad' : 'the companion computer';
    $('#synthStatus').className = 'statusline';
    $('#synthStatus').textContent = `Using “${profile.name}” on ${engineName}…`;
    const blob = await synthesizeSelected(profile, text, id);
    setGenerated(blob);
    $('#synthStatus').className = 'statusline good';
    $('#synthStatus').textContent = `Generated successfully using “${profile.name}”. Play it below or download the WAV.`;
    $('#generatedAudio').play().catch(() => {});
  } catch (e) {
    $('#synthStatus').className = 'statusline bad';
    $('#synthStatus').textContent = `Could not generate speech: ${e.message}`;
  } finally { btn.disabled = false; btn.textContent = prior; }
};

$('#downloadGenerated').onclick = () => {
  if (!state.generatedBlob) return;
  const voice = $('#synthVoice').selectedOptions[0]?.textContent || 'cloned-voice';
  const safe = voice.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'cloned-voice';
  const url = URL.createObjectURL(state.generatedBlob);
  const a = document.createElement('a'); a.href = url; a.download = `${safe}-${new Date().toISOString().replace(/[:.]/g,'-')}.wav`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};

$('#clearGenerated').onclick = () => {
  if (state.generatedUrl) URL.revokeObjectURL(state.generatedUrl);
  state.generatedBlob = null; state.generatedUrl = null;
  $('#generatedAudio').removeAttribute('src'); $('#generatedAudio').load();
  $('#synthOutput').classList.add('hidden');
  $('#synthStatus').className = 'statusline'; $('#synthStatus').textContent = 'Select a saved voice and enter some text.';
};

// -------------------- Engine status / settings --------------------
$('#checkLocal').onclick = async () => {
  updateDeviceCompatibility();
  if ($('#synthEngine')?.value === 'companion' || $('#mode')?.value === 'companion') {
    try {
      const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 4000);
      const r = await fetch(localBase() + '/health', { signal: ctrl.signal }); clearTimeout(timer);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const info = await r.json();
      $('#engineDot')?.classList.add('ok');
      $('#localStatus').textContent = 'Companion engine connected';
      $('#localDetail').textContent = `${info.engine || 'JW EDS companion engine'} · ${info.device || 'device unknown'}`;
    } catch (e) {
      $('#engineDot')?.classList.remove('ok');
      $('#localStatus').textContent = 'Companion engine not connected';
      $('#localDetail').textContent = 'Use “This iPad / browser” instead, or enter the LAN address of a computer running the optional companion engine.';
    }
    return;
  }
  const caps = deviceCapabilities();
  if (state.browserTts?.ready) {
    $('#engineDot')?.classList.add('ok');
    $('#localStatus').textContent = 'On-device engine ready';
    $('#localDetail').textContent = 'Voice cloning and speech generation are running inside this iPad browser.';
  } else if (caps.worker && caps.wasm && caps.audio && caps.secure) {
    $('#engineDot')?.classList.remove('ok');
    $('#localStatus').textContent = 'This iPad is compatible';
    $('#localDetail').textContent = 'Tap Prepare iPad voice engine. The first setup downloads about 150 MB and caches it locally.';
  } else {
    $('#engineDot')?.classList.remove('ok');
    $('#localStatus').textContent = 'On-device engine unavailable';
    $('#localDetail').textContent = 'Open the app in current Safari over HTTPS.';
  }
};

$('#synthEngine').addEventListener('change', () => {
  const companion = $('#synthEngine').value === 'companion';
  $('#prepareBrowser').hidden = companion;
  $('#enginePill')?.classList?.toggle('hidden', companion);
  $('#checkLocal').click();
});

$('#saveSettings').onclick = () => {
  state.settings = { mode: $('#mode').value, localUrl: $('#localUrl').value };
  localStorage.setItem('jweds-settings', JSON.stringify(state.settings));
  $('#synthEngine').value = state.settings.mode === 'companion' ? 'companion' : 'device';
  alert('Settings saved on this device.');
};
if (state.settings.mode) $('#mode').value = state.settings.mode === 'local' ? 'device' : state.settings.mode;
if (state.settings.localUrl) $('#localUrl').value = state.settings.localUrl;
if ($('#mode').value === 'companion') $('#synthEngine').value = 'companion';
updateDeviceCompatibility();
setTimeout(() => $('#checkLocal').click(), 250);

let deferredPrompt;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  $('#installBtn').hidden = false;
});
$('#installBtn').onclick = async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    $('#installBtn').hidden = true;
  } else {
    alert('In Safari use Share → Add to Home Screen.');
  }
};


$('#closeLibraryDetail').onclick = closeLibraryDetail;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}

initDB();
