const moveDist = { key: 'dist', label: 'cm', type: 'number', default: 50, min: 10, max: 300 };
const moveSpeed = { key: 'speed', label: 'Speed', type: 'number', default: 50, min: 0, max: 100 };
const moveCode = (method) => (p) => {
  const speed = Math.round((p.speed / 100) * 2 * 100) / 100;
  const speedStr = Number.isInteger(speed) ? speed.toFixed(1) : String(speed);
  return `drone.${method}(${p.dist}, speed=${speedStr})`;
};
const moveDef = (method, label) => ({ label, params: [moveDist, moveSpeed], code: moveCode(method) });

const shapeSpeed = (d) => ({ key: 'speed', label: 'Speed %', type: 'number', default: d, min: 10, max: 100 });
const shapeSecs = (d, min) => ({ key: 'secs', label: 'Secs', type: 'number', default: d, min, max: 10 });
const shapeDir = { key: 'dir', label: 'Direction', type: 'select', options: ['clockwise', 'counter-clockwise'], default: 'clockwise' };
const dirVal = (p) => (p.dir === 'clockwise' ? 1 : -1);
const shapeCode = (method, secs) => (p) => `drone.${method}(speed=${p.speed}${secs ? `, seconds=${secs === true ? p.secs : secs}` : ''}, direction=${dirVal(p)})`;
const shapeDef = (method, label, params, secs) => ({ label, params, code: shapeCode(method, secs) });

