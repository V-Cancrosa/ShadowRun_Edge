// Action tracker and opposed defenses, outside Foundry. Run: node tools/test_rules.mjs
import assert from "node:assert/strict";

globalThis.Hooks = { once() {}, on() {} };
const { actionTotals, actionsLeft } = await import("../scripts/actions.mjs");
const { defenseAttributes, defensePool, DEFAULT_SPELL_DEFENSE } = await import("../scripts/opposed.mjs");

// SR6: 1 Major + 1 Minor, +1 Minor per initiative die of the initiative in use.
const actor = { system: { initiative: { physical: { dicePool: 2 }, matrix: { dicePool: 4 } } } };
assert.deepEqual(actionTotals({ actor, flags: {} }), { major: 1, minor: 3 });
assert.deepEqual(actionTotals({ actor, flags: { "shadowrun6-eden": { iniType: "matrix" } } }), { major: 1, minor: 5 }, "hot-sim matrix initiative");
const left = actionsLeft({ actor, flags: { "shadowrun-edge": { actions: { major: 1, minor: 2 } } } });
assert.equal(left.major.left, 0);
assert.equal(left.minor.left, 1);
assert.equal(actionsLeft({ actor: null, flags: {} }).minor.total, 1, "no actor: base actions");

// Complex forms use the system's own opposed attributes; non-combat opposed spells the module flag or Body + Willpower.
assert.deepEqual(defenseAttributes({ type: "complexform", system: { oppAttr1: "wil", oppAttr2: "f" } }), ["wil", "f"]);
assert.equal(defenseAttributes({ type: "complexform", system: {} }), null);
assert.deepEqual(defenseAttributes({ type: "spell", system: { isOpposed: true, category: "illusion" } }), DEFAULT_SPELL_DEFENSE);
assert.deepEqual(defenseAttributes({ type: "spell", system: { isOpposed: true, category: "manipulation" }, flags: { "shadowrun-edge": { defense: { 0: "log", 1: "wil" } } } }), ["log", "wil"]);
assert.equal(defenseAttributes({ type: "spell", system: { isOpposed: true, category: "combat" } }), null, "combat spells: the system's own defense");
assert.equal(defenseAttributes({ type: "spell", system: { isOpposed: false, category: "health" } }), null);
const def = { system: { attributes: { wil: { pool: 4 }, bod: { pool: 3 } }, persona: { used: { f: 5 } } } };
assert.equal(defensePool(def, ["wil", "f"]), 9, "Willpower + persona Firewall");
assert.equal(defensePool(def, ["bod", "wil"]), 7);

console.log("rules OK");

// Errata switches.
const { defenseThreshold } = await import("../scripts/opposed.mjs");
assert.equal(defenseThreshold(3, true), 4, "Feb 2020 errata: ties go to the attacker");
assert.equal(defenseThreshold(3, false), 3, "first print: ties go to the defender");
assert.equal(defenseThreshold(0, true), 1);
const { specialMax } = await import("../scripts/sheet/context.mjs");
assert.equal(specialMax(0, 6), 6);
assert.equal(specialMax(0, 5.8), 6, "less than a full point lost");
assert.equal(specialMax(1, 4.9), 6, "grade 1, one full point lost");
assert.equal(specialMax(0, 3), 3);
assert.equal(specialMax(0, 3, false), 6, "without the erratum only the grade counts");
const { evaluateDraft, emptyDraft } = await import("../scripts/chargen/rules.mjs");
const d = emptyDraft();
d.qualities = [{ id: "exceptional", detail: "agi" }, { id: "exceptional", detail: "log" }];
const keys = (r) => r.errors.map((e) => e.key);
assert.ok(!keys(evaluateDraft(d)).includes("ExceptionalSameAttribute"), "Feb 2020: two different attributes are fine");
assert.ok(keys(evaluateDraft(d, { errata: { exceptionalPerAttribute: false } })).includes("ExceptionalOnce"), "Aug 2019 only: once in total");
d.qualities[1].detail = "agi";
assert.ok(keys(evaluateDraft(d)).includes("ExceptionalSameAttribute"));
assert.ok(!keys(evaluateDraft(d, { errata: { exceptionalPerAttribute: false, exceptionalOnce: false } })).some((k) => k.startsWith("Exceptional")), "no errata: first print");
console.log("errata OK");

// Healing (core rulebook pp. 119–121).
const H = await import("../scripts/healing-rules.mjs");
assert.deepEqual(H.treatmentThreshold(3), { threshold: 2, autoHit: 0 }, "example on p. 120: Essence 3 → threshold 2");
assert.deepEqual(H.treatmentThreshold(6), { threshold: 0, autoHit: 1 }, "fully natural: +1 hit");
assert.equal(H.treatmentThreshold(5.8).threshold, 0);
const healer = { skills: { biotech: { pool: 9 }, sorcery: { pool: 12 } }, attributes: { log: { pool: 4 } } };
assert.equal(H.healingPool("firstAid", healer, {}, { kit: true }), 9);
assert.equal(H.healingPool("firstAid", healer, {}, { kit: false }), 7, "no kit: −2");
assert.equal(H.healingPool("medkit", healer, {}, { useMedkitRating: true, medkitRating: 3 }), 7, "Feb 2020: rating + Logic");
assert.equal(H.healingPool("medkit", healer, {}, { useMedkitRating: true, medkitRating: 3, errata: { medkitRating: false } }), 9);
const patient = { attributes: { bod: { pool: 6 }, wil: { pool: 3 } }, overflow: { dmg: 0 } };
assert.equal(H.healingPool("restStun", {}, patient, { woundModifier: 3 }), 9, "Aug 2019: no wound modifiers on recovery");
assert.equal(H.healingPool("restStun", {}, patient, { woundModifier: 3, errata: { noWoundsOnRecovery: false } }), 6);
assert.equal(H.healingPool("restPhysical", {}, patient, { assistance: true }), 14, "BOD + BOD + 2 assistance");
assert.equal(H.healingPool("restPhysical", {}, { ...patient, overflow: { dmg: 2 } }, { woundModifier: 4 }), 8, "Overflow: Body + Body − wound modifiers");
// The book's healing example (p. 120): first aid 4 hits vs threshold 2 → 1 box of Overflow (2 hits per box).
let r = H.healingResult({ method: "firstAid", hits: 4, threshold: 2, damage: { stun: 10, physical: 11, overflow: 2 } });
assert.deepEqual(r.heal, { overflow: 1, physical: 0, stun: 0 });
// Then the medkit: 6 hits, 4 over → the last Overflow first, the rest by the chosen preference
// (the book's healer split it 2 Physical + 1 Stun; the dialog spends greedily on the preferred track).
r = H.healingResult({ method: "medkit", hits: 6, threshold: 2, damage: { stun: 10, physical: 11, overflow: 1 } });
assert.deepEqual(r.heal, { overflow: 1, physical: 3, stun: 0 });
r = H.healingResult({ method: "medkit", hits: 6, threshold: 2, damage: { stun: 10, physical: 11, overflow: 1 }, prefer: "stun" });
assert.deepEqual(r.heal, { overflow: 1, physical: 0, stun: 3 });
// Drain is never healed by treatment.
r = H.healingResult({ method: "medkit", hits: 5, threshold: 0, damage: { stun: 3, physical: 0, overflow: 0 }, drainBoxes: 2 });
assert.equal(r.heal.stun, 1);
// Natural recovery: every hit heals a box.
assert.equal(H.healingResult({ method: "restStun", hits: 3, damage: { stun: 8 } }).heal.stun, 3);
assert.deepEqual(H.healingResult({ method: "restPhysical", hits: 4, damage: { physical: 7, overflow: 1 } }).heal, { overflow: 1, physical: 3, stun: 0 });
assert.equal(H.isDead({ overflow: { dmg: 12 }, attributes: { bod: { pool: 6 } } }), true, "Overflow = BOD × 2");
assert.equal(H.isDead({ overflow: { dmg: 11 }, attributes: { bod: { pool: 6 } } }), false);
console.log("healing OK");

