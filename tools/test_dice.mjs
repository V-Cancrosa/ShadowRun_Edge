// The Edge dice engine's rules (scripts/dice/dice-rules.mjs), outside Foundry. Run: node tools/test_dice.mjs
import assert from "node:assert/strict";

const R = await import("../scripts/dice/dice-rules.mjs");
const D = (...v) => v.map((x) => (typeof x === "object" ? x : { v: x }));

// Hits are 5s and 6s; glitch = more than half 1s; critical = glitch without hits (pp. 35, 44).
let r = R.evaluate(D(5, 6, 3, 1));
assert.equal(r.hits, 2);
assert.equal(r.glitch, false);
r = R.evaluate(D(1, 1, 1, 5));
assert.equal(r.glitch, true, "3 of 4 are 1s");
assert.equal(r.critical, false, "a hit: glitch, not critical");
r = R.evaluate(D(1, 1, 2, 3));
assert.equal(r.glitch, false, "exactly half is not a glitch");
r = R.evaluate(D(1, 1, 1, 3));
assert.equal(r.critical, true);

// Threshold: meet or beat; net hits above it (p. 36).
r = R.evaluate(D(5, 6, 6, 2), { threshold: 3 });
assert.equal(r.success, true);
assert.equal(r.net, 0);
assert.equal(R.evaluate(D(5, 2), { threshold: 2 }).success, false);
assert.equal(R.evaluate(D(2, 3)).success, false, "no threshold: needs a hit");

// Wild die (p. 48–49): 5/6 = 3 hits; 1 cancels all the 5s.
assert.equal(R.evaluate(D({ v: 6, wild: true }, 5, 2)).hits, 4);
assert.equal(R.evaluate(D({ v: 1, wild: true }, 5, 5, 6)).hits, 1, "wild 1: the 5s are cancelled, the 6 stays");
assert.equal(R.evaluate(D({ v: 3, wild: true }, 5)).hits, 1, "wild 2–4 means nothing");

// Exploding dice don't count toward glitches (p. 47: "a 1 rolled after a 6 does not count").
r = R.evaluate(D(6, 1, { v: 1, exploded: true }, { v: 1, exploded: true }));
assert.equal(r.glitch, false, "only the 2 original dice count: one 1 of 2 is not more than half");
let seq = [0.99, 0.99, 0.1]; // 6, 6, 1
const rng = () => seq.shift() ?? 0.5;
const dice = R.explodeDice([{ v: 6 }], rng);
assert.equal(dice.length, 4, "6 → 6 → 6 → 1: three extra dice");
assert.ok(dice.slice(1).every((d) => d.exploded));

// Count 2s as glitches for the target (5 Edge).
assert.equal(R.evaluate(D(2, 2, 1, 5), { twos: true }).glitch, true);
assert.equal(R.evaluate(D(2, 2, 1, 5)).glitch, false);

// Bought hits (p. 36): one per four dice, rounded down.
assert.equal(R.boughtHits(11), 2);
assert.equal(R.boughtHits(3), 0);

// Automatic hit (3 Edge) adds to the total.
assert.equal(R.evaluate(D(2, 3), { autoHits: 1 }).hits, 1);

// Opposed (ties to the attacker, February 2020 errata p. 105).
assert.deepEqual(R.opposed(3, 3), { wins: true, net: 0 });
assert.equal(R.opposed(3, 3, { tiesToAttacker: false }).wins, false);
assert.equal(R.opposed(0, 0).wins, false, "the attacker needs at least one hit");

// Teamwork and extended tests (p. 36).
assert.equal(R.teamworkDice([2, 3], 4), 4, "capped by the leader's skill rank");
assert.equal(R.extendedPool(10, 3), 8);
assert.equal(R.retryPenalty(2), -4);

// Edge from Attack Rating vs Defense Rating (p. 45); none while attacking from cover (errata p. 52).
assert.deepEqual(R.edgeFromRatings(8, 4), { attacker: 1, defender: 0 });
assert.deepEqual(R.edgeFromRatings(4, 10), { attacker: 0, defender: 1 });
assert.deepEqual(R.edgeFromRatings(7, 4), { attacker: 0, defender: 0 });
assert.equal(R.edgeFromRatings(9, 4, { attackerInCover: true }).attacker, 0);