export const COMMAND_DEFS = {
  takeoff:        { label: 'Takeoff',        params: [],                                     code: 'drone.takeoff()' },
  land:           { label: 'Land',            params: [],                                     code: 'drone.land()' },
  emergency_stop: { label: 'Emergency Stop', params: [],                                     code: 'drone.emergency_stop()' },
  stop_motors:    { label: 'Stop Motors',     params: [],                                     code: 'drone.stop_motors()' },
  hover:          { label: 'Hover',           params: [{ key: 'dur', label: 'Secs', type: 'number', default: 1, min: 0.01, max: 10 }], code: (p) => `drone.hover(${p.dur})` },
  flip:           { label: 'Flip',            params: [{ key: 'dir', label: 'Dir', type: 'select', options: ['forward','back','left','right'], default: 'back' }], code: (p) => `drone.flip("${p.dir}")` },
  go:             { label: 'Go',              params: [
    { key: 'dir', label: 'Dir', type: 'select', options: ['forward','backward','left','right'], default: 'forward' },
    { key: 'power', label: 'Power %', type: 'number', default: 50, min: 0, max: 100 },
    { key: 'dur', label: 'Secs', type: 'number', default: 1, min: 0.1, max: 10 }
  ], code: (p) => `drone.go("${p.dir}", ${p.power}, ${p.dur})` },
  move_forward:   moveDef('move_forward', 'Forward'),
  move_backward:  moveDef('move_backward', 'Back'),
  move_left:      moveDef('move_left', 'Left'),
  move_right:     moveDef('move_right', 'Right'),
  turn_left:      { label: 'Turn Left',       params: [{ key: 'deg', label: 'Deg', type: 'number', default: 90, min: 1, max: 360 }], code: (p) => `drone.turn_left(${p.deg})` },
  turn_right:     { label: 'Turn Right',      params: [{ key: 'deg', label: 'Deg', type: 'number', default: 90, min: 1, max: 360 }], code: (p) => `drone.turn_right(${p.deg})` },
  turn_degree:    { label: 'Turn',            params: [
    { key: 'deg', label: 'Deg', type: 'number', default: 90, min: -360, max: 360 },
    { key: 'timeout', label: 'Timeout', type: 'number', default: 3, min: 0.1, max: 30 },
    { key: 'p_value', label: 'P Value', type: 'number', default: 10, min: 0, max: 100 }
  ], code: (p) => `drone.turn_degree(${p.deg}, timeout=${p.timeout}, p_value=${p.p_value})` },
  circle:         shapeDef('circle', 'Circle', [shapeSpeed(75), shapeDir], false),
  circle_turn:    shapeDef('circle_turn', 'Circle Turn', [shapeSpeed(75), shapeSecs(1, 1), shapeDir], true),
  square:         shapeDef('square', 'Square', [shapeSpeed(60), shapeSecs(1, 0.1), shapeDir], true),
  square_turn:    shapeDef('square', 'Square Turn', [shapeSpeed(60), shapeSecs(1, 0.1), shapeDir], true),
  triangle:       shapeDef('triangle', 'Triangle', [shapeSpeed(60), shapeSecs(1, 0.1), shapeDir], true),
  triangle_turn:  shapeDef('triangle_turn', 'Triangle Turn', [shapeSpeed(60), shapeSecs(1, 0.1), shapeDir], true),
  spiral:         shapeDef('spiral', 'Spiral', [shapeSpeed(50), shapeDir], 3),
  sway:            { label: 'Sway',             params: [
    { key: 'speed', label: 'Speed %', type: 'number', default: 50, min: 10, max: 100 },
    { key: 'secs', label: 'Secs', type: 'number', default: 2, min: 1, max: 10 },
    { key: 'dir', label: 'Direction', type: 'select', options: ['forward-back', 'left-right', 'up-down', 'turn-left', 'turn-right', 'pitch-forward', 'pitch-backward', 'roll-left', 'roll-right'], default: 'forward-back' }
  ], code: (p) => {
    const dirMap = { 'forward-back': 1, 'left-right': 1, 'up-down': 1, 'turn-left': 1, 'turn-right': -1, 'pitch-forward': 1, 'pitch-backward': -1, 'roll-left': 1, 'roll-right': -1 };
    return `drone.sway(speed=${p.speed}, seconds=${p.secs}, direction=${dirMap[p.dir] ?? 1})`;
  } },
  keep_distance:  { label: 'Keep Distance',    params: [
    { key: 'dist', label: 'cm', type: 'number', default: 50, min: 10, max: 300 },
    { key: 'speed', label: 'Speed %', type: 'number', default: 50, min: 10, max: 100 }
  ], code: (p) => `drone.keep_distance(2, ${p.dist})` },
  avoid_wall:     { label: 'Avoid Wall',      params: [
    { key: 'dist', label: 'cm', type: 'number', default: 50, min: 10, max: 300 },
    { key: 'speed', label: 'Speed %', type: 'number', default: 50, min: 10, max: 100 }
  ], code: (p) => `drone.avoid_wall(2, ${p.dist})` },
  detect_wall:    { label: 'Detect Wall',      params: [
    { key: 'var', label: 'Store in', type: 'text', default: 'detected' }
  ], code: (p) => `${p.var} = drone.detect_wall()` },

  led:            { label: 'LED',             params: [
    { key: 'color', label: 'Color', type: 'select', options: ['red','green','blue','yellow','cyan','magenta','white','purple','orange','pink','off'], default: 'green' }
  ], code: (p) => {
    const rgb = {
      red: [255, 0, 0],
      green: [0, 255, 0],
      blue: [0, 0, 255],
      yellow: [255, 255, 0],
      cyan: [0, 255, 255],
      magenta: [255, 0, 255],
      white: [255, 255, 255],
      purple: [128, 0, 255],
      orange: [255, 165, 0],
      pink: [255, 192, 203]
    };
    if (p.color === 'off') return 'drone.drone_LED_off()';
    const c = rgb[p.color] || [0, 255, 0];
    return `drone.set_drone_LED(${c[0]}, ${c[1]}, ${c[2]}, 100)`;
  } },
  led_off:        { label: 'LED Off',         params: [],                                     code: 'drone.drone_LED_off()' },
  random_led:     { label: 'Random LED',      params: [],                                     code: 'drone.set_drone_LED(0, 255, 128, 100)' },
  buzzer:         { label: 'Buzzer',          params: [
    { key: 'freq', label: 'Frequency (Hz)', type: 'number', default: 440, min: 100, max: 2000 },
    { key: 'dur', label: 'Duration (s)', type: 'number', default: 0.5, min: 0.1, max: 5, step: 0.1 }
  ], code: (p) => {
    const notes = { 261: 'C4', 294: 'D4', 329: 'E4', 349: 'F4', 392: 'G4', 440: 'A4', 494: 'B4', 523: 'C5', 659: 'E5', 880: 'A5' };
    const freqs = Object.keys(notes).map(Number);
    const freq = Number(p.freq);
    let nearest = freqs[0];
    let best = Math.abs(freq - nearest);
    for (const f of freqs) {
      const d = Math.abs(freq - f);
      if (d < best) { best = d; nearest = f; }
    }
    return `drone.drone_buzzer("${notes[nearest]}", ${p.dur})`;
  } },
  time_sleep:     { label: 'Sleep',           params: [{ key: 'dur', label: 'Secs', type: 'number', default: 1, min: 0.1, max: 10 }], code: (p) => `time.sleep(${p.dur})` },
  drone_sleep:    { label: 'Sleep',           params: [{ key: 'dur', label: 'Secs', type: 'number', default: 1, min: 0.1, max: 10, step: 0.1 }], code: (p) => `time.sleep(${p.dur})` },

  var_declare:    { label: 'Var',             params: [
    { key: 'name', label: 'Name', type: 'text', default: 'x' },
    { key: 'value', label: 'Value', type: 'text', default: '0' }
  ], code: (p) => `${p.name} = ${p.value}` },
  set_var:        { label: 'Set',             params: [
    { key: 'name', label: 'Name', type: 'text', default: 'x' },
    { key: 'op', label: 'Op', type: 'select', options: ['=', '+=', '-=', '*=', '/='], default: '=' },
    { key: 'value', label: 'Value', type: 'text', default: '1' }
  ], code: (p) => `${p.name} ${p.op} ${p.value}` },
  print_var:      { label: 'Print',           params: [
    { key: 'value', label: 'Value', type: 'text', default: 'x' }
  ], code: (p) => `print(${p.value})` },

  if_block:       { label: 'If',              params: [
    { key: 'condition', label: 'Condition', type: 'text', default: 'x > 0' }
  ], isBlock: true },
  elif_block:     { label: 'Elif',            params: [
    { key: 'condition', label: 'Condition', type: 'text', default: 'x == 0' }
  ], isBlock: true },
  else_block:     { label: 'Else',            params: [], isBlock: true },
  end_block:      { label: 'End',             params: [], code: '' },

  while_block:    { label: 'While',           params: [
    { key: 'condition', label: 'Condition', type: 'text', default: 'True' }
  ], isBlock: true },
  for_block:      { label: 'For Loop',        params: [
    { key: 'var', label: 'Var', type: 'text', default: 'i' },
    { key: 'start', label: 'Start', type: 'number', default: 0 },
    { key: 'end_val', label: 'End', type: 'number', default: 5 },
    { key: 'step', label: 'Step', type: 'number', default: 1 }
  ], isBlock: true },
  break_cmd:      { label: 'Break',           params: [], code: 'break' },

  get_battery:    { label: 'Battery',         params: [
    { key: 'var', label: 'Store in', type: 'text', default: 'battery' }
  ], code: (p) => `${p.var} = drone.get_battery()` },
  get_height:     { label: 'Height',          params: [
    { key: 'var', label: 'Store in', type: 'text', default: 'height' },
    { key: 'unit', label: 'Unit', type: 'select', options: ['cm', 'm', 'ft', 'in'], default: 'cm' }
  ], code: (p) => `${p.var} = drone.get_height(unit="${p.unit}")` },
  get_front_range: { label: 'Front Range',     params: [
    { key: 'var', label: 'Store in', type: 'text', default: 'dist' },
    { key: 'unit', label: 'Unit', type: 'select', options: ['cm', 'm', 'ft', 'in'], default: 'cm' }
  ], code: (p) => `${p.var} = drone.get_front_range(unit="${p.unit}")` },
  get_bottom_range:{ label: 'Bottom Range',    params: [
    { key: 'var', label: 'Store in', type: 'text', default: 'dist' },
    { key: 'unit', label: 'Unit', type: 'select', options: ['cm', 'm', 'ft', 'in'], default: 'cm' }
  ], code: (p) => `${p.var} = drone.get_bottom_range(unit="${p.unit}")` },
  get_front_color: { label: 'Front Color',     params: [
    { key: 'var', label: 'Store in', type: 'text', default: 'color' },
    { key: 'kind', label: 'Kind', type: 'select', options: ['name', 'rgb', 'index'], default: 'name' }
  ], code: (p) => `${p.var} = drone.get_front_color(kind="${p.kind}")` },
  get_back_color:  { label: 'Back Color',      params: [
    { key: 'var', label: 'Store in', type: 'text', default: 'color' },
    { key: 'kind', label: 'Kind', type: 'select', options: ['name', 'rgb', 'index'], default: 'name' }
  ], code: (p) => `${p.var} = drone.get_back_color(kind="${p.kind}")` },
  get_temperature:{ label: 'Temperature',     params: [
    { key: 'var', label: 'Store in', type: 'text', default: 'temp' },
    { key: 'unit', label: 'Unit', type: 'select', options: ['C', 'F'], default: 'C' }
  ], code: (p) => `${p.var} = drone.get_temperature(unit="${p.unit}")` },
  get_distance:    { label: 'Distance',         params: [
    { key: 'var', label: 'Store in', type: 'text', default: 'dist' }
  ], code: (p) => `${p.var} = drone.get_front_range()` },

  func_def:       { label: 'Define Func',     params: [
    { key: 'name', label: 'Name', type: 'text', default: 'my_func' }
  ], isBlock: true },
  func_call:      { label: 'Call Func',       params: [
    { key: 'name', label: 'Name', type: 'text', default: 'my_func' }
  ], code: (p) => `${p.name}()` },
  return_val:     { label: 'Return',          params: [
    { key: 'value', label: 'Value', type: 'text', default: '0' }
  ], code: (p) => `return ${p.value}` },

  list_declare:   { label: 'New List',        params: [
    { key: 'name', label: 'Name', type: 'text', default: 'my_list' },
    { key: 'values', label: 'Values', type: 'text', default: '1, 2, 3' }
  ], code: (p) => `${p.name} = [${p.values}]` },
  list_append:    { label: 'Append',          params: [
    { key: 'name', label: 'List', type: 'text', default: 'my_list' },
    { key: 'value', label: 'Value', type: 'text', default: '0' }
  ], code: (p) => `${p.name}.append(${p.value})` },
  list_get:       { label: 'Get Index',       params: [
    { key: 'list_name', label: 'List', type: 'text', default: 'my_list' },
    { key: 'index', label: 'Index', type: 'text', default: '0' },
    { key: 'var', label: 'Store in', type: 'text', default: 'val' }
  ], code: (p) => `${p.var} = ${p.list_name}[${p.index}]` },

  user_input:     { label: 'Input',           params: [
    { key: 'var', label: 'Store in', type: 'text', default: 'user_val' },
    { key: 'prompt', label: 'Prompt', type: 'text', default: 'Enter value: ' }
  ], code: (p) => `${p.var} = input("${p.prompt}")` },

  timer_start:    { label: 'Start Timer',     params: [
    { key: 'name', label: 'Name', type: 'text', default: 't' }
  ], code: (p) => `${p.name} = time.time()` },
  timer_elapsed:  { label: 'Get Elapsed',     params: [
    { key: 'name', label: 'Timer', type: 'text', default: 't' },
    { key: 'var', label: 'Store in', type: 'text', default: 'elapsed' }
  ], code: (p) => `${p.var} = time.time() - ${p.name}` }
};

