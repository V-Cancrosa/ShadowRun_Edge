/**
 * Edge Motion step 5 (11F): effects on the scene.
 *  - Blast: a shockwave over the three zones (Ground Zero, Close, Near) with debris, played on every client looking at
 *    the scene; with Sequencer and JB2A in the world, their explosion instead (Sequencer shares it by itself).
 *  - Gas: the clouds kept on the scene (scripts/gas.mjs) drift as puffs whose density follows the Gas table this round.
 *  - Convergence: a red vignette and a glitch on the hacker's open sheets, for the hacker's owners and the GM.
 * Player setting "Effects on the scene": automatic (Sequencer + JB2A when present), the module's own, or off.
 */
import { gasLevel, FRACTION } from "./gas-rules.mjs";

const MODULE_ID = "shadowrun-edge";
const SOCKET = `module.${MODULE_ID}`;
const COLORS = { gz: 0xffffff, close: 0xff5470, near: 0xe0409a, debris: 0xf0b24a, gas: 0x7fbf3f, smoke: 0x9a9aa6 };

const motionOff = () => document.body.classList.contains("sre-motion-off");
function fxMode() {
  try {
    return game.settings.get(MODULE_ID, "sceneFx");
  } catch {
    return "auto";
  }
}
const enabled = () => fxMode() !== "off" && !motionOff();

/** Sequencer + JB2A can play an explosion. */
function sequencerReady(file) {
  const seq = game.modules.get("sequencer")?.active && globalThis.Sequencer;
  if (!seq || fxMode() === "module") return false;
  try {
    return !!globalThis.Sequencer.Database?.entryExists?.(file);
  } catch {
    return false;
  }
}

/** Radii in pixels of the blast zones (1 m, 3 m, the blast radius). */
export function blastRadii(radiusMeters, pixelsPerMeter) {
  return { gz: pixelsPerMeter * 1, close: pixelsPerMeter * 3, near: pixelsPerMeter * Math.max(3, Number(radiusMeters) || 0) };
}

/** Easing for the shockwave: fast out, slow settle. */
export const easeOut = (t) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

// ───── Blast ─────

/** Called by the client that set the blast off: Sequencer when it can, else every client plays the module's effect. */
export function blast({ x, y, radius }) {
  if (!canvas?.ready) return;
  const file = "jb2a.explosion.01.orange";
  if (enabled() && sequencerReady(file)) {
    try {
      new globalThis.Sequence().effect().file(file).atLocation({ x, y }).size(radius * 2, { gridUnits: true }).play();
      return;
    } catch (err) {
      console.warn(`${MODULE_ID} | Sequencer`, err);
    }
  }
  const data = { type: "fx", fx: "blast", scene: canvas.scene.id, x, y, radius };
  game.socket.emit(SOCKET, data);
  playBlast(data);
}

function playBlast({ scene, x, y, radius }) {
  if (!enabled() || !canvas?.ready || canvas.scene?.id !== scene || !globalThis.PIXI) return;
  const ppm = canvas.dimensions.size / canvas.dimensions.distance;
  const radii = blastRadii(radius, ppm);
  const layer = new PIXI.Container();
  canvas.interface.addChild(layer);
  const rings = [["gz", 0], ["close", 0.08], ["near", 0.16]].map(([zone, delay]) => ({ g: layer.addChild(new PIXI.Graphics()), zone, delay }));
  const flash = layer.addChild(new PIXI.Graphics());
  const debris = Array.from({ length: 60 }, () => ({ a: Math.random() * Math.PI * 2, v: radii.near * (0.4 + Math.random() * 0.8), s: 2 + Math.random() * 4 }));
  const bits = layer.addChild(new PIXI.Graphics());
  const start = performance.now();
  const duration = 1300;
  const tick = () => {
    const t = (performance.now() - start) / duration;
    if (t >= 1) {
      canvas.app.ticker.remove(tick);
      layer.destroy({ children: true });
      return;
    }
    for (const r of rings) {
      const p = easeOut((t - r.delay) / 0.45);
      r.g.clear();
      if (p <= 0) continue;
      const fade = 1 - Math.max(0, (t - 0.5) / 0.5);
      r.g.beginFill(COLORS[r.zone], 0.22 * fade).lineStyle(3, COLORS[r.zone], 0.9 * fade * (1 - p * 0.5)).drawCircle(x, y, radii[r.zone] * (0.35 + 0.65 * p)).endFill();
    }
    flash.clear();
    if (t < 0.12) flash.beginFill(0xffffff, 0.5 * (1 - t / 0.12)).drawCircle(x, y, radii.near * 1.2).endFill();
    bits.clear();
    for (const d of debris) {
      const dist = d.v * easeOut(t / 0.7);
      bits.beginFill(COLORS.debris, Math.max(0, 1 - t)).drawRect(x + Math.cos(d.a) * dist, y + Math.sin(d.a) * dist, d.s, d.s).endFill();
    }
  };
  canvas.app.ticker.add(tick);
}

