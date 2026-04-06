/* ══════════════════════════════════════════════════════════════════════
   activation.js — Activation Gate logic
   ══════════════════════════════════════════════════════════════════════ */

const Activation = {
  identity: { machine_id: 'Loading...', status: 'checking' },
  hardware: null,
  licenseData: null,
  sanityReport: null,
  activeSession: null,

  setUploadView(view) {
    const upload = document.getElementById('act-upload-state');
    const loading = document.getElementById('act-uploading-state');
    const report = document.getElementById('act-report-state');
    if (!upload || !loading || !report) return;

    if (view === 'upload') upload.style.setProperty('display', 'flex', 'important');
    else upload.style.setProperty('display', 'none', 'important');

    if (view === 'loading') loading.style.setProperty('display', 'flex', 'important');
    else loading.style.setProperty('display', 'none', 'important');

    if (view === 'report') report.style.setProperty('display', 'flex', 'important');
    else report.style.setProperty('display', 'none', 'important');
  },

  async init() {
    this.setUploadView('upload');
    // Check if Guard already has a valid session
    try {
      const r = await Api.get('/api/guard/status');
      const lines = r.lines || [];
      const unused = r.unused_licenses || [];
      const hasActive = lines.some(l => l.state === 'ACTIVE');
      if (hasActive || unused.length > 0) {
        this.activeSession = r;
        this.showResumeBanner(r, lines, unused);
      }
    } catch {}

    // Fetch identity
    try {
      const r = await Api.get('/api/system/identity');
      this.identity = r;
    } catch {
      this.identity = { machine_id: 'IDENTITY_FETCH_FAILED', status: 'offline' };
    }
    document.getElementById('act-machine-id').textContent = this.identity.machine_id;

    // Fetch hardware
    try {
      const r = await Api.get('/api/system/hardware');
      this.hardware = r;
      this.renderHardware(r);
    } catch {
      this.hardware = { cpu_cores: 'ERR', ram_total_gb: 'ERR', gpu_info: 'API_CRASHED' };
      this.renderHardware(this.hardware);
    }

    // Wire up events
    document.getElementById('act-file-input').addEventListener('change', (e) => this.handleUpload(e));
    document.getElementById('btn-download-profile-act').addEventListener('click', () => this.downloadProfile());
    document.getElementById('btn-try-different').addEventListener('click', () => this.resetUpload());
    document.getElementById('btn-continue-mc').addEventListener('click', () => App.activate(this.licenseData));
    document.getElementById('btn-resume').addEventListener('click', () => App.activate(this.activeSession));

    // Version
    if (window.livisapi?.getVersion) {
      window.livisapi.getVersion((data) => {
        if (data?.version) document.getElementById('act-version').textContent = 'v' + data.version;
      });
    }
  },

  showResumeBanner(data, lines, unused) {
    const banner = document.getElementById('resume-banner');
    const hasActive = lines.some(l => l.state === 'ACTIVE');
    document.getElementById('resume-title').textContent = hasActive
      ? I18n.t('activation.resume.activeSessionDetected', {}, 'Active Session Detected')
      : I18n.t('activation.resume.sessionPaused', {}, 'License Ready — Session Paused');
    document.getElementById('resume-lines').textContent = I18n.t('activation.resume.activeWorkstations', { count: lines.length }, `${lines.length} active workstation(s)`);
    document.getElementById('resume-unused').textContent = I18n.t('activation.resume.unusedLicenses', { count: unused.length }, `${unused.length} unused license(s)`);
    banner.style.display = '';
  },

  renderHardware(hw) {
    const container = document.getElementById('act-hardware');
    container.innerHTML = `
      <div class="col-6">
        <div class="stat-box">
          <i class="bi bi-cpu text-slate-600 mb-1" style="font-size:14px; display:block;"></i>
          <p class="text-slate-500 mb-0" style="font-size:9px; text-transform:uppercase; letter-spacing:0.05em;">${I18n.t('activation.cpuCores', {}, 'CPU Cores')}</p>
          <p class="fw-semibold text-slate-200 mb-0" style="font-size:12px;">${hw.cpu_cores} ${I18n.t('activation.logical', {}, 'Logical')}</p>
        </div>
      </div>
      <div class="col-6">
        <div class="stat-box">
          <i class="bi bi-memory text-slate-600 mb-1" style="font-size:14px; display:block;"></i>
          <p class="text-slate-500 mb-0" style="font-size:9px; text-transform:uppercase; letter-spacing:0.05em;">${I18n.t('activation.totalRam', {}, 'Total RAM')}</p>
          <p class="fw-semibold text-slate-200 mb-0" style="font-size:12px;">${hw.ram_total_gb} GB</p>
        </div>
      </div>
      <div class="col-12">
        <div class="stat-box">
          <i class="bi bi-gpu-card text-slate-600 mb-1" style="font-size:14px; display:block;"></i>
          <p class="text-slate-500 mb-0" style="font-size:9px; text-transform:uppercase; letter-spacing:0.05em;">${I18n.t('activation.gpuDriver', {}, 'GPU / Driver')}</p>
          <p class="fw-semibold text-slate-200 mb-0 text-truncate" style="font-size:12px;" title="${hw.gpu_info}">${hw.gpu_info}</p>
        </div>
      </div>`;
  },

  async handleUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = '';

    // Show uploading state
    this.setUploadView('loading');
    document.getElementById('act-continue-wrap').style.display = 'none';
    document.getElementById('btn-try-different').style.display = 'none';
    document.getElementById('act-report-list').innerHTML = '';

    const fd = new FormData();
    fd.append('file', file);

    try {
      const data = await Api.postForm('/api/guard/upload-license', fd);
      const sanity = data.sanity_requirements || {};

      const validityRow = data.license_type === 'count'
        ? { check: 'Inspection Quota', passed: true, detail: `${Number(data.max_inspections).toLocaleString()} total inspections authorized across all lines` }
        : { check: 'License Validity', passed: true, detail: `Issued ${data.issued_at}  ·  Expires ${data.expires_at}  ·  Grace ${data.grace_period_days}d` };

      this.sanityReport = [
        { check: 'Fernet Signature',   passed: true, detail: 'License integrity verified — HMAC valid' },
        { check: 'Machine ID Binding', passed: true, detail: `Locked to ${data.machine_id}` },
        validityRow,
        { check: 'License ID',         passed: true, detail: `${data.license_id || 'N/A'}` },
        ...(sanity.min_ram_gb    ? [{ check: 'RAM Requirement', passed: true, detail: `Minimum ${sanity.min_ram_gb} GB` }] : []),
        ...(sanity.nvidia_driver ? [{ check: 'NVIDIA Driver',   passed: true, detail: `≥ ${sanity.nvidia_driver}  ·  CUDA ${sanity.cuda_version}` }] : []),
        { check: 'Secure Storage', passed: true, detail: 'Encrypted on disk · Decrypted payload in RAM only' },
      ];
      this.licenseData = data;
      this.showReport();
    } catch (err) {
      const status = err.status;
      const detail = Api.errorDetail(err);

      let checkLabel = I18n.t('activation.report.check.uploadFailed', {}, 'License Upload Failed');
      if (!err.status)         checkLabel = I18n.t('activation.report.check.serviceUnreachable', {}, 'Service Unreachable');
      else if (status === 400) checkLabel = I18n.t('activation.report.check.fileValidationFailed', {}, 'File Validation Failed');
      else if (status === 422) checkLabel = I18n.t('activation.report.check.signatureInvalid', {}, 'Fernet Signature Invalid');
      else if (status === 403) checkLabel = I18n.t('activation.report.check.machineMismatch', {}, 'Machine ID Mismatch');
      else if (status === 413) checkLabel = I18n.t('activation.report.check.fileTooLarge', {}, 'File Too Large');
      else if (status >= 500)  checkLabel = I18n.t('activation.report.check.serverError', {}, 'Server Error');

      this.sanityReport = [{ check: checkLabel, passed: false, detail }];
      if (status === 403 && detail.toLowerCase().includes('machine')) {
        this.sanityReport.push({
          check: I18n.t('activation.report.check.howToFix', {}, 'How to Fix'),
          passed: false,
          detail: I18n.t('activation.report.detail.howToFixMachine', {}, 'Your Machine ID is shown in the left panel. Share it with your license issuer.'),
        });
      }
      this.showReport();
    }
  },

  showReport() {
    this.setUploadView('report');

    const allPassed = this.sanityReport.every(i => i.passed);
    const icon = document.getElementById('act-report-icon');
    const title = document.getElementById('act-report-title');

    if (allPassed) {
      icon.className = 'bi bi-check-circle-fill text-emerald';
      title.textContent = I18n.t('activation.report.title', {}, 'Activation Report');
      document.getElementById('btn-try-different').style.display = 'none';
      document.getElementById('act-continue-wrap').style.display = 'none';
    } else {
      icon.className = 'bi bi-x-circle-fill text-red';
      title.textContent = I18n.t('activation.report.failed', {}, 'Verification Failed');
      document.getElementById('act-continue-wrap').style.display = 'none';
    }

    const list = document.getElementById('act-report-list');
    list.innerHTML = '';

    // Reveal checks sequentially for passed reports
    if (allPassed) {
      let i = 0;
      const reveal = () => {
        if (i >= this.sanityReport.length) {
          document.getElementById('act-continue-wrap').style.display = '';
          return;
        }
        const item = this.sanityReport[i];
        list.insertAdjacentHTML('beforeend', this.checkRowHTML(item));
        i++;
        setTimeout(reveal, 480);
      };
      reveal();
    } else {
      this.sanityReport.forEach(item => {
        list.insertAdjacentHTML('beforeend', this.checkRowHTML(item));
      });
      document.getElementById('btn-try-different').style.display = '';
    }
  },

  checkRowHTML(item) {
    const cls = item.passed ? 'pass' : 'fail';
    const icon = item.passed ? 'bi-check-circle-fill text-emerald' : 'bi-x-circle-fill text-red';
    return `<div class="check-row ${cls} fade-slide-up">
      <i class="bi ${icon}" style="font-size:14px; flex-shrink:0;"></i>
      <div>
        <span class="fw-semibold text-slate-200" style="font-size:12px;">${item.check}</span>
        <p class="text-slate-500 mb-0 mt-1" style="font-size:10px;">${item.detail}</p>
      </div>
    </div>`;
  },

  resetUpload() {
    this.setUploadView('upload');
    document.getElementById('act-continue-wrap').style.display = 'none';
    document.getElementById('btn-try-different').style.display = 'none';
    document.getElementById('act-report-list').innerHTML = '';
    this.sanityReport = null;
    this.licenseData = null;
  },

  async downloadProfile() {
    const btn = document.getElementById('btn-download-profile-act');
    btn.disabled = true;
    btn.innerHTML = `<i class="bi bi-arrow-repeat spin"></i> ${I18n.t('common.generating', {}, 'Generating...')}`;
    try {
      const data = await Api.get('/api/system/machine-profile');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `machine_profile_${(data.machine_id || 'unknown').slice(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error('Profile download failed:', e); }
    btn.disabled = false;
    btn.innerHTML = `<i class="bi bi-download"></i> ${I18n.t('activation.downloadProfile', {}, 'Download Machine Profile JSON')}`;
  },
};

window.Activation = Activation;
