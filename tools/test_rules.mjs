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
