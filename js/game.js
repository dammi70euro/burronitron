'use strict';
// BURRONITRON — Daredario e l'avventura nei canyon in quattro atti.

const W = 625, H = 1000;
const BALL_R = 11;
const GRAVITY = 1550;
const SUB = 10, DT = 1 / (60 * SUB);
const MAX_V = 3200;
const LANE_X = 555;           // separatore corsia di lancio
const PLUNGER_Y = 965;

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rand = (a, b) => a + Math.random() * (b - a);
const fmt = n => Math.floor(n).toLocaleString('it-IT');

function closestOnSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
  return [ax + dx * t, ay + dy * t, t];
}

// ================== TAVOLO ==================
const segs = [];
function wall(ax, ay, bx, by, o = {}) { const s = { ax, ay, bx, by, e: 0.45, kind: 'wall', ...o }; segs.push(s); return s; }
function poly(pts, o) { for (let i = 0; i < pts.length - 1; i++) wall(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], o); }
function arc(cx, cy, r, a0, a1, n) {
  const p = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return p;
}

const ARC_C = [312.5, 300], ARC_R = 282.5;
const outerArc = arc(ARC_C[0], ARC_C[1], ARC_R, Math.PI, Math.PI * 2, 48);
poly([[30, 1040], [30, 300]]);
poly(outerArc);
poly([[595, 300], [595, 1040]]);
poly([[LANE_X, 1040], [LANE_X, 365]], { draw: 'rail' });
// cancello a senso unico in cima alla corsia di lancio
const gate = wall(595, 262, 548, 345, { kind: 'gate', e: 0.3 });
// orbita sinistra (il "salto")
const orbitInner = [[72, 610], [72, 300], ...arc(ARC_C[0], ARC_C[1], 238.5, Math.PI, Math.PI * 1.285, 14).slice(1)];
poly(orbitInner, { draw: 'rail' });
// corsie superiori D-A-R-I-O
const LANES = [];
for (let i = 0; i < 6; i++) wall(192.5 + 48 * i, 80, 192.5 + 48 * i, 124, { draw: 'post' });
for (let i = 0; i < 5; i++) LANES.push({ x0: 192.5 + 48 * i, x1: 240.5 + 48 * i, cx: 216.5 + 48 * i, lit: false });
// guide inlane
poly([[62, 735], [62, 830], [192, 888]], { draw: 'rail' });
poly([[523, 735], [523, 830], [393, 888]], { draw: 'rail' });
// slingshot
const SLINGS = [
  { a: [100, 738], b: [100, 805], c: [160, 842], side: 1, flash: 0 },
  { a: [485, 738], b: [485, 805], c: [425, 842], side: -1, flash: 0 }];
for (const s of SLINGS) {
  wall(s.a[0], s.a[1], s.b[0], s.b[1], { draw: 'none' });
  wall(s.b[0], s.b[1], s.c[0], s.c[1], { draw: 'none' });
  s.seg = wall(s.a[0], s.a[1], s.c[0], s.c[1], { kind: 'sling', ref: s, e: 0.5, draw: 'none' });
}
// piccole guide sopra le slingshot
poly([[30, 700], [52, 720]], { draw: 'rail' });

const BUMPERS = [
  { x: 312, y: 205, r: 27, flash: 0, cd: 0 },
  { x: 248, y: 285, r: 27, flash: 0, cd: 0 },
  { x: 377, y: 285, r: 27, flash: 0, cd: 0 }];
const DROPS = [0, 1, 2].map(i => ({ x: 545, y: 492 + i * 46, h: 38, down: false, flash: 0, anim: 0 }));
const SCOOP = { x: 470, y: 395, r: 17 };
// target T-R-O-N (due sulla parete dell'orbita, due al centro)
const STANDUPS = [
  { ax: 76, ay: 386, bx: 76, by: 416, ch: 'T' }, { ax: 76, ay: 440, bx: 76, by: 470, ch: 'R' },
  { ax: 212, ay: 468, bx: 244, by: 468, ch: 'O' }, { ax: 341, ay: 468, bx: 373, by: 468, ch: 'N' }]
  .map(t => ({ ...t, e: 0.3, lit: false, flash: 0 }));
// il masso che scivola avanti e indietro
const MOVER = { x: 292, y: 545, r: 15, vx: 0, flash: 0 };
// sensore BURRONI: rollover a sinistra, fa partire un vocale a caso
const BURRONI = { x: 150, y: 655, r: 16, flash: 0, cd: 0 };
// paletti di gomma
const POSTS = [{ x: 135, y: 240, r: 8, flash: 0 }, { x: 505, y: 225, r: 8, flash: 0 }, { x: 292, y: 380, r: 7, flash: 0 }];
const SPINNER = { x: 51, y: 455, angle: 0, speed: 0 };