export function createCommand(type) {
  const def = COMMAND_DEFS[type];
  if (!def) return null;
  const params = {};
  for (const p of def.params) {
    params[p.key] = p.default;
  }
  const cmd = { id: crypto.randomUUID(), type, params };
  if (def.isBlock) cmd.children = [];
  return cmd;
}

export function getCommandCode(cmd) {
  const def = COMMAND_DEFS[cmd.type];
  if (!def) return '';
  if (typeof def.code === 'function') return def.code(cmd.params);
  return def.code;
}

export function getCommandLabel(cmd) {
  return COMMAND_DEFS[cmd.type]?.label || cmd.type;
}

export function getCommandParams(cmd) {
  const def = COMMAND_DEFS[cmd.type];
  if (!def || def.params.length === 0) return '';
  return Object.entries(cmd.params).map(([k, v]) => `${k}=${v}`).join(', ');
}

export function isBlockCommand(cmd) {
  return COMMAND_DEFS[cmd.type]?.isBlock || false;
}

export function createDefaultPlan() {
  return {
    name: 'Untitled Flight Plan',
    drones: [
      { id: crypto.randomUUID(), name: 'Drone 1', color: '#58a6ff', commands: [], offset: [0, 0, 0] }
    ],
    activeDroneId: null
  };
}