// Blasts and scatter (pp. 114–117).
const B = await import("../scripts/blast-rules.mjs");
assert.equal(B.rangeCategory(2), "close");
assert.equal(B.rangeCategory(20), "near");
assert.equal(B.scatterMeters({ roll: 7, hits: 4, range: "near" }), 1, "example p. 115: 7 − (4 + 2) = 1 m");
assert.equal(B.scatterMeters({ roll: 10, hits: 2, range: "near", launched: true, airburst: true }), 6, "launcher example (errata 02/2020): 10 − 2 × 2 = 6 m");
assert.equal(B.scatterMeters({ roll: 3, hits: 5, range: "close" }), 0, "never below 0");
assert.equal(B.scatterMeters({ roll: 7, hits: 4, range: "near", eachHit: false }), 2, "first print: only extra hits");
assert.equal(B.scatterAngle(7), 0);
assert.equal(B.scatterAngle(11), 120, "11: short and to the right");
assert.equal(B.scatterAngle(2), -150);
assert.equal(B.blastZone(0.5), "gz");
assert.equal(B.blastZone(2), "close");
assert.equal(B.blastZone(9, 10), "near");
assert.equal(B.blastZone(11, 10), null, "outside the radius");
assert.deepEqual(B.parseBlast("DV 16P / 12P / 8P, wybuch 20 m."), { gz: 16, close: 12, near: 8, stun: false, radius: 20 });
assert.equal(B.parseBlast("DV 10S / 8S / 6S, wybuch 15 m.").stun, true);
assert.equal(B.parseBlast("+ 20 dawek substancji."), null);
assert.deepEqual(B.explosiveBlast(10), { gz: 10, close: 5, near: 2, stun: false, radius: 10 }, "p. 117: rating, rating/2, rating/4");
assert.deepEqual(["close", "near", "medium", "far"].map((r) => B.thrownAttackRating(12, r)), [12, 11, 6, 0], "errata 08/2019 p. 115");
assert.equal(B.blastDamage(14, 1), 13, "example p. 115: 14P, Body 3 gets 1 hit → 13 boxes");
assert.equal(B.blastDamage(7, 1, { hitTheDirt: true }), 4);

// Conjuring (pp. 146–147), with the book's example: Force 4, Cass 3 hits vs spirit 2.
const S = await import("../scripts/summoning-rules.mjs");
assert.deepEqual(S.summoningResult({ summonerHits: 3, spiritHits: 2, magic: 6 }), { success: true, services: 1, drain: 2, physical: false });
assert.equal(S.summoningResult({ summonerHits: 2, spiritHits: 2, magic: 6 }).success, false, "at least one net hit");
assert.equal(S.summoningResult({ summonerHits: 9, spiritHits: 7, magic: 6 }).physical, true, "drain above Magic is Physical");
// Kumiho banishes: 4 hits vs 3 → 1 net hit cancels the only service; drain 2 × 3 = 6.
assert.deepEqual(S.banishingResult({ banisherHits: 4, spiritHits: 3, services: 1 }), { net: 1, servicesLeft: 0, departs: true, drain: 6 });
assert.equal(S.drainIsPhysical({ drain: 6, resisted: 5, magic: 5 }), false, "errata: 1 left after resistance");
assert.equal(S.drainIsPhysical({ drain: 6, resisted: 5, magic: 5, finalDrain: false }), true, "first print: initial drain 6 > 5");
assert.deepEqual([1, 2, 3, 5, 6, 9].map(S.optionalPowers), [0, 0, 1, 1, 2, 3]);
assert.deepEqual(S.forceBudget(6, [4, 5]), { max: 18, used: 9, left: 9 });
console.log("blast & summoning OK");

// ── Focused Concentration & Pain Resistance (scripts/traits-rules.mjs) ──
{
  const { eligibleSustained, focusedSustainedModifier, shiftedWoundModifier, boxLabel } = await import("../scripts/traits-rules.mjs");
  const { monitorPenalty, monitorBoxes } = await import("../scripts/sheet/context.mjs");
  const assert = (await import("node:assert/strict")).default;
  const spell = (drain, on = true) => ({ type: "spell", system: { duration: "sustained", isSustained: on, drain } });
  const items = [spell(4), spell(7), { type: "complexform", system: { duration: "sustained", isSustained: true } }, spell(3, false)];
  assert.equal(eligibleSustained(items), 2, "drain 7+ and not sustained don't count");
  assert.equal(focusedSustainedModifier(6, 1, items), 4, "level 1: one spell free");
  assert.equal(focusedSustainedModifier(6, 3, items), 2, "only eligible spells are free");
  assert.equal(focusedSustainedModifier(6, 0, items), 6);
  // System formula (3.3.9) on a 10-box monitor.
  const sys = (m) => monitorPenalty(m);
  assert.equal(shiftedWoundModifier(sys, { max: 10, dmg: 3 }, 0), 1);
  assert.equal(shiftedWoundModifier(sys, { max: 10, dmg: 3 }, 1), 0, "level 1: −1 starts at 4 boxes");
  assert.equal(shiftedWoundModifier(sys, { max: 10, dmg: 4 }, 1), 1);
  assert.equal(shiftedWoundModifier(sys, { max: 10, dmg: 2 }, -1), 1, "negative: −1 at 2 boxes");
  assert.equal(boxLabel(3, 10, 0), "-1");
  assert.equal(boxLabel(4, 10, 1), "-1");
  assert.equal(boxLabel(3, 10, 1), null);
  assert.equal(monitorPenalty({ max: 10, dmg: 3 }, 1), 0, "Edge sheet follows Pain Resistance");
  assert.equal(monitorBoxes({ max: 10, dmg: 0 }, 1)[3].label, "−1");
  assert.equal(monitorBoxes({ max: 10, dmg: 0 })[2].label, "−1");
  console.log("traits OK");
}