class Flipper {
  constructor(px, py, side) {
    Object.assign(this, { px, py, side, L: 80, r1: 13, r2: 7, restA: 0.52, upA: -0.42 });
    this.a = this.restA; this.av = 0; this.pressed = false;
  }
  update(dt) {
    const target = this.pressed ? this.upA : this.restA;
    const sp = this.pressed ? 26 : 15, prev = this.a;
    if (this.a > target) this.a = Math.max(target, this.a - sp * dt);
    else if (this.a < target) this.a = Math.min(target, this.a + sp * dt);
    this.av = (this.a - prev) / dt;
  }
  tip() { return [this.px + this.side * this.L * Math.cos(this.a), this.py + this.L * Math.sin(this.a)]; }
}
const flippers = [new Flipper(195, 900, 1), new Flipper(390, 900, -1)];

// ================== STATO ==================
const ACTS = [
  { n: 'I', name: 'SUL BORDO', img: 'atto1', goal: 25, unit: 'rocce', desc: 'Colpisci le rocce (bumper) 25 volte, poi entra nella buca per saltare!' },
  { n: 'II', name: 'IL SALTO', img: 'atto2', goal: 3, unit: 'salti', desc: 'Lancia la palla nell\'orbita sinistra 3 volte per saltare il burrone.' },
  { n: 'III', name: "L'ARRAMPICATA", img: 'atto3', goal: 2, unit: 'pareti', desc: 'Abbatti tutti gli appigli (target a destra) 2 volte.' },
  { n: 'IV', name: 'IL TRAMONTO', img: 'atto4', goal: 0, unit: '', desc: 'MULTIBALL! Alterna buca e orbita per i JACKPOT. 3 jackpot = SUPER JACKPOT.' }];

const G = {
  state: 'attract', // attract | play | bonus | cinematic | gameover
  balls: [], score: 0, ball: 1, maxBalls: 3, level: 1,
  act: 0, actProg: 0, actReady: false,
  mult: 1, kickback: true, skillLane: -1, skillLive: false,
  saveUntil: 0, launched: false, tilt: 0, tilted: false, warned: false,
  multiball: false, jpNext: 'scoop', jackpots: 0,
  stats: null, hi: 0, time: 0, shake: 0, bonusT: 0, lastShot: { kind: '', t: -9 }, combo: 0,
  plunger: { charge: 0, charging: false }, pendingLaunch: 0, extraBalls: 0, tronDone: false,
};
try { G.hi = +localStorage.getItem('burroni.hi') || 0; } catch (e) {}

const texts = [], particles = [], timers = [];
// timer in tempo di gioco (si fermano con la pausa)
function later(sec, fn) { timers.push({ t: G.time + sec, fn }); }
let message = null;

function newBallObj(x, y) { return { x, y, vx: 0, vy: 0, held: 0, trail: [], inLane: true }; }

// ================== LOGICA DI GIOCO ==================
function addScore(pts, x, y, color = '#ffe14d') {
  pts = Math.round(pts * G.level);
  G.score += pts;
  if (x !== undefined) texts.push({ x, y, t: '+' + fmt(pts), life: 1, color });
}
function say(text, sub = '', dur = 1.6, color = '#ffcc33') { message = { text, sub, dur, t: 0, color }; }
function burst(x, y, n, color, sp = 300) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = rand(sp * 0.3, sp);
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.4, 0.9), color, size: rand(1.5, 4) });
  }
}
function shot(kind) {
  const now = G.time;
  if (G.lastShot.kind && G.lastShot.kind !== kind && now - G.lastShot.t < 3) {
    G.combo++;
    addScore(10000 * G.combo, 300, 520, '#ff7bff');
    say('COMBO x' + (G.combo + 1), '', 1.2, '#ff7bff');
    if (G.combo >= 2) Sound.voice('eeeeh', 2); else Sound.voice('eeh', 1);
  } else G.combo = 0;
  G.lastShot = { kind, t: now };
}

function startGame() {
  timers.length = 0;
  Object.assign(G, {
    state: 'play', score: 0, ball: 1, level: 1, act: 0, actProg: 0, actReady: false, mult: 1,
    kickback: true, multiball: false, jackpots: 0, jpNext: 'scoop', tilt: 0, tilted: false, extraBalls: 0,
    stats: { bumpers: 0, lanes: 0, drops: 0, orbits: 0 },
  });
  LANES.forEach(l => l.lit = false);
  DROPS.forEach(d => d.down = false);
  STANDUPS.forEach(t => t.lit = false);
  G.tronDone = false;
  Sound.setIntensity(1);
  UI.hideOverlays(); UI.showAct(true);
  serveBall();
}

