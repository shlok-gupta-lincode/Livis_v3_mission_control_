/* ══════════════════════════════════════════════════════════════════════
   toast.js — Update notification toast
   ══════════════════════════════════════════════════════════════════════ */

const Toast = {
  _timer: null,
  _dismissed: false,

  show(pending) {
    if (this._dismissed || !pending?.release) return;
    const release = pending.release;
    const channel = release.channel || 'stable';
    const channelClasses = { stable: 'badge-stable', rc: 'badge-rc', beta: 'badge-beta', alpha: 'badge-alpha' };

    document.getElementById('toast-version').textContent = release.version || '';
    const chBadge = document.getElementById('toast-channel');
    chBadge.className = `badge-status ${channelClasses[channel] || 'badge-stable'}`;
    chBadge.textContent = channel;

    const feature = release.features?.[0] || I18n.t('toast.defaultFeature', {}, 'A new update is available for your workstations.');
    document.getElementById('toast-feature').textContent = feature;

    const toast = document.getElementById('update-toast');
    toast.classList.add('visible');

    // Auto dismiss after 30s
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.hide(), 30000);
  },

  hide() {
    clearTimeout(this._timer);
    document.getElementById('update-toast').classList.remove('visible');
  },

  dismiss() {
    this._dismissed = true;
    this.hide();
  },

  init() {
    document.getElementById('toast-dismiss').addEventListener('click', () => this.dismiss());
    document.getElementById('toast-later').addEventListener('click', () => this.dismiss());
    document.getElementById('toast-view').addEventListener('click', () => {
      this.hide();
      if (App.pendingUpdate) {
        const lineIds = (App.state.activeLicense?.lines || []).filter(l => l.state === 'ACTIVE').map(l => l.line_id);
        Modals.openUpdateCenter(App.pendingUpdate, lineIds);
      }
    });
  },
};

window.Toast = Toast;
