// Builds the Edge sheet's data from a sample actor and renders its template outside Foundry.
// Run: node tools/test_sheet.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Handlebars from "handlebars";
import {
  buildSheetContext, buildSkillsContext, buildCombatContext, buildMagicContext, buildMatrixContext, buildGearContext, buildSocialContext,
  metatypeMax, monitorPenalty, attackRatingText, matrixActionPool, sustainedPenalty,
} from "../scripts/sheet/context.mjs";
import { METATYPES, SKILLS } from "../scripts/chargen/rules.mjs";

const lang = JSON.parse(readFileSync(new URL("../lang/pl/shadowrun-edge.json", import.meta.url), "utf8"));
const L = (key) => key.split(".").reduce((o, k) => o?.[k], lang) ?? key;

// Wound penalties follow the system (actor.js _getWoundModifierPerMonitor).
assert.equal(monitorPenalty({ max: 10, dmg: 0 }), 0);
assert.equal(monitorPenalty({ max: 10, dmg: 3 }), 1);
assert.equal(monitorPenalty({ max: 10, dmg: 4 }), 1);
assert.equal(monitorPenalty({ max: 10, dmg: 9 }), 4, "last partial row full adds one");
assert.equal(attackRatingText([10, 10, 8, 0, 0]), "10/10/8/—/—");

const actor = {
  name: "Nightshade", img: "",
  getWoundModifier: () => 1,
  system: {
    metatype: "Elf", gender: "Kobieta", mortype: "magician",
    karma: 7, karma_total: 57, nuyen: 12450, reputation: 1, heat: 0, essence: "5.80",
    edge: { value: 2, max: 4 },
    physical: { max: 10, dmg: 4 }, stun: { max: 11, dmg: 2 }, overflow: { max: 2, dmg: 0 },
    initiative: { physical: { pool: 7, dicePool: 2 }, astral: { pool: 6, dicePool: 2 }, matrix: { pool: 7, dicePool: 1 } },
    defenserating: { physical: { pool: 6 } },
    defensepool: { physical: { pool: 7 }, damage_physical: { pool: 2 }, drain: { pool: 11 } },
    derived: { composure: { pool: 11 }, judge_intentions: { pool: 9 }, memory: { pool: 8 }, lift_carry: { pool: 8 } },
    skills: { perception: { pool: 5 }, sorcery: { pool: 12 } },
    walk: 10, sprint: 15, perHit: 1,
  },
  items: [
    { id: "w1", name: "Ares Predator VI", type: "gear", system: { type: "WEAPON_FIREARMS", pool: 4, dmgDef: "3P", attackRating: [10, 10, 8, 0, 0], modes: { SA: true, BF: true }, ammocount: 12, ammocap: 15 } },
    { id: "s1", name: "Kula Many", type: "spell", system: { drain: 5, category: "combat" } },
    { id: "q1", name: "Bystrość", type: "quality", system: {} },
  ],
};
const ctx = buildSheetContext(actor, { L, config: { MOR_TYPES: { magician: "Mag" }, spell_category: {} } });

assert.equal(ctx.edge.pips.length, 7);
assert.equal(ctx.edge.pips.filter((p) => p.on).length, 2);
assert.equal(ctx.edge.pips.filter((p) => p.available).length, 4);
assert.equal(ctx.monitors.length, 3);
assert.equal(ctx.monitors[0].boxes.filter((b) => b.filled).length, 4);
assert.equal(ctx.monitors[0].boxes[2].label, "−1");
assert.equal(ctx.wound, 1);
assert.deepEqual(ctx.initiative.map((i) => i.id), ["physical", "astral", "matrix"]);
assert.deepEqual(ctx.actions, { major: 1, minor: 3 });
assert.equal(ctx.defense.test.value, 6, "defense test shows the wound penalty");
assert.equal(ctx.defense.test.raw, 7, "rolls get the raw pool (the system dialog subtracts wounds)");
assert.equal(ctx.defense.soak.value, 2, "damage resistance ignores wounds");
assert.equal(ctx.weapons.length, 1);
assert.equal(ctx.weapons[0].ar, "10/10/8/—/—");
assert.equal(ctx.weapons[0].ammo.rounds.filter(Boolean).length, 12);
assert.equal(ctx.spells[0].pool.value, 11);
assert.ok(ctx.warnings.some((w) => w.text.includes("−1")));