// ── Area attack Edge, Avoid Incoming, actions used this round ──
{
  const assert = (await import("node:assert/strict")).default;
  const { areaEdge, avoidMove } = await import("../scripts/blast-rules.mjs");
  // Book example (p. 116): AR 12 vs bikes' DR 6 → Edge; AR 14 vs highest DR 10 (Oda) → Edge.
  assert.deepEqual(areaEdge(12, [6, 6, 4]), { highest: 6, gain: 1 });
  assert.deepEqual(areaEdge(14, [7, 4, 10]), { highest: 10, gain: 1 });
  assert.deepEqual(areaEdge(12, [9]), { highest: 9, gain: 0 }, "less than 4: no Edge");
  assert.deepEqual(areaEdge(null, [3]), { highest: null, gain: 0 }, "no known AR");
  assert.deepEqual(areaEdge(12, []), { highest: null, gain: 0 }, "nobody in the blast");
  // Oda moves 5 m around the corner: Prone; 2 m or less: not.
  assert.deepEqual(avoidMove({ x: 0, y: 0 }, { x: 3, y: 4 }), { meters: 5, prone: true });
  assert.equal(avoidMove({ x: 0, y: 0 }, { x: 2, y: 0 }).prone, false);
  assert.equal(avoidMove({ x: 0, y: 0 }, { x: 300, y: 0 }, 0.01).meters, 3, "canvas pixels to meters");

  const { spendAction, usedThisRound, actionsLeft } = await import("../scripts/actions.mjs");
  const combatant = {
    flags: {},
    actor: { system: { initiative: { physical: { dicePool: 1 } } } },
    getFlag(scope, key) { return this.flags[scope]?.[key]; },
    async setFlag(scope, key, value) { (this.flags[scope] ??= {})[key] = value; },
  };
  assert.equal(usedThisRound(combatant, "avoid"), false);
  assert.equal(await spendAction(combatant, "minor", { mark: "avoid" }), true);
  assert.equal(usedThisRound(combatant, "avoid"), true);
  assert.equal(actionsLeft(combatant).minor.left, 1, "2 Minor Actions, one spent");
  assert.equal(await spendAction(combatant, "minor"), true);
  assert.equal(await spendAction(combatant, "minor"), false, "none left");
  console.log("avoid & area edge OK");
}

// ── Rule conflicts: "…anyway" options for the GM, for players only when the world allows it ──
{
  const assert = (await import("node:assert/strict")).default;
  const { allowedOptions, canBreakRules } = await import("../scripts/ui/conflict.mjs");
  const options = [{ id: "replace" }, { id: "force", breaksRules: true }];
  assert.deepEqual(allowedOptions(options, false).map((o) => o.id), ["replace"]);
  assert.deepEqual(allowedOptions(options, true).map((o) => o.id), ["replace", "force"]);
  const saved = globalThis.game;
  globalThis.game = { user: { isGM: true }, settings: { get: () => false } };
  assert.equal(canBreakRules(), true, "the GM always may");
  globalThis.game = { user: { isGM: false }, settings: { get: () => false } };
  assert.equal(canBreakRules(), false, "players not by default");
  globalThis.game = { user: { isGM: false }, settings: { get: (m, k) => k === "playersBreakRules" } };
  assert.equal(canBreakRules(), true, "players when the GM allows it");
  globalThis.game = saved;
  console.log("conflicts OK");
}

// ── Statuses (pp. 51–53) ──
{
  const assert = (await import("node:assert/strict")).default;
  const { poolChips, statusChanges, ongoingDamage, cancels, movement, barrierDamage, warnings } = await import("../scripts/status-rules.mjs");
  const ids = (chips) => chips.map((c) => `${c.id}:${c.value}:${c.on ? "on" : "off"}`);
  // Chilled −1 to all pools except Damage Resistance; Fatigued II −4; Confused 3 −3.
  assert.deepEqual(ids(poolChips([{ id: "chilled" }, { id: "fatigued", level: 2 }, { id: "confused", level: 3 }], { kind: "test" })),
    ["chilled:-1:on", "fatigued:-4:on", "confused:-3:on"]);
  assert.deepEqual(ids(poolChips([{ id: "chilled" }, { id: "fatigued", level: 2 }], { kind: "soak" })), ["chilled:-1:off", "fatigued:-4:off"]);
  // Blinded II −6, situational (off); III: automatic failure note.
  assert.deepEqual(ids(poolChips([{ id: "blinding", level: 2 }])), ["blinding:-6:off"]);
  assert.equal(poolChips([{ id: "blinding", level: 3 }])[0].note, "autoFail");
  // Cover III: +3 on defense; Cover IV attack −2 with the August 2019 errata only.
  assert.deepEqual(ids(poolChips([{ id: "cover", level: 3 }], { kind: "defense" })), ["cover:3:on"]);
  assert.deepEqual(ids(poolChips([{ id: "cover", level: 4 }], { kind: "attack", errata: { coverIVAttack: true } })), ["cover:-2:on"]);
  assert.deepEqual(poolChips([{ id: "cover", level: 4 }], { kind: "attack", errata: { coverIVAttack: false } }), []);
  // Prone: −4 melee, AR +2 for firearms, ±2 defense by range (picked by the user).
  assert.deepEqual(ids(poolChips([{ id: "prone" }], { kind: "attack", melee: true })), ["prone:-4:on"]);
  assert.equal(poolChips([{ id: "prone" }], { kind: "attack", firearm: true })[0].arMod, 2);
  assert.deepEqual(ids(poolChips([{ id: "prone" }], { kind: "defense" })), ["prone_far:2:off", "prone_near:-2:off"]);
  // Immobilized: AR −3 and −3 attacks; defense without Reaction.
  const imm = poolChips([{ id: "immobilized" }], { kind: "attack" })[0];
  assert.deepEqual([imm.value, imm.arMod], [-3, -3]);
  assert.equal(poolChips([{ id: "immobilized" }], { kind: "defense" })[0].reaction, true);
  // Always-on values on the status effect.
  assert.deepEqual(statusChanges("cover", 3), [{ key: "system.defenserating.physical.mod", mode: 2, value: "3" }]);
  assert.equal(statusChanges("dazed").length, 3, "Initiative −4 on every initiative type");
  assert.equal(statusChanges("zapped")[0].value, "-2");
  assert.equal(statusChanges("stilled")[0].value, "-10");
  // Ongoing damage; Stilled halts it; Poisoned may be Stun.
  assert.deepEqual(ongoingDamage([{ id: "burning", level: 3 }, { id: "poisoned", level: 4, stun: true }]),
    [{ id: "burning", dv: 3, monitor: "physical" }, { id: "poisoned", dv: 4, monitor: "stun" }]);
  assert.deepEqual(ongoingDamage([{ id: "burning", level: 3 }, { id: "stilled" }]), []);
  // Burning ↔ Wet/Chilled; Petrified cancels damaging statuses.
  assert.deepEqual(cancels("burning"), ["wet", "chilled"]);
  assert.deepEqual(cancels("wet"), ["burning"]);
  assert.deepEqual(cancels("petrified"), ["burning", "corrosive", "poisoned"]);
  // Movement: Fatigued 5/10, then Hobbled halves (round up); Prone 2 m, no sprint.
  assert.deepEqual(movement([{ id: "fatigued" }, { id: "hobbled" }], 10, 15), { walk: 3, sprint: 5 });
  assert.deepEqual(movement([{ id: "prone" }], 10, 15), { walk: 2, sprint: 0 });
  // Barrier: half the Structure, rounded up (solid wood door 7 → 4).
  assert.equal(barrierDamage(9, 7), 5);
  assert.equal(barrierDamage(3, 7), 0);
  assert.deepEqual(warnings([{ id: "dazed" }, { id: "cover", level: 1 }], { kind: "attack" }), ["dazed", "coverAttack"]);
  console.log("statuses OK");
}

