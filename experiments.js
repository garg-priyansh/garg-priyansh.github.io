(function () {
  'use strict';

  // Unit mass, unit length, torque at the pivot; angle measured from upright.
  function stepPendulum(state, dt, feedback, strength) {
    const angle = Math.atan2(Math.sin(state.angle), Math.cos(state.angle));
    const requested = feedback ? -24 * strength * angle - 6 * Math.sqrt(strength) * state.velocity : 0;
    const torque = Math.max(-18, Math.min(18, requested));
    const acceleration = 9.81 * Math.sin(angle) + torque - 0.12 * state.velocity;
    const velocity = state.velocity + acceleration * dt;
    return { angle: Math.atan2(Math.sin(angle + velocity * dt), Math.cos(angle + velocity * dt)), velocity, torque };
  }

  // Normalized leaky integrate-and-fire neuron. Time is in milliseconds.
  function stepNeuron(state, dt, drive) {
    let available = dt;
    let refractory = state.refractory;
    if (refractory > 0) {
      const held = Math.min(refractory, available);
      refractory -= held;
      available -= held;
    }
    if (available <= 0) return { potential: 0, refractory, spike: false };
    const potential = drive + (state.potential - drive) * Math.exp(-available / 20);
    if (potential >= 1) return { potential: 0, refractory: 3, spike: true };
    return { potential, refractory: 0, spike: false };
  }

  function steadyRate(drive) {
    return drive <= 1 ? 0 : 1000 / (20 * Math.log(drive / (drive - 1)) + 3);
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { stepPendulum, stepNeuron, steadyRate };
  if (typeof document === 'undefined') return;

  document.addEventListener('DOMContentLoaded', function () {
    const lab = document.getElementById('experiments');
    if (!lab) return;
    const byId = id => document.getElementById(id);
    const tabs = [byId('tab-balance'), byId('tab-neuron')];
    let active = 'balance';
    let inView = true;
    let frame = null;
    let lastTime = 0;
    let dragging = false;
    let control = { angle: 0, velocity: 0, torque: 0 };
    let controlRunning = false;
    let controlSampleTime = 0;
    let angles = Array(360).fill(0);
    let trail = [];
    let neuron = { potential: 0, refractory: 0, spike: false };
    let neuronRunning = false;
    let neuronTime = 0;
    let neuronSampleTime = 0;
    let potentials = [{ time: -300, value: 0 }, { time: 0, value: 0 }];
    const feedback = byId('feedback-enabled');
    const gain = byId('feedback-gain');
    const drive = byId('neuron-drive');
    const scene = byId('pendulum-scene');
    const bob = byId('pendulum-bob');

    function status(id, message) {
      const node = byId(id);
      if (node.textContent !== message) node.textContent = message;
    }
    function canRun() {
      return inView && !document.hidden && (active === 'balance' ? controlRunning : neuronRunning);
    }
    function stopFrame() {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null;
      lastTime = 0;
    }
    function wake() {
      if (frame === null && canRun()) {
        lastTime = 0;
        frame = window.requestAnimationFrame(tick);
      }
    }
    function drawControl() {
      const x = 320 + 88 * Math.sin(control.angle);
      const y = 140 - 88 * Math.cos(control.angle);
      byId('pendulum-rod').setAttribute('x2', x.toFixed(2));
      byId('pendulum-rod').setAttribute('y2', y.toFixed(2));
      bob.setAttribute('cx', x.toFixed(2));
      bob.setAttribute('cy', y.toFixed(2));
      byId('pendulum-trail').setAttribute('d', trail.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' '));
      byId('balance-trace').setAttribute('d', angles.map((a, i) => {
        const yPlot = 55 - Math.max(-1, Math.min(1, a / (Math.PI / 3))) * 48;
        return (i ? 'L' : 'M') + (i * 640 / 359).toFixed(1) + ' ' + yPlot.toFixed(1);
      }).join(' '));
      byId('balance-angle').textContent = (control.angle * 180 / Math.PI).toFixed(1) + '°';
      byId('balance-torque').textContent = control.torque.toFixed(1) + ' N·m';
      byId('balance-pause').textContent = controlRunning ? 'Pause' : 'Run';
      let label = 'Ready to nudge';
      if (dragging) label = 'Release to recover';
      else if (!controlRunning && Math.abs(control.angle) > .005) label = 'Paused';
      else if (controlRunning && !feedback.checked) label = 'Feedback off';
      else if (controlRunning) label = Math.abs(control.angle) < .015 && Math.abs(control.velocity) < .03 ? 'Balanced' : 'Recovering';
      status('balance-status', label);
    }
    function drawNeuron() {
      const left = neuronTime - 300;
      const path = potentials.map((p, i) => {
        const x = Math.max(0, Math.min(640, (p.time - left) / 300 * 640));
        const y = 212 - p.value * 160;
        return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
      }).join(' ');
      byId('neuron-trace').setAttribute('d', path);
      byId('neuron-potential').textContent = neuron.potential.toFixed(2);
      byId('neuron-rate').textContent = Math.round(steadyRate(Number(drive.value))) + ' spikes/s';
      byId('neuron-run').textContent = neuronRunning ? 'Pause' : neuronTime > 0 ? 'Resume' : 'Stimulate';
      status('neuron-status', neuronRunning ? (Number(drive.value) <= 1 ? 'Below firing threshold' : 'Integrating → firing → resetting') : neuronTime > 0 ? 'Paused' : 'Ready to stimulate');
    }
    function tick(now) {
      frame = null;
      if (!canRun()) { lastTime = 0; return; }
      const elapsed = lastTime ? Math.min((now - lastTime) / 1000, .04) : 1 / 60;
      lastTime = now;
      if (active === 'balance') {
        if (!dragging) {
          const count = Math.max(1, Math.ceil(elapsed * 240));
          for (let i = 0; i < count; i++) control = stepPendulum(control, elapsed / count, feedback.checked, Number(gain.value));
        }
        controlSampleTime += elapsed;
        while (controlSampleTime >= 1 / 60) {
          controlSampleTime -= 1 / 60;
          angles.push(control.angle);
          angles.shift();
          trail.push([320 + 88 * Math.sin(control.angle), 140 - 88 * Math.cos(control.angle)]);
          if (trail.length > 45) trail.shift();
        }
        drawControl();
      } else {
        // Slow the simulation so individual integration cycles can be seen.
        const duration = elapsed * 140;
        const count = Math.max(1, Math.ceil(duration / .2));
        const dt = duration / count;
        for (let i = 0; i < count; i++) {
          neuron = stepNeuron(neuron, dt, Number(drive.value));
          neuronTime += dt;
          neuronSampleTime += dt;
          if (neuron.spike) {
            potentials.push({ time: neuronTime, value: 1.14 }, { time: neuronTime, value: 0 });
          } else if (neuronSampleTime >= .7) {
            potentials.push({ time: neuronTime, value: neuron.potential });
          }
          if (neuronSampleTime >= .7) neuronSampleTime = 0;
        }
        while (potentials.length > 2 && potentials[1].time < neuronTime - 300) potentials.shift();
        drawNeuron();
      }
      if (canRun()) frame = window.requestAnimationFrame(tick);
    }
    function chooseTab(index, focus) {
      stopFrame();
      active = index === 0 ? 'balance' : 'neuron';
      tabs.forEach((tab, i) => {
        tab.setAttribute('aria-selected', String(i === index));
        tab.tabIndex = i === index ? 0 : -1;
        byId(tab.getAttribute('aria-controls')).hidden = i !== index;
      });
      if (focus) tabs[index].focus();
      drawControl();
      drawNeuron();
      wake();
    }
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => chooseTab(index, false));
      tab.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        chooseTab(event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - index, true);
      });
    });
    function nudge(direction) {
      control.velocity += direction * 1.9;
      controlRunning = true;
      drawControl();
      wake();
    }
    byId('nudge-left').addEventListener('click', () => nudge(-1));
    byId('nudge-right').addEventListener('click', () => nudge(1));
    byId('balance-pause').addEventListener('click', () => {
      controlRunning = !controlRunning;
      if (!controlRunning) stopFrame();
      drawControl();
      wake();
    });
    byId('balance-reset').addEventListener('click', () => {
      controlRunning = false;
      dragging = false;
      control = { angle: 0, velocity: 0, torque: 0 };
      angles = Array(360).fill(0);
      trail = [];
      controlSampleTime = 0;
      stopFrame();
      drawControl();
    });
    feedback.addEventListener('change', () => {
      if (!feedback.checked) control.torque = 0;
      drawControl();
    });
    gain.addEventListener('input', () => { byId('feedback-value').textContent = Number(gain.value).toFixed(1) + '×'; });

    function dragTo(event) {
      const matrix = scene.getScreenCTM();
      if (!matrix) return;
      const point = scene.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const local = point.matrixTransform(matrix.inverse());
      control.angle = Math.atan2(local.x - 320, 140 - local.y);
      control.velocity = 0;
      control.torque = 0;
      drawControl();
    }
    scene.addEventListener('pointerdown', event => {
      if (event.target !== bob) return;
      event.preventDefault();
      dragging = true;
      controlRunning = true;
      scene.setPointerCapture(event.pointerId);
      dragTo(event);
      wake();
    });
    scene.addEventListener('pointermove', event => { if (dragging) dragTo(event); });
    function release(event) {
      if (!dragging) return;
      dragging = false;
      if (scene.hasPointerCapture(event.pointerId)) scene.releasePointerCapture(event.pointerId);
      drawControl();
      wake();
    }
    scene.addEventListener('pointerup', release);
    scene.addEventListener('pointercancel', release);

    drive.addEventListener('input', () => {
      byId('neuron-drive-value').textContent = Number(drive.value).toFixed(2) + '× threshold';
      drawNeuron();
    });
    byId('neuron-run').addEventListener('click', () => {
      neuronRunning = !neuronRunning;
      if (!neuronRunning) stopFrame();
      drawNeuron();
      wake();
    });
    byId('neuron-reset').addEventListener('click', () => {
      neuronRunning = false;
      neuron = { potential: 0, refractory: 0, spike: false };
      neuronTime = 0;
      neuronSampleTime = 0;
      potentials = [{ time: -300, value: 0 }, { time: 0, value: 0 }];
      stopFrame();
      drawNeuron();
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stopFrame(); else wake(); });
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        inView = entries[0].isIntersecting;
        if (!inView) stopFrame(); else wake();
      }, { rootMargin: '80px' });
      observer.observe(lab);
    }
    drawControl();
    drawNeuron();
  });
})();
