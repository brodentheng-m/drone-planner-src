import {
  createCommand, getCommandLabel,
  getCommandParams, createDefaultPlan, COMMAND_DEFS, isBlockCommand,
  getActiveDrone, getActiveCommands, addDrone, removeDrone, duplicateDrone, setFormation
} from './commands/Commands.js';
import { parseDroneScript } from './commands/ScriptParser.js';
import { generateDroneScript, generateSwarmScript, generateAnimationScript } from './codegen/CodeGenerator.js';
import { ObstacleImporter } from './scene/ObstacleImporter.js';

if ((navigator.hardwareConcurrency || 8) <= 4 ||
  (navigator.deviceMemory || 8) <= 4 ||
  matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.documentElement.classList.add('perf-mode');
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then(function (reg) {
      return navigator.serviceWorker.ready.then(function () {
        const urls = [...new Set(
          performance.getEntriesByType('resource')
            .map(r => r.name)
            .filter(name => name.startsWith(location.origin) && !name.includes('sw.js'))
        )];
        if (reg.active) {
          reg.active.postMessage({ type: 'WARM', urls: urls });
        }
      });
    })
    .catch(() => {});
}

const readoutPos = document.getElementById('readout-pos');
const readoutHeading = document.getElementById('readout-heading');
const statusAlt = document.getElementById('status-alt');
const statusSpd = document.getElementById('status-spd');
const statusBat = document.getElementById('status-bat');
const statusHdg = document.getElementById('status-hdg');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const consoleOutput = document.getElementById('console-output');
const scrubSlider = document.getElementById('playback-scrub');

const CMD_CATEGORIES = {
  takeoff: 'cat-flight', land: 'cat-flight', hover: 'cat-flight', flip: 'cat-flight',
  go: 'cat-flight', move_forward: 'cat-flight', move_backward: 'cat-flight',
  move_left: 'cat-flight', move_right: 'cat-flight', turn_left: 'cat-flight',
  turn_right: 'cat-flight', circle: 'cat-flight', square: 'cat-flight', triangle: 'cat-flight',
  led: 'cat-output', buzzer: 'cat-output', random_led: 'cat-output', time_sleep: 'cat-output',
  if_block: 'cat-control', elif_block: 'cat-control', else_block: 'cat-control',
  end_block: 'cat-control', while_block: 'cat-control', for_block: 'cat-control', break_cmd: 'cat-control',
  var_declare: 'cat-var', set_var: 'cat-var', print_var: 'cat-var', user_input: 'cat-var',
  get_distance: 'cat-sensor', get_height: 'cat-sensor', get_color: 'cat-sensor',
  get_battery: 'cat-sensor', get_temperature: 'cat-sensor',
  func_def: 'cat-func', func_call: 'cat-func', return_val: 'cat-func',
  list_declare: 'cat-func', list_append: 'cat-func', list_get: 'cat-func',
  timer_start: 'cat-timer', timer_elapsed: 'cat-timer'
};

let plan = createDefaultPlan();
plan.activeDroneId = plan.drones[0].id;
let scene3d = null;
let selectedPath = null;
let isFlying = false;
let hasCollision = false;
let chartExpanded = false;
const TELEMETRY_BUFFER_SIZE = 300;
const telemetryRing = new Float64Array(TELEMETRY_BUFFER_SIZE);
let telemetryHead = 0;
let telemetryCount = 0;
let chartCanvas = null;
let chartCtx = null;
let chartW = 0;
let chartH = 0;
let chartAccent = null;
let chartDim = null;
let codegenT = null;
let highlightTimer = null;
let resizeT = null;
const obstacleImporter = new ObstacleImporter();

