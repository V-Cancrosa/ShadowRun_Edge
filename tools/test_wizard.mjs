// Builds the item wizard outside Foundry and renders its template, so errors in the constructor or the
// context show up without a running game. Run: node tools/test_wizard.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Handlebars from "handlebars";

// ApplicationV2 has read-only properties; assigning one of them in a subclass throws in Foundry.
class ApplicationV2 {
  constructor(options = {}) { this.options = options; }
  get state() { return 0; }
  get form() { return null; }
  get element() { return null; }
  get rendered() { return false; }
  get id() { return "app"; }
  get window() { return {}; }
  get hasFrame() { return true; }
  get minimized() { return false; }
}
globalThis.foundry = {
  applications: { api: { ApplicationV2, HandlebarsApplicationMixin: (c) => c } },
  utils: { deepClone: (x) => structuredClone(x), setProperty() {}, expandObject: (x) => x },
};
const lang = JSON.parse(readFileSync(new URL("../lang/pl/shadowrun-edge.json", import.meta.url), "utf8"));
const lookup = (key) => key.split(".").reduce((o, k) => o?.[k], lang) ?? key;
globalThis.game = {
  user: { isGM: true },
  i18n: { localize: lookup, format: (key) => lookup(key) },
  settings: { get: () => [] },
};
globalThis.CONFIG = { SR6: { GEAR_SUBTYPES: { WEAPON_FIREARMS: { PISTOLS_HEAVY: "Ciężki pistolet" }, ARMOR: { ARMOR_BODY: "Pancerz" } } } };
globalThis.Hooks = { on() {}, once() {} };
globalThis.fetch = async () => ({ ok: true, json: async () => [] });

for (const h of ["localize", "selectOptions", "checked"]) Handlebars.registerHelper(h, () => "");
const template = Handlebars.compile(readFileSync(new URL("../templates/item-wizard.hbs", import.meta.url), "utf8"));

const { ItemWizard } = await import("../scripts/wizard/item-wizard.mjs");
const { CATEGORIES } = await import("../scripts/wizard/categories.mjs");

for (const actor of [null, { name: "Runner" }]) {
  const wizard = new ItemWizard({ actor });
  assert.equal(wizard.wizardState.subtype, "PISTOLS_HEAVY");
  for (const category of Object.keys(CATEGORIES)) {
    wizard.wizardState.category = category;
    wizard.wizardState.type = CATEGORIES[category].types[0];
    const html = template(await wizard._prepareContext());
    assert.ok(html.includes('name="state.name"'), `template for ${category}`);
  }
}
// Karma vote: tallies, who may vote, and the shared card.
globalThis.Handlebars = { escapeExpression: (t) => String(t).replace(/</g, "&lt;") };
const { tally, canVote, renderCard } = await import("../scripts/karma-vote.mjs");
const vote = {
  status: "open", max: 5, noSelfVote: true,
  actors: [{ id: "a1", name: "Rook", img: "r.png" }, { id: "a2", name: "<Vex>", img: "v.png" }],
  votes: { a1: { u1: 3, u2: 4 }, a2: {} },
};
assert.deepEqual(tally(vote), { a1: { count: 2, average: 3.5, suggested: 4 }, a2: { count: 0, average: 0, suggested: 0 } });
assert.equal(canVote(vote, ["u1"], "u1", "a1"), false);
assert.equal(canVote(vote, ["u1"], "u2", "a1"), true);
assert.equal(canVote(vote, [], "u2", "zz"), false);
assert.equal(canVote({ ...vote, status: "closed" }, [], "u2", "a1"), false);
const card = renderCard(vote);
assert.ok(card.includes('data-value="5"') && !card.includes('data-value="6"'));
assert.ok(card.includes("&lt;Vex>"));
assert.ok(renderCard({ ...vote, status: "closed", awarded: { a1: 4, a2: 0 } }).includes("+4"));

// Character creator: builds against the same ApplicationV2 stand-in and renders every tab.
globalThis.CONFIG.SR6.skill_special = { firearms: { pistols_heavy: "x" } };
game.user.can = () => true;
const ccTemplate = Handlebars.compile(readFileSync(new URL("../templates/character-creator.hbs", import.meta.url), "utf8"));
const { CharacterCreator } = await import("../scripts/chargen/creator.mjs");
const creator = new CharacterCreator();
creator.draft.priorities = { magic: "A", attributes: "B", skills: "C", metatype: "D", resources: "E" };
Object.assign(creator.draft, { metatype: "elf", magicType: "full" });
creator.draft.qualities = [{ id: "exceptional", detail: "" }, { id: "allergy", karma: 11, detail: "pollen" }, { id: "built_tough", level: 2 }];
creator.draft.contacts = [{ name: "Fixer", connection: 3, loyalty: 2 }];
for (const tab of ["priorities", "attributes", "skills", "qualities", "extras", "summary"]) {
  creator.tab = tab;
  const html = ccTemplate(await creator._prepareContext());
  assert.ok(html.includes('data-budget="karma"'), `creator tab ${tab}`);
  assert.ok(html.includes('name="draft.qualities.2.level"'));
}

// Form values (as FormDataExtended + expandObject give them) merge into the draft.
const { mergeForm } = await import("../scripts/chargen/creator.mjs");
const merged = mergeForm(creator.draft, {
  priorities: { resources: "E" },
  skills: { firearms: { points: 3 } },
  qualities: { 0: { id: "exceptional", detail: "log", level: 1 } },
  attrPoints: { agi: 4 },
});
assert.equal(merged.skills.firearms.points, 3);
assert.equal(merged.skills.firearms.karma, 0);
assert.equal(merged.priorities.magic, "A");
assert.deepEqual(merged.qualities, [{ id: "exceptional", detail: "log", level: 1 }]);
assert.equal(merged.attrPoints.agi, 4);
assert.equal(merged.attrPoints.bod, 0);

console.log("wizard OK");
