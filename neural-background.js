(function () {
  'use strict';
  // Original, synthetic illustrations. No recorded research data or pointer telemetry.
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const mix = (a, b, amount) => a + (b - a) * amount;

  function createSpikes(width, height) {
    let seed = 98417;
    function random() {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      return seed / 4294967296;
    }
    const rows = clamp(Math.floor(height / 29), 12, 32);
    const span = width + 64;
    const spikes = [];
    for (let row = 0; row < rows; row++) {
      const y = (row + 1) * height / (rows + 1);
      const count = Math.ceil(width / 185) + Math.floor(random() * 3);
      for (let i = 0; i < count; i++) {
        const x = random() * span;
        const size = 4 + random() * 7;
        spikes.push({ x, y, size, alpha: .45 + random() * .5, color: row % 7 === 0 ? 1 : 0 });
        if (random() < .16) spikes.push({ x: (x + 5 + random() * 5) % span, y, size: size * .8, alpha: .45, color: row % 7 === 0 ? 1 : 0 });
      }
      if (row % 3 !== 0) spikes.push({ x: (span * .64 + Math.sin(row * .7) * 16) % span, y, size: 7, alpha: .65, color: 2 });
    }
    return spikes;
  }
  function edgeWeight(x, width) {
    const start = Math.min(420, width * .37);
    const end = Math.min(560, width * .52);
    const t = clamp((Math.abs(x - width / 2) - start) / Math.max(1, end - start), 0, 1);
    return .025 + .975 * t * t * (3 - 2 * t);
  }
  function spikeX(x, time, width) {
    const span = width + 64;
    return ((x - time * 19) % span + span) % span - 32;
  }
  function proximity(x, y, pointer, radius) {
    if (!pointer || pointer.influence <= 0) return 0;
    return Math.exp(-((x - pointer.x) ** 2 + (y - pointer.y) ** 2) / (2 * radius * radius)) * pointer.influence;
  }
  function routeBand(width, side) {
    const size = width > 1000 ? clamp((width - 860) / 2, 70, 240) : clamp(width * .12, 30, 90);
    return { size, center: side === 0 ? size * .58 : width - size * .58, low: side === 0 ? 12 : width - size + 12, high: side === 0 ? size - 12 : width - 12 };
  }
  function routeObstacles(width, height, side) {
    const band = routeBand(width, side);
    return Array.from({ length: 5 }, (_, i) => ({
      x: clamp(band.center + Math.sin(i * 2.1 + side) * band.size * .12, band.low, band.high),
      y: height * (i + 1) / 6,
      radius: Math.min(16, band.size * .12),
      direction: (i + side) % 2 === 0 ? 1 : -1
    }));
  }
  function routeX(y, width, height, side, pointer, obstacles) {
    const band = routeBand(width, side);
    let x = band.center + Math.sin(y / Math.max(1, height) * Math.PI * 2 + side) * band.size * .035;
    for (const obstacle of (obstacles || routeObstacles(width, height, side))) {
      const reach = obstacle.radius * 2.3;
      const weight = Math.exp(-(((y - obstacle.y) / reach) ** 2) / 2);
      x += obstacle.direction * Math.min(obstacle.radius * 2 + 10, band.size * .24) * weight;
    }
    if (pointer && pointer.influence > 0) {
      const distance = x - pointer.x;
      const direction = Math.abs(distance) < 1 ? (side === 0 ? -1 : 1) : Math.sign(distance);
      const influence = proximity(x, y, pointer, 110);
      x += direction * Math.min(65, band.size * .3) * influence;
    }
    return clamp(x, band.low, band.high);
  }
  function fogConfidence(x, y, time, pointer) {
    const scan = .5 + .5 * Math.sin(time * .42 - y * .008);
    return clamp(.12 + .45 * scan + .55 * proximity(x, y, pointer, 160), 0, 1);
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { createSpikes, edgeWeight, spikeX, proximity, routeBand, routeX, fogConfidence };
  if (typeof document === 'undefined') return;

  document.addEventListener('DOMContentLoaded', function () {
    const canvas = document.getElementById('neural-background');
    const button = document.getElementById('background-motion');
    if (!canvas || !button) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const notes = document.getElementById('background-notes');
    const descriptions = {
      day: {
        title: 'Day · Finding a path',
        story: 'Gold points travel along routes that bend around obstacles. The faint dashed line is a reference path; the peacock curve illustrates a revised route. This is an illustrative motion-planning sketch.',
        hint: 'Move your pointer near a route in either margin: it becomes another obstacle, and the path bends away.'
      },
      night: {
        title: 'Night · A population in motion',
        story: 'Each row represents an illustrative neuron, and each short tick a spike event. Small clusters suggest bursts and shared activity across the population.',
        hint: 'Move your pointer through the margins to stimulate nearby rows: their activity becomes denser and more prominent.'
      },
      fog: {
        title: 'Fog · Seeing through uncertainty',
        story: 'Scattered observations gradually resolve into faint contours. Ellipses suggest uncertainty around a position estimate; they shrink as the illustration gathers more information.',
        hint: 'Move your pointer near the points to bring them into focus. Nearby uncertainty ellipses contract as confidence increases.'
      }
    };
    let width = 0, height = 0, time = 0;
    let spikes = [], colors = [], strength = .2;
    let mode = 'day', previousMode = 'day', transitionAt = -2, renderWeight = 1;
    let frame = null, previous = 0, lastDraw = -Infinity, resizeTimer;
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0, influence: 0, active: false, updated: -10 };
    function savedPreference() {
      try { return localStorage.getItem('neuralMotion'); } catch (error) { return null; }
    }
    let enabled = !reduced.matches && savedPreference() !== 'paused';

    function updateNotes() {
      const text = descriptions[mode];
      for (const [id, content] of [['background-title', text.title], ['background-story', text.story], ['background-hint', enabled ? text.hint : 'The background is paused. Choose “Animate background” below to explore its motion and pointer response.']]) {
        const element = document.getElementById(id);
        if (element) element.textContent = content;
      }
    }
    function readPalette(transition) {
      const style = window.getComputedStyle(document.body);
      colors = ['--heading-color', '--quote-color', '--gold-color'].map(key => style.getPropertyValue(key).trim());
      strength = Number(style.getPropertyValue('--neural-strength').trim()) || .2;
      const nextMode = document.body.classList.contains('theme-night') ? 'night' : document.body.classList.contains('theme-fog') ? 'fog' : 'day';
      if (nextMode !== mode) {
        previousMode = transition && enabled ? mode : nextMode;
        mode = nextMode;
        transitionAt = transition && enabled ? time : time - 2;
      }
      updateNotes();
    }
    function ink(color, opacity, x) {
      ctx.strokeStyle = ctx.fillStyle = colors[color];
      ctx.globalAlpha = clamp(strength * opacity * edgeWeight(x, width) * renderWeight, 0, .42);
    }
    function circle(x, y, radius, color, opacity, fill) {
      ink(color, opacity, x);
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
      if (fill) ctx.fill(); else ctx.stroke();
    }
    function drawRoutes() {
      for (let side = 0; side < 2; side++) {
        const band = routeBand(width, side);
        const obstacles = routeObstacles(width, height, side);
        ink(0, .22, band.center);
        ctx.lineWidth = .8;
        ctx.setLineDash([2, 7]);
        ctx.beginPath(); ctx.moveTo(band.center, 12); ctx.lineTo(band.center, height - 12); ctx.stroke();
        ctx.setLineDash([]);
        for (const obstacle of obstacles) circle(obstacle.x, obstacle.y, obstacle.radius, 1, .46, false);
        ink(0, .64, band.center);
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i <= 72; i++) {
          const y = height * i / 72;
          const x = routeX(y, width, height, side, pointer, obstacles);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        const y = ((time * 25 + side * height * .43) % (height + 80)) - 40;
        const x = routeX(y, width, height, side, pointer, obstacles);
        circle(x, y, 7, 2, .45, false);
        circle(x, y, 2.5, 2, 1.5, true);
        const goalX = routeX(height - 23, width, height, side, pointer, obstacles);
        ink(2, .65, goalX);
        ctx.beginPath(); ctx.moveTo(goalX, height - 28); ctx.lineTo(goalX + 4, height - 23); ctx.lineTo(goalX, height - 18); ctx.lineTo(goalX - 4, height - 23); ctx.closePath(); ctx.stroke();
      }
    }
    function drawSpikes() {
      for (const spike of spikes) {
        const x = spikeX(spike.x, time, width);
        if (x < -2 || x > width + 2) continue;
        const local = proximity(x, spike.y, pointer, 140);
        const rowStimulus = pointer.influence * Math.exp(-(((spike.y - pointer.y) / 85) ** 2) / 2) * .2;
        const attention = clamp(local + rowStimulus, 0, 1);
        const size = spike.size * (1 + attention * .9);
        ink(spike.color, spike.alpha * (1 + attention * .65), x);
        ctx.fillRect(x, spike.y - size / 2, 1 + attention * .4, size);
        if (attention > .12) {
          ink(spike.color, spike.alpha * attention * .8, x);
          ctx.fillRect(x + 5, spike.y - size * .35, 1, size * .7);
          ctx.fillRect(x + 10, spike.y - size * .25, .8, size * .5);
        }
      }
    }
    function drawFog() {
      for (let side = 0; side < 2; side++) {
        const band = routeBand(width, side);
        for (let cluster = 0; cluster < 3; cluster++) {
          const centerY = height * (cluster + 1) / 4;
          for (let i = 0; i < 26; i++) {
            const angle = i / 26 * Math.PI * 2;
            const contourX = band.center + Math.cos(angle) * Math.min(23, band.size * .21);
            const contourY = centerY + Math.sin(angle) * 42;
            const confidence = fogConfidence(contourX, contourY, time + cluster, pointer);
            const noiseX = Math.sin(i * 13.7 + cluster * 3 + side) * Math.min(32, band.size * .25);
            const noiseY = Math.cos(i * 8.3 + cluster) * 32;
            const x = clamp(contourX + noiseX * (1 - confidence), band.low, band.high);
            const y = contourY + noiseY * (1 - confidence) + Math.sin(time * .3 + i) * 1.5;
            circle(x, y, .9 + confidence * .5, i % 9 === 0 ? 2 : 0, .22 + confidence * .85, true);
          }
        }
        const defaultY = height * (.5 + .23 * Math.sin(time * .13 + side));
        const attention = proximity(band.center, pointer.y, pointer, 190);
        const y = mix(defaultY, pointer.y, attention * .75);
        const confidence = fogConfidence(band.center, y, time, pointer);
        const rx = Math.min(30 - confidence * 17, band.size * .26);
        const ry = 44 - confidence * 26;
        ink(0, .55, band.center);
        ctx.lineWidth = .9;
        ctx.setLineDash([3, 5]);
        ctx.beginPath(); ctx.ellipse(band.center, y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        circle(band.center, y, 2.3, 2, 1.3, true);
      }
    }
    function drawMode(which, weight) {
      renderWeight = weight;
      if (weight <= 0) return;
      if (which === 'day') drawRoutes();
      else if (which === 'fog') drawFog();
      else drawSpikes();
    }
    function draw() {
      ctx.clearRect(0, 0, width, height);
      const progress = enabled ? clamp((time - transitionAt) / .85, 0, 1) : 1;
      if (previousMode !== mode && progress < 1) drawMode(previousMode, 1 - progress);
      drawMode(mode, previousMode === mode ? 1 : progress);
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
    }
    function resize() {
      width = Math.max(1, window.innerWidth);
      height = Math.max(1, window.innerHeight);
      const scale = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      spikes = createSpikes(width, height);
      readPalette(false);
      draw();
    }
    function stop() {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null; previous = 0; lastDraw = -Infinity;
    }
    function tick(now) {
      frame = null;
      if (!enabled || document.hidden) { previous = 0; return; }
      const dt = previous ? Math.min(now - previous, 100) / 1000 : 0;
      time += dt;
      previous = now;
      const easing = 1 - Math.exp(-dt * 9);
      pointer.x = mix(pointer.x, pointer.targetX, easing);
      pointer.y = mix(pointer.y, pointer.targetY, easing);
      const target = pointer.active && time - pointer.updated < 2.6 ? 1 : 0;
      pointer.influence = mix(pointer.influence, target, easing);
      if (now - lastDraw >= 1000 / 30) { draw(); lastDraw = now; }
      frame = window.requestAnimationFrame(tick);
    }
    function synchronize() {
      stop();
      button.textContent = enabled ? 'Pause background' : 'Animate background';
      button.setAttribute('aria-pressed', String(enabled));
      updateNotes(); draw();
      if (enabled && !document.hidden) frame = window.requestAnimationFrame(tick);
    }
    function pointAt(event) {
      if (!enabled || document.hidden) return;
      if (!pointer.active && pointer.influence < .02) { pointer.x = event.clientX; pointer.y = event.clientY; }
      pointer.targetX = clamp(event.clientX, 0, width);
      pointer.targetY = clamp(event.clientY, 0, height);
      pointer.updated = time;
      pointer.active = true;
    }
    document.addEventListener('pointermove', event => { if (event.pointerType !== 'touch') pointAt(event); }, { passive: true });
    document.addEventListener('pointerdown', event => { if (event.pointerType === 'touch') pointAt(event); }, { passive: true });
    document.addEventListener('pointerleave', () => { pointer.active = false; });
    window.addEventListener('blur', () => { pointer.active = false; });
    button.hidden = false;
    if (notes) notes.hidden = false;
    button.addEventListener('click', function () {
      enabled = !enabled;
      pointer.active = false;
      try { localStorage.setItem('neuralMotion', enabled ? 'playing' : 'paused'); } catch (error) { /* Preferences are optional. */ }
      synchronize();
    });
    window.addEventListener('resize', function () { window.clearTimeout(resizeTimer); resizeTimer = window.setTimeout(resize, 100); });
    document.addEventListener('themechange', function () { readPalette(true); draw(); });
    document.addEventListener('visibilitychange', synchronize);
    window.addEventListener('pagehide', stop);
    window.addEventListener('pageshow', synchronize);
    reduced.addEventListener('change', function () { enabled = !reduced.matches && savedPreference() !== 'paused'; synchronize(); });
    resize(); synchronize();
  });
})();