function serveBall() {
  G.balls = [newBallObj(575, PLUNGER_Y - BALL_R - 1)];
  G.launched = false; G.tilted = false; G.tilt = 0; G.warned = false;
  G.skillLane = Math.floor(Math.random() * 5); G.skillLive = true;
  G.combo = 0;
  flippers.forEach(f => f.pressed = false);
  say('PALLA ' + G.ball, 'tieni premuto START (o SPAZIO) e lancia!', 2);
}

function launch(power) {
  let any = false;
  for (const b of G.balls) {
    if (b.x > LANE_X && b.y > PLUNGER_Y - BALL_R - 8 && Math.abs(b.vy) < 120) {
      b.vy = -(1050 + power * 1500) * rand(0.985, 1.015); any = true;
    }
  }
  if (!any) return;
  Sound.play('launch', power);
  if (!G.launched) {
    G.launched = true;
    G.saveUntil = G.time + 10;
    Sound.voice('vai', 1);
  }
}

function addBall(auto = true) {
  const b = newBallObj(575, PLUNGER_Y - BALL_R - 1 - G.pendingLaunch * 0);
  G.balls.push(b);
  if (auto) later(0.5, () => { if (G.balls.includes(b)) { b.vy = -rand(1900, 2200); Sound.play('launch', 0.8); } });
}

function onBumper(bm, i) {
  bm.flash = 1; G.stats.bumpers++;
  addScore(1000, bm.x, bm.y - 30);
  Sound.play('bumper', i);
  burst(bm.x, bm.y, 10, '#ffd36b', 260);
  G.shake = Math.max(G.shake, 3);
  if (G.act === 0 && !G.actReady && !G.multiball) {
    G.actProg++;
    if (G.actProg >= ACTS[0].goal) actGoal();
    else if (G.actProg % 5 === 0) Sound.voice('boplibop', 0);
  }
}

function onLane(i, ball) {
  const l = LANES[i];
  Sound.play('lane');
  if (G.skillLive && ball.fresh) {
    G.skillLive = false;
    if (i === G.skillLane) {
      addScore(50000, l.cx, 150, '#7bffea');
      say('SKILL SHOT!', 'salto perfetto', 1.8, '#7bffea');
      Sound.play('skill'); Sound.voice('eeeeh', 3);
      burst(l.cx, 100, 40, '#7bffea', 400);
    }
  }
  if (!l.lit) {
    l.lit = true; G.stats.lanes++;
    addScore(2500, l.cx, 140);
    Sound.play('letter');
    if (LANES.every(x => x.lit)) {
      LANES.forEach(x => x.lit = false);
      G.mult = Math.min(6, G.mult + 1);
      addScore(25000, 312, 170, '#7bffea');
      say('D·A·R·I·O', 'moltiplicatore ' + G.mult + 'X', 1.8, '#7bffea');
      Sound.voice('boplibop', 2); Sound.play('fanfare');
    } else Sound.voice('li', 0);
  } else addScore(500, l.cx, 140);
}

function onOrbit() {
  G.stats.orbits++;
  addScore(5000, 90, 420, '#ffb36b');
  Sound.voice('eeh', 1);
  shot('orbit');
  if (G.multiball) { if (G.jpNext === 'orbit') jackpot(60, 420); }
  else if (G.act === 1 && !G.actReady) {
    G.actProg++;
    say('SALTO ' + G.actProg + '/' + ACTS[1].goal, '', 1.2);
    if (G.actProg >= ACTS[1].goal) actGoal();
  }
}

function onDrop(d) {
  d.down = true; d.flash = 1; G.stats.drops++;
  addScore(1500, d.x - 30, d.y);
  Sound.play('drop');
  burst(d.x, d.y, 12, '#ff6b6b', 250);
  if (DROPS.every(x => x.down)) {
    Sound.play('bank'); Sound.voice(Math.random() < 0.5 ? 'letto' : 'letto2', 2);
    addScore(15000, 480, 540, '#ff8a8a');
    shot('drops');
    if (!G.kickback) { G.kickback = true; say('KICKBACK', 'acceso', 1.2, '#8aff8a'); }
    if (G.act === 2 && !G.actReady && !G.multiball) {
      G.actProg++;
      say('PARETE ' + G.actProg + '/' + ACTS[2].goal, '', 1.2);
      if (G.actProg >= ACTS[2].goal) actGoal();
    } else say('APPIGLI!', '', 1);
    later(1.2, () => DROPS.forEach(x => { x.down = false; x.anim = 1; }));
  }
}

