/**
 * "Karta Edge": an optional character sheet for shadowrun6-eden Player actors, laid out after the SR6
 * character sheet. Data stays in the system's format, so users can switch between this sheet and the
 * system's at any time (Sheet configuration in the window header).
 * Built so far: Main, Attributes & skills, Combat; the other tabs point to the system sheet until they are built.
 */
import { buildSheetContext, buildSkillsContext, buildCombatContext } from "./context.mjs";
import * as rolls from "./system-rolls.mjs";
import { METATYPES, SKILLS } from "../chargen/rules.mjs";

const MODULE_ID = "shadowrun-edge";
const L = (key) => game.i18n.localize(key);

const { HandlebarsApplicationMixin } = foundry.applications.api;
const ActorSheetV2 = foundry.applications.sheets.ActorSheetV2;

export const TABS = ["main", "skills", "combat", "magic", "matrix", "gear", "social"];

export class EdgeActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["sre-sheet"],
    position: { width: 940, height: 820 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      showSheetTab: EdgeActorSheet.#onTab,
      edge: EdgeActorSheet.#onEdge,
      monitor: EdgeActorSheet.#onMonitor,
      rollQuick: EdgeActorSheet.#onQuick,
      rollInitiative: EdgeActorSheet.#onInitiative,
      rollWeapon: EdgeActorSheet.#onWeapon,
      reload: EdgeActorSheet.#onReload,
      rollSpell: EdgeActorSheet.#onSpell,
      openItem: EdgeActorSheet.#onOpenItem,
      systemSheet: EdgeActorSheet.#onSystemSheet,
      rollAttribute: EdgeActorSheet.#onAttribute,
      rollSkill: EdgeActorSheet.#onSkill,
      toggleUntrained: EdgeActorSheet.#onToggleUntrained,
      addKnowledge: EdgeActorSheet.#onAddKnowledge,
      deleteItem: EdgeActorSheet.#onDeleteItem,
      toggleArmor: EdgeActorSheet.#onToggleArmor,
      rollUnarmed: EdgeActorSheet.#onUnarmed,
      rollResist: EdgeActorSheet.#onResist,
    },
  };

  static PARTS = {
    sheet: { template: `modules/${MODULE_ID}/templates/sheet/edge-sheet.hbs`, scrollable: [".sre-sheet-body"] },
  };

  /** Active tab; kept on the instance so re-renders after updates stay on it. */
  sheetTab = "main";

  /** Skills list filter: all skills or only those with points. */
  showAllSkills = true;

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const config = CONFIG.SR6 ?? {};
    const data = buildSheetContext(this.document, { L, config });
    return {
      ...context,
      ...data,
      sk: this.sheetTab === "skills"
        ? buildSkillsContext(this.document, { L, config, metatypes: METATYPES, skills: SKILLS, showAll: this.showAllSkills })
        : null,
      combat: this.sheetTab === "combat" ? buildCombatContext(this.document, { L, config }) : null,
      editable: this.isEditable,
      tabs: TABS.map((id) => ({ id, label: L(`SRE.Sheet.Tab.${id}`), active: id === this.sheetTab })),
      active: Object.fromEntries(TABS.map((id) => [id, id === this.sheetTab])),
    };
  }

  /** Item fields (ammo type…) live on embedded items, outside the actor form: save them directly. */
  _onRender(context, options) {
    super._onRender?.(context, options);
    for (const field of this.element.querySelectorAll("[data-item-field]")) {
      field.addEventListener("change", (event) => {
        event.stopPropagation();
        const item = this.document.items.get(field.closest("[data-item-id]")?.dataset.itemId);
        item?.update({ [field.dataset.itemField]: field.value });
      });
    }
  }

  static #onTab(event, target) {
    this.sheetTab = target.dataset.tab;
    this.render();
  }

  static async #onEdge(event, target) {
    const { value, max } = this.document.system.edge ?? {};
    const pip = Number(target.dataset.value);
    let next;
    if (target.dataset.delta) next = Number(value) + Number(target.dataset.delta);
    else next = pip === Number(value) ? pip - 1 : pip;
    next = Math.max(0, Math.min(Number(max) || 0, 7, next));
    if (next !== Number(value)) await this.document.update({ "system.edge.value": next });
  }

  /** Clicking a box sets the damage to it; clicking the last damaged box clears it (like a toggle). */
  static async #onMonitor(event, target) {
    const { monitor, index } = target.dataset;
    const current = Number(this.document.system[monitor]?.dmg) || 0;
    const box = Number(index);
    await this.document.update({ [`system.${monitor}.dmg`]: box === current ? box - 1 : box });
  }

  static async #onQuick(event, target) {
    const { kind, id, pool, label } = target.dataset;
    if (kind === "skill") return rolls.rollSkill(this.document, id);
    return rolls.rollPool(this.document, { pool, label, kind: kind === "derived" ? "common" : kind });
  }

  static async #onInitiative(event, target) {
    const { id, base, dice, label } = target.dataset;
    return rolls.rollInitiative(this.document, { id, base, dice, label });
  }

  static async #onWeapon(event, target) {
    const item = this.document.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    if (item) return rolls.rollWeapon(this.document, item);
  }

  static async #onReload(event, target) {
    const item = this.document.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    if (item) return rolls.reloadWeapon(item);
  }

  static async #onSpell(event, target) {
    const item = this.document.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    if (item) return rolls.rollSpell(this.document, item);
  }

  static async #onAttribute(event, target) {
    const { id, pool, label } = target.dataset;
    return rolls.rollAttribute(this.document, { id, pool, label });
  }

  static async #onSkill(event, target) {
    const { skill, spec } = target.dataset;
    return rolls.rollSkill(this.document, skill, spec || undefined);
  }

  static #onToggleUntrained() {
    this.showAllSkills = !this.showAllSkills;
    this.render();
  }

  /** New knowledge skill or language (system skill items; SR6 knowledge skills have no rating). */
  static async #onAddKnowledge(event, target) {
    const kind = target.dataset.kind;
    const name = await foundry.applications.api.DialogV2.prompt({
      window: { title: L(`SRE.Sheet.Add.${kind}`) },
      content: `<label>${L("SRE.Sheet.Add.Name")} <input type="text" name="name" autofocus></label>
        ${kind === "language" ? `<label class="checkbox"><input type="checkbox" name="native"> ${L("SRE.Sheet.Native")}</label>` : ""}`,
      ok: { callback: (ev, button) => ({ name: button.form.elements.name.value.trim(), native: button.form.elements.native?.checked }) },
      rejectClose: false,
    });
    if (!name?.name) return;
    const points = kind === "language" ? (name.native ? 4 : 1) : 1;
    return this.document.createEmbeddedDocuments("Item", [{ name: name.name, type: "skill", system: { genesisID: kind, points } }]);
  }

  static async #onDeleteItem(event, target) {
    const item = this.document.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    if (item) return item.deleteDialog?.() ?? item.delete();
  }

  static async #onToggleArmor(event, target) {
    const item = this.document.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    if (item) return item.update({ "system.usedForPool": !item.system.usedForPool });
  }

  static async #onUnarmed() {
    return rolls.rollSkill(this.document, "close_combat");
  }

  static async #onResist(event, target) {
    const { kind, pool, label } = target.dataset;
    return rolls.rollPool(this.document, { pool, label, kind });
  }

  static #onOpenItem(event, target) {
    this.document.items.get(target.closest("[data-item-id]")?.dataset.itemId)?.sheet.render(true);
  }

  /** Opens the system's own sheet for the parts not built yet, without changing the sheet setting. */
  static #onSystemSheet() {
    const cls = Object.values(CONFIG.Actor.sheetClasses?.Player ?? {})
      .find((s) => s.id?.startsWith("shadowrun6-eden."))?.cls;
    if (!cls) return;
    const v2 = cls.prototype instanceof foundry.applications.api.ApplicationV2;
    (v2 ? new cls({ document: this.document }) : new cls(this.document)).render(true);
  }
}

Hooks.once("init", () => {
  if (game.system.id !== "shadowrun6-eden") return;
  const collection = foundry.documents?.collections?.Actors ?? globalThis.Actors;
  collection.registerSheet(MODULE_ID, EdgeActorSheet, { types: ["Player"], makeDefault: false, label: "SRE.Sheet.Label" });
});
