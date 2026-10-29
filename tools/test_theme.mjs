// Checks the "Edge" look switch: the GM's world override wins over the player's choice,
// body classes follow the setting, and every choice has a translation. Run: node tools/test_theme.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const registered = {};
const values = { theme: "dark", themeOverride: "player" };
const hooks = {};
const classes = new Set();
globalThis.Hooks = { once: (n, f) => (hooks[n] = f), on: (n, f) => (hooks[n] = f) };
globalThis.ui = { windows: {} };
globalThis.document = { body: { classList: { toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)), contains: (c) => classes.has(c) } } };
globalThis.game = {
  system: { id: "shadowrun6-eden" },
  settings: { register: (m, k, d) => (registered[k] = d), get: (m, k) => values[k] },
};

const { activeTheme } = await import("../scripts/theme.mjs");
hooks.init();
assert.equal(registered.theme.scope, "client");
assert.equal(registered.themeOverride.scope, "world");

assert.equal(activeTheme(), "dark");
values.themeOverride = "light";
assert.equal(activeTheme(), "light", "world override wins");
values.themeOverride = "off";
assert.equal(activeTheme(), "off");
values.themeOverride = "player";
values.theme = "bogus";
assert.equal(activeTheme(), "off", "unknown value falls back to off");

values.theme = "light";
hooks.setup();
assert.ok(classes.has("sre-theme") && classes.has("sre-theme-light") && !classes.has("sre-theme-dark"));
assert.ok(classes.has("sre-edge-light"), "player's light choice makes the Edge windows light");
values.theme = "dark";
registered.theme.onChange();
assert.ok(!classes.has("sre-edge-light"));
values.theme = "off";
registered.theme.onChange();
assert.ok(!classes.has("sre-theme") && classes.has("sre-theme-off"));

// "auto" follows Foundry's color scheme; with the look off the Edge windows follow it too.
assert.equal(registered.theme.default, "auto");
values.uiConfig = { colorScheme: { applications: "light", interface: "dark" } };
values.theme = "auto";
assert.equal(activeTheme(), "light");
registered.theme.onChange();
assert.ok(classes.has("sre-theme-light") && classes.has("sre-edge-light"));
values.uiConfig = { colorScheme: { applications: "dark" } };
assert.equal(activeTheme(), "dark");
values.theme = "off";
values.uiConfig = { colorScheme: { applications: "light" } };
registered.theme.onChange();
assert.ok(!classes.has("sre-theme") && classes.has("sre-edge-light"));

for (const lang of ["pl", "en"]) {
  const t = JSON.parse(readFileSync(new URL(`../lang/${lang}/shadowrun-edge.json`, import.meta.url), "utf8")).SRE.Theme;
  for (const d of [registered.theme, registered.themeOverride]) {
    for (const key of [d.name, d.hint, ...Object.values(d.choices)]) {
      assert.ok(key.split(".").slice(1).reduce((o, k) => o?.[k], { Theme: t }), `${lang}: ${key}`);
    }
  }
}
console.log("theme OK");
