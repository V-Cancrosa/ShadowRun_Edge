// Builds the Edge sheet's data from a sample actor and renders its template outside Foundry.
// Run: node tools/test_sheet.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Handlebars from "handlebars";
import { buildSheetContext, monitorPenalty, attackRatingText } from "../scripts/sheet/context.mjs";

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
