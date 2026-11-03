// Module tests rolled through the system dialog (scripts/linked-roll.mjs): the roll's chat message gets the
// task, typed-in hits post a module message, and results follow the message's current hits (Edge after the
// roll). Run: node tools/test_tasks.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// ── Minimal Foundry ──
const hooks = new Map();
let nextHook = 1;
globalThis.Hooks = {
  on(name, fn) {
    const id = nextHook++;
    if (!hooks.has(name)) hooks.set(name, new Map());
    hooks.get(name).set(id, fn);
    return id;
  },
  once(name, fn) {
    return this.on(name, fn);
  },
  off(name, id) {
    hooks.get(name)?.delete(id);
  },
  callAll(name, ...args) {
    for (const fn of [...(hooks.get(name)?.values() ?? [])]) fn(...args);
  },
};
const lang = JSON.parse(readFileSync(new URL("../lang/pl/shadowrun-edge.json", import.meta.url), "utf8"));
const lookup = (key) => key.split(".").reduce((o, k) => o?.[k], lang) ?? key;
const escapeHTML = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// The system's roll classes, as a module the system-rolls wrapper imports.
const rollTypes = "data:text/javascript," + encodeURIComponent(`
  export const RollType = { Common: "common", Soak: "soak" };
  export class PreparedRoll {}
  export class SoakRoll { constructor(threshold, soakType) { this.threshold = threshold; this.soakType = soakType; } }`);
globalThis.foundry = { utils: { escapeHTML, getRoute: () => rollTypes, isNewerVersion: () => true } };
const created = [];
class Message {
  constructor(data) {
    Object.assign(this, { flags: {}, rolls: [], author: { id: "u1" }, isOwner: true, id: `m${created.length + 1}` }, data);
  }
  getFlag(scope, key) {
    return this.flags[scope]?.[key];
  }
  async setFlag(scope, key, value) {
    (this.flags[scope] ??= {})[key] = value;
  }
}
globalThis.ChatMessage = {
  getSpeaker: ({ actor }) => ({ actor: actor?.id }),
  create: async (data) => {
    const message = new Message(data);
    created.push(message);
    return message;
  },
};
globalThis.game = {
  user: { id: "u1", isGM: false },
  users: { activeGM: null, get: () => null },
  i18n: { localize: lookup, format: (key, data) => lookup(key).replace(/\{(\w+)\}/g, (_, k) => data?.[k] ?? "") },
  settings: { get: (module, key) => key !== "playersBreakRules" },
  socket: { on() {}, emit() {} },
  actors: { get: () => null, filter: () => [] },
};
globalThis.ui = { notifications: { warn() {}, info() {}, error() {} } };

const { systemTest, runTest, hitsOf, registerTask } = await import("../scripts/linked-roll.mjs");

// ── A roll through the system dialog: its message carries the task ──
const actor = {
  id: "a1",
  async rollCommonCheck(roll) {
    this.lastRoll = roll;
    const message = new Message({ speaker: { actor: "a1" }, rolls: [{ total: 3 }] });
    Hooks.callAll("createChatMessage", message);
    this.lastMessage = message;
    return { total: 3 };
  },
};
const message = await systemTest(actor, { pool: 9, label: "Test", threshold: 2, useWoundModifier: false, task: { kind: "x", n: 1 } });
assert.equal(message, actor.lastMessage, "the roll's own message");
assert.deepEqual(message.getFlag("shadowrun-edge", "task"), { kind: "x", n: 1 });
assert.equal(actor.lastRoll.pool, 9);
assert.equal(actor.lastRoll.threshold, 2);
assert.equal(actor.lastRoll.useWoundModifier, false, "the rule decides the wound box");
assert.equal(hitsOf(message), 3);
message.rolls = [{ total: 5 }]; // Edge after the roll updates the same message
assert.equal(hitsOf(message), 5);
assert.equal(hooks.get("createChatMessage")?.size ?? 0, 0, "no capture hook left behind");

// Cancelled dialog: nothing, and no hook left.
const cancel = { id: "a1", rollCommonCheck: async () => null };
assert.equal(await systemTest(cancel, { pool: 3, label: "x", task: {} }), null);
assert.equal(hooks.get("createChatMessage")?.size ?? 0, 0);

// Typed-in hits: a module message with the same task.
const manual = await runTest(actor, { pool: 9, label: "Ręcznie", manualHits: 4, task: { kind: "x" } });
assert.equal(hitsOf(manual), 4);
assert.equal(manual.getFlag("shadowrun-edge", "task").kind, "x");

