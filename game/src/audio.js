// audio.js — every sound is synthesized with WebAudio: no audio files at all.
//
// Footsteps are short filtered noise bursts, the alert is a rising two-tone
// sting, pickups chime, the pebble clatters, and a low drone hums underneath
// the night. The engine starts on the first user gesture (browsers require
// it) and a mute toggle lives on the M key.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.drone = null;
    this.lastStepAt = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.startDrone();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  // A quiet low drone with a slow wobble, so the night feels alive.
  startDrone() {
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 55;
    const wob = this.ctx.createOscillator();
    wob.type = 'sine';
    wob.frequency.value = 0.07;
    const wobGain = this.ctx.createGain();
    wobGain.gain.value = 6;
    wob.connect(wobGain);
    wobGain.connect(osc.frequency);
    const g = this.ctx.createGain();
    g.gain.value = 0.045;
    osc.connect(g);
    g.connect(this.master);
    osc.start();
    wob.start();
    this.drone = osc;
  }

  // One short burst of filtered noise. Volume by distance from the listener.
  footstep(x, y, volume, listener) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    if (now - this.lastStepAt < 0.05) return;
    this.lastStepAt = now;
    const d = listener ? Math.hypot(x - listener.x, y - listener.y) : 0;
    const atten = Math.max(0.05, 1 - d / 520);
    const dur = 0.07;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 420;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(volume * atten, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.master);
    src.start(now);
  }

  // A short pitched blip: pass a frequency and length.
  blip(freq, dur, type, volume, when = 0) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(volume, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  // Suspicion rising: a soft questioning tick.
  suspiciousTick() {
    this.blip(660, 0.12, 'triangle', 0.12);
  }

  // Full alarm: two rising stabs.
  alarmSting() {
    this.blip(392, 0.16, 'square', 0.16);
    this.blip(523, 0.22, 'square', 0.16, 0.14);
  }

  // The alarm fades: a low falling note.
  allClear() {
    this.blip(330, 0.3, 'sine', 0.1);
    this.blip(220, 0.4, 'sine', 0.1, 0.12);
  }

  pickup(small) {
    if (small) {
      this.blip(880, 0.1, 'sine', 0.14);
      this.blip(1318, 0.14, 'sine', 0.12, 0.07);
    } else {
      this.blip(523, 0.12, 'sine', 0.16);
      this.blip(659, 0.12, 'sine', 0.16, 0.09);
      this.blip(784, 0.2, 'sine', 0.16, 0.18);
    }
  }

  pebbleClatter() {
    this.blip(1900, 0.05, 'square', 0.08);
    this.blip(1500, 0.05, 'square', 0.07, 0.06);
    this.blip(1200, 0.07, 'square', 0.06, 0.13);
  }

  caught() {
    this.blip(220, 0.25, 'sawtooth', 0.2);
    this.blip(174, 0.4, 'sawtooth', 0.2, 0.2);
  }

  levelWin() {
    [523, 659, 784, 1046].forEach((f, i) => this.blip(f, 0.22, 'triangle', 0.16, i * 0.11));
  }
}
