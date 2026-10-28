'use strict';
// Disegno del tavolo + interfaccia (backglass, overlay).

const canvas = document.getElementById('table');
const ctx = canvas.getContext('2d');
const IMG = {};
for (const k of ['canyon', 'atto1', 'atto2', 'atto3', 'atto4']) { IMG[k] = new Image(); IMG[k].src = `assets/img/${k}.jpg`; }
IMG.canyon.onload = () => { staticLayer = null; };

let scale = 1, staticLayer = null;

// il cabinato è disegnato a 700x1330 e scalato per stare nello schermo
const CAB_W = 700, CAB_H = 1330;
function resize() {
  const wrap = document.getElementById('cabWrap'), cab = document.getElementById('cab');
  const s = Math.min(wrap.clientWidth / CAB_W, wrap.clientHeight / CAB_H);
  cab.style.transform = `scale(${s})`;
  cab.style.left = (wrap.clientWidth - CAB_W * s) / 2 + 'px';
  cab.style.top = (wrap.clientHeight - CAB_H * s) / 2 + 'px';
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  // un po' di risoluzione in più: la parte bassa del piano in prospettiva è ingrandita
  const k = s * dpr * 1.15;
  canvas.width = Math.floor(W * k); canvas.height = Math.floor(H * k);
  scale = k;
  staticLayer = null;
}
addEventListener('resize', resize);

function tablePath(c) {
  c.beginPath();
  c.moveTo(30, H); c.lineTo(30, 300);
  c.arc(ARC_C[0], ARC_C[1], ARC_R, Math.PI, Math.PI * 2);
  c.lineTo(595, H); c.closePath();
}

function buildStatic() {
  const off = document.createElement('canvas');
  off.width = canvas.width; off.height = canvas.height;
  const c = off.getContext('2d');
  c.setTransform(scale, 0, 0, scale, 0, 0);
  // cornice di legno
  const wood = c.createLinearGradient(0, 0, W, 0);
  wood.addColorStop(0, '#2a1206'); wood.addColorStop(0.5, '#4a2210'); wood.addColorStop(1, '#2a1206');
  c.fillStyle = wood; c.fillRect(0, 0, W, H);

  c.save(); tablePath(c); c.clip();
  c.fillStyle = '#0b0f1e'; c.fillRect(0, 0, W, H);
  const im = IMG.canyon;
  if (im.complete && im.naturalWidth) {
    const sc = H / im.naturalHeight;
    c.drawImage(im, (W - im.naturalWidth * sc) / 2, 0, im.naturalWidth * sc, H);
  }
  // velo leggero + vignetta per far risaltare gli elementi
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(5,10,30,0.15)'); g.addColorStop(0.45, 'rgba(10,5,20,0.3)'); g.addColorStop(1, 'rgba(15,4,0,0.62)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const v = c.createRadialGradient(312, 480, 150, 312, 480, 620);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.65)');
  c.fillStyle = v; c.fillRect(0, 0, W, H);
  // corsia di lancio
  c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(LANE_X, 330, 40, H);
  // orbita
  c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(30, 300, 42, 310);
  c.beginPath(); c.arc(ARC_C[0], ARC_C[1], ARC_R, Math.PI, Math.PI * 2); c.arc(ARC_C[0], ARC_C[1], 238.5, Math.PI * 2, Math.PI, true);
  c.fillStyle = 'rgba(0,0,0,0.3)'; c.fill();
  // decorazioni: fiamme a raggiera sul fondo (richiamo alla grafica)
  c.globalAlpha = 0.5;
  for (const [x, dir] of [[30, 1], [555, -1]]) {
    for (let i = 0; i < 4; i++) {
      c.beginPath(); c.moveTo(x, 940 + i * 18); c.lineTo(x + dir * (70 - i * 12), 990 + i * 6); c.lineTo(x, 960 + i * 18);
      c.fillStyle = ['#ff3d00', '#ff9100', '#ffd600', '#ff3d00'][i]; c.fill();
    }
  }
  c.globalAlpha = 1;
  // scritte stampate sul piano
  c.font = '14px Bungee, Impact, sans-serif'; c.textAlign = 'center';
  c.fillStyle = 'rgba(255,220,150,0.55)';
  c.save(); c.translate(575, 700); c.rotate(-Math.PI / 2); c.fillText('LANCIO ▶', 0, 5); c.restore();
  c.save(); c.translate(51, 530); c.rotate(-Math.PI / 2); c.fillText('SALTO', 0, 5); c.restore();
  c.font = '11px Bungee, Impact, sans-serif';
  c.fillText('ATTI', 292.5, 590);
  c.fillText('BONUS', 292.5, 694);
  c.restore();

  // muri
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (const s of segs) {
    if (s.draw === 'none' || s.kind === 'gate' || s.kind === 'sling') continue;
    c.beginPath(); c.moveTo(s.ax, s.ay); c.lineTo(s.bx, s.by);
    if (s.draw === 'rail' || s.draw === 'post') {
      c.strokeStyle = 'rgba(255,140,40,0.35)'; c.lineWidth = 10; c.stroke();
      c.strokeStyle = '#d9dce6'; c.lineWidth = s.draw === 'post' ? 6 : 5; c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 1.5; c.stroke();
    } else {
      c.strokeStyle = '#ff7a1a'; c.lineWidth = 9; c.stroke();
      c.strokeStyle = '#ffd36b'; c.lineWidth = 3; c.stroke();
    }
  }
  // corpo slingshot
  for (const s of SLINGS) {
    c.beginPath(); c.moveTo(...s.a); c.lineTo(...s.b); c.lineTo(...s.c); c.closePath();
    const gr = c.createLinearGradient(s.a[0], s.a[1], s.c[0], s.c[1]);
    gr.addColorStop(0, '#ff3d00'); gr.addColorStop(1, '#ffb300');
    c.fillStyle = gr; c.fill();
    c.strokeStyle = '#2a0a00'; c.lineWidth = 2; c.stroke();
  }
  return off;
}