// ── Toxins and drugs (pp. 121–125) ──
{
  const assert = (await import("node:assert/strict")).default;
  const { exposurePower, powerLeft, toxinOutcome, durationSeconds, speedRounds, effectChanges, crashOf } = await import("../scripts/substance-rules.mjs");
  const { SUBSTANCES, substance } = await import("../scripts/substances-data.mjs");
  const { KNOWN } = await import("../scripts/status-rules.mjs");
  assert.equal(SUBSTANCES.length, 20, "9 toxins (Neuro-Stun ×3) and 11 drugs");
  for (const s of SUBSTANCES) {
    assert.ok(s.power > 0 && s.vectors.length && s.duration, s.id);
    for (const st of [...(s.statuses ?? []), ...(s.crash?.statuses ?? []).map((x) => (Array.isArray(x) ? x[0] : x))]) assert.ok(KNOWN.includes(st), `${s.id}: ${st}`);
  }
  // Errata 08/2019 costs: Narcoject 4(L) 50¥, Seven-7 10(I) 1,000¥.
  assert.deepEqual([substance("narcoject").avail, substance("narcoject").cost], ["4(L)", 50]);
  assert.equal(substance("seven_7").cost, 1000);
  // Power: +1 per extra dose and per later test.
  assert.equal(exposurePower(15, { doses: 3 }), 17);
  assert.equal(exposurePower(9, { retests: 2 }), 11);
  assert.equal(powerLeft(8, 10), 0);
  // Narcoject 15 − 6 hits: 9 Stun; Nausea gas fully resisted: nothing.
  assert.deepEqual(toxinOutcome(substance("narcoject"), 15, 6), { left: 9, damage: 9, monitor: "stun", statuses: [], changes: [] });
  assert.equal(toxinOutcome(substance("nausea_gas"), 9, 9).statuses.length, 0);
  assert.deepEqual(toxinOutcome(substance("seven_7"), 12, 4).monitor, "physical");
  // Durations: Narcoject (6 − Body) hours, min 1: Body 4 → 2 h, Body 7 → 1 h; Jazz 10 × 1D6 min; Long Haul 4 days.
  assert.equal(durationSeconds(substance("narcoject").duration, 4), 7200);
  assert.equal(durationSeconds(substance("narcoject").duration, 7), 3600);
  assert.equal(durationSeconds(substance("gamma_scopolamine").duration, 3), 90 * 60, "(6 − 3) × 30 minutes");
  assert.equal(durationSeconds(substance("jazz").duration, 3, 4), 40 * 60);
  assert.equal(durationSeconds(substance("long_haul").duration, 3), 4 * 86400);
  assert.equal(speedRounds(substance("nausea_gas").speed), 3);
  assert.equal(speedRounds(substance("cram").speed), null, "Speed in minutes");
  // Kamikaze: attributes, +2D6 initiative, High Pain Tolerance; crash: 6 Stun, Fatigued II, twice the duration.
  const k = effectChanges(substance("kamikaze"));
  assert.ok(k.some((c) => c.key === "system.attributes.str.mod" && c.value === "2"));
  assert.ok(k.some((c) => c.key === "system.initiative.physical.diceMod" && c.value === "2"));
  assert.ok(k.some((c) => c.key === "system.painTolerance" && c.mode === 5 && c.value === "high"));
  const crash = crashOf(substance("kamikaze"));
  assert.deepEqual([crash.stun, crash.factor, crash.statuses[0]], [6, 2, { id: "fatigued", level: 2 }]);
  assert.ok(crashOf(substance("novacoke")).changes.some((c) => c.key === "system.attributes.cha.pool" && c.value === "0"));
  assert.equal(crashOf(substance("nitro")).pool, -2);
  assert.equal(crashOf(substance("psyche")), null);
  console.log("substances OK");
}

// ── "What's new": versions after the last one seen ──
{
  const assert = (await import("node:assert/strict")).default;
  const { readFileSync } = await import("node:fs");
  const cmp = (a, b) => { const x = a.split(".").map(Number), y = b.split(".").map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };
  globalThis.foundry ??= {};
  globalThis.foundry.utils = { ...(globalThis.foundry.utils ?? {}), isNewerVersion: (a, b) => cmp(String(a), String(b)) };
  const { changesSince } = await import("../scripts/welcome.mjs");
  const log = JSON.parse(readFileSync(new URL("../data/changelog.json", import.meta.url), "utf8"));
  const version = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8")).version;
  assert.equal(log[0].version, version, "the changelog starts with the current version");
  assert.deepEqual(changesSince(log, log[2].version).map((v) => v.version), [log[0].version, log[1].version], "newest first, only after the one seen");
  assert.equal(changesSince(log, "").length, 3, "first time: the latest three");
  assert.equal(changesSince(log, version).length, 0);
  const { changesOf } = await import("../scripts/welcome.mjs");
  for (const v of log) assert.equal(v.changes_en?.length, v.changes.length, `English changelog for ${v.version}`);
  assert.equal(changesOf(log[0], "en"), log[0].changes_en);
  assert.equal(changesOf(log[0], "pl"), log[0].changes);
  console.log("welcome OK");
}