function onStandup(t) {
  t.flash = 1;
  Sound.play('target');
  burst((t.ax + t.bx) / 2, (t.ay + t.by) / 2, 8, '#b98aff', 220);
  if (t.lit) { addScore(750, t.ax + 20, t.ay); return; }
  t.lit = true; addScore(2500, t.ax + 20, t.ay, '#b98aff');
  if (STANDUPS.every(x => x.lit)) {
    STANDUPS.forEach(x => x.lit = false);
    if (!G.tronDone) {
      G.tronDone = true; G.extraBalls++;
      say('EXTRA BALL!', 'T·R·O·N completato', 2.4, '#b98aff');
      Sound.play('fanfare'); Sound.voice('eeeeh', 3); UI.flashHead();
    } else {
      addScore(50000, 292, 440, '#b98aff');
      say('T·R·O·N', '50.000', 1.6, '#b98aff');
      Sound.play('bank'); Sound.voice('boplibop', 2);
    }
  } else Sound.voice('li', 0);
}

function onMover() {
  MOVER.flash = 1;
  addScore(2500, MOVER.x, MOVER.y - 25, '#ffb36b');
  Sound.play('drop'); G.shake = Math.max(G.shake, 4);
  burst(MOVER.x, MOVER.y, 14, '#d9a066', 300);
  if (Math.random() < 0.3) Sound.voice(Math.random() < 0.5 ? 'letto' : 'letto2', 0);
}

function onBurroni() {
  BURRONI.flash = 1; BURRONI.cd = 1.5;
  addScore(10000, BURRONI.x, BURRONI.y - 30, '#ff4dff');
  Sound.play('skill'); Sound.burroni();
  burst(BURRONI.x, BURRONI.y, 30, '#ff4dff', 350);
  say('BURRONI!', '', 1.4, '#ff4dff');
}

function actGoal() {
  G.actReady = true;
  say('OBIETTIVO!', 'colpisci la BUCA per il prossimo atto', 2.2, '#8aff8a');
  Sound.play('coin');
}

function jackpot(x, y) {
  G.jackpots++;
  if (G.jackpots % 4 === 0) {
    addScore(2000000, x, y, '#ff4dff');
    say('SUPER JACKPOT!', '', 2.5, '#ff4dff');
    G.shake = 14;
  } else {
    addScore(500000, x, y, '#ffe14d');
    say('JACKPOT!', G.jackpots % 4 === 3 ? 'super jackpot alla BUCA!' : '', 2, '#ffe14d');
    G.shake = 9;
  }
  G.jpNext = (G.jackpots % 4 === 3) ? 'scoop' : (G.jpNext === 'scoop' ? 'orbit' : 'scoop');
  Sound.play('jackpot'); Sound.voice('frra', 3); UI.flashHead();
  burst(x, y, 60, '#ffe14d', 600);
}

function onScoop(b) {
  b.held = 1.2; b.x = SCOOP.x; b.y = SCOOP.y; b.vx = b.vy = 0;
  Sound.play('scoopIn');
  addScore(5000, SCOOP.x, SCOOP.y - 30);
  shot('scoop');
  if (G.multiball) {
    if (G.jpNext === 'scoop') jackpot(SCOOP.x, SCOOP.y);
  } else if (G.actReady) {
    nextAct(b);
  } else Sound.voice(Math.random() < 0.5 ? 'letto' : 'letto2', 0);
}

function nextAct(b) {
  addScore(100000, SCOOP.x, SCOOP.y - 50, '#8aff8a');
  G.act = (G.act + 1) % 4;
  G.actProg = 0; G.actReady = false;
  b.held = 0.8; // conta solo a cinematica finita
  G.state = 'cinematic'; G.cineT = 4;
  Sound.play('fanfare'); Sound.voice('scoo', 3); UI.flashHead();
  UI.cinematic(ACTS[G.act]);
  UI.showAct(true);
}

function startMultiball() {
  G.multiball = true; G.jackpots = 0; G.jpNext = 'scoop';
  G.saveUntil = G.time + 15;
  Sound.setIntensity(2); Sound.play('multi'); Sound.voice('frra', 3);
  say('MULTIBALL!', 'jackpot alla BUCA', 2.5, '#ff7b3d');
  addBall(); later(0.9, () => { if (G.multiball) addBall(); });
}

function endMultiball() {
  G.multiball = false;
  Sound.setIntensity(1);
  G.level++;
  G.act = 0; G.actProg = 0; G.actReady = false;
  say('TRAMONTO FINITO', 'livello ' + G.level + ': punti x' + G.level, 2.5, '#ff9a3d');
  UI.showAct(true);
}

function drainBall(b) {
  G.balls.splice(G.balls.indexOf(b), 1);
  if (G.tilted) { if (!G.balls.length) endBall(); return; }
  if (G.time < G.saveUntil) {
    say('PALLA SALVATA', '', 1.5, '#8affff');
    Sound.play('save'); Sound.voice('ahte', 2);
    addBall(); return;
  }
  if (G.multiball && G.balls.length <= 1) endMultiball();
  if (!G.balls.length) endBall();
}