// ---------- elementi dinamici ----------
const blink = (hz = 4) => Math.sin(G.time * Math.PI * 2 * hz) > 0;

function glow(c, x, y, r, color, a = 1) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.globalAlpha = a; c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
}

function insert(c, x, y, r, lit, color, label, font = 11) {
  if (lit) glow(c, x, y, r * 2.6, color, 0.55);
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = lit ? color : 'rgba(40,30,30,0.75)'; c.fill();
  c.strokeStyle = lit ? '#fff' : 'rgba(255,255,255,0.25)'; c.lineWidth = 1.5; c.stroke();
  if (label) {
    c.font = `${font}px Bungee, Impact, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = lit ? '#1a0a00' : 'rgba(255,255,255,0.45)'; c.fillText(label, x, y + 1);
  }
}

function arrow(c, x, y, ang, lit, color, size = 22) {
  c.save(); c.translate(x, y); c.rotate(ang);
  if (lit) glow(c, 0, 0, size * 1.8, color, 0.6);
  c.beginPath(); c.moveTo(size, 0); c.lineTo(-size * 0.6, -size * 0.6); c.lineTo(-size * 0.25, 0); c.lineTo(-size * 0.6, size * 0.6); c.closePath();
  c.fillStyle = lit ? color : 'rgba(60,40,30,0.7)'; c.fill();
  c.strokeStyle = lit ? '#fff' : 'rgba(255,255,255,0.25)'; c.lineWidth = 1.5; c.stroke();
  c.restore();
}

function drawInserts(c) {
  const playing = G.state !== 'attract' && G.state !== 'gameover';
  const attract = !playing;
  const t = G.time;
  // DARIO
  'DARIO'.split('').forEach((ch, i) => {
    const l = LANES[i];
    let lit = l.lit;
    if (G.skillLive && !G.launched && i === G.skillLane && playing) lit = blink(5);
    if (attract) lit = Math.sin(t * 6 - i) > 0.2;
    insert(c, l.cx, 150, 14, lit, i === G.skillLane && G.skillLive && !G.launched ? '#7bffea' : '#ffcc33', ch, 13);
  });
  // atti
  ['I', 'II', 'III', 'IV'].forEach((n, i) => {
    const lit = attract ? Math.sin(t * 4 + i) > 0 : (i < G.act || (i === G.act && (G.actReady || blink(2))));
    insert(c, 232.5 + i * 40, 615, 14, lit, ['#ffd36b', '#ffb36b', '#ff8a5b', '#ff4d6d'][i], n, 10);
  });
  // moltiplicatori
  [2, 3, 4, 5, 6].forEach((m, i) => {
    const lit = attract ? Math.sin(t * 5 - i * 0.7) > 0.3 : G.mult >= m;
    insert(c, 212.5 + i * 40, 668, 13, lit, '#7bffea', m + 'X', 9);
  });
  // frecce
  const orbitLit = attract ? blink(1.5) : (G.multiball ? G.jpNext === 'orbit' && blink(6) : G.act === 1 && !G.actReady && blink(3));
  arrow(c, 110, 560, -Math.PI * 0.62, orbitLit, '#ffb36b');
  const scoopLit = attract ? blink(1.3) : ((G.actReady || (G.multiball && G.jpNext === 'scoop')) && blink(6));
  arrow(c, 418, 455, -Math.PI * 0.27, scoopLit, G.multiball ? '#ffe14d' : '#8aff8a');
  const dropLit = attract ? blink(1.7) : G.act === 2 && !G.actReady && blink(3);
  arrow(c, 495, 540, 0, dropLit, '#ff6b6b', 18);
  insert(c, 46, 850, 9, attract ? blink(2) : G.kickback, '#8aff8a', 'K', 9);
  // riprova
  const saveLit = playing && ((G.launched && G.time < G.saveUntil) || G.extraBalls > 0);
  c.font = '12px Bungee, Impact, sans-serif'; c.textAlign = 'center';
  c.fillStyle = saveLit && blink(3) ? '#8affff' : 'rgba(255,255,255,0.18)';
  if (saveLit && blink(3)) glow(c, 292.5, 975, 40, '#8affff', 0.4);
  c.fillText('RIPROVA', 292.5, 980);
  if (G.multiball) {
    c.font = '13px Bungee, Impact, sans-serif'; c.fillStyle = blink(4) ? '#ffe14d' : '#ff7b3d';
    c.fillText('JACKPOT', G.jpNext === 'scoop' ? SCOOP.x - 30 : 110, G.jpNext === 'scoop' ? SCOOP.y + 40 : 520);
  }
}

function drawBumper(c, bm, i) {
  const f = bm.flash;
  const hot = G.act === 0 && !G.actReady && G.state === 'play';
  glow(c, bm.x, bm.y, bm.r * 2.2, f > 0 ? '#fff6c0' : hot ? 'rgba(255,170,60,0.8)' : 'rgba(255,120,40,0.45)', 0.5 + f * 0.5);
  c.beginPath(); c.arc(bm.x, bm.y + 3, bm.r, 0, Math.PI * 2); c.fillStyle = 'rgba(0,0,0,0.5)'; c.fill();
  // anello
  c.beginPath(); c.arc(bm.x, bm.y, bm.r + f * 3, 0, Math.PI * 2);
  c.fillStyle = '#e8e8f0'; c.fill();
  // cappello "roccia"
  const g = c.createRadialGradient(bm.x - 8, bm.y - 8, 2, bm.x, bm.y, bm.r - 4);
  g.addColorStop(0, f > 0 ? '#fffbe0' : '#ffd36b'); g.addColorStop(0.6, f > 0 ? '#ffe680' : '#d9862b'); g.addColorStop(1, '#7a3a10');
  c.beginPath(); c.arc(bm.x, bm.y, bm.r - 5, 0, Math.PI * 2); c.fillStyle = g; c.fill();
  c.font = '9px Bungee, Impact, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = '#3a1500'; c.fillText(['ROC', 'CIA', 'SAS'][i], bm.x, bm.y + 1);
}

function drawFlipper(c, f) {
  const [tx, ty] = f.tip();
  const ang = Math.atan2(ty - f.py, tx - f.px);
  c.save(); c.translate(f.px, f.py); c.rotate(ang);
  const shape = () => {
    c.beginPath();
    c.arc(0, 0, f.r1, Math.PI / 2, Math.PI * 1.5);
    c.lineTo(f.L, -f.r2); c.arc(f.L, 0, f.r2, -Math.PI / 2, Math.PI / 2); c.closePath();
  };
  c.translate(0, 4); shape(); c.fillStyle = 'rgba(0,0,0,0.5)'; c.fill(); c.translate(0, -4);
  shape();
  const g = c.createLinearGradient(0, -f.r1, 0, f.r1);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#f0e6d0'); g.addColorStop(1, '#b8a888');
  c.fillStyle = g; c.fill();
  c.lineWidth = 3.5; c.strokeStyle = '#e8261c'; c.stroke();
  c.beginPath(); c.arc(0, 0, 4, 0, Math.PI * 2); c.fillStyle = '#888'; c.fill();
  c.restore();
}

function drawBall(c, b) {
  for (let i = 0; i < b.trail.length; i++) {
    const [x, y] = b.trail[i], a = i / b.trail.length;
    c.globalAlpha = a * 0.25; c.fillStyle = G.multiball ? '#ffb347' : '#9fd8ff';
    c.beginPath(); c.arc(x, y, BALL_R * (0.4 + a * 0.6), 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
  c.beginPath(); c.arc(b.x + 3, b.y + 4, BALL_R, 0, Math.PI * 2); c.fillStyle = 'rgba(0,0,0,0.45)'; c.fill();
  const g = c.createRadialGradient(b.x - 4, b.y - 5, 1, b.x, b.y, BALL_R);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, '#dfe6f0'); g.addColorStop(0.75, '#7d8796'); g.addColorStop(1, '#2b3038');
  c.beginPath(); c.arc(b.x, b.y, BALL_R, 0, Math.PI * 2); c.fillStyle = g; c.fill();
}

function render() {
  if (!staticLayer) staticLayer = buildStatic();
  const c = ctx;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, canvas.width, canvas.height);
  const sh = G.shake;
  const ox = sh ? rand(-sh, sh) * scale * 0.5 : 0, oy = sh ? rand(-sh, sh) * scale * 0.5 : 0;
  c.drawImage(staticLayer, ox, oy);
  c.setTransform(scale, 0, 0, scale, ox, oy);

  drawInserts(c);

  // buca
  const sg = c.createRadialGradient(SCOOP.x, SCOOP.y, 2, SCOOP.x, SCOOP.y, SCOOP.r + 6);
  sg.addColorStop(0, '#000'); sg.addColorStop(0.7, '#1a0d05'); sg.addColorStop(1, '#ff9a3d');
  c.beginPath(); c.arc(SCOOP.x, SCOOP.y, SCOOP.r + 4, 0, Math.PI * 2); c.fillStyle = sg; c.fill();
  c.font = '10px Bungee, Impact, sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(255,220,150,0.8)';
  c.fillText('BUCA', SCOOP.x, SCOOP.y - 26);

  // spinner
  c.save(); c.translate(SPINNER.x, SPINNER.y);
  const sw = Math.abs(Math.cos(SPINNER.angle * 3)) * 19 + 2;
  c.fillStyle = '#d9dce6'; c.fillRect(-19, -sw / 4, 38, sw / 2);
  c.fillStyle = '#ff3d00'; c.fillRect(-19, -1, 38, 2);
  c.restore();

  // cancello
  c.lineCap = 'round';
  c.beginPath(); c.moveTo(gate.ax, gate.ay); c.lineTo(gate.bx, gate.by);
  c.strokeStyle = '#d9dce6'; c.lineWidth = 3; c.stroke();

  // slingshot (gomma)
  for (const s of SLINGS) {
    const k = s.flash, mx = (s.a[0] + s.c[0]) / 2, my = (s.a[1] + s.c[1]) / 2;
    const nx = s.side * 0.89, ny = -s.side * s.side * 0.45;
    c.beginPath(); c.moveTo(...s.a); c.quadraticCurveTo(mx + nx * k * 10, my + ny * k * 10, ...s.c);
    c.strokeStyle = k > 0 ? '#fff' : '#f4f4f4'; c.lineWidth = 5; c.stroke();
    if (k > 0) glow(c, mx, my, 50, '#fff2a8', k);
  }

  // target abbattibili
  for (const d of DROPS) {
    if (d.down && !d.anim) { c.fillStyle = 'rgba(80,0,0,0.6)'; c.fillRect(d.x - 2, d.y - d.h / 2, 4, d.h); continue; }
    const pop = d.anim;
    if (d.flash) glow(c, d.x, d.y, 40, '#ff6b6b', d.flash);
    c.fillStyle = '#ffcc33'; c.fillRect(d.x - 5 + pop * 4, d.y - d.h / 2 + 1, 9, d.h - 2);
    c.fillStyle = '#d42020'; c.fillRect(d.x - 5 + pop * 4, d.y - 4, 9, 8);
  }

  BUMPERS.forEach((b, i) => drawBumper(c, b, i));

  // sensore BURRONI
  {
    const s = BURRONI, k = s.flash, pulse = 0.5 + 0.5 * Math.sin(G.time * 4);
    glow(c, s.x, s.y, 46, '#ff4dff', 0.25 + 0.25 * pulse + k * 0.6);
    c.beginPath(); c.arc(s.x, s.y, s.r + 4, 0, Math.PI * 2); c.fillStyle = 'rgba(20,0,20,0.8)'; c.fill();
    c.lineWidth = 2; c.strokeStyle = k ? '#fff' : '#ff4dff'; c.stroke();
    c.beginPath(); c.arc(s.x, s.y, s.r - 2, 0, Math.PI * 2); c.fillStyle = k ? '#ffd0ff' : `rgba(255,77,255,${0.35 + 0.3 * pulse})`; c.fill();
    c.font = '16px Bungee, Impact, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#fff'; c.fillText('B', s.x, s.y + 1);
    c.font = '9px Bungee, Impact, sans-serif'; c.fillStyle = '#ffb3ff'; c.fillText('BURRONI', s.x, s.y + 30);
  }
  // paletti
  for (const p of POSTS) {
    if (p.flash) glow(c, p.x, p.y, 26, '#fff2a8', p.flash);
    c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fillStyle = '#f4f4f4'; c.fill();
    c.beginPath(); c.arc(p.x, p.y, p.r - 3, 0, Math.PI * 2); c.fillStyle = '#e8261c'; c.fill();
  }
  // target T-R-O-N
  for (const t of STANDUPS) {
    const mx = (t.ax + t.bx) / 2, my = (t.ay + t.by) / 2, vert = t.ax === t.bx;
    const lit = G.state === 'attract' ? blink(2) : t.lit;
    if (lit || t.flash) glow(c, mx, my, 34, '#b98aff', Math.max(t.flash, lit ? 0.6 : 0));
    c.fillStyle = t.flash ? '#fff' : lit ? '#c9a2ff' : '#5a3a8a';
    if (vert) c.fillRect(t.ax - 3, t.ay, 9, t.by - t.ay); else c.fillRect(t.ax, t.ay - 4, t.bx - t.ax, 9);
    c.font = '11px Bungee, Impact, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = lit ? '#fff' : 'rgba(255,255,255,0.55)';
    c.fillText(t.ch, vert ? t.ax + 16 : mx, vert ? my : my + 17);
  }
  // masso mobile
  {
    const m = MOVER;
    c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(192, m.y - 2, 200, 4);
    if (m.flash) glow(c, m.x, m.y, 40, '#ffb36b', m.flash);
    c.beginPath(); c.arc(m.x + 2, m.y + 3, m.r, 0, Math.PI * 2); c.fillStyle = 'rgba(0,0,0,0.5)'; c.fill();
    const g = c.createRadialGradient(m.x - 5, m.y - 5, 2, m.x, m.y, m.r);
    g.addColorStop(0, m.flash ? '#fff' : '#f0c890'); g.addColorStop(0.7, '#a0602a'); g.addColorStop(1, '#4a2410');
    c.beginPath();
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + G.time, r = m.r * (0.85 + 0.15 * Math.sin(i * 2.7)); c.lineTo(m.x + Math.cos(a) * r, m.y + Math.sin(a) * r); }
    c.closePath(); c.fillStyle = g; c.fill();
  }

  // lanciatore
  const py = PLUNGER_Y + G.plunger.charge * 28;
  c.fillStyle = '#555'; c.fillRect(569, py, 12, H - py);
  for (let y = py + 6; y < H; y += 6) { c.fillStyle = '#aaa'; c.fillRect(566, y, 18, 2); }
  c.fillStyle = '#e8261c'; c.fillRect(560, py - 2, 30, 7);
  if (G.plunger.charge > 0) {
    const h = 110 * G.plunger.charge;
    c.fillStyle = `hsl(${120 - G.plunger.charge * 120},100%,50%)`; c.fillRect(598, 990 - h, 6, h);
  }

  flippers.forEach(f => drawFlipper(c, f));
  G.balls.forEach(b => drawBall(c, b));

  // particelle
  for (const p of particles) {
    c.globalAlpha = Math.min(1, p.life * 2); c.fillStyle = p.color;
    c.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  c.globalAlpha = 1;
  // testi punteggio
  c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const t of texts) {
    c.globalAlpha = Math.min(1, t.life * 1.5);
    c.font = '15px Bungee, Impact, sans-serif';
    c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.8)'; c.strokeText(t.t, t.x, t.y);
    c.fillStyle = t.color; c.fillText(t.t, t.x, t.y);
  }
  c.globalAlpha = 1;
  // messaggio grande
  if (message) {
    const m = message, k = Math.min(1, m.t / 0.15), out = Math.max(0, (m.t - m.dur + 0.3) / 0.3);
    const s = (0.4 + 0.6 * k) * (1 + (1 - k) * 0.6);
    c.save(); c.translate(312, 470); c.scale(s, s); c.globalAlpha = 1 - out;
    c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(-240, -42, 480, m.sub ? 92 : 70);
    c.strokeStyle = m.color; c.lineWidth = 2; c.strokeRect(-240, -42, 480, m.sub ? 92 : 70);
    c.font = '40px Bungee, Impact, sans-serif';
    c.shadowColor = m.color; c.shadowBlur = 20;
    c.fillStyle = m.color; c.fillText(m.text, 0, -6);
    c.shadowBlur = 0;
    if (m.sub) { c.font = '26px VT323, monospace'; c.fillStyle = '#fff'; c.fillText(m.sub.toUpperCase(), 0, 34); }
    c.restore();
  }
  if (G.tilted && G.state === 'play') {
    c.font = '70px Bungee, Impact, sans-serif'; c.fillStyle = blink(2) ? '#ff3d3d' : '#600';
    c.fillText('TILT', 300, 300);
  }
}

// ================== UI ==================
const $ = id => document.getElementById(id);
const UI = {
  last: {},
  set(id, v) { if (this.last[id] !== v) { this.last[id] = v; $(id).textContent = v; } },
  update() {
    this.set('score', G.state === 'attract' ? 'BURRONITRON' : fmt(G.score));
    this.set('ball', G.state === 'gameover' || G.state === 'attract' ? '-' : Math.min(G.ball, G.maxBalls) + '/' + G.maxBalls);
    this.set('mult', G.mult + 'X'); this.set('level', G.level);
    this.set('hi', fmt(Math.max(G.hi, G.score)));
    const a = ACTS[G.act];
    let prog = '', pct = 0;
    if (G.multiball) { prog = 'JACKPOT: ' + G.jackpots; pct = (G.jackpots % 4) / 4; }
    else if (G.actReady) { prog = 'PRONTO! Colpisci la BUCA'; pct = 1; }
    else if (a.goal) { prog = `${G.actProg} / ${a.goal} ${a.unit}`; pct = G.actProg / a.goal; }
    else { prog = 'Colpisci la BUCA'; }
    this.set('actProg', prog);
    this.set('dmdLine', G.state === 'attract' ? 'RECORD ' + fmt(G.hi) + ' · PREMI START'
      : `PALLA ${Math.min(G.ball, G.maxBalls)} · ATTO ${a.n} · ${prog}${G.mult > 1 ? ' · ' + G.mult + 'X' : ''}`);
    $('bStart').classList.toggle('blink', G.state !== 'play' || G.balls.some(b => b.x > LANE_X && b.y > 900));
    const w = Math.round(pct * 100) + '%';
    if (this.last.bar !== w) { this.last.bar = w; $('actBar').style.width = w; }
  },
  showAct(flash) {
    const a = ACTS[G.act];
    $('actImg').src = `assets/img/${a.img}.jpg`;
    $('actTitle').textContent = 'ATTO ' + a.n;
    $('actName').textContent = a.name;
    $('actDesc').textContent = a.desc;
    if (flash) { const el = $('actCard'); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
  },
  cinematic(a) {
    $('cineImg').style.backgroundImage = `url(assets/img/${a.img}.jpg)`;
    $('cineTitle').textContent = 'ATTO ' + a.n;
    $('cineName').textContent = a.name;
    $('cineDesc').textContent = a.desc;
    const el = $('cine'); el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  },
  endCinematic() { $('cine').classList.remove('show'); },
  hideOverlays() { $('title').classList.add('hidden'); $('over').classList.add('hidden'); },
  gameOver(score, rec) {
    $('overScore').textContent = fmt(score);
    $('overRec').textContent = rec ? 'NUOVO RECORD!' : 'Record: ' + fmt(G.hi);
    setTimeout(() => $('over').classList.remove('hidden'), 1200);
  },
  toggleMute() { Sound.setMuted(!Sound.muted); $('btnMute').classList.toggle('off', Sound.muted); },
  toggleMusic() { Sound.setMusic(!Sound.musicOn); $('btnMusic').classList.toggle('off', !Sound.musicOn); },
  toggleView() {
    const flat = $('cab').classList.toggle('flat');
    $('btnView').textContent = flat ? '2D' : '3D';
    try { localStorage.setItem('burroni.flat', flat ? '1' : ''); } catch (e) {}
  },
  flashHead() { const h = $('head'); h.classList.remove('flash'); void h.offsetWidth; h.classList.add('flash'); },
  paused: false,
  togglePause() {
    if (G.state === 'attract' || G.state === 'gameover') return;
    this.paused = !this.paused; $('pause').classList.toggle('hidden', !this.paused);
  },
};

// ================== LOOP ==================
let lastT = performance.now();
function frame(now) {
  let dt = (now - lastT) / 1000; lastT = now;
  if (dt > 0.05) dt = 0.05;
  if (!UI.paused) {
    // passo fisso a 60Hz per una fisica stabile
    acc += dt;
    while (acc >= 1 / 60) { update(1 / 60); acc -= 1 / 60; }
  }
  render(); UI.update();
  requestAnimationFrame(frame);
}
let acc = 0;

document.addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'play' && !UI.paused) UI.togglePause(); });
$('btnMute').onclick = e => { e.stopPropagation(); Sound.init(); UI.toggleMute(); };
$('btnMusic').onclick = e => { e.stopPropagation(); Sound.init(); UI.toggleMusic(); };
$('btnPause').onclick = e => { e.stopPropagation(); UI.togglePause(); };
$('btnView').onclick = e => { e.stopPropagation(); UI.toggleView(); };
$('pause').onclick = () => UI.togglePause();
document.querySelector('.btns').addEventListener('pointerdown', e => e.stopPropagation());
for (const id of ['title', 'over']) $(id).addEventListener('pointerdown', e => { e.preventDefault(); anyStart(); });
setupTouch(document.getElementById('cabWrap'));
// pulsantiera: START lancia la palla (o avvia la partita)
const bStart = $('bStart');
bStart.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); if (anyStart()) return; Sound.init(); bStart.classList.add('on'); plungerDown(); });
const startUp = () => { bStart.classList.remove('on'); plungerUp(); };
bStart.addEventListener('pointerup', startUp); bStart.addEventListener('pointercancel', startUp);
try { if (localStorage.getItem('burroni.flat')) UI.toggleView(); } catch (e) {}

UI.showAct(false);
resize();
document.fonts && document.fonts.ready.then(() => { staticLayer = null; });
requestAnimationFrame(frame);
