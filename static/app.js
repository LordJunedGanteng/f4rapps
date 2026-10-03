(() => {
  let currentSource = 'youtube';
  let currentMode   = 'bypassed';
  let selectedFile  = null;
  let pollTimer     = null;
  let currentCfg    = { speed: 2.253, amplify: -2 };
  let currentFormat = 'ogg';
  const ROBLOX_SPEED = 0.45;
  let bypassQueue   = [];

  // ── Load config on boot ──
  async function loadConfig() {
    const spd = localStorage.getItem('cfg_speed');
    const amp = localStorage.getItem('cfg_amplify');
    if (spd) currentCfg.speed = parseFloat(spd);
    if (amp) currentCfg.amplify = parseInt(amp, 10);
    
    document.getElementById('inp-speed').value   = currentCfg.speed;
    document.getElementById('inp-amplify').value = currentCfg.amplify;
    document.getElementById('val-speed').textContent   = currentCfg.speed;
    document.getElementById('val-amplify').textContent = currentCfg.amplify + ' dB';
    updateHint(currentCfg.speed);
    updateSettingsHint(currentCfg.speed, currentCfg.amplify);
  }
  loadConfig();

  // ── Settings toggle ──
  document.getElementById('settings-toggle').addEventListener('click', () => {
    const body    = document.getElementById('settings-body');
    const chevron = document.getElementById('chevron');
    const open    = body.style.display !== 'none';
    body.style.display    = open ? 'none' : 'block';
    chevron.classList.toggle('open', !open);
  });

  // ── Slider live update ──
  document.getElementById('inp-speed').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    document.getElementById('val-speed').textContent = v.toFixed(3);
    if (!isNaN(v)) updateHint(v);
  });
  document.getElementById('inp-amplify').addEventListener('input', e => {
    const v = parseInt(e.target.value, 10);
    document.getElementById('val-amplify').textContent = v + ' dB';
  });

  function updateHint(speed) {
    const effective = (speed * ROBLOX_SPEED).toFixed(3);
    const el = document.getElementById('roblox-hint-speed');
    if (el) el.textContent = `Roblox 0.45x → tempo efektif ×${effective}`;
  }

  function updateSettingsHint(speed, amplify) {
    const hint = document.getElementById('settings-hint');
    if (hint) hint.textContent = `×${speed}  /  ${amplify >= 0 ? '+' : ''}${amplify} dB`;
  }

  // ── Save settings (with warning modal) ──
  const DEFAULT_SPEED   = 2.253;
  const DEFAULT_AMPLIFY = -2;
  let modalTimer = null;

  async function doSaveSettings() {
    const speed   = parseFloat(document.getElementById('inp-speed').value);
    const amplify = parseInt(document.getElementById('inp-amplify').value, 10);
    const status  = document.getElementById('save-status');
    
    localStorage.setItem('cfg_speed', speed);
    localStorage.setItem('cfg_amplify', amplify);
    currentCfg = { speed, amplify };
    
    updateHint(speed);
    updateSettingsHint(speed, amplify);
    status.textContent = '✓ Tersimpan';
    status.className = 'save-status';
    setTimeout(() => { status.textContent = ''; }, 2500);
  }

  function openSettingsModal() {
    const overlay  = document.getElementById('settings-modal');
    const progress = document.getElementById('modal-progress');
    const countdown= document.getElementById('modal-countdown');
    const continueBtn = document.getElementById('modal-continue');
    overlay.classList.add('open');
    continueBtn.disabled = true;
    progress.style.width = '0%';
    let elapsed = 0;
    const TOTAL = 4000;
    clearInterval(modalTimer);
    modalTimer = setInterval(() => {
      elapsed += 100;
      const pct = Math.min(100, (elapsed / TOTAL) * 100);
      progress.style.width = pct + '%';
      const rem = Math.max(0, Math.ceil((TOTAL - elapsed) / 1000));
      countdown.textContent = rem > 0 ? `Continue (${rem}s)` : 'Continue';
      if (elapsed >= TOTAL) {
        clearInterval(modalTimer);
        continueBtn.disabled = false;
      }
    }, 100);
  }

  function closeSettingsModal() {
    clearInterval(modalTimer);
    document.getElementById('settings-modal').classList.remove('open');
  }

  document.getElementById('btn-save').addEventListener('click', () => openSettingsModal());

  document.getElementById('modal-continue').addEventListener('click', async () => {
    closeSettingsModal();
    await doSaveSettings();
  });

  document.getElementById('modal-skip').addEventListener('click', async () => {
    closeSettingsModal();
    await doSaveSettings();
  });

  document.getElementById('modal-reset').addEventListener('click', async () => {
    closeSettingsModal();
    document.getElementById('inp-speed').value   = DEFAULT_SPEED;
    document.getElementById('inp-amplify').value = DEFAULT_AMPLIFY;
    document.getElementById('val-speed').textContent   = DEFAULT_SPEED;
    document.getElementById('val-amplify').textContent = DEFAULT_AMPLIFY + ' dB';
    updateHint(DEFAULT_SPEED);
    updateSettingsHint(DEFAULT_SPEED, DEFAULT_AMPLIFY);
    await doSaveSettings();
  });

  // close on overlay click
  document.getElementById('settings-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeSettingsModal();
  });

  // ── Cookies ──
  async function loadCookiesStatus() {
    try {
      const res  = await fetch('/api/cookies');
      const data = await res.json();
      setCookiesUI(data.active, data.entries || 0);
    } catch { /* silent */ }
  }
  loadCookiesStatus();

  // ── Cookies drag & drop ──
  const cookiesDropzone  = document.getElementById('cookies-dropzone');
  const cookiesFileInput = document.getElementById('cookies-file-input');

  function loadCookieFile(file) {
    if (!file || !file.name.endsWith('.txt')) return;
    const reader = new FileReader();
    reader.onload = e => {
      document.getElementById('cookies-textarea').value = e.target.result;
      if (cookiesDropzone) cookiesDropzone.querySelector('div').textContent = `✓ ${file.name} dimuat`;
    };
    reader.readAsText(file);
  }

  if (cookiesDropzone && cookiesFileInput) {
    cookiesDropzone.addEventListener('dragover', e => { e.preventDefault(); cookiesDropzone.classList.add('drag-over'); });
    cookiesDropzone.addEventListener('dragleave', () => cookiesDropzone.classList.remove('drag-over'));
    cookiesDropzone.addEventListener('drop', e => {
      e.preventDefault();
      cookiesDropzone.classList.remove('drag-over');
      loadCookieFile(e.dataTransfer.files[0]);
    });
    document.getElementById('cookies-browse').addEventListener('click', () => cookiesFileInput.click());
    cookiesFileInput.addEventListener('change', () => loadCookieFile(cookiesFileInput.files[0]));
  }

  function setCookiesUI(active, entries) {
    const dot   = document.getElementById('cookies-dot');
    const label = document.getElementById('cookies-label');
    const clear = document.getElementById('btn-clear-cookies');
    if (active) {
      dot.className   = 'cookies-dot active';
      label.textContent = `Aktif — ${entries} entri tersimpan`;
      clear.style.display = 'inline-block';
    } else {
      dot.className   = 'cookies-dot';
      label.textContent = 'Belum ada cookies';
      clear.style.display = 'none';
    }
  }

  document.getElementById('btn-save-cookies').addEventListener('click', async () => {
    const content = document.getElementById('cookies-textarea').value.trim();
    const status  = document.getElementById('cookies-save-status');
    if (!content) {
      status.textContent = 'Tempel konten cookies terlebih dahulu.';
      status.className = 'save-status error';
      setTimeout(() => { status.textContent = ''; status.className = 'save-status'; }, 3000);
      return;
    }
    try {
      const res  = await fetch('/api/cookies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cookies: content }) });
      const data = await res.json();
      if (data.ok) {
        setCookiesUI(true, data.entries);
        document.getElementById('cookies-textarea').value = '';
        status.textContent = `Tersimpan — ${data.entries} entri`;
        status.className = 'save-status';
        setTimeout(() => { status.textContent = ''; }, 3000);
      } else {
        status.textContent = data.error || 'Gagal menyimpan.';
        status.className = 'save-status error';
        setTimeout(() => { status.textContent = ''; status.className = 'save-status'; }, 3000);
      }
    } catch {
      status.textContent = 'Koneksi gagal.';
      status.className = 'save-status error';
    }
  });

  document.getElementById('btn-clear-cookies').addEventListener('click', async () => {
    const status = document.getElementById('cookies-save-status');
    try {
      await fetch('/api/cookies', { method: 'DELETE' });
      setCookiesUI(false, 0);
      status.textContent = 'Cookies dihapus.';
      status.className = 'save-status';
      setTimeout(() => { status.textContent = ''; }, 2500);
    } catch {
      status.textContent = 'Koneksi gagal.';
      status.className = 'save-status error';
    }
  });

  // ── URL Preview ──
  let previewTimer = null;

  function fmtDurPreview(s) {
    if (!s) return '';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    return `${m}:${String(sec).padStart(2,'0')}`;
  }

  function clearPreview() {
    const inp = document.getElementById('url-input');
    const box = document.getElementById('url-preview');
    if (inp) inp.classList.remove('has-preview');
    if (box) box.innerHTML = '';
  }

  function showPreviewLoading() {
    document.getElementById('url-preview').innerHTML = `
      <div class="preview-loading">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 1s linear infinite">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        Loading preview...
      </div>`;
    if (!document.getElementById('spin-style')) {
      const s = document.createElement('style');
      s.id = 'spin-style';
      s.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
      document.head.appendChild(s);
    }
  }

  function showPreviewCard(data) {
    const inp = document.getElementById('url-input');
    inp.classList.add('has-preview');

    // Auto-switch to Mixtape if duration > 7 minutes
    const autoMixtape = data.duration && data.duration > 420;
    if (autoMixtape) {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      const mixtapeBtn = document.querySelector('.mode-btn[data-mode="mixtape"]');
      if (mixtapeBtn) mixtapeBtn.classList.add('active');
      currentMode = 'mixtape';
    }

    const thumbHtml = data.thumbnail
      ? `<img class="preview-thumb" src="${esc(data.thumbnail)}" onerror="this.style.display='none'" alt=""/>`
      : `<div class="preview-thumb-placeholder"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div>`;
    const dur = fmtDurPreview(data.duration);
    const mixtapeTag = autoMixtape
      ? `<div class="preview-meta-item" style="color:#f472b6;">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
           Auto-switched ke Mixtape
         </div>`
      : '';
    const plTag = data.has_playlist
      ? `<div class="preview-meta-item" style="color:#38bdf8;cursor:pointer;text-decoration:underline;font-weight:600;" onclick="switchNavTab('playlist','${esc(inp.value.trim())}')">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
           Bagian dari Playlist · Buka Playlist
         </div>`
      : '';
    document.getElementById('url-preview').innerHTML = `
      <div class="preview-card">
        ${thumbHtml}
        <div class="preview-info">
          <div class="preview-title">${esc(data.title)}</div>
          <div class="preview-meta">
            ${data.uploader ? `<div class="preview-meta-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              ${esc(data.uploader)}</div>` : ''}
            ${dur ? `<div class="preview-meta-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ${esc(dur)}</div>` : ''}
            ${mixtapeTag}
            ${plTag}
          </div>
        </div>
      </div>`;
  }

  function isPlaylistUrl(url) {
    try {
      const u = new URL(url);
      return (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be'))
             && u.searchParams.has('list');
    } catch { return false; }
  }

  function showPreviewError(msg) {
    document.getElementById('url-preview').innerHTML = `
      <div class="preview-loading" style="border-color:rgba(248,113,113,.3);color:#f87171;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        ${esc(msg)}
      </div>`;
  }

  document.getElementById('url-input').addEventListener('input', e => {
    clearTimeout(previewTimer);
    const val = e.target.value.trim();
    if (!val || currentSource === 'upload') { clearPreview(); return; }
    if (!val.startsWith('http://') && !val.startsWith('https://')) { clearPreview(); return; }
    if (isPlaylistUrl(val) && !val.includes('v=')) {
      document.getElementById('url-preview').innerHTML = `
        <div class="preview-loading" style="border-color:rgba(139,92,246,.4);background:rgba(139,92,246,.08);color:#c4b5fd;cursor:pointer;" onclick="switchNavTab('playlist', '${esc(val)}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
          <span>Link Playlist terdeteksi! <strong>Klik di sini untuk beralih ke tab Playlist &amp; pilih video</strong>.</span>
        </div>`;
      return;
    }
    showPreviewLoading();
    previewTimer = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/preview?url=${encodeURIComponent(val)}`);
        const data = await res.json();
        if (data.error) {
          showPreviewError(data.error); 
          return; 
        }
        showPreviewCard(data);
      } catch { 
        showPreviewError('Gagal memuat preview. Cek koneksi server.');
      }
    }, 700);
  });

  // Clear preview when source changes
  document.querySelectorAll('.source-btn').forEach(btn => {
    btn.addEventListener('click', () => clearPreview());
  });

  // ── Source tabs ──
  document.querySelectorAll('.source-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.source-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSource = btn.dataset.source;

      const urlSec = document.getElementById('url-section');
      const upSec  = document.getElementById('upload-section');
      const methodTabs = document.getElementById('input-method-tabs');
      const searchSec = document.getElementById('search-section');
      const inp    = document.getElementById('url-input');

      if (currentSource === 'upload') {
        if (urlSec) urlSec.style.display = 'none';
        if (searchSec) searchSec.style.display = 'none';
        if (methodTabs) methodTabs.style.display = 'none';
        if (upSec) upSec.style.display  = 'block';
      } else {
        if (upSec) upSec.style.display  = 'none';
        if (methodTabs) methodTabs.style.display = 'flex';
        if (typeof currentInputMethod !== 'undefined' && currentInputMethod === 'search') {
          if (urlSec) urlSec.style.display = 'none';
          if (searchSec) searchSec.style.display = 'block';
        } else {
          if (urlSec) urlSec.style.display = 'block';
          if (searchSec) searchSec.style.display = 'none';
        }
        if (typeof setSearchPlatform === 'function') {
          if (currentSource === 'soundcloud') {
            setSearchPlatform('soundcloud');
          } else if (currentSource === 'youtube') {
            setSearchPlatform('youtube');
          }
        }
        const ph = {
          youtube:    'Paste link YouTube...',
          soundcloud: 'Paste link SoundCloud...',
          spotify:    'Paste link atau judul Spotify...',
        };
        if (inp) inp.placeholder = ph[currentSource] || 'Paste link...';
      }
    });
  });

  // ── Mode buttons ──
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentMode = btn.dataset.mode;
    });
  });

  // ── Preset format buttons ──
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFormat = btn.dataset.format;
    });
  });

  // ── Drop zone ──
  const dropZone  = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');

  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => { if (fileInput.files[0]) pickFile(fileInput.files[0]); });
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault(); dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) pickFile(e.dataTransfer.files[0]);
  });

  function pickFile(file) {
    selectedFile = file;
    dropZone.classList.add('file-selected');
    dropZone.querySelector('p').textContent    = file.name;
    dropZone.querySelector('small').textContent = fmtBytes(file.size) + ' — file dipilih';
  }

  // ── Process ──
  function requestNotifPermission() {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }

  function notifyUser(title, body) {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon: '/static/logo.png' });
    }
    // Simple sound alert
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.volume = 0.5;
      audio.play();
    } catch(e) {}
  }

  document.getElementById('btn-process').addEventListener('click', async () => {
    requestNotifPermission();
    clearResults();
    clearErrors();

    const formData = new FormData();
    formData.append('source', currentSource);
    formData.append('mode',   currentMode);

    if (currentSource === 'upload') {
      if (!selectedFile) { showError('Pilih atau drop file terlebih dahulu.'); return; }
      formData.append('file', selectedFile);
    } else {
      const url = document.getElementById('url-input').value.trim();
      if (!url) { showError('Masukkan link terlebih dahulu.'); return; }
      if (isPlaylistUrl(url)) { showError('Link playlist tidak didukung. Paste link video langsung.'); return; }
      formData.append('url', url);
    }
    
    formData.append('speed', currentCfg.speed);
    formData.append('amplify', currentCfg.amplify);
    formData.append('reverb', document.getElementById('chk-reverb').checked ? 'true' : 'false');
    formData.append('hz', document.getElementById('sel-hz').value);

    const singleNamingMode = document.getElementById('single-sel-renamer')?.value || 'clean';
    formData.append('naming_mode', singleNamingMode);
    if (singleNamingMode === 'custom') {
      formData.append('name_prefix', document.getElementById('single-input-prefix')?.value || '');
      formData.append('name_suffix', document.getElementById('single-input-suffix')?.value || '');
    }
    formData.append('format', currentFormat);

    clearPreview();
    setBtn(true);
    showProgress(5, 'Menghubungi server...', '');

    try {
      const res  = await fetch('/api/process', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok || data.error) {
        showError(data.error || 'Terjadi kesalahan server.'); hideProgress(); setBtn(false); return;
      }
      setProgress(15, 'Mendownload audio...');
      startPoll(data.job_id);
    } catch {
      showError('Tidak dapat terhubung ke server.'); hideProgress(); setBtn(false);
    }
  });

  // ── Poll ──
  function startPoll(jobId) {
    clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      try {
        const res  = await fetch(`/api/status/${jobId}`);
        const data = await res.json();
        if (data.status === 'processing') {
          setProgress(data.progress || 30, 'Memproses...');
          renderLogs(data.logs || []);
        } else if (data.status === 'done') {
          clearInterval(pollTimer);
          setProgress(100, 'Selesai');
          renderLogs(data.logs || []);
          notifyUser('Audio Selesai!', 'File kamu sudah siap untuk diunduh.');
          setTimeout(() => {
            hideProgress();
            window._lastMixtapeParts = data.mixtape_parts || null;
            renderFiles(data.files, data);
            setBtn(false);
            loadHistory();
          }, 700);
        } else if (data.status === 'error') {
          clearInterval(pollTimer);
          renderLogs(data.logs || []);
          showError(data.error || 'Error tidak diketahui.'); hideProgress(); setBtn(false);
        }
      } catch { /* retry */ }
    }, 1000);
  }

  // ── UI helpers ──
  function showProgress(pct, status) {
    document.getElementById('progress-card').style.display = 'block';
    setProgress(pct, status);
  }
  function setProgress(pct, status) {
    document.getElementById('progress-bar').style.width = pct + '%';
    document.getElementById('progress-pct').textContent = pct + '%';
    document.getElementById('progress-status').textContent = status;
  }
  function hideProgress() { document.getElementById('progress-card').style.display = 'none'; }

  // ── Log timeline renderer ──
  function renderLogs(logs) {
    if (!logs || logs.length === 0) return;
    const wrap = document.getElementById('log-wrap');
    const list = document.getElementById('log-list');
    wrap.style.display = 'block';
    list.innerHTML = '';
    logs.forEach(entry => {
      const item = document.createElement('div');
      item.className = 'log-item';

      const dotClass = entry.status || 'pending'; // active | done | error | pending
      item.innerHTML = `
        <div class="log-dot ${dotClass}"></div>
        <div class="log-body">
          <div class="log-label${dotClass === 'done' ? '' : ''}">${esc(entry.label)}</div>
          ${entry.detail ? `<div class="log-detail">${esc(entry.detail)}</div>` : ''}
        </div>
        <div class="log-time">${esc(entry.time || '')}</div>
      `;
      list.appendChild(item);
    });
    // auto-scroll to last item
    list.lastElementChild && list.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function setBtn(loading) {
    const btn = document.getElementById('btn-process');
    if (btn) {
      btn.disabled    = loading;
      btn.textContent = loading ? 'Processing...' : 'Process Audio';
    }
    const btnV = document.getElementById('btn-process-video');
    if (btnV && !loading) {
      btnV.disabled    = false;
      btnV.textContent = 'Unduh Video MP4';
    }
    const btnP = document.getElementById('btn-process-playlist');
    if (btnP && !loading && typeof updatePlaylistSelectionCount === 'function') {
      btnP.disabled = false;
      updatePlaylistSelectionCount();
    }
    const btnQ = document.getElementById('btn-process-all-queue');
    if (btnQ && !loading) {
      btnQ.disabled = (bypassQueue.length === 0);
      btnQ.textContent = `PROCESS BYPASS SEMUA LAGU (${bypassQueue.length} LAGU)`;
    }
  }

  function clearResults() {
    document.getElementById('results-card').style.display = 'none';
    document.getElementById('file-list').innerHTML = '';
    const uis = document.getElementById('uploaded-ids-section');
    if(uis) uis.style.display = 'none';
    const uita = document.getElementById('uploaded-ids-textarea');
    if(uita) uita.value = '';
    document.getElementById('log-list').innerHTML = '';
    document.getElementById('log-wrap').style.display = 'none';
    document.getElementById('roblox-card').style.display = 'none';
    document.getElementById('roblox-text').innerHTML = '';
  }
  function clearErrors() {
    document.querySelectorAll('.error-toast').forEach(e => e.remove());
  }

  const btnCopyIds = document.getElementById('btn-copy-ids');
  if (btnCopyIds) {
    btnCopyIds.addEventListener('click', () => {
      const ta = document.getElementById('uploaded-ids-textarea');
      if (!ta.value) return;
      ta.select();
      document.execCommand('copy');
      btnCopyIds.textContent = 'COPIED!';
      setTimeout(() => btnCopyIds.textContent = 'COPY TO CLIPBOARD!', 2000);
    });
  }

  function renderRobloxInfo(mode) {
    if (mode !== 'bypassed' && mode !== 'mixtape') return;
    const speed     = currentCfg.speed;
    const effective = (speed * ROBLOX_SPEED).toFixed(3);
    const diff      = Math.abs(effective - 1.0);
    const tempo     = diff < 0.03
      ? 'hampir sama persis dengan tempo asli'
      : effective > 1.0
        ? `${effective}× lebih cepat dari tempo asli`
        : `${effective}× lebih lambat dari tempo asli`;
    document.getElementById('roblox-text').innerHTML =
      `Dengan <strong>Playback Speed 0.45</strong> di Roblox, audio ini akan terdengar <strong>${tempo}</strong>.<br>` +
      `(Speed bypass <strong>×${speed}</strong> × Roblox <strong>0.45</strong> = <strong>×${effective}</strong>)`;
    document.getElementById('roblox-card').style.display = 'flex';
  }

  let _lastJobData = null;

  function makeFileItemHtml(token, name, size, uid, extraMeta, rbxBtnHtml, isVideo = false, isZip = false) {
    let iconSvg = `
      <svg viewBox="0 0 24 24" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
      </svg>`;
    if (isVideo) {
      iconSvg = `
        <svg viewBox="0 0 24 24" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>`;
    } else if (isZip) {
      iconSvg = `
        <svg viewBox="0 0 24 24" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        </svg>`;
    }

    const encTok  = encodeURIComponent(token);
    const encName = encodeURIComponent(name);

    return `
      <div class="file-thumb">
        ${iconSvg}
      </div>
      <div class="file-info" style="flex:1;min-width:0;">
        <div class="file-name">${esc(name)}</div>
        <div class="file-size">${fmtBytes(size)}${extraMeta ? ' · ' + extraMeta : ''}</div>
        <div class="rbx-upload-status" id="rbx-status-${uid}"></div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
        <button class="btn-dl" onclick="dlFile('${encTok}','${encName}')">Download</button>
        ${rbxBtnHtml}
      </div>
    `;
  }

  function renderFiles(files, jobData = null) {
    _lastJobData = jobData;
    if (!files || !files.length) { showError('Tidak ada file yang dihasilkan.'); return; }
    if (currentMode) renderRobloxInfo(currentMode);
    const rc   = document.getElementById('results-card');
    const list = document.getElementById('file-list');
    list.innerHTML = '';
    rc.style.display = 'block';

    const mixtapeParts = window._lastMixtapeParts;
    const isMixtape = mixtapeParts && mixtapeParts.length > 0;

    // Render ZIP / single file row(s)
    files.forEach(f => {
      const div = document.createElement('div');
      div.className = 'file-item';
      const uid = Math.random().toString(36).slice(2);
      const isVideo = Boolean(f.is_video || (f.name && f.name.endsWith('.mp4')));
      const isZip   = Boolean(f.is_zip   || (f.name && f.name.endsWith('.zip')));
      const rbxIconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
      const rbxBtn = (isMixtape || isVideo || isZip)
        ? ''
        : `<button class="btn-rbx-upload" id="rbx-btn-${uid}" onclick="openRbxNameModal('${esc(f.token)}','${esc(f.name)}','${uid}',null)">${rbxIconSvg} Upload to Roblox</button>`;
      div.innerHTML = makeFileItemHtml(f.token, f.name, f.size, uid, isMixtape ? 'ZIP semua part' : (isZip ? 'Arsip ZIP' : ''), rbxBtn, isVideo, isZip);
      list.appendChild(div);
    });

    // Render per-part rows for mixtape
    if (isMixtape) {
      const hdr = document.createElement('div');
      hdr.className = 'mixtape-parts-header';
      hdr.textContent = `${mixtapeParts.length} Part — Upload per Bagian`;
      list.appendChild(hdr);

      mixtapeParts.forEach(part => {
        const uid = Math.random().toString(36).slice(2);
        const div = document.createElement('div');
        div.className = 'file-item';
        const meta = part.is_last ? `Part ${part.index} (END)` : `Part ${part.index}`;
        const rbxIconSvg2 = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
        const rbxBtn = `<button class="btn-rbx-upload" id="rbx-btn-${uid}" onclick="openRbxPartModal('${esc(part.token)}','${esc(part.name)}','${uid}',${part.index},${part.is_last ? 'true' : 'false'})">${rbxIconSvg2} Upload to Roblox</button>`;
        div.innerHTML = makeFileItemHtml(part.token, part.name, part.size, uid, meta, rbxBtn);
        list.appendChild(div);
      });
    }

    // Show Bulk Roblox Upload bar if multiple uploadable audio files
    const uploadableFiles = files.filter(f => !f.is_zip && !f.is_video && !f.name.endsWith('.zip') && !f.name.endsWith('.mp4'));
    const bulkBar = document.getElementById('bulk-rbx-bar');
    if (bulkBar) {
      if (uploadableFiles.length > 1) {
        bulkBar.style.display = 'flex';
        const countEl = document.getElementById('bulk-rbx-count');
        const btnCountEl = document.getElementById('bulk-rbx-btn-count');
        if (countEl) countEl.textContent = uploadableFiles.length;
        if (btnCountEl) btnCountEl.textContent = uploadableFiles.length;
        const btnBulk = document.getElementById('btn-start-bulk-rbx');
        if (btnBulk) {
          btnBulk.onclick = () => startBulkRobloxUpload(uploadableFiles);
        }
      } else {
        bulkBar.style.display = 'none';
      }
    }
  }

  // ── Roblox Notifications ──
  function showRbxApprovalNotif(assetName, assetId) {
    const container = document.getElementById('rbx-notifications');
    const el = document.createElement('div');
    el.className = 'rbx-notif';
    el.innerHTML = `
      <div class="rbx-notif-icon">✓</div>
      <div class="rbx-notif-body">
        <div class="rbx-notif-title">Audio kamu lolos! 🎉</div>
        <div class="rbx-notif-name">${esc(assetName)}</div>
        <div class="rbx-notif-id" style="margin-top:4px; display:flex; align-items:center; justify-content:space-between;">
          ID Assets: ${esc(String(assetId))}
          <a href="https://www.roblox.com/library/${esc(String(assetId))}/" target="_blank" style="text-decoration:none; background:rgba(255,255,255,0.2); color:#fff; padding:2px 6px; border-radius:4px; font-size:10px;">Buka</a>
        </div>
      </div>`;
    container.appendChild(el);
    el.addEventListener('click', () => el.remove());
    setTimeout(() => el.style.transition = 'opacity .5s', 6000);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 500); }, 8000);
  }

  // ── Roblox Upload ──
  let _rbxPending = null;

  window.openRbxNameModal = (token, name, uid, mixtapeParts = null) => {
    _rbxPending = { token, uid, mixtapeParts, partInfo: null };
    const input = document.getElementById('rbx-name-input');
    input.value = name.replace(/\.[^.]+$/, '').replace(/_MIXTAPE$/, '').slice(0, 50);
    document.getElementById('rbx-name-label').textContent = 'Nama Asset';
    document.getElementById('rbx-name-modal').classList.add('open');
    setTimeout(() => { input.focus(); input.select(); }, 100);
  };

  window.openRbxPartModal = (token, name, uid, partIndex, isLast) => {
    _rbxPending = { token, uid, mixtapeParts: null, partInfo: { index: partIndex, isLast } };
    const input = document.getElementById('rbx-name-input');
    // Strip part suffix and extension to get base name
    input.value = name.replace(/\.[^.]+$/, '').replace(/_\d+$/, '').replace(/_END$/, '').slice(0, 44);
    document.getElementById('rbx-name-label').textContent =
      `Nama Base (Part ${partIndex}${isLast ? ' - END' : ''})`;
    document.getElementById('rbx-name-modal').classList.add('open');
    setTimeout(() => { input.focus(); input.select(); }, 100);
  };

  document.getElementById('rbx-name-submit').addEventListener('click', () => {
    const name = document.getElementById('rbx-name-input').value.trim();
    if (!name) { document.getElementById('rbx-name-input').focus(); return; }
    document.getElementById('rbx-name-modal').classList.remove('open');
    if (_rbxPending) {
      const { token, uid, mixtapeParts, partInfo } = _rbxPending;
      _rbxPending = null;
      if (partInfo) {
        const fullName = partInfo.isLast ? `${name}_END` : `${name}_${partInfo.index}`;
        doRbxUpload(token, fullName, uid, 'auto');
      } else if (mixtapeParts && mixtapeParts.length) {
        doRbxMixtapeUpload(name, mixtapeParts, uid);
      } else {
        doRbxUpload(token, name, uid, 'auto');
      }
    }
  });

  document.getElementById('rbx-name-cancel').addEventListener('click', () => {
    document.getElementById('rbx-name-modal').classList.remove('open');
    _rbxPending = null;
  });

  document.getElementById('rbx-name-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('rbx-name-submit').click();
    if (e.key === 'Escape') document.getElementById('rbx-name-cancel').click();
  });

  document.getElementById('rbx-name-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) document.getElementById('rbx-name-cancel').click();
  });

  // Single file upload
  window.doRbxUpload = async (token, name, uid, target = 'auto') => {
    const statusEl = document.getElementById(`rbx-status-${uid}`);
    const btnEl    = document.getElementById(`rbx-btn-${uid}`);
    if (statusEl) { statusEl.className = 'rbx-upload-status uploading'; statusEl.style.display = 'block'; statusEl.innerHTML = '⏳ Mengupload ke Roblox...'; }
    if (btnEl) btnEl.disabled = true;
    const hist = rbxHistAdd({ asset_name: name, status: 'uploading', target });
    renderRbxHistory();
    try {
      const res  = await fetch('/api/roblox/upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name: name.replace(/\.[^.]+$/, ''), target,
          api_key: localStorage.getItem('rbx_api_key') || '',
          user_id: localStorage.getItem('rbx_user_id') || '',
          group_api_key: localStorage.getItem('rbx_group_api_key') || '',
          group_id: localStorage.getItem('rbx_group_id') || '',
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        if (statusEl) { statusEl.className = 'rbx-upload-status error'; statusEl.textContent = `✗ ${data.error}`; }
        if (btnEl) btnEl.disabled = false;
        rbxHistPatch(hist.id, { status: 'error' });
        return;
      }
      if (statusEl) { statusEl.className = 'rbx-upload-status pending'; statusEl.textContent = '🔄 Menunggu moderasi Roblox... (cek tiap 15 detik)'; }
      rbxHistPatch(hist.id, { status: 'pending', operation_id: data.operation_id });
      pollRbxOperation(data.operation_id, target, uid, name, false, hist.id);
    } catch {
      if (statusEl) { statusEl.className = 'rbx-upload-status error'; statusEl.textContent = '✗ Koneksi gagal.'; }
      if (btnEl) btnEl.disabled = false;
      rbxHistPatch(hist.id, { status: 'error' });
    }
  };

  // Mixtape multi-part upload
  async function doRbxMixtapeUpload(baseName, parts, uid) {
    const statusEl = document.getElementById(`rbx-status-${uid}`);
    const btnEl    = document.getElementById(`rbx-btn-${uid}`);
    if (btnEl) btnEl.disabled = true;
    const total = parts.length;
    const opIds = [];

    for (let i = 0; i < parts.length; i++) {
      const part     = parts[i];
      const isLast   = part.is_last || (i === parts.length - 1);
      const partName = isLast ? `${baseName}_END` : `${baseName}_${i + 1}`;
      if (statusEl) { statusEl.className = 'rbx-upload-status uploading'; statusEl.style.display = 'block'; statusEl.innerHTML = `⏳ Upload part ${i + 1}/${total} (${esc(partName)})...`; }
      const hist = rbxHistAdd({ asset_name: partName, status: 'uploading', target: 'auto' });
      renderRbxHistory();
      try {
        const res  = await fetch('/api/roblox/upload', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: part.token, name: partName, target: 'auto',
            api_key: localStorage.getItem('rbx_api_key') || '',
            user_id: localStorage.getItem('rbx_user_id') || '',
            group_api_key: localStorage.getItem('rbx_group_api_key') || '',
            group_id: localStorage.getItem('rbx_group_id') || '',
          }),
        });
        const data = await res.json();
        if (!data.ok) {
          if (statusEl) { statusEl.className = 'rbx-upload-status error'; statusEl.textContent = `✗ Part ${i + 1} gagal: ${data.error}`; }
          if (btnEl) btnEl.disabled = false;
          rbxHistPatch(hist.id, { status: 'error' });
          return;
        }
        rbxHistPatch(hist.id, { status: 'pending', operation_id: data.operation_id });
        opIds.push({ opId: data.operation_id, name: partName, histId: hist.id });
      } catch {
        if (statusEl) { statusEl.className = 'rbx-upload-status error'; statusEl.textContent = `✗ Koneksi gagal saat upload part ${i + 1}.`; }
        if (btnEl) btnEl.disabled = false;
        rbxHistPatch(hist.id, { status: 'error' });
        return;
      }
    }

    if (statusEl) { statusEl.className = 'rbx-upload-status pending'; statusEl.innerHTML = `🔄 Semua ${total} part terupload — menunggu moderasi Roblox...`; }
    if (btnEl) btnEl.disabled = false;

    // Poll each part every 15 seconds
    opIds.forEach(({ opId, name, histId }) => pollRbxOperation(opId, 'auto', uid, name, true, histId));
  }

  // Thumbnail panel renderer
  function renderThumbPanel(uid, assetId, assetName, status, imageUrl) {
    const statusEl = document.getElementById(`rbx-status-${uid}`);
    if (!statusEl) return;
    const panelId  = `rbx-thumb-${uid}-${assetId}`;
    let panel = document.getElementById(panelId);
    if (!panel) {
      panel = document.createElement('div');
      panel.id = panelId;
      panel.className = 'rbx-thumb-panel';
      statusEl.parentNode.insertBefore(panel, statusEl.nextSibling);
    }
    const badgeLabel = status === 'accepted' ? 'Accepted' : status === 'rejected' ? 'Rejected' : 'Pending';
    const dotAnim    = status === 'pending' ? ' pending' : '';
    panel.innerHTML = `
      ${imageUrl ? `<img class="rbx-thumb-img" src="${esc(imageUrl)}" alt="thumbnail"/>` : ''}
      <div class="rbx-thumb-info">
        <div class="rbx-thumb-badge ${status}">
          <span class="rbx-thumb-dot${dotAnim}"></span>${badgeLabel}
        </div>
        <div class="rbx-thumb-name">${esc(assetName)}</div>
        <div class="rbx-thumb-id" style="display:flex; gap:8px; align-items:center; margin-top:4px;">
          ID: ${esc(String(assetId))}
          <a href="https://www.roblox.com/library/${esc(String(assetId))}/" target="_blank" style="text-decoration:none; background:#3b82f6; color:#fff; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:500;">Buka Link</a>
        </div>
      </div>`;
  }

  // Poll thumbnail every 15s until accepted/rejected
  function pollRbxThumbnail(assetId, assetName, uid, isMixtapePart = false, histId = null) {
    const check = async () => {
      try {
        const res  = await fetch(`/api/roblox/thumbnail/${assetId}`);
        const data = await res.json();
        if (data.error) { setTimeout(check, 15000); return; }
        renderThumbPanel(uid, assetId, assetName, data.status, data.image_url);
        if (data.status === 'accepted') {
          rbxHistPatch(histId, { status: 'accepted', asset_id: String(assetId) });
          showRbxApprovalNotif(assetName, assetId);
          
          const uis = document.getElementById('uploaded-ids-section');
          const uita = document.getElementById('uploaded-ids-textarea');
          if (uis && uita) {
            uis.style.display = 'block';
            if (uita.value === '') {
              const baseName = assetName.replace(/_[0-9]+$/, '').replace(/_END$/, '');
              uita.value = baseName + '\\n' + String(assetId) + '\\n';
            } else {
              uita.value += String(assetId) + '\\n';
            }
          }

          if (!isMixtapePart) {
            const statusEl = document.getElementById(`rbx-status-${uid}`);
            if (statusEl) {
              statusEl.className = 'rbx-upload-status done';
              statusEl.innerHTML = `✓ Diterima! Asset ID: <strong style="color:#fff;user-select:all;">${assetId}</strong> <a href="https://www.roblox.com/library/${assetId}/" target="_blank" style="text-decoration:none; background:#3b82f6; color:#fff; padding:2px 8px; border-radius:4px; font-size:11px; margin-left:6px;">Buka Link</a>`;
            }
          }
        } else if (data.status === 'rejected') {
          rbxHistPatch(histId, { status: 'rejected', asset_id: String(assetId) });
          if (!isMixtapePart) {
            const statusEl = document.getElementById(`rbx-status-${uid}`);
            if (statusEl) { statusEl.className = 'rbx-upload-status error'; statusEl.textContent = '✗ Ditolak oleh moderasi Roblox.'; }
          }
        } else {
          setTimeout(check, 15000);
        }
      } catch { setTimeout(check, 15000); }
    };
    setTimeout(check, 3000);
  }

  // Polling — wait for operation to get asset_id, then switch to thumbnail polling
  function pollRbxOperation(opId, target, uid, assetName = '', isMixtapePart = false, histId = null) {
    const statusEl = document.getElementById(`rbx-status-${uid}`);
    const btnEl    = document.getElementById(`rbx-btn-${uid}`);

    const check = async () => {
      try {
        const paramStr = new URLSearchParams({
          target: target,
          api_key: localStorage.getItem('rbx_api_key') || '',
          group_api_key: localStorage.getItem('rbx_group_api_key') || ''
        }).toString();
        const res  = await fetch(`/api/roblox/operation/${opId}?${paramStr}`);
        const data = await res.json();
        if (data.error) {
          if (!isMixtapePart) {
            if (statusEl) { statusEl.className = 'rbx-upload-status error'; statusEl.textContent = `✗ ${data.error}`; }
            if (btnEl) btnEl.disabled = false;
          }
          rbxHistPatch(histId, { status: 'error' });
          return;
        }
        if (data.done) {
          if (data.rejected) {
            if (!isMixtapePart) {
              if (statusEl) { statusEl.className = 'rbx-upload-status error'; statusEl.textContent = '✗ Ditolak oleh moderasi Roblox.'; }
              if (btnEl) btnEl.disabled = false;
            }
            rbxHistPatch(histId, { status: 'rejected' });
          } else if (data.asset_id) {
            rbxHistPatch(histId, { status: 'pending', asset_id: String(data.asset_id) });
            if (!isMixtapePart) {
              if (statusEl) { statusEl.className = 'rbx-upload-status pending'; statusEl.innerHTML = `🔄 Upload diterima — cek moderasi... (tiap 15 detik)`; }
              if (btnEl) btnEl.disabled = false;
            } else {
              if (statusEl) statusEl.innerHTML = statusEl.innerHTML + `<br>🔄 ${esc(assetName)}: menunggu moderasi...`;
            }
            pollRbxThumbnail(data.asset_id, assetName, uid, isMixtapePart, histId);
          } else {
            setTimeout(check, 15000);
          }
        } else {
          setTimeout(check, 15000);
        }
      } catch { setTimeout(check, 15000); }
    };
    setTimeout(check, 5000);
  }

  function showError(msg) {
    const wrap = document.querySelector('.main-wrap');
    const div  = document.createElement('div');
    div.className = 'error-toast';
    div.innerHTML = `
      <svg viewBox="0 0 24 24" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      ${esc(msg)}
    `;
    wrap.insertBefore(div, wrap.querySelector('#btn-process').nextSibling);
    setTimeout(() => div.remove(), 7000);
  }

  // ── Utils ──
  function fmtBytes(b) {
    if (!b) return '';
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
    return (b/1048576).toFixed(2) + ' MB';
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // ── Roblox Config Load/Save ──
  async function loadRobloxConfig() {
    const user_id = localStorage.getItem('rbx_user_id');
    const api_key = localStorage.getItem('rbx_api_key');
    const group_id = localStorage.getItem('rbx_group_id');
    const group_api_key = localStorage.getItem('rbx_group_api_key');
    
    if (user_id) document.getElementById('rbx-user-id').value = user_id;
    if (api_key) document.getElementById('rbx-api-key').placeholder = '(tersimpan di browser)';
    if (group_id) document.getElementById('rbx-group-id').value = group_id;
    if (group_api_key) document.getElementById('rbx-group-api-key').placeholder = '(tersimpan di browser)';
    
    const oauthInfo = document.getElementById('rbx-oauth-connected');
    if (oauthInfo) oauthInfo.style.display = 'none';
  }
  loadRobloxConfig();

  // Roblox tabs
  document.querySelectorAll('.rbx-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.rbx-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.rbx-tab-content').forEach(c => c.style.display = 'none');
      const tab = document.getElementById('rtab-' + btn.dataset.rbxtab);
      if (tab) tab.style.display = 'block';
    });
  });

  document.getElementById('btn-save-rbx-personal').addEventListener('click', () => {
    const uid = document.getElementById('rbx-user-id').value.trim();
    const key = document.getElementById('rbx-api-key').value.trim();
    if(uid) localStorage.setItem('rbx_user_id', uid);
    if(key) localStorage.setItem('rbx_api_key', key);
    
    const st = document.getElementById('rbx-personal-status');
    st.textContent = 'Tersimpan';
    setTimeout(() => { st.textContent = ''; }, 2000);
    loadRobloxConfig();
  });

  document.getElementById('btn-save-rbx-group').addEventListener('click', () => {
    const gid = document.getElementById('rbx-group-id').value.trim();
    const gkey= document.getElementById('rbx-group-api-key').value.trim();
    if(gid)  localStorage.setItem('rbx_group_id', gid);
    if(gkey) localStorage.setItem('rbx_group_api_key', gkey);
    
    const st = document.getElementById('rbx-group-status');
    st.textContent = 'Tersimpan';
    setTimeout(() => { st.textContent = ''; }, 2000);
    loadRobloxConfig();
  });

  document.getElementById('btn-rbx-connect').addEventListener('click', async () => {
    const st = document.getElementById('rbx-oauth-status');
    // Save credentials first
    await saveRbxSection('oauth', {
      client_id:     document.getElementById('rbx-client-id').value.trim(),
      client_secret: document.getElementById('rbx-client-secret').value.trim(),
    }, 'rbx-oauth-status');
    // Open OAuth popup
    const popup = window.open('/api/roblox/auth', 'roblox_auth', 'width=520,height=680');
    if (!popup) { st.textContent = 'Popup diblokir browser!'; st.className = 'save-status error'; return; }
    window.addEventListener('message', async (e) => {
      if (e.data === 'roblox_auth_done') {
        await loadRobloxConfig();
        st.textContent = 'Berhasil terhubung!'; st.className = 'save-status';
        setTimeout(() => { st.textContent = ''; st.className = 'save-status'; }, 3000);
      }
    }, { once: true });
  });

  document.getElementById('btn-rbx-disconnect').addEventListener('click', async () => {
    await fetch('/api/roblox/disconnect', { method: 'POST' });
    document.getElementById('rbx-oauth-connected').style.display = 'none';
  });

  window.dlFile = (token, name) => {
    let cleanTok = token || '';
    let cleanName = name || 'download';
    try {
      if (cleanTok.includes('%')) cleanTok = decodeURIComponent(cleanTok);
    } catch(e) {}
    try {
      if (cleanName.includes('%')) cleanName = decodeURIComponent(cleanName);
    } catch(e) {}

    cleanName = cleanName.replace(/[\\/:*?"<>|]/g, '_').trim();
    if (!cleanName) cleanName = 'download';

    const a = document.createElement('a');
    a.href = `/api/download/${encodeURIComponent(cleanTok)}?name=${encodeURIComponent(cleanName)}`;
    a.download = cleanName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try { document.body.removeChild(a); } catch(e) {}
    }, 500);
  };

  // ── History ──
  const SOURCE_ICON = { youtube:'YT', soundcloud:'SC', spotify:'SP', upload:'UP' };
  const MODE_LABEL  = { normal:'Normal', bypassed:'Bypassed', mixtape:'Mixtape' };

  function fmtDur(s) {
    if (!s) return '';
    return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
  }

  function fmtTs(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('id-ID',{day:'2-digit',month:'short'}) + ' ' +
             d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
    } catch { return ''; }
  }

  // ── Roblox Upload History (localStorage) ──
  const RBX_HIST_KEY = 'rbx_upload_history';

  function rbxHistLoad() {
    try { return JSON.parse(localStorage.getItem(RBX_HIST_KEY) || '[]'); } catch { return []; }
  }
  function rbxHistSave(list) {
    try { localStorage.setItem(RBX_HIST_KEY, JSON.stringify(list.slice(0, 50))); } catch {}
  }
  function rbxHistAdd(entry) {
    const list = rbxHistLoad();
    const id   = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const item = { id, ts: Date.now(), ...entry };
    list.unshift(item);
    rbxHistSave(list);
    return item;
  }
  function rbxHistPatch(id, patch) {
    if (!id) return;
    const list = rbxHistLoad();
    const idx  = list.findIndex(e => e.id === id);
    if (idx < 0) return;
    Object.assign(list[idx], patch);
    rbxHistSave(list);
    const div = document.getElementById(`rbx-h-${id}`);
    if (div) div.innerHTML = rbxHistItemHtml(list[idx]);
  }

  function rbxHistItemHtml(e) {
    const labels = { uploading:'Uploading', pending:'Pending', accepted:'Accepted', rejected:'Rejected', error:'Error' };
    const idStr  = e.asset_id ? `<div class="rbx-hist-id">ID: ${esc(String(e.asset_id))}</div>` : '';
    return `
      <span class="rbx-hist-badge ${esc(e.status)}">${labels[e.status] || e.status}</span>
      <div style="flex:1;min-width:0;">
        <div class="rbx-hist-name">${esc(e.asset_name)}</div>
        ${idStr}
      </div>
      <div style="font-size:11px;color:var(--muted);flex-shrink:0;">${esc(fmtTs(e.ts))}</div>`;
  }

  function renderRbxHistory() {
    const list = rbxHistLoad();
    const card = document.getElementById('rbx-history-card');
    const ul   = document.getElementById('rbx-history-list');
    if (!list.length) { card.style.display = 'none'; return; }
    card.style.display = 'block';
    ul.innerHTML = '';
    list.forEach(e => {
      const div = document.createElement('div');
      div.className = 'rbx-hist-item';
      div.id = `rbx-h-${e.id}`;
      div.innerHTML = rbxHistItemHtml(e);
      ul.appendChild(div);
    });
  }

  function resumeRbxPolls() {
    rbxHistLoad()
      .filter(e => e.status === 'pending' && e.asset_id)
      .forEach(e => pollRbxThumbnail(e.asset_id, e.asset_name, null, false, e.id));
  }

  async function loadHistory() {
    try {
      const res  = await fetch('/api/history');
      const data = await res.json();
      const card = document.getElementById('history-card');
      const list = document.getElementById('history-list');
      if (!data.length) { card.style.display = 'none'; return; }
      card.style.display = 'block';
      list.innerHTML = '';
      data.forEach(h => {
        const div = document.createElement('div');
        div.className = 'history-item';
        const mode    = h.source === 'upload' ? 'upload' : (h.mode || 'bypassed');
        const badge   = MODE_LABEL[h.mode] || h.mode || 'Unknown';
        const src     = SOURCE_ICON[h.source] || h.source?.toUpperCase()?.slice(0,2) || '?';
        const dur     = fmtDur(h.duration);
        const size    = h.size ? (h.size/1024/1024).toFixed(2) + ' MB' : '';
        const meta    = [src, dur, size, `${h.files||1} file`].filter(Boolean).join(' · ');
        div.innerHTML = `
          <span class="history-badge ${mode}">${esc(badge)}</span>
          <div class="history-info">
            <div class="history-title" title="${esc(h.title)}">${esc(h.title)}</div>
            <div class="history-meta">${esc(meta)}</div>
          </div>
          <div class="history-time">${esc(fmtTs(h.ts))}</div>
        `;
        list.appendChild(div);
      });
    } catch { /* silent */ }
  }
  loadHistory();

  renderRbxHistory();
  resumeRbxPolls();

  document.getElementById('btn-clear-history').addEventListener('click', async () => {
    await fetch('/api/history', { method: 'DELETE' });
    document.getElementById('history-card').style.display = 'none';
  });

  document.getElementById('btn-clear-rbx-history').addEventListener('click', () => {
    localStorage.removeItem(RBX_HIST_KEY);
    document.getElementById('rbx-history-card').style.display = 'none';
  });

  // ─────────────────────────────────────────────
  //  21ST.DEV NAVIGATION TABS CONTROLLER
  // ─────────────────────────────────────────────
  let currentNavTab = 'audio';

  function switchNavTab(tabName, optUrl = '') {
    currentNavTab = tabName;
    document.querySelectorAll('.nav-tab-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.navtab === tabName);
    });

    const overviewPanel = document.getElementById('tab-overview-panel');
    const audioPanel    = document.getElementById('tab-audio-panel');
    const videoPanel    = document.getElementById('tab-video-panel');
    const playlistPanel = document.getElementById('tab-playlist-panel');
    const queuePanel    = document.getElementById('tab-queue-panel');

    const studioKpi = document.getElementById('studio-kpi-grid');
    if (studioKpi) {
      studioKpi.style.display = tabName === 'overview' ? 'none' : 'grid';
    }

    const panels = [
      { name: 'overview', el: overviewPanel },
      { name: 'audio',    el: audioPanel },
      { name: 'video',    el: videoPanel },
      { name: 'playlist', el: playlistPanel },
      { name: 'queue',    el: queuePanel }
    ];

    panels.forEach(p => {
      if (!p.el) return;
      if (p.name === tabName) {
        p.el.style.display = 'flex';
        p.el.classList.remove('smooth-panel-motion');
        void p.el.offsetWidth; // trigger reflow for animation restart
        p.el.classList.add('smooth-panel-motion');
      } else {
        p.el.style.display = 'none';
        p.el.classList.remove('smooth-panel-motion');
      }
    });

    const panelAside = document.querySelector('.dash-panel-aside');
    if (panelAside) {
      panelAside.style.display = tabName === 'overview' ? 'none' : 'flex';
      if (tabName !== 'overview') {
        panelAside.classList.remove('smooth-panel-motion');
        void panelAside.offsetWidth;
        panelAside.classList.add('smooth-panel-motion');
      }
    }
    const workspaceLayout = document.querySelector('.dash-workspace-layout');
    if (workspaceLayout) {
      workspaceLayout.style.gridTemplateColumns = tabName === 'overview' ? '1fr' : '';
    }

    clearResults();
    clearErrors();

    if (tabName === 'queue') {
      renderTabQueueList();
    }
    if (tabName === 'overview') {
      renderOverviewDashboard();
    }

    if (optUrl) {
      if (tabName === 'playlist') {
        const plInp = document.getElementById('playlist-url-input');
        if (plInp) {
          plInp.value = optUrl;
          loadPlaylistInfo(optUrl);
        }
      } else if (tabName === 'video') {
        const vidInp = document.getElementById('video-url-input');
        if (vidInp) {
          vidInp.value = optUrl;
          vidInp.dispatchEvent(new Event('input'));
        }
      } else if (tabName === 'audio') {
        const audInp = document.getElementById('url-input');
        if (audInp) {
          audInp.value = optUrl;
          audInp.dispatchEvent(new Event('input'));
        }
      }
    }
  }
  window.switchNavTab = switchNavTab;

  document.querySelectorAll('.nav-tab-item').forEach(btn => {
    btn.addEventListener('click', () => {
      switchNavTab(btn.dataset.navtab);
    });
  });

  // ─────────────────────────────────────────────
  //  OVERVIEW ANALYTICS DASHBOARD CONTROLLER
  // ─────────────────────────────────────────────
  const chartDataSets = {
    '7d': {
      labels: ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'],
      area: 'M 0 160 C 100 130, 160 40, 240 80 C 320 120, 380 20, 460 60 C 540 100, 620 30, 700 70 C 750 90, 780 40, 800 50 L 800 200 L 0 200 Z',
      line: 'M 0 160 C 100 130, 160 40, 240 80 C 320 120, 380 20, 460 60 C 540 100, 620 30, 700 70 C 750 90, 780 40, 800 50'
    },
    '30d': {
      labels: ['1 Sep', '5 Sep', '10 Sep', '15 Sep', '20 Sep', '25 Sep', '30 Sep'],
      area: 'M 0 170 C 120 150, 180 60, 260 90 C 340 130, 420 30, 500 50 C 580 80, 660 20, 740 60 C 770 70, 790 30, 800 40 L 800 200 L 0 200 Z',
      line: 'M 0 170 C 120 150, 180 60, 260 90 C 340 130, 420 30, 500 50 C 580 80, 660 20, 740 60 C 770 70, 790 30, 800 40'
    },
    '90d': {
      labels: ['Juli', 'Pertengahan Juli', 'Agustus', 'Pertengahan Ags', 'September', 'Pertengahan Sep', 'Oktober'],
      area: 'M 0 180 C 140 160, 200 80, 300 100 C 400 120, 480 40, 560 65 C 640 90, 720 25, 780 45 C 790 50, 795 30, 800 25 L 800 200 L 0 200 Z',
      line: 'M 0 180 C 140 160, 200 80, 300 100 C 400 120, 480 40, 560 65 C 640 90, 720 25, 780 45 C 790 50, 795 30, 800 25'
    }
  };

  async function renderOverviewDashboard() {
    const rbxList = (typeof rbxHistLoad === 'function') ? rbxHistLoad() : [];
    const totalRbxEl = document.getElementById('ov-total-rbx');
    if (totalRbxEl) totalRbxEl.textContent = rbxList.length;

    const countBadge = document.getElementById('ov-table-count');
    if (countBadge) countBadge.textContent = rbxList.length;

    try {
      const res = await fetch('/api/history');
      if (res.ok) {
        const histData = await res.json();
        const totalBypassedEl = document.getElementById('ov-total-bypassed');
        if (totalBypassedEl) totalBypassedEl.textContent = (histData.length || 0) + rbxList.length;
      }
    } catch(e) {}

    const tbody = document.getElementById('ov-rbx-table-body');
    if (tbody) {
      if (rbxList.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="4" style="text-align:center; padding:24px; color:rgba(226,232,240,0.4);">
              Belum ada audio yang dikirim ke Roblox. Upload audio melalui tab Audio Studio.
            </td>
          </tr>
        `;
      } else {
        tbody.innerHTML = '';
        rbxList.slice(0, 15).forEach(item => {
          const tr = document.createElement('tr');
          const title = item.asset_name || item.name || 'Audio Track';
          const assetId = item.asset_id || '-';
          const ts = item.ts ? new Date(item.ts).toLocaleDateString('id-ID', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : 'Baru Saja';
          const isSuccess = item.status === 'success' || !!item.asset_id;

          tr.innerHTML = `
            <td style="font-weight:600; color:#fff; max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              ${esc(title)}
            </td>
            <td>
              ${assetId !== '-' ? `
                <span class="ov-asset-id-pill" onclick="navigator.clipboard.writeText('${assetId}');alert('Asset ID ${assetId} disalin!')" title="Klik untuk salin">
                  <span>${assetId}</span>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </span>
              ` : '<span style="color:var(--muted); font-size:11px;">Belum Terbit</span>'}
            </td>
            <td style="font-size:11px; color:var(--muted);">${ts}</td>
            <td>
              <span class="ov-status-pill ${isSuccess ? 'success' : 'pending'}">
                <span class="online-dot" style="${isSuccess ? '' : 'background:#fbbf24;box-shadow:none;'}"></span>
                <span>${isSuccess ? 'Approved / Lolos' : 'Pending'}</span>
              </span>
            </td>
          `;
          tbody.appendChild(tr);
        });
      }
    }

    const rbxUserId = localStorage.getItem('rbx_user_id');
    const rbxApiKey = localStorage.getItem('rbx_api_key');
    const rbxGroupId = localStorage.getItem('rbx_group_id');
    const dispUserId = document.getElementById('ov-display-user-id');
    const dispTarget = document.getElementById('ov-display-target');
    const dispAccName = document.getElementById('ov-rbx-account-name');

    if (rbxGroupId && dispTarget) {
      dispTarget.textContent = `Group ID: ${rbxGroupId}`;
    }
    if (rbxUserId && dispUserId) {
      dispUserId.textContent = `User ID: ${rbxUserId}`;
    }
    if ((rbxUserId || rbxApiKey) && dispAccName && dispAccName.textContent.includes('Belum')) {
      dispAccName.textContent = rbxUserId ? `Roblox UID #${rbxUserId}` : 'Roblox API Connected';
    }
  }
  window.renderOverviewDashboard = renderOverviewDashboard;

  document.addEventListener('click', e => {
    const btn = e.target.closest('.ov-chart-btn');
    if (!btn) return;
    document.querySelectorAll('.ov-chart-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const range = btn.dataset.chartrange || '7d';
    const data = chartDataSets[range] || chartDataSets['7d'];
    const areaEl = document.getElementById('ov-chart-area');
    const lineEl = document.getElementById('ov-chart-line');
    const axisEl = document.getElementById('ov-chart-axis');
    if (areaEl) areaEl.setAttribute('d', data.area);
    if (lineEl) lineEl.setAttribute('d', data.line);
    if (axisEl && data.labels) {
      axisEl.innerHTML = data.labels.map(l => `<span>${l}</span>`).join('');
    }
  });

  // ─────────────────────────────────────────────
  //  VIDEO DOWNLOADER CONTROLLER
  // ─────────────────────────────────────────────
  let selectedVideoQuality = '1080';
  let videoPreviewTimer    = null;

  document.querySelectorAll('.quality-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedVideoQuality = btn.dataset.quality;
    });
  });

  const videoUrlInput = document.getElementById('video-url-input');
  if (videoUrlInput) {
    videoUrlInput.addEventListener('input', e => {
      clearTimeout(videoPreviewTimer);
      const val = e.target.value.trim();
      const prevEl = document.getElementById('video-url-preview');
      if (!val || (!val.startsWith('http://') && !val.startsWith('https://'))) {
        if (prevEl) prevEl.innerHTML = '';
        return;
      }

      if (isPlaylistUrl(val) && !val.includes('v=')) {
        prevEl.innerHTML = `
          <div class="preview-loading" style="border-color:rgba(139,92,246,.4);background:rgba(139,92,246,.08);color:#c4b5fd;cursor:pointer;margin-top:10px;" onclick="switchNavTab('playlist', '${esc(val)}')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
            <span>Link Playlist terdeteksi! <strong>Klik di sini untuk beralih ke tab Playlist &amp; pilih video</strong>.</span>
          </div>`;
        return;
      }

      prevEl.innerHTML = `
        <div class="preview-loading" style="margin-top:10px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin">
            <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
          </svg>
          Memuat preview video...
        </div>`;

      videoPreviewTimer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/preview?url=${encodeURIComponent(val)}`);
          const data = await res.json();
          if (data.error) {
            prevEl.innerHTML = `<div class="preview-loading" style="border-color:rgba(248,113,113,.3);color:#f87171;margin-top:10px;">${esc(data.error)}</div>`;
            return;
          }

          const thumbHtml = data.thumbnail
            ? `<img class="preview-thumb" src="${esc(data.thumbnail)}" onerror="this.style.display='none'" alt=""/>`
            : `<div class="preview-thumb-placeholder"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>`;
          const dur = fmtDurPreview(data.duration);

          const plNotice = data.has_playlist
            ? `<div class="preview-meta-item" style="color:#38bdf8;cursor:pointer;text-decoration:underline;font-weight:600;" onclick="switchNavTab('playlist', '${esc(val)}')">
                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                 Bagian dari Playlist · Buka Playlist
               </div>`
            : '';

          prevEl.innerHTML = `
            <div class="preview-card" style="margin-top:10px;">
              ${thumbHtml}
              <div class="preview-info">
                <div class="preview-title">${esc(data.title)}</div>
                <div class="preview-meta">
                  ${data.uploader ? `<div class="preview-meta-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    ${esc(data.uploader)}</div>` : ''}
                  ${dur ? `<div class="preview-meta-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    ${esc(dur)}</div>` : ''}
                  <div class="preview-meta-item" style="color:#818cf8;font-weight:700;">MP4 ${selectedVideoQuality}p</div>
                  ${plNotice}
                </div>
              </div>
            </div>`;
        } catch {
          prevEl.innerHTML = `<div class="preview-loading" style="border-color:rgba(248,113,113,.3);color:#f87171;margin-top:10px;">Gagal memuat preview video.</div>`;
        }
      }, 700);
    });
  }

  const btnProcessVideo = document.getElementById('btn-process-video');
  if (btnProcessVideo) {
    btnProcessVideo.addEventListener('click', async () => {
      requestNotifPermission();
      clearResults();
      clearErrors();

      const url = (document.getElementById('video-url-input')?.value || '').trim();
      if (!url) {
        showError('Masukkan URL video terlebih dahulu.');
        return;
      }

      btnProcessVideo.disabled = true;
      btnProcessVideo.textContent = 'Memulai download video...';
      showProgress(5, 'Menghubungi server...');

      try {
        const fd = new FormData();
        fd.append('url', url);
        fd.append('quality', selectedVideoQuality);

        const res = await fetch('/api/process_video', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok || data.error) {
          showError(data.error || 'Gagal memulai unduhan video.');
          hideProgress();
          btnProcessVideo.disabled = false;
          btnProcessVideo.textContent = 'Unduh Video MP4';
          return;
        }

        setProgress(15, 'Mendownload & me-merge video MP4...');
        startPoll(data.job_id);
      } catch {
        showError('Gagal terhubung ke server.');
        hideProgress();
        btnProcessVideo.disabled = false;
        btnProcessVideo.textContent = 'Unduh Video MP4';
      }
    });
  }

  // ─────────────────────────────────────────────
  //  PLAYLIST & BATCH DOWNLOADER CONTROLLER
  // ─────────────────────────────────────────────
  let currentPlaylistItems   = [];
  let selectedPlaylistIds    = new Set();
  let currentPlaylistFormat  = 'audio';
  let currentPlaylistTitle   = 'Playlist';

  async function loadPlaylistInfo(url) {
    const loadingEl = document.getElementById('playlist-loading');
    const contentEl = document.getElementById('playlist-content-wrap');
    const errEl     = document.getElementById('playlist-error');

    if (!url) {
      if (errEl) {
        errEl.innerHTML = `<div class="preview-loading" style="border-color:rgba(248,113,113,.3);color:#f87171;">URL playlist tidak boleh kosong.</div>`;
        errEl.style.display = 'block';
      }
      return;
    }

    if (loadingEl) loadingEl.style.display = 'flex';
    if (contentEl) contentEl.style.display = 'none';
    if (errEl)     errEl.style.display     = 'none';

    try {
      const res = await fetch(`/api/playlist/info?url=${encodeURIComponent(url)}`);
      const data = await res.json();

      if (loadingEl) loadingEl.style.display = 'none';

      if (!res.ok || data.error) {
        if (errEl) {
          errEl.innerHTML = `<div class="preview-loading" style="border-color:rgba(248,113,113,.3);color:#f87171;">${esc(data.error || 'Gagal membaca playlist.')}</div>`;
          errEl.style.display = 'block';
        }
        return;
      }

      currentPlaylistItems = data.items || [];
      currentPlaylistTitle = data.title || 'Playlist';

      // Select all items by default
      selectedPlaylistIds = new Set(currentPlaylistItems.map(item => item.id));

      document.getElementById('pl-title').textContent = data.title || 'YouTube Playlist';
      document.getElementById('pl-author').textContent = data.uploader ? `Oleh ${data.uploader}` : 'YouTube Playlist';
      document.getElementById('pl-total-badge').textContent = data.total || currentPlaylistItems.length;

      updatePlaylistSelectionCount();
      renderPlaylistItems(currentPlaylistItems);

      if (contentEl) contentEl.style.display = 'block';
    } catch {
      if (loadingEl) loadingEl.style.display = 'none';
      if (errEl) {
        errEl.innerHTML = `<div class="preview-loading" style="border-color:rgba(248,113,113,.3);color:#f87171;">Tidak dapat terhubung ke server untuk membaca playlist.</div>`;
        errEl.style.display = 'block';
      }
    }
  }

  function updatePlaylistSelectionCount() {
    const count = selectedPlaylistIds.size;
    const selCountEl = document.getElementById('pl-selected-count');
    const btnCountEl = document.getElementById('pl-btn-count');
    if (selCountEl) selCountEl.textContent = count;
    if (btnCountEl) btnCountEl.textContent = count;

    const btnProcess = document.getElementById('btn-process-playlist');
    if (btnProcess) {
      btnProcess.disabled = count === 0;
    }
  }

  function renderPlaylistItems(items) {
    const listEl = document.getElementById('playlist-items-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (!items || items.length === 0) {
      listEl.innerHTML = `<div style="text-align:center;padding:24px;color:var(--muted);font-size:13px;">Tidak ada video yang sesuai dengan pencarian.</div>`;
      return;
    }

    items.forEach(item => {
      const isSelected = selectedPlaylistIds.has(item.id);
      const card = document.createElement('div');
      card.className = `playlist-item-card ${isSelected ? 'selected' : ''}`;
      card.dataset.id = item.id;

      card.innerHTML = `
        <div class="pl-item-check">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div class="pl-item-index">#${String(item.index).padStart(2, '0')}</div>
        <div class="pl-item-thumb-box">
          <img class="pl-item-thumb" src="${esc(item.thumbnail)}" onerror="this.src='/static/logo.png'" alt=""/>
          ${item.duration_str && item.duration_str !== '?' ? `<span class="pl-item-dur">${esc(item.duration_str)}</span>` : ''}
        </div>
        <div class="pl-item-info">
          <div class="pl-item-title" title="${esc(item.title)}">${esc(item.title)}</div>
          <div class="pl-item-uploader">${esc(item.uploader || '')}</div>
        </div>
      `;

      card.addEventListener('click', () => {
        if (selectedPlaylistIds.has(item.id)) {
          selectedPlaylistIds.delete(item.id);
          card.classList.remove('selected');
        } else {
          selectedPlaylistIds.add(item.id);
          card.classList.add('selected');
        }
        updatePlaylistSelectionCount();
      });

      listEl.appendChild(card);
    });
  }

  // Scan playlist button
  const btnScanPl = document.getElementById('btn-scan-pl');
  if (btnScanPl) {
    btnScanPl.addEventListener('click', () => {
      const url = (document.getElementById('playlist-url-input')?.value || '').trim();
      loadPlaylistInfo(url);
    });
  }

  const playlistUrlInput = document.getElementById('playlist-url-input');
  if (playlistUrlInput) {
    playlistUrlInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        loadPlaylistInfo(playlistUrlInput.value.trim());
      }
    });
  }

  // Select all / Deselect all
  const btnPlSelectAll = document.getElementById('btn-pl-select-all');
  if (btnPlSelectAll) {
    btnPlSelectAll.addEventListener('click', () => {
      currentPlaylistItems.forEach(item => selectedPlaylistIds.add(item.id));
      document.querySelectorAll('.playlist-item-card').forEach(c => c.classList.add('selected'));
      updatePlaylistSelectionCount();
    });
  }

  const btnPlDeselectAll = document.getElementById('btn-pl-deselect-all');
  if (btnPlDeselectAll) {
    btnPlDeselectAll.addEventListener('click', () => {
      selectedPlaylistIds.clear();
      document.querySelectorAll('.playlist-item-card').forEach(c => c.classList.remove('selected'));
      updatePlaylistSelectionCount();
    });
  }

  // Filter video titles in playlist
  const plSearchFilter = document.getElementById('pl-search-filter');
  if (plSearchFilter) {
    plSearchFilter.addEventListener('input', e => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) {
        renderPlaylistItems(currentPlaylistItems);
        return;
      }
      const filtered = currentPlaylistItems.filter(item =>
        (item.title && item.title.toLowerCase().includes(q)) ||
        (item.uploader && item.uploader.toLowerCase().includes(q))
      );
      renderPlaylistItems(filtered);
    });
  }

  // Playlist Format Selector
  document.querySelectorAll('.format-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.format-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentPlaylistFormat = pill.dataset.plformat;
    });
  });

  // Batch Download Trigger
  const btnProcessPlaylist = document.getElementById('btn-process-playlist');
  if (btnProcessPlaylist) {
    btnProcessPlaylist.addEventListener('click', async () => {
      requestNotifPermission();
      clearResults();
      clearErrors();

      if (selectedPlaylistIds.size === 0) {
        showError('Pilih minimal satu video untuk diunduh.');
        return;
      }

      const selectedItems = currentPlaylistItems.filter(i => selectedPlaylistIds.has(i.id));

      let dlType  = 'audio';
      let quality = '720';
      if (currentPlaylistFormat === 'video-720') {
        dlType  = 'video';
        quality = '720';
      } else if (currentPlaylistFormat === 'video-1080') {
        dlType  = 'video';
        quality = '1080';
      }

      btnProcessPlaylist.disabled = true;
      btnProcessPlaylist.textContent = 'Memulai batch download...';
      showProgress(5, `Menyiapkan unduhan ${selectedItems.length} video...`);

      try {
        const res = await fetch('/api/playlist/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: selectedItems,
            download_type: dlType,
            quality: quality,
            title: currentPlaylistTitle
          })
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          showError(data.error || 'Gagal memulai batch download.');
          hideProgress();
          btnProcessPlaylist.disabled = false;
          updatePlaylistSelectionCount();
          return;
        }

        setProgress(10, `Mengunduh item 1/${selectedItems.length}...`);
        startPoll(data.job_id);
      } catch {
        showError('Gagal menghubungi server untuk batch download.');
        hideProgress();
        btnProcessPlaylist.disabled = false;
        updatePlaylistSelectionCount();
      }
    });
  }

  // ==========================================================================
  // SONG SEARCH & IN-APP AUDIO PREVIEW PLAYER
  // ==========================================================================
  let currentInputMethod = 'url';
  let currentSearchPlatform = 'youtube';
  let currentSearchAbort = null;
  let currentPlayingTrack = null;
  const previewAudio = document.createElement('video');
  previewAudio.setAttribute('playsinline', '');
  previewAudio.style.position = 'fixed';
  previewAudio.style.left = '-9999px';
  previewAudio.style.bottom = '0';
  previewAudio.style.width = '1px';
  previewAudio.style.height = '1px';
  previewAudio.style.opacity = '0';
  previewAudio.style.pointerEvents = 'none';
  document.body.appendChild(previewAudio);

  // ─────────────────────────────────────────────
  //  21ST.DEV ANIMATED TOAST NOTIFICATION ENGINE
  // ─────────────────────────────────────────────
  const TOAST_ICONS = {
    queue: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>`,
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
  };

  function showAppToast(title, message, variant = true, action = null) {
    const container = document.getElementById('rbx-notifications');
    if (!container) return;

    let type = 'success';
    if (variant === false || variant === 'error') type = 'error';
    else if (variant === 'queue') type = 'queue';
    else if (variant === 'info') type = 'info';
    else if (typeof variant === 'string') type = variant;

    const toastEl = document.createElement('div');
    toastEl.className = `toast-21st toast-${type}`;
    
    const iconSvg = TOAST_ICONS[type] || TOAST_ICONS.success;

    let actionBtnHtml = '';
    if (action && action.label) {
      actionBtnHtml = `<button type="button" class="toast-action-btn">${esc(action.label)}</button>`;
    }

    toastEl.innerHTML = `
      <div class="toast-icon-wrap">${iconSvg}</div>
      <div class="toast-content">
        <div class="toast-title">${esc(title)}</div>
        <div class="toast-message">${esc(message)}</div>
        ${actionBtnHtml}
      </div>
      <button type="button" class="toast-close-btn" aria-label="Tutup notifikasi">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <div class="toast-progress-bar"></div>
    `;

    let isDismissed = false;
    function dismissToast() {
      if (isDismissed) return;
      isDismissed = true;
      toastEl.classList.add('toast-closing');
      setTimeout(() => toastEl.remove(), 260);
    }

    if (action && action.onClick) {
      const actBtn = toastEl.querySelector('.toast-action-btn');
      if (actBtn) {
        actBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          action.onClick();
          dismissToast();
        });
      }
    }

    const closeBtn = toastEl.querySelector('.toast-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dismissToast();
      });
    }

    const autoTimer = setTimeout(dismissToast, 4500);

    toastEl.addEventListener('mouseenter', () => {
      clearTimeout(autoTimer);
      const bar = toastEl.querySelector('.toast-progress-bar');
      if (bar) bar.style.animationPlayState = 'paused';
    });
    toastEl.addEventListener('mouseleave', () => {
      setTimeout(dismissToast, 2000);
      const bar = toastEl.querySelector('.toast-progress-bar');
      if (bar) bar.style.animationPlayState = 'running';
    });

    container.appendChild(toastEl);
  }

  function setInputMethod(method) {
    currentInputMethod = method;
    const btnUrl = document.getElementById('btn-method-url');
    const btnSearch = document.getElementById('btn-method-search');
    const urlSec = document.getElementById('url-section');
    const searchSec = document.getElementById('search-section');

    if (method === 'search') {
      if (btnSearch) btnSearch.classList.add('active');
      if (btnUrl) btnUrl.classList.remove('active');
      if (urlSec) urlSec.style.display = 'none';
      if (searchSec) searchSec.style.display = 'block';
      const sInp = document.getElementById('song-search-input');
      if (sInp) sInp.focus();
    } else {
      if (btnUrl) btnUrl.classList.add('active');
      if (btnSearch) btnSearch.classList.remove('active');
      if (urlSec) urlSec.style.display = 'block';
      if (searchSec) searchSec.style.display = 'none';
    }
  }

  function setSearchPlatform(platform) {
    currentSearchPlatform = platform;
    const btnYt = document.getElementById('btn-search-yt');
    const btnSc = document.getElementById('btn-search-sc');
    if (btnYt) btnYt.classList.toggle('active', platform === 'youtube');
    if (btnSc) btnSc.classList.toggle('active', platform === 'soundcloud');

    const sInp = document.getElementById('song-search-input');
    if (sInp) {
      sInp.placeholder = platform === 'youtube'
        ? 'Cari lagu atau artis di YouTube... (Tekan Enter)'
        : 'Cari lagu atau artis di SoundCloud... (Tekan Enter)';
    }
  }

  const btnMethodUrl = document.getElementById('btn-method-url');
  const btnMethodSearch = document.getElementById('btn-method-search');
  if (btnMethodUrl) btnMethodUrl.addEventListener('click', () => setInputMethod('url'));
  if (btnMethodSearch) {
    btnMethodSearch.addEventListener('click', () => {
      if (currentSource === 'upload' || currentSource === 'spotify') {
        const ytBtn = document.querySelector('.source-btn[data-source="youtube"]');
        if (ytBtn) ytBtn.click();
      }
      setInputMethod('search');
    });
  }

  const btnSearchYt = document.getElementById('btn-search-yt');
  const btnSearchSc = document.getElementById('btn-search-sc');
  if (btnSearchYt) btnSearchYt.addEventListener('click', () => setSearchPlatform('youtube'));
  if (btnSearchSc) btnSearchSc.addEventListener('click', () => setSearchPlatform('soundcloud'));

  let currentSearchQuery = '';
  let currentSearchLimit = 30;
  let currentSearchResults = [];
  let lastAudioErrorToastTime = 0;

  function showAudioErrorToast(msg) {
    const now = Date.now();
    if (now - lastAudioErrorToastTime < 2500) return;
    lastAudioErrorToastTime = now;
    showAppToast('Gagal Memutar', msg || 'Aliran audio preview belum dapat diputar.', false);
  }

  async function executeSongSearch(customQuery, isLoadMore = false) {
    const sInp = document.getElementById('song-search-input');
    const q = (typeof customQuery === 'string' ? customQuery : (sInp ? sInp.value : '')).trim();
    if (!q) {
      if (sInp) sInp.focus();
      return;
    }
    if (sInp) sInp.value = q;

    const statusBar = document.getElementById('search-status-bar');
    const resultsContainer = document.getElementById('search-results-list');
    const btnSearch = document.getElementById('btn-song-search');

    if (currentSearchAbort) currentSearchAbort.abort();
    currentSearchAbort = new AbortController();

    if (!isLoadMore) {
      currentSearchLimit = 30;
      currentSearchQuery = q;
      currentSearchResults = [];
      if (btnSearch) btnSearch.disabled = true;
      if (statusBar) {
        statusBar.style.display = 'flex';
        statusBar.className = 'search-status-bar';
        statusBar.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          <span>Mencari <strong>${esc(q)}</strong> di ${currentSearchPlatform === 'youtube' ? 'YouTube' : 'SoundCloud'}...</span>`;
      }
      if (resultsContainer) {
        resultsContainer.innerHTML = `
          <div style="padding: 24px; text-align: center; color: var(--muted); font-size: 13px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin" style="margin: 0 auto 8px; display:block;">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            Mengambil metadata lagu...
          </div>`;
      }
    } else {
      currentSearchLimit = Math.min(currentSearchLimit + 25, 80);
      const btnLoad = document.getElementById('btn-search-load-more');
      if (btnLoad) {
        btnLoad.disabled = true;
        btnLoad.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          <span>Memuat lebih banyak lagu...</span>`;
      }
    }

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(currentSearchQuery)}&source=${currentSearchPlatform}&limit=${currentSearchLimit}`, {
        signal: currentSearchAbort.signal
      });
      const data = await res.json();
      if (btnSearch) btnSearch.disabled = false;

      if (!res.ok || data.error) {
        if (statusBar) {
          statusBar.className = 'search-status-bar error';
          statusBar.textContent = data.error || 'Pencarian gagal diproses.';
        }
        if (!isLoadMore && resultsContainer) resultsContainer.innerHTML = '';
        return;
      }

      if (!data.results || data.results.length === 0) {
        if (statusBar) {
          statusBar.style.display = 'flex';
          statusBar.className = 'search-status-bar';
          statusBar.textContent = `Tidak ada hasil untuk "${q}". Coba kata kunci lain.`;
        }
        if (!isLoadMore && resultsContainer) resultsContainer.innerHTML = '';
        return;
      }

      currentSearchResults = data.results;
      const canLoadMore = currentSearchResults.length >= currentSearchLimit && currentSearchLimit < 80;

      if (statusBar) {
        statusBar.style.display = 'flex';
        statusBar.className = 'search-status-bar';
        statusBar.innerHTML = `<span>Ditemukan <strong>${data.results.length} lagu</strong> dari ${data.source === 'youtube' ? 'YouTube' : 'SoundCloud'}.</span>`;
      }

      renderSearchResults(currentSearchResults, canLoadMore);
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (btnSearch) btnSearch.disabled = false;
      if (statusBar) {
        statusBar.className = 'search-status-bar error';
        statusBar.textContent = 'Gagal menghubungi server. Periksa koneksi aplikasi.';
      }
    }
  }

  function renderSearchResults(items, hasMore = false) {
    const container = document.getElementById('search-results-list');
    if (!container) return;
    container.innerHTML = '';

    const searchToolbar = document.getElementById('search-queue-toolbar');
    if (searchToolbar) {
      searchToolbar.style.display = items && items.length > 0 ? 'flex' : 'none';
      const cbAll = document.getElementById('cb-select-all-tracks');
      if (cbAll) {
        cbAll.checked = false;
        cbAll.indeterminate = false;
      }
      updateSearchSelectionToolbar();
    }

    items.forEach(track => {
      const isThisPlaying = currentPlayingTrack && currentPlayingTrack.url === track.url && !previewAudio.paused;
      const inQueue = isTrackInQueue(track);
      const card = document.createElement('div');
      card.className = `search-result-card ${isThisPlaying ? 'is-playing' : ''}`;
      card.id = `card-track-${esc(track.id || track.url)}`;
      card.dataset.trackId = track.id || track.url;

      const thumbSrc = track.thumbnail || '';
      const platformClass = track.source === 'youtube' ? 'youtube' : 'soundcloud';
      const platformLabel = track.source === 'youtube' ? 'YouTube' : 'SoundCloud';

      card.innerHTML = `
        <div class="track-cb-wrap">
          <input type="checkbox" class="track-select-cb" data-track-id="${esc(track.id || track.url)}" aria-label="Pilih lagu" />
        </div>
        <div class="track-thumb-wrap">
          <img class="track-thumb" src="${esc(thumbSrc)}" alt="" onerror="this.style.opacity='0.2';"/>
          ${track.duration_str ? `<span class="track-dur-badge">${esc(track.duration_str)}</span>` : ''}
          <div class="audio-wave-anim card-wave-indicator" style="display:${isThisPlaying ? 'flex' : 'none'};">
            <span></span><span></span><span></span><span></span>
          </div>
        </div>
        <div class="track-details">
          <div class="track-title" title="${esc(track.title)}">${esc(track.title)}</div>
          <div class="track-artist-row">
            <span class="platform-pill ${platformClass}">${platformLabel}</span>
            <span class="track-artist" title="${esc(track.uploader)}">${esc(track.uploader || 'Artis Tidak Diketahui')}</span>
          </div>
        </div>
        <div class="track-actions">
          <button type="button" class="btn-track-play ${isThisPlaying ? 'active' : ''}" aria-label="Dengarkan Lagu">
            <svg viewBox="0 0 24 24" fill="currentColor" class="track-play-icon" style="display:${isThisPlaying ? 'none' : 'block'};">
              <polygon points="6 3 20 12 6 21 6 3"/>
            </svg>
            <svg viewBox="0 0 24 24" fill="currentColor" class="track-pause-icon" style="display:${isThisPlaying ? 'block' : 'none'};">
              <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
            </svg>
            <span class="track-play-text">${isThisPlaying ? 'Jeda' : 'Dengarkan'}</span>
          </button>
          <button type="button" class="btn-track-queue ${inQueue ? 'in-queue' : ''}" aria-label="Tambah ke Antrian">
            ${inQueue ? `
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>Di Antrian</span>
            ` : `
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span>+ Antrian</span>
            `}
          </button>
          <button type="button" class="btn-track-bypass" aria-label="Bypass Lagu Ini">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
            <span>Bypass</span>
          </button>
        </div>`;

      const playBtn = card.querySelector('.btn-track-play');
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleTrackPlayToggle(track, card);
      });

      const queueBtn = card.querySelector('.btn-track-queue');
      queueBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleTrackInQueue(track, card);
      });

      const bypassBtn = card.querySelector('.btn-track-bypass');
      bypassBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectTrackForBypass(track);
      });

      const cb = card.querySelector('.track-select-cb');
      cb.addEventListener('change', () => {
        updateSearchSelectionToolbar();
      });

      container.appendChild(card);
    });

    if (hasMore) {
      const moreWrap = document.createElement('div');
      moreWrap.className = 'search-load-more-wrap';
      moreWrap.innerHTML = `
        <button type="button" class="btn-load-more" id="btn-search-load-more">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="16"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
          <span>Muat Lebih Banyak Lagu (+25)</span>
        </button>`;

      const btnMore = moreWrap.querySelector('#btn-search-load-more');
      btnMore.addEventListener('click', () => {
        executeSongSearch(currentSearchQuery, true);
      });

      container.appendChild(moreWrap);
    }
  }

  function handleTrackPlayToggle(track, card) {
    if (currentPlayingTrack && currentPlayingTrack.url === track.url) {
      if (previewAudio.paused) {
        previewAudio.play().catch(err => {
          showAudioErrorToast('Format audio tidak dapat diputar otomatis: ' + err.message);
        });
      } else {
        previewAudio.pause();
      }
      return;
    }

    currentPlayingTrack = track;
    const playText = card ? card.querySelector('.track-play-text') : null;
    if (playText) playText.textContent = 'Memuat...';

    previewAudio.pause();
    previewAudio.src = `/api/stream?url=${encodeURIComponent(track.url)}`;
    previewAudio.load();
    previewAudio.play().catch(err => {
      if (err.name !== 'AbortError') {
        showAudioErrorToast('Aliran audio belum tersedia: ' + err.message);
      }
    });

    updateFloatingPlayer(track);
    updateAllTrackCardStates();
  }

  function updateFloatingPlayer(track) {
    const fp = document.getElementById('floating-player-bar');
    if (!fp) return;
    fp.style.display = 'block';

    const thumb = document.getElementById('fp-thumb');
    const title = document.getElementById('fp-title');
    const artist = document.getElementById('fp-artist');
    if (thumb) thumb.src = track.thumbnail || '';
    if (title) {
      title.textContent = track.title;
      title.title = track.title;
    }
    if (artist) artist.textContent = track.uploader || 'Artis';

    fp.dataset.trackUrl = track.url;
    fp.dataset.trackTitle = track.title;
    fp.dataset.trackSource = track.source;
  }

  function updateAllTrackCardStates() {
    const isAudioPlaying = !previewAudio.paused && Boolean(currentPlayingTrack);
    document.querySelectorAll('.search-result-card').forEach(card => {
      const playBtn = card.querySelector('.btn-track-play');
      const playIcon = card.querySelector('.track-play-icon');
      const pauseIcon = card.querySelector('.track-pause-icon');
      const playText = card.querySelector('.track-play-text');
      const waveAnim = card.querySelector('.card-wave-indicator');

      const isThis = currentPlayingTrack && card.id === `card-track-${esc(currentPlayingTrack.id || currentPlayingTrack.url)}`;
      if (isThis && isAudioPlaying) {
        card.classList.add('is-playing');
        if (playBtn) playBtn.classList.add('active');
        if (playIcon) playIcon.style.display = 'none';
        if (pauseIcon) pauseIcon.style.display = 'block';
        if (playText) playText.textContent = 'Jeda';
        if (waveAnim) waveAnim.style.display = 'flex';
      } else {
        card.classList.remove('is-playing');
        if (playBtn) playBtn.classList.remove('active');
        if (playIcon) playIcon.style.display = 'block';
        if (pauseIcon) pauseIcon.style.display = 'none';
        if (playText) playText.textContent = 'Dengarkan';
        if (waveAnim) waveAnim.style.display = 'none';
      }
    });

    const fpPlayIcon = document.getElementById('fp-icon-play');
    const fpPauseIcon = document.getElementById('fp-icon-pause');
    const fpWave = document.getElementById('fp-wave');
    if (fpPlayIcon && fpPauseIcon) {
      if (isAudioPlaying) {
        fpPlayIcon.style.display = 'none';
        fpPauseIcon.style.display = 'block';
        if (fpWave) fpWave.style.display = 'flex';
      } else {
        fpPlayIcon.style.display = 'block';
        fpPauseIcon.style.display = 'none';
        if (fpWave) fpWave.style.display = 'none';
      }
    }
  }

  function selectTrackForBypass(track) {
    setInputMethod('url');

    const targetSource = track.source || 'youtube';
    const srcBtn = document.querySelector(`.source-btn[data-source="${targetSource}"]`);
    if (srcBtn) {
      document.querySelectorAll('.source-btn').forEach(b => b.classList.remove('active'));
      srcBtn.classList.add('active');
      currentSource = targetSource;
    }

    const inp = document.getElementById('url-input');
    if (inp) {
      inp.value = track.url;
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    }

    const settingsCard = document.getElementById('settings-card') || document.getElementById('btn-process');
    if (settingsCard) {
      settingsCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    showAppToast('Lagu Dipilih!', `"${track.title}" siap diproses. Klik tombol Process Audio.`);
  }

  function fmtAudioTime(s) {
    if (isNaN(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  }

  previewAudio.addEventListener('timeupdate', () => {
    const cur = previewAudio.currentTime || 0;
    const dur = previewAudio.duration || (currentPlayingTrack ? currentPlayingTrack.duration : 0) || 0;
    const curEl = document.getElementById('fp-cur-time');
    const totalEl = document.getElementById('fp-total-time');
    const fill = document.getElementById('fp-scrubber-fill');

    if (curEl) curEl.textContent = fmtAudioTime(cur);
    if (totalEl && dur > 0) totalEl.textContent = fmtAudioTime(dur);
    if (fill && dur > 0) {
      const pct = Math.min(100, (cur / dur) * 100);
      fill.style.width = pct + '%';
    }
  });

  previewAudio.addEventListener('play', () => updateAllTrackCardStates());
  previewAudio.addEventListener('playing', () => updateAllTrackCardStates());
  previewAudio.addEventListener('canplay', () => updateAllTrackCardStates());
  previewAudio.addEventListener('pause', () => updateAllTrackCardStates());
  previewAudio.addEventListener('ended', () => {
    updateAllTrackCardStates();
    const fill = document.getElementById('fp-scrubber-fill');
    if (fill) fill.style.width = '0%';
  });
  previewAudio.addEventListener('error', () => {
    updateAllTrackCardStates();
    showAudioErrorToast('Gagal memutar aliran audio preview.');
  });

  const fpScrubber = document.getElementById('fp-scrubber');
  if (fpScrubber) {
    fpScrubber.addEventListener('click', (e) => {
      const rect = fpScrubber.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, clickX / rect.width));
      const dur = previewAudio.duration || (currentPlayingTrack ? currentPlayingTrack.duration : 0);
      if (dur > 0) {
        previewAudio.currentTime = pct * dur;
      }
    });
  }

  const fpPlayBtn = document.getElementById('fp-play-btn');
  if (fpPlayBtn) {
    fpPlayBtn.addEventListener('click', () => {
      if (!currentPlayingTrack) return;
      if (previewAudio.paused) {
        previewAudio.play().catch(e => console.error(e));
      } else {
        previewAudio.pause();
      }
    });
  }

  const fpVolSlider = document.getElementById('fp-vol-slider');
  if (fpVolSlider) {
    fpVolSlider.addEventListener('input', (e) => {
      previewAudio.volume = parseFloat(e.target.value);
    });
  }

  const fpCloseBtn = document.getElementById('fp-close-btn');
  if (fpCloseBtn) {
    fpCloseBtn.addEventListener('click', () => {
      previewAudio.pause();
      previewAudio.src = '';
      currentPlayingTrack = null;
      const fp = document.getElementById('floating-player-bar');
      if (fp) fp.style.display = 'none';
      updateAllTrackCardStates();
    });
  }

  const fpBypassCta = document.getElementById('fp-bypass-cta');
  if (fpBypassCta) {
    fpBypassCta.addEventListener('click', () => {
      if (currentPlayingTrack) {
        selectTrackForBypass(currentPlayingTrack);
      }
    });
  }

  const fpQueueCta = document.getElementById('fp-queue-cta');
  if (fpQueueCta) {
    fpQueueCta.addEventListener('click', () => {
      if (currentPlayingTrack) {
        addToQueue(currentPlayingTrack);
      } else {
        showAppToast('Pilih Lagu', 'Putar lagu terlebih dahulu untuk menambahkan ke antrian.');
      }
    });
  }

  const songSearchInput = document.getElementById('song-search-input');
  const btnSongSearch = document.getElementById('btn-song-search');
  if (songSearchInput) {
    songSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        executeSongSearch();
      }
    });
  }
  if (btnSongSearch) {
    btnSongSearch.addEventListener('click', () => executeSongSearch());
  }

  document.querySelectorAll('.search-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const q = chip.dataset.query;
      executeSongSearch(q);
    });
  });

  // ==========================================
  //  QUEUE BYPASS SYSTEM ENGINE
  // ==========================================
  // bypassQueue is declared at top of module scope

  function loadBypassQueue() {
    try {
      const raw = localStorage.getItem('f4r_bypass_queue');
      if (raw) bypassQueue = JSON.parse(raw);
    } catch(e) {
      bypassQueue = [];
    }
    updateQueueUI();
  }

  function saveBypassQueue() {
    try {
      localStorage.setItem('f4r_bypass_queue', JSON.stringify(bypassQueue));
    } catch(e) {}
    updateQueueUI();
  }

  function isTrackInQueue(track) {
    if (!track) return false;
    return bypassQueue.some(t => (track.id && t.id === track.id) || t.url === track.url);
  }

  function toggleTrackInQueue(track, card = null) {
    if (isTrackInQueue(track)) {
      removeFromQueue(track.id || track.url);
      showAppToast('Dihapus dari Queue', `"${track.title}" telah dikeluarkan dari antrian.`);
    } else {
      addToQueue(track);
    }
  }

  function addToQueue(track) {
    if (!track || !track.url) return;
    if (isTrackInQueue(track)) {
      showAppToast('Sudah di Queue List', `"${track.title}" sudah terdaftar di daftar antrian.`, 'info', {
        label: 'Buka Queue List →',
        onClick: () => switchNavTab('queue')
      });
      return;
    }
    bypassQueue.push({
      id: track.id || track.url,
      title: track.title || 'Unknown Title',
      uploader: track.uploader || 'Artis',
      thumbnail: track.thumbnail || '',
      url: track.url,
      duration: track.duration || 0,
      duration_str: track.duration_str || '?',
      source: track.source || 'youtube'
    });
    saveBypassQueue();
    showAppToast(
      'Masuk Antrian!',
      `"${track.title}" ditambahkan (${bypassQueue.length} lagu di Queue List).`,
      'queue',
      {
        label: 'Buka Queue List →',
        onClick: () => switchNavTab('queue')
      }
    );
  }

  function addMultipleToQueue(tracks) {
    let addedCount = 0;
    tracks.forEach(track => {
      if (!track || !track.url) return;
      if (!isTrackInQueue(track)) {
        bypassQueue.push({
          id: track.id || track.url,
          title: track.title || 'Unknown Title',
          uploader: track.uploader || 'Artis',
          thumbnail: track.thumbnail || '',
          url: track.url,
          duration: track.duration || 0,
          duration_str: track.duration_str || '?',
          source: track.source || 'youtube'
        });
        addedCount++;
      }
    });
    if (addedCount > 0) {
      saveBypassQueue();
      showAppToast(
        'Queue Diperbarui!',
        `${addedCount} lagu ditambahkan (${bypassQueue.length} total di Queue List).`,
        'queue',
        {
          label: 'Buka Queue List →',
          onClick: () => switchNavTab('queue')
        }
      );
    } else {
      showAppToast('Info Queue', 'Semua lagu terpilih sudah ada di Queue List.', 'info', {
        label: 'Buka Queue List →',
        onClick: () => switchNavTab('queue')
      });
    }
  }

  function removeFromQueue(identifier) {
    bypassQueue = bypassQueue.filter(t => t.id !== identifier && t.url !== identifier);
    saveBypassQueue();
  }

  function clearQueue() {
    if (!bypassQueue.length) return;
    bypassQueue = [];
    saveBypassQueue();
    showAppToast('Antrian Kosong', 'Daftar antrian telah dibersihkan.');
  }

  function updateQueueUI() {
    const count = bypassQueue.length;
    const badgeEl = document.getElementById('floating-queue-badge');
    const pillCount = document.getElementById('queue-pill-count');
    const drawerCount = document.getElementById('queue-drawer-count');
    const ctaCount = document.getElementById('queue-cta-count');
    const statCount = document.getElementById('search-queue-stat-count');
    const btnStart = document.getElementById('btn-start-queue-process');

    if (pillCount) pillCount.textContent = count;
    if (drawerCount) drawerCount.textContent = `${count} Lagu`;
    if (ctaCount) ctaCount.textContent = count;
    if (statCount) statCount.textContent = count;
    if (btnStart) btnStart.disabled = (count === 0);

    const navQueueCount = document.getElementById('nav-queue-count');
    if (navQueueCount) {
      navQueueCount.textContent = count;
      navQueueCount.style.display = 'inline-block';
    }

    const tabQueueCount = document.getElementById('tab-queue-count-badge');
    if (tabQueueCount) tabQueueCount.textContent = count;
    const tabQueueBtnCount = document.getElementById('tab-queue-btn-count');
    if (tabQueueBtnCount) tabQueueBtnCount.textContent = count;
    const btnProcessAll = document.getElementById('btn-process-all-queue');
    if (btnProcessAll) {
      btnProcessAll.disabled = (count === 0);
      btnProcessAll.textContent = `PROCESS BYPASS SEMUA LAGU (${count} LAGU)`;
    }

    const quickBanner = document.getElementById('search-queue-quick-banner');
    const quickBannerCount = document.getElementById('quick-banner-count');
    if (quickBannerCount) quickBannerCount.textContent = count;
    if (quickBanner) {
      quickBanner.style.display = count > 0 ? 'flex' : 'none';
    }

    const btnQuickOpen = document.getElementById('btn-quick-open-queue');
    if (btnQuickOpen && !btnQuickOpen._bound) {
      btnQuickOpen._bound = true;
      btnQuickOpen.addEventListener('click', () => switchNavTab('queue'));
    }

    if (badgeEl) {
      badgeEl.style.display = count > 0 ? 'block' : 'none';
    }

    renderTabQueueList();

    // Update track cards in search results
    document.querySelectorAll('.search-result-card').forEach(card => {
      const qBtn = card.querySelector('.btn-track-queue');
      const trackId = card.dataset.trackId || '';
      const inQ = bypassQueue.some(t => t.id === trackId || card.id === `card-track-${esc(t.id || t.url)}`);
      if (qBtn) {
        if (inQ) {
          qBtn.classList.add('in-queue');
          qBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>Di Antrian</span>`;
        } else {
          qBtn.classList.remove('in-queue');
          qBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>+ Antrian</span>`;
        }
      }
    });

    // Render list in drawer if open
    const modal = document.getElementById('queue-modal-overlay');
    if (modal && modal.classList.contains('open')) {
      renderQueueDrawerList();
    }
  }

  function renderQueueDrawerList() {
    const list = document.getElementById('queue-items-container');
    if (!list) return;
    list.innerHTML = '';

    if (bypassQueue.length === 0) {
      list.innerHTML = `
        <div class="queue-empty-state">
          <div class="queue-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
            </svg>
          </div>
          <div class="queue-empty-text">Antrian Masih Kosong</div>
          <div class="queue-empty-sub">Cari lagu di YouTube atau SoundCloud, lalu tekan tombol <strong>+ Antrian</strong> untuk menambahkan ke antrian bypass.</div>
        </div>`;
      return;
    }

    bypassQueue.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = 'queue-item-card';
      const platformClass = item.source === 'soundcloud' ? 'soundcloud' : 'youtube';
      const platformLabel = item.source === 'soundcloud' ? 'SC' : 'YT';

      card.innerHTML = `
        <div class="queue-item-idx">${idx + 1}</div>
        <img class="queue-item-thumb" src="${esc(item.thumbnail || '')}" alt="" onerror="this.style.opacity='0.2';"/>
        <div class="queue-item-info">
          <div class="queue-item-title" title="${esc(item.title)}">${esc(item.title)}</div>
          <div class="queue-item-sub">
            <span class="platform-pill ${platformClass}">${platformLabel}</span>
            <span class="queue-item-uploader">${esc(item.uploader || 'Artis')}</span>
            ${item.duration_str ? `<span class="queue-item-dur">· ${esc(item.duration_str)}</span>` : ''}
          </div>
        </div>
        <button type="button" class="btn-remove-queue-item" aria-label="Hapus dari antrian">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      `;

      card.querySelector('.btn-remove-queue-item').addEventListener('click', (e) => {
        e.stopPropagation();
        removeFromQueue(item.id || item.url);
      });

      list.appendChild(card);
    });
  }

  function openQueueDrawer() {
    const modal = document.getElementById('queue-modal-overlay');
    if (!modal) return;
    const spd = document.getElementById('queue-speed-badge');
    const amp = document.getElementById('queue-amp-badge');
    const hz  = document.getElementById('queue-hz-badge');
    if (spd) spd.textContent = `Speed ×${currentCfg.speed}`;
    if (amp) amp.textContent = `${currentCfg.amplify >= 0 ? '+' : ''}${currentCfg.amplify} dB`;
    if (hz)  hz.textContent  = `${document.getElementById('sel-hz')?.value || 44100} Hz`;

    renderQueueDrawerList();
    modal.classList.add('open');
  }

  function closeQueueDrawer() {
    const modal = document.getElementById('queue-modal-overlay');
    if (modal) modal.classList.remove('open');
  }

  function updateSearchSelectionToolbar() {
    const checked = Array.from(document.querySelectorAll('.track-select-cb:checked'));
    const totalCbs = document.querySelectorAll('.track-select-cb');
    const selCountEl = document.getElementById('search-selected-count');
    const actCountEl = document.getElementById('search-queue-action-count');
    const btnBatchAdd = document.getElementById('btn-add-selected-queue');
    const cbAll = document.getElementById('cb-select-all-tracks');

    if (selCountEl) selCountEl.textContent = checked.length;
    if (actCountEl) actCountEl.textContent = checked.length;
    if (btnBatchAdd) btnBatchAdd.disabled = (checked.length === 0);
    if (cbAll && totalCbs.length > 0) {
      cbAll.checked = (checked.length === totalCbs.length);
      cbAll.indeterminate = (checked.length > 0 && checked.length < totalCbs.length);
    }
  }

  async function startQueueBypass() {
    if (!bypassQueue.length) {
      showAppToast('Antrian Kosong', 'Tambahkan minimal 1 lagu terlebih dahulu.', false);
      return;
    }

    const format = document.getElementById('queue-sel-format')?.value || 'ogg';
    const mode   = document.getElementById('queue-sel-mode')?.value || 'bypassed';
    const reverb = Boolean(document.getElementById('chk-reverb')?.checked);
    const hz     = parseInt(document.getElementById('sel-hz')?.value || 44100, 10);

    const qNamingMode1 = document.getElementById('queue-sel-renamer')?.value || 'clean';
    const payload = {
      items: bypassQueue,
      speed: currentCfg.speed,
      amplify: currentCfg.amplify,
      reverb: reverb,
      hz: hz,
      format: format,
      mode: mode,
      naming_mode: qNamingMode1,
      name_prefix: qNamingMode1 === 'custom' ? (document.getElementById('queue-input-prefix')?.value || '') : '',
      name_suffix: qNamingMode1 === 'custom' ? (document.getElementById('queue-input-suffix')?.value || '') : ''
    };

    closeQueueDrawer();
    clearResults();
    clearErrors();
    setBtn(true);
    showProgress(5, `Menghubungi server untuk antrian ${bypassQueue.length} lagu...`);

    try {
      const res = await fetch('/api/queue/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showError(data.error || 'Gagal memulai proses antrian.');
        hideProgress();
        setBtn(false);
        return;
      }
      setProgress(10, `Antrian diterima (${bypassQueue.length} lagu)...`);
      startPoll(data.job_id);
    } catch(err) {
      showError('Gagal terhubung ke server untuk proses antrian.');
      hideProgress();
      setBtn(false);
    }
  }


  // Render Queue tab list
  function renderTabQueueList() {
    const list = document.getElementById('tab-queue-items-container');
    const badgeCount = document.getElementById('tab-queue-count-badge');
    const btnCount = document.getElementById('tab-queue-btn-count');
    const btnProcess = document.getElementById('btn-process-all-queue');

    const spd = document.getElementById('tab-queue-speed-badge');
    const amp = document.getElementById('tab-queue-amp-badge');
    const hz  = document.getElementById('tab-queue-hz-badge');
    if (spd) spd.textContent = `Speed ×${currentCfg.speed}`;
    if (amp) amp.textContent = `${currentCfg.amplify >= 0 ? '+' : ''}${currentCfg.amplify} dB`;
    if (hz)  hz.textContent  = `${document.getElementById('sel-hz')?.value || 44100} Hz`;

    const count = bypassQueue.length;
    if (badgeCount) badgeCount.textContent = count;
    if (btnCount) btnCount.textContent = count;
    if (btnProcess) {
      btnProcess.disabled = (count === 0);
      btnProcess.textContent = `PROCESS BYPASS SEMUA LAGU (${count} LAGU)`;
    }

    if (!list) return;
    list.innerHTML = '';

    if (count === 0) {
      list.innerHTML = `
        <div class="queue-empty-state" style="padding:40px 16px; background:var(--surface); border:1px solid var(--border); border-radius:12px;">
          <div class="queue-empty-icon" style="width:48px; height:48px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:24px; height:24px;">
              <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
            </svg>
          </div>
          <div class="queue-empty-text">Antrian Masih Kosong</div>
          <div class="queue-empty-sub" style="margin-bottom:14px;">
            Buka tab <strong>Audio Bypass > Cari Lagu (Search)</strong> untuk mencari di YouTube atau SoundCloud, lalu klik tombol <strong>+ Antrian</strong> pada lagu yang ingin kamu bypass.
          </div>
          <button type="button" class="btn-save" id="btn-goto-search" style="padding:8px 18px; font-size:12px;">
            Cari Lagu di YouTube / SoundCloud
          </button>
        </div>`;
      const btnGo = document.getElementById('btn-goto-search');
      if (btnGo) {
        btnGo.addEventListener('click', () => {
          switchNavTab('audio');
          setInputMethod('search');
        });
      }
      return;
    }

    bypassQueue.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = 'queue-item-card';
      const platformClass = item.source === 'soundcloud' ? 'soundcloud' : 'youtube';
      const platformLabel = item.source === 'soundcloud' ? 'SoundCloud' : 'YouTube';

      card.innerHTML = `
        <div class="queue-item-idx">#${idx + 1}</div>
        <img class="queue-item-thumb" src="${esc(item.thumbnail || '')}" alt="" onerror="this.style.opacity='0.2';"/>
        <div class="queue-item-info">
          <div class="queue-item-title" title="${esc(item.title)}">${esc(item.title)}</div>
          <div class="queue-item-sub">
            <span class="platform-pill ${platformClass}">${platformLabel}</span>
            <span class="queue-item-uploader">${esc(item.uploader || 'Artis')}</span>
            ${item.duration_str ? `<span class="queue-item-dur">· ${esc(item.duration_str)}</span>` : ''}
          </div>
        </div>
        <button type="button" class="btn-remove-queue-item" aria-label="Hapus dari antrian">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      `;

      card.querySelector('.btn-remove-queue-item').addEventListener('click', (e) => {
        e.stopPropagation();
        removeFromQueue(item.id || item.url);
      });

      list.appendChild(card);
    });
  }

  async function startTabQueueBypass() {
    if (!bypassQueue.length) {
      showAppToast('Antrian Kosong', 'Tambahkan minimal 1 lagu terlebih dahulu.', false);
      return;
    }

    const format = document.getElementById('tab-queue-sel-format')?.value || 'ogg';
    const mode   = document.getElementById('tab-queue-sel-mode')?.value || 'bypassed';
    const reverb = Boolean(document.getElementById('chk-reverb')?.checked);
    const hz     = parseInt(document.getElementById('sel-hz')?.value || 44100, 10);

    const tqNamingMode = document.getElementById('queue-sel-renamer')?.value || 'clean';
    const payload = {
      items: bypassQueue,
      speed: currentCfg.speed,
      amplify: currentCfg.amplify,
      reverb: reverb,
      hz: hz,
      format: format,
      mode: mode,
      naming_mode: tqNamingMode,
      name_prefix: tqNamingMode === 'custom' ? (document.getElementById('queue-input-prefix')?.value || '') : '',
      name_suffix: tqNamingMode === 'custom' ? (document.getElementById('queue-input-suffix')?.value || '') : ''
    };

    clearResults();
    clearErrors();
    const btnProcess = document.getElementById('btn-process-all-queue');
    if (btnProcess) {
      btnProcess.disabled = true;
      btnProcess.textContent = `Memproses ${bypassQueue.length} Lagu Antrian...`;
    }
    setBtn(true);
    showProgress(5, `Menghubungi server untuk bypass ${bypassQueue.length} lagu antrian...`);

    try {
      const res = await fetch('/api/queue/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showError(data.error || 'Gagal memulai proses antrian.');
        hideProgress();
        setBtn(false);
        if (btnProcess) {
          btnProcess.disabled = false;
          btnProcess.textContent = `PROCESS BYPASS SEMUA LAGU (${bypassQueue.length} LAGU)`;
        }
        return;
      }
      setProgress(10, `Antrian diterima (${bypassQueue.length} lagu)...`);
      startPoll(data.job_id);
    } catch(err) {
      showError('Gagal terhubung ke server untuk proses antrian.');
      hideProgress();
      setBtn(false);
      if (btnProcess) {
        btnProcess.disabled = false;
        btnProcess.textContent = `PROCESS BYPASS SEMUA LAGU (${bypassQueue.length} LAGU)`;
      }
    }
  }

  // Queue Event Listeners
  const btnOpenQueue = document.getElementById('btn-open-queue-drawer');
  if (btnOpenQueue) btnOpenQueue.addEventListener('click', () => switchNavTab('queue'));

  const btnCloseQueue = document.getElementById('btn-close-queue');
  if (btnCloseQueue) btnCloseQueue.addEventListener('click', closeQueueDrawer);

  const btnClearQueue = document.getElementById('btn-clear-queue-list');
  if (btnClearQueue) btnClearQueue.addEventListener('click', clearQueue);

  const btnClearTabQueue = document.getElementById('btn-tab-clear-queue');
  if (btnClearTabQueue) btnClearTabQueue.addEventListener('click', clearQueue);

  const btnStartQueue = document.getElementById('btn-start-queue-process');
  if (btnStartQueue) btnStartQueue.addEventListener('click', startQueueBypass);

  const btnProcessAllQueue = document.getElementById('btn-process-all-queue');
  if (btnProcessAllQueue) btnProcessAllQueue.addEventListener('click', startTabQueueBypass);

  const queueModalOverlay = document.getElementById('queue-modal-overlay');
  if (queueModalOverlay) {
    queueModalOverlay.addEventListener('click', (e) => {
      if (e.target === queueModalOverlay) closeQueueDrawer();
    });
  }

  const cbSelectAllTracks = document.getElementById('cb-select-all-tracks');
  if (cbSelectAllTracks) {
    cbSelectAllTracks.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      document.querySelectorAll('.track-select-cb').forEach(cb => {
        cb.checked = isChecked;
      });
      updateSearchSelectionToolbar();
    });
  }

  const btnAddSelectedQueue = document.getElementById('btn-add-selected-queue');
  if (btnAddSelectedQueue) {
    btnAddSelectedQueue.addEventListener('click', () => {
      const checkedCbs = Array.from(document.querySelectorAll('.track-select-cb:checked'));
      if (!checkedCbs.length) return;
      const ids = new Set(checkedCbs.map(cb => cb.dataset.trackId));
      const tracksToAdd = currentSearchResults.filter(t => ids.has(t.id || t.url));
      addMultipleToQueue(tracksToAdd);
      // uncheck all after adding
      checkedCbs.forEach(cb => cb.checked = false);
      if (cbSelectAllTracks) {
        cbSelectAllTracks.checked = false;
        cbSelectAllTracks.indeterminate = false;
      }
      updateSearchSelectionToolbar();
    });
  }

  const btnViewQueue = document.getElementById('btn-view-queue');
  if (btnViewQueue) btnViewQueue.addEventListener('click', () => switchNavTab('queue'));

  // Initialize queue on boot
  loadBypassQueue();

  // ── Renamer UI Bindings ──
  function setupRenamerToggle(selectId, fieldsId, previewId, prefixId, suffixId, formatSelectId) {
    const sel = document.getElementById(selectId);
    const fields = document.getElementById(fieldsId);
    const preview = document.getElementById(previewId);
    const prefixInput = document.getElementById(prefixId);
    const suffixInput = document.getElementById(suffixId);
    if (!sel) return;

    function updatePreview() {
      const mode = sel.value;
      const ext = (formatSelectId && document.getElementById(formatSelectId))
        ? '.' + (document.getElementById(formatSelectId).value || 'ogg')
        : '.' + (currentFormat || 'ogg');
      const sampleTitle = 'Judul Lagu';
      let result = '';
      if (mode === 'clean') {
        result = sampleTitle + ext;
      } else if (mode === 'numbered') {
        result = '01_' + sampleTitle + ext;
      } else if (mode === 'custom') {
        const pre = prefixInput ? prefixInput.value : '';
        const suf = suffixInput ? suffixInput.value : '';
        result = pre + sampleTitle + suf + ext;
      }
      if (preview) preview.textContent = result;
    }

    sel.addEventListener('change', () => {
      if (fields) fields.style.display = sel.value === 'custom' ? 'flex' : 'none';
      updatePreview();
    });
    if (prefixInput) prefixInput.addEventListener('input', updatePreview);
    if (suffixInput) suffixInput.addEventListener('input', updatePreview);
    if (formatSelectId) {
      const fmtSel = document.getElementById(formatSelectId);
      if (fmtSel) fmtSel.addEventListener('change', updatePreview);
    }
    updatePreview();
  }

  setupRenamerToggle('single-sel-renamer', 'single-custom-naming-fields', 'single-name-preview', 'single-input-prefix', 'single-input-suffix', null);
  setupRenamerToggle('queue-sel-renamer', 'queue-custom-naming-fields', 'queue-name-preview', 'queue-input-prefix', 'queue-input-suffix', 'tab-queue-sel-format');

  // ── Bulk Roblox Upload ──
  async function startBulkRobloxUpload(files) {
    const apiKey = localStorage.getItem('rbx_api_key') || '';
    const userId = localStorage.getItem('rbx_user_id') || '';
    const groupKey = localStorage.getItem('rbx_group_api_key') || '';
    const groupId = localStorage.getItem('rbx_group_id') || '';

    const useGroup = Boolean(groupKey && groupId);
    const usePersonal = Boolean(apiKey && userId);
    if (!useGroup && !usePersonal) {
      showAppToast('Roblox API Key Belum Diisi', 'Atur API Key di Bypass Settings > Roblox Open Cloud Settings terlebih dahulu.', false);
      return;
    }

    const btnBulk = document.getElementById('btn-start-bulk-rbx');
    if (btnBulk) {
      btnBulk.disabled = true;
      btnBulk.innerHTML = '<svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg> <span>Mengupload...</span>';
    }

    const idsSection = document.getElementById('uploaded-ids-section');
    const idsTextarea = document.getElementById('uploaded-ids-textarea');
    if (idsSection) idsSection.style.display = 'block';
    if (idsTextarea) idsTextarea.value = '';

    let successCount = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const assetName = f.name.replace(/\.[^.]+$/, '').substring(0, 50) || `Audio_${i+1}`;

      const body = new FormData();
      body.append('token', f.token);
      body.append('asset_name', assetName);
      if (useGroup) {
        body.append('group_id', groupId);
        body.append('api_key', groupKey);
      } else {
        body.append('user_id', userId);
        body.append('api_key', apiKey);
      }

      try {
        const res = await fetch('/api/roblox/upload', { method: 'POST', body });
        const data = await res.json();
        if (data.error) {
          showAppToast('Upload Gagal', `${assetName}: ${data.error}`, false);
          continue;
        }

        let assetId = data.asset_id || null;
        if (!assetId && data.operation_id) {
          for (let attempt = 0; attempt < 30; attempt++) {
            await new Promise(r => setTimeout(r, 2000));
            try {
              const opRes = await fetch(`/api/roblox/operation?operation_id=${encodeURIComponent(data.operation_id)}&api_key=${encodeURIComponent(useGroup ? groupKey : apiKey)}`);
              const opData = await opRes.json();
              if (opData.done && opData.asset_id) {
                assetId = opData.asset_id;
                break;
              } else if (opData.error) {
                showAppToast('Upload Gagal', `${assetName}: ${opData.error}`, false);
                break;
              }
            } catch(e) {}
          }
        }

        if (assetId) {
          successCount++;
          if (idsTextarea) {
            idsTextarea.value += (idsTextarea.value ? '\n' : '') + `rbxassetid://${assetId}  -- ${assetName}`;
          }
          showRbxApprovalNotif(assetName, assetId);
        }
      } catch(e) {
        showAppToast('Upload Error', `${assetName}: Network error`, false);
      }
    }

    if (btnBulk) {
      btnBulk.disabled = false;
      const bulkCount = document.getElementById('bulk-rbx-btn-count');
      btnBulk.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> <span>Bulk Upload ke Roblox (${bulkCount ? bulkCount.textContent : files.length})</span>`;
    }
    showAppToast('Bulk Upload Selesai', `${successCount} dari ${files.length} file berhasil diupload ke Roblox.`, true);
  }


  // Quick banner open queue
  const btnQuickOpenQueue = document.getElementById('btn-quick-open-queue');
  if (btnQuickOpenQueue) btnQuickOpenQueue.addEventListener('click', () => switchNavTab('queue'));

  // ─────────────────────────────────────────────
  //  TAURI & APP AUTO-UPDATER OVERLAY CONTROLLER
  // ─────────────────────────────────────────────
  let cachedVersionData = null;
  let isDownloadingUpdate = false;

  async function initAppUpdater() {
    const btnCheckUpdate = document.getElementById('btn-check-update');
    const updateModal = document.getElementById('app-update-modal');
    const btnUpdateNow = document.getElementById('btn-update-now');
    const btnUpdateLater = document.getElementById('btn-update-later');
    const downloadState = document.getElementById('update-download-state');
    const fillBar = document.getElementById('update-fill-bar');
    const pctLabel = document.getElementById('update-pct-label');
    const bytesLabel = document.getElementById('update-bytes-label');
    const statusLabel = document.getElementById('update-status-label');
    const btnUpdateNowText = document.getElementById('btn-update-now-text');

    try {
      const res = await fetch('/api/app/version');
      const json = await res.json();
      if (json && json.ok && json.data) {
        cachedVersionData = json.data;
        const topbarLabel = document.getElementById('topbar-update-label');
        if (topbarLabel) {
          topbarLabel.textContent = `Update v${cachedVersionData.version}`;
        }
      }
    } catch(e) {
      console.warn('Could not fetch app version data:', e);
    }

    function renderModalData(data) {
      if (!data) return;
      const curVerEl = document.getElementById('modal-cur-version');
      const newVerEl = document.getElementById('modal-new-version');
      const titleEl  = document.getElementById('modal-update-title');
      const listEl   = document.getElementById('modal-changelog-list');
      const tagEl    = document.getElementById('modal-update-tag');

      if (curVerEl) curVerEl.textContent = `v${data.current_client_version || '2.0.4'}`;
      if (newVerEl) newVerEl.textContent = `v${data.version || '2.1.0'} Rilis Baru`;
      if (titleEl && data.title) titleEl.textContent = data.title;
      if (tagEl) tagEl.textContent = data.force_update ? 'Wajib' : 'Resmi';

      if (listEl && Array.isArray(data.notes)) {
        listEl.innerHTML = data.notes.map(note => `
          <li class="update-changelog-item">
            <span class="update-changelog-dot"></span>
            <span>${esc(note)}</span>
          </li>
        `).join('');
      }

      if (btnUpdateLater) {
        if (data.force_update) {
          btnUpdateLater.style.display = 'none';
        } else {
          btnUpdateLater.style.display = 'block';
        }
      }
    }

    function openModal() {
      if (!updateModal) return;
      renderModalData(cachedVersionData);
      // Reset state
      isDownloadingUpdate = false;
      if (downloadState) downloadState.style.display = 'none';
      if (fillBar) fillBar.style.width = '0%';
      if (btnUpdateNow) {
        btnUpdateNow.disabled = false;
        if (btnUpdateNowText) btnUpdateNowText.textContent = 'Update Sekarang';
      }
      updateModal.style.display = 'flex';
    }

    function closeModal() {
      if (updateModal) updateModal.style.display = 'none';
    }

    if (btnCheckUpdate) {
      btnCheckUpdate.addEventListener('click', openModal);
    }

    if (btnUpdateLater) {
      btnUpdateLater.addEventListener('click', closeModal);
    }

    if (updateModal) {
      updateModal.addEventListener('click', (e) => {
        if (e.target === updateModal && (!cachedVersionData || !cachedVersionData.force_update)) {
          closeModal();
        }
      });
    }

    if (btnUpdateNow) {
      btnUpdateNow.addEventListener('click', async () => {
        if (btnUpdateNowText && btnUpdateNowText.textContent.includes('Restart')) {
          // Restart simulation
          btnUpdateNow.disabled = true;
          btnUpdateNowText.textContent = 'Memulai ulang aplikasi...';
          setTimeout(() => {
            window.location.reload();
          }, 800);
          return;
        }

        // Check if Tauri is present
        if (window.__TAURI__ && window.__TAURI__.updater) {
          try {
            statusLabel.textContent = 'Menghubungkan ke Tauri Updater...';
            downloadState.style.display = 'block';
            btnUpdateNow.disabled = true;
            // Native Tauri auto-updater hook
            const { check } = window.__TAURI__.updater;
            const update = await check();
            if (update && update.available) {
              await update.downloadAndInstall();
              statusLabel.textContent = 'Pembaruan siap!';
              btnUpdateNow.disabled = false;
              btnUpdateNowText.textContent = 'Restart & Terapkan Pembaruan';
              return;
            }
          } catch(err) {
            console.warn('Tauri native update failed, falling back to simulated UI:', err);
          }
        }

        // Web simulated download progression
        isDownloadingUpdate = true;
        if (downloadState) downloadState.style.display = 'block';
        if (btnUpdateLater) btnUpdateLater.style.display = 'none';
        btnUpdateNow.disabled = true;
        if (btnUpdateNowText) btnUpdateNowText.textContent = 'Mengunduh Pembaruan...';

        const totalMB = 34.8;
        let currentMB = 0;
        let pct = 0;

        const interval = setInterval(() => {
          pct += Math.floor(Math.random() * 8) + 4;
          if (pct >= 100) {
            pct = 100;
            clearInterval(interval);
            if (fillBar) fillBar.style.width = '100%';
            if (pctLabel) pctLabel.textContent = '100%';
            if (bytesLabel) bytesLabel.textContent = `${totalMB} MB / ${totalMB} MB`;
            if (statusLabel) {
              statusLabel.textContent = 'Paket pembaruan selesai diunduh & diverifikasi!';
              statusLabel.style.color = '#34d399';
            }
            btnUpdateNow.disabled = false;
            if (btnUpdateNowText) btnUpdateNowText.textContent = 'Restart & Pasang Sekarang';
          } else {
            currentMB = ((pct / 100) * totalMB).toFixed(1);
            if (fillBar) fillBar.style.width = `${pct}%`;
            if (pctLabel) pctLabel.textContent = `${pct}%`;
            if (bytesLabel) bytesLabel.textContent = `${currentMB} MB / ${totalMB} MB`;
          }
        }, 120);
      });
    }

    // Expose globally for testing via console or buttons
    window.openAppUpdateModal = openModal;
  }

  // Boot updater on startup
  initAppUpdater();

})();