function endBall() {
  Sound.play('drain');
  if (!G.tilted) Sound.voice('noate', 2);
  G.multiball = false; Sound.setIntensity(1);
  const s = G.stats;
  const base = s.bumpers * 100 + s.lanes * 1000 + s.drops * 750 + s.orbits * 2500 + (G.act + 1) * 5000;
  const bonus = G.tilted ? 0 : base * G.mult * G.level;
  G.state = 'bonus'; G.bonusT = 3;
  say(G.tilted ? 'TILT' : 'BONUS ' + fmt(bonus), G.tilted ? 'nessun bonus' : 'moltiplicatore ' + G.mult + 'X', 2.8, '#ffcc33');
  G.score += bonus;
  G.stats = { bumpers: 0, lanes: 0, drops: 0, orbits: 0 };
  G.mult = 1;
}

function afterBonus() {
  if (G.extraBalls > 0) { G.extraBalls--; say('GIOCA ANCORA', '', 1.5); }
  else G.ball++;
  if (G.ball > G.maxBalls) return gameOver();
  G.state = 'play';
  serveBall();
}

function gameOver() {
  G.state = 'gameover';
  const rec = G.score > G.hi;
  if (rec) { G.hi = G.score; try { localStorage.setItem('burroni.hi', G.hi); } catch (e) {} }
  Sound.voice('risate', 3); Sound.play('lose');
  Sound.setIntensity(0);
  UI.gameOver(G.score, rec);
}

function nudge() {
  if (G.state !== 'play' || G.tilted) return;
  for (const b of G.balls) if (!b.held) { b.vx += rand(-160, 160); b.vy -= rand(80, 200); }
  G.shake = 8; G.tilt += 1;
  Sound.play('wall', 2500);
  if (G.tilt >= 4.2) {
    G.tilted = true; flippers.forEach(f => f.pressed = false);
    say('TILT!', '', 3, '#ff3d3d'); Sound.play('tilt'); Sound.voice('risate', 3);
  } else if (G.tilt >= 2.6 && !G.warned) {
    G.warned = true; say('ATTENZIONE', '', 1, '#ff3d3d'); Sound.play('warn'); Sound.voice('ahte', 2);
  }
}

// ================== FISICA ==================
function collideSeg(b, s) {
  const [cx, cy] = closestOnSeg(b.x, b.y, s.ax, s.ay, s.bx, s.by);
  let dx = b.x - cx, dy = b.y - cy; const d2 = dx * dx + dy * dy;
  if (d2 >= BALL_R * BALL_R) return null;
  let d = Math.sqrt(d2), nx, ny;
  if (d < 1e-6) { nx = -(s.by - s.ay); ny = s.bx - s.ax; const l = Math.hypot(nx, ny); nx /= l; ny /= l; d = 0; }
  else { nx = dx / d; ny = dy / d; }
  b.x += nx * (BALL_R - d); b.y += ny * (BALL_R - d);
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) { b.vx -= (1 + s.e) * vn * nx; b.vy -= (1 + s.e) * vn * ny; }
  return { nx, ny, vn };
}

const GATE_N = (() => { const nx = -(gate.by - gate.ay), ny = gate.bx - gate.ax, l = Math.hypot(nx, ny); return [nx / l, ny / l]; })();

