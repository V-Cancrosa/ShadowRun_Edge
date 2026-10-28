// Character creation rules (SR6 core pp. 62–69). Run: node tools/test_chargen.mjs
import assert from "node:assert/strict";
import { advancementCost, emptyDraft, evaluateDraft, effectiveRow } from "../scripts/chargen/rules.mjs";
import { buildCharacter, repairUpdate } from "../scripts/chargen/build.mjs";

const keys = (r) => r.errors.map((e) => e.key);

// Advancement table (p. 69): 0→6 = 105, 4→6 = 55, 1→2 = 10.
assert.equal(advancementCost(0, 6), 105);
assert.equal(advancementCost(4, 6), 55);
assert.equal(advancementCost(1, 2), 10);
assert.equal(effectiveRow("B", "street"), "C");
assert.equal(effectiveRow("E", "street"), "E");

// Tom (p. 64): elf spellcaster, Magic A, Attributes B, Skills C, Metatype D, Resources E.
let d = emptyDraft();
Object.assign(d, { metatype: "elf", magicType: "full" });
d.priorities = { magic: "A", attributes: "B", skills: "C", metatype: "D", resources: "E" };
let r = evaluateDraft(d);
assert.deepEqual(keys(r), []);
assert.equal(r.magicBase, 4);
assert.equal(r.budgets.attributes.total, 16);
assert.equal(r.budgets.skills.total, 20);
assert.equal(r.budgets.adjustment.total, 4);
assert.equal(r.nuyen, 8000);
assert.equal(r.magicChoices.spells, 8);
assert.equal(r.budgets.karma.total, 50);

// Elf cannot be Metatype A; mundane only at Magic E.
d.priorities = { metatype: "A", magic: "B", attributes: "C", skills: "D", resources: "E" };
assert.ok(keys(evaluateDraft(d)).includes("MetatypeRow"));
d.priorities = { magic: "A", attributes: "B", skills: "C", metatype: "D", resources: "E" };
d.magicType = "mundane";
assert.ok(keys(evaluateDraft(d)).includes("MagicRow"));
d.magicType = "full";

// Each row only once.
d.priorities.resources = "A";
assert.ok(keys(evaluateDraft(d)).includes("PriorityTwice"));
d.priorities.resources = "E";

// Elf Charisma 1–8: 7 points of attributes + 0 adjust → Cha 8 is the one attribute at max; a second one fails.
d.attrPoints.cha = 7;
r = evaluateDraft(d);
assert.equal(r.final.cha, 8);
assert.deepEqual(keys(r), []);
d.attrPoints.agi = 6;
assert.ok(keys(evaluateDraft(d)).includes("AttrTwoAtMax"));
d.attrPoints.agi = 0;

// Adjustment points: Charisma (elf max 8) and Magic yes, Logic (max 6) no.
d.adjust.log = 1;
assert.ok(keys(evaluateDraft(d)).includes("AdjustNotAllowed"));
d.adjust.log = 0;
d.adjust.magic = 2;
d.adjust.edge = 2;
r = evaluateDraft(d);
assert.equal(r.final.magic, 6);
assert.equal(r.final.edge, 3);
assert.deepEqual(keys(r), []);

// Skills: 6 is the max, one skill at max; a specialization costs a point.
d.skills.sorcery.points = 6;
d.skills.sorcery.spec = "spellcasting";
d.skills.conjuring.points = 6;
r = evaluateDraft(d);
assert.ok(keys(r).includes("SkillTwoAtMax"));
assert.equal(r.budgets.skills.used, 13);
d.skills.conjuring.points = 5;
d.skills.conjuring.karma = 0;

// Karma: Charisma 8→… not allowed; raise Willpower 1→3 with Karma = 10 + 15 = 25.
d.attrKarma.wil = 2;
r = evaluateDraft(d);
assert.equal(r.final.wil, 3);
assert.equal(r.budgets.karma.used, 25);

// Qualities: negatives add Karma, net bonus over 20 fails, more than six fails.
d.qualities = [{ id: "bad_luck" }, { id: "low_pain_tolerance" }, { id: "allergy", karma: 11, detail: "pollen" }];
r = evaluateDraft(d);
assert.equal(r.negative, 31);
assert.ok(keys(r).includes("QualitiesNet"));
d.qualities = [{ id: "bad_luck" }, { id: "analytical_mind" }];
r = evaluateDraft(d);
assert.equal(r.budgets.karma.total, 60);
assert.equal(r.positive, 3);
assert.deepEqual(keys(r), []);
d.qualities = Array.from({ length: 7 }, () => ({ id: "ambidextrous" }));
assert.ok(keys(evaluateDraft(d)).includes("QualitiesCount"));

// Aptitude lets one skill reach 7; Exceptional raises an attribute maximum.
d.qualities = [{ id: "aptitude", detail: "sorcery" }, { id: "exceptional", detail: "log" }];
d.skills.sorcery.karma = 1;
r = evaluateDraft(d);
assert.ok(!keys(r).includes("SkillOverMax"));
assert.equal(r.max.log, 7);

// In Debt: 5,000 nuyen per Karma.
d.qualities = [{ id: "in_debt" }];
d.skills.sorcery.karma = 0;
d.karmaToNuyen = 2;
assert.equal(evaluateDraft(d).nuyen, 8000 + 10000);

// Contacts: Charisma × 6 points, ratings up to Charisma.
d.contacts = [{ name: "Fixer", connection: 8, loyalty: 9 }];
assert.ok(keys(evaluateDraft(d)).includes("ContactOverCha"));

// Racial qualities come with the metatype; trolls get Built Tough 2 as a +2 Physical monitor effect.
const t = emptyDraft();
Object.assign(t, { metatype: "troll", magicType: "mundane" });
t.priorities = { metatype: "A", attributes: "B", skills: "C", resources: "D", magic: "E" };
r = evaluateDraft(t);
assert.deepEqual(keys(r), []);
const { actor, items } = buildCharacter(t, r, { metatype: "Troll", racial: "rasowa", unnamed: "Nowy" });
assert.equal(actor.type, "Player");
assert.equal(actor.system.mortype, "mundane");
assert.equal(actor.system.nuyen, 50000);
assert.equal(actor.system.attributes.bod.base, 1);
const built = items.find((i) => i.name.startsWith("Built Tough"));
assert.equal(built.effects[0].changes[0].key, "system.physical.mod");
assert.equal(built.effects[0].changes[0].value, "2");
assert.equal(items.filter((i) => i.type === "quality").length, 3);

// The system's pool formulas (actor.js): a missing field must not turn a pool into NaN (0d6 rolls).
for (const [id, a] of Object.entries(actor.system.attributes)) {
  assert.ok(Number.isFinite(Math.max(0, parseInt(a.base) + Math.min(4, parseInt(a.mod)))), `attribute ${id}`);
}
for (const [id, sk] of Object.entries(actor.system.skills)) {
  assert.ok(Number.isFinite(3 + sk.points + sk.modifier), `skill ${id}`);
}
assert.deepEqual(repairUpdate(actor.system), {}, "freshly built actor needs no repair");
// Actors from creator <= 0.5.0 only had { base } / { points, specialization }.
const old = repairUpdate({ attributes: { bod: { base: 9 }, mag: { base: 0 } }, skills: { firearms: { points: 2, specialization: "" } } });
assert.equal(old["system.attributes.bod.mod"], 0);
assert.equal(old["system.attributes.mag.mod"], 0);
assert.equal(old["system.skills.firearms.modifier"], 0);
assert.equal(old["system.attributes.bod.base"], undefined, "existing values are kept");

console.log("chargen OK");