// Gaining Edge: two per combat round at most, never above 7 (p. 45).
assert.equal(R.gainable(1, { current: 6, gainedRound: 0 }), 1);
assert.equal(R.gainable(1, { current: 7 }), 0);
assert.equal(R.gainable(1, { current: 2, gainedRound: 2 }), 0);
assert.equal(R.gainable(1, { current: 2, gainedRound: 2, inCombat: false }), 1);

// Boosts and actions (pp. 46–48); costs never 0 (errata).
assert.equal(R.costOf(R.BOOSTS.find((b) => b.id === "reroll_one"), 3), 3, "reroll multiplied");
assert.equal(R.costOf({ cost: 0 }), 1);
const ids = (ctx) => R.edgeActionsFor(ctx).map((a) => a.id);
assert.ok(ids(["melee"]).includes("knockout_blow") && ids(["melee"]).includes("vitals"));
assert.ok(!ids(["ranged"]).includes("shank"));
assert.ok(ids(["ranged", "multi"]).includes("anticipation"));
assert.ok(ids(["influence"]).includes("big_speech"));
assert.deepEqual(ids([]), ["sudden_insight"]);
assert.equal(R.EDGE_ACTIONS.find((a) => a.id === "knockout_blow").cost, 2, "errata: Knockout Blow in the 2 Edge list");

// Post-roll boosts.
const before = D(4, 2, 6);
assert.equal(R.applyPost(before, "plus_1_die", { index: [0] })[0].v, 5, "+1 makes a 4 a 5");
assert.equal(R.applyPost(before, "plus_1_die", { index: [2] })[2].v, 6, "a 6 stays 6");
const rr = R.applyPost(before, "reroll_failed", { rng: () => 0.99 });
assert.deepEqual(rr.map((d) => d.v), [6, 6, 6]);
assert.equal(R.postBlocked("reroll_failed", { glitch: true }), "glitch");
assert.equal(R.postBlocked("reroll_one", {}, { buy: true }), "bought");
assert.equal(R.postBlocked("reroll_one", { glitch: true }), null);

// Smackdown: automatic success with four net hits.
assert.deepEqual(R.smackdown(3), { hits: 7, net: 4, success: true, glitch: false, critical: false });

// Rolling: the wild die is the first of the pool.
const rolled = R.rollDice(5, { wild: true, rng: () => 0.5 });
assert.equal(rolled.length, 5);
assert.equal(rolled.filter((d) => d.wild).length, 1);

// Display order: hits first.
assert.deepEqual(R.displayOrder(D(1, 5, 3, 6)).map((d) => d.v), [6, 5, 3, 1]);

console.log("dice rules OK");

// ───── The engine's pure parts (scripts/dice/edge-roll.mjs) with Foundry stubbed ─────
globalThis.Hooks = { once() {}, on() {}, callAll() {} };
globalThis.game = { i18n: { localize: (k) => k, format: (k, d) => `${k}${JSON.stringify(d)}` }, settings: { get: () => "edge" }, user: { isGM: true } };
globalThis.foundry = { utils: { escapeHTML: (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]) } };
const E = await import("../scripts/dice/edge-roll.mjs");

// Fire modes as the system's weapon dialog: SA −2 AR +1 DV 2 rounds, BF −4/+2/4, wide BF −2/+1/4, FA −6, −2 per extra target.
const atk = { ar: [9, 7, 5, 0, 0], dv: 4, ranged: true, modes: { SS: true, SA: true, BF: true, FA: true }, arMods: {} };
assert.deepEqual(E.fireMode(atk, "SS"), { ar: [9, 7, 5, 0, 0], dv: 4, rounds: 1, arMod: 0 });
assert.deepEqual(E.fireMode(atk, "SA"), { ar: [7, 5, 3, 0, 0], dv: 5, rounds: 2, arMod: -2 });
assert.deepEqual(E.fireMode(atk, "BF").dv, 6);
assert.equal(E.fireMode(atk, "BFW").arMod, -2);
assert.equal(E.fireMode(atk, "FA", 3).arMod, -10);
assert.equal(E.fireMode(atk, "FA").rounds, 10);
assert.deepEqual(E.modesOf(atk), ["SS", "SA", "BF", "BFW", "FA"]);
assert.deepEqual(E.modesOf({ ranged: true, modes: { SA: true } }), ["SA"]);
assert.deepEqual(E.modesOf({ ranged: false }), []);