function physicsStep(dt) {
  for (const f of flippers) f.update(dt);
  const mx = 292 + 95 * Math.sin(G.time * 0.9);
  MOVER.vx = (mx - MOVER.x) / dt; MOVER.x = mx;
  const plY = PLUNGER_Y + G.plunger.charge * 28;

  for (const b of G.balls) {
    if (b.held > 0) continue;
    const px = b.x, py = b.y;
    b.vy += GRAVITY * dt;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > MAX_V) { b.vx *= MAX_V / sp; b.vy *= MAX_V / sp; }
    b.x += b.vx * dt; b.y += b.vy * dt;

    // muri
    for (const s of segs) {
      if (s.kind === 'gate') {
        const side = (b.x - s.ax) * GATE_N[0] + (b.y - s.ay) * GATE_N[1];
        if (b.vy <= 0 || side < 0) continue;
      }
      const h = collideSeg(b, s);
      if (!h) continue;
      if (s.kind === 'sling' && h.vn < -60 && s.ref.flash < 0.6) {
        const k = 950;
        b.vx += h.nx * k; b.vy += h.ny * k;
        s.ref.flash = 1;
        Sound.play('sling'); addScore(100);
        burst(b.x, b.y, 8, '#fff2a8', 220);
      } else if (h.vn < -250) Sound.play('wall', -h.vn);
    }
    // pavimento lanciatore
    if (b.x > LANE_X && b.y + BALL_R > plY) { b.y = plY - BALL_R; if (b.vy > 0) b.vy = -b.vy * 0.2; if (Math.abs(b.vy) < 30) b.vy = 0; b.vx = 0; b.x = 575; }

    // bumper
    BUMPERS.forEach((bm, i) => {
      const dx = b.x - bm.x, dy = b.y - bm.y, d = Math.hypot(dx, dy), R = bm.r + BALL_R;
      if (d >= R) return;
      const nx = dx / d, ny = dy / d;
      b.x = bm.x + nx * R; b.y = bm.y + ny * R;
      const vn = b.vx * nx + b.vy * ny;
      if (vn < 0) { b.vx -= 1.6 * vn * nx; b.vy -= 1.6 * vn * ny; }
      if (bm.cd <= 0) { b.vx += nx * 700; b.vy += ny * 700; bm.cd = 0.06; onBumper(bm, i); }
    });

    // target abbattibili
    for (const dr of DROPS) {
      if (dr.down) continue;
      const h = collideSeg(b, { ax: dr.x, ay: dr.y - dr.h / 2, bx: dr.x, by: dr.y + dr.h / 2, e: 0.3 });
      if (h && h.vn < -150) onDrop(dr); else if (h && h.vn < -40) Sound.play('target');
    }

    // target T-R-O-N
    for (const t of STANDUPS) {
      const h = collideSeg(b, t);
      if (h && h.vn < -120 && t.flash < 0.5) onStandup(t);
    }
    // paletti
    for (const p of POSTS) {
      const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy), R = p.r + BALL_R;
      if (d >= R || d < 1e-6) continue;
      const nx = dx / d, ny = dy / d; b.x = p.x + nx * R; b.y = p.y + ny * R;
      const vn = b.vx * nx + b.vy * ny;
      if (vn < 0) { b.vx -= 1.75 * vn * nx; b.vy -= 1.75 * vn * ny; if (vn < -200) { p.flash = 1; Sound.play('wall', -vn); addScore(50); } }
    }
    // masso mobile
    {
      const m = MOVER, dx = b.x - m.x, dy = b.y - m.y, d = Math.hypot(dx, dy), R = m.r + BALL_R;
      if (d < R && d > 1e-6) {
        const nx = dx / d, ny = dy / d; b.x = m.x + nx * R; b.y = m.y + ny * R;
        const vn = (b.vx - m.vx) * nx + b.vy * ny;
        if (vn < 0) { b.vx -= 1.7 * vn * nx; b.vy -= 1.7 * vn * ny; if (vn < -150 && m.flash < 0.5) onMover(); }
      }
    }

    // flipper
    for (const f of flippers) {
      const [tx, ty] = f.tip();
      const [cx, cy, t] = closestOnSeg(b.x, b.y, f.px, f.py, tx, ty);
      const rr = f.r1 + (f.r2 - f.r1) * t, R = BALL_R + rr;
      let dx = b.x - cx, dy = b.y - cy; const d = Math.hypot(dx, dy);
      if (d >= R || d < 1e-6) continue;
      const nx = dx / d, ny = dy / d;
      b.x = cx + nx * R; b.y = cy + ny * R;
      const s = t * f.L;
      const svx = s * f.av * -f.side * Math.sin(f.a), svy = s * f.av * Math.cos(f.a);
      const rvx = b.vx - svx, rvy = b.vy - svy, vn = rvx * nx + rvy * ny;
      if (vn < 0) {
        const e = Math.abs(f.av) > 1 ? 0.45 : 0.25;
        b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny;
        if (vn < -500) Sound.play('wall', -vn * 0.5);
      }
    }

    // ---- sensori ----
    // corsie D-A-R-I-O
    if ((py < 100) !== (b.y < 100)) {
      LANES.forEach((l, i) => { if (b.x > l.x0 && b.x < l.x1) onLane(i, b); });
      b.fresh = false;
    }
    // orbita sinistra + spinner
    if (b.x > 30 && b.x < 72 && (py - SPINNER.y) * (b.y - SPINNER.y) <= 0 && py !== b.y) {
      SPINNER.speed = Math.min(40, Math.abs(b.vy) / 50);
    }
    if (b.x > 30 && b.x < 72 && py >= 320 && b.y < 320 && G.state === 'play') onOrbit();
    // outlane / kickback
    if ((py < 880) && (b.y >= 880)) {
      if (b.x > 30 && b.x < 62) {
        if (G.kickback && !G.tilted) {
          G.kickback = false; b.vy = -2100; b.vx = 15; b.y = 870;
          Sound.play('kickback'); say('KICKBACK!', '', 1.2, '#8aff8a'); G.shake = 10;
          burst(b.x, b.y, 30, '#8aff8a', 400);
        } else Sound.voice('ahte', 1);
      } else if (b.x > 523 && b.x < LANE_X) Sound.voice('ahte', 1);
    }
    // sensore BURRONI (la palla ci passa sopra)
    if (BURRONI.cd <= 0 && Math.hypot(b.x - BURRONI.x, b.y - BURRONI.y) < BURRONI.r && G.state === 'play') onBurroni();
    // inlane
    if (py < 790 && b.y >= 790 && ((b.x > 62 && b.x < 100) || (b.x > 485 && b.x < 523))) { addScore(1000, b.x, 770); Sound.play('target'); }
    // buca
    if (b.scoopCd > 0) b.scoopCd -= dt;
    else if (!b.held) {
      const ds = Math.hypot(b.x - SCOOP.x, b.y - SCOOP.y);
      if (ds < 14 && Math.hypot(b.vx, b.vy) < 1500) onScoop(b);
    }
    // ha lasciato la corsia di lancio?
    if (b.inLane && b.x < LANE_X - BALL_R) b.inLane = false;
    if (!b.inLane && b.x > LANE_X) b.inLane = true;
  }

  // collisioni tra palle
  const bs = G.balls;
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
    const a = bs[i], c = bs[j];
    if (a.held || c.held) continue;
    const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy);
    if (d >= BALL_R * 2 || d < 1e-6) continue;
    const nx = dx / d, ny = dy / d, ov = (BALL_R * 2 - d) / 2;
    a.x -= nx * ov; a.y -= ny * ov; c.x += nx * ov; c.y += ny * ov;
    const rv = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
    if (rv < 0) { a.vx += rv * nx * 0.95; a.vy += rv * ny * 0.95; c.vx -= rv * nx * 0.95; c.vy -= rv * ny * 0.95; }
  }

  for (const b of [...G.balls]) if (b.y > H + 40 || b.x < 0 || b.x > W) drainBall(b);
}