// ───── Gas clouds ─────

const cloudLayers = new Map(); // cloud id → { layer, tick }

function clearClouds() {
  for (const { layer, tick } of cloudLayers.values()) {
    canvas.app?.ticker.remove(tick);
    layer.destroy({ children: true });
  }
  cloudLayers.clear();
}

/** Puffs per zone (Range, × 2, × 3, × 4) whose opacity follows the cloud's level this round. */
export function puffAlpha(zone, round, condition) {
  return 0.16 * (FRACTION[gasLevel(zone, round, condition)] ?? 0);
}

function drawClouds() {
  if (!canvas?.ready || !globalThis.PIXI) return;
  clearClouds();
  if (!enabled()) return;
  const ppm = canvas.dimensions.size / canvas.dimensions.distance;
  for (const cloud of canvas.scene.getFlag(MODULE_ID, "gasClouds") ?? []) {
    const layer = new PIXI.Container();
    canvas.interface.addChild(layer);
    const color = cloud.kind === "smoke" ? COLORS.smoke : COLORS.gas;
    const puffs = [];
    for (let zone = 3; zone >= 0; zone--) {
      const alpha = puffAlpha(zone, Math.max(1, cloud.round), cloud.condition);
      if (!alpha) continue;
      const r = cloud.range * ppm * (zone + 1);
      for (let i = 0; i < 10 + zone * 4; i++) {
        const g = layer.addChild(new PIXI.Graphics());
        g.beginFill(color, alpha).drawCircle(0, 0, ppm * (1.2 + zone * 0.5) * (0.7 + Math.random() * 0.6)).endFill();
        puffs.push({ g, a: Math.random() * Math.PI * 2, d: r * (0.25 + Math.random() * 0.75), spin: (Math.random() - 0.5) * 0.15 });
      }
    }
    if (PIXI.BlurFilter) layer.filters = [new PIXI.BlurFilter(8)];
    const start = performance.now();
    const tick = () => {
      const s = (performance.now() - start) / 1000;
      for (const p of puffs) {
        const a = p.a + s * p.spin;
        p.g.position.set(cloud.x + Math.cos(a) * p.d, cloud.y + Math.sin(a) * p.d + Math.sin(s + p.a) * ppm * 0.3);
      }
    };
    tick();
    if (document.body.classList.contains("sre-motion-full")) canvas.app.ticker.add(tick);
    cloudLayers.set(cloud.id, { layer, tick });
  }
}

Hooks.on("canvasReady", () => drawClouds());
Hooks.on("canvasTearDown", () => clearClouds());
Hooks.on("updateScene", (scene, changed) => {
  if (scene.id === canvas?.scene?.id && foundry.utils.hasProperty(changed, `flags.${MODULE_ID}`)) drawClouds();
});

// ───── Convergence ─────

/** The GM executed Convergence on this persona: everyone who owns it (and the GM) sees it. */
export function convergence(actor) {
  const data = { type: "fx", fx: "convergence", actor: actor.uuid };
  game.socket.emit(SOCKET, data);
  playConvergence(data);
}

function playConvergence({ actor: uuid }) {
  if (motionOff()) return;
  const actor = fromUuidSync(uuid);
  if (!actor || !(actor.isOwner || game.user.isGM)) return;
  document.querySelector(".sre-convergence")?.remove();
  const v = document.createElement("div");
  v.className = "sre-convergence";
  document.body.append(v);
  setTimeout(() => v.remove(), 1600);
  for (const app of foundry.applications.instances?.values?.() ?? []) {
    if (app.document?.uuid === uuid && app.element?.classList.contains("sre-sheet")) {
      app.element.classList.remove("sre-fx-converge");
      void app.element.offsetWidth;
      app.element.classList.add("sre-fx-converge");
      setTimeout(() => app.element?.classList.remove("sre-fx-converge"), 1200);
    }
  }
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "sceneFx", {
    name: "SRE.Motion.SceneFx.Name", hint: "SRE.Motion.SceneFx.Hint", scope: "client", config: true, type: String,
    choices: { auto: "SRE.Motion.SceneFx.auto", module: "SRE.Motion.SceneFx.module", off: "SRE.Motion.SceneFx.off" },
    default: "auto", onChange: () => drawClouds(),
  });
});

Hooks.once("ready", () => {
  game.socket.on(SOCKET, (data) => {
    if (data?.type !== "fx") return;
    if (data.fx === "blast") playBlast(data);
    if (data.fx === "convergence") playConvergence(data);
  });
});