// ── Karma advancement (pp. 68–70) ──
{
  const assert = (await import("node:assert/strict")).default;
  const { entryCost, entryTime, cartTotal, cartProblems } = await import("../scripts/advancement-rules.mjs");
  assert.equal(entryCost({ kind: "attribute", from: 4, to: 6 }), 55, "5 × 5 + 5 × 6");
  assert.equal(entryCost({ kind: "skill", from: 0, to: 1 }), 5);
  assert.equal(entryCost({ kind: "knowledge" }), 3);
  assert.equal(entryCost({ kind: "quality", karma: 4, level: 2 }), 16, "2 × cost per level");
  assert.equal(entryCost({ kind: "removeQuality", karma: -8 }), 16, "2 × bonus");
  assert.equal(entryCost({ kind: "initiation", from: 0 }), 11, "10 + new grade");
  assert.equal(entryCost({ kind: "submersion", from: 2 }), 13);
  assert.deepEqual(entryTime({ kind: "attribute", from: 4, to: 6 }), { months: 22, weeks: 0 }, "(5 + 6) × 2 months");
  assert.deepEqual(entryTime({ kind: "skill", from: 2, to: 3 }), { months: 3, weeks: 0 });
  assert.deepEqual(entryTime({ kind: "initiation", from: 0 }), { months: 2, weeks: 0 });
  assert.deepEqual(entryTime({ kind: "submersion", from: 0 }), { months: 0, weeks: 2 });
  assert.deepEqual(entryTime({ kind: "spell" }), { months: 0, weeks: 1 });
  const cart = [{ kind: "attribute", id: "agi", from: 4, to: 6 }, { kind: "skill", id: "firearms", from: 4, to: 5 }, { kind: "expertise", id: "firearms", spec: "pistols" }];
  assert.equal(cartTotal(cart).total, 55 + 25 + 5);
  const keys = (c, ctx) => cartProblems(c, ctx).map((p) => p.key);
  assert.deepEqual(keys(cart, { karma: 100, attrMax: { agi: 6 }, skills: { firearms: { points: 4, specialization: "pistols" } } }), [], "rank 5 bought in the same cart");
  assert.deepEqual(keys(cart, { karma: 50, attrMax: { agi: 5 }, skills: { firearms: { points: 4 } } }), ["karma", "attrMax", "expertiseNoSpec"]);
  assert.deepEqual(keys([{ kind: "expertise", id: "firearms" }], { karma: 9, skills: { firearms: { points: 3, specialization: "x" } } }), ["expertiseRank"]);
  assert.deepEqual(keys([{ kind: "specialization", id: "firearms", spec: "y" }], { karma: 9, skills: { firearms: { points: 3, specialization: "x" } } }), ["secondSpec"]);
  assert.deepEqual(keys([{ kind: "skill", id: "firearms", from: 9, to: 10 }], { karma: 99, skillMax: { firearms: 10 } }), [], "Aptitude");
  assert.deepEqual(keys([{ kind: "skill", id: "firearms", from: 9, to: 10 }], { karma: 99 }), ["skillMax"]);
  console.log("advancement OK");
}

// ── Matrix (pp. 175–187, errata Aug 2019 / Feb 2020) ──
{
  const assert = (await import("node:assert/strict")).default;
  const R = await import("../scripts/matrix-rules.mjs");
  assert.deepEqual(R.osFromAction({ illegal: true, defenderHits: 4, program: true }), { total: 5, hits: 4, program: 1 }, "all defender hits + 1 per hacking program");
  assert.equal(R.osFromAction({ illegal: false, defenderHits: 4 }).total, 0, "legal actions add nothing");
  assert.equal(R.osFromAction({ illegal: false, defenderHits: 0, program: true }).total, 1);
  assert.equal(R.osFromAction({ illegal: true, defenderHits: 6, program: true, radar: true }).total, 0, "Under the Radar");
  assert.equal(R.osPerRound([{ kind: "host", access: "admin", illegal: true }, { kind: "host", access: "user", illegal: true },
    { kind: "host", access: "admin", illegal: false }, { kind: "device", access: "admin", illegal: true }]), 4, "+3 Admin, +1 User, hosts only, illegal only");
  assert.equal(R.isConvergence(39), false);
  assert.equal(R.isConvergence(40), true);
  assert.equal(R.dumpshock("ar", 4), null);
  assert.deepEqual(R.dumpshock("vrcold", 4), { damage: 3, monitor: "stun", minutes: 6 });
  assert.deepEqual(R.dumpshock("vrhot", 12), { damage: 3, monitor: "physical", minutes: 0 });
  assert.equal(R.deviceMonitor(4), 10);
  assert.equal(R.deviceMonitor(3), 10, "(3 / 2) rounded up + 8");
  assert.equal(R.dataSpikeDamage(9, 2), 7, "[9/2] = 5, + 2 net");
  assert.deepEqual(R.bruteForceDefense("admin", "outsider"), { firewallBonus: 2, drBonus: 4 });
  assert.deepEqual(R.bruteForceDefense("admin", "user"), { firewallBonus: 0, drBonus: 0 });
  assert.deepEqual(R.bruteForceDefense("user", "outsider"), { firewallBonus: 0, drBonus: 0 });
  assert.equal(R.backdoorHours(4), 6);
  assert.equal(R.accessAllowed({ outsider: true, user: true, admin: true }, "outsider"), true);
  assert.equal(R.accessAllowed({ admin: true }, "user"), false);
  assert.equal(R.accessAllowed({ user: true, admin: true }, "admin"), true);
  assert.equal(R.accessNeeded({ user: true, admin: true }), "user");
  assert.deepEqual(R.accessResult("brute_force", { want: "admin", net: 1 }), { access: "admin", illegal: true });
  assert.deepEqual(R.accessResult("backdoor_entry", { net: 2 }), { access: "admin", illegal: false }, "a backdoor is not illegal access");
  assert.deepEqual(R.accessResult("probe", { net: 3, rating: 4 }), { backdoor: { bonus: 3, hours: 6 } });
  assert.equal(R.accessResult("brute_force", { net: 0 }), null);
  assert.deepEqual(R.icStats(4, 7), { pool: 8, monitor: 8, initiative: { base: 14, dice: 3 }, maxRunning: 4 });
  assert.deepEqual(R.icHit("killer", 4, 2), { matrix: 6, bio: 0, attrLoss: null, linkLock: false, effect: "damage" });
  assert.equal(R.icHit("black", 4, 1).bio, 5);
  assert.equal(R.icHit("blaster", 4, 3).matrix, 4, "Blaster: (Rating) damage + link-lock");
  assert.equal(R.icHit("blaster", 4, 3).linkLock, true);
  assert.deepEqual(R.icHit("acid", 4, 2).attrLoss, { attr: "f", amount: 2 });
  assert.equal(R.icHit("killer", 4, 0), null, "a miss does nothing");
  console.log("matrix OK");
}

