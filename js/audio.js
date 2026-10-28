'use strict';
// Audio: effetti sintetizzati, musica procedurale "western-surf" e voci registrate.
const Sound = (() => {
  let ctx = null, master, comp, sfxBus, musicBus, voiceBus, delay, delayFb, noiseBuf;
  let muted = false, musicOn = true;
  const buffers = {};
  const fallback = {};

  // vocali da vocals/ (convertiti in assets/voci/vocalsN.mp3): ogni voce ne pesca uno a caso.
  // Se aggiungi vocali, alza VOCALS_COUNT.
  const VOCALS_COUNT = 16;
  const VOCALS = Array.from({ length: VOCALS_COUNT }, (_, i) => `vocals${i + 1}`);
  const VOICES = { burroni1: 'burroni1', burroni2: 'burroni2', burroni3: 'burroni3' };
  for (const v of VOCALS) VOICES[v] = v;
  let lastVocal = -1;
  function pickVocal() {
    let i;
    do { i = Math.floor(Math.random() * VOCALS.length); } while (VOCALS.length > 1 && i === lastVocal);
    lastVocal = i;
    return VOCALS[i];
  }
  // vocali di Burroni: partono a caso dal sensore BURRONI
  const BURRONI = ['burroni1', 'burroni2', 'burroni3'];
  // in generale, su 5 voci 4 vengono da vocals/ e 1 da burroni/
  const BURRONI_RATIO = 1 / 5;
  let lastBurroni = -1;
  function pickBurroni() {
    let i;
    do { i = Math.floor(Math.random() * BURRONI.length); } while (BURRONI.length > 1 && i === lastBurroni);
    lastBurroni = i;
    return BURRONI[i];
  }
  function burroni() { voice(pickBurroni(), 4); }

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9;
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? 0.3 : 0; musicBus.connect(master);
    voiceBus = ctx.createGain(); voiceBus.gain.value = 1.15; voiceBus.connect(master);
    // eco "spaghetti western" per musica
    delay = ctx.createDelay(1); delay.delayTime.value = 0.34;
    delayFb = ctx.createGain(); delayFb.gain.value = 0.32;
    const dl = ctx.createGain(); dl.gain.value = 0.45;
    delay.connect(delayFb); delayFb.connect(delay); delay.connect(dl); dl.connect(musicBus);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    loadVoices();
  }

  function loadVoices() {
    for (const [key, file] of Object.entries(VOICES)) {
      const url = `assets/voci/${file}.mp3`;
      fetch(url).then(r => r.arrayBuffer()).then(ab => new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej)))
        .then(buf => { buffers[key] = buf; })
        .catch(() => { fallback[key] = url; }); // file:// → usa <audio>
    }
  }

  // ---------- voci ----------
  let voiceSrc = null, voicePri = -1, voiceUntil = 0;
  function voice(key, pri = 1) {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    if (now < voiceUntil && pri <= voicePri) return;
    if (voiceSrc) { try { voiceSrc.stop(); } catch (e) {} voiceSrc = null; }
    if (!BURRONI.includes(key)) key = Math.random() < BURRONI_RATIO ? pickBurroni() : pickVocal();
    if (buffers[key]) {
      const s = ctx.createBufferSource(); s.buffer = buffers[key];
      s.connect(voiceBus); s.start();
      voiceSrc = s; voiceUntil = now + buffers[key].duration; voicePri = pri;
      // abbassa la musica mentre parla
      duck(buffers[key].duration);
    } else if (fallback[key]) {
      const a = new Audio(fallback[key]); a.volume = 1; a.play().catch(() => {});
      voiceUntil = now + 1.5; voicePri = pri;
    }
  }
  function duck(dur) {
    if (!musicOn) return;
    const t = ctx.currentTime, g = musicBus.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0.12, t + 0.05);
    g.setValueAtTime(0.12, t + dur);
    g.linearRampToValueAtTime(0.3, t + dur + 0.4);
  }

  // ---------- primitive sintetiche ----------
  function tone(type, f0, f1, dur, vol, when = 0, bus = sfxBus) {
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.02);
    return o;
  }
  function noise(dur, vol, ftype = 'lowpass', freq = 2000, q = 1, when = 0, f1 = null, bus = sfxBus) {
    const t = ctx.currentTime + when;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = ftype; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  const last = {};
  function throttle(k, ms) {
    const n = performance.now();
    if (last[k] && n - last[k] < ms) return false;
    last[k] = n; return true;
  }

  const sfx = {
    flipper() { noise(0.06, 0.5, 'bandpass', 1800, 0.8); tone('sine', 140, 50, 0.08, 0.5); },
    flipperDown() { noise(0.04, 0.18, 'bandpass', 1200, 1); },
    bumper(i = 0) {
      const base = [520, 620, 740][i % 3];
      tone('square', base, base / 3, 0.13, 0.22); tone('sine', 160, 60, 0.15, 0.5);
      noise(0.05, 0.4, 'highpass', 3000);
    },
    sling() { tone('triangle', 320, 110, 0.1, 0.4); noise(0.06, 0.35, 'bandpass', 2500, 2); },
    wall(v) { if (!throttle('wall', 45)) return; noise(0.03, Math.min(0.35, v / 4000), 'bandpass', 900, 2); },
    lane() { tone('sine', 1320, 1320, 0.3, 0.25); tone('sine', 1980, 1980, 0.35, 0.15, 0.06); },
    target() { tone('square', 900, 420, 0.09, 0.2); noise(0.04, 0.3, 'highpass', 2500); },
    drop() { noise(0.12, 0.5, 'lowpass', 900); tone('sine', 220, 70, 0.15, 0.5); },
    bank() { [523, 659, 784, 1047].forEach((f, i) => tone('square', f, f, 0.12, 0.15, i * 0.07)); },
    spinner() { if (!throttle('spin', 35)) return; tone('square', 2200, 1800, 0.025, 0.1); },
    scoopIn() { tone('sine', 420, 60, 0.45, 0.5); noise(0.3, 0.2, 'lowpass', 600, 1, 0, 120); },
    scoopOut() { noise(0.15, 0.6, 'lowpass', 1200); tone('sine', 90, 40, 0.2, 0.6); },
    launch(p) { noise(0.35, 0.25 + p * 0.3, 'bandpass', 300, 1.5, 0, 3500); tone('sine', 120, 50, 0.15, 0.6); },
    charge() { if (!throttle('chg', 90)) return; tone('triangle', 200 + Math.random() * 40, 220, 0.05, 0.05); },
    kickback() { tone('sawtooth', 90, 30, 0.35, 0.5); noise(0.3, 0.6, 'lowpass', 2000, 1, 0, 100); },
    drain() { tone('sawtooth', 440, 55, 1.1, 0.18); tone('sawtooth', 446, 57, 1.1, 0.12); },
    lose() { [392, 370, 349, 330].forEach((f, i) => tone('triangle', f, f * 0.97, 0.4, 0.2, i * 0.35)); },
    jackpot() {
      [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => { tone('square', f, f, 0.18, 0.13, i * 0.06); tone('sawtooth', f / 2, f / 2, 0.2, 0.06, i * 0.06); });
      noise(0.8, 0.3, 'highpass', 6000, 1, 0.3);
    },
    fanfare() {
      const n = [[392, 0], [523, 0.15], [659, 0.3], [784, 0.45], [659, 0.7], [784, 0.85], [1047, 1.0]];
      n.forEach(([f, w]) => { tone('square', f, f, 0.3, 0.13, w); tone('triangle', f / 2, f / 2, 0.3, 0.2, w); });
    },
    skill() { [880, 1175, 1568, 2093].forEach((f, i) => tone('sine', f, f, 0.25, 0.2, i * 0.05)); },
    save() { tone('square', 988, 988, 0.1, 0.15); tone('square', 1319, 1319, 0.2, 0.15, 0.12); },
    tilt() { tone('sawtooth', 70, 60, 1.2, 0.3); tone('square', 73, 61, 1.2, 0.15); },
    warn() { tone('square', 200, 200, 0.15, 0.2); tone('square', 200, 200, 0.15, 0.2, 0.25); },
    multi() { tone('sawtooth', 100, 800, 0.8, 0.2); noise(0.8, 0.3, 'bandpass', 200, 2, 0, 6000); },
    coin() { tone('square', 988, 988, 0.08, 0.15); tone('square', 1319, 1319, 0.3, 0.15, 0.08); },
    bonusTick() { tone('square', 1200 + Math.random() * 300, 1000, 0.04, 0.08); },
    letter() { tone('triangle', 660, 990, 0.12, 0.2); },
  };

  // ---------- musica procedurale ----------
  // A minore stile spaghetti-western/surf: Am F G E
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const CHORDS = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 56, 59]];
  const MELODY = [ // 16 step per accordo, -1 = pausa
    [69, -1, -1, 72, -1, 76, -1, -1, 74, -1, 72, -1, 69, -1, -1, -1],
    [72, -1, -1, 69, -1, 65, -1, -1, 69, -1, 72, -1, 77, -1, 76, -1],
    [74, -1, -1, 71, -1, 67, -1, -1, 71, -1, 74, -1, 79, -1, 77, 76],
    [76, -1, -1, -1, 75, -1, 76, -1, 80, -1, -1, -1, 83, -1, -1, -1]];
  let intensity = 0, step = 0, nextTime = 0, timer = null, playing = false;

  function kick(t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.2);
  }
  function hit(t, dur, vol, ftype, freq) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = ftype; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(musicBus); s.start(t, Math.random() * 0.5); s.stop(t + dur);
  }
  function note(t, m, dur, type, vol, toDelay = false, cutoff = 2500) {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = type; o.frequency.value = mtof(m);
    f.type = 'lowpass'; f.frequency.setValueAtTime(cutoff, t); f.frequency.exponentialRampToValueAtTime(cutoff / 4, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(musicBus); if (toDelay) g.connect(delay);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function schedule() {
    const bpm = intensity >= 2 ? 156 : intensity === 1 ? 132 : 104;
    const s16 = 60 / bpm / 4;
    while (nextTime < ctx.currentTime + 0.15) {
      const t = nextTime, chord = Math.floor(step / 16) % 4, i = step % 16;
      const root = CHORDS[chord][0] - 12;
      if (intensity === 0) {
        if (i % 4 === 0) note(t, root, s16 * 3.5, 'triangle', 0.35);
        if (i === 0) CHORDS[chord].forEach(m => note(t, m, s16 * 15, 'sine', 0.06, true, 1200));
        if (i % 2 === 0) note(t, CHORDS[chord][(i / 2) % 3] + 12, s16 * 1.6, 'triangle', 0.05, true, 3000);
      } else {
        // basso surf in ottavi
        if (i % 2 === 0) note(t, root + ((i % 8 === 6) ? 12 : 0), s16 * 1.8, 'sawtooth', 0.22, false, 700);
        if (i % 8 === 0) kick(t);
        if (intensity >= 2 && i % 4 === 2) kick(t);
        if (i % 8 === 4) hit(t, 0.16, 0.45, 'bandpass', 1800);
        if (i % 2 === 1 || intensity >= 2) hit(t, 0.04, 0.12, 'highpass', 8000);
        // arpeggio "twang"
        if (i % 2 === 0) note(t, CHORDS[chord][(i / 2) % 3] + 12, s16 * 1.5, 'square', 0.05, true, 2200);
        const m = MELODY[chord][i];
        if (m > 0 && (intensity >= 2 || (Math.floor(step / 64) % 2 === 1)))
          note(t, m, s16 * 3, 'sawtooth', 0.07, true, 3200);
      }
      nextTime += s16; step = (step + 1) % 64;
    }
  }
  function startMusic() {
    if (!ctx || playing) return;
    playing = true; nextTime = ctx.currentTime + 0.05; step = 0;
    timer = setInterval(schedule, 25);
  }
  function stopMusic() { playing = false; clearInterval(timer); }
  function setIntensity(n) { intensity = n; }

  function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.9; }
  function setMusic(on) { musicOn = on; if (musicBus) { musicBus.gain.cancelScheduledValues(0); musicBus.gain.value = on ? 0.3 : 0; } }

  return {
    init, voice, burroni, startMusic, stopMusic, setIntensity, setMuted, setMusic,
    get muted() { return muted; }, get musicOn() { return musicOn; },
    play(name, ...a) { if (ctx && !muted && sfx[name]) sfx[name](...a); }
  };
})();