// Mundane characters have no astral initiative and no spells section.
const mundane = buildSheetContext({ ...actor, system: { ...actor.system, mortype: "mundane" } }, { L });
assert.deepEqual(mundane.initiative.map((i) => i.id), ["physical", "matrix"]);
assert.equal(mundane.spells.length, 0);
// Missing data never crashes or produces NaN.
const empty = buildSheetContext({ name: "X", system: {}, items: [] }, { L });
assert.ok(!JSON.stringify(empty).includes("NaN"));

// Render the template with the context.
Handlebars.registerHelper("localize", (k) => L(k));
const source = readFileSync(new URL("../templates/sheet/edge-sheet.hbs", import.meta.url), "utf8");
const tabs = ["main", "skills"].map((id, i) => ({ id, label: id, active: i === 0 }));
const html = Handlebars.compile(source)({ ...ctx, editable: true, tabs, active: { main: true } });
assert.ok(html.includes("Ares Predator VI") && html.includes("Kula Many"));
assert.equal((html.match(/data-action="monitor"/g) ?? []).length, 23);

// Attributes & skills tab.
assert.equal(metatypeMax("Troll", METATYPES, L).bod, 9);
assert.equal(metatypeMax("Krasnolud", METATYPES, L).str, 8, "localized metatype names work");
assert.equal(metatypeMax("cokolwiek", METATYPES, L).bod, 6, "unknown text falls back to human");
const skActor = {
  ...actor,
  system: {
    ...actor.system,
    attributes: { bod: { base: 2, mod: 0, pool: 2 }, agi: { base: 3, pool: 3 }, rea: { base: 3, mod: 1, pool: 4 }, str: { pool: 1 }, wil: { pool: 6 },
      log: { pool: 5 }, int: { pool: 3 }, cha: { base: 5, pool: 5 }, mag: { base: 6, pool: 6 } },
    skills: { sorcery: { pool: 12, poolS: 14, specialization: "spellcasting" }, firearms: { pool: 4 }, tasking: { pool: 0 }, perception: { pool: 5 } },
  },
  _source: { system: { attributes: { rea: { base: 3 } }, edge: { max: 4 }, skills: { sorcery: { points: 6, specialization: "spellcasting" }, firearms: { points: 1 } } } },
  items: [...actor.items, { id: "k1", name: "Gangi Seattle", type: "skill", system: { genesisID: "knowledge" } },
    { id: "l1", name: "Sperethiel", type: "skill", system: { genesisID: "language", points: 4 } }],
};
const config = {
  ATTRIB_BY_SKILL: new Map([["sorcery", { attrib: "mag", useUntrained: false }], ["firearms", { attrib: "agi", useUntrained: true }]]),
  skill_special: { sorcery: { spellcasting: "Rzucanie czarów" } },
  AMMO_TYPES: { regular: "Standardowa", gel: "Żelowa" },
};
const sk = buildSkillsContext(skActor, { L, config, metatypes: METATYPES, skills: SKILLS });
assert.equal(sk.attributes.length, 9, "8 primary + Magic for a magician");
assert.equal(sk.attributes.find((a) => a.id === "rea").base, 3, "base comes from the source data");
assert.equal(sk.attributes.find((a) => a.id === "cha").max, 8, "elf Charisma max 8");
assert.ok(!sk.skills.some((x) => x.id === "tasking"), "tasking only for technomancers");
const sorc = sk.skills.find((x) => x.id === "sorcery");
assert.equal(sorc.points, 6);
assert.equal(sorc.specPool, 13, "spec pool from the system's poolS, minus wounds");
assert.equal(sorc.expPool, null);
assert.equal(sk.trainedCount, 2);
assert.equal(buildSkillsContext(skActor, { L, config, metatypes: METATYPES, skills: SKILLS, showAll: false }).skills.length, 2);
assert.deepEqual(sk.languages, [{ id: "l1", name: "Sperethiel", native: true }]);