// ── Vehicles and drones (pp. 197–202, errata) ──
{
  const assert = (await import("node:assert/strict")).default;
  const V = await import("../scripts/vehicle-rules.mjs");
  assert.equal(V.speedIntervals(28, 20), 1, "Turbo Bunny: one step over the first interval");
  assert.equal(V.speedIntervals(40, 20), 2);
  assert.equal(V.speedIntervals(16, 20), 0);
  assert.equal(V.handlingThreshold({ handlOn: 4, handlOff: 5, offRoad: false, dmg: 7 }), 6, "+1 per three boxes");
  assert.equal(V.handlingThreshold({ handlOn: 4, handlOff: 5, offRoad: true, dmg: 0 }), 5);
  assert.equal(V.changeSpeed(16, { accel: 9, top: 160, dir: 1 }), 25);
  assert.equal(V.changeSpeed(5, { accel: 9, top: 160, dir: -1 }), 0);
  assert.equal(V.changeSpeed(155, { accel: 9, top: 160, dir: 1 }), 160);
  assert.equal(V.distance(30, 40), 35, "30 + ½(10)");
  assert.equal(V.distance(30, 20), 25);
  assert.equal(V.kmh(40), 48);
  assert.equal(V.crashDamage(28), 2);
  assert.equal(V.crashDamage(28, 1), 1);
  assert.equal(V.ramDamage(11, 1), 7, "11 / 2 rounded up + 1");
  assert.equal(V.softTargetDamage(5), 2);
  assert.equal(V.ignoresStun(6, 11), true);
  assert.equal(V.ignoresStun(6, 11, true), false, "electricity");
  assert.equal(V.handlingPool({ mode: "manual", systemPool: 7, damagePenalty: 1 }), 8, "damage moves from the pool to the threshold");
  assert.equal(V.handlingPool({ mode: "autonomous", pilot: 3, maneuver: 2, speedPenalty: 1 }), 4);
  const t = V.droneTests({ pil: 3, sen: 3 }, { CLEARSIGHT: 3, TARGETING: 3 });
  assert.equal(t.find((x) => x.id === "CLEARSIGHT").pool, 6);
  assert.equal(t.find((x) => x.id === "TARGETING").pool, 6, "HK-227 Targeting 3 + Sensor 3");
  assert.equal(V.droneTests({ pil: 3, sen: 3 }, {}).find((x) => x.id === "TARGETING").pool, 2, "no Targeting: Sensor − 1");
  assert.equal(V.droneTests({ pil: 3, sen: 3 }, {}).find((x) => x.id === "STEALTH").missing, true);
  assert.deepEqual(V.droneInitiative(3), { base: 6, dice: 4 });
  assert.equal(V.autosoftSlots(3), 2);
  assert.equal(V.rccSlaves(4), 12);
  assert.equal(V.weaponMounts(11), 3);
  console.log("vehicles OK");
}

// ── Magic and Resonance catalog (pp. 133–195, errata) ──
{
  const assert = (await import("node:assert/strict")).default;
  const { SPELLS, ADEPT_POWERS, METAMAGIC, COMPLEX_FORMS, ECHOES } = await import("../catalog/magic.mjs");
  const by = (list, name) => list.find((x) => x.name === name);
  const count = (cat) => SPELLS.filter((s) => s.cat === cat).length;
  assert.deepEqual(["combat", "detection", "health", "illusion", "manipulation"].map(count), [16, 11, 10, 12, 24]);
  assert.deepEqual([ADEPT_POWERS.length, METAMAGIC.length, COMPLEX_FORMS.length, ECHOES.length], [21, 9, 15, 7]);
  assert.deepEqual(by(SPELLS, "Fireball"), { name: "Fireball", cat: "combat", range: "line_of_sight_area", type: "physical", duration: "instantaneous", drain: 6, damage: "physical_special", direct: false, page: 133 });
  assert.equal(by(SPELLS, "Manabolt").direct, true);
  assert.equal(by(SPELLS, "Manabolt").drain, 4);
  assert.equal(by(SPELLS, "Stunball").damage, "stun");
  assert.equal(by(SPELLS, "Mystic Armor").type, "mana", "errata Aug 2019: P → M");
  assert.equal(by(SPELLS, "Vehicle Armor").type, "physical", "errata: M → P");
  assert.equal(by(SPELLS, "Phantasm").multiSense, true);
  assert.equal(by(SPELLS, "Animate Metal").duration, "limited");
  assert.deepEqual([by(ADEPT_POWERS, "Improved Reflexes").cost, by(ADEPT_POWERS, "Improved Reflexes").perLevel], [1, true]);
  assert.deepEqual([by(ADEPT_POWERS, "Spell Resistance").cost, by(ADEPT_POWERS, "Spell Resistance").perLevel], [0.5, false], "errata Aug 2019");
  assert.equal(by(ADEPT_POWERS, "Pain Resistance"), undefined, "kept in the traits folder with its effect");
  assert.deepEqual([by(COMPLEX_FORMS, "Cleaner").fading, by(COMPLEX_FORMS, "Cleaner").duration], [2, "permanent"]);
  assert.equal(by(COMPLEX_FORMS, "Resonance Spike").skill, "cracking");
  assert.equal(by(COMPLEX_FORMS, "Transcend Grid"), undefined, "removed by the August 2019 errata");
  assert.equal(by(METAMAGIC, "Power Point").adepts, true);
  console.log("magic catalog OK");
}

// ── Gas, spray and demolitions (pp. 116–117, errata Aug 2019) ──
{
  const assert = (await import("node:assert/strict")).default;
  const G = await import("../scripts/gas-rules.mjs");
  assert.deepEqual([3, 5, 10, 15, 20, 21].map((m) => G.gasZone(m, 5)), [0, 0, 1, 2, 3, null]);
  const row = (z) => [1, 4, 5, 6, 7, 8, 9, 10, 11].map((r) => G.gasLevel(z, r));
  assert.deepEqual(row(0), ["full", "full", "full", "half", "half", "half", "quarter", "quarter", "none"]);
  assert.deepEqual(row(1), ["half", "half", "half", "quarter", "quarter", "quarter", "none", "none", "none"]);
  assert.deepEqual(row(2), ["half", "half", "quarter", "quarter", "none", "none", "none", "none", "none"], "errata: half in rounds 1–4");
  assert.deepEqual(row(3), ["quarter", "quarter", "quarter", "none", "none", "none", "none", "none", "none"]);
  assert.equal(G.gasLevel(0, 0), "none", "nothing before the attack lands");
  assert.deepEqual([8, 9, 11].map((r) => G.gasLevel(1, r, "barrier")), ["half", "quarter", "none"]);
  assert.deepEqual([9, 10].map((r) => G.gasLevel(0, r, "sealed")), ["full", "none"]);
  assert.equal(G.cloudOver(10, "sealed"), true);
  assert.equal(G.cloudOver(10, "open"), false);
  assert.equal(G.gasPower(9, "half"), 4, "rounded down");
  assert.equal(G.gasPower(9, "quarter"), 2);
  assert.equal(G.gasKind({ name: "Gas grenade" }), "gas");
  assert.equal(G.gasKind({ name: "Smoke/thermal smoke rocket" }), "smoke");
  assert.equal(G.gasKind({ name: "Fragmentation grenade" }), null);
  assert.equal(G.sprayDamage(3, "sweeping", 1), 1, "3P − 3 + 1 net");
  assert.equal(G.sprayDamage(3, "wobbly", 0), 2);
  assert.equal(G.fastStreamAllowed("straight"), false);
  assert.equal(G.isSpray({ name: "Ares Super Squirt", system: { subtype: "DMSO" } }), true);
  const frag = { gz: 16, close: 12, near: 8, stun: false, radius: 20 };
  assert.deepEqual(G.demolition({ kind: "grenade", target: "personnel", hits: 5, blast: frag }), { bonus: 3 });
  assert.deepEqual(G.demolition({ kind: "grenade", target: "structure", hits: 9, blast: frag }), { structureDV: 16 }, "never beyond Ground Zero (errata)");
  assert.deepEqual(G.demolition({ kind: "package", target: "structure", hits: 3, rating: 6 }), { structureRating: 9 });
  assert.deepEqual(G.demolition({ kind: "package", target: "personnel", hits: 4, rating: 6 }).blast, { gz: 8, close: 4, near: 2, stun: false, radius: 8 });
  assert.deepEqual(G.spreadBonus(frag, 3, { close: 2, near: 1 }), { ...frag, close: 14, near: 9 });
  assert.deepEqual(G.spreadBonus(frag, 3, {}), { ...frag, gz: 19 }, "unassigned points go to Ground Zero");
  console.log("gas & spray OK");
}