function log(msg, type = 'info') {
  const el = consoleOutput;
  if (!el) return;
  const line = document.createElement('div');
  line.className = 'console-line ' + type;
  const ts = new Date().toLocaleTimeString();
  line.innerHTML = `<span class="timestamp">[${ts}]</span>${msg}`;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

async function init() {
  const canvas = document.getElementById('scene-canvas');
  const { Scene3D } = await import('./scene/Scene3D.js');
  scene3d = new Scene3D(canvas);
  scene3d.onProgress = (t) => {
    scrubSlider.value = String(Math.round(t * 1000));
  };
  scrubSlider.disabled = false;
  scene3d.onPositionUpdate = (x, y, z, heading) => {
    readoutPos.textContent = `X: ${x.toFixed(2)} Y: ${y.toFixed(2)} Z: ${z.toFixed(2)}`;
    readoutHeading.textContent = `HDG: ${Math.round(heading)}\u00B0`;
  };
  scene3d.onLog = log;
  scene3d.onCollision = (collision, droneId) => {
    hasCollision = true;
    updateFlightStatus();
    log(`COLLISION: ${droneId} hit ${collision.obstacle.type} (${collision.obstacle.name})`, 'error');
  };
  scene3d.onTelemetry = (telemetry) => {
    updateStatusMetrics(telemetry);
    pushTelemetrySample(telemetry);
  };
  scene3d.onPlaybackEnd = (z) => {
    statusText.textContent = z < 0.15 ? 'Landed' : 'Completed';
    statusDot.classList.remove('flying', 'collision');
    statusText.classList.remove('flying', 'collision');
  };

  const cameraSelect = document.getElementById('camera-mode-select');
  if (cameraSelect) {
    cameraSelect.addEventListener('change', (e) => {
      scene3d.setCameraMode(parseInt(e.target.value, 10));
    });
  }

  canvas.addEventListener('waypoint-selected', (e) => {
    selectedPath = [e.detail.commandIndex];
    renderCommandList();
    const item = document.querySelector('#command-list .cmd-item.selected');
    if (item) item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });

  bindChartToggle();
  setupChartCanvas();
  bindToolbar();
  bindModeToggle();
  bindDroneBar();
  bindCommandPalette();
  bindPlayback();
  bindCopyCode();
  bindObstaclePanel();
  renderDroneTabs();
  renderCommandList();
  renderObstacleList();
  updateCodePreview();
  refresh();
  resetStatusMetrics();

  window.onerror = (msg, src, line, col, err) => {
    log(`Error: ${msg} (${src}:${line}:${col})`, 'error');
  };
  window.addEventListener('unhandledrejection', (e) => {
    log(`Unhandled rejection: ${e.reason}`, 'error');
  });

  document.getElementById('btn-clear-console').addEventListener('click', () => {
    consoleOutput.innerHTML = '';
  });

  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      if (chartExpanded) {
        chartW = 0;
        chartH = 0;
        drawTelemetryChart();
      }
    }, 150);
  });

  log('Drone Planner loaded', 'success');
}

function resetStatusMetrics() {
  statusAlt.textContent = '0.00';
  statusSpd.textContent = '0.00';
  statusBat.textContent = '100';
  statusHdg.textContent = '0';
  isFlying = false;
  hasCollision = false;
  updateFlightStatus();
  telemetryHead = 0;
  telemetryCount = 0;
  drawTelemetryChart();
}

function updateStatusMetrics(telemetry) {
  if (!telemetry) return;
  statusAlt.textContent = (telemetry.altitude_m || 0).toFixed(2);
  statusSpd.textContent = (telemetry.speed || 0).toFixed(2);
  statusBat.textContent = Math.round(telemetry.batteryPercent || 100);
  statusHdg.textContent = Math.round(telemetry.heading || 0);
}

function updateFlightStatus() {
  const dot = statusDot;
  const text = statusText;
  dot.classList.remove('flying', 'collision');
  text.classList.remove('flying', 'collision');

  if (hasCollision) {
    text.textContent = 'COLLISION';
    dot.classList.add('collision');
    text.classList.add('collision');
  } else if (isFlying) {
    text.textContent = 'FLYING';
    dot.classList.add('flying');
    text.classList.add('flying');
  } else {
    text.textContent = 'READY';
  }
}

function pushTelemetrySample(telemetry) {
  if (!telemetry || !chartExpanded) return;
  telemetryRing[telemetryHead] = telemetry.speed || 0;
  telemetryHead = (telemetryHead + 1) % TELEMETRY_BUFFER_SIZE;
  if (telemetryCount < TELEMETRY_BUFFER_SIZE) telemetryCount++;
  drawTelemetryChart();
}

