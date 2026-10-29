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
