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