export function getActiveDrone(plan) {
  return plan.drones.find(d => d.id === plan.activeDroneId) || plan.drones[0];
}

export function getActiveCommands(plan) {
  const drone = getActiveDrone(plan);
  return drone ? drone.commands : [];
}

export const DRONE_COLORS = ['#58a6ff', '#3fb950', '#f0883e', '#bc8cff', '#39d2c0', '#f778ba', '#d29922', '#f85149'];

export function addDrone(plan) {
  const idx = plan.drones.length;
  const color = DRONE_COLORS[idx % DRONE_COLORS.length];
  const drone = {
    id: crypto.randomUUID(),
    name: `Drone ${idx + 1}`,
    color,
    commands: [],
    offset: [0, 0, 0]
  };
  plan.drones.push(drone);
  plan.activeDroneId = drone.id;
  return drone;
}

export function removeDrone(plan, droneId) {
  if (plan.drones.length <= 1) return false;
  const idx = plan.drones.findIndex(d => d.id === droneId);
  if (idx === -1) return false;
  plan.drones.splice(idx, 1);
  if (plan.activeDroneId === droneId) {
    plan.activeDroneId = plan.drones[0].id;
  }
  return true;
}

export function duplicateDrone(plan, droneId) {
  const src = plan.drones.find(d => d.id === droneId);
  if (!src) return null;
  const idx = plan.drones.length;
  const color = DRONE_COLORS[idx % DRONE_COLORS.length];
  const drone = {
    id: crypto.randomUUID(),
    name: src.name + ' Copy',
    color,
    commands: JSON.parse(JSON.stringify(src.commands)),
    offset: [...src.offset]
  };
  plan.drones.push(drone);
  plan.activeDroneId = drone.id;
  return drone;
}

