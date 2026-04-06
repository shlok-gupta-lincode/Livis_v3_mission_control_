/* ══════════════════════════════════════════════════════════════════════
   fleet.js — Fleet page + Enterprise LineCard rendering
   ══════════════════════════════════════════════════════════════════════ */

const Fleet = {
  cardIntervals: {},
  cardTelemetry: {},
  cardStatus: {},
  cardLineDetail: {},
  rollbackCfg: {},
  _initialLoadDone: false,
  _openDropdown: null,
  _vitalsLineId: null,
  _vitalsInterval: null,

  /* Infinite scroll state */
  _batchSize: 6,
  _visibleCount: 0,
  _sortedLines: [],
  _scrollObserver: null,

  /* ────────────────────────────────────────────────────────────────────
     Render
     ──────────────────────────────────────────────────────────────────── */
  render(state) {
    const activeLines = (state.activeLicense?.lines || []).filter(l => l.state === 'ACTIVE');
    const unusedLicenses = state.activeLicense?.unused_licenses || [];

    document.getElementById('fleet-subtitle').textContent = I18n.t(
      'fleet.subtitle',
      { active: activeLines.length, unused: unusedLicenses.length },
      `${activeLines.length} active workstation(s) · ${unusedLicenses.length} unused license(s)`,
    );

    const bulkBtn = document.getElementById('btn-bulk-update');
    bulkBtn.style.display = activeLines.length > 0 ? '' : 'none';

    document.getElementById('fleet-loading').style.display = 'none';
    this._initialLoadDone = true;

    if (activeLines.length === 0) {
      document.getElementById('fleet-empty').style.display = '';
      document.getElementById('fleet-grid').style.display = 'none';
      return;
    }

    document.getElementById('fleet-empty').style.display = 'none';
    document.getElementById('fleet-grid').style.display = '';

    // Sort once — keep stable reference for infinite scroll
    this._sortedLines = [...activeLines].sort((a, b) => {
      const na = Number(a.line_id);
      const nb = Number(b.line_id);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return String(a.line_id).localeCompare(String(b.line_id));
    });

    // On first render or when line count changed, reset visible count
    if (this._visibleCount === 0 || this._visibleCount > this._sortedLines.length) {
      this._visibleCount = Math.min(this._batchSize, this._sortedLines.length);
    }

    this._renderVisibleCards(state);
    this._initScrollObserver();
  },

  /* Render cards up to _visibleCount */
  _renderVisibleCards(state) {
    const visibleLines = this._sortedLines.slice(0, this._visibleCount);
    const grid = document.getElementById('fleet-grid');
    const existingIds = new Set();
    visibleLines.forEach(line => existingIds.add(line.line_id));

    // Remove cards for lines no longer visible
    grid.querySelectorAll('.line-card-wrap').forEach(el => {
      if (!existingIds.has(el.dataset.lineId)) {
        this.stopCardPolling(el.dataset.lineId);
        el.remove();
      }
    });

    // Add cards that aren't in the DOM yet
    visibleLines.forEach(line => {
      let wrap = grid.querySelector(`.line-card-wrap[data-line-id="${line.line_id}"]`);
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = 'col-12 col-md-6 col-xl-4 line-card-wrap';
        wrap.dataset.lineId = line.line_id;
        wrap.innerHTML = this.cardHTML(line.line_id);
        grid.appendChild(wrap);
        this.startCardPolling(line.line_id);
      }
    });
  },

  /* Set up IntersectionObserver on the sentinel */
  _initScrollObserver() {
    if (this._scrollObserver) return; // already watching

    const sentinel = document.getElementById('fleet-scroll-sentinel');
    if (!sentinel) return;

    // Find the scrollable ancestor (page-container)
    const scrollRoot = document.getElementById('page-container');

    this._scrollObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && this._visibleCount < this._sortedLines.length) {
          this._visibleCount = Math.min(
            this._visibleCount + this._batchSize,
            this._sortedLines.length,
          );
          this._renderVisibleCards(App.state);
        }
      },
      { root: scrollRoot, rootMargin: '200px' },
    );

    this._scrollObserver.observe(sentinel);
  },

  _destroyScrollObserver() {
    if (this._scrollObserver) {
      this._scrollObserver.disconnect();
      this._scrollObserver = null;
    }
  },

  /* ────────────────────────────────────────────────────────────────────
     Card HTML — Enterprise layout
     ──────────────────────────────────────────────────────────────────── */
  cardHTML(lineId) {
    return `
    <div class="glass-card line-card idle" id="lc-${lineId}" style="padding:0 !important;">

      <!-- Banners -->
      <div class="lc-banners" id="lc-banners-${lineId}">
        <div id="lc-pulling-${lineId}" class="alert-banner blue" style="display:none;">
          <i class="bi bi-arrow-repeat spin" style="flex-shrink:0;"></i>
          <div>
            <div class="fw-semibold" style="font-size:12px;">${I18n.t('fleet.card.downloadingImage', {}, 'Downloading backend image...')}</div>
            <div style="font-size:9px; opacity:0.6; margin-top:2px;">${I18n.t('fleet.card.firstTimeOnly', {}, 'First-time only. Starts automatically when ready.')}</div>
          </div>
        </div>
        <div id="lc-error-${lineId}" class="alert-banner red" style="display:none;">
          <i class="bi bi-exclamation-triangle" style="flex-shrink:0;"></i>
          <span id="lc-error-msg-${lineId}"></span>
        </div>
      </div>

      <!-- Header -->
      <div class="lc-header">
        <div class="lc-header-left">
          <div class="lc-header-icon"><i class="bi bi-hdd-rack"></i></div>
          <div class="lc-header-text">
            <div class="lc-ws-name">${I18n.t('home.workstation', { id: lineId }, `Workstation ${lineId}`)}</div>
            <div class="lc-ws-sub" id="lc-image-${lineId}">${I18n.t('fleet.card.noImage', {}, 'No image')}</div>
          </div>
        </div>
        <div class="lc-header-right">
          <span class="badge-status badge-idle" id="lc-badge-${lineId}">${I18n.t('fleet.card.idle', {}, 'Idle')}</span>
        </div>
      </div>

      <!-- Body -->
      <div class="lc-body">
        <!-- License -->
        <div id="lc-lic-info-${lineId}" class="lc-license-row" style="display:none;"></div>

        <!-- Part name (always visible) -->
        <div id="lc-part-${lineId}" class="lc-part-pill">
          <span class="lc-part-pill-label">${I18n.t('fleet.card.part', {}, 'Part')}</span>
          <span class="lc-part-pill-value text-slate-500" id="lc-part-name-${lineId}">--</span>
        </div>

        <!-- Stats (always visible) -->
        <div id="lc-stats-${lineId}" class="lc-stats">
          <div class="lc-stat">
            <div class="lc-stat-label">TAT</div>
            <div class="lc-stat-value text-slate-500" id="lc-tat-${lineId}">--</div>
          </div>
          <div class="lc-stat">
            <div class="lc-stat-label">${I18n.t('fleet.card.total', {}, 'Total')}</div>
            <div class="lc-stat-value text-slate-500" id="lc-total-${lineId}">--</div>
          </div>
          <div class="lc-stat">
            <div class="lc-stat-label">${I18n.t('fleet.card.pass', {}, 'Pass')}</div>
            <div class="lc-stat-value text-slate-500" id="lc-pass-${lineId}">--</div>
          </div>
          <div class="lc-stat">
            <div class="lc-stat-label">${I18n.t('fleet.card.fail', {}, 'Fail')}</div>
            <div class="lc-stat-value text-slate-500" id="lc-fail-${lineId}">--</div>
          </div>
        </div>

        <!-- Meta row (OTA status) -->
        <div class="lc-meta-row">
          <div class="lc-meta-item">
            <div class="lc-meta-item-label">${I18n.t('fleet.card.otaStatus', {}, 'OTA Status')}</div>
            <div class="lc-meta-item-value text-capitalize" id="lc-ota-${lineId}">unknown</div>
          </div>
          <div class="lc-meta-sep"></div>
          <div class="lc-meta-item">
            <div class="lc-meta-item-label">${I18n.t('fleet.card.audit', {}, 'Audit')}</div>
            <button class="btn p-0 border-0 bg-transparent" onclick="Modals.openAudit('${lineId}')" title="${I18n.t('fleet.card.view', {}, 'View')}" style="font-size:12px; color:#78a9ff; font-weight:600;">
              <i class="bi bi-clock-history"></i> ${I18n.t('fleet.card.view', {}, 'View')}
            </button>
          </div>
        </div>
      </div>

      <!-- Footer: Controls -->
      <div class="lc-footer">
        <button class="lc-btn start" id="lc-start-${lineId}" onclick="Fleet.handleAction('${lineId}','start')">
          <i class="bi bi-play-fill"></i> ${I18n.t('fleet.card.start', {}, 'Start')}
        </button>
        <button class="lc-btn restart" id="lc-restart-${lineId}" onclick="Fleet.handleAction('${lineId}','restart')" disabled>
          <i class="bi bi-arrow-clockwise"></i> ${I18n.t('fleet.card.restart', {}, 'Restart')}
        </button>

        <!-- Actions dropdown -->
        <div class="lc-actions-wrap" id="lc-actions-wrap-${lineId}">
          <button class="lc-actions-trigger" onclick="Fleet.toggleDropdown('${lineId}')" title="${I18n.t('fleet.card.moreActions', {}, 'More actions')}">
            <i class="bi bi-three-dots-vertical"></i>
          </button>
          <div class="lc-actions-menu" id="lc-actions-menu-${lineId}">
            <button class="lc-action-item" onclick="Modals.openOTA('${lineId}'); Fleet.closeDropdown();">
              <i class="bi bi-cloud-upload"></i> ${I18n.t('fleet.card.updateImage', {}, 'Update Image')}
            </button>
            <button class="lc-action-item" onclick="Fleet.openVitals('${lineId}'); Fleet.closeDropdown();">
              <i class="bi bi-broadcast"></i> ${I18n.t('fleet.card.vitals', {}, 'Vitals')}
            </button>
            <div class="lc-action-sep"></div>
            <button class="lc-action-item danger" onclick="Fleet.openDeleteModal('${lineId}'); Fleet.closeDropdown();">
              <i class="bi bi-trash3"></i> ${I18n.t('fleet.card.deleteWorkstation', {}, 'Delete Workstation')}
            </button>
          </div>
        </div>
      </div>
    </div>`;
  },

  /* ────────────────────────────────────────────────────────────────────
     Actions Dropdown
     ──────────────────────────────────────────────────────────────────── */
  toggleDropdown(lineId) {
    const menu = document.getElementById(`lc-actions-menu-${lineId}`);
    if (this._openDropdown && this._openDropdown !== menu) {
      this._openDropdown.classList.remove('open');
    }
    menu.classList.toggle('open');
    this._openDropdown = menu.classList.contains('open') ? menu : null;
  },

  closeDropdown() {
    if (this._openDropdown) {
      this._openDropdown.classList.remove('open');
      this._openDropdown = null;
    }
  },

  /* ────────────────────────────────────────────────────────────────────
     Delete Modal
     ──────────────────────────────────────────────────────────────────── */
  openDeleteModal(lineId) {
    this._deleteLineId = lineId;
    document.getElementById('delete-ws-id').textContent = lineId;
    const modal = new bootstrap.Modal(document.getElementById('fleetDeleteModal'));
    // Reset state
    document.getElementById('fleet-delete-error').style.display = 'none';
    document.getElementById('btn-fleet-delete-confirm').disabled = false;
    document.getElementById('btn-fleet-delete-confirm').innerHTML = `<i class="bi bi-trash3"></i> ${I18n.t('common.delete', {}, 'Delete')}`;
    modal.show();
  },

  async confirmDeleteFromModal() {
    const lineId = this._deleteLineId;
    if (!lineId) return;
    const btn = document.getElementById('btn-fleet-delete-confirm');
    const errEl = document.getElementById('fleet-delete-error');
    btn.disabled = true;
    btn.innerHTML = `<i class="bi bi-arrow-repeat spin"></i> ${I18n.t('fleet.delete.deleting', {}, 'Deleting...')}`;
    errEl.style.display = 'none';

    try {
      await Api.delete(`/api/lines/${lineId}`);
      this.stopCardPolling(lineId);
      const wrap = document.querySelector(`.line-card-wrap[data-line-id="${lineId}"]`);
      if (wrap) wrap.remove();
      bootstrap.Modal.getInstance(document.getElementById('fleetDeleteModal'))?.hide();
      App.fetchFleetLines();
      App.fetchGuardStatus();
    } catch (err) {
      errEl.textContent = Api.errorDetail(err);
      errEl.style.display = '';
      btn.disabled = false;
      btn.innerHTML = `<i class="bi bi-trash3"></i> ${I18n.t('common.delete', {}, 'Delete')}`;
    }
  },

  /* ────────────────────────────────────────────────────────────────────
     Vitals Modal
     ──────────────────────────────────────────────────────────────────── */
  openVitals(lineId) {
    this._vitalsLineId = lineId;
    document.getElementById('vitals-ws-id').textContent = lineId;
    const modal = new bootstrap.Modal(document.getElementById('fleetVitalsModal'));
    this.renderVitalsModal(lineId);
    modal.show();

    // Live update vitals while modal is open
    if (this._vitalsInterval) clearInterval(this._vitalsInterval);
    this._vitalsInterval = setInterval(() => {
      if (this._vitalsLineId) this.renderVitalsModal(this._vitalsLineId);
    }, 2000);

    // Cleanup on close
    document.getElementById('fleetVitalsModal').addEventListener('hidden.bs.modal', () => {
      clearInterval(this._vitalsInterval);
      this._vitalsInterval = null;
      this._vitalsLineId = null;
    }, { once: true });
  },

  renderVitalsModal(lineId) {
    const body = document.getElementById('vitals-body');
    const status = this.cardStatus[lineId] || {};
    const telemetry = this.cardTelemetry[lineId];

    if (!status.is_running) {
      body.innerHTML = `
        <div class="text-center py-5">
          <div style="width:56px;height:56px;border-radius:50%;background:#1f1f1f;border:1px solid #393939;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;">
            <i class="bi bi-power text-slate-500" style="font-size:24px;"></i>
          </div>
          <p class="text-slate-400 fw-semibold mb-1">${I18n.t('fleet.vitals.offline', {}, 'Container Offline')}</p>
          <p class="text-slate-600 mb-0" style="font-size:12px;">${I18n.t('fleet.vitals.startToView', {}, 'Start the workstation to view live telemetry.')}</p>
        </div>`;
      return;
    }

    if (!telemetry) {
      body.innerHTML = `
        <div class="text-center py-5">
          <i class="bi bi-arrow-repeat spin text-blue" style="font-size:24px;"></i>
          <p class="text-slate-400 mt-3">${I18n.t('fleet.vitals.awaiting', {}, 'Awaiting telemetry payload...')}</p>
        </div>`;
      return;
    }

    let html = '<div class="vitals-grid">';

    // Core stats
    const stats = [
      { label: I18n.t('fleet.vitals.state', {}, 'State'), value: (telemetry.state || 'Initializing').replace(/_/g, ' '), color: 'text-slate-200' },
      { label: 'TAT', value: `${telemetry.tat ?? 0}s`, color: 'text-emerald' },
      { label: I18n.t('fleet.vitals.framesProcessed', {}, 'Frames Processed'), value: (telemetry.frames_processed ?? 0).toLocaleString(), color: 'text-blue' },
      { label: I18n.t('fleet.vitals.anomalies', {}, 'Anomalies'), value: telemetry.anomalies_detected ?? 0, color: (telemetry.anomalies_detected ?? 0) > 0 ? 'text-red' : 'text-slate-300' },
      { label: 'Total Inspected', value: (telemetry.total_inspected ?? 0).toLocaleString(), color: 'text-indigo' },
      { label: I18n.t('fleet.vitals.partName', {}, 'Part Name'), value: telemetry.part_name || '—', color: 'text-cyan' },
    ];

    stats.forEach(s => {
      html += `<div class="vitals-stat">
        <div class="vitals-stat-label">${s.label}</div>
        <div class="vitals-stat-value ${s.color}">${s.value}</div>
      </div>`;
    });

    // GPU temp — spans full width
    if (telemetry.gpu_temp != null) {
      const tc = telemetry.gpu_temp > 80 ? 'text-red' : telemetry.gpu_temp > 70 ? 'text-amber' : 'text-emerald';
      const bc = telemetry.gpu_temp > 80 ? 'var(--red)' : telemetry.gpu_temp > 70 ? 'var(--amber)' : 'var(--emerald)';
      html += `<div class="vitals-stat vitals-wide">
        <div class="d-flex align-items-center justify-content-between mb-2">
          <div class="vitals-stat-label mb-0 d-flex align-items-center gap-1"><i class="bi bi-thermometer-half"></i> ${I18n.t('fleet.vitals.gpuTemp', {}, 'GPU Temperature')}</div>
          <span class="fw-bold font-mono ${tc}" style="font-size:16px;">${telemetry.gpu_temp}°C</span>
        </div>
        <div class="progress-bar-custom" style="height:8px;"><div class="fill" style="width:${Math.min(telemetry.gpu_temp, 100)}%; background:${bc};"></div></div>
      </div>`;
    }

    // Pass/fail yield bar — full width
    if (telemetry.total_inspected > 0) {
      const passP = (telemetry.total_accepted / telemetry.total_inspected * 100).toFixed(1);
      html += `<div class="vitals-stat vitals-wide">
        <div class="d-flex justify-content-between mb-2">
          <div class="vitals-stat-label mb-0">${I18n.t('fleet.vitals.passFailYield', {}, 'Pass / Fail Yield')}</div>
          <div>
            <span class="font-mono text-emerald fw-bold" style="font-size:14px;">${(telemetry.total_accepted ?? 0).toLocaleString()}</span>
            <span class="text-slate-600 mx-1">/</span>
            <span class="font-mono text-red fw-bold" style="font-size:14px;">${(telemetry.total_rejected ?? 0).toLocaleString()}</span>
            <span class="ms-2 text-slate-400" style="font-size:11px;">(${passP}% yield)</span>
          </div>
        </div>
        <div class="progress-bar-custom" style="height:8px;"><div class="fill" style="width:${passP}%; background:var(--emerald); border-radius:9999px 0 0 9999px;"></div></div>
      </div>`;
    }

    html += '</div>';
    body.innerHTML = html;
  },

  /* ────────────────────────────────────────────────────────────────────
     Polling
     ──────────────────────────────────────────────────────────────────── */
  startCardPolling(lineId) {
    const fetchStatus = async () => {
      try {
        const res = await Api.get(`/api/system/status/${lineId}`);
        this.cardStatus[lineId] = res;
        this.updateCardUI(lineId);
      } catch {}
    };

    const fetchTelemetry = async () => {
      const status = this.cardStatus[lineId];
      if (!status?.is_running) { this.cardTelemetry[lineId] = null; return; }
      try {
        const res = await Api.get(`/api/container/telemetry/${lineId}`);
        if (res.status === 'success') {
          if (res.data.state !== 'waiting_for_stream' || !this.cardTelemetry[lineId])
            this.cardTelemetry[lineId] = res.data;
        }
      } catch {}
    };

    const fetchDetail = async () => {
      try {
        const res = await Api.get(`/api/guard/status/${lineId}`);
        this.cardLineDetail[lineId] = res;
      } catch {}
    };

    fetchStatus();
    fetchTelemetry();
    fetchDetail();

    this.cardIntervals[lineId] = {
      status: setInterval(fetchStatus, 3000),
      telemetry: setInterval(fetchTelemetry, 3000),
      detail: setInterval(fetchDetail, 30000),
    };
  },

  stopCardPolling(lineId) {
    const intervals = this.cardIntervals[lineId];
    if (intervals) {
      clearInterval(intervals.status);
      clearInterval(intervals.telemetry);
      clearInterval(intervals.detail);
      delete this.cardIntervals[lineId];
    }
  },

  /* ────────────────────────────────────────────────────────────────────
     Update Card UI
     ──────────────────────────────────────────────────────────────────── */
  updateCardUI(lineId) {
    const status = this.cardStatus[lineId] || {};
    const telemetry = this.cardTelemetry[lineId];
    const detail = this.cardLineDetail[lineId];
    const isRunning = status.is_running;
    const card = document.getElementById(`lc-${lineId}`);
    if (!card) return;

    // Card state class
    card.classList.toggle('running', isRunning);
    card.classList.toggle('idle', !isRunning);

    // Badge
    const badge = document.getElementById(`lc-badge-${lineId}`);
    badge.className = `badge-status ${isRunning ? 'badge-running' : 'badge-idle'}`;
    badge.textContent = isRunning ? I18n.t('fleet.card.running', {}, 'Running') : I18n.t('fleet.card.idle', {}, 'Idle');

    // Image subtitle
    const image = status.ota_telemetry?.current_image || 'No image';
    document.getElementById(`lc-image-${lineId}`).textContent = image;
    document.getElementById(`lc-image-${lineId}`).title = image;

    // OTA status
    const ota = status.ota_telemetry?.rollout_status || 'unknown';
    document.getElementById(`lc-ota-${lineId}`).textContent = ota.replace(/_/g, ' ');

    // Controls — dynamic start/stop swap
    const startBtn = document.getElementById(`lc-start-${lineId}`);
    if (isRunning) {
      startBtn.className = 'lc-btn stop';
      startBtn.innerHTML = `<i class="bi bi-stop-fill"></i> ${I18n.t('fleet.card.stop', {}, 'Stop')}`;
      startBtn.onclick = () => Fleet.handleAction(lineId, 'stop');
    } else {
      startBtn.className = 'lc-btn start';
      startBtn.innerHTML = `<i class="bi bi-play-fill"></i> ${I18n.t('fleet.card.start', {}, 'Start')}`;
      startBtn.onclick = () => Fleet.handleAction(lineId, 'start');
    }

    document.getElementById(`lc-restart-${lineId}`).disabled = !isRunning;

    // Part name — always visible, show -- when inactive
    const partNameEl = document.getElementById(`lc-part-name-${lineId}`);
    if (isRunning && telemetry?.part_name) {
      partNameEl.textContent = telemetry.part_name;
      partNameEl.className = 'lc-part-pill-value';
    } else {
      partNameEl.textContent = '--';
      partNameEl.className = 'lc-part-pill-value text-slate-500';
    }

    // Live stats — always visible, show -- when inactive
    const tatEl = document.getElementById(`lc-tat-${lineId}`);
    const totalEl = document.getElementById(`lc-total-${lineId}`);
    const passEl = document.getElementById(`lc-pass-${lineId}`);
    const failEl = document.getElementById(`lc-fail-${lineId}`);
    if (isRunning && telemetry) {
      tatEl.textContent = `${telemetry.tat ?? 0}s`;
      tatEl.className = 'lc-stat-value text-emerald';
      totalEl.textContent = (telemetry.total_inspected ?? 0).toLocaleString();
      totalEl.className = 'lc-stat-value text-blue';
      passEl.textContent = (telemetry.total_accepted ?? 0).toLocaleString();
      passEl.className = 'lc-stat-value text-emerald';
      failEl.textContent = (telemetry.total_rejected ?? 0).toLocaleString();
      failEl.className = 'lc-stat-value text-red';
    } else {
      tatEl.textContent = '--';
      tatEl.className = 'lc-stat-value text-slate-500';
      totalEl.textContent = '--';
      totalEl.className = 'lc-stat-value text-slate-500';
      passEl.textContent = '--';
      passEl.className = 'lc-stat-value text-slate-500';
      failEl.textContent = '--';
      failEl.className = 'lc-stat-value text-slate-500';
    }

    // License info
    const licInfo = document.getElementById(`lc-lic-info-${lineId}`);
    if (detail) {
      licInfo.style.display = '';
      const stateClass =
        detail.state === 'ACTIVE' ? 'badge-active' :
        detail.state === 'EXPIRED' ? 'badge-expired' :
        detail.state === 'QUOTA_EXCEEDED' ? 'badge-quota' : 'badge-idle';
      licInfo.innerHTML = `
        <i class="bi bi-shield text-slate-500" style="font-size:12px; flex-shrink:0;"></i>
        <div class="d-flex align-items-center gap-2 flex-grow-1 min-w-0">
          <span class="badge-status ${stateClass}" style="font-size:9px; padding:2px 6px;">${detail.state}</span>
          ${detail.license_id ? `<span class="text-slate-600 font-mono text-truncate" title="${detail.license_id}">${detail.license_id.slice(0, 8)}</span>` : ''}
          ${detail.expires_at ? `<span class="text-slate-500 ms-auto" style="flex-shrink:0;">Exp: ${detail.expires_at.slice(0, 10)}</span>` : ''}
        </div>`;
    } else {
      licInfo.style.display = 'none';
    }
  },

  /* ────────────────────────────────────────────────────────────────────
     Actions
     ──────────────────────────────────────────────────────────────────── */
  async handleAction(lineId, action) {
    const errorEl = document.getElementById(`lc-error-${lineId}`);
    const errorMsg = document.getElementById(`lc-error-msg-${lineId}`);
    errorEl.style.display = 'none';

    try {
      await Api.post(`/api/container/${action}/${lineId}`, {});
    } catch (err) {
      const detail = err.data?.detail;
      if (detail?.code === 'IMAGE_NOT_CACHED') {
        try {
          await Api.post('/api/container/pull', {});
          document.getElementById(`lc-pulling-${lineId}`).style.display = '';
          this.pollImageReady(lineId);
        } catch {
          errorMsg.textContent = I18n.t('fleet.card.imageDownloadFailed', {}, 'Failed to start image download.');
          errorEl.style.display = '';
        }
      } else {
        errorMsg.textContent = Api.errorDetail(err);
        errorEl.style.display = '';
      }
    }
  },

  pollImageReady(lineId) {
    const poll = setInterval(async () => {
      try {
        const res = await Api.get('/api/container/image-status');
        if (res.available) {
          clearInterval(poll);
          document.getElementById(`lc-pulling-${lineId}`).style.display = 'none';
          await Api.post(`/api/container/start/${lineId}`, {});
        } else if (res.pull_error) {
          clearInterval(poll);
          document.getElementById(`lc-pulling-${lineId}`).style.display = 'none';
          document.getElementById(`lc-error-msg-${lineId}`).textContent = res.pull_error;
          document.getElementById(`lc-error-${lineId}`).style.display = '';
        }
      } catch {}
    }, 2000);
  },

  cleanup() {
    Object.keys(this.cardIntervals).forEach(id => this.stopCardPolling(id));
    if (this._vitalsInterval) { clearInterval(this._vitalsInterval); this._vitalsInterval = null; }
    this._destroyScrollObserver();
    this._visibleCount = 0;
  },
};

// Close dropdown when clicking elsewhere
document.addEventListener('click', (e) => {
  if (Fleet._openDropdown && !e.target.closest('.lc-actions-wrap')) {
    Fleet.closeDropdown();
  }
});

window.Fleet = Fleet;
