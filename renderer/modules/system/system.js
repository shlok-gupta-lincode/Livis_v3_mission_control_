/* ══════════════════════════════════════════════════════════════════════
   system.js — System page renderer
   ══════════════════════════════════════════════════════════════════════ */

const System = {
  identity: null,
  hardware: null,
  copied: false,
  lineStats: [],
  licenseList: { active: [], unused: [] },
  sanityReport: null,

  async init() {
    try { this.identity = await Api.get('/api/system/identity'); } catch { this.identity = { machine_id: 'ERR' }; }
    try { this.hardware = await Api.get('/api/system/hardware'); } catch {}
    this.fetchLineStats();
    this.fetchLicenseList();
    setInterval(() => this.fetchLineStats(), 5000);
  },

  async fetchLineStats() {
    try {
      const linesRes = await Api.get('/api/lines');
      const ids = (linesRes.lines || []).map(l => l.line_id);
      const results = await Promise.all(ids.map(async id => {
        try {
          const res = await Api.get(`/api/container/telemetry/${id}`);
          const d = res.data || {};
          return { lineId: id, total: d.total_inspected ?? 0, running: d.tat > 0 };
        } catch { return { lineId: id, total: 0, running: false }; }
      }));
      this.lineStats = results;
      if (App?.isActivated && (App.currentPage === 'system' || App.currentPage === 'home')) {
        App.renderAll();
      }
    } catch {}
  },

  async fetchLicenseList() {
    try {
      const res = await Api.get('/api/guard/status');
      const activeLines   = res.lines || [];
      const unusedLicenses = res.unused_licenses || [];
      this.licenseList.active = activeLines
        .filter(l => l.state === 'ACTIVE')
        .map(l => ({ license_id: l.license_id, client_name: l.client_name, license_type: l.license_type, expires_at: l.expires_at, workstation: l.line_id }));
      this.licenseList.unused = unusedLicenses.map(l => ({ license_id: l.license_id, client_name: l.client_name, license_type: l.license_type, expires_at: l.expires_at }));
      if (App?.isActivated && App.currentPage === 'system') {
        App.renderAll();
      }
    } catch {}
  },

  render(state) {
    const container = document.getElementById('system-content');
    const al = state.activeLicense;
    const activeLineData = (al?.lines || []).find(l => l.state === 'ACTIVE') || (al?.unused_licenses || [])[0];
    const isCountBased = activeLineData?.license_type === 'count';
    const sanityReq = activeLineData?.sanity_requirements || {};
    const daysRemaining = activeLineData?.expires_at && !isCountBased
      ? Math.ceil((new Date(activeLineData.expires_at) - new Date()) / 86400000) : null;

    const fleetTotal = this.lineStats.reduce((s, l) => s + l.total, 0);
    const maxInspections = activeLineData?.max_inspections ?? 0;
    const remaining = Math.max(0, maxInspections - fleetTotal);
    const pctUsed = maxInspections > 0 ? Math.min((fleetTotal / maxInspections) * 100, 100) : 0;

    // ── Machine Identity ──
    const machineIdentityCard = `<div class="glass-card mb-3 h-100">
      <div class="d-flex align-items-center gap-3 mb-4 pb-3" style="border-bottom:1px solid var(--border-subtle);">
        <div style="padding:8px;border-radius:12px;background:rgba(59,130,246,0.10);border:1px solid rgba(59,130,246,0.20);">
          <i class="bi bi-shield-exclamation text-blue" style="font-size:20px;"></i>
        </div>
        <h2 class="mb-0 fw-bold" style="font-size:16px;">Machine Identity</h2>
      </div>
      <p class="text-slate-500 mb-2" style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;">Machine ID (Hardware Locked)</p>
      <div class="d-flex align-items-center gap-2">
        <code class="code-block flex-grow-1">${this.identity?.machine_id || 'Loading...'}</code>
        <button class="btn-ghost" style="padding:12px;" onclick="System.copyMachineId()" title="Copy Machine ID" id="sys-copy-btn">
          <i class="bi bi-clipboard"></i>
        </button>
      </div>
      <div class="d-flex justify-content-between align-items-center mt-3">
        <p class="text-slate-600 mb-0" style="font-size:12px;">Share this ID with your vendor to generate a hardware-locked license.</p>
        <button class="btn-ghost ms-3" style="flex-shrink:0;font-size:12px;padding:6px 12px;" onclick="System.downloadProfile()" id="sys-dl-btn">
          <i class="bi bi-download"></i> Download Profile
        </button>
      </div>
    </div>`;

    // ── Active License ──
    const licIcon = isCountBased ? 'bi-upc-scan text-indigo' : 'bi-calendar-check text-emerald';
    const licBadgeText = isCountBased ? 'Inspection Quota' : 'Date-Based';
    const licBadgeClass = isCountBased ? 'text-indigo' : 'text-emerald';

    let daysOrPctBadge = '';
    if (!isCountBased && daysRemaining !== null) {
      const dc = daysRemaining <= 30 ? 'badge-quota' : 'badge-active';
      daysOrPctBadge = `<span class="badge-status ${dc}">${daysRemaining} days remaining</span>`;
    }
    if (isCountBased) {
      const pc = pctUsed >= 90 ? 'badge-expired' : pctUsed >= 75 ? 'badge-quota' : 'badge-count';
      daysOrPctBadge = `<span class="badge-status ${pc}">${pctUsed.toFixed(1)}% used</span>`;
    }

    const activeLicenseCard = `<div class="glass-card mb-3 h-100">
      <div class="d-flex align-items-center justify-content-between mb-4 pb-3" style="border-bottom:1px solid var(--border-subtle);">
        <div class="d-flex align-items-center gap-3">
          <div style="padding:8px;border-radius:12px;background:${isCountBased ? 'rgba(99,102,241,0.10)' : 'rgba(16,185,129,0.10)'};border:1px solid ${isCountBased ? 'rgba(99,102,241,0.20)' : 'rgba(16,185,129,0.20)'};">
            <i class="bi ${licIcon}" style="font-size:20px;"></i>
          </div>
          <div>
            <h2 class="mb-0 fw-bold" style="font-size:16px;">Active License</h2>
            <span class="${licBadgeClass} fw-bold" style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;">${licBadgeText}</span>
          </div>
        </div>
        ${daysOrPctBadge}
      </div>`;
    let activeLicenseCardContent = '';

    if (!isCountBased) {
      // Date-based grid
      const dateItems = [
        { label: 'Active Workstations', value: this.lineStats.length || '0', accent: true },
        { label: 'Expiry Date', value: activeLineData?.expires_at ? activeLineData.expires_at.slice(0,10) : '—' },
        { label: 'Grace Period', value: activeLineData?.grace_period_days ? `${activeLineData.grace_period_days}d` : '—' },
        { label: 'Min RAM', value: sanityReq.min_ram_gb ? `${sanityReq.min_ram_gb} GB` : '—' },
        { label: 'GPU VRAM', value: sanityReq.gpu_vram_gb ? `${sanityReq.gpu_vram_gb} GB` : '—' },
        { label: 'NVIDIA Driver', value: sanityReq.nvidia_driver ?? '—' },
      ];
      activeLicenseCardContent = `<div class="row g-3">${dateItems.map(i => `
        <div class="col-4"><div class="stat-box">
          <p class="label mb-1">${i.label}</p>
          <p class="value mb-0 ${i.accent ? 'text-blue' : ''}" style="font-size:${i.accent ? '24px' : '14px'};">${i.value}</p>
        </div></div>`).join('')}</div>`;
    } else {
      // Count-based
      const barColor = pctUsed >= 90 ? 'var(--red)' : pctUsed >= 75 ? 'var(--amber)' : 'var(--indigo)';
      const remColor = pctUsed >= 90 ? 'text-red' : pctUsed >= 75 ? 'text-amber' : 'text-emerald';
      activeLicenseCardContent = `
        <div class="stat-box mb-3 p-4">
          <div class="d-flex justify-content-between align-items-end mb-2">
            <div>
              <p class="label mb-0">Total Fleet Inspections</p>
              <p class="text-indigo fw-black font-mono mb-0" style="font-size:24px;">${fleetTotal.toLocaleString()} <span class="text-slate-500 fw-normal" style="font-size:14px;">/ ${maxInspections.toLocaleString()}</span></p>
            </div>
            <div class="text-end">
              <p class="label mb-0">Remaining</p>
              <p class="fw-bold font-mono ${remColor} mb-0" style="font-size:18px;">${remaining.toLocaleString()}</p>
            </div>
          </div>
          <div class="progress-bar-custom"><div class="fill" style="width:${pctUsed}%;background:${barColor};"></div></div>
          <div class="d-flex justify-content-between mt-1" style="font-size:9px;color:#475569;">
            <span>0</span>
            <span class="d-flex align-items-center gap-1"><i class="bi bi-lightning"></i> Updated live · every 5s</span>
            <span>${maxInspections.toLocaleString()}</span>
          </div>
        </div>

        <p class="label mb-2">Per-Workstation Breakdown</p>
        <div class="table-dark-custom mb-3">
          <table class="table mb-0"><thead><tr>
            <th class="text-start">Workstation</th><th class="text-end">Inspections</th><th class="text-end">Share</th><th class="text-end">Status</th>
          </tr></thead><tbody>
          ${this.lineStats.length === 0 ? `<tr><td colspan="4" class="text-center py-4 text-slate-600"><i class="bi bi-arrow-repeat spin"></i> Fetching...</td></tr>` :
            this.lineStats.map(s => `<tr>
              <td class="fw-bold">Workstation ${s.lineId}</td>
              <td class="text-end font-mono text-indigo">${s.total.toLocaleString()}</td>
              <td class="text-end text-slate-500">${fleetTotal > 0 ? `${((s.total/fleetTotal)*100).toFixed(1)}%` : '—'}</td>
              <td class="text-end"><span class="badge-status ${s.running ? 'badge-running' : 'badge-idle'}" style="font-size:9px;padding:2px 8px;">
                <span style="width:4px;height:4px;border-radius:50%;background:${s.running ? '#34d399' : '#64748b'};display:inline-block;"></span>
                ${s.running ? 'Running' : 'Stopped'}</span></td>
            </tr>`).join('')}
          </tbody>
          ${this.lineStats.length > 0 ? `<tfoot><tr>
            <td class="fw-bold text-slate-400" style="font-size:10px;text-transform:uppercase;">Fleet Total</td>
            <td class="text-end font-mono fw-bold text-indigo">${fleetTotal.toLocaleString()}</td>
            <td class="text-end text-slate-500" style="font-size:10px;">100%</td><td></td>
          </tr></tfoot>` : ''}
          </table>
        </div>

        <div class="row g-3">${[
          { label: 'Active Workstations', value: this.lineStats.length || '0' },
          { label: 'Grace Period', value: activeLineData?.grace_period_days ? `${activeLineData.grace_period_days}d` : '—' },
          { label: 'Issued', value: activeLineData?.issued_at ? activeLineData.issued_at.split('T')[0] : '—' },
        ].map(i => `<div class="col-4"><div class="stat-box">
          <p class="label mb-1">${i.label}</p><p class="value mb-0" style="font-size:14px;">${i.value}</p>
        </div></div>`).join('')}</div>`;
    }
    const activeLicenseCardFull = `${activeLicenseCard}${activeLicenseCardContent}</div>`;

    // ── Update License ──
    const updateLicenseCard = `<div class="glass-card mb-3 h-100">
      <div class="d-flex align-items-center gap-3 mb-4 pb-3" style="border-bottom:1px solid var(--border-subtle);">
        <div style="padding:8px;border-radius:12px;background:rgba(99,102,241,0.10);border:1px solid rgba(99,102,241,0.20);">
          <i class="bi bi-arrow-clockwise text-indigo" style="font-size:20px;"></i>
        </div>
        <h2 class="mb-0 fw-bold" style="font-size:16px;">Update License</h2>
      </div>
      <div id="sys-upload-section" class="text-center py-3">
        <div style="width:48px;height:48px;border-radius:12px;background:rgba(255,255,255,0.05);border:1px solid var(--border-light);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
          <i class="bi bi-upload text-slate-400" style="font-size:20px;"></i>
        </div>
        <p class="text-slate-500 mb-4" style="font-size:14px;">Upload a new <code class="text-blue">.livis</code> file to replace the active license.</p>
        <label class="btn-primary-glow" style="cursor:pointer;font-size:13px;">
          <i class="bi bi-upload"></i> Browse Files
          <input type="file" accept=".livis" id="sys-license-file" style="display:none;">
        </label>
      </div>
      <div id="sys-upload-report" style="display:none;"></div>
    </div>`;

    // ── License Manager ──
    const licenseManagerCard = `<div class="glass-card h-100">
      <div class="d-flex align-items-center justify-content-between mb-4 pb-3" style="border-bottom:1px solid var(--border-subtle);">
        <div class="d-flex align-items-center gap-3">
          <div style="padding:8px;border-radius:12px;background:rgba(139,92,246,0.10);border:1px solid rgba(139,92,246,0.20);">
            <i class="bi bi-key text-violet" style="font-size:20px;"></i>
          </div>
          <h2 class="mb-0 fw-bold" style="font-size:16px;">License Manager</h2>
        </div>
        <button class="btn-ghost" style="font-size:12px;padding:6px 12px;" onclick="System.fetchAndRender()">
          <i class="bi bi-arrow-clockwise"></i> Refresh
        </button>
      </div>

      <!-- Active -->
      <p class="d-flex align-items-center gap-2 mb-3" style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;">
        <span style="width:6px;height:6px;border-radius:50%;background:#34d399;display:inline-block;"></span>
        Active Licenses (${this.licenseList.active.length})
      </p>
      ${this.licenseList.active.length === 0 ? '<p class="text-slate-600 text-center py-3" style="font-size:12px;">No active licenses.</p>' :
        `<div class="table-dark-custom mb-4"><table class="table mb-0"><thead><tr>
          <th>License ID</th><th>Client</th><th>Type</th><th>Expires</th><th>Workstation</th>
        </tr></thead><tbody>
        ${this.licenseList.active.map(l => `<tr>
          <td class="font-mono text-slate-400">${l.license_id?.slice(0,8)}...</td>
          <td class="fw-medium">${l.client_name || '—'}</td>
          <td><span class="badge-status ${l.license_type === 'count' ? 'badge-count' : 'badge-active'}" style="font-size:10px;padding:2px 8px;">${l.license_type === 'count' ? 'Quota' : 'Date'}</span></td>
          <td class="text-slate-300">${l.expires_at ? l.expires_at.slice(0,10) : '—'}</td>
          <td><span class="badge-status badge-count" style="font-size:10px;padding:2px 8px;"><i class="bi bi-shield" style="font-size:10px;"></i> WS ${l.workstation}</span></td>
        </tr>`).join('')}
        </tbody></table></div>`}

      <!-- Unused -->
      <p class="d-flex align-items-center gap-2 mb-3" style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;">
        <span style="width:6px;height:6px;border-radius:50%;background:#64748b;display:inline-block;"></span>
        Unused Licenses (${this.licenseList.unused.length})
      </p>
      ${this.licenseList.unused.length === 0 ? '<p class="text-slate-600 text-center py-3" style="font-size:12px;">No unused licenses in pool.</p>' :
        `<div class="table-dark-custom"><table class="table mb-0"><thead><tr>
          <th>License ID</th><th>Client</th><th>Type</th><th>Expires</th><th class="text-end">Action</th>
        </tr></thead><tbody>
        ${this.licenseList.unused.map(l => `<tr>
          <td class="font-mono text-slate-400">${l.license_id?.slice(0,8)}...</td>
          <td class="fw-medium">${l.client_name || '—'}</td>
          <td><span class="badge-status ${l.license_type === 'count' ? 'badge-count' : 'badge-idle'}" style="font-size:10px;padding:2px 8px;">${l.license_type === 'count' ? 'Quota' : 'Date'}</span></td>
          <td class="text-slate-300">${l.expires_at ? l.expires_at.slice(0,10) : '—'}</td>
          <td class="text-end">
            <button class="btn-outline-red" onclick="System.handleDeleteLicense('${l.license_id}','${l.client_name || ''}')">
              <i class="bi bi-trash3"></i> Delete
            </button>
          </td>
        </tr>`).join('')}
        </tbody></table></div>`}

      <div id="sys-lic-delete-error" class="alert-banner red mt-3" style="display:none;"></div>
    </div>`;

    const html = `
      <div class="row g-3 align-items-stretch">
        <div class="col-12 col-xl-6 d-flex flex-column">
          ${machineIdentityCard}
          ${activeLicenseCardFull}
        </div>
        <div class="col-12 col-xl-6 d-flex flex-column">
          ${updateLicenseCard}
          ${licenseManagerCard}
        </div>
      </div>
    `;

    container.innerHTML = html;

    // Wire up license upload
    setTimeout(() => {
      const fileInput = document.getElementById('sys-license-file');
      if (fileInput) fileInput.addEventListener('change', (e) => System.handleLicenseUpload(e));
    }, 100);
  },

  async copyMachineId() {
    if (!this.identity?.machine_id) return;
    await navigator.clipboard.writeText(this.identity.machine_id);
    const btn = document.getElementById('sys-copy-btn');
    btn.innerHTML = '<i class="bi bi-check-lg text-emerald"></i>';
    setTimeout(() => { btn.innerHTML = '<i class="bi bi-clipboard"></i>'; }, 2000);
  },

  async downloadProfile() {
    const btn = document.getElementById('sys-dl-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Generating...';
    try {
      const data = await Api.get('/api/system/machine-profile');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `machine_profile_${(data.machine_id || 'unknown').slice(0,8)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-download"></i> Download Profile';
  },

  async handleLicenseUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = '';
    const fd = new FormData();
    fd.append('file', file);
    const section = document.getElementById('sys-upload-section');
    section.innerHTML = '<div class="text-center py-4"><i class="bi bi-arrow-repeat spin text-blue" style="font-size:40px;"></i><p class="text-slate-500 mt-3">Verifying with Guard service...</p></div>';

    const reportEl = document.getElementById('sys-upload-report');
    try {
      const data = await Api.postForm('/api/guard/upload-license', fd);
      const sanity = data.sanity_requirements || {};
      const validityRow = data.license_type === 'count'
        ? { check: 'Inspection Quota', passed: true, detail: `${Number(data.max_inspections).toLocaleString()} total inspections authorized` }
        : { check: 'License Validity', passed: true, detail: `Expires ${data.expires_at}  ·  Grace ${data.grace_period_days}d` };
      const report = [
        { check: 'Fernet Signature', passed: true, detail: 'HMAC valid' },
        { check: 'Machine ID Binding', passed: true, detail: `Locked to ${data.machine_id}` },
        validityRow,
        { check: 'License ID', passed: true, detail: data.license_id || 'N/A' },
        ...(sanity.min_ram_gb ? [{ check: 'RAM Requirement', passed: true, detail: `Min ${sanity.min_ram_gb} GB` }] : []),
        ...(sanity.nvidia_driver ? [{ check: 'NVIDIA Driver', passed: true, detail: `>= ${sanity.nvidia_driver}  ·  CUDA ${sanity.cuda_version}` }] : []),
      ];
      reportEl.innerHTML = report.map(i => `<div class="check-row ${i.passed ? 'pass' : 'fail'} mb-2">
        <i class="bi ${i.passed ? 'bi-check-circle-fill text-emerald' : 'bi-x-circle-fill text-red'}" style="font-size:16px;flex-shrink:0;"></i>
        <div><span class="fw-semibold text-slate-200" style="font-size:13px;">${i.check}</span>
        <p class="text-slate-500 mb-0 mt-1" style="font-size:11px;">${i.detail}</p></div>
      </div>`).join('') + '<p class="text-center text-emerald fw-semibold mt-3" style="font-size:14px;">License updated successfully!</p>';
      reportEl.style.display = '';
      section.style.display = 'none';
      setTimeout(() => App.activate(data), 1500);
    } catch (err) {
      const detail = Api.errorDetail(err);
      reportEl.innerHTML = `<div class="check-row fail mb-2">
        <i class="bi bi-x-circle-fill text-red" style="font-size:16px;flex-shrink:0;"></i>
        <div><span class="fw-semibold text-slate-200" style="font-size:13px;">Upload Failed</span>
        <p class="text-slate-500 mb-0 mt-1" style="font-size:11px;">${detail}</p></div>
      </div>
      <button class="btn-ghost w-100 mt-2" onclick="System.fetchAndRender()">Try Different License</button>`;
      reportEl.style.display = '';
      section.style.display = 'none';
    }
  },

  handleDeleteLicense(licenseId, clientName) {
    Modals.openDeleteWarn(licenseId, clientName, async () => {
      // After PIN verified, delete
      try {
        await Api.delete(`/guard/licenses/${licenseId}`);
        await this.fetchLicenseList();
        App.fetchGuardStatus();
        this.render(App.state);
      } catch (err) {
        const el = document.getElementById('sys-lic-delete-error');
        el.innerHTML = `<i class="bi bi-exclamation-triangle" style="flex-shrink:0;"></i> ${Api.errorDetail(err)}`;
        el.style.display = '';
      }
    });
  },

  async fetchAndRender() {
    await this.fetchLicenseList();
    this.render(App.state);
  },
};

window.System = System;
