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
globalThis.Hooks = { on() {} };
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
console.log("wizard OK");