// Drain and fading land on Stun unless higher than Magic / Resonance (pp. 131, 191).
assert.equal(E.soakMonitor({ soak: { kind: "drain", limit: 5 } }, 5), "stun");
assert.equal(E.soakMonitor({ soak: { kind: "drain", limit: 5 } }, 6), "physical");
assert.equal(E.soakMonitor({ soak: { kind: "fading", limit: 3 } }, 4), "physical");
assert.equal(E.soakMonitor({ soak: { kind: "damage", monitor: "stun" } }, 9), "stun");

// Result of a stored roll: bought, smackdown, dice.
assert.equal(E.resultOf({ buy: true, pool: 9, threshold: 2 }).hits, 2);
assert.equal(E.resultOf({ edge: { burn: "smackdown" }, threshold: 2 }).net, 4);
assert.equal(E.resultOf({ dice: D(5, 6, 1), threshold: 0, autoHits: 1 }).hits, 3);

// The card renders hits, the stamp, the soak line and the Edge menu.
const card = E.cardHtml({ kind: "soak", label: "Body", pool: 6, basePool: 6, mods: {}, dice: D(5, 6, 2, 3, 1, 4), edge: { post: [] }, soak: { dv: 7, kind: "damage", monitor: "physical" }, targets: [] });
assert.ok(card.includes("sre-stamp-success"));
assert.ok(card.includes('data-sre-roll="apply"'));
assert.ok(card.includes('data-sre-roll="reroll_one"'));
const spent = E.cardHtml({ kind: "skill", label: "x", pool: 2, basePool: 2, mods: {}, dice: D(1, 1), edge: { pre: "add_edge", spent: 4, post: [] }, targets: [] });
assert.ok(spent.includes("sre-stamp-critical"));
assert.ok(!spent.includes('data-sre-roll="open"'), "one expenditure per action: no Edge after a pre-roll boost");

console.log("dice engine OK");

// ───── 13C: the combat chain and Initiative ─────
const C = await import("../scripts/dice/combat-chain.mjs");
const weapon = { kind: "weapon", attack: { ar: 9, dv: 5, stun: false, effects: [] } };
let ch = C.chainOf(weapon);
assert.equal(ch.defense, "physical");
assert.deepEqual(C.outcome(ch, 4, 2), { hit: true, net: 2, dv: 7, resist: true, monitor: "physical" }, "DV + net hits");
assert.equal(C.outcome(ch, 3, 3).hit, true, "a tie goes to the attacker (errata p. 105)");
assert.equal(C.outcome(ch, 3, 3, { tiesToAttacker: false }).hit, false);
assert.equal(C.outcome(ch, 2, 4).hit, false);
assert.equal(C.outcome(C.chainOf({ ...weapon, attack: { ...weapon.attack, effects: ["disarm"] } }), 4, 1).disarm, true);
// Direct Combat spell: net hits + Amp Up, not resisted; indirect: Magic/2 up + net + Amp Up, resisted (p. 132).
ch = C.chainOf({ kind: "spell", spell: { combat: true, indirect: false, ampUp: 1, magic: 6 } });
assert.equal(ch.defense, "spells_direct");
assert.deepEqual(C.outcome(ch, 5, 3), { hit: true, net: 2, dv: 3, resist: false, monitor: "physical" });
ch = C.chainOf({ kind: "spell", spell: { combat: true, indirect: true, ampUp: 0, magic: 5, damage: "physical" } });
assert.equal(C.outcome(ch, 5, 3).dv, 5, "Cass: Magic 6 → 3 + 2 net = 5 in the book; Magic 5 → 3 + 2");
assert.equal(C.chainOf({ kind: "spell", spell: { combat: false } }), null);
assert.deepEqual(C.afterDamage(["knockout_blow"], 5, { wil: 4 }), ["knockout"]);
assert.deepEqual(C.afterDamage(["knockout_blow"], 4, { wil: 4 }), [], "greater than Willpower");
assert.deepEqual(C.afterDamage(["tumble"], 4, { bod: 3 }), ["prone"]);

