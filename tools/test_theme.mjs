// Checks the "Edge" look: always on, dark or light per player (switched on the character sheet, stored on the
// user), an earlier settings choice or Foundry's color scheme until then. Run: node tools/test_theme.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const registered = {};
const values = { theme: "auto" };
const flags = {};
const hooks = {};
const classes = new Set();
globalThis.Hooks = { once: (n, f) => (hooks[n] = f), on: (n, f) => (hooks[n] = f) };
globalThis.ui = { windows: {} };
globalThis.document = {
  body: { classList: { add: (c) => classes.add(c), toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)), contains: (c) => classes.has(c) } },
};
globalThis.game = {
  system: { id: "shadowrun6-eden" },
  settings: { register: (m, k, d) => (registered[k] = d), get: (m, k) => values[k] },
  user: { getFlag: (m, k) => flags[k], setFlag: async (m, k, v) => (flags[k] = v) },
};

const { activeTheme, toggleTheme } = await import("../scripts/theme.mjs");
hooks.init();
assert.equal(registered.theme.config, false, "no settings shown");
assert.equal(registered.themeOverride.config, false, "no world setting shown");

// No choice yet: Foundry's color scheme decides.
values.uiConfig = { colorScheme: { applications: "light" } };
assert.equal(activeTheme(), "light");
values.uiConfig = { colorScheme: { applications: "dark" } };
assert.equal(activeTheme(), "dark");
// An earlier choice from the old setting is kept ("off" is gone: the look is always on).
values.theme = "light";
assert.equal(activeTheme(), "light");
values.theme = "off";
assert.equal(activeTheme(), "dark");

hooks.setup();
assert.ok(classes.has("sre-theme") && classes.has("sre-theme-dark") && !classes.has("sre-edge-light"));

// The switch on the sheet flips it and stores it on the user.
await toggleTheme();
assert.equal(flags.theme, "light");
assert.ok(classes.has("sre-theme-light") && classes.has("sre-edge-light") && !classes.has("sre-theme-dark"));
values.uiConfig = { colorScheme: { applications: "dark" } };
assert.equal(activeTheme(), "light", "the player's pick wins over Foundry's scheme");
await toggleTheme();
assert.equal(flags.theme, "dark");
assert.ok(!classes.has("sre-edge-light"));

for (const lang of ["pl", "en"]) {
  const t = JSON.parse(readFileSync(new URL(`../lang/${lang}/shadowrun-edge.json`, import.meta.url), "utf8")).SRE.Theme;
  assert.ok(t.ToLight && t.ToDark, `${lang}: switch labels`);
}
console.log("theme OK");