function bindChartToggle() {
  const panel = document.getElementById('telemetry-chart-panel');
  const btn = document.getElementById('btn-toggle-chart');
  if (!panel || !btn) return;
  btn.addEventListener('click', () => {
    chartExpanded = !chartExpanded;
    panel.classList.toggle('collapsed', !chartExpanded);
    btn.textContent = chartExpanded ? 'Hide' : 'Show';
    if (chartExpanded) drawTelemetryChart();
  });
}

function getCssColor(variable) {
  const el = document.documentElement;
  const value = getComputedStyle(el).getPropertyValue(variable).trim();
  return value || '#00d4ff';
}

function setupChartCanvas() {
  const canvas = document.getElementById('telemetry-chart');
  if (!canvas) return;
  chartCanvas = canvas;
  chartCtx = canvas.getContext('2d');
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      if (rect.width === chartW && rect.height === chartH) return;
      chartW = rect.width;
      chartH = rect.height;
      if (chartExpanded) drawTelemetryChart();
    }).observe(chartCanvas);
  }
}

function drawTelemetryChart() {
  if (!chartExpanded || !chartCanvas || !chartCtx) return;
  if (chartW === 0 || chartH === 0) {
    const rect = chartCanvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    chartW = rect.width;
    chartH = rect.height;
  }
  const dpr = window.devicePixelRatio || 1;
  const bw = Math.round(chartW * dpr);
  const bh = Math.round(chartH * dpr);
  if (chartCanvas.width !== bw || chartCanvas.height !== bh) {
    chartCanvas.width = bw;
    chartCanvas.height = bh;
    chartCtx.scale(dpr, dpr);
  }
  const w = chartW;
  const h = chartH;
  const ctx = chartCtx;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(13, 20, 31, 0.6)';
  ctx.fillRect(0, 0, w, h);

  const pad = { top: 18, right: 10, bottom: 18, left: 36 };
  const chartW2 = w - pad.left - pad.right;
  const chartH2 = h - pad.top - pad.bottom;

  ctx.strokeStyle = 'rgba(118, 131, 144, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + chartH2 * (i / 4);
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + chartW2, y);
  }
  for (let i = 0; i <= 5; i++) {
    const x = pad.left + chartW2 * (i / 5);
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, pad.top + chartH2);
  }
  ctx.stroke();

  if (telemetryCount < 2) {
    ctx.fillStyle = 'rgba(118, 131, 144, 0.6)';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No telemetry data', pad.left + chartW2 / 2, pad.top + chartH2 / 2);
    return;
  }

  let minV = Infinity;
  let maxV = -Infinity;
  const start = (telemetryHead - telemetryCount + TELEMETRY_BUFFER_SIZE) % TELEMETRY_BUFFER_SIZE;
  for (let i = 0; i < telemetryCount; i++) {
    const v = telemetryRing[(start + i) % TELEMETRY_BUFFER_SIZE];
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }
  if (maxV - minV < 0.1) { maxV += 0.1; minV -= 0.1; }
  if (minV < 0) minV = 0;

  ctx.strokeStyle = 'rgba(118, 131, 144, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top + chartH2);
  ctx.lineTo(pad.left + chartW2, pad.top + chartH2);
  ctx.stroke();

  if (chartAccent === null) {
    chartAccent = getCssColor('--accent');
    chartDim = getCssColor('--text-dim');
  }
  ctx.strokeStyle = chartAccent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  const n = telemetryCount;
  for (let i = 0; i < n; i++) {
    const x = pad.left + chartW2 * (i / (n - 1));
    const y = pad.top + chartH2 * (1 - (telemetryRing[(start + i) % TELEMETRY_BUFFER_SIZE] - minV) / (maxV - minV));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.fillStyle = chartAccent;
  const lastX = pad.left + chartW2;
  const lastY = pad.top + chartH2 * (1 - (telemetryRing[(start + n - 1) % TELEMETRY_BUFFER_SIZE] - minV) / (maxV - minV));
  ctx.beginPath();
  ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(118, 131, 144, 0.8)';
  ctx.font = '9px Inter, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) {
    const v = minV + (maxV - minV) * (1 - i / 4);
    ctx.fillText(v.toFixed(1), pad.left - 6, pad.top + chartH2 * (i / 4));
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = chartDim;
  ctx.font = '9px Inter, sans-serif';
  ctx.fillText('Speed (m/s)', pad.left, 4);
}

