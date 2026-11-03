/**
 * In-Foundry tests for the Quench module (https://github.com/Ethaks/FVTT-Quench), registered only when Quench is
 * active. Open them from Quench's button in the scene controls. Node tests (npm test) cover the pure rules; these
 * check what only a running world can: settings, sheet registration, compendiums, translations, and — in the
 * "integration" batch, GM only — a temporary character with the Edge sheet and catalog items, deleted afterwards.
 */
import * as matrixRules from "./matrix-rules.mjs";
import * as vehicleRules from "./vehicle-rules.mjs";
import { entryCost } from "./advancement-rules.mjs";

const MODULE_ID = "shadowrun-edge";
const SETTINGS = ["playersBreakRules", "advancementApproval", "overwatchVisible", "welcomeSeen", "guideImported", "trackActions"];

Hooks.on("quenchReady", (quench) => {
  quench.registerBatch(`${MODULE_ID}.setup`, (context) => {
    const { describe, it, assert } = context;
    describe("Shadowrun Edge: setup", () => {
      it("is running on shadowrun6-eden", () => {
        assert.equal(game.system.id, "shadowrun6-eden");
        assert.ok(game.modules.get(MODULE_ID)?.active);
      });
      it("registers its settings", () => {
        for (const key of SETTINGS) assert.ok(game.settings.settings.has(`${MODULE_ID}.${key}`), key);
      });
      it("registers the Edge sheets", () => {
        const has = (type) => Object.keys(CONFIG.Actor.sheetClasses?.[type] ?? {}).some((k) => k.startsWith(`${MODULE_ID}.`));
        for (const type of ["Player", "NPC", "Critter", "Spirit", "Vehicle"]) assert.ok(has(type), type);
        if (CONFIG.Actor.dataModels?.host || game.system.documentTypes?.Actor?.host) assert.ok(has("host"), "host");
      });
      it("has its compendiums", async () => {
        const katalog = game.packs.get(`${MODULE_ID}.katalog`);
        const guide = game.packs.get(`${MODULE_ID}.przewodnik`);
        assert.ok(katalog && guide);
        const index = await katalog.getIndex({ fields: ["type"] });
        assert.isAtLeast(index.size, 700);
        for (const type of ["spell", "adeptpower", "complexform", "quality", "gear"]) assert.ok(index.some((e) => e.type === type), type);
      });
      it("catalog spells carry the system fields", async () => {
        const katalog = game.packs.get(`${MODULE_ID}.katalog`);
        const entry = (await katalog.getIndex({ fields: ["type"] })).find((e) => e.name === "Fireball" && e.type === "spell");
        const fireball = await katalog.getDocument(entry._id);
        assert.equal(fireball.system.drain, 6);
        assert.equal(fireball.system.category, "combat");
        assert.equal(fireball.system.range, "line_of_sight_area");
      });
      it("translates its texts", () => {
        for (const key of ["SRE.Sheet.Label", "SRE.Matrix.Convergence", "SRE.Vehicle.Handling", "SRE.Advance.Title", "SRE.Catalog.Spells"]) {
          assert.notEqual(game.i18n.localize(key), key, key);
        }
      });
    });
  }, { displayName: "Shadowrun Edge: setup" });

  quench.registerBatch(`${MODULE_ID}.rules`, (context) => {
    const { describe, it, assert } = context;
    describe("Shadowrun Edge: rules in the browser", () => {
      it("Matrix: OS and Convergence", () => {
        assert.equal(matrixRules.osFromAction({ illegal: true, defenderHits: 4, program: true }).total, 5);
        assert.ok(matrixRules.isConvergence(40));
      });
      it("Vehicles: speed intervals and ramming", () => {
        assert.equal(vehicleRules.speedIntervals(28, 20), 1);
        assert.equal(vehicleRules.ramDamage(11, 1), 7);
      });
      it("Advancement: attribute 4 → 6 costs 55 Karma", () => {
        assert.equal(entryCost({ kind: "attribute", from: 4, to: 6 }), 55);
      });
    });
  }, { displayName: "Shadowrun Edge: rules" });

  quench.registerBatch(`${MODULE_ID}.integration`, (context) => {
    const { describe, it, assert, before, after } = context;
    describe("Shadowrun Edge: integration (creates and deletes a test character)", () => {
      let actor;
      before(async () => {
        if (!game.user.isGM) return;
        actor = await Actor.create({ name: "Quench — Shadowrun Edge", type: "Player" }, { renderSheet: false });
      });
      after(async () => {
        await actor?.sheet?.close();
        await actor?.delete();
      });
      it("needs a GM", () => assert.ok(game.user.isGM));
      it("opens the Edge sheet by default", async () => {
        const sheet = actor.sheet;
        assert.ok(sheet.constructor.name.startsWith("Edge"), sheet.constructor.name);
        await sheet.render(true);
        await new Promise((r) => setTimeout(r, 300));
        assert.ok(sheet.rendered);
        for (const tab of ["main", "skills", "combat", "magic", "matrix", "gear", "social"]) {
          sheet.sheetTab = tab;
          await sheet.render();
          await new Promise((r) => setTimeout(r, 100));
          assert.ok(sheet.element?.querySelector(".sre-es"), tab);
        }
      });
      it("takes catalog items", async () => {
        const katalog = game.packs.get(`${MODULE_ID}.katalog`);
        const index = await katalog.getIndex({ fields: ["type"] });
        const ids = ["Manabolt", "Improved Reflexes", "Ares Predator VI"].map((name) => index.find((e) => e.name === name)?._id).filter(Boolean);
        const docs = await Promise.all(ids.map((id) => katalog.getDocument(id)));
        const created = await actor.createEmbeddedDocuments("Item", docs.map((d) => d.toObject()), { sreSkipAcquire: true });
        assert.equal(created.length, docs.length);
        assert.ok(actor.items.some((i) => i.type === "spell" && i.name === "Manabolt"));
      });
    });
  }, { displayName: "Shadowrun Edge: integration" });
});