export function setFormation(plan, type, count) {
  while (plan.drones.length < count) {
    addDrone(plan);
  }
  while (plan.drones.length > count) {
    removeDrone(plan, plan.drones[plan.drones.length - 1].id);
  }

  const spacing = 0.5;

  plan.drones.forEach((drone, i) => {
    switch (type) {
      case 'line':
        drone.offset = [(i - (count - 1) / 2) * spacing, 0, 0];
        break;
      case 'grid': {
        const cols = Math.ceil(Math.sqrt(count));
        const row = Math.floor(i / cols);
        const col = i % cols;
        drone.offset = [(col - (cols - 1) / 2) * spacing, 0, (row - Math.floor((count - 1) / cols) / 2) * spacing];
        break;
      }
      case 'circle': {
        const angle = (i / count) * Math.PI * 2;
        const radius = count * spacing / (2 * Math.PI);
        drone.offset = [Math.cos(angle) * radius, 0, Math.sin(angle) * radius];
        break;
      }
      case 'v':
        drone.offset = [
          (i % 2 === 0 ? 1 : -1) * Math.ceil(i / 2) * spacing * 0.7,
          0,
          -Math.ceil(i / 2) * spacing * 0.5
        ];
        break;
      case 'column':
        drone.offset = [0, 0, (i - (count - 1) / 2) * spacing];
        break;
      case 'arc': {
        const a = (i / (count - 1 || 1) - 0.5) * Math.PI;
        drone.offset = [Math.sin(a) * 1.5, 0, -Math.cos(a) * 1.5 + 1.5];
        break;
      }
      default:
        drone.offset = [0, 0, 0];
    }
  });
}