const I = await import("../scripts/dice/initiative.mjs");
assert.equal(I.initiativeScore(9, [3, 4]), 16);
assert.equal(I.initiativeScore(9, [3, 4], { mod: -2, boosts: 1 }), 17);
assert.equal(R.initiativeDice(7), 5, "never more than 5D6");

console.log("combat chain OK");

// ───── 13D: the Garage ─────
globalThis.foundry.utils.deepClone = (o) => JSON.parse(JSON.stringify(o));
const G = await import("../scripts/garage.mjs");
const scoot = { type: "gear", name: "Dodge Scoot", img: "s.webp", uuid: "Actor.a.Item.s", system: { type: "VEHICLES", subtype: "BIKES", handlOn: 3, handlOff: 5, accOn: 10, accOff: 10, spdiOn: 15, spdiOff: 10, tspd: 50, bod: 4, arm: 4, pil: 1, sen: 1, sea: 1 } };
assert.equal(G.isVehicleItem(scoot), true);
assert.equal(G.isVehicleItem({ type: "gear", system: { type: "WEAPON_FIREARMS" } }), false);
const vd = G.vehicleData(scoot, { id: "a", ownership: { default: 0, u1: 3 } });
assert.equal(vd.type, "Vehicle");
assert.equal(vd.system.handlOff, 5);
assert.equal(vd.system.vehicle.belongs, "a", "the character is the owner and driver");
assert.equal(vd.system.vehicle.opMode, "manual");
assert.equal(vd.system.vtype, "ground_craft");
assert.deepEqual(vd.ownership, { default: 0, u1: 3 }, "the same players own it");
assert.equal(vd.flags["shadowrun-edge"].fromItem, "Actor.a.Item.s");
assert.equal(G.vehicleData({ ...scoot, system: { ...scoot.system, type: "DRONES" } }, null).system.vehicle.opMode, "rcc");
assert.deepEqual(G.syncChanges(scoot, { name: "Dodge Scoot", system: { ...vd.system } }), {});
assert.deepEqual(G.syncChanges({ ...scoot, system: { ...scoot.system, arm: 6 } }, { name: "Dodge Scoot", system: { ...vd.system } }), { "system.arm": 6 });
console.log("garage OK");

// ───── 13F: the system's optional rules and hotbar macros ─────
assert.equal(R.capPool(26), 20, "hard dice cap");
assert.equal(R.capPool(26, false), 26);
assert.equal(R.recoilReduction(6), 0);
assert.equal(R.recoilReduction(7), 1);
assert.equal(R.recoilReduction(10), 2);
assert.deepEqual(E.fireMode({ ...atk, recoil: 2 }, "BF").arMod, -2, "BF −4 lessened by 2");
assert.deepEqual(E.fireMode({ ...atk, recoil: 2 }, "SA").arMod, 0, "never into a bonus");
assert.equal(R.bulletThreshold(13, 2), 4, "13/6 → 2, + Medium (2)");
assert.deepEqual(R.armorSplit(5, 17), { physical: 3, stun: 2 });
assert.deepEqual(R.armorSplit(1, 9), { physical: 0, stun: 1 });
ch = C.chainOf({ kind: "weapon", attack: { ar: 9, dv: 5, effects: [], bullets: true } });
assert.equal(ch.bullets, true);
assert.deepEqual(C.bulletOutcome(ch, { success: true, net: 2 }), { hit: true, net: 2, dv: 7, resist: true, monitor: "physical" });
assert.equal(C.bulletOutcome(ch, { success: false }).hit, false);

const M = await import("../scripts/dice/macros.mjs");
assert.equal(M.rollableItem({ type: "gear", system: { type: "WEAPON_FIREARMS" } }), true);
assert.equal(M.rollableItem({ type: "spell" }), true);
assert.equal(M.rollableItem({ type: "gear", system: { type: "ARMOR" } }), false);
const mac = M.macroFor({ actor: "Actor.a", kind: "skill", id: "firearms", spec: "pistols" }, { name: "Pistols" });
assert.equal(mac.type, "script");
assert.match(mac.command, /api\.roll\(\{"actor":"Actor\.a","kind":"skill","id":"firearms","spec":"pistols"\}\);$/);
console.log("house rules and macros OK");
