// Loads the whole module (scripts/shadowrun-edge.mjs) with Foundry stubbed: an import cycle that touches a binding
// before it is initialized fails here, as it would in the browser. Run: node tools/test_graph.mjs
globalThis.Hooks = { on() {}, once() {}, off() {}, callAll() {} };
globalThis.game = { settings: { get() {} }, i18n: { localize: (k) => k } };
globalThis.foundry = { utils: {}, applications: { api: { ApplicationV2: class {}, HandlebarsApplicationMixin: (c) => c, DialogV2: class {} }, sheets: { ActorSheetV2: class {}, ItemSheetV2: class {} }, apps: {}, ux: {} }, appv1: { sheets: {} } };
globalThis.CONFIG = {};
globalThis.Application = class {}; globalThis.FormApplication = class {};
try {
  await import("../scripts/shadowrun-edge.mjs");
  console.log("module graph OK");
} catch (e) { console.error("module graph:", e.stack); process.exit(1); }