// The task block renders from the current hits.
registerTask("echo", { render: (task, hits) => `<b>${hits}</b>` });
const rendered = new Message({ rolls: [{ total: 2 }], flags: { "shadowrun-edge": { task: { kind: "echo" } } } });
/** A rendered chat message's root: the task block is appended to its .message-content. */
function fakeRoot() {
  const root = { appended: [], querySelectorAll: () => [] };
  root.querySelector = (sel) => (sel === ".message-content" ? { querySelector: () => null, append: (el) => root.appended.push(el) } : null);
  return root;
}
const html = fakeRoot();
globalThis.HTMLElement = class {};
globalThis.document = { createElement: () => ({ className: "", innerHTML: "", querySelector: () => null, querySelectorAll: () => [] }) };
Hooks.callAll("renderChatMessageHTML", rendered, [html]);
assert.equal(html.appended[0]?.innerHTML, "<b>2</b>");

// ── Handlers of the module's tests ──
globalThis.CONFIG = { SR6: {} };
globalThis.canvas = { ready: false };
await import("../scripts/healing.mjs");
await import("../scripts/summoning.mjs");
await import("../scripts/blast.mjs");
await import("../scripts/substances.mjs");
const renderTask = (task, hits) => {
  const m = new Message({ rolls: [{ total: hits }], flags: { "shadowrun-edge": { task } } });
  const out = fakeRoot();
  Hooks.callAll("renderChatMessageHTML", m, [out]);
  return out.appended[0]?.innerHTML ?? "";
};

// Healing: first aid, threshold 1, 3 hits → 2 net → 2 Stun (prefers Stun here); 5 hits after Edge → more.
const heal = { kind: "heal", targetName: "Kasia", healer: "Doc", method: "firstAid", pool: 6, threshold: 1, autoHit: 0,
  damage: { stun: 4, physical: 0, overflow: 0 }, drainBoxes: 0, prefer: "stun", applied: false };
assert.match(renderTask(heal, 3), /ogłuszenie −2/);
assert.match(renderTask(heal, 5), /ogłuszenie −4/);
assert.match(renderTask({ ...heal, applied: true }, 3), /disabled/);

// Summoning: 3 hits vs spirit 1 → 2 services; with 1 hit vs 1 → failure, no create button.
const summon = { kind: "summon", typeLabel: "Ziemi", force: 3, magic: 6, spiritHits: 1, created: false };
assert.match(renderTask(summon, 3), /2 usług/);
assert.match(renderTask(summon, 3), /sre-task-apply/);
assert.doesNotMatch(renderTask(summon, 1), /sre-task-apply/, "a player may not summon after a failure");
game.user.isGM = true;
assert.match(renderTask(summon, 1), /data-anyway="1"/, "the GM may summon anyway");
game.user.isGM = false;

// Banishing: 4 hits vs spirit 1 → 3 net, 2 services → the spirit departs.
const banish = { kind: "banish", targetName: "Duch", force: 3, services: 2, spiritHits: 1, magic: 6, finalDrain: true, applied: false };
assert.match(renderTask(banish, 4), new RegExp(lookup("SRE.Summon.Departs").slice(0, 12)));

