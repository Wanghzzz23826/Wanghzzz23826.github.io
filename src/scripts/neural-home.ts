import { createNeuron, drawNeuron } from './neural-morphology';

const body = document.body;
const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
const hero = document.querySelector<HTMLElement>('.home-hero');
const heroText = document.querySelector<HTMLElement>('.home-hero-inner');
const links = [...document.querySelectorAll<HTMLAnchorElement>('.neural-nav a[href^="#"]')];
const sections = links.map(link => document.querySelector<HTMLElement>(link.hash)).filter((section): section is HTMLElement => !!section);
const articles = [...document.querySelectorAll<HTMLElement>('.timeline article')];
const timeline = document.querySelector<HTMLElement>('.timeline');
let scrollPending = false;

// Use an activation line below the fixed header. This remains stable for very long
// sections and remeasures after native details open or viewport dimensions change.
function updateReadingPosition() {
  const activationLine = window.innerWidth <= 736 ? 145 : 155;
  let active = '';
  for (const section of sections) {
    if (section.getBoundingClientRect().top <= activationLine) active = section.id;
  }
  if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4) active = sections.at(-1)?.id ?? '';
  for (const link of links) {
    if (link.hash === `#${active}`) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
  body.classList.toggle('show-back-to-top', window.scrollY > 64);
  body.classList.toggle('is-scrolled', window.scrollY > 24);
  let readingArticle: HTMLElement | undefined;
  for (const article of articles) {
    if (article.getBoundingClientRect().top < window.innerHeight * .6) readingArticle = article;
  }
  articles.forEach(article => article.classList.toggle('is-reading', article === readingArticle));
  if (timeline) {
    const bounds = timeline.getBoundingClientRect();
    const distance = Math.max(0, Math.min(bounds.height, window.innerHeight * .6 - bounds.top));
    timeline.style.setProperty('--signal-length', `${distance}px`);
    timeline.classList.toggle('signal-active', distance > 0 && distance < bounds.height);
    for (const article of articles) {
      article.classList.toggle('is-passed', article.getBoundingClientRect().top < window.innerHeight * .6);
    }
  }
  if (hero && heroText) {
    const progress = Math.min(1, Math.max(0, window.scrollY / hero.offsetHeight));
    heroText.style.opacity = String(motion.matches ? 1 : 1 - progress * .95);
    heroText.style.transform = motion.matches ? '' : `translateY(${-progress * 45}px)`;
  }
  scrollPending = false;
}
function scheduleScrollUpdate() {
  if (!scrollPending) { scrollPending = true; requestAnimationFrame(updateReadingPosition); }
}
window.addEventListener('scroll', scheduleScrollUpdate, { passive: true });
window.addEventListener('resize', scheduleScrollUpdate);
document.addEventListener('toggle', scheduleScrollUpdate, true);
motion.addEventListener('change', scheduleScrollUpdate);
document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach(link => {
  link.addEventListener('click', event => {
    if (!link.hash || link.hash === '#') return;
    const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: motion.matches ? 'instant' : 'smooth', block: 'start' });
    history.replaceState(null, '', link.hash);
    if (link.classList.contains('skip-link')) {
      target.tabIndex = -1;
      target.focus({ preventScroll: true });
    }
  });
});
updateReadingPosition();
body.classList.remove('is-preload');

const canvas = document.querySelector<HTMLCanvasElement>('#neural-field');
const context = canvas?.getContext('2d');
let releasedAt = 0;
const release = () => {
  if (releasedAt) return;
  releasedAt = performance.now();
  body.classList.add('neural-ready');
  document.documentElement.classList.remove('neural-js');
};
// Only wait for the document, never impose an artificial minimum loading duration.
if (document.readyState === 'complete' || motion.matches || window.location.hash) release();
else window.addEventListener('load', release, { once: true });
window.setTimeout(release, 1800);

if (canvas && context && hero) {
  const ctx = context;
  let width = 0, height = 0, frame = 0, visible = true, lastFrame = 0;
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
  // Normalized positions make one lightweight canvas work across viewport sizes.
  const particles = Array.from({ length: 92 }, (_, i) => {
    const angle = i * 2.399963;
    const radius = .25 + ((i * 37) % 100) / 170;
    return { x: .5 + Math.cos(angle) * radius, y: .48 + Math.sin(angle) * radius * .72, size: i % 9 === 0 ? 1.6 : .65, depth: .3 + (i % 5) / 7, phase: i * 1.7 };
  });
  const neurons = [
    createNeuron(.115, .36, 1.12, -.38, 21),
    createNeuron(.89, .68, 1.23, 2.7, 72),
    createNeuron(.91, .19, .65, .84, 105)
  ];
  function resize() {
    if (!canvas || !hero) return;
    width = hero.clientWidth; height = hero.clientHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    requestDraw();
  }
  function draw(now: number) {
    frame = 0;
    if (!visible || document.hidden) return;
    // Cap decorative animation at ~30fps and stop it while the hero is covered.
    if (!motion.matches && now - lastFrame < 32) { frame = requestAnimationFrame(draw); return; }
    lastFrame = now;
    pointer.x += (pointer.targetX - pointer.x) * .045;
    pointer.y += (pointer.targetY - pointer.y) * .045;
    ctx.clearRect(0, 0, width, height);
    const elapsed = releasedAt ? Math.max(0, (now - releasedAt) / 1600) : 0;
    const spread = motion.matches ? 1 : 1 - Math.pow(1 - Math.min(elapsed, 1), 3);
    const time = motion.matches ? 0 : now / 1000;
    ctx.save();
    ctx.translate(pointer.x * 11, pointer.y * 8);
    for (const neuron of neurons) {
      drawNeuron(ctx, neuron, width, height, time, .3 + spread * .65);
    }
    for (const p of particles) {
      const x = (.5 + (p.x - .5) * spread) * width + pointer.x * p.depth * 16;
      const y = (.48 + (p.y - .48) * spread) * height + Math.sin(time * .18 + p.phase) * 4 + pointer.y * p.depth * 12;
      // Dim particles behind the title instead of competing with its letterforms.
      const central = x > width * .25 && x < width * .75 && y > height * .3 && y < height * .65;
      ctx.fillStyle = `rgba(190,221,214,${central ? .13 : .35 + Math.sin(time * .5 + p.phase) * .16})`;
      ctx.beginPath(); ctx.arc(x,y,p.size,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
    if (!motion.matches) frame = requestAnimationFrame(draw);
  }
  function requestDraw() { if (!frame && visible && !document.hidden) frame = requestAnimationFrame(draw); }
  // Use the reading surface's boundary: a sticky hero itself stays intersecting.
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) requestDraw();
    else { cancelAnimationFrame(frame); frame = 0; }
  });
  const heroBoundary = document.createElement('div');
  heroBoundary.style.cssText = 'position:absolute;top:90svh;left:0;width:1px;height:10svh;pointer-events:none';
  document.querySelector('#wrapper')?.append(heroBoundary);
  observer.observe(heroBoundary);
  hero.addEventListener('pointermove', event => {
    if (motion.matches || event.pointerType !== 'mouse') return;
    pointer.targetX = event.clientX / width - .5; pointer.targetY = event.clientY / height - .5;
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { pointer.targetX = 0; pointer.targetY = 0; });
  document.addEventListener('visibilitychange', requestDraw);
  motion.addEventListener('change', () => {
    pointer.x = pointer.y = pointer.targetX = pointer.targetY = 0;
    cancelAnimationFrame(frame); frame = 0; requestDraw();
  });
  new ResizeObserver(resize).observe(hero);
  resize();
}
