/* ===== 🎬 Units Showcase — per-team name-intro animations =====
   Drives the 6-slide (7s each) crossfade in the "團隊與虛擬歌手" section on
   a JS interval (rather than pure CSS animation-delay) so it has a hook to
   fire a themed canvas particle burst + a distinct caption text-reveal
   style in sync with each team's turn, instead of one shared generic fade. */

const UNIT_PRESETS = {
    leoneed:   { reveal: 'reveal-glow',   particle: 'twinkle' },
    mmj:       { reveal: 'reveal-bounce', particle: 'burst-fall-round' },
    vbs:       { reveal: 'reveal-wipe',   particle: 'speckle-shake' },
    wonderhoi: { reveal: 'reveal-arc',    particle: 'burst-fall-ribbon' },
    nightcord: { reveal: 'reveal-glitch', particle: 'static-drift' },
    vs:        { reveal: 'reveal-scan',   particle: 'matrix-rain' },
};

const UNIT_COLORS = {
    leoneed: ['#60a5fa', '#bfdbfe', '#ffffff'],
    mmj: ['#84cc16', '#facc15', '#bef264'],
    vbs: ['#f472b6', '#22d3ee', '#f9a8d4'],
    wonderhoi: ['#facc15', '#f472b6', '#fde68a'],
    nightcord: ['#818cf8', '#60a5fa', '#a5b4fc'],
    vs: ['#22d3ee', '#4ade80', '#67e8f9'],
};

let unitsFxCanvas = null;
let unitsFxCtx = null;
let unitsFxW = 0;
let unitsFxH = 0;
let unitsParticles = [];
let unitsReducedMotion = false;
let unitsSlideIdx = 0;

function initUnitsShowcase() {
    const container = document.getElementById('units-slideshow');
    unitsFxCanvas = document.getElementById('units-fx-canvas');
    if (!container || !unitsFxCanvas) return;
    unitsFxCtx = unitsFxCanvas.getContext('2d');
    unitsReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    resizeUnitsCanvas();
    window.addEventListener('resize', resizeUnitsCanvas);

    const slides = container.querySelectorAll('.unit-slide');
    if (slides.length === 0) return;

    playUnitSlide(slides[0]);

    if (!unitsReducedMotion) {
        requestAnimationFrame(unitsFxLoop);
    }

    if (slides.length > 1) {
        setInterval(() => {
            slides[unitsSlideIdx].classList.remove('active');
            unitsSlideIdx = (unitsSlideIdx + 1) % slides.length;
            slides[unitsSlideIdx].classList.add('active');
            playUnitSlide(slides[unitsSlideIdx]);
        }, 7000);
    }
}

function resizeUnitsCanvas() {
    if (!unitsFxCanvas) return;
    const rect = unitsFxCanvas.parentElement.getBoundingClientRect();
    unitsFxW = unitsFxCanvas.width = rect.width;
    unitsFxH = unitsFxCanvas.height = rect.height;
}

function playUnitSlide(slideEl) {
    const team = slideEl.dataset.team;
    const preset = UNIT_PRESETS[team];
    if (!preset) return;

    const caption = slideEl.querySelector('.unit-caption');
    if (caption) revealUnitCaption(caption, preset.reveal);

    if (!unitsReducedMotion) spawnUnitParticles(preset.particle, team);
}

/* ---- Caption text reveal ----
   First call caches the original plain-text label on the element so every
   later replay (each 42s loop) rebuilds from the real name, not from
   whatever markup the previous reveal style left behind. */
function revealUnitCaption(caption, style) {
    const text = caption.dataset.text || caption.textContent.trim();
    caption.dataset.text = text;
    caption.className = 'unit-caption ' + style;

    if (style === 'reveal-glow' || style === 'reveal-bounce') {
        caption.innerHTML = '';
        const chars = Array.from(text);
        const entranceSpanMs = 1600;
        const stagger = chars.length > 1 ? entranceSpanMs / (chars.length - 1) : 0;
        chars.forEach((ch, i) => {
            const span = document.createElement('span');
            span.className = 'ch';
            span.style.animationDelay = (i * stagger) + 'ms';
            span.textContent = ch === ' ' ? ' ' : ch;
            caption.appendChild(span);
        });
    } else {
        const inner = document.createElement('span');
        inner.className = 'reveal-inner';
        inner.textContent = text;
        caption.innerHTML = '';
        caption.appendChild(inner);
        if (style === 'reveal-glitch') {
            [2400, 4000, 5600].forEach(delay => {
                setTimeout(() => {
                    inner.classList.add('glitching');
                    setTimeout(() => inner.classList.remove('glitching'), 250);
                }, delay);
            });
        }
    }
}

