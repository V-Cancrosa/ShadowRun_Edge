// Edge item sheet data and template, and the give/delete transfer plan, outside Foundry.
// Run: node tools/test_item_sheet.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Handlebars from "handlebars";

globalThis.Hooks = { once() {}, on() {} };
globalThis.foundry = { applications: { api: { HandlebarsApplicationMixin: (c) => c }, sheets: { ItemSheetV2: class {}, ActorSheetV2: class {} } } };
const { buildItemContext, itemKind, changeText } = await import("../scripts/sheet/item-context.mjs");
const { planTransfer, installedMods } = await import("../scripts/give.mjs");
const { GRADES, gradeUpdates, baseValues } = await import("../scripts/grades.mjs");
const { EdgeItemSheet } = await import("../scripts/sheet/edge-item-sheet.mjs");

const lang = JSON.parse(readFileSync(new URL("../lang/pl/shadowrun-edge.json", import.meta.url), "utf8"));
const L = (key) => key.split(".").reduce((o, k) => o?.[k], lang) ?? key;
// Gear fields every gear item has (template.json "gear").
const GEAR = { type: "", subtype: "", count: 0, countable: false, availDef: "", avail: 0, price: 0, needsRating: false, rating: 0, usedForPool: false, accessories: "",
  essence: 0, capacity: 0, defense: 0, social: 0, devRating: 0, a: 0, s: 0, d: 0, f: 0, progSlots: 0, description: "" };
const gear = (system) => ({ ...GEAR, ...system });
const doc = (data) => ({ ...data, _source: { system: data.system }, toObject: () => structuredClone({ _id: data.id, name: data.name, type: data.type, system: data.system, flags: data.flags ?? {} }) });

// Kinds.
assert.equal(itemKind({ type: "gear", system: { type: "WEAPON_FIREARMS" } }), "ranged");
assert.equal(itemKind({ type: "gear", system: { type: "WEAPON_CLOSE_COMBAT" } }), "melee");
assert.equal(itemKind({ type: "gear", system: { type: "CYBERWARE", subtype: "CYBERJACK" } }), "augment", "a cyberjack is an augmentation first");
assert.equal(itemKind({ type: "gear", system: { type: "ELECTRONICS", subtype: "CYBERDECK" } }), "device");
assert.equal(itemKind({ type: "spell", system: {} }), "spell");
assert.deepEqual(changeText({ key: "system.attributes.rea.mod", value: "1" }, L), { label: "attrib.rea", value: "+1" });
assert.equal(changeText({ key: "system.initiative.physical.diceMod", value: "@item.system.rating" }, L).value, L("SRE.ItemSheet.ByRating"));

// A weapon on a character, with an installed mod.
const actorItems = [];
const actor = { items: actorItems, system: {} };
const weapon = doc({ id: "w1", uuid: "Actor.a.Item.w1", name: "Ares Predator VI", type: "gear", parent: actor, effects: [],
  system: gear({ type: "WEAPON_FIREARMS", subtype: "PISTOLS_HEAVY", price: 750, availDef: "2L", dmg: 3, stun: false, dmgDef: "3P", skill: "firearms", skillSpec: "pistols",
    modes: { SA: true, BF: true }, attackRating: [10, 10, 8, 0, 0], ammocap: 15, ammocount: 12, ammoLoaded: "regular", pool: 8, wild: false, product: "core", page: 254 }) });
const silencer = doc({ id: "m1", uuid: "Actor.a.Item.m1", name: "Tłumik", type: "mod", parent: actor, flags: { "shadowrun-edge": { slot: "barrel" } }, system: { embeddedInUuid: "Actor.a.Item.w1" } });
const loose = doc({ id: "m2", name: "Celownik", type: "mod", parent: actor, system: { embeddedInUuid: null } });
actorItems.push(weapon, silencer, loose);
const config = {
  GEAR_TYPES: { WEAPON_FIREARMS: "Broń palna", CYBERWARE: "Cyberware" }, GEAR_SUBTYPES: { WEAPON_FIREARMS: { PISTOLS_HEAVY: "Ciężkie pistolety" } },
  WEAPON_STUN_OPTION: { false: "Fizyczne", true: "Ogłuszające" }, skill_special: { firearms: { pistols: "Pistolety" } }, AMMO_TYPES: { regular: "Standardowa", gel: "Żelowa" },
  spell_category: { combat: "Walka" }, spell_type: { mana: "M" }, spell_range: { line_of_sight_area: "LOS (obszar)" }, spell_duration: { instantaneous: "Natychm." }, spell_damage: { physical: "F" },
};
const w = buildItemContext(weapon, { L, config, skills: ["firearms", "close_combat"] });
assert.equal(w.kind, "ranged");
assert.equal(w.ar.length, 5);
assert.equal(w.ar[2].value, 8);
assert.deepEqual(w.modes.filter((m) => m.on).map((m) => m.id), ["SA", "BF"]);
assert.equal(w.stunOptions.find((o) => o.selected).value, "false");
assert.equal(w.mods.length, 1, "only mods installed in this weapon");
assert.equal(w.mods[0].slot, "Lufa");
assert.equal(w.pool, 8);
assert.ok(w.chips.some((c) => c.value === "CORE s. 254"));

