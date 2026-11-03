/**
 * Edge sheet for sprites (system 4.x "sprite" actors): level, type and tasks owed, attributes and Matrix
 * attributes, skill tests and Matrix Initiative on the Edge engine, the Matrix monitor and powers.
 */
import { buildSpriteContext } from "./compact-context.mjs";
import { isLightTheme, toggleTheme } from "../theme.mjs";
import * as rolls from "./system-rolls.mjs";

const MODULE_ID = "shadowrun-edge";
const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
const { HandlebarsApplicationMixin } = foundry.applications.api;
const ActorSheetV2 = foundry.applications.sheets.ActorSheetV2;

export class EdgeSpriteSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["sre-sheet", "sre-compact", "sre-sprite"],
    position: { width: 760, height: 680 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      toggleTheme: () => toggleTheme(),
      rollSkill: EdgeSpriteSheet.#onSkill,
      rollInitiative: EdgeSpriteSheet.#onInitiative,
      monitor: EdgeSpriteSheet.#onMonitor,
      openItem: EdgeSpriteSheet.#onOpenItem,
      toggleRegistered: EdgeSpriteSheet.#onRegistered,
    },
  };

  static PARTS = { sheet: { template: `modules/${MODULE_ID}/templates/sheet/edge-sprite.hbs`, scrollable: [".sre-compact-body"] } };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const data = buildSpriteContext(this.document, { L });
    const light = isLightTheme();
    const types = this.document.system?.schema?.fields?.type?.choices ?? CONFIG.SR6?.SPRITE_TYPES ?? {};
    const typeList = Array.isArray(types) ? types.map((t) => [t, t]) : Object.entries(types);
    const notesHTML = await foundry.applications.ux.TextEditor.implementation.enrichHTML(data.notes ?? "", { relativeTo: this.document, secrets: this.document.isOwner });
    return {
      ...context, ...data, notesHTML,
      name: this.document.name, img: this.document.img, initial: (this.document.name ?? "?").charAt(0), editable: this.isEditable,
      levels: Array.from({ length: 12 }, (_, i) => ({ value: i + 1, selected: i + 1 === data.level })),
      types: typeList.map(([value, label]) => ({ value, label: typeof label === "string" ? L(label) : value, selected: value === data.type })),
      themeSwitch: { light, icon: light ? "fa-moon" : "fa-sun", label: L(light ? "SRE.Theme.ToDark" : "SRE.Theme.ToLight") },
    };
  }

  static #onSkill(event, target) {
    const { skill } = target.dataset;
    const data = buildSpriteContext(this.document, { L });
    const sk = data.skills.find((x) => x.id === skill);
    if (!sk) return;
    return rolls.rollPool(this.document, { pool: sk.pool, label: `${sk.label} + ${sk.attr}`, kind: "test" });
  }

  static #onInitiative() {
    const { initiative } = buildSpriteContext(this.document, { L });
    return rolls.rollInitiative(this.document, { id: "matrix", base: initiative.base, dice: initiative.dice, label: `${L("SRE.Sheet.InitiativeTitle")}: ${this.document.name}` });
  }

  /** Clicking a box sets the damage to it; the last damaged box clears it. Matrix damage lowers value. */
  static async #onMonitor(event, target) {
    const box = Number(target.dataset.index);
    const { monitor } = buildSpriteContext(this.document, { L });
    const dmg = box === monitor.dmg ? box - 1 : box;
    await this.document.update({ "system.matrix.matrixCM.value": monitor.max - dmg });
  }

  static #onOpenItem(event, target) {
    this.document.items.get(target.closest("[data-item-id]")?.dataset.itemId)?.sheet.render(true);
  }

  static async #onRegistered() {
    await this.document.update({ "system.registered": !this.document.system?.registered });
  }
}

Hooks.once("init", () => {
  if (game.system.id !== "shadowrun6-eden") return;
  const hasSprite = !!(CONFIG.Actor?.dataModels?.sprite || game.system.documentTypes?.Actor?.sprite);
  if (!hasSprite) return;
  const collection = foundry.documents?.collections?.Actors ?? globalThis.Actors;
  collection.registerSheet(MODULE_ID, EdgeSpriteSheet, { types: ["sprite"], makeDefault: true, label: "SRE.Sprite.Sheet" });
});
