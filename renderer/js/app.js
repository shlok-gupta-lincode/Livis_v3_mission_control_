/* ══════════════════════════════════════════════════════════════════════
   app.js — Main application controller
   State management, routing, and polling orchestration
   ══════════════════════════════════════════════════════════════════════ */

const App = {
  currentPage: 'home',
  isActivated: false,
  pendingUpdate: null,

  state: {
    activeLicense: null,
    fleetLines: [],
    hardware: null,
  },

  intervals: {},

  async boot() {
    // Try to connect to daemon and guard
    let guardOk = false;
    try {
      const res = await Api.get('/api/guard/status');
      const lines = res.lines || [];
      const unused = res.unused_licenses || [];
      const hasActive = lines.some(l => l.state === 'ACTIVE');
      if (hasActive || unused.length > 0) {
        // Already activated — go straight to dashboard
        this.state.activeLicense = res;
        guardOk = true;
      }
    } catch {}

    if (guardOk) {
      this.activate(this.state.activeLicense);
    } else {
      // Show activation gate
      document.getElementById('boot-screen').style.display = 'none';
      document.getElementById('activation-gate').style.display = '';
      Activation.init();
    }
  },

  activate(licenseData) {
    this.isActivated = true;
    this.state.activeLicense = licenseData || this.state.activeLicense;

    // Switch to main app
    document.getElementById('boot-screen').style.display = 'none';
    document.getElementById('activation-gate').style.display = 'none';
    document.getElementById('main-app').style.display = '';

    // Initialize modules
    SystemPulse.init();
    System.init();
    Toast.init();
    Router.init();

    // Wire action buttons
    document.getElementById('btn-add-line').addEventListener('click', () => this._openAddLine());
    document.getElementById('btn-add-line-empty')?.addEventListener('click', () => this._openAddLine());
    document.getElementById('btn-bulk-update').addEventListener('click', () => this._openBulkUpdate());
    document.getElementById('btn-banner-review').addEventListener('click', () => this._openUpdateCenter());

    // Notification button opens update center
    document.getElementById('btn-notification').addEventListener('click', () => this._openUpdateCenter());

    // Start polling
    this.fetchFleetLines();
    this.fetchGuardStatus();
    this.fetchHardware();
    this.checkUpdates();

    this.intervals.fleet    = setInterval(() => this.fetchFleetLines(), 5000);
    this.intervals.guard    = setInterval(() => this.fetchGuardStatus(), 10000);
    this.intervals.hardware = setInterval(() => this.fetchHardware(), 3000);
    this.intervals.updates  = setInterval(() => this.checkUpdates(), 30000);

    // Initial route
    Router.navigate('home');
  },

  goToLicenseManager() {
    this.isActivated = false;
    Fleet.cleanup();
    Object.values(this.intervals).forEach(i => clearInterval(i));
    this.intervals = {};
    document.getElementById('main-app').style.display = 'none';
    document.getElementById('activation-gate').style.display = '';
    Activation.init();
  },

  get currentPage() {
    return Router.currentPage;
  },

  set currentPage(val) {
    // Managed by Router
  },

  renderAll() {
    // Update header status
    const activeLines = (this.state.activeLicense?.lines || []).filter(l => l.state === 'ACTIVE');
    const unusedLicenses = this.state.activeLicense?.unused_licenses || [];

    // Update status pill text
    const statusText = document.getElementById('header-status-text');
    if (activeLines.length > 0) {
      statusText.textContent = `${activeLines.length} ACTIVE · ${unusedLicenses.length} UNUSED`;
    } else {
      statusText.textContent = 'SYSTEM ACTIVE';
    }

    // Update banner
    this.updateBanner();

    // Render active page
    const page = Router.currentPage;
    switch (page) {
      case 'home':
        Home.render(this.state);
        break;
      case 'fleet':
        Fleet.render(this.state);
        break;
      case 'system':
        System.render(this.state);
        break;
    }
  },

  async fetchFleetLines() {
    try {
      const res = await Api.get('/api/lines');
      this.state.fleetLines = res.lines || [];
      this.renderAll();
    } catch {}
  },

  async fetchGuardStatus() {
    try {
      const res = await Api.get('/api/guard/status');
      this.state.activeLicense = res;
      this.renderAll();
    } catch {}
  },

  async fetchHardware() {
    try {
      const res = await Api.get('/api/system/hardware');
      this.state.hardware = res;
      SystemPulse.update(
        res.cpu_percent ?? 0,
        res.ram_percent ?? 0,
        res.disk_free_gb ?? 0,
        res.gpu_temp ?? null,
      );
      // Keep Home analytics reactive
      if (this.isActivated && Router.currentPage === 'home') this.renderAll();
    } catch {}
  },

  async checkUpdates() {
    try {
      const res = await Api.get('/api/updates/pending');
      if (res && res.release) {
        this.pendingUpdate = res;
        Toast.show(res);
      } else {
        this.pendingUpdate = null;
      }
    } catch {}
    this.updateBanner();
  },

  updateBanner() {
    const banner = document.getElementById('update-banner');
    const dot = document.getElementById('update-dot');
    if (this.pendingUpdate?.release) {
      const r = this.pendingUpdate.release;
      banner.style.display = '';
      dot.style.display = '';
      document.getElementById('banner-version').textContent = r.version || '';
      const channelClasses = { stable: 'badge-stable', rc: 'badge-rc', beta: 'badge-beta', alpha: 'badge-alpha' };
      const chBadge = document.getElementById('banner-channel');
      chBadge.className = `badge-status ${channelClasses[r.channel] || 'badge-stable'}`;
      chBadge.textContent = r.channel;
      document.getElementById('banner-feature').textContent = r.features?.[0] || '';
    } else {
      banner.style.display = 'none';
      dot.style.display = 'none';
    }
  },

  _openAddLine() {
    const unusedLicenses = this.state.activeLicense?.unused_licenses || [];
    const activeLines = (this.state.activeLicense?.lines || []).filter(l => l.state === 'ACTIVE');
    Modals.openAddLine(unusedLicenses, activeLines);
  },

  _openBulkUpdate() {
    const lineIds = (this.state.activeLicense?.lines || []).filter(l => l.state === 'ACTIVE').map(l => l.line_id);
    Modals.openBulk(lineIds);
  },

  _openUpdateCenter() {
    if (!this.pendingUpdate) return;
    const lineIds = (this.state.activeLicense?.lines || []).filter(l => l.state === 'ACTIVE').map(l => l.line_id);
    Modals.openUpdateCenter(this.pendingUpdate, lineIds);
  },
};

// ── Bootstrap ──
document.addEventListener('DOMContentLoaded', () => App.boot());

window.App = App;