/* ---- Particle engine ---- */
function spawnUnitParticles(kind, team) {
    if (!unitsFxCtx) return;
    const colors = UNIT_COLORS[team] || ['#ffffff'];
    const isMobile = window.innerWidth <= 768;
    const pick = () => colors[Math.floor(Math.random() * colors.length)];

    if (kind === 'twinkle') {
        const n = isMobile ? 16 : 28;
        for (let i = 0; i < n; i++) {
            unitsParticles.push(makeParticle({
                x: Math.random() * unitsFxW,
                y: Math.random() * unitsFxH * 0.7,
                vx: 0, vy: -0.05 - Math.random() * 0.1,
                size: 1 + Math.random() * 2,
                color: pick(),
                life: 6000 + Math.random() * 1500,
                shape: 'twinkle',
            }));
        }
        unitsParticles.push(makeParticle({
            x: -20, y: unitsFxH * (0.1 + Math.random() * 0.2),
            vx: (unitsFxW + 40) / 60, vy: unitsFxH * 0.25 / 60,
            size: 3, color: '#ffffff', life: 900, shape: 'streak',
        }));
    } else if (kind === 'burst-fall-round' || kind === 'burst-fall-ribbon') {
        const n = isMobile ? 18 : 34;
        for (let i = 0; i < n; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1.5 + Math.random() * 2.5;
            unitsParticles.push(makeParticle({
                x: unitsFxW / 2, y: unitsFxH / 2,
                vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2,
                gravity: 0.06,
                size: kind === 'burst-fall-ribbon' ? 6 : (3 + Math.random() * 3),
                color: pick(),
                life: 2200 + Math.random() * 800,
                shape: kind === 'burst-fall-ribbon' ? 'ribbon' : 'clover',
                spin: (Math.random() - 0.5) * 0.3,
            }));
        }
    } else if (kind === 'speckle-shake') {
        const n = isMobile ? 18 : 32;
        for (let i = 0; i < n; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 3;
            unitsParticles.push(makeParticle({
                x: unitsFxW / 2, y: unitsFxH * 0.6,
                vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                size: 1.5 + Math.random() * 2,
                color: pick(),
                life: 700 + Math.random() * 400,
                shape: 'speckle',
            }));
        }
        const slide = document.querySelector('.unit-slide[data-team="vbs"]');
        if (slide) {
            slide.classList.remove('screen-shake');
            void slide.offsetWidth;
            slide.classList.add('screen-shake');
            setTimeout(() => slide.classList.remove('screen-shake'), 400);
        }
    } else if (kind === 'static-drift') {
        const n = isMobile ? 14 : 24;
        for (let i = 0; i < n; i++) {
            unitsParticles.push(makeParticle({
                x: Math.random() * unitsFxW,
                y: Math.random() * unitsFxH,
                vx: (Math.random() - 0.5) * 0.15,
                vy: (Math.random() - 0.5) * 0.15,
                size: 1 + Math.random() * 1.5,
                color: pick(),
                life: 5000 + Math.random() * 1500,
                shape: 'speckle',
            }));
        }
    } else if (kind === 'matrix-rain') {
        const n = isMobile ? 12 : 20;
        for (let i = 0; i < n; i++) {
            unitsParticles.push(makeParticle({
                x: Math.random() * unitsFxW,
                y: -10 - Math.random() * 100,
                vx: 0, vy: 1 + Math.random() * 1.5,
                size: 12 + Math.random() * 4,
                color: pick(),
                life: 6000,
                shape: 'digit',
                char: Math.random() < 0.5 ? '0' : '1',
            }));
        }
    }
}

function makeParticle(p) {
    return Object.assign({ born: performance.now(), gravity: 0, spin: 0, rot: 0 }, p);
}

function unitsFxLoop(now) {
    if (unitsFxCtx) {
        unitsFxCtx.clearRect(0, 0, unitsFxW, unitsFxH);
        unitsParticles = unitsParticles.filter(p => {
            const age = now - p.born;
            if (age > p.life) return false;
            p.vy += p.gravity;
            p.x += p.vx;
            p.y += p.vy;
            p.rot += p.spin;
            const alpha = p.shape === 'streak' ? 1 : Math.max(0, 1 - age / p.life);
            drawUnitParticle(p, alpha);
            return true;
        });
    }
    requestAnimationFrame(unitsFxLoop);
}

function drawUnitParticle(p, alpha) {
    const ctx = unitsFxCtx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    if (p.rot) ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    if (p.shape === 'twinkle') {
        const tw = 0.5 + 0.5 * Math.sin(performance.now() / 300 + p.x);
        ctx.globalAlpha = alpha * tw;
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
    } else if (p.shape === 'streak') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-24, -10);
        ctx.stroke();
    } else if (p.shape === 'clover') {
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.lineTo(p.size, 0);
        ctx.lineTo(0, p.size);
        ctx.lineTo(-p.size, 0);
        ctx.closePath();
        ctx.fill();
    } else if (p.shape === 'ribbon') {
        ctx.fillRect(-p.size / 2, -p.size * 1.6, p.size, p.size * 3.2);
    } else if (p.shape === 'speckle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
    } else if (p.shape === 'digit') {
        ctx.font = p.size + 'px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(p.char, 0, 0);
    }
    ctx.restore();
}

document.addEventListener('DOMContentLoaded', initUnitsShowcase);