// Combat tab.
const cbActor = { ...skActor, items: [...skActor.items,
  { id: "m1", name: "Pałka", type: "gear", system: { type: "WEAPON_CLOSE_COMBAT", pool: 3, dmgDef: "5S(e)", attackRating: [6, 0, 0, 0, 0] } },
  { id: "a1", name: "Kurtka pancerna", type: "gear", system: { type: "ARMOR", defense: 4, usedForPool: true } },
  { id: "x1", name: "Tłumik", type: "mod", system: { installedIn: { id: "w1" } } }] };
cbActor.system = { ...cbActor.system, defensepool: { ...actor.system.defensepool, astral: { pool: 9 } } };
const cb = buildCombatContext(cbActor, { L, config });
assert.equal(cb.ranged.length, 1);
assert.deepEqual(cb.ranged[0].ar, ["10", "10", "8", null, null]);
assert.equal(cb.ranged[0].extras, "Tłumik");
assert.equal(cb.ranged[0].ammo.types.find((t) => t.selected).value, "regular");
assert.equal(cb.melee[0].arFirst, "6");
assert.equal(cb.melee[0].extras, "", "a mod installed in another weapon is not listed");
assert.equal(cb.unarmed.dv, "1O", "STR 1 → 1 stun");
assert.equal(cb.unarmed.ar, 5, "REA 4 + STR 1");
assert.equal(cb.armor[0].worn, true);
assert.deepEqual(cb.resist.map((r) => r.id), ["physical", "astral", "damage_physical"]);
assert.equal(cb.resist.find((r) => r.id === "damage_physical").minus, 0, "damage resistance ignores wounds");

Handlebars.registerHelper("eq", (a, b) => a === b);
Handlebars.registerHelper("gt", (a, b) => a > b);
const page = (active, extra) => Handlebars.compile(source)({ ...ctx, ...extra, editable: true, tabs, active: { [active]: true } });
const skHtml = page("skills", { sk });
assert.ok(skHtml.includes('name="system.attributes.bod.base"') && skHtml.includes('name="system.skills.sorcery.points"'));
assert.ok(skHtml.includes('<option value="spellcasting" selected>'));
const cbHtml = page("combat", { combat: cb });
assert.ok(cbHtml.includes("Pałka") && cbHtml.includes('data-item-field="system.ammoLoaded"') && cbHtml.includes("sre-es-toggle on"));
// Magic tab.
const mgActor = { ...cbActor, items: [...cbActor.items,
  { id: "s2", name: "Zwiększenie refleksów", type: "spell", system: { duration: "sustained", isSustained: true, drain: 4 } },
  { id: "r1", name: "Obserwator", type: "ritual", system: { threshold: 3 } },
  { id: "p1", name: "Zwiększone refleksy", type: "adeptpower", system: { hasLevel: true, level: 2, cost: 1.5 } }] };
assert.equal(sustainedPenalty(mgActor), 2, "−2 per sustained spell");
const mg = buildMagicContext(mgActor, { L, config: { spell_duration: { sustained: "Podtrz." } } });
assert.equal(mg.penalty, 3, "wound 1 + sustained 2");
assert.equal(mg.spells.find((x) => x.id === "s2").canSustain, true);
assert.equal(mg.spells[0].pool.value, 9, "sorcery 12 − 3");
assert.equal(mg.ppUsed, 3, "1.5 PP × level 2");
assert.equal(mg.rituals[0].threshold, 3);

// Matrix tab.
const action = { skill: "cracking", specialization: "hacking", attrib: "log" };
assert.equal(matrixActionPool(action, { skills: { cracking: { pool: 7, points: 3, modifier: 0, specialization: "hacking" } }, attributes: { log: { pool: 5 } } }), 10);
assert.equal(matrixActionPool(action, { skills: { cracking: { pool: 0, points: 0 } }, attributes: { log: { pool: 5 } } }), 0, "untrained cracking: no pool");
const mxActor = { ...mgActor, system: { ...mgActor.system, overwatch: 12, persona: { used: { a: 4, s: 3, d: 2, f: 1 } } },
  items: [...mgActor.items, { id: "d1", name: "Microdeck", type: "gear", system: { type: "ELECTRONICS", subtype: "CYBERDECK", a: 4, s: 3, devRating: 1, usedForPool: true, program: { armor: true } } }] };
