/* ═══════════════════════════════════════════════════════════════
   Hold-Monero Charts — Canvas 2D visualizations
   - drawSellPressureLoop:    animated XMR price line + suppression drops
   - drawVolumeExtractionChart: 30-day swap volume bars + extraction overlay
   Extracted from hold-monero.html for verification + reuse.
   ═══════════════════════════════════════════════════════════════ */

(function (root) {
  'use strict';

  function attachSellPressureLoop(canvas) {
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, t = 0, visible = false, rafId = 0;

    function resize() {
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener('resize', resize);

    var priceData = [], basePrice = 340;
    for (var i = 0; i < 200; i++) {
      var organic = Math.sin(i * 0.03) * 40 + Math.sin(i * 0.07) * 20 + Math.cos(i * 0.01) * 30;
      var suppression = 0;
      if (i % 18 < 4) suppression = -6 - Math.random() * 10;
      basePrice = 340 + organic + suppression + Math.random() * 5;
      priceData.push(Math.max(200, basePrice));
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      var padding = 20, chartW = W - padding * 2, chartH = H - padding * 2;
      var min = Math.min.apply(null, priceData);
      var max = Math.max.apply(null, priceData);
      var range = max - min || 1;

      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 0.5;
      for (var g = 1; g < 5; g++) {
        var gy = padding + chartH * g / 5;
        ctx.beginPath();
        ctx.moveTo(padding, gy);
        ctx.lineTo(W - padding, gy);
        ctx.stroke();
      }

      ctx.beginPath();
      var offset = Math.floor(t * 0.15) % priceData.length;
      for (var k = 0; k < Math.min(priceData.length, chartW); k++) {
        var idx = (k + offset) % priceData.length;
        var x = padding + k / (priceData.length - 1) * chartW;
        var y = padding + chartH - (priceData[idx] - min) / range * chartH;
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(255,102,0,0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.lineTo(W - padding, H - padding);
      ctx.lineTo(padding, H - padding);
      ctx.closePath();
      var gd = ctx.createLinearGradient(0, 0, 0, H);
      gd.addColorStop(0, 'rgba(255,102,0,0.08)');
      gd.addColorStop(1, 'transparent');
      ctx.fillStyle = gd;
      ctx.fill();

      for (var d = 0; d < 8; d++) {
        var phase = ((t * 0.7 + d * 30) % 150) / 150;
        var ax = W * 0.15 + d * W * 0.09 + Math.sin(d * 2.3) * 15;
        var ay = padding + phase * chartH;
        var fade = phase < 0.2 ? phase / 0.2 : phase > 0.7 ? 1 - (phase - 0.7) / 0.3 : 1;
        ctx.beginPath();
        ctx.arc(ax, ay, 2.5 * fade, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,71,87,' + (fade * 0.45) + ')';
        ctx.fill();
        if (fade > 0.2) {
          ctx.beginPath();
          ctx.moveTo(ax, ay - 10);
          ctx.lineTo(ax, ay);
          ctx.strokeStyle = 'rgba(255,71,87,' + (fade * 0.15) + ')';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      for (var z = 0; z < priceData.length; z++) {
        if (z % 18 < 4) {
          var zx = padding + z / (priceData.length - 1) * chartW;
          ctx.fillStyle = 'rgba(255,71,87,0.03)';
          ctx.fillRect(zx - 1, padding, 3, chartH);
        }
      }

      ctx.font = '8px JetBrains Mono,monospace';
      ctx.fillStyle = 'rgba(255,71,87,0.4)';
      ctx.textAlign = 'center';
      ctx.fillText('SWAP DUMPS ↓', W * 0.5, padding + 12);
      ctx.fillStyle = 'rgba(255,102,0,0.3)';
      ctx.fillText('XMR PRICE', W - padding - 30, padding + 12);

      t++;
      if (visible) rafId = requestAnimationFrame(draw);
    }

    requestAnimationFrame(function () {
      resize();
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            if (e.isIntersecting) {
              if (!visible) { visible = true; rafId = requestAnimationFrame(draw); }
            } else {
              visible = false;
              if (rafId) cancelAnimationFrame(rafId);
            }
          });
        }, { threshold: 0 });
        io.observe(canvas);
      } else {
        visible = true;
        draw();
      }
    });
  }

  function attachVolumeExtractionChart(canvas) {
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0;

    var days = 30, volumes = [], extractions = [];
    for (var i = 0; i < days; i++) {
      var vol = 8 + Math.random() * 6 + Math.sin(i * 0.5) * 2;
      volumes.push(vol);
      extractions.push(vol * 0.035);
    }
    var maxVol = Math.max.apply(null, volumes);

    function draw() {
      ctx.clearRect(0, 0, W, H);
      var pad = 24, bw = (W - pad * 2) / days - 2, chartH = H - pad * 2;

      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 0.5;
      for (var g = 1; g < 4; g++) {
        var y = pad + chartH * g / 4;
        ctx.beginPath();
        ctx.moveTo(pad, y);
        ctx.lineTo(W - pad, y);
        ctx.stroke();
      }

      for (var k = 0; k < days; k++) {
        var x = pad + k * (bw + 2);
        var h = volumes[k] / maxVol * chartH;
        var eh = extractions[k] / maxVol * chartH;
        ctx.fillStyle = 'rgba(68,136,255,0.15)';
        ctx.fillRect(x, pad + chartH - h, bw, h);
        ctx.fillStyle = 'rgba(255,71,87,0.35)';
        ctx.fillRect(x, pad + chartH - h, bw, eh);
      }

      ctx.font = '8px JetBrains Mono,monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(68,136,255,0.4)';
      ctx.fillText('SWAP VOLUME (30d)', W * 0.35, pad + 12);
      ctx.fillStyle = 'rgba(255,71,87,0.5)';
      ctx.fillText('RED = EXTRACTION', W * 0.7, pad + 12);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillText('~$10M/day', pad + 30, pad + chartH - 10);
    }

    function resize() {
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }
    window.addEventListener('resize', resize);
    requestAnimationFrame(resize);
  }

  function drawSellPressureLoop(canvas) {
    if (!canvas) return;
    attachSellPressureLoop(canvas);
  }

  function drawVolumeExtractionChart(canvas) {
    if (!canvas) return;
    attachVolumeExtractionChart(canvas);
  }

  root.HoldMoneroCharts = {
    drawSellPressureLoop: drawSellPressureLoop,
    drawVolumeExtractionChart: drawVolumeExtractionChart
  };
  root.drawSellPressureLoop = drawSellPressureLoop;
  root.drawVolumeExtractionChart = drawVolumeExtractionChart;

  function autoInit() {
    drawSellPressureLoop(document.getElementById('suppress-viz'));
    drawVolumeExtractionChart(document.getElementById('volume-viz'));
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }
})(typeof window !== 'undefined' ? window : this);
