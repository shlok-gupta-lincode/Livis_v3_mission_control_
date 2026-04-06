/* ══════════════════════════════════════════════════════════════════════
   modals.js — All modal controllers (Bootstrap 5 Modal API)
   ══════════════════════════════════════════════════════════════════════ */

const Modals = {

  // ── OTA Update Modal ─────────────────────────────────────────────────
  _otaLineId: null,
  _releases: [],
  _releasesLoaded: false,

  async loadReleases() {
    if (this._releasesLoaded) return;
    try {
      const res = await Api.get('/api/releases');
      this._releases = res.releases || [];
    } catch { this._releases = []; }
    this._releasesLoaded = true;
  },

  async openOTA(lineId) {
    await this.loadReleases();
    this._otaLineId = lineId;
    document.getElementById('ota-line-id').textContent = lineId;

    const currentImage = Fleet.cardStatus[lineId]?.ota_telemetry?.current_image || 'None';
    let inferredRepo = '';
    if (currentImage && currentImage !== 'None' && currentImage.includes(':')) {
      inferredRepo = currentImage.split(':')[0];
    }

    const body = document.getElementById('ota-body');
    body.innerHTML = this._otaFormHTML(inferredRepo);
    this._populateReleaseSelect('ota-release-select', 'ota-tag');
    bootstrap.Modal.getOrCreateInstance(document.getElementById('otaModal')).show();
  },

  _otaFormHTML(repo) {
    return `
      <form id="ota-form">
        <div class="mb-3">
          <label class="form-label text-slate-500" style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;">Image Repository</label>
          <input type="text" class="form-control" id="ota-repo" value="${repo}" placeholder="e.g., username/repo">
        </div>
        <div class="mb-3">
          <label class="form-label text-slate-500" style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;">Target Tag</label>
          <select class="form-select" id="ota-release-select"><option value="" disabled selected>— Select a release —</option></select>
          <input type="text" class="form-control mt-2" id="ota-tag" placeholder="e.g., v5 or latest" style="display:none;">
          <div id="ota-release-details" class="mt-2"></div>
        </div>
        <div class="row g-3 mb-3">
          <div class="col-6">
            <label class="form-label text-slate-500" style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;">Docker User</label>
            <input type="text" class="form-control" id="ota-user" placeholder="Username">
          </div>
          <div class="col-6">
            <label class="form-label text-slate-500" style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;">Access Token</label>
            <input type="password" class="form-control" id="ota-token" placeholder="dckr_pat_...">
          </div>
        </div>
        <p class="text-slate-500 fst-italic mb-3" style="font-size:12px;">Credentials are ephemeral and will not be stored.</p>
        <button type="submit" class="btn-primary-glow w-100"><i class="bi bi-cloud-upload"></i> Deploy Update</button>
      </form>`;
  },

  _populateReleaseSelect(selectId, tagInputId) {
    const select = document.getElementById(selectId);
    const tagInput = document.getElementById(tagInputId);
    this._releases.forEach(r => {
      const opt = document.createElement('option');
      opt.value = `${r.version}::${r.channel}`;
      opt.textContent = `${r.version} (${r.channel}) — ${r.image_tag}`;
      select.appendChild(opt);
    });
    const customOpt = document.createElement('option');
    customOpt.value = '__custom__';
    customOpt.textContent = '✏ Custom tag…';
    select.appendChild(customOpt);

    select.addEventListener('change', () => {
      if (select.value === '__custom__') {
        tagInput.style.display = '';
        tagInput.value = '';
        const detailsEl = document.getElementById(selectId.replace('-select', '-release-details')) || document.getElementById('ota-release-details');
        if (detailsEl) detailsEl.innerHTML = '';
      } else {
        const rel = this._releases.find(r => `${r.version}::${r.channel}` === select.value);
        tagInput.style.display = 'none';
        if (rel) {
          tagInput.value = rel.image_tag;
          const detailsEl = document.getElementById(selectId.replace('-select', '-release-details')) || document.getElementById('ota-release-details');
          if (detailsEl) detailsEl.innerHTML = this._releaseDetailsHTML(rel);
        }
      }
    });
  },

  _releaseDetailsHTML(r) {
    if (!r) return '';
    const channelColors = { stable: '#10b981', rc: '#f59e0b', beta: '#6366f1', alpha: '#ef4444' };
    const cc = channelColors[r.channel] || '#94a3b8';
    let html = `<div class="p-3 rounded-3" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);font-size:12px;">
      <div class="d-flex align-items-center gap-2 flex-wrap mb-2">
        <span class="fw-bold text-slate-200">${r.version}</span>
        <span class="badge-status" style="background:${cc}22;color:${cc};border-color:${cc}44;font-size:10px;padding:2px 8px;">${r.channel}</span>
        <span class="text-slate-500">by ${r.published_by}</span>
        ${r.rollout_percent != null ? `<span class="ms-auto text-indigo fw-semibold">🎯 Rollout ${r.rollout_percent}%</span>` : ''}
      </div>`;
    if (r.features?.length) html += `<p class="text-emerald fw-semibold mb-1" style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;">New Features</p><ul class="text-slate-400 ps-3 mb-2">${r.features.map(f => `<li>${f}</li>`).join('')}</ul>`;
    if (r.bug_fixes?.length) html += `<p class="text-blue fw-semibold mb-1" style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;">Bug Fixes</p><ul class="text-slate-400 ps-3 mb-2">${r.bug_fixes.map(f => `<li>${f}</li>`).join('')}</ul>`;
    if (r.breaking_changes?.length) html += `<p class="text-red fw-semibold mb-1" style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;">Breaking Changes</p><ul class="ps-3 mb-2" style="color:#fca5a5;">${r.breaking_changes.map(f => `<li>${f}</li>`).join('')}</ul>`;
    if (r.notes) html += `<p class="text-slate-500 fst-italic mb-0">${r.notes}</p>`;
    return html + '</div>';
  },

  // ── Bulk Update Modal ────────────────────────────────────────────────
  async openBulk(lineIds) {
    await this.loadReleases();
    const body = document.getElementById('bulk-body');
    body.innerHTML = `
      <form id="bulk-form">
        <div class="mb-3">
          <label class="form-label text-slate-500" style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;">Image Repository</label>
          <input type="text" class="form-control" id="bulk-repo" value="deepanshuvishwakarma/edge_poc" placeholder="e.g., username/repo">
        </div>
        <div class="mb-3">
          <label class="form-label text-slate-500" style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;">Target Tag</label>
          <select class="form-select" id="bulk-release-select"><option value="" disabled selected>— Select a release —</option></select>
          <input type="text" class="form-control mt-2" id="bulk-tag" placeholder="e.g., v5" style="display:none;">
          <div id="bulk-release-details" class="mt-2"></div>
        </div>
        <div class="row g-3 mb-3">
          <div class="col-6">
            <label class="form-label text-slate-500" style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;">Docker User</label>
            <input type="text" class="form-control" id="bulk-user" placeholder="Username">
          </div>
          <div class="col-6">
            <label class="form-label text-slate-500" style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;">Access Token</label>
            <input type="password" class="form-control" id="bulk-token" placeholder="dckr_pat_...">
          </div>
        </div>
        <p class="text-slate-500 fst-italic mb-3" style="font-size:12px;">Workstations already on target image will be skipped. Credentials are ephemeral.</p>
        <button type="submit" class="btn-primary-glow w-100"><i class="bi bi-cloud-upload"></i> Deploy to All Workstations</button>
      </form>
      <div id="bulk-progress" style="display:none;"></div>`;

    this._populateReleaseSelect('bulk-release-select', 'bulk-tag');

    setTimeout(() => {
      document.getElementById('bulk-form').addEventListener('submit', (e) => {
        e.preventDefault();
        this._runBulkUpdate(lineIds);
      });
    }, 100);

    bootstrap.Modal.getOrCreateInstance(document.getElementById('bulkModal')).show();
  },

  async _runBulkUpdate(lineIds) {
    const repo  = document.getElementById('bulk-repo').value;
    const tag   = document.getElementById('bulk-tag').value || document.getElementById('bulk-release-select').selectedOptions[0]?.dataset?.tag;
    const user  = document.getElementById('bulk-user').value;
    const token = document.getElementById('bulk-token').value;
    const actualTag = document.getElementById('bulk-tag').style.display !== 'none' ? document.getElementById('bulk-tag').value : (this._releases.find(r => `${r.version}::${r.channel}` === document.getElementById('bulk-release-select').value)?.image_tag || '');

    if (!actualTag || !user || !token) return;

    document.getElementById('bulk-form').style.display = 'none';
    const progress = document.getElementById('bulk-progress');
    progress.style.display = '';

    const targetImage = `${repo}:${actualTag}`;
    const formData = { image_repo: repo, new_tag: actualTag, temp_username: user, temp_token: token };

    let html = '';
    const results = lineIds.map(id => ({ lineId: id, state: 'pending', message: '' }));

    const renderProgress = () => {
      progress.innerHTML = results.map(r => {
        const icons = { pending: 'bi-dash-circle text-slate-500', checking: 'bi-arrow-repeat spin text-blue', skipped: 'bi-dash-circle text-slate-500', updating: 'bi-arrow-repeat spin text-amber', success: 'bi-check-circle-fill text-emerald', error: 'bi-exclamation-circle-fill text-red' };
        const bgs = { success: 'rgba(16,185,129,0.05)', error: 'rgba(239,68,68,0.05)', updating: 'rgba(245,158,11,0.05)' };
        return `<div class="d-flex align-items-start gap-3 p-3 rounded-3 mb-2" style="border:1px solid var(--border-subtle);background:${bgs[r.state] || 'rgba(255,255,255,0.02)'};">
          <i class="bi ${icons[r.state] || icons.pending}" style="font-size:16px;flex-shrink:0;margin-top:2px;"></i>
          <div class="flex-grow-1 min-w-0">
            <div class="d-flex justify-content-between"><span class="fw-bold text-slate-200" style="font-size:12px;">Workstation ${r.lineId}</span></div>
            ${r.message ? `<p class="font-mono text-truncate mb-0 mt-1 ${r.state === 'error' ? 'text-red' : 'text-slate-500'}" style="font-size:10px;">${r.message}</p>` : ''}
          </div>
        </div>`;
      }).join('');
    };

    renderProgress();

    for (let i = 0; i < lineIds.length; i++) {
      const lineId = lineIds[i];
      results[i].state = 'checking';
      renderProgress();

      let currentImage = null;
      try {
        const res = await Api.get(`/api/system/status/${lineId}`);
        currentImage = res.ota_telemetry?.current_image || null;
      } catch {}

      if (currentImage === targetImage) {
        results[i] = { lineId, state: 'skipped', message: 'Already on target image' };
        renderProgress();
        continue;
      }

      results[i].state = 'updating';
      results[i].message = 'Pulling and deploying...';
      renderProgress();

      try {
        const res = await Api.post(`/api/container/update/${lineId}`, formData);
        results[i] = { lineId, state: 'success', message: res.message || `Updated to ${actualTag}` };
      } catch (err) {
        results[i] = { lineId, state: 'error', message: Api.errorDetail(err) };
      }
      renderProgress();
    }

    progress.innerHTML += `<button class="btn-ghost w-100 mt-3" data-bs-dismiss="modal">Close</button>`;
  },

  // ── Add Line Modal ───────────────────────────────────────────────────
  openAddLine(unusedLicenses, activeLines) {
    const body = document.getElementById('addline-body');
    const hasUnused = unusedLicenses.length > 0;

    body.innerHTML = `
      <form id="addline-form">
        <!-- Step 1: License -->
        <div class="mb-4">
          <p class="d-flex align-items-center gap-2 mb-2" style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;">
            <span class="d-inline-flex align-items-center justify-content-center rounded-circle" style="width:16px;height:16px;font-size:9px;font-weight:700;background:rgba(59,130,246,0.20);color:#60a5fa;">1</span>
            Select License
          </p>
          <div class="drop-zone" id="addline-dropzone">
            <i class="bi bi-cloud-upload text-slate-500" style="font-size:24px;"></i>
            <span class="text-slate-400 fw-medium" style="font-size:12px;">Drop .livis file here or click to browse</span>
            <input type="file" accept=".livis" id="addline-file" style="display:none;">
          </div>
          <div id="addline-upload-error" class="alert-banner red mt-2" style="display:none;"></div>
          <div id="addline-lic-summary" style="display:none;" class="mt-2 p-3 rounded-3" style="background:rgba(16,185,129,0.07);border:1px solid rgba(16,185,129,0.20);"></div>
          ${hasUnused ? `
          <div class="mt-2">
            <p style="font-size:9px;text-transform:uppercase;letter-spacing:0.05em;color:#475569;margin-bottom:6px;">Or select from available (${unusedLicenses.length})</p>
            <div style="max-height:128px;overflow-y:auto;" id="addline-unused-list">
              ${unusedLicenses.map(l => `
                <button type="button" class="btn w-100 text-start p-2 rounded-3 mb-1 addline-lic-btn" data-lic-id="${l.license_id}" style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);">
                  <div class="d-flex align-items-center gap-2">
                    <i class="bi bi-shield text-slate-500" style="font-size:12px;"></i>
                    <span class="fw-semibold text-slate-300" style="font-size:11px;">${l.client_name || 'License'}</span>
                    <span class="font-mono text-slate-600 ms-auto" style="font-size:10px;">${l.license_id?.slice(0,8)}...</span>
                  </div>
                </button>`).join('')}
            </div>
          </div>` : ''}
        </div>

        <!-- Step 2: Line ID -->
        <div class="mb-4">
          <p class="d-flex align-items-center gap-2 mb-2" style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;">
            <span class="d-inline-flex align-items-center justify-content-center rounded-circle" style="width:16px;height:16px;font-size:9px;font-weight:700;background:rgba(59,130,246,0.20);color:#60a5fa;">2</span>
            Assign Workstation ID
          </p>
          <input type="text" class="form-control" id="addline-id" placeholder="e.g. 01, 02, 03..." required>
          <p id="addline-id-error" class="text-red mt-1" style="font-size:10px;display:none;"></p>
          <p class="text-slate-600 mt-1 mb-0" style="font-size:9px;">Short identifier — used for container and database naming</p>
        </div>

        <div id="addline-create-error" class="alert-banner red mb-3" style="display:none;"></div>

        <button type="submit" class="btn-emerald-glow w-100" id="addline-submit" disabled>
          <i class="bi bi-chevron-right"></i> Create Workstation
        </button>
      </form>
      <div id="addline-success" class="text-center py-5" style="display:none;">
        <i class="bi bi-check-circle-fill text-emerald" style="font-size:48px;"></i>
        <p class="fw-semibold text-emerald mt-3">Workstation created successfully!</p>
        <p class="text-slate-500" style="font-size:12px;">Container is booting up...</p>
      </div>`;

    // Store state
    this._addLineState = {
      selectedLicense: hasUnused ? unusedLicenses[0] : null,
      unusedLicenses,
      activeLines,
      uploadDone: hasUnused,
    };

    // Wire events
    setTimeout(() => {
      const dropzone = document.getElementById('addline-dropzone');
      const fileInput = document.getElementById('addline-file');
      dropzone.addEventListener('click', () => fileInput.click());
      dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); });
      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
      dropzone.addEventListener('drop', (e) => { e.preventDefault(); dropzone.classList.remove('drag-over'); this._addLineUpload(e.dataTransfer.files[0]); });
      fileInput.addEventListener('change', (e) => { this._addLineUpload(e.target.files[0]); e.target.value = ''; });

      // Unused license buttons
      document.querySelectorAll('.addline-lic-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.licId;
          const lic = unusedLicenses.find(l => l.license_id === id);
          if (lic) {
            this._addLineState.selectedLicense = lic;
            this._addLineState.uploadDone = true;
            dropzone.classList.add('done');
            dropzone.innerHTML = `<i class="bi bi-file-check text-emerald" style="font-size:24px;"></i><span class="text-emerald fw-semibold" style="font-size:12px;">License valid — ready to use</span>`;
            this._updateAddLineSubmit();
          }
        });
      });

      // Line ID validation
      document.getElementById('addline-id').addEventListener('input', (e) => {
        const val = e.target.value.trim();
        const taken = activeLines.some(l => l.line_id === val);
        const errEl = document.getElementById('addline-id-error');
        if (taken) { errEl.textContent = `Workstation ${val} is already in use.`; errEl.style.display = ''; }
        else { errEl.style.display = 'none'; }
        this._updateAddLineSubmit();
      });

      // Focus auto-fill
      document.getElementById('addline-id').addEventListener('focus', function() {
        if (!this.value) { this.value = '01'; this.dispatchEvent(new Event('input')); }
      });

      // Submit
      document.getElementById('addline-form').addEventListener('submit', (e) => {
        e.preventDefault();
        this._addLineCreate();
      });

      this._updateAddLineSubmit();
    }, 100);

    bootstrap.Modal.getOrCreateInstance(document.getElementById('addLineModal')).show();
  },

  async _addLineUpload(file) {
    if (!file || !file.name.endsWith('.livis')) {
      document.getElementById('addline-upload-error').innerHTML = '<i class="bi bi-exclamation-circle" style="flex-shrink:0;"></i> Only .livis files are accepted.';
      document.getElementById('addline-upload-error').style.display = '';
      return;
    }
    const dropzone = document.getElementById('addline-dropzone');
    dropzone.innerHTML = '<i class="bi bi-arrow-repeat spin text-blue" style="font-size:24px;"></i><span class="text-blue" style="font-size:12px;">Validating license...</span>';

    const fd = new FormData();
    fd.append('file', file);
    try {
      const data = await Api.postForm('/api/guard/upload-license', fd);
      this._addLineState.selectedLicense = data;
      this._addLineState.uploadDone = true;
      dropzone.classList.add('done');
      dropzone.innerHTML = `<i class="bi bi-file-check text-emerald" style="font-size:24px;"></i><span class="text-emerald fw-semibold" style="font-size:12px;">License valid — ready to use</span>`;
      document.getElementById('addline-upload-error').style.display = 'none';
      this._updateAddLineSubmit();
    } catch (err) {
      dropzone.classList.remove('done');
      dropzone.innerHTML = '<i class="bi bi-cloud-upload text-slate-500" style="font-size:24px;"></i><span class="text-slate-400" style="font-size:12px;">Drop .livis file or click to browse</span>';
      document.getElementById('addline-upload-error').innerHTML = `<i class="bi bi-exclamation-circle" style="flex-shrink:0;"></i> ${Api.errorDetail(err)}`;
      document.getElementById('addline-upload-error').style.display = '';
    }
  },

  _updateAddLineSubmit() {
    const st = this._addLineState;
    const lineId = document.getElementById('addline-id')?.value.trim();
    const idError = document.getElementById('addline-id-error')?.style.display !== 'none';
    const btn = document.getElementById('addline-submit');
    if (btn) btn.disabled = !st.uploadDone || !lineId || idError || !st.selectedLicense?.license_id;
  },

  async _addLineCreate() {
    const lineId = document.getElementById('addline-id').value.trim();
    const licenseId = this._addLineState.selectedLicense?.license_id;
    if (!lineId || !licenseId) return;

    const btn = document.getElementById('addline-submit');
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Provisioning Workstation...';

    try {
      await Api.post('/api/lines', { line_id: lineId, license_id: licenseId });
      document.getElementById('addline-form').style.display = 'none';
      document.getElementById('addline-success').style.display = '';
      setTimeout(() => {
        bootstrap.Modal.getInstance(document.getElementById('addLineModal'))?.hide();
        App.fetchFleetLines();
        App.fetchGuardStatus();
      }, 1200);
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-chevron-right"></i> Create Workstation';
      document.getElementById('addline-create-error').innerHTML = `<i class="bi bi-exclamation-circle" style="flex-shrink:0;"></i> ${Api.errorDetail(err)}`;
      document.getElementById('addline-create-error').style.display = '';
    }
  },

  // ── Audit Trail Modal ────────────────────────────────────────────────
  openAudit(lineId) {
    document.getElementById('audit-line-id').textContent = lineId;
    const history = Fleet.cardStatus[lineId]?.ota_telemetry?.update_history || [];
    const sorted = [...history].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const body = document.getElementById('audit-body');

    if (sorted.length === 0) {
      body.innerHTML = `<div class="text-center text-slate-500 py-5"><i class="bi bi-file-earmark-text" style="font-size:48px;opacity:0.2;"></i><p class="mt-3">No historical events recorded yet.</p></div>`;
    } else {
      body.innerHTML = `<div class="position-relative ps-3" style="border-left:1px solid var(--border-subtle);margin-left:12px;">
        ${sorted.map(ev => {
          let icon = 'bi-check-circle-fill text-blue';
          if (ev.status === 'failed' || ev.status === 'fatal') icon = 'bi-exclamation-octagon-fill text-red';
          else if (ev.status === 'resolved' || ev.action === 'rollback_completed') icon = 'bi-arrow-counterclockwise text-amber';
          else if (ev.status === 'success') icon = 'bi-check-circle-fill text-emerald';
          const dt = new Date(ev.timestamp).toLocaleString([], { month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit' });
          return `<div class="position-relative ps-4 mb-4">
            <div class="position-absolute" style="left:-12px;top:4px;background:#0a0a0a;padding:2px;border-radius:50%;border:1px solid var(--border-subtle);">
              <i class="bi ${icon}" style="font-size:16px;"></i>
            </div>
            <div class="p-3 rounded-3" style="background:rgba(255,255,255,0.03);border:1px solid ${ev.status === 'failed' ? 'rgba(239,68,68,0.20)' : 'var(--border-subtle)'};">
              <div class="d-flex justify-content-between mb-2">
                <span class="fw-bold text-uppercase text-slate-300" style="font-size:12px;letter-spacing:0.05em;">${ev.action.replace(/_/g, ' ')}</span>
                <span class="font-mono text-slate-500" style="font-size:12px;">${dt}</span>
              </div>
              ${ev.image ? `<p class="mb-1" style="font-size:13px;"><span class="text-slate-400">Image:</span> <span class="font-mono text-slate-300" style="font-size:12px;">${ev.image}</span></p>` : ''}
              ${ev.previous_image ? `<p class="mb-1" style="font-size:13px;"><span class="text-slate-500">Previous:</span> <span class="font-mono text-slate-400" style="font-size:12px;">${ev.previous_image}</span></p>` : ''}
              ${ev.attempted_image ? `<p class="mb-1" style="font-size:13px;"><span class="text-slate-500">Attempted:</span> <span class="font-mono text-red" style="font-size:12px;">${ev.attempted_image}</span></p>` : ''}
              ${ev.failed_image ? `<p class="mb-1" style="font-size:13px;"><span class="text-slate-500">Failed:</span> <span class="font-mono text-red" style="font-size:12px;">${ev.failed_image}</span></p>` : ''}
              ${ev.restored_image ? `<p class="mb-1" style="font-size:13px;"><span class="text-slate-500">Restored:</span> <span class="font-mono text-amber" style="font-size:12px;">${ev.restored_image}</span></p>` : ''}
              ${ev.reason ? `<div class="mt-2 p-2 rounded-3 font-mono text-slate-400" style="background:rgba(0,0,0,0.40);border:1px solid rgba(239,68,68,0.15);font-size:12px;word-break:break-all;">${ev.reason}</div>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>`;
    }

    bootstrap.Modal.getOrCreateInstance(document.getElementById('auditModal')).show();
  },

  // ── Admin PIN Modal ──────────────────────────────────────────────────
  _pinCallback: null,

  openPin(title, callback) {
    this._pinCallback = callback;
    document.getElementById('pin-title').textContent = title || 'Admin Confirmation';
    document.getElementById('pin-error').style.display = 'none';
    const boxes = document.querySelectorAll('#pin-boxes .pin-box');
    boxes.forEach(b => { b.value = ''; });
    boxes[0]?.focus();

    // Wire key handlers
    boxes.forEach((box, idx) => {
      box.onkeydown = (e) => {
        if (e.key === 'Backspace') {
          if (box.value) { box.value = ''; }
          else if (idx > 0) { boxes[idx - 1].focus(); }
          this._updatePinBtn();
          return;
        }
        if (!/^\d$/.test(e.key)) { e.preventDefault(); return; }
        box.value = e.key;
        e.preventDefault();
        if (idx < 5) boxes[idx + 1].focus();
        else this._submitPin(); // auto-submit on last digit
        this._updatePinBtn();
      };
    });

    document.getElementById('btn-pin-confirm').onclick = () => this._submitPin();

    bootstrap.Modal.getOrCreateInstance(document.getElementById('pinModal')).show();
  },

  _updatePinBtn() {
    const boxes = document.querySelectorAll('#pin-boxes .pin-box');
    const allFilled = Array.from(boxes).every(b => b.value);
    document.getElementById('btn-pin-confirm').disabled = !allFilled;
  },

  async _submitPin() {
    const boxes = document.querySelectorAll('#pin-boxes .pin-box');
    const pin = Array.from(boxes).map(b => b.value).join('');
    if (pin.length < 6) { document.getElementById('pin-error').textContent = 'Enter all 6 digits.'; document.getElementById('pin-error').style.display = ''; return; }

    const btn = document.getElementById('btn-pin-confirm');
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Verifying…';

    try {
      await Api.post('/api/updates/verify-pin', { pin });
      bootstrap.Modal.getInstance(document.getElementById('pinModal'))?.hide();
      if (this._pinCallback) this._pinCallback(pin);
    } catch {
      document.getElementById('pin-error').textContent = 'Incorrect PIN. Try again.';
      document.getElementById('pin-error').style.display = '';
      boxes.forEach(b => { b.value = ''; });
      boxes[0]?.focus();
    }
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-lock"></i> Confirm';
  },

  // ── Update Center Modal ──────────────────────────────────────────────
  openUpdateCenter(pending, lineIds) {
    const release = pending?.release || {};
    const channel = release.channel || 'stable';
    const channelClasses = { stable: 'badge-stable', rc: 'badge-rc', beta: 'badge-beta', alpha: 'badge-alpha' };

    document.getElementById('uc-version').textContent = release.version || 'Update Available';
    document.getElementById('uc-published').textContent = `Published ${release.published_at ? new Date(release.published_at).toLocaleDateString() : ''} ${release.published_by ? `by ${release.published_by}` : ''}`;
    document.getElementById('uc-channel-badge').className = `badge-status ${channelClasses[channel] || 'badge-stable'}`;
    document.getElementById('uc-channel-badge').textContent = channel;

    // Body — release notes + line selector
    let bodyHTML = '';
    if (release.features?.length) bodyHTML += `<div class="mb-3"><p class="d-flex align-items-center gap-1 fw-bold text-blue mb-2" style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;"><i class="bi bi-lightning"></i> New Features</p><ul class="ps-3">${release.features.map(f => `<li class="text-slate-300 mb-1" style="font-size:12px;">${f}</li>`).join('')}</ul></div>`;
    if (release.bug_fixes?.length) bodyHTML += `<div class="mb-3"><p class="d-flex align-items-center gap-1 fw-bold text-emerald mb-2" style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;"><i class="bi bi-bug"></i> Bug Fixes</p><ul class="ps-3">${release.bug_fixes.map(f => `<li class="text-slate-300 mb-1" style="font-size:12px;">${f}</li>`).join('')}</ul></div>`;
    if (release.breaking_changes?.length) bodyHTML += `<div class="mb-3"><p class="d-flex align-items-center gap-1 fw-bold text-amber mb-2" style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;"><i class="bi bi-exclamation-triangle"></i> Breaking Changes</p><ul class="ps-3">${release.breaking_changes.map(f => `<li style="font-size:12px;color:#fcd34d;">${f}</li>`).join('')}</ul></div>`;
    if (release.notes) bodyHTML += `<div class="mb-3"><p class="d-flex align-items-center gap-1 fw-bold text-slate-400 mb-2" style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;"><i class="bi bi-file-text"></i> Release Notes</p><pre class="text-slate-300 p-3 rounded-3" style="background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);font-size:12px;white-space:pre-wrap;font-family:sans-serif;">${release.notes}</pre></div>`;

    // Line selector
    bodyHTML += `<div>
      <p class="text-slate-500 mb-2" style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;">Apply To Workstations</p>
      <div class="d-flex flex-wrap gap-2">
        <button class="badge-status badge-count uc-line-btn" data-uc-all="true" style="cursor:pointer;font-size:12px;padding:6px 12px;">All Workstations</button>
        ${lineIds.map(id => `<button class="badge-status badge-count uc-line-btn" data-uc-line="${id}" style="cursor:pointer;font-size:12px;padding:6px 12px;">Workstation ${id}</button>`).join('')}
      </div>
    </div>`;

    document.getElementById('uc-body').innerHTML = bodyHTML;

    // Footer actions
    document.getElementById('uc-footer').innerHTML = `
      <button class="btn-outline-blue flex-grow-1" id="uc-btn-update"><i class="bi bi-cloud-upload"></i> Update Now</button>
      <button class="btn-ghost flex-grow-1" id="uc-btn-schedule" style="background:rgba(99,102,241,0.10);border-color:rgba(99,102,241,0.30);color:#a5b4fc;"><i class="bi bi-calendar"></i> Schedule</button>
      <button class="btn-ghost" id="uc-btn-reject"><i class="bi bi-x-circle"></i></button>`;

    // Selected lines state
    let selectedLines = [...lineIds];

    setTimeout(() => {
      // Line selector buttons
      document.querySelectorAll('.uc-line-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (btn.dataset.ucAll) {
            selectedLines = [...lineIds];
          } else {
            const id = btn.dataset.ucLine;
            if (selectedLines.includes(id)) selectedLines = selectedLines.filter(l => l !== id);
            else selectedLines.push(id);
          }
          document.querySelectorAll('.uc-line-btn').forEach(b => {
            if (b.dataset.ucAll) {
              b.className = `badge-status ${selectedLines.length === lineIds.length ? 'badge-count' : 'badge-idle'} uc-line-btn`;
            } else {
              b.className = `badge-status ${selectedLines.includes(b.dataset.ucLine) ? 'badge-count' : 'badge-idle'} uc-line-btn`;
            }
          });
        });
      });

      document.getElementById('uc-btn-update').addEventListener('click', () => {
        this.openPin('Confirm Update', async (pin) => {
          try {
            await Api.post('/api/updates/action', { pin, action: 'accept', version: release.version, line_ids: selectedLines });
            this._ucDone('OTA update triggered. Check workstation cards for progress.');
          } catch (e) { this._ucDone(Api.errorDetail(e)); }
        });
      });

      document.getElementById('uc-btn-schedule').addEventListener('click', () => {
        this.openPin('Schedule Update', (pin) => {
          bootstrap.Modal.getInstance(document.getElementById('updateCenterModal'))?.hide();
          this.openSchedule(release, lineIds, pin);
        });
      });

      document.getElementById('uc-btn-reject').addEventListener('click', () => {
        this.openPin('Confirm Rejection', async (pin) => {
          try {
            await Api.post('/api/updates/action', { pin, action: 'reject', version: release.version, line_ids: selectedLines, reason: 'User rejected update' });
            this._ucDone('Update rejected. You can apply it manually any time.');
          } catch (e) { this._ucDone(Api.errorDetail(e)); }
        });
      });
    }, 100);

    bootstrap.Modal.getOrCreateInstance(document.getElementById('updateCenterModal')).show();
  },

  _ucDone(msg) {
    document.getElementById('uc-body').innerHTML = `<div class="text-center py-5">
      <i class="bi bi-check-circle-fill text-emerald" style="font-size:48px;"></i>
      <p class="text-slate-200 fw-medium mt-3">${msg}</p>
    </div>`;
    document.getElementById('uc-footer').innerHTML = `<button class="btn-ghost w-100" data-bs-dismiss="modal">Close</button>`;
    App.pendingUpdate = null;
  },

  // ── Schedule Install Modal ───────────────────────────────────────────
  openSchedule(release, lineIds, pin) {
    document.getElementById('sched-version').textContent = release.version;
    let selectedLines = [...lineIds];
    let preset = '';

    const body = document.getElementById('sched-body');
    body.innerHTML = `
      <div class="mb-4">
        <p class="text-slate-500 mb-2" style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;">Apply To</p>
        <div class="d-flex flex-wrap gap-2">
          <button class="badge-status badge-count sched-line-btn" data-sched-all="true" style="cursor:pointer;font-size:12px;padding:6px 12px;">All Workstations</button>
          ${lineIds.map(id => `<button class="badge-status badge-count sched-line-btn" data-sched-line="${id}" style="cursor:pointer;font-size:12px;padding:6px 12px;">Workstation ${id}</button>`).join('')}
        </div>
      </div>
      <div class="mb-4">
        <p class="text-slate-500 mb-2" style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;">Quick Schedule</p>
        <div class="row g-2">
          <div class="col-4"><button class="btn-ghost w-100 sched-preset" data-preset="2h" style="font-size:12px;">In 2 Hours</button></div>
          <div class="col-4"><button class="btn-ghost w-100 sched-preset" data-preset="midnight" style="font-size:12px;">Tonight Midnight</button></div>
          <div class="col-4"><button class="btn-ghost w-100 sched-preset" data-preset="restart" style="font-size:12px;">On Next Restart</button></div>
        </div>
      </div>
      <div class="mb-4">
        <p class="text-slate-500 mb-2" style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;">Custom Time</p>
        <div class="row g-3">
          <div class="col-6">
            <label class="form-label text-slate-600" style="font-size:9px;text-transform:uppercase;">Date</label>
            <input type="date" class="form-control" id="sched-date">
          </div>
          <div class="col-6">
            <label class="form-label text-slate-600" style="font-size:9px;text-transform:uppercase;">Time</label>
            <input type="time" class="form-control" id="sched-time">
          </div>
        </div>
      </div>
      <p id="sched-error" class="text-red mb-3" style="font-size:12px;display:none;"></p>
      <button class="btn-outline-blue w-100" id="sched-confirm"><i class="bi bi-calendar"></i> Confirm Schedule</button>`;

    setTimeout(() => {
      document.querySelectorAll('.sched-preset').forEach(btn => {
        btn.addEventListener('click', () => {
          preset = btn.dataset.preset;
          document.querySelectorAll('.sched-preset').forEach(b => b.className = 'btn-ghost w-100 sched-preset');
          btn.className = 'btn-outline-blue w-100 sched-preset';
          document.getElementById('sched-date').value = '';
          document.getElementById('sched-time').value = '';
        });
      });

      ['sched-date', 'sched-time'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
          preset = '';
          document.querySelectorAll('.sched-preset').forEach(b => b.className = 'btn-ghost w-100 sched-preset');
        });
      });

      document.getElementById('sched-confirm').addEventListener('click', async () => {
        const now = new Date();
        let install_at;
        if (preset === '2h') install_at = new Date(now.getTime() + 2 * 3600000).toISOString();
        else if (preset === 'midnight') { const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(0,0,0,0); install_at = d.toISOString(); }
        else if (preset === 'restart') install_at = 'on_restart';
        else {
          const d = document.getElementById('sched-date').value;
          const t = document.getElementById('sched-time').value;
          if (d && t) { const dt = new Date(`${d}T${t}:00`); install_at = dt.toISOString(); }
        }
        if (!install_at) { document.getElementById('sched-error').textContent = 'Choose a time or preset.'; document.getElementById('sched-error').style.display = ''; return; }

        const btn = document.getElementById('sched-confirm');
        btn.disabled = true;
        btn.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Scheduling…';
        try {
          await Api.post('/api/updates/schedule', { pin, line_ids: selectedLines, image_repo: release.image_repo || 'deepanshuvishwakarma/edge_poc', image_tag: release.image_tag, install_at });
          body.innerHTML = `<div class="text-center py-5"><i class="bi bi-check-circle-fill text-emerald" style="font-size:40px;"></i><p class="fw-semibold text-emerald mt-3">Update Scheduled</p></div>`;
          setTimeout(() => {
            bootstrap.Modal.getInstance(document.getElementById('scheduleModal'))?.hide();
            App.pendingUpdate = null;
          }, 1500);
        } catch (e) {
          document.getElementById('sched-error').textContent = Api.errorDetail(e);
          document.getElementById('sched-error').style.display = '';
          btn.disabled = false;
          btn.innerHTML = '<i class="bi bi-calendar"></i> Confirm Schedule';
        }
      });
    }, 100);

    bootstrap.Modal.getOrCreateInstance(document.getElementById('scheduleModal')).show();
  },

  // ── Delete Warning Modal ─────────────────────────────────────────────
  _deleteCallback: null,

  openDeleteWarn(licenseId, clientName, callback) {
    this._deleteCallback = callback;
    document.getElementById('delete-warn-body').innerHTML = `
      <div class="p-4 rounded-3 mb-4" style="background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.20);">
        <p class="fw-semibold text-red mb-2" style="font-size:14px;">This action cannot be undone.</p>
        <p class="text-slate-400 mb-2" style="font-size:12px;line-height:1.6;">
          License <span class="font-mono text-slate-200">${licenseId?.slice(0,8)}...</span>
          ${clientName ? `<span class="text-slate-300">(${clientName})</span>` : ''}
          will be permanently removed. The physical <code class="text-blue">.livis</code> file will be deleted from disk.
        </p>
        <p class="text-amber fw-semibold mb-0" style="font-size:12px;">Make sure you have a copy of the original .livis file before proceeding.</p>
      </div>
      <div class="d-flex gap-2">
        <button class="btn-ghost flex-grow-1" data-bs-dismiss="modal">Cancel</button>
        <button class="btn-outline-red flex-grow-1" id="delete-warn-proceed" style="padding:10px 16px;font-size:13px;">I understand — Proceed</button>
      </div>`;

    setTimeout(() => {
      document.getElementById('delete-warn-proceed').addEventListener('click', () => {
        bootstrap.Modal.getInstance(document.getElementById('deleteWarnModal'))?.hide();
        this.openPin('Confirm Delete', (pin) => {
          if (this._deleteCallback) this._deleteCallback(pin);
        });
      });
    }, 100);

    bootstrap.Modal.getOrCreateInstance(document.getElementById('deleteWarnModal')).show();
  },
};