const mx = buildMatrixContext(mxActor, { L, config: { MATRIX_ACTIONS: { brute_force: action, change_icon: {} }, PROGRAMS: [{ id: "armor", type: 1 }, { id: "browse", type: 0 }] } });
assert.equal(mx.overwatch.pct, 30);
assert.equal(mx.devices[0].asdf[2].v, null, "missing D shows as —");
assert.equal(mx.activeDeck.programs.find((x) => x.id === "armor").on, true);
assert.deepEqual(mx.actions.map((a) => a.id), ["brute_force"], "actions without a skill are not listed");
assert.equal(mx.persona[2].k, L("SRE.Sheet.Asdf.d"));

// Gear tab.
const grActor = { ...mxActor, items: [...mxActor.items,
  { id: "c1", name: "Cyberoczy", type: "gear", flags: { "shadowrun-edge": { grade: { id: "alpha" } } }, system: { type: "CYBERWARE", rating: 2, essence: 0.16, capacity: 8 } },
  { id: "g1", name: "Medkit", type: "gear", system: { type: "SURVIVAL", rating: 3, countable: true, count: 2 } }] };
const gr = buildGearContext(grActor, { L, config: { GEAR_TYPES: { SURVIVAL: "Przetrwanie" } } });
assert.equal(gr.augments[0].grade, "Alfa");
assert.ok(!gr.groups.some((g) => g.type === "ARMOR" || g.type === "WEAPON_FIREARMS" || g.type === "CYBERWARE"), "weapons, armor and augments are not gear groups");
assert.ok(gr.groups.some((g) => g.type === "ELECTRONICS"), "devices also listed under electronics");
assert.equal(gr.groups.find((g) => g.type === "SURVIVAL").items[0].count, 2);

// Contacts & notes tab.
const soActor = { ...grActor, items: [...grActor.items, { id: "co1", name: "Mr Johnson", type: "contact", system: { rating: 3, loyalty: 2, favors: 1 } }],
  _source: { system: { ...grActor._source.system, karma: 7, karma_total: 57, nuyen: 12450, notes: "<p>x</p>" } } };
const so = buildSocialContext(soActor, { L });
assert.equal(so.contacts[0].legwork, 6, "legwork pool = connection × 2");
assert.equal(so.contacts[0].ratingDots.filter(Boolean).length, 3);
assert.equal(so.hasDescription, false, "3.x actors have no description field");

const mgHtml = page("magic", { magic: mg });
assert.ok(mgHtml.includes('data-action="toggleSustain"') && mgHtml.includes("PP: 3"));
const mxHtml = page("matrix", { matrix: mx });
assert.ok(mxHtml.includes('data-matrix-id="brute_force"') && mxHtml.includes('data-program="armor"'));
const grHtml = page("gear", { gear: gr });
assert.ok(grHtml.includes("Cyberoczy") && grHtml.includes('data-action="count"'));
const soHtml = page("social", { social: { ...so, notesHTML: "<p>x</p>" } });
assert.ok(soHtml.includes('name="system.karma_total"') && soHtml.includes('<prose-mirror name="system.notes"'));

// Only source fields may be named form fields: prepared values (pool, mod) must never be submitted back.
for (const html of [skHtml, cbHtml, mgHtml, mxHtml, grHtml, soHtml]) {
  for (const [, name] of html.matchAll(/name="(system\.[^"]+)"/g)) {
    assert.match(name, /\.(base|max|points|specialization|expertise)$|^system\.(karma|karma_total|reputation|heat|nuyen|notes|description)$/, `form field ${name}`);
  }
}

// Every data-action has a handler (own or inherited from ActorSheetV2) and none is reserved by ApplicationV2.
globalThis.foundry = { applications: { api: { HandlebarsApplicationMixin: (c) => c }, sheets: { ActorSheetV2: class {} } } };
globalThis.Hooks = { once() {}, on() {} };
const { EdgeActorSheet } = await import("../scripts/sheet/edge-sheet.mjs");
const INHERITED = ["showPortraitArtwork"];
for (const action of [...source.matchAll(/data-action="([^"]+)"/g)].map((m) => m[1])) {
  assert.ok(!["close", "tab", "toggleControls"].includes(action), `reserved data-action="${action}"`);
  assert.ok(action in EdgeActorSheet.DEFAULT_OPTIONS.actions || INHERITED.includes(action), `no handler for data-action="${action}"`);
}

console.log("sheet OK");