function update(dt) {
  G.time += dt;
  // particelle, testi
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 400 * dt; p.vx *= 0.98;
    if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = texts.length - 1; i >= 0; i--) { const t = texts[i]; t.life -= dt * 0.9; t.y -= 40 * dt; if (t.life <= 0) texts.splice(i, 1); }
  if (message) { message.t += dt; if (message.t > message.dur) message = null; }
  BUMPERS.forEach(b => { b.flash = Math.max(0, b.flash - dt * 5); b.cd -= dt; });
  SLINGS.forEach(s => s.flash = Math.max(0, s.flash - dt * 6));
  STANDUPS.forEach(t => t.flash = Math.max(0, t.flash - dt * 4));
  POSTS.forEach(p => p.flash = Math.max(0, p.flash - dt * 5));
  MOVER.flash = Math.max(0, MOVER.flash - dt * 4);
  BURRONI.flash = Math.max(0, BURRONI.flash - dt * 1.5); BURRONI.cd -= dt;
  DROPS.forEach(d => { d.flash = Math.max(0, d.flash - dt * 3); d.anim = Math.max(0, d.anim - dt * 4); });
  SPINNER.angle += SPINNER.speed * dt; SPINNER.speed *= Math.pow(0.15, dt);
  if (SPINNER.speed > 2) { Sound.play('spinner'); if (Math.random() < SPINNER.speed * dt) addScore(100); }
  G.shake = Math.max(0, G.shake - dt * 30);
  G.tilt = Math.max(0, G.tilt - dt * 0.6);

  if (G.state === 'cinematic') {
    G.cineT -= dt;
    if (G.cineT <= 0) {
      G.state = 'play'; UI.endCinematic();
      if (G.act === 3) startMultiball();
    }
    return;
  }
  if (G.state === 'bonus') {
    G.bonusT -= dt;
    for (const f of flippers) f.update(dt);
    if (G.bonusT <= 0) afterBonus();
    return;
  }
  if (G.state !== 'play') { for (const f of flippers) { f.pressed = false; f.update(dt); } return; }
  for (let i = timers.length - 1; i >= 0; i--) if (G.time >= timers[i].t) { const tm = timers.splice(i, 1)[0]; tm.fn(); }

  // lanciatore
  const p = G.plunger;
  if (p.charging) { p.charge = Math.min(1, p.charge + dt * 0.9); if (p.charge < 1) Sound.play('charge'); }
  else if (p.charge > 0) p.charge = Math.max(0, p.charge - dt * 12);

  // palle trattenute nella buca
  for (const b of G.balls) {
    if (b.held > 0) {
      b.held -= dt;
      if (b.held <= 0 && G.state === 'play') {
        b.held = 0; b.vx = rand(-700, -560); b.vy = rand(260, 380);
        b.x = SCOOP.x - 6; b.y = SCOOP.y + 4; b.scoopCd = 0.6;
        Sound.play('scoopOut'); G.shake = 4;
      }
    }
  }
  if (G.tilted) flippers.forEach(f => f.pressed = false);
  for (let i = 0; i < SUB; i++) { physicsStep(DT); if (G.state !== 'play') break; }
  for (const b of G.balls) {
    b.trail.push([b.x, b.y]); if (b.trail.length > 10) b.trail.shift();
    // anti-incastro: palla ferma fuori dal lanciatore e non trattenuta da un flipper alzato → piccola spinta
    const cradled = flippers.some(f => f.pressed && Math.hypot(b.x - f.px, b.y - f.py) < 110);
    if (!b.held && b.x < LANE_X && !cradled && Math.hypot(b.vx, b.vy) < 30) {
      b.still = (b.still || 0) + dt;
      if (b.still > 0.6) { b.vx += (b.x < 292 ? 1 : -1) * rand(90, 160); b.vy -= rand(40, 120); b.still = 0; }
    } else b.still = 0;
  }
}

