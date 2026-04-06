/* ══════════════════════════════════════════════════════════════════════
   home.js — Home page renderer
   ══════════════════════════════════════════════════════════════════════ */

const Home = {
  telemetryHistory: {
    selected: 'overall',
    maxPoints: 36,
    overall: [],
    lines: {},
  },
  telemetryInterval: null,

  render(state) {
    const activeLines = (state.activeLicense?.lines || []).filter(l => l.state === 'ACTIVE');
    const unusedLicenses = state.activeLicense?.unused_licenses || [];
    const totalLines = state.fleetLines.length;
    const timeOk = state.activeLicense?.time_watermark_ok;
    const telemetryRows = Array.isArray(System?.lineStats) ? System.lineStats : [];
    const totalInspections = telemetryRows.reduce((sum, row) => sum + (row.total || 0), 0);
    const runningNow = telemetryRows.filter(row => row.running).length;
    const quotaFromLicense = activeLines.find(line => line.license_type === 'count')?.max_inspections || 0;
    const quotaPct = quotaFromLicense > 0
      ? Math.min((totalInspections / quotaFromLicense) * 100, 100)
      : 0;
    const avgPerWorkstation = totalLines > 0 ? Math.round(totalInspections / totalLines) : 0;

    // License overview grid
    const grid = document.getElementById('home-license-grid');
    const items = [
      { label: 'Active Workstations', value: activeLines.length, color: 'text-emerald' },
      { label: 'Total Workstations', value: totalLines, color: '' },
      { label: 'Unused Licenses', value: unusedLicenses.length, color: 'text-blue' },
      { label: 'Time Watermark', value: timeOk ? 'OK' : 'WARN', color: timeOk ? 'text-emerald' : 'text-amber' },
    ];
    grid.innerHTML = items.map(i => `
      <div class="col-6 col-md-3">
        <div class="glass-panel">
          <p class="text-slate-600 mb-1" style="font-size:10px; text-transform:uppercase; letter-spacing:0.05em;">${i.label}</p>
          <p class="fw-bold font-mono mb-0 ${i.color}" style="font-size:18px;">${i.value}</p>
        </div>
      </div>`).join('');

    // Quick action count
    document.getElementById('qa-fleet-count').textContent = totalLines;

    // Operator analytics side panel (new enterprise layout block)
    const opRunning = document.getElementById('op-running-home');
    const opThroughput = document.getElementById('op-throughput-home');
    const opUtil = document.getElementById('op-util-home');
    if (opRunning && opThroughput && opUtil) {
      const utilPct = totalLines > 0 ? (runningNow / totalLines) * 100 : 0;
      opRunning.textContent = runningNow.toString();
      opThroughput.textContent = totalInspections.toLocaleString();
      opUtil.textContent = `${utilPct.toFixed(0)}%`;
    }

    // Wire quick actions — navigate via Router
    document.getElementById('qa-fleet').onclick = () => Router.navigate('fleet');
    document.getElementById('qa-system').onclick = () => Router.navigate('system');

    // Download profile
    document.getElementById('btn-download-profile-home').onclick = () => Home.downloadProfile();

    // Home analytics block
    const pageHome = document.getElementById('page-home');
    let analyticsBlock = document.getElementById('home-analytics');
    if (!analyticsBlock) {
      analyticsBlock = document.createElement('div');
      analyticsBlock.id = 'home-analytics';
      analyticsBlock.className = 'glass-card ';
      pageHome.querySelector('.page-content-area')?.appendChild(analyticsBlock);
    }

    analyticsBlock.innerHTML = `
      <div class="d-flex align-items-start justify-content-between gap-3 mb-3 flex-wrap">
        <div>
          <h3 class="fw-semibold mb-1" style="font-size:16px; color:#f4f4f4;">Operations Analytics</h3>
          <p class="text-slate-500 mb-0" style="font-size:12px;">Live overview + telemetry trend chart.</p>
        </div>
        <div class="d-flex align-items-center gap-2">
          <label for="home-line-select" class="text-slate-500" style="font-size:11px;">Line</label>
          <select id="home-line-select" class="form-select" style="min-width:160px; font-size:12px; padding:6px 10px;">
            <option value="overall">Overall Fleet</option>
          </select>
          <span class="badge-status badge-count">LIVE</span>
        </div>
      </div>

      <div class="row g-3 mb-3">
        <div class="col-6 col-md-3"><div class="analytics-kpi"><p class="analytics-kpi-label">Running Now</p><p class="analytics-kpi-value text-emerald">${runningNow}</p></div></div>
        <div class="col-6 col-md-3"><div class="analytics-kpi"><p class="analytics-kpi-label">Total Inspections</p><p class="analytics-kpi-value text-blue">${totalInspections.toLocaleString()}</p></div></div>
        <div class="col-6 col-md-3"><div class="analytics-kpi"><p class="analytics-kpi-label">Quota Used</p><p class="analytics-kpi-value ${quotaFromLicense > 0 ? 'text-indigo' : 'text-slate-300'}">${quotaFromLicense > 0 ? `${quotaPct.toFixed(1)}%` : 'N/A'}</p></div></div>
        <div class="col-6 col-md-3"><div class="analytics-kpi"><p class="analytics-kpi-label">Avg / Workstation</p><p class="analytics-kpi-value text-cyan">${avgPerWorkstation.toLocaleString()}</p></div></div>
      </div>

      <div class="row g-3">
        <div class="col-md-12 col-lg-8">
          <div class="analytics-panel mb-3">
            <div class="d-flex align-items-center justify-content-between mb-2">
              <p class="analytics-title mb-0">Telemetry Trend</p>
              <span class="text-slate-500" style="font-size:10px;">last ${this.telemetryHistory.maxPoints} samples</span>
            </div>
            <canvas id="home-telemetry-chart" class="home-telemetry-chart"></canvas>
          </div>
          <div class="analytics-panel">
            <div class="d-flex align-items-center justify-content-between mb-2">
              <p class="analytics-title mb-0">Inspection Load by Workstation</p>
              <span class="text-slate-500" style="font-size:10px;">auto-refresh</span>
            </div>
            <div class="analytics-bars">${this.renderWorkstationBars(telemetryRows)}</div>
          </div>
        </div>
        <div class="col-md-12 col-lg-4">
          <div class="analytics-panel h-100">
            <p class="analytics-title mb-2">Fleet Capacity</p>
            <div class="analytics-donut-wrap">${this.renderCapacityDonut(quotaPct, quotaFromLicense)}</div>
          </div>
        </div>
      </div>
    `;

    this.setupLineSelector(activeLines);
    this.ensureTelemetryPolling(activeLines);
    this.drawTelemetryChart();
  },

  async downloadProfile() {
    const btn = document.getElementById('btn-download-profile-home');
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Generating...';
    try {
      const data = await Api.get('/api/system/machine-profile');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `machine_profile_${(data.machine_id || 'unknown').slice(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error('Profile download failed:', e); }
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-download"></i> Download Profile JSON';
  },

  renderWorkstationBars(rows) {
    if (!rows.length) {
      return '<p class="text-slate-500 mb-0" style="font-size:12px;">No workstation telemetry yet.</p>';
    }

    const peak = Math.max(...rows.map((row) => row.total || 0), 1);
    return rows
      .sort((a, b) => (b.total || 0) - (a.total || 0))
      .slice(0, 6)
      .map((row) => {
        const width = Math.max(((row.total || 0) / peak) * 100, 4);
        return `
          <div class="analytics-bar-row">
            <div class="analytics-bar-meta">
              <span class="text-slate-300">WS ${row.lineId}</span>
              <span class="text-slate-500">${(row.total || 0).toLocaleString()}</span>
            </div>
            <div class="analytics-bar-track">
              <div class="analytics-bar-fill" style="width:${width}%;"></div>
            </div>
          </div>
        `;
      })
      .join('');
  },

  renderCapacityDonut(quotaPct, quota) {
    if (!quota) {
      return `
        <div class="analytics-empty">
          <i class="bi bi-pie-chart text-slate-600"></i>
          <p class="text-slate-500 mb-0">No count-based quota</p>
        </div>
      `;
    }

    return `
      <div class="analytics-donut" style="--pct:${quotaPct.toFixed(2)};">
        <div class="analytics-donut-center">
          <p class="analytics-donut-value">${quotaPct.toFixed(1)}%</p>
          <p class="analytics-donut-label">used</p>
        </div>
      </div>
      <p class="text-slate-500 mb-0 mt-2 text-center" style="font-size:11px;">Quota: ${quota.toLocaleString()}</p>
    `;
  },

  setupLineSelector(activeLines) {
    const select = document.getElementById('home-line-select');
    if (!select) return;

    const prev = this.telemetryHistory.selected;
    const options = ['<option value="overall">Overall Fleet</option>']
      .concat(activeLines.map((line) => `<option value="${line.line_id}">Workstation ${line.line_id}</option>`));
    select.innerHTML = options.join('');
    select.value = activeLines.some((line) => line.line_id === prev) || prev === 'overall' ? prev : 'overall';
    this.telemetryHistory.selected = select.value;
    select.onchange = () => {
      this.telemetryHistory.selected = select.value;
      this.drawTelemetryChart();
    };
  },

  ensureTelemetryPolling(activeLines) {
    if (!activeLines.length) return;
    if (this.telemetryInterval) return;

    const poll = async () => {
      const activeIds = ((App.state.activeLicense?.lines || []).filter((line) => line.state === 'ACTIVE')).map((line) => line.line_id);
      if (!activeIds.length) return;
      const settled = await Promise.all(activeIds.map(async (lineId) => {
        try {
          const res = await Api.get(`/api/container/telemetry/${lineId}`);
          return { lineId, data: res?.data || null };
        } catch {
          return { lineId, data: null };
        }
      }));

      const ts = Date.now();
      let overall = 0;

      settled.forEach(({ lineId, data }) => {
        const value = Number(data?.total_inspected || 0);
        overall += value;
        if (!this.telemetryHistory.lines[lineId]) this.telemetryHistory.lines[lineId] = [];
        this.telemetryHistory.lines[lineId].push({ t: ts, v: value });
        if (this.telemetryHistory.lines[lineId].length > this.telemetryHistory.maxPoints) {
          this.telemetryHistory.lines[lineId].shift();
        }
      });

      this.telemetryHistory.overall.push({ t: ts, v: overall });
      if (this.telemetryHistory.overall.length > this.telemetryHistory.maxPoints) {
        this.telemetryHistory.overall.shift();
      }

      if (Router.currentPage === 'home') this.drawTelemetryChart();
    };

    poll();
    this.telemetryInterval = setInterval(poll, 3000);
  },

  drawTelemetryChart() {
    const canvas = document.getElementById('home-telemetry-chart');
    if (!canvas) return;

    const source = this.telemetryHistory.selected === 'overall'
      ? this.telemetryHistory.overall
      : (this.telemetryHistory.lines[this.telemetryHistory.selected] || []);

    const ctx = canvas.getContext('2d');
    const width = canvas.clientWidth || 800;
    const height = 180;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#1f1f1f';
    ctx.fillRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = '#393939';
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      const y = (height / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    if (source.length < 2) {
      ctx.fillStyle = '#8d8d8d';
      ctx.font = '12px Inter, sans-serif';
      ctx.fillText('Waiting for telemetry samples...', 12, 24);
      return;
    }

    const values = source.map((p) => p.v);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(max - min, 1);
    const padX = 10;
    const padY = 14;
    const chartW = width - padX * 2;
    const chartH = height - padY * 2;

    ctx.beginPath();
    source.forEach((point, idx) => {
      const x = padX + (idx / (source.length - 1)) * chartW;
      const y = padY + (1 - (point.v - min) / range) * chartH;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#0f62fe';
    ctx.lineWidth = 2;
    ctx.stroke();

    const last = source[source.length - 1];
    const lx = padX + chartW;
    const ly = padY + (1 - (last.v - min) / range) * chartH;
    ctx.beginPath();
    ctx.arc(lx, ly, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#0f62fe';
    ctx.fill();

    ctx.fillStyle = '#c6c6c6';
    ctx.font = '11px Inter, sans-serif';
    ctx.fillText(`Latest: ${last.v.toLocaleString()}`, 12, height - 8);
  },
};

window.Home = Home;
