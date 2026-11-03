// The compact Edge sheets (NPC / critter, spirit, vehicle): their data from sample actors, grunt groups, and the
// template rendered outside Foundry. Run: node tools/test_compact.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Handlebars from "handlebars";
import { buildNpcContext, buildSpiritContext, buildVehicleContext, buildHostContext, gruntGroup } from "../scripts/sheet/compact-context.mjs";
import { IC, icStats } from "../scripts/matrix-rules.mjs";

const lang = JSON.parse(readFileSync(new URL("../lang/pl/shadowrun-edge.json", import.meta.url), "utf8"));
const L = (key) => key.split(".").reduce((o, k) => o?.[k], lang) ?? key;

const attrs = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { pool: v }]));
const npc = {
  type: "NPC", name: "Halloweener", getWoundModifier: () => 1,
  system: {
    rating: 2, metatype: "Ork", attributes: attrs({ bod: 5, agi: 4, rea: 3, str: 5, wil: 3, log: 2, int: 3, cha: 2, mag: 0 }), essence: 6,
    physical: { max: 11, dmg: 4 }, stun: { max: 0, dmg: 0 }, initiative: { physical: { pool: 6, dicePool: 1 } },
    defenserating: { physical: { pool: 5 } }, defensepool: { physical: { pool: 6 }, damage_physical: { pool: 7 } }, derived: { resist_toxin: { pool: 8 } },
    skills: { firearms: { points: 3, pool: 7 }, athletics: { points: 2, pool: 6 }, piloting: { points: 0, pool: 0 } }, walk: 10, sprint: 15, notes: "<p>Gang</p>",
  },
  items: [
    { id: "w1", name: "Ares Predator VI", type: "gear", system: { type: "WEAPON_FIREARMS", pool: 7, dmgDef: "3P", attackRating: [10, 10, 8, 0, 0], modes: { SA: true }, ammocount: 12, ammocap: 15 } },
    { id: "g1", name: "Kurtka pancerna", type: "gear", system: { type: "ARMOR" } },
    { id: "p1", name: "Kły", type: "critterpower", system: {} },
  ],
};
const n = buildNpcContext(npc, { L });
assert.deepEqual(n.attributes.map((a) => a.label), ["BUD", "ZRĘ", "REA", "SIŁ", "WOL", "LOG", "INT", "CHA", "ESS"], "no Magic at 0, Essence shown");
assert.equal(n.monitors.length, 1, "grunts: only the Physical monitor when Stun has no boxes");
assert.equal(n.monitors[0].penalty, 1);
assert.deepEqual(n.skills.map((s) => s.id), ["athletics", "firearms"].sort((a, b) => L(`skill.${a}`).localeCompare(L(`skill.${b}`))), "trained skills only");
assert.equal(n.weapons[0].name, "Ares Predator VI");
assert.deepEqual(n.resist.map((r) => r.pool), [6, 7, 8]);
assert.deepEqual(n.powers.map((p) => p.name), ["Kły"]);
assert.deepEqual(n.gear.map((g) => g.name), ["Kurtka pancerna"]);

// Spirit: Force and services from the module's summoning flag.
const spirit = { ...npc, type: "Spirit", system: { ...npc.system, rating: 5, spiritType: "earth", initiative: { physical: { pool: 10, dicePool: 2 }, astral: { pool: 14, dicePool: 3 } } },
  flags: { "shadowrun-edge": { spirit: { services: 3, summoner: "a1" } } } };
const sp = buildSpiritContext(spirit, { L });
assert.equal(sp.force, 5);
assert.equal(sp.services, 3);
assert.equal(sp.chips[0].value, 3);
assert.equal(buildSpiritContext({ ...spirit, flags: {} }, { L }).services, null, "not summoned through the module");

// Vehicle: stats, Body × 2 resistance, tests with a pool only.
const car = {
  type: "Vehicle", name: "Ford Americar",
  system: { handlOn: 4, handlOff: 5, accOn: 15, spdiOn: 20, tspd: 120, bod: 11, arm: 2, pil: 1, sen: 1, sea: 4, vtype: "ground_craft",
    physical: { max: 14, dmg: 3 }, stun: { max: 9, dmg: 0 }, skills: { piloting: { pool: 11 }, evasion: { pool: 0 } } },
  items: [{ id: "a1", name: "Clearsight", type: "software", system: { rating: 3 } }],
};
const v = buildVehicleContext(car, { L });
assert.equal(v.stats[0].value, "4/5");
assert.equal(v.soak, 22, "Body × 2 (p. 114 examples)");
assert.deepEqual(v.tests.map((t) => t.id), ["piloting", "perception"], "Perception falls back to Sensor; Evasion 0 left out");
assert.equal(v.monitors.length, 2);
assert.deepEqual(v.autosofts, [{ id: "a1", name: "Clearsight", rating: 3 }]);