function bindObstaclePanel() {
  document.getElementById('btn-toggle-obstacles').addEventListener('click', () => {
    const meshes = scene3d.getObstacleMeshes();
    const visible = meshes.every(m => m.visible);
    meshes.forEach(m => { m.visible = !visible; });
    log(`Obstacles ${visible ? 'hidden' : 'shown'}`);
  });

  document.getElementById('btn-clear-obstacles').addEventListener('click', () => {
    scene3d.clearObstacles();
    renderObstacleList();
    log('All obstacles cleared');
  });

  document.getElementById('btn-reload-obstacles').addEventListener('click', () => {
    scene3d.loadBaseObstacles();
    renderObstacleList();
    log('Base obstacles reloaded');
  });

  const importBtn = document.getElementById('btn-import-obstacles');
  const fileInput = document.getElementById('obstacle-file-input');
  if (importBtn && fileInput) {
    importBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleObstacleFile(file);
      e.target.value = '';
    });
  }

  const boundaryBtn = document.getElementById('btn-toggle-boundary');
  if (boundaryBtn) {
    boundaryBtn.addEventListener('click', () => {
      const visible = scene3d.boundaryVisible;
      scene3d.setBoundaryVisible(!visible);
      log(`Boundary ${visible ? 'hidden' : 'shown'}`);
    });
  }

  const panel = document.getElementById('obstacle-panel');
  if (panel) {
    panel.addEventListener('dragover', (e) => {
      e.preventDefault();
      panel.classList.add('drag-over');
    });
    panel.addEventListener('dragleave', () => panel.classList.remove('drag-over'));
    panel.addEventListener('drop', (e) => {
      e.preventDefault();
      panel.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) handleObstacleFile(file);
    });
  }
}

function handleObstacleFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      importObstacleText(ev.target.result, file.name);
    } catch (err) {
      log(`Error importing obstacles: ${err.message}`, 'error');
    }
  };
  reader.readAsText(file);
}

function importObstacleText(text, filename) {
  const result = obstacleImporter.run(text, filename);
  const imported = scene3d.importObstacles(result.obstacles);
  const rejected = scene3d.getRejectedCount();
  renderObstacleList();
  log(`Imported ${imported.length} obstacles from ${filename}`, 'success');
  if (rejected > 0) log(`${rejected} obstacles outside flight boundary skipped`, 'warn');
}

function renderObstacleList() {
  const list = document.getElementById('obstacle-list');
  if (!list) return;

  list.innerHTML = '';
  const obstacles = scene3d.getObstacles();

  obstacles.forEach(obs => {
    const item = document.createElement('div');
    item.className = 'obstacle-item';
    item.innerHTML = `
      <span>
        <span class="obs-type">${obs.type}</span>
        <span class="obs-name">${obs.name}</span>
      </span>
      <button class="obs-delete" title="Remove obstacle">X</button>
    `;

    item.querySelector('.obs-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      scene3d.removeObstacle(obs.id);
      renderObstacleList();
      log(`Obstacle removed: ${obs.name}`);
    });

    list.appendChild(item);
  });
}

