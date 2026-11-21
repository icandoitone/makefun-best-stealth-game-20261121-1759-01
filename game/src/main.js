// main.js — Lantern Thief: the game loop, screens, and rules that tie it together.
//
// Flow: title screen -> playing -> level clear -> next floor -> win screen,
// with a caught screen (press R) on the way. A level is won by taking the
// Ember Star and reaching the green EXIT. The clock gives each floor 150
// seconds; running out of time brings the watchmen down on you. A thrown
// pebble (Q or right-click) lures guards to the noise. Breaking line of
// sight lets an alarm cool down — patience is the whole game.
//
// Screenshot scenes (?scene=cover|patrol|alarm) jump straight into a staged
// moment of the real game so the screenshots show real play, not the title.

import { LEVELS, parseLevel, TILE } from './level.js';
import { Guard } from './guard.js';
import { Player, createKeyTracker } from './player.js';
import { Renderer } from './render.js';
import { SoundEngine } from './audio.js';

const LEVEL_TIME = 150;
const params = new URLSearchParams(window.location.search);
const scene = params.get('scene');

export class LanternThiefGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.sound = new SoundEngine();
    this.keys = createKeyTracker();
    this.levelIndex = 0;
    this.phase = 'title'; // title | playing | caught | levelclear | won
    this.message = '';
    this.messageTimer = 0;
    this.timeLeft = LEVEL_TIME;
    this.totalGems = 0;
    this.totalTime = 0;
    this.lastTick = performance.now();
    this.alarmedBefore = false;
    this.loadLevel(0);
    this.bindInput();
    if (scene) this.stageScene(scene);
    requestAnimationFrame((t) => this.loop(t));
  }

  loadLevel(index) {
    this.levelIndex = index;
    this.level = parseLevel(LEVELS[index]);
    this.levelName = this.level.name;
    this.player = new Player(this.level.start);
    this.guards = this.level.patrols.map((route) => new Guard(route));
    this.timeLeft = LEVEL_TIME;
    this.alarmedBefore = false;
    this.showMessage(this.level.brief);
  }

  bindInput() {
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'm') {
        this.sound.ensure();
        const muted = this.sound.toggleMute();
        this.showMessage(muted ? 'Sound off' : 'Sound on');
      }
      if (k === 'q') this.tossPebbleAtCursor();
      if (k === 'enter') {
        if (this.phase === 'title') this.startGame();
        else if (this.phase === 'levelclear') this.nextLevel();
        else if (this.phase === 'won') this.restart();
      }
      if (k === 'r') {
        if (this.phase === 'caught' || this.phase === 'won') this.restartLevel();
      }
    });
    this.canvas.addEventListener('mousedown', (e) => {
      this.sound.ensure();
      if (this.phase === 'title') {
        this.startGame();
        return;
      }
      if (this.phase === 'levelclear' || this.phase === 'won' || this.phase === 'caught') return;
      const rect = this.canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
      if (e.button === 2) this.tossPebbleAt(x, y);
      else this.player.moveTarget = { x, y };
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.cursor = {
        x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
        y: (e.clientY - rect.top) * (this.canvas.height / rect.height),
      };
    });
  }

  startGame() {
    this.sound.ensure();
    this.phase = 'playing';
    this.showMessage('Stay out of the yellow cones. Take the star, find the EXIT.');
  }

  restartLevel() {
    this.loadLevel(this.levelIndex);
    this.phase = 'playing';
  }

  restart() {
    this.totalGems = 0;
    this.totalTime = 0;
    this.loadLevel(0);
    this.phase = 'playing';
  }

  nextLevel() {
    if (this.levelIndex + 1 >= LEVELS.length) {
      this.phase = 'won';
      return;
    }
    this.loadLevel(this.levelIndex + 1);
    this.phase = 'playing';
  }

  showMessage(text, seconds = 4) {
    this.message = text;
    this.messageTimer = seconds;
  }

  tossPebbleAtCursor() {
    if (this.phase !== 'playing' || !this.cursor) return;
    this.tossPebbleAt(this.cursor.x, this.cursor.y);
  }

  tossPebbleAt(x, y) {
    const landing = this.player.throwPebble(x, y);
    if (!landing) {
      this.showMessage('No pebbles left — find a quieter way.', 2.5);
      return;
    }
    this.sound.ensure();
    this.sound.pebbleClatter();
    for (const g of this.guards) g.hearNoise(landing.x, landing.y);
    this.showMessage('The pebble clatters — a guard turns to look.', 2.5);
  }

  loop(now) {
    const dt = Math.min(0.05, (now - this.lastTick) / 1000);
    this.lastTick = now;
    this.update(dt);
    this.renderer.draw({
      level: this.level,
      player: this.player,
      guards: this.guards,
      phase: this.phase,
      levelIndex: this.levelIndex,
      levelName: this.levelName,
      message: this.message,
      timeLeft: this.timeLeft,
    });
    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.message = '';
    }
    if (this.phase !== 'playing') return;
    this.totalTime += dt;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.getCaught('Out of time — the watchmen lock the doors.');
      return;
    }

    const player = this.player;
    const onStep = (x, y, v) => this.sound.footstep(x, y, v, player);
    player.update(this.level, this.keys, dt, onStep);

    let wasSuspicious = false;
    for (const g of this.guards) {
      const before = g.state;
      g.update(this.level, player, dt, onStep);
      if (g.state === 'suspicious' && before === 'patrol') {
        wasSuspicious = true;
        this.sound.suspiciousTick();
      }
      if (g.state === 'alerted' && before !== 'alerted') {
        this.sound.alarmSting();
        this.alarmedBefore = true;
        this.showMessage('ALARM! Break line of sight and hide!', 3);
      }
      if (g.state === 'patrol' && (before === 'alerted' || before === 'returning')) {
        this.sound.allClear();
        this.showMessage('All clear… for now. They have gone back to their rounds.', 3);
      }
      if (g.catches(player)) {
        this.getCaught('A watchman grabbed your cloak.');
        return;
      }
    }
    void wasSuspicious;

    for (const gem of player.collect(this.level)) {
      this.sound.pickup(gem.big);
      if (gem.big) {
        this.showMessage('The Ember Star is yours! Now reach the green EXIT.', 4);
      } else {
        this.totalGems += 1;
        this.showMessage('A small gem — quiet money. ' + this.totalGems + ' pocketed.', 2);
      }
    }

    if (player.atExit(this.level)) {
      this.sound.levelWin();
      if (this.levelIndex + 1 >= LEVELS.length) {
        this.phase = 'won';
      } else {
        this.phase = 'levelclear';
      }
    }
  }

  getCaught(reason) {
    this.phase = 'caught';
    this.sound.caught();
    this.caughtReason = reason;
  }

  // Stage a real moment of play for screenshots: the same update loop runs,
  // only the opening positions and alarm state are set in advance.
  stageScene(name) {
    this.phase = 'playing';
    this.sound.ensure = () => {};
    const L = this.level;
    if (name === 'cover') {
      // Cover shot: the thief crouched in the shadow hedge row while a guard's
      // cone sweeps past the crates, star and exit both in frame.
      this.player.x = 3.5 * TILE;
      this.player.y = 9.5 * TILE;
      this.player.sneaking = true;
      this.guards[0].x = 6.5 * TILE;
      this.guards[0].y = 6.5 * TILE;
      this.guards[0].facing = Math.PI / 2;
      this.guards[0].state = 'patrol';
      this.guards[1].x = 17.5 * TILE;
      this.guards[1].y = 8.5 * TILE;
      this.guards[1].facing = Math.PI;
      this.showMessage('Stay out of the yellow cones. Take the star, find the EXIT.');
    } else if (name === 'patrol') {
      // Mid-patrol shot: the thief slipping between two patrol routes.
      this.player.x = 10.5 * TILE;
      this.player.y = 7.5 * TILE;
      this.player.moveTarget = { x: 12.5 * TILE, y: 10.5 * TILE };
      this.guards[0].x = 8.5 * TILE;
      this.guards[0].y = 9.5 * TILE;
      this.guards[0].facing = 0;
      this.guards[1].x = 15.5 * TILE;
      this.guards[1].y = 5.5 * TILE;
      this.guards[1].facing = Math.PI / 2;
      this.showMessage('Two patrols cross here — wait for the gap.');
    } else if (name === 'alarm') {
      // Near-miss shot: the alarm is up, a guard is closing in, the thief
      // runs for the shadow with the star already in hand.
      this.player.x = 13.5 * TILE;
      this.player.y = 10.5 * TILE;
      this.player.hasStar = true;
      // The thief is already running for the shadow pocket, so the shot
      // catches the chase mid-flight instead of a caught screen.
      this.player.moveTarget = { x: 3.5 * TILE, y: 13.5 * TILE };
      this.level.gems.forEach((g) => { if (g.big) g.taken = true; });
      const g0 = this.guards[0];
      g0.x = 12.5 * TILE;
      g0.y = 8.5 * TILE;
      g0.facing = Math.PI / 4;
      g0.state = 'alerted';
      g0.suspicion = 100;
      g0.lastSeen = { x: this.player.x, y: this.player.y };
      const g1 = this.guards[1];
      g1.x = 16.5 * TILE;
      g1.y = 12.5 * TILE;
      g1.facing = -Math.PI / 2;
      g1.state = 'suspicious';
      g1.suspicion = 62;
      this.showMessage('ALARM! Break line of sight and hide!');
    }
  }
}

// Exposed for play-testing and screenshots: window.__game holds the live game.
window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game');
  window.__game = new LanternThiefGame(canvas);
});
