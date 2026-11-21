# Lantern Thief — The Ember Vault

[![best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/icandoitone/makefun-best-stealth-game-20261121-1759-01/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/icandoitone/makefun-best-stealth-game-20261121-1759-01/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)

A complete original top-down stealth game that plays offline in a desktop browser.
You are the thief with the little lantern, creeping through a night museum to steal
the Ember Star from each of its three floors and slip out the green EXIT door —
unseen.

## How to play

- **Goal:** pick up the red Ember Star, then reach the green **EXIT** door.
  Small gold gems are optional loot. Three floors, each with more watchmen.
- **Move:** WASD or arrow keys, or click anywhere to walk there.
- **Sneak:** hold **Shift** — slow and quiet, much harder to spot.
- **Run:** hold **Space** — fast, but loud; guards hear the noise ring.
- **Pebble:** press **Q** or right-click to toss a pebble that clatters and
  pulls the nearest guard over to investigate. You carry three per floor.
- **Guards:** each patrols a route you can learn, pausing to look around.
  Their yellow vision cones stop at walls and crates. Standing in a cone
  raises suspicion — the ring around a guard fills as he grows sure.
  At full suspicion he raises the **ALARM** and chases you.
- **Recover:** break line of sight and hide — in the dark blue shadow tiles,
  behind crates, hedges and pillars. A guard who loses you searches the spot,
  then gives up and goes back to his rounds.
- **Caught:** an alerted guard who touches you ends the floor — press **R**.
- **Timer:** each floor gives you 150 seconds before the doors lock.
- **Sound:** footsteps, alert stings and pickup chimes are synthesized live
  in the browser (WebAudio, no audio files). **M** mutes.

## How to run

No build step, no network. Serve `game/` from any static server and open
`index.html` in desktop Chrome, for example:

```sh
cd game && python3 -m http.server 8080
# open http://localhost:8080/
```

## Files

- `game/index.html` — the page; `game/styles.css` — the page around the canvas.
- `game/src/level.js` — the three museum floors, tiles, line of sight.
- `game/src/guard.js` — patrols, vision cones, suspicion and alarm.
- `game/src/player.js` — the thief: movement, sneaking, noise, pebbles.
- `game/src/render.js` — floor, cones, lantern lighting, HUD.
- `game/src/audio.js` — synthesized WebAudio sounds (no audio files).
- `game/src/main.js` — the game loop, screens and rules.
- `main.ts` — copies `game/` and `screenshots/` to the output directory
  and writes `dossier.json` with the vendored make.fun helper.
- `screenshots/` — real renders of this game running in headless Chromium.

## License

MIT — see [LICENSE](LICENSE).
