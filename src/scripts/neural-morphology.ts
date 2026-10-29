type Point = { x: number; y: number };
type Neurite = {
  start: Point;
  control: Point;
  end: Point;
  width: number;
  distance: number;
  length: number;
  axon: boolean;
};

export interface Neuron {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  phase: number;
  processes: Neurite[];
}

function along(process: Neurite, t: number): Point {
  const remaining = 1 - t;
  return {
    x: remaining ** 2 * process.start.x + 2 * remaining * t * process.control.x + t ** 2 * process.end.x,
    y: remaining ** 2 * process.start.y + 2 * remaining * t * process.control.y + t ** 2 * process.end.y
  };
}

export function createNeuron(x: number, y: number, scale: number, rotation: number, seed: number): Neuron {
  const processes: Neurite[] = [];
  // Seeded asymmetry keeps the morphology stable while resizing or repainting.
  let state = seed;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };

  function grow(start: Point, angle: number, length: number, width: number, depth: number, distance: number, axon = false) {
    const bend = (random() - .5) * .75;
    const end = {
      x: start.x + Math.cos(angle + bend * .4) * length,
      y: start.y + Math.sin(angle + bend * .4) * length
    };
    processes.push({
      start,
      control: {
        x: start.x + Math.cos(angle + bend) * length * .55,
        y: start.y + Math.sin(angle + bend) * length * .55
      },
      end, width, distance, length, axon
    });
    if (depth <= 0) return;
    const nextLength = length * (.63 + random() * .15);
    grow(end, angle + bend + .28 + random() * .4, nextLength, width * .57, depth - 1, distance + length, axon);
    grow(end, angle + bend - .25 - random() * .55, nextLength * (.7 + random() * .3), width * .51, depth - 1, distance + length, axon);
  }

  // Dendrites emerge at unequal angles and bifurcate into progressively finer tips.
  for (const angle of [-2.9, -2.12, -1.43, -.57, .12, 2.25]) {
    const start = { x: Math.cos(angle) * 7, y: Math.sin(angle) * 7 };
    grow(start, angle, 34 + random() * 27, 3 + random() * 1.5, 3, 0);
  }

  // A longer, separate axon descends from the soma before branching at its terminal.
  let start = { x: 2, y: 8 };
  let distance = 0;
  for (let i = 0; i < 6; i++) {
    const end = { x: Math.sin(i * 1.05) * 17 + 8, y: 27 + i * 24 };
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    processes.push({ start, control: { x: start.x + (i % 2 ? -13 : 12), y: start.y + 15 }, end, width: 1.9 - i * .19, distance, length, axon: true });
    distance += length;
    start = end;
  }
  grow(start, .9, 29, .8, 2, distance, true);
  grow(start, 2.1, 33, .8, 2, distance, true);
  return { x, y, scale, rotation, phase: seed * .7, processes };
}

function drawTaper(ctx: CanvasRenderingContext2D, process: Neurite) {
  const left: Point[] = [];
  const right: Point[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const point = along(process, t);
    const tangent = {
      x: (1 - t) * (process.control.x - process.start.x) + t * (process.end.x - process.control.x),
      y: (1 - t) * (process.control.y - process.start.y) + t * (process.end.y - process.control.y)
    };
    const magnitude = Math.hypot(tangent.x, tangent.y) || 1;
    const radius = process.width * (1 - t * .64) / 2;
    left.push({ x: point.x - tangent.y / magnitude * radius, y: point.y + tangent.x / magnitude * radius });
    right.push({ x: point.x + tangent.y / magnitude * radius, y: point.y - tangent.x / magnitude * radius });
  }
  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);
  for (const point of left) ctx.lineTo(point.x, point.y);
  for (const point of right.reverse()) ctx.lineTo(point.x, point.y);
  ctx.closePath();
  ctx.fill();
}

export function drawNeuron(ctx: CanvasRenderingContext2D, neuron: Neuron, width: number, height: number, time: number, opacity: number) {
  const scale = Math.min(width / 1280, height / 760) * neuron.scale;
  ctx.save();
  ctx.translate(neuron.x * width, neuron.y * height);
  ctx.rotate(neuron.rotation);
  ctx.scale(scale, scale);
  ctx.globalAlpha = opacity;

  for (const process of neuron.processes) {
    // Restrained fluorescence at the center fades into fine, dim terminal branches.
    const alpha = process.axon ? .48 : Math.max(.22, .64 - process.distance / 280);
    ctx.fillStyle = `rgba(130,189,168,${alpha})`;
    drawTaper(ctx, process);
    if (process.axon && process.distance < 145 && process.distance > 25) {
      ctx.strokeStyle = 'rgba(128,183,165,.23)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      const from = along(process, .22);
      const to = along(process, .74);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }

    const pulseDistance = ((time * 29 + neuron.phase * 17) % 330) - 25;
    const progress = (pulseDistance - process.distance) / process.length;
    if (progress > 0 && progress < 1) {
      const point = along(process, progress);
      ctx.fillStyle = 'rgba(189,239,211,.8)';
      ctx.shadowColor = '#8bc4b7';
      ctx.shadowBlur = 5;
      ctx.beginPath();
      ctx.arc(point.x, point.y, process.axon ? 1.1 : .65, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  // A soft irregular soma joins the roots, rather than a circular hub or starburst.
  const soma = ctx.createRadialGradient(-2, -2, 0, 0, 0, 15);
  soma.addColorStop(0, 'rgba(162,216,184,.68)');
  soma.addColorStop(.48, 'rgba(113,178,151,.5)');
  soma.addColorStop(1, 'rgba(92,153,135,.05)');
  ctx.fillStyle = soma;
  ctx.beginPath();
  ctx.moveTo(-11, -5);
  ctx.bezierCurveTo(-6, -6, -5, -11, -3, -12);
  ctx.bezierCurveTo(-1, -4, 5, -9, 9, -8);
  ctx.bezierCurveTo(5, -2, 13, 1, 13, 3);
  ctx.bezierCurveTo(5, 2, 5, 7, 3, 12);
  ctx.bezierCurveTo(0, 6, -5, 7, -10, 9);
  ctx.bezierCurveTo(-5, 2, -8, -1, -11, -5);
  ctx.fill();
  ctx.restore();
}
