/* ══════════════════════════════════════════════════════════════════════
   systemPulse.js — Canvas wave animation for CPU/RAM/DISK/GPU
   ══════════════════════════════════════════════════════════════════════ */

const SystemPulse = {
  canvas: null,
  ctx: null,
  animId: null,
  time: 0,
  gpuTemp: null,

  getTempColor(temp) {
    if (!temp || temp < 55) return [59, 130, 246];   // blue
    if (temp < 70)          return [34, 211, 238];   // cyan
    if (temp < 80)          return [245, 158, 11];   // amber
    if (temp < 88)          return [249, 115, 22];   // orange
    return                         [239, 68, 68];    // red
  },

  init() {
    this.canvas = document.getElementById('pulse-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    const resize = () => {
      this.canvas.width  = this.canvas.offsetWidth;
      this.canvas.height = this.canvas.offsetHeight;
    };
    resize();
    new ResizeObserver(resize).observe(this.canvas);
    this.animate();
  },

  drawWave(amp, freq, phase, speed, color, alpha, fill) {
    const w = this.canvas.width, h = this.canvas.height, mid = h * 0.56;
    this.ctx.beginPath();
    for (let x = 0; x <= w; x++) {
      const y = mid
        + Math.sin(x * freq + this.time * speed + phase) * amp
        + Math.sin(x * freq * 1.8 + this.time * speed * 0.6 + phase) * (amp * 0.3);
      x === 0 ? this.ctx.moveTo(x, y) : this.ctx.lineTo(x, y);
    }
    const [r, g, b] = color;
    if (fill) {
      this.ctx.lineTo(w, h); this.ctx.lineTo(0, h); this.ctx.closePath();
      this.ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      this.ctx.fill();
    } else {
      this.ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();
    }
  },

  animate() {
    if (!this.canvas) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const temp  = this.gpuTemp || 55;
    const amp   = 3 + (temp - 40) * 0.17;
    const color = this.getTempColor(temp);
    this.drawWave(amp * 1.1, 0.025, 0,   0.040, color, 0.12, true);
    this.drawWave(amp * 0.8, 0.038, 2.1, 0.028, color, 0.17, true);
    this.drawWave(amp * 0.6, 0.020, 4.3, 0.055, color, 0.22, true);
    this.drawWave(amp * 0.9, 0.030, 1.0, 0.045, color, 0.65, false);
    this.time++;
    this.animId = requestAnimationFrame(() => this.animate());
  },

  update(cpuPercent, ramPercent, diskFree, gpuTemp) {
    document.getElementById('pulse-cpu').textContent = cpuPercent.toFixed(1) + '%';
    document.getElementById('pulse-ram').textContent = ramPercent + '%';
    document.getElementById('pulse-disk').textContent = diskFree + 'G';

    this.gpuTemp = gpuTemp;

    const gpuPill = document.getElementById('gpu-pill');
    if (gpuTemp != null) {
      gpuPill.style.display = '';
      const [r, g, b] = this.getTempColor(gpuTemp);
      gpuPill.style.backgroundColor = `rgba(${r},${g},${b},0.08)`;
      gpuPill.style.borderColor     = `rgba(${r},${g},${b},0.22)`;
      gpuPill.querySelector('.gpu-label').style.color = `rgba(${r},${g},${b},0.55)`;
      gpuPill.querySelector('.gpu-val').style.color   = `rgb(${r},${g},${b})`;
      document.getElementById('pulse-gpu').textContent = gpuTemp.toFixed(0) + '°C';
    } else {
      gpuPill.style.display = 'none';
    }

    document.getElementById('topbar-pulse').style.display = '';
  },

  destroy() {
    if (this.animId) cancelAnimationFrame(this.animId);
  }
};

window.SystemPulse = SystemPulse;
