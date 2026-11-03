/**
 * Edge sheet for hosts (system 4.x "host" actors): rating and ASDF, IC to run and attack with (Host Rating × 2
 * against the targeted persona), and who is inside with which access (pp. 185–187).
 */
import { buildHostContext } from "./compact-context.mjs";
import { IC, icStats } from "../matrix-rules.mjs";
import { icAttack, targetsOf, getOS, osVisible } from "../matrix.mjs";
import { isLightTheme, toggleTheme } from "../theme.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
const MODULE_ID = "shadowrun-edge";
const SYSTEM_ID = "shadowrun6-eden";
const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

export class EdgeHostSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["sre-sheet", "sre-compact"],
    position: { width: 760, height: 720 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      toggleTheme: () => toggleTheme(),
      icToggle: EdgeHostSheet.#onIcToggle,
      icAttack: EdgeHostSheet.#onIcAttack,
    },
  };

  static PARTS = { sheet: { template: `modules/${MODULE_ID}/templates/sheet/edge-host.hbs`, scrollable: [".sre-compact-body"] } };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const host = this.document;
    const personas = [];
    for (const actor of game.actors ?? []) {
      const t = targetsOf(actor).find((x) => x.hostUuid === host.uuid && x.access && x.access !== "outsider");
      if (t) personas.push({ name: actor.name, access: t.access, illegal: !!t.illegal, os: getOS(actor), osShown: osVisible(),
        accessLabel: `${L(`SRE.Matrix.Access.${t.access}`)} · ${L(t.illegal ? "SRE.Matrix.IllegalAccess" : "SRE.Matrix.LegalAccess")}` });
    }
    const light = isLightTheme();
    return {
      ...context,
      ...buildHostContext(host, { L, IC, icStats, personas }),
      name: host.name, img: host.img, initial: (host.name ?? "?").charAt(0), editable: this.isEditable,
      themeSwitch: { light, icon: light ? "fa-moon" : "fa-sun", label: L(light ? "SRE.Theme.ToDark" : "SRE.Theme.ToLight") },
    };
  }

  /** Running IC: at most Host Rating at once (p. 186), more asks nobody — the GM runs the host. */
  static async #onIcToggle(event, target) {
    const id = target.closest("[data-ic]").dataset.ic;
    const running = new Set(this.document.getFlag(MODULE_ID, "ic") ?? []);
    if (running.has(id)) running.delete(id);
    else {
      if (running.size >= (Number(this.document.system?.rating) || 1)) ui.notifications.warn(L("SRE.Matrix.IC.TooMany", { max: this.document.system?.rating }));
      running.add(id);
    }
    await this.document.setFlag(MODULE_ID, "ic", [...running]);
  }

  static #onIcAttack(event, target) {
    return icAttack(this.document, target.closest("[data-ic]").dataset.ic);
  }
}

Hooks.once("init", () => {
  if (game.system.id !== SYSTEM_ID) return;
  const hasHost = !!(CONFIG.Actor?.dataModels?.host || game.system.documentTypes?.Actor?.host);
  if (!hasHost) return;
  const collection = foundry.documents?.collections?.Actors ?? globalThis.Actors;
  collection.registerSheet(MODULE_ID, EdgeHostSheet, { types: ["host"], makeDefault: true, label: "SRE.Matrix.HostSheet" });
});