function bindToolbar() {
  document.getElementById('btn-new').addEventListener('click', () => {
    if (confirm('Start a new flight plan? Unsaved changes will be lost.')) {
      plan = createDefaultPlan();
      plan.activeDroneId = plan.drones[0].id;
      selectedPath = null;
      refresh();
      log('New flight plan created');
    }
  });

  document.getElementById('btn-save').addEventListener('click', async () => {
    log('Saving flight plan...');
    if (window.electronAPI) {
      await window.electronAPI.saveFile(plan, (plan.name || 'flight') + '.flight');
    } else {
      const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (plan.name || 'flight') + '.flight';
      a.click();
    }
    log('Flight plan saved', 'success');
  });

  document.getElementById('btn-load').addEventListener('click', async () => {
    log('Loading flight plan...');
    if (window.electronAPI) {
      const result = await window.electronAPI.loadFile();
      if (result.success) {
        if (result.ext === '.py') {
          const cmds = parseDroneScript(result.data);
          const drone = getActiveDrone(plan);
          drone.commands = cmds;
          log(`Imported ${cmds.length} commands into ${drone.name}`, 'success');
        } else {
          plan = JSON.parse(result.data);
          if (!plan.activeDroneId && plan.drones.length > 0) {
            plan.activeDroneId = plan.drones[0].id;
          }
          log(`Loaded flight plan: ${plan.name}`, 'success');
        }
        selectedPath = null;
        refresh();
      } else {
        log('Load cancelled', 'warn');
      }
    } else {
      document.getElementById('py-input').click();
    }
  });

  document.getElementById('py-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        if (file.name.endsWith('.py')) {
          const cmds = parseDroneScript(ev.target.result);
          const drone = getActiveDrone(plan);
          drone.commands = cmds;
          log(`Imported ${cmds.length} commands from ${file.name}`, 'success');
        } else {
          plan = JSON.parse(ev.target.result);
          if (!plan.activeDroneId && plan.drones.length > 0) {
            plan.activeDroneId = plan.drones[0].id;
          }
          log(`Loaded ${file.name}`, 'success');
        }
        selectedPath = null;
        refresh();
      } catch (err) {
        log(`Error loading file: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  document.getElementById('btn-import-py').addEventListener('click', () => {
    document.getElementById('py-input').click();
  });

  document.getElementById('btn-export-py').addEventListener('click', async () => {
    const code = generateSwarmScript(plan.drones);
    const name = (plan.name || 'flight') + '.py';
    if (window.electronAPI) {
      await window.electronAPI.exportFile(code, name, 'py');
    } else {
      const blob = new Blob([code], { type: 'text/x-python' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
    }
  });

  document.getElementById('btn-export-single').addEventListener('click', async () => {
    const drone = getActiveDrone(plan);
    const code = generateDroneScript(drone.commands);
    const name = (drone.name || 'drone') + '.py';
    if (window.electronAPI) {
      await window.electronAPI.exportFile(code, name, 'py');
    } else {
      const blob = new Blob([code], { type: 'text/x-python' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
    }
  });

  document.getElementById('btn-export-anim').addEventListener('click', async () => {
    const code = generateAnimationScript(getActiveCommands(plan));
    const name = (plan.name || 'flight') + '_sim.py';
    if (window.electronAPI) {
      await window.electronAPI.exportFile(code, name, 'py');
    } else {
      const blob = new Blob([code], { type: 'text/x-python' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
    }
  });

  document.getElementById('plan-name').addEventListener('click', () => {
    const name = prompt('Flight plan name:', plan.name);
    if (name !== null && name.trim()) {
      plan.name = name.trim();
      document.getElementById('plan-name').textContent = plan.name;
    }
  });
}

function bindDroneBar() {
  document.getElementById('btn-add-drone').addEventListener('click', () => {
    const drone = addDrone(plan);
    log(`Added ${drone.name}`);
    selectedPath = null;
    refresh();
  });

  document.getElementById('btn-rm-drone').addEventListener('click', () => {
    if (plan.drones.length <= 1) {
      log('Cannot remove the only drone', 'warn');
      return;
    }
    const drone = getActiveDrone(plan);
    const name = drone.name;
    removeDrone(plan, drone.id);
    log(`Removed ${name}`);
    selectedPath = null;
    refresh();
  });

  document.getElementById('btn-dup-drone').addEventListener('click', () => {
    const drone = getActiveDrone(plan);
    const dup = duplicateDrone(plan, drone.id);
    if (dup) {
      log(`Duplicated ${drone.name} as ${dup.name}`);
      selectedPath = null;
      refresh();
    }
  });

  document.getElementById('formation-select').addEventListener('change', (e) => {
    const type = e.target.value;
    if (!type) return;
    const count = plan.drones.length;
    setFormation(plan, type, count);
    log(`Formation: ${type} (${count} drones)`);
    e.target.value = '';
    refresh();
  });
}

function renderDroneTabs() {
  const tabs = document.getElementById('drone-tabs');
  tabs.innerHTML = '';
  plan.drones.forEach(drone => {
    const tab = document.createElement('div');
    tab.className = 'drone-tab' + (drone.id === plan.activeDroneId ? ' active' : '');
    tab.innerHTML = `<span class="drone-dot" style="background:${drone.color}"></span>${drone.name}<span class="drone-cmd-count">${drone.commands.length}</span>`;
    tab.addEventListener('click', () => {
      plan.activeDroneId = drone.id;
      selectedPath = null;
      refresh();
    });
    tab.addEventListener('dblclick', () => {
      const name = prompt('Rename drone:', drone.name);
      if (name !== null && name.trim()) {
        drone.name = name.trim();
        refresh();
      }
    });
    tabs.appendChild(tab);
  });
}

function bindModeToggle() {
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

function bindCommandPalette() {
  document.querySelectorAll('.cmd-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.cmd;
      const cmd = createCommand(type);
      if (cmd) {
        const activeCmds = getActiveCommands(plan);
        if (selectedPath) {
          const target = getCommandByPath(activeCmds, selectedPath);
          if (target && isBlockCommand(target) && target.children) {
            target.children.push(cmd);
          } else {
            activeCmds.push(cmd);
            selectedPath = null;
          }
        } else {
          activeCmds.push(cmd);
        }
        log(`Added: ${getCommandLabel(cmd)}`);
        refresh();
      }
    });
  });
}

function bindPlayback() {
  document.getElementById('btn-play').addEventListener('click', () => {
    const total = plan.drones.reduce((s, d) => s + d.commands.length, 0);
    log(`Play - ${plan.drones.length} drone(s), ${total} commands`);
    scene3d.setSwarm(plan.drones);
    scene3d.play();
    scrubSlider.value = '0';
    isFlying = true;
    hasCollision = false;
    telemetryHead = 0;
    telemetryCount = 0;
    startHighlightTimer();
    updateFlightStatus();
  });

  document.getElementById('btn-stop').addEventListener('click', () => {
    scene3d.pause();
    isFlying = false;
    stopHighlightTimer();
    updateFlightStatus();
    log('Playback paused', 'warn');
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    scene3d.reset();
    scrubSlider.value = '0';
    isFlying = false;
    hasCollision = false;
    stopHighlightTimer();
    updateFlightStatus();
    resetStatusMetrics();
    log('Playback reset');
  });

  document.getElementById('playback-speed').addEventListener('input', (e) => {
    const s = parseFloat(e.target.value);
    scene3d.setSpeed(s);
    document.getElementById('speed-label').textContent = s.toFixed(1) + 'x';
  });

  scrubSlider.addEventListener('input', () => {
    if (isFlying) {
      isFlying = false;
      stopHighlightTimer();
      updateFlightStatus();
    }
    scene3d.setPlaybackFraction(parseFloat(scrubSlider.value) / 1000);
  });

  scrubSlider.addEventListener('change', () => {
    scene3d.setPlaybackFraction(parseFloat(scrubSlider.value) / 1000);
  });
}

function bindCopyCode() {
  document.getElementById('btn-copy-code').addEventListener('click', () => {
    const code = plan.drones.length > 1
      ? generateSwarmScript(plan.drones)
      : generateDroneScript(getActiveCommands(plan));
    navigator.clipboard.writeText(code).then(() => {
      const btn = document.getElementById('btn-copy-code');
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
    });
  });

  document.getElementById('btn-apply-code').addEventListener('click', () => {
    const code = document.getElementById('code-output').value;
    try {
      const commands = parseDroneScript(code);
      const activeDrone = getActiveDrone(plan);
      if (activeDrone) {
        activeDrone.commands = commands;
        refresh();
        log('Code applied successfully!', 'success');
      }
    } catch (e) {
      log(`Error applying code: ${e.message}`, 'error');
    }
  });
}

function getCommandByPath(commands, path) {
  let current = commands;
  for (let i = 0; i < path.length - 1; i++) {
    const idx = path[i];
    if (!current[idx] || !current[idx].children) return null;
    current = current[idx].children;
  }
  return current[path[path.length - 1]] || null;
}

function removeFromPath(commands, path) {
  if (path.length === 1) {
    commands.splice(path[0], 1);
    return;
  }
  const parent = getCommandByPath(commands, path.slice(0, -1));
  if (parent && parent.children) {
    parent.children.splice(path[path.length - 1], 1);
  }
}

function renderCommandList() {
  const list = document.getElementById('command-list');
  list.innerHTML = '';
  const drone = getActiveDrone(plan);
  const panel = document.querySelector('#command-list-panel h3');
  if (panel) panel.textContent = `${drone.name} Commands`;
  renderCommandsRecursive(drone.commands, list, 0, []);
}

function renderCommandsRecursive(commands, container, depth, parentPath) {
  commands.forEach((cmd, idx) => {
    const path = [...parentPath, idx];
    const isBlock = isBlockCommand(cmd);
    const cat = CMD_CATEGORIES[cmd.type] || '';
    const isSelected = selectedPath && pathsEqual(selectedPath, path);

    const item = document.createElement('div');
    item.className = `cmd-item ${cat}`;
    if (isBlock) item.classList.add('block-open');
    if (isSelected) item.classList.add('selected');

    const num = depth === 0 ? idx + 1 : `${parentPath.join('.')}.${idx}`;

    item.innerHTML = `
      <span class="cmd-num">${num}</span>
      <span class="cmd-name">${getCommandLabel(cmd)}</span>
      <span class="cmd-params">${isSelected ? '' : getCommandParams(cmd)}</span>
      <span class="cmd-actions">
        <button class="cmd-up" title="Move up" ${idx === 0 ? 'disabled' : ''}>Up</button>
        <button class="cmd-down" title="Move down" ${idx === commands.length - 1 ? 'disabled' : ''}>Dn</button>
        <button class="cmd-delete" title="Delete">X</button>
      </span>
    `;

    item.addEventListener('click', (e) => {
      if (e.target.closest('.cmd-actions')) return;
      if (e.target.closest('.cmd-inline-edit')) return;
      selectedPath = path;
      renderCommandList();
    });

    item.querySelector('.cmd-up').addEventListener('click', (e) => {
      e.stopPropagation();
      if (idx > 0) {
        [commands[idx - 1], commands[idx]] = [commands[idx], commands[idx - 1]];
        if (selectedPath && pathsEqual(selectedPath, path)) {
          selectedPath = [...parentPath, idx - 1];
        }
        refresh();
      }
    });

    item.querySelector('.cmd-down').addEventListener('click', (e) => {
      e.stopPropagation();
      if (idx < commands.length - 1) {
        [commands[idx + 1], commands[idx]] = [commands[idx], commands[idx + 1]];
        if (selectedPath && pathsEqual(selectedPath, path)) {
          selectedPath = [...parentPath, idx + 1];
        }
        refresh();
      }
    });

    item.querySelector('.cmd-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      removeFromPath(getActiveCommands(plan), path);
      selectedPath = null;
      refresh();
    });

    container.appendChild(item);

    if (isSelected) {
      const def = COMMAND_DEFS[cmd.type];
      if (def && def.params.length > 0) {
        const editRow = document.createElement('div');
        editRow.className = 'cmd-inline-edit';
        for (const paramDef of def.params) {
          const field = document.createElement('div');
          field.className = 'cmd-inline-field';
          const lbl = document.createElement('label');
          lbl.textContent = paramDef.label;

          let el;
          if (paramDef.type === 'select') {
            el = document.createElement('select');
            for (const opt of paramDef.options) {
              const option = document.createElement('option');
              option.value = opt;
              option.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
              el.appendChild(option);
            }
            el.value = cmd.params[paramDef.key] || paramDef.default;
            el.addEventListener('change', () => {
              cmd.params[paramDef.key] = el.value;
              updateCodePreview();
              renderCommandList();
            });
          } else if (paramDef.type === 'text') {
            el = document.createElement('input');
            el.type = 'text';
            el.value = cmd.params[paramDef.key] || paramDef.default;
            el.addEventListener('input', () => {
              cmd.params[paramDef.key] = el.value;
              debounceCodegen(updateCodePreview);
            });
            el.addEventListener('blur', () => renderCommandList());
          } else {
            el = document.createElement('input');
            el.type = 'number';
            el.value = cmd.params[paramDef.key] ?? paramDef.default;
            if (paramDef.min !== undefined) el.min = paramDef.min;
            if (paramDef.max !== undefined) el.max = paramDef.max;
            if (paramDef.step) el.step = paramDef.step;
            el.addEventListener('input', () => {
              cmd.params[paramDef.key] = (el.value === '' || isNaN(parseFloat(el.value))) ? paramDef.default : parseFloat(el.value);
              debounceCodegen(updateCodePreview);
            });
            el.addEventListener('blur', () => renderCommandList());
          }

          lbl.appendChild(el);
          field.appendChild(lbl);
          editRow.appendChild(field);
        }
        container.appendChild(editRow);
      }
    }

    if (isBlock && cmd.children) {
      const childContainer = document.createElement('div');
      childContainer.className = 'cmd-block-children';
      renderCommandsRecursive(cmd.children, childContainer, depth + 1, path);
      container.appendChild(childContainer);

      const addBar = document.createElement('div');
      addBar.className = 'cmd-block-add';
      const addBtn = document.createElement('button');
      addBtn.textContent = '+ Add';
      addBtn.addEventListener('click', () => {
        selectedPath = path;
        showCmdOptions(null);
        log(`Select a command to add inside ${getCommandLabel(cmd)}`);
      });
      addBar.appendChild(addBtn);
      container.appendChild(addBar);
    }
  });
}

function pathsEqual(a, b) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

function showCmdOptions(cmd) {
  const container = document.getElementById('dynamic-options');
  container.innerHTML = '';
  if (!cmd) return;

  const def = COMMAND_DEFS[cmd.type];
  if (!def || def.params.length === 0) return;

  for (const paramDef of def.params) {
    const label = document.createElement('label');
    label.textContent = paramDef.label + ': ';

    let el;
    if (paramDef.type === 'select') {
      el = document.createElement('select');
      for (const opt of paramDef.options) {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
        el.appendChild(option);
      }
      el.value = cmd.params[paramDef.key] || paramDef.default;
      el.addEventListener('change', () => {
        cmd.params[paramDef.key] = el.value;
        updateCodePreview();
        renderCommandList();
      });
    } else if (paramDef.type === 'text') {
      el = document.createElement('input');
      el.type = 'text';
      el.value = cmd.params[paramDef.key] || paramDef.default;
      el.addEventListener('input', () => {
        cmd.params[paramDef.key] = el.value;
        updateCodePreview();
        renderCommandList();
      });
    } else {
      el = document.createElement('input');
      el.type = 'number';
      el.value = cmd.params[paramDef.key] ?? paramDef.default;
      if (paramDef.min !== undefined) el.min = paramDef.min;
      if (paramDef.max !== undefined) el.max = paramDef.max;
      if (paramDef.step) el.step = paramDef.step;
      el.addEventListener('input', () => {
        cmd.params[paramDef.key] = (el.value === '' || isNaN(parseFloat(el.value))) ? paramDef.default : parseFloat(el.value);
        updateCodePreview();
        renderCommandList();
      });
    }

    label.appendChild(el);
    container.appendChild(label);
  }
}

function debounceCodegen(fn) {
  clearTimeout(codegenT);
  codegenT = setTimeout(fn, 150);
}

function startHighlightTimer() {
  if (highlightTimer !== null) return;
  highlightTimer = setInterval(highlightCurrentCommand, 100);
}

function stopHighlightTimer() {
  if (highlightTimer === null) return;
  clearInterval(highlightTimer);
  highlightTimer = null;
}

let currentHighlightIndex = -1;

function highlightCurrentCommand() {
  const codeOutput = document.getElementById('code-output');
  if (!codeOutput) return;

  const newIndex = scene3d.getCurrentCommandIndex();
  if (newIndex === currentHighlightIndex) return;
  currentHighlightIndex = newIndex;

  const code = codeOutput.value;
  if (code) {
    const lines = code.split('\n');
    if (newIndex >= 0 && newIndex < lines.length) {
      codeOutput.value = lines.map((line, i) =>
        i === newIndex ? `> ${line}` : line
      ).join('\n');
    }
  }
}

function updateCodePreview() {
  let code;
  if (plan.drones.length > 1) {
    code = generateSwarmScript(plan.drones);
  } else {
    code = generateDroneScript(getActiveCommands(plan));
  }
  const codeOutput = document.getElementById('code-output');
  codeOutput.value = code;
  currentHighlightIndex = -1;
}

function refresh() {
  renderDroneTabs();
  renderCommandList();
  renderObstacleList();
  updateCodePreview();
  document.getElementById('plan-name').textContent = plan.name || 'Untitled Flight Plan';
  scrubSlider.value = '0';

  scene3d.setSwarm(plan.drones);
  scene3d.setActiveDroneId(plan.activeDroneId);
}

document.addEventListener('DOMContentLoaded', init);