// ── Edge Motion: the player's level ──
{
  const assert = (await import("node:assert/strict")).default;
  globalThis.Hooks ??= { on() {}, once() {} };
  const { motionLevel } = await import("../scripts/motion.mjs");
  assert.equal(motionLevel("auto", false), "full");
  assert.equal(motionLevel("auto", true), "reduced", "follows the system's reduced-motion preference");
  assert.equal(motionLevel("off", false), "off");
  assert.equal(motionLevel("full", true), "full", "an explicit choice wins");
  const { readFileSync, existsSync } = await import("node:fs");
  const css = readFileSync(new URL("../styles/edge-motion.css", import.meta.url), "utf8");
  for (const [, file] of css.matchAll(/url\("\.\.\/(fonts\/[^"]+)"\)/g)) assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), file);
  assert.ok(existsSync(new URL("../fonts/OFL.txt", import.meta.url)), "the font's licence ships with it");
  const manifest = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));
  assert.ok(manifest.styles.includes("styles/edge-motion.css"));
  console.log("motion OK");
}

// ── Edge Motion: numbers and damage deltas ──
{
  const assert = (await import("node:assert/strict")).default;
  const { leadingNumber, damageDelta } = await import("../scripts/motion.mjs");
  assert.equal(leadingNumber("11"), 11);
  assert.equal(leadingNumber("−2"), -2);
  assert.equal(leadingNumber("12,450¥"), 12450);
  assert.equal(leadingNumber("11+1K6"), 11);
  assert.equal(leadingNumber("—"), null);
  assert.deepEqual(damageDelta({ physical: 2, stun: 0 }, { physical: 6, stun: 0 }), [{ id: "physical", d: 4 }]);
  assert.deepEqual(damageDelta({ physical: 6, stun: 3 }, { physical: 3, stun: 3 }), [{ id: "physical", d: -3 }]);
  assert.deepEqual(damageDelta({ physical: 1, stun: 1 }, { physical: 1, stun: 1 }), []);
  console.log("motion numbers OK");
}

// ── Edge Motion: roll cards ──
{
  const assert = (await import("node:assert/strict")).default;
  const { readDice, sortDice, verdictOf } = await import("../scripts/motion.mjs");
  const dice = readDice(["die hit die_6", "die miss die_1", "die hit die_5_wild wild", "die miss die_3", "die ignored die_4"]);
  assert.deepEqual(dice[2], { value: 5, hit: true, wild: true, ignored: false, edged: false });
  assert.deepEqual(sortDice(dice).map((d) => d.value), [6, 5, 3, 1, 4], "hits, others high to low, ones, ignored last");
  const words = { criticalText: "Krytyczna komplikacja", glitchText: "Komplikacja", successText: "Sukces", failureText: "Porażka" };
  assert.equal(verdictOf({ ...words, header: "11d6 Krytyczna komplikacja", result: "Porażka: 0" }), "critical");
  assert.equal(verdictOf({ ...words, header: "11d6 Komplikacja", result: "Sukces: 3" }), "glitch");
  assert.equal(verdictOf({ ...words, header: "11d6", result: " Sukces: 5 sukcesów" }), "success");
  assert.equal(verdictOf({ ...words, header: "4d6", result: "Porażka: 1" }), "failure");
  assert.equal(verdictOf({ ...words, header: "2d6", result: "Razem: 7" }), null, "initiative and other rolls get no stamp");
  console.log("motion chat OK");
}

// ── Edge Motion: turn banner ──
{
  const assert = (await import("node:assert/strict")).default;
  const { bannerFor, bannerKey } = await import("../scripts/motion.mjs");
  // One banner per turn whichever hook reports it (updateCombat, combatTurnChange, combatRound, combatStart).
  assert.equal(bannerKey({ round: 2, turn: 1, combatant: { id: "c1" } }), "2:1:c1");
  assert.notEqual(bannerKey({ round: 2, turn: 1, combatant: { id: "c1" } }), bannerKey({ round: 3, turn: 1, combatant: { id: "c1" } }));
  assert.deepEqual(bannerFor({ isGM: false, owned: true, name: "Glitch", initiative: 21, round: 2 }), { kind: "mine", title: "SRE.Motion.Banner.Yours", sub: "Glitch · SRE.Motion.Banner.Initiative 21 · SRE.Motion.Banner.Round 2" });
  assert.equal(bannerFor({ isGM: false, owned: false, name: "Pająk", initiative: 24, round: 2 }), null, "other players' turns: nothing");
  assert.equal(bannerFor({ isGM: true, owned: true, name: "Pająk", initiative: 24, round: 2 }).kind, "gm");
  assert.equal(bannerFor({ isGM: true, owned: true, name: "X", initiative: null, round: 1 }).sub, "X · SRE.Motion.Banner.Round 1");
  console.log("motion banner OK");
}

// ── Edge Motion: scene effects ──
{
  const assert = (await import("node:assert/strict")).default;
  const { blastRadii, easeOut, puffAlpha } = await import("../scripts/fx.mjs");
  assert.deepEqual(blastRadii(20, 100), { gz: 100, close: 300, near: 2000 }, "1 m, 3 m, the blast radius");
  assert.equal(blastRadii(2, 100).near, 300, "never inside Close");
  assert.equal(easeOut(0), 0);
  assert.equal(easeOut(1), 1);
  assert.ok(easeOut(0.5) > 0.5, "fast out");
  assert.equal(puffAlpha(0, 1, "open"), 0.16, "full effect");
  assert.equal(puffAlpha(1, 1, "open"), 0.08, "half");
  assert.equal(puffAlpha(3, 6, "open"), 0, "gone from the outer zone");
  console.log("motion fx OK");
}