// Grenade: the explode button until it went off.
const blast = { kind: "blast", item: "Granat", pool: 8, range: "near", launched: false, ar: 7, exploded: false };
assert.match(renderTask(blast, 2), /sre-task-apply"/);
assert.match(renderTask({ ...blast, exploded: true }, 2), /disabled/);
assert.match(renderTask(blast, 2), /sre-blast-avoid/, "Avoid Incoming until the blast");
assert.doesNotMatch(renderTask({ ...blast, exploded: true }, 2), /sre-blast-avoid/);
assert.match(renderTask({ ...blast, avoiders: [{ name: "Oda" }], edge: { highest: 6, gain: 1 } }, 2), /Oda/);
assert.match(renderTask({ ...blast, edge: { highest: 6, gain: 1 } }, 2), /\+1 Edge/);

// Toxin Resistance: Narcoject 15, 6 hits → 9 Stun; after Edge (10 hits) → 5; fully resisted → no effect.
const toxin = { kind: "toxin", id: "narcoject", power: 15, applied: false };
assert.match(renderTask(toxin, 6), /9S/);
assert.match(renderTask(toxin, 10), /5S/);
assert.match(renderTask(toxin, 15), new RegExp(lookup("SRE.Substance.NoEffect").slice(0, 10)));
assert.match(renderTask({ kind: "antidote", id: "narcoject", power: 4, applied: false }, 4), /sre-task-apply/, "Power 0: end the effects");

// Matrix: OS for the GM (defender hits + program), access to record, Data Spike, IC hits.
game.time = { worldTime: 0 };
foundry.utils.getProperty = (o, p) => p.split(".").reduce((a, k) => a?.[k], o);
const persona = { system: { overwatch: 30 }, items: { get: () => null } };
globalThis.fromUuidSync = () => persona;
await import("../scripts/matrix.mjs");
const brute = { kind: "matrix", actionId: "brute_force", actor: "Actor.g", illegal: true, opposed: true, program: true, radar: false,
  target: { key: "k", name: "Host", kind: "host", rating: 4, access: "outsider" }, want: "admin", ar: 9, defensePool: 8, defenderHits: null };
assert.match(renderTask(brute, 4), /data-def-hits/, "the defender's hits first");
game.user.isGM = true;
const after = renderTask({ ...brute, defenderHits: 2 }, 4);
assert.match(after, /data-os="3"/, "2 defender hits + 1 program");
assert.match(after, /→ 33 \/ 40/);
assert.match(after, /data-grant/, "Admin to record after a win");
assert.doesNotMatch(renderTask({ ...brute, defenderHits: 5 }, 4), /data-grant/, "no access after a loss");
assert.match(renderTask({ ...brute, actionId: "data_spike", defenderHits: 1 }, 4), /data-soak="8"/, "[9/2] + 3 net");
game.user.isGM = false;
assert.doesNotMatch(renderTask({ ...brute, defenderHits: 2 }, 4), /data-os/, "players do not see the OS amount");
assert.match(renderTask({ ...brute, defenderHits: 2 }, 4), /\+3/, "with the OS shown to players: the amount, no button");
const settingsGet = game.settings.get;
game.settings.get = () => false;
assert.match(renderTask({ ...brute, defenderHits: 2 }, 4), new RegExp(lookup("SRE.Matrix.OSByGM").slice(0, 10)), "hidden OS: the GM adds it");
game.settings.get = settingsGet;
assert.match(renderTask({ kind: "matrixSoak", actor: "Actor.g", deviceId: null, dv: 8 }, 3), /<b>5<\/b>/);
game.user.isGM = true;
assert.match(renderTask({ kind: "icAttack", ic: "sparky", rating: 4, target: "Actor.g", defensePool: 9, defenderHits: 1 }, 3), /data-bio="6"/, "Sparky: rating + net");
assert.match(renderTask({ kind: "icAttack", ic: "tarbaby", rating: 4, target: "Actor.g", defensePool: 9, defenderHits: 0 }, 2), /data-lock/);
game.user.isGM = false;

// Vehicles: Handling failure → crash test; crash → DV from speed; ramming damage both ways.
await import("../scripts/vehicles.mjs");
const handling = { kind: "handling", vehicle: "Actor.v", threshold: 4, mod: 0, crash: false, speed: 28 };
assert.match(renderTask(handling, 4), new RegExp(lookup("SRE.Vehicle.Success").slice(0, 8)));
assert.match(renderTask(handling, 2), /data-crash/);
game.user.isGM = true;
assert.match(renderTask({ ...handling, crash: true, safety: 1 }, 2), /<b data-dv>1<\/b>/, "28 / 10 = 2, − 1 safety");
const ram = { kind: "ram", vehicle: "Actor.v", name: "Americar", target: "Actor.t", targetName: "Bulldog", damage: 7, back: 8, otherHits: 1 };
assert.match(renderTask(ram, 3), /data-hit="7"/);
assert.match(renderTask(ram, 3), /data-back="8"/);
assert.doesNotMatch(renderTask({ ...ram, otherHits: 3 }, 3), /data-hit/, "a tie misses");
assert.match(renderTask({ ...ram, otherHits: null }, 3), /data-other/);
game.user.isGM = false;

// Spray: per target, defense first, then damage with the style; demolitions: the charge's numbers.
await import("../scripts/gas.mjs");
const spray = { kind: "spray", item: "Flamethrower", style: "sweeping", fast: false, ar: 13, dv: 3, stun: false, targets: [{ token: "T.1", name: "Carson", def: null }, { token: "T.2", name: "Westwind", def: 0 }] };
const sprayHtml = renderTask(spray, 5);
assert.match(sprayHtml, /data-def="0"/);
assert.match(sprayHtml, /data-dv="5"/, "3 − 3 + 5 net");
const demo = { kind: "demolition", actor: "Actor.a", item: "i", name: "Fragmentation grenade", charge: "grenade", target: "personnel", blast: { gz: 16, close: 12, near: 8, stun: false, radius: 20 }, rating: 0, split: { gz: 0, close: 1, near: 0 } };
assert.match(renderTask(demo, 4), /DV 17 \/ 13 \/ 8/);
const structure = renderTask({ ...demo, target: "structure" }, 4);
assert.match(structure, /14/, "Close 12 + 2 hits above the threshold");
assert.doesNotMatch(structure, /data-detonate/, "structure damage is the GM's");

console.log("tasks OK");