// Transfer plan: the weapon goes with its mod; a countable stack can be split.
assert.deepEqual(installedMods(weapon, actorItems).map((m) => m.id), ["m1"]);
const plan = planTransfer(weapon, actorItems);
assert.deepEqual(plan.deleteIds, ["m1", "w1"], "mods first, then the host");
assert.equal(plan.mods.length, 1);
assert.equal(plan.host._id, undefined, "ids are not copied");
const stack = doc({ id: "g1", name: "Plaster", type: "gear", system: { countable: true, count: 5 } });
const split = planTransfer(stack, [stack], 2);
assert.equal(split.host.system.count, 2);
assert.deepEqual(split.sourceUpdate, { _id: "g1", "system.count": 3 });
assert.deepEqual(split.deleteIds, []);
assert.deepEqual(planTransfer(stack, [stack], 5).deleteIds, ["g1"], "giving the whole stack moves it");

// A graded implant.
const eyes = doc({ id: "c1", name: "Cyberoczy", type: "gear", parent: null, effects: [{ id: "e1", name: "Oczy", changes: [{ key: "system.skills.perception.modifier", value: "2" }] }],
  flags: { "shadowrun-edge": { grade: { id: "alpha", base: { essence: 0.2, price: 4500, avail: 4, availDef: "4" } } } },
  system: gear({ type: "CYBERWARE", rating: 2, needsRating: true, essence: 0.16, price: 5400, capacity: 8 }) });
const c = buildItemContext(eyes, { L, config, grades: GRADES, gradeUpdates, baseValues });
assert.equal(c.kind, "augment");
assert.equal(c.grades.find((g) => g.active).id, "alpha");
assert.equal(c.grades.find((g) => g.id === "standard").essence, "0.20", "grade previews start from the standard values");
assert.equal(c.effects[0].changes[0].value, "+2");

// A spell.
const spell = doc({ id: "s1", name: "Kula Many", type: "spell", parent: null, effects: [], system: { category: "combat", type: "mana", range: "line_of_sight_area", duration: "instantaneous", drain: 5, damage: "physical", isOpposed: true, alchemic: false, description: "" } });
const sp = buildItemContext(spell, { L, config });
assert.equal(sp.typeOptions.find((o) => o.selected).value, "mana");
assert.equal(sp.hasMods, false);

// Templates: every named field is an existing source field (or the AR helper), every action has a handler.
for (const h of ["eq", "or"]) Handlebars.registerHelper(h, h === "eq" ? (a, b) => a === b : (...a) => a.slice(0, -1).some(Boolean));
Handlebars.registerHelper("localize", (k) => L(k));
const source = readFileSync(new URL("../templates/sheet/edge-item-sheet.hbs", import.meta.url), "utf8");
const render = (ctx, tab) => Handlebars.compile(source)({ ...ctx, editable: true, tabs: [], active: { [tab]: true }, descriptionHTML: "" });
for (const [item, ctx] of [[weapon, w], [eyes, c], [spell, sp]]) {
  for (const tab of ["stats", "mods", "description", "effects"]) {
    const html = render(ctx, tab);
    for (const [, name] of html.matchAll(/name="([^"]+)"/g)) {
      if (name === "name" || /^sre\.ar\.\d$/.test(name) || /^flags\.shadowrun-edge\.(defense\.[01]|blast\.(gz|close|near|radius))$/.test(name)) continue;
      assert.ok(name.startsWith("system.") && name.slice(7).split(".")[0] in item._source.system || name === "system.description",
        `${item.name}/${tab}: form field ${name} is not a source field`);
    }
  }
}
assert.ok(render(w, "stats").includes('name="sre.ar.4"'));
assert.ok(render(w, "mods").includes("Tłumik"));
const INHERITED = ["editImage"];
for (const action of [...source.matchAll(/data-action="([^"]+)"/g)].map((m) => m[1])) {
  assert.ok(!["close", "tab", "toggleControls"].includes(action), `reserved data-action="${action}"`);
  assert.ok(action in EdgeItemSheet.DEFAULT_OPTIONS.actions || INHERITED.includes(action), `no handler for data-action="${action}"`);
}

console.log("item sheet OK");