// ================== INPUT ==================
const keys = {};
function flip(side, down) {
  if (G.state === 'gameover' || G.state === 'attract') return;
  const f = flippers[side];
  if (G.tilted || G.state === 'bonus') down = false;
  if (f.pressed === down) return;
  f.pressed = down;
  document.getElementById(side ? 'bR' : 'bL').classList.toggle('on', down);
  if (G.state !== 'play' && G.state !== 'cinematic') return;
  Sound.play(down ? 'flipper' : 'flipperDown');
  if (down) { // cambio corsia
    const lit = LANES.map(l => l.lit);
    if (side === 0) lit.push(lit.shift()); else lit.unshift(lit.pop());
    LANES.forEach((l, i) => l.lit = lit[i]);
    if (G.skillLive && !G.launched) G.skillLane = (G.skillLane + (side ? 1 : 4)) % 5;
  }
}
function plungerDown() {
  if (G.state !== 'play') return;
  if (G.balls.some(b => b.x > LANE_X && b.y > PLUNGER_Y - 40)) G.plunger.charging = true;
}
function plungerUp() {
  if (!G.plunger.charging) return;
  G.plunger.charging = false;
  const pw = G.plunger.charge;
  G.balls.forEach(b => { if (b.x > LANE_X) b.fresh = true; });
  launch(pw);
}
function anyStart() {
  Sound.init(); Sound.startMusic();
  if (G.state === 'attract' || G.state === 'gameover') { startGame(); return true; }
  return false;
}

const KEYMAP = { left: ['KeyZ', 'ShiftLeft', 'ArrowLeft', 'KeyA'], right: ['Slash', 'ShiftRight', 'ArrowRight', 'KeyL', 'Minus'], plunger: ['Space', 'ArrowDown', 'Enter'], nudge: ['ArrowUp', 'KeyX', 'KeyN'] };
addEventListener('keydown', e => {
  if (e.repeat) { if (Object.values(KEYMAP).flat().includes(e.code)) e.preventDefault(); return; }
  if (KEYMAP.plunger.includes(e.code) && anyStart()) { e.preventDefault(); return; }
  Sound.init();
  if (KEYMAP.left.includes(e.code)) { flip(0, true); e.preventDefault(); }
  else if (KEYMAP.right.includes(e.code)) { flip(1, true); e.preventDefault(); }
  else if (KEYMAP.plunger.includes(e.code)) { plungerDown(); e.preventDefault(); }
  else if (KEYMAP.nudge.includes(e.code)) { nudge(); e.preventDefault(); }
  else if (e.code === 'KeyM') UI.toggleMute();
  else if (e.code === 'KeyB') UI.toggleMusic();
  else if (e.code === 'KeyV') UI.toggleView();
  else if (e.code === 'KeyP' || e.code === 'Escape') UI.togglePause();
});
addEventListener('keyup', e => {
  if (KEYMAP.left.includes(e.code)) flip(0, false);
  else if (KEYMAP.right.includes(e.code)) flip(1, false);
  else if (KEYMAP.plunger.includes(e.code)) plungerUp();
});

// touch: metà sinistra = flipper sinistro, metà destra = flipper destro (+ lanciatore se la palla è pronta)
const pointers = new Map();
function setupTouch(el) {
  el.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    if (anyStart()) return;
    Sound.init();
    const r = document.getElementById('cab').getBoundingClientRect();
    const side = e.clientX < r.left + r.width / 2 ? 0 : 1;
    pointers.set(e.pointerId, side);
    if (pointers.size >= 3) nudge();
    flip(side, true);
    if (side === 1) plungerDown();
  });
  const up = e => {
    if (!pointers.has(e.pointerId)) return;
    const side = pointers.get(e.pointerId); pointers.delete(e.pointerId);
    if (![...pointers.values()].includes(side)) flip(side, false);
    if (side === 1) plungerUp();
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('contextmenu', e => e.preventDefault());
}
