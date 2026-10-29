type Ripple = { x: number; y: number; born: number; phase: number; clicked: boolean };

/** A small decorative canvas follows the pointer; waves keep their page position.
 * Work only runs while a wave is alive, and the layer never intercepts input. */
export function initializePointerRipples(motion: MediaQueryList) {
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const canvas = document.createElement('canvas');
  canvas.className = 'pointer-ripples';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) { canvas.remove(); return; }

  const size = 240;
  const lifespan = 850;
  const ripples: Ripple[] = [];
  let frame = 0;
  let lastEmission = -Infinity;
  let lastFrame = 0;
  let pointerX = 0;
  let pointerY = 0;
  let lastX = -Infinity;
  let lastY = -Infinity;

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * ratio;
    canvas.height = size * ratio;
    ctx!.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function clear() {
    cancelAnimationFrame(frame);
    frame = 0;
    ripples.length = 0;
    ctx!.clearRect(0, 0, size, size);
    lastX = lastY = -Infinity;
  }

  function draw(now: number) {
    frame = 0;
    if (motion.matches || !finePointer.matches || document.hidden) { clear(); return; }
    if (now - lastFrame < 30) { frame = requestAnimationFrame(draw); return; }
    lastFrame = now;
    ctx!.clearRect(0, 0, size, size);
    while (ripples.length && now - ripples[0].born >= lifespan) ripples.shift();

    for (const wave of ripples) {
      const progress = (now - wave.born) / lifespan;
      const radius = 7 + (1 - (1 - progress) ** 2) * (wave.clicked ? 88 : 66);
      const opacity = Math.sin(Math.min(1, progress * 7) * Math.PI / 2) * (1 - progress) ** 1.8;
      const centerX = wave.x - pointerX + size / 2;
      const centerY = wave.y - pointerY + size / 2;
      const count = wave.clicked ? 54 : 38;
      for (let i = 0; i < count; i++) {
        const angle = i * Math.PI * 2 / count + wave.phase;
        const irregularity = Math.sin(i * 2.37 + wave.phase) * 3.5;
        const x = centerX + Math.cos(angle) * (radius + irregularity);
        const y = centerY + Math.sin(angle) * (radius + irregularity);
        // Feather at the local canvas edge as well as across each wave's lifetime.
        const edge = Math.max(0, Math.min(1, Math.min(x, y, size - x, size - y) / 28));
        ctx!.fillStyle = `rgba(167,224,207,${opacity * edge * (.3 + (i % 4) * .12) * (wave.clicked ? 1.4 : 1)})`;
        ctx!.beginPath();
        ctx!.arc(x, y, (.65 + (i % 3) * .23) * (1 - progress * .45), 0, Math.PI * 2);
        ctx!.fill();
      }
    }
    if (ripples.length) frame = requestAnimationFrame(draw);
  }

  document.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || motion.matches || !finePointer.matches || document.hidden) return;
    pointerX = event.clientX;
    pointerY = event.clientY;
    canvas.style.transform = `translate3d(${pointerX - size / 2}px,${pointerY - size / 2}px,0)`;
    const now = performance.now();
    if (now - lastEmission >= 135 && Math.hypot(pointerX - lastX, pointerY - lastY) >= 9) {
      ripples.push({ x: pointerX, y: pointerY, born: now, phase: now * .001, clicked: false });
      if (ripples.length > 6) ripples.shift();
      lastEmission = now;
      lastX = pointerX;
      lastY = pointerY;
    }
    if (!frame && ripples.length) frame = requestAnimationFrame(draw);
  }, { passive: true });

  // A stationary click emits independently of movement thresholds. Passive input
  // preserves selection, links, and native button behavior beneath the canvas.
  document.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || motion.matches || !finePointer.matches || document.hidden) return;
    pointerX = event.clientX;
    pointerY = event.clientY;
    canvas.style.transform = `translate3d(${pointerX - size / 2}px,${pointerY - size / 2}px,0)`;
    const now = performance.now();
    // Replace the just-created hover wave rather than doubling the same ring.
    const previous = ripples.at(-1);
    if (previous && !previous.clicked && now - previous.born < 160 && Math.hypot(previous.x - pointerX, previous.y - pointerY) < 12) ripples.pop();
    ripples.push({ x: pointerX, y: pointerY, born: now, phase: now * .001, clicked: true });
    if (ripples.length > 6) ripples.shift();
    lastEmission = now;
    lastX = pointerX;
    lastY = pointerY;
    if (!frame) frame = requestAnimationFrame(draw);
  }, { passive: true });

  document.documentElement.addEventListener('pointerleave', clear);
  document.addEventListener('visibilitychange', clear);
  window.addEventListener('scroll', clear, { passive: true });
  window.addEventListener('blur', clear);
  window.addEventListener('resize', resize);
  motion.addEventListener('change', clear);
  finePointer.addEventListener('change', clear);
  resize();
}