// ── Fixes after the first playtest ──
{
  const assert = (await import("node:assert/strict")).default;
  const { cloudRound } = await import("../scripts/gas-rules.mjs");
  assert.equal(cloudRound(3, 3), 1, "the round it landed in is round 1");
  assert.equal(cloudRound(5, 3), 3);
  assert.equal(cloudRound(2, 3), 1, "never before round 1");
  globalThis.foundry ??= {};
  globalThis.foundry.utils = { ...(globalThis.foundry.utils ?? {}) };
  const { toXY } = await import("../scripts/blast.mjs");
  assert.deepEqual(toXY({ x: "10", y: 20 }), { x: 10, y: 20 });
  assert.equal(toXY({ _x: 1, _y: 2 }), null, "a PIXI point that lost x/y in a flag");
  assert.equal(toXY(null), null);
  console.log("playtest fixes OK");
}

// ── Changelog segments ──
{
  const assert = (await import("node:assert/strict")).default;
  const { readFileSync } = await import("node:fs");
  const { segments } = await import("../scripts/changelog-rules.mjs");
  const log = JSON.parse(readFileSync(new URL("../data/changelog.json", import.meta.url), "utf8"));
  const groups = JSON.parse(readFileSync(new URL("../data/changelog-groups.json", import.meta.url), "utf8"));
  const known = new Set(log.map((v) => v.version));
  for (const g of groups) for (const v of g.versions) assert.ok(known.has(v), `group ${g.id}: ${v} is in the changelog`);
  const segs = segments(log, groups, "pl");
  const motion = segs.find((s) => s.title.startsWith("Edge Motion"));
  assert.equal(motion.versions, `0.31.0–${groups.find((g) => g.id === "motion").versions[0]}`);
  assert.ok(segs.length < log.length, "steps merged");
  const sheet = segs.find((s) => s.versions === "0.6.0–0.9.0");
  assert.equal(sheet.changes.length, 4);
  assert.equal(segments(log, groups, "en").find((s) => s.versions === "0.6.0–0.9.0").title, "The Edge sheet");
  assert.equal(segments([{ version: "1.0.0", date: "d", changes: ["a"] }], groups)[0].title, "1.0.0", "a lone version keeps its number");
  console.log("changelog segments OK");
}

// ── Stage 12: interface levels, banners, Dice So Nice ──
{
  const assert = (await import("node:assert/strict")).default;
  const { readFileSync, existsSync } = await import("node:fs");
  const { uiLevel, levelClasses, COLORSETS } = await import("../scripts/edge-ui.mjs");
  assert.equal(uiLevel("world", "3"), 3, "the world's default");
  assert.equal(uiLevel("1", "3"), 1, "the player's choice wins");
  assert.equal(uiLevel(undefined, undefined), 2);
  assert.deepEqual(levelClasses(1), { "sre-ui-2": false, "sre-ui-3": false });
  assert.deepEqual(levelClasses(3), { "sre-ui-2": true, "sre-ui-3": true }, "level 3 includes level 2");
  assert.ok(COLORSETS.every((c) => c.name.startsWith("sre-") && c.category === "Shadowrun Edge"));
  const manifest = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));
  for (const pack of manifest.packs) {
    assert.ok(pack.banner, `${pack.name} has a banner`);
    assert.ok(existsSync(new URL(`../${pack.banner.replace("modules/shadowrun-edge/", "")}`, import.meta.url)), pack.banner);
  }
  assert.ok(manifest.styles.includes("styles/edge-ui.css"));
  console.log("edge ui OK");
}

// ── Verdict from the roll data ──
{
  const assert = (await import("node:assert/strict")).default;
  const { verdictFromRoll } = await import("../scripts/motion.mjs");
  assert.equal(verdictFromRoll({ success: true, glitch: false, criticalglitch: false }), "success");
  assert.equal(verdictFromRoll({ success: false }), "failure");
  assert.equal(verdictFromRoll({ success: true, glitch: true }), "glitch");
  assert.equal(verdictFromRoll({ success: false, glitch: true, criticalglitch: true }), "critical");
  assert.equal(verdictFromRoll({}), null);
  assert.equal(verdictFromRoll(undefined), null);
  console.log("verdict OK");
}

// ── UI skeleton for diagnostics ──
{
  const assert = (await import("node:assert/strict")).default;
  const { describe, skeleton } = await import("../scripts/edge-ui.mjs");
  const el = (tag, { id = "", cls = [], attrs = {}, kids = [] } = {}) => ({
    tagName: tag.toUpperCase(), id, classList: cls, children: kids, getAttribute: (a) => attrs[a] ?? null,
  });
  assert.equal(describe(el("button", { id: "b", cls: ["control", "active", "sre-fx-open"], attrs: { "data-tool": "select" } })), "button#b.control.active[data-tool=select]");
  const li = () => el("li", { cls: ["directory-item"] });
  const tree = skeleton(el("ol", { id: "list", kids: [li(), li(), li(), li()] }));
  assert.deepEqual(tree, ["ol#list", "  li.directory-item", "  li.directory-item", "  … 2 × li.directory-item"], "repeats collapse");
  console.log("ui skeleton OK");
}
{
  const { monitorChanged } = await import("../scripts/statuses.mjs");
  assert.equal(monitorChanged({ system: { physical: { dmg: 13 } } }), true);
  assert.equal(monitorChanged({ system: { overflow: { dmg: 2 } } }), true);
  assert.equal(monitorChanged({ system: { edge: { value: 2 } } }), false);
  console.log("monitor statuses OK");
}
{
  // Statuses and effects: the system's static ids, sources with end times, what the tab groups.
  const FX = await import("../scripts/effects.mjs");
  assert.equal(FX.staticId("prone"), "prone00000000000");
  assert.equal(FX.staticId("sreDumpshock"), "sreDumpshock0000");
  assert.equal(FX.staticId("invisibleImproved"), "invisibleImprove");
  const src = [{ name: "CS gas", until: 1000 }, { name: "Narcoject", until: 400 }];
  assert.deepEqual(FX.liveSources(src, 500).map((s) => s.name), ["CS gas"]);
  assert.equal(FX.timeLeft(src, null, 500), 500, "the latest source ends it");
  assert.equal(FX.timeLeft([{ name: "x", until: null }], null, 0), null, "a source without an end");
  assert.equal(FX.timeLeft([], { seconds: 600, startTime: 100 }, 400), 300, "the effect's own duration");
  assert.equal(FX.formatLeft(125), "3 SRE.Effects.Unit.min");
  assert.equal(FX.effectKind({ statuses: new Set(["prone"]), flags: {} }), "status");
  assert.equal(FX.effectKind({ statuses: new Set(["sreDumpshock"]), flags: {} }), "status");
  assert.equal(FX.effectKind({ statuses: new Set(["cybervirus"]), flags: {} }), "marker");
  assert.equal(FX.effectKind({ statuses: new Set(), flags: { "shadowrun-edge": { substance: { id: "x" } } } }), "module");
  const actor = {};
  assert.equal(FX.effectKind({ statuses: new Set(), flags: {}, parent: { name: "Armor" } }, actor), "item");
  console.log("effects OK");
}