// Grunt groups: the system's bonuses (AR +members−1, dice +⌊(members−1)/2⌋).
const tokens = [
  { groupId: 1, name: "H1", dmg: 4, max: 11 }, { groupId: "1", name: "H2", dmg: 0, max: 11 },
  { groupId: 1, name: "H3", dmg: 11, max: 11 }, { groupId: 1, name: "H4", dmg: 2, max: 11 }, { groupId: 2, name: "X", dmg: 0, max: 9 },
];
const g = gruntGroup(1, tokens);
assert.equal(g.members.length, 4);
assert.deepEqual([g.arMod, g.diceMod], [3, 1]);
assert.equal(g.members[2].down, true);
assert.equal(gruntGroup(undefined, tokens), null);

// Template renders for all three kinds.
const H = Handlebars.create();
H.registerHelper("localize", (key, o) => {
  let t = L(key);
  for (const [k, val] of Object.entries(o?.hash ?? {})) t = t.replace(`{${k}}`, val);
  return t;
});
H.registerHelper("ne", (a, b) => a !== b);
const template = H.compile(readFileSync(new URL("../templates/sheet/edge-compact.hbs", import.meta.url), "utf8"));
const base = { name: "X", img: "", initial: "X", editable: true, statuses: [], themeSwitch: { icon: "fa-sun", label: "" }, notesHTML: "" };
const htmlNpc = template({ ...base, ...n, isNpc: true, group: g });
assert.ok(htmlNpc.includes("Ares Predator VI") && htmlNpc.includes('data-action="groupCreate"') && htmlNpc.includes("H3"));
const htmlSpirit = template({ ...base, ...sp, isSpirit: true });
assert.ok(htmlSpirit.includes('data-action="services"') && htmlSpirit.includes('data-action="banish"'));
const htmlCar = template({ ...base, ...v, isVehicle: true });
assert.ok(htmlCar.includes('data-action="vehicleTest"') && htmlCar.includes("22") && !htmlCar.includes('data-action="groupCreate"'));
// Vehicle with the driving panels.
const drive = { speed: 28, top: 160, accel: 9, speedPct: 18, pool: 8, pilot: 3, sensor: 3, drone: true, offRoad: false,
  modes: [{ id: "manual", label: "Ręcznie", selected: true }], owners: [{ id: "a1", name: "Turbo Bunny", selected: true }],
  tiles: [{ label: "Dystans", value: "32 m", hint: "28 + 4.5" }], droneIni: { base: 6, dice: 4 },
  droneTests: [{ id: "CLEARSIGHT", label: "Clearsight", rating: 3, attrLabel: "Sensor", pool: 6 }, { id: "STEALTH", label: "Stealth", pool: 0, missing: true }],
  slots: { used: 1, max: 2 }, groupCount: 2, group: "A, B", rcc: "Maersk Spider", rccMax: 12 };
const htmlDrive = template({ ...base, ...v, isVehicle: true, drive });
for (const a of ["speed", "handling", "drivers", "ram", "droneTest", "droneInitiative", "groupCommand"]) assert.ok(htmlDrive.includes(`data-action="${a}"`), a);
assert.ok(htmlDrive.includes('name="system.vehicle.opMode"') && htmlDrive.includes("Turbo Bunny"));

// Host (system 4.x): ASDF, IC table, personas inside.
const hostActor = { type: "host", name: "Stuffer Shack HQ", system: { rating: 4, convergenceThreshold: 40, matrix: { attributes: { attack: 5, sleaze: 4, dataProcessing: 7, firewall: 6 } } },
  flags: { "shadowrun-edge": { ic: ["patrol", "killer"] } } };
const h = buildHostContext(hostActor, { L, IC, icStats, personas: [{ name: "Glitch", access: "admin", illegal: true, os: 34, osShown: true, accessLabel: "Admin" }] });
assert.deepEqual(h.tiles.map((t) => t.value), [4, 5, 4, 7, 6, 40]);
assert.equal(h.running, 2);
assert.equal(h.ic.find((i) => i.id === "killer").on, true);
assert.equal(h.ic.find((i) => i.id === "patrol").attacks, false);
assert.equal(h.personas[0].cls, "a");
const hostTemplate = H.compile(readFileSync(new URL("../templates/sheet/edge-host.hbs", import.meta.url), "utf8"));
const htmlHost = hostTemplate({ ...h, name: "Stuffer Shack HQ", initial: "S", editable: true, themeSwitch: { icon: "fa-sun", label: "" } });
assert.ok(htmlHost.includes('data-action="icAttack"') && htmlHost.includes("Glitch") && htmlHost.includes('name="system.rating"'));
console.log("compact sheets OK");
