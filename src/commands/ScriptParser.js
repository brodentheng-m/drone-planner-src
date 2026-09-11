export function parseDroneScript(text) {
  const rawLines = text.split('\n');
  const processed = [];

  for (let raw of rawLines) {
    const stripped = raw.replace(/\t/g, '    ');
    const indent = stripped.length - stripped.trimStart().length;
    const content = stripped.trim();
    processed.push({ indent, content });
  }

  function parseLevel(startIdx, endIndent) {
    const cmds = [];
    let i = startIdx;

    while (i < processed.length) {
      const { indent, content } = processed[i];

      if (!content) { i++; continue; }
      if (indent < endIndent) break;
      if (indent > endIndent) { i++; continue; }
      if (content.startsWith('#') || content.startsWith('from ') || content.startsWith('import ')) { i++; continue; }

      const cmd = parseLine(content);
      if (cmd) {
        if (cmd.type === 'if_block' || cmd.type === 'elif_block' || cmd.type === 'else_block' ||
            cmd.type === 'while_block' || cmd.type === 'for_block' || cmd.type === 'func_def') {
          i++;
          cmd.children = parseLevel(i, indent + 4);
          while (i < processed.length && processed[i].indent >= indent + 4) i++;
          while (i < processed.length && (!processed[i].content || processed[i].content.startsWith('#'))) i++;
          if (i < processed.length && processed[i].indent === indent) {
            const nextContent = processed[i].content;
            if (cmd.type === 'if_block' && (nextContent.startsWith('elif ') || nextContent.startsWith('else:'))) continue;
            if (cmd.type === 'elif_block' && (nextContent.startsWith('elif ') || nextContent.startsWith('else:'))) continue;
          }
        } else {
          i++;
        }
        cmds.push(cmd);
      } else {
        i++;
      }
    }
    return cmds;
  }

  return parseLevel(0, 0);
}

function num(v, d) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : d;
}

function int(v, d) {
  const n = parseInt(v);
  return Number.isFinite(n) ? n : d;
}

function speedArg(args, d) {
  const s = args.match(/speed=(\d+)/);
  return s ? parseInt(s[1]) : d;
}

function secsArg(args, d) {
  const s = args.match(/seconds=([\d.]+)/);
  return s ? parseFloat(s[1]) : d;
}

function dirArg(args) {
  const d = args.match(/direction=(-?\d+|clockwise|counter-clockwise)/);
  return d ? (d[1] === '-1' || d[1] === 'counter-clockwise' ? 'counter-clockwise' : 'clockwise') : 'clockwise';
}