// OTA form submission handler (wired after modal opens)
document.addEventListener('submit', async (e) => {
  if (e.target.id === 'ota-form') {
    e.preventDefault();
    const lineId = Modals._otaLineId;
    const formData = {
      image_repo: document.getElementById('ota-repo').value,
      new_tag: document.getElementById('ota-tag').value,
      temp_username: document.getElementById('ota-user').value,
      temp_token: document.getElementById('ota-token').value,
    };
    if (!formData.new_tag || !formData.temp_username || !formData.temp_token) return;

    const body = document.getElementById('ota-body');
    body.innerHTML = `<div class="text-center py-5"><i class="bi bi-arrow-repeat spin text-blue" style="font-size:40px;"></i><p class="fw-medium mt-3" style="font-size:18px;">Deploying Update...</p><p class="text-slate-400 mt-2" style="font-size:14px;">Pulling image and verifying stability...</p></div>`;

    try {
      const res = await Api.post(`/api/container/update/${lineId}`, formData);
      body.innerHTML = `<div class="text-center py-4"><i class="bi bi-check-circle-fill text-emerald" style="font-size:48px;"></i><p class="fw-bold text-emerald mt-3" style="font-size:18px;">Deployment Successful</p><p class="text-slate-300 mt-2" style="font-size:14px;">${res.message || 'Updated successfully'}</p><button class="btn-ghost mt-4" data-bs-dismiss="modal">Close</button></div>`;
    } catch (err) {
      body.innerHTML = `<div class="text-center py-4"><i class="bi bi-exclamation-circle-fill text-red" style="font-size:48px;"></i><p class="fw-bold text-red mt-3" style="font-size:18px;">Deployment Failed</p><p class="text-slate-300 mt-2 p-3 rounded-3 font-mono" style="font-size:12px;background:rgba(239,68,68,0.10);border:1px solid rgba(239,68,68,0.20);">${Api.errorDetail(err)}</p><button class="btn-ghost mt-4" onclick="Modals.openOTA('${lineId}')">Try Again</button></div>`;
    }
  }
});

window.Modals = Modals;