function parseLine(line) {
  let m;
  const head = line.match(/^(\w+)/);
  const word = head ? head[1] : '';

  if (word === 'if' && (m = line.match(/^if\s+(.+):$/))) return { type: 'if_block', params: { condition: m[1] }, children: [] };
  if (word === 'elif' && (m = line.match(/^elif\s+(.+):$/))) return { type: 'elif_block', params: { condition: m[1] }, children: [] };
  if (word === 'else' && line === 'else:') return { type: 'else_block', params: {}, children: [] };
  if (word === 'while' && (m = line.match(/^while\s+(.+):$/))) return { type: 'while_block', params: { condition: m[1] }, children: [] };
  if (word === 'for') {
    if ((m = line.match(/^for\s+(\w+)\s+in\s+range\((\d+)\s*,\s*(\d+)\s*,\s*(-?\d+)\)$/))) {
      return { type: 'for_block', params: { var: m[1], start: parseInt(m[2]), end_val: parseInt(m[3]), step: parseInt(m[4]) }, children: [] };
    }
    if ((m = line.match(/^for\s+(\w+)\s+in\s+range\((\d+)\s*,\s*(\d+)\)$/))) {
      return { type: 'for_block', params: { var: m[1], start: parseInt(m[2]), end_val: parseInt(m[3]), step: 1 }, children: [] };
    }
    if ((m = line.match(/^for\s+(\w+)\s+in\s+range\((\d+)\)$/))) {
      return { type: 'for_block', params: { var: m[1], start: 0, end_val: parseInt(m[2]), step: 1 }, children: [] };
    }
  }
  if (word === 'break' && line === 'break') return { type: 'break_cmd', params: {} };
  if (word === 'def' && (m = line.match(/^def\s+(\w+)\(\):$/))) return { type: 'func_def', params: { name: m[1] }, children: [] };
  if (word && line === word + '()') return { type: 'func_call', params: { name: word } };
  if (word === 'return' && (m = line.match(/^return\s+(.+)$/))) return { type: 'return_val', params: { value: m[1] } };
  if (word && line.indexOf('=') !== -1 && (m = line.match(/^(\w+)\s*=\s*(.+)$/))) return { type: 'var_declare', params: { name: m[1], value: m[2] } };
  if (word && line.indexOf('=') !== -1 && (m = line.match(/^(\w+)\s*(\+=|-=|\*=|\/=)\s*(.+)$/))) return { type: 'set_var', params: { name: m[1], op: m[2], value: m[3] } };
  if (word === 'print' && (m = line.match(/^print\((.+)\)$/))) return { type: 'print_var', params: { value: m[1] } };
  if (word && line.indexOf('.append(') !== -1 && (m = line.match(/^(\w+)\.append\((.+)\)$/))) return { type: 'list_append', params: { name: m[1], value: m[2] } };
  if (word === 'time' && (m = line.match(/^time\.sleep\((.+)\)$/))) return { type: 'time_sleep', params: { dur: num(m[1], 1) } };

  if (line.indexOf('drone.') !== -1) {
    if ((m = line.match(/drone\.takeoff\(\)/))) return { type: 'takeoff', params: {} };
    if ((m = line.match(/drone\.land\(\)/))) return { type: 'land', params: {} };
    if ((m = line.match(/drone\.emergency_stop\(\)/))) return { type: 'emergency_stop', params: {} };
    if ((m = line.match(/drone\.stop_motors\(\)/))) return { type: 'stop_motors', params: {} };
    if ((m = line.match(/drone\.hover\((.+)\)/))) return { type: 'hover', params: { dur: num(m[1], 1) } };
  }

  if (word === 'drone') {
    const c = line.match(/^drone\.(\w+)\s*\(/);
    if (!c) return null;
    switch (c[1]) {
      case 'flip': {
        if ((m = line.match(/^drone\.flip\(["'](\w+)["']\)/))) return { type: 'flip', params: { dir: m[1] } };
        return null;
      }
      case 'go': {
        if ((m = line.match(/^drone\.go\(["'](\w+)["']\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\)/))) {
          return { type: 'go', params: { dir: m[1], power: int(m[2], 50), dur: num(m[3], 1) } };
        }
        return null;
      }
      case 'move_forward':
      case 'move_backward':
      case 'move_left':
      case 'move_right': {
        if ((m = line.match(/^drone\.move_(?:forward|backward|left|right)\((\d+)(?:\s*,\s*speed=(\d+))?\)/))) {
          return { type: c[1], params: { dist: num(m[1], 50), speed: int(m[2], 50) } };
        }
        return null;
      }
      case 'turn_left': {
        if ((m = line.match(/^drone\.turn_left\((.+)\)/))) return { type: 'turn_left', params: { deg: int(m[1], 90) } };
        return null;
      }
      case 'turn_right': {
        if ((m = line.match(/^drone\.turn_right\((.+)\)/))) return { type: 'turn_right', params: { deg: int(m[1], 90) } };
        return null;
      }
      case 'turn_degree': {
        if ((m = line.match(/^drone\.turn_degree\(([^,]+)(?:\s*,\s*timeout=([^,]+))?(?:\s*,\s*p_value=([^,]+))?\)/))) {
          return { type: 'turn_degree', params: { deg: int(m[1], 90), timeout: num(m[2], 3), p_value: int(m[3], 10) } };
        }
        return null;
      }
      case 'circle': {
        if ((m = line.match(/^drone\.circle\(([^)]*)\)/))) {
          return { type: 'circle', params: { speed: speedArg(m[1], 75), dir: dirArg(m[1]) } };
        }
        return null;
      }
      case 'circle_turn': {
        if ((m = line.match(/^drone\.circle_turn\(([^)]*)\)/))) {
          return { type: 'circle_turn', params: { speed: speedArg(m[1], 75), dir: dirArg(m[1]) } };
        }
        return null;
      }
      case 'square': {
        if ((m = line.match(/^drone\.square\(([^)]*)\)/))) {
          return { type: 'square', params: { speed: speedArg(m[1], 60), secs: secsArg(m[1], 1), dir: dirArg(m[1]) } };
        }
        return null;
      }
      case 'square_turn': {
        if ((m = line.match(/^drone\.square_turn\(([^)]*)\)/))) {
          return { type: 'square_turn', params: { speed: speedArg(m[1], 60), secs: secsArg(m[1], 1), dir: dirArg(m[1]) } };
        }
        return null;
      }
      case 'triangle': {
        if ((m = line.match(/^drone\.triangle\(([^)]*)\)/))) {
          return { type: 'triangle', params: { speed: speedArg(m[1], 60), secs: secsArg(m[1], 1), dir: dirArg(m[1]) } };
        }
        return null;
      }
      case 'triangle_turn': {
        if ((m = line.match(/^drone\.triangle_turn\(([^)]*)\)/))) {
          return { type: 'triangle_turn', params: { speed: speedArg(m[1], 60), secs: secsArg(m[1], 1), dir: dirArg(m[1]) } };
        }
        return null;
      }
      case 'spiral': {
        if ((m = line.match(/^drone\.spiral\(([^)]*)\)/))) {
          return { type: 'spiral', params: { speed: speedArg(m[1], 50), dir: dirArg(m[1]) } };
        }
        return null;
      }
      case 'sway': {
        if ((m = line.match(/^drone\.sway\(([^)]*)\)/))) {
          const args = m[1];
          const speedMatch = args.match(/speed=(\d+)/);
          const dirMatch = args.match(/direction=["']?([^"']+)["']?/);
          return { type: 'sway', params: { speed: speedMatch ? parseInt(speedMatch[1]) : 50, dir: dirMatch ? dirMatch[1] : 'forward-back' } };
        }
        return null;
      }
      case 'keep_distance': {
        if ((m = line.match(/^drone\.keep_distance\(([^)]*)\)/))) {
          const args = m[1].split(',').map(a => a.trim());
          return { type: 'keep_distance', params: { dist: num(args[0], 50), speed: int(args[1], 50) } };
        }
        return null;
      }
      case 'avoid_wall': {
        if ((m = line.match(/^drone\.avoid_wall\(([^)]*)\)/))) {
          const args = m[1].split(',').map(a => a.trim());
          return { type: 'avoid_wall', params: { dist: num(args[0], 50), speed: int(args[1], 50) } };
        }
        return null;
      }
      case 'set_led': {
        if ((m = line.match(/^drone\.set_led\(["'](\w+)["']\)/))) {
          return { type: 'led', params: { color: m[1] || 'green' } };
        }
        return null;
      }
      case 'random_color': {
        if (line === 'drone.random_color()') return { type: 'random_led', params: {} };
        return null;
      }
      case 'set_buzzer': {
        if ((m = line.match(/^drone\.set_buzzer\((\d+)\s*,\s*([\d.]+)\)/))) {
          return { type: 'buzzer', params: { freq: int(m[1], 440), dur: num(m[2], 0.5) } };
        }
        return null;
      }
      case 'set_drone_LED': {
        if ((m = line.match(/^drone\.set_drone_LED\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(\d+))?\)/))) {
          return { type: 'led', params: { r: int(m[1], 0), g: int(m[2], 255), b: int(m[3], 0), brightness: int(m[4], 100) } };
        }
        return null;
      }
      case 'drone_LED_off': {
        if (line === 'drone.drone_LED_off()') return { type: 'led_off', params: {} };
        return null;
      }
      case 'drone_buzzer': {
        if ((m = line.match(/^drone\.drone_buzzer\(([^,]+)\s*,\s*(\d+)\)/))) {
          return { type: 'buzzer', params: { note: m[1], dur: int(m[2], 500) } };
        }
        return null;
      }
      default:
        return null;
    }
  }
  return null;
}
