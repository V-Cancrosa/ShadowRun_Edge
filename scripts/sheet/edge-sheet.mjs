/**
 * "Karta Edge": an optional character sheet for shadowrun6-eden Player actors, laid out after the SR6
 * character sheet. Data stays in the system's format, so users can switch between this sheet and the
 * system's at any time (Sheet configuration in the window header).
 */
import {
  buildSheetContext, buildSkillsContext, buildCombatContext, buildMagicContext, buildMatrixContext, buildGearContext, buildSocialContext,
} from "./context.mjs";
import * as rolls from "./system-rolls.mjs";
import { METATYPES, SKILLS } from "../chargen/rules.mjs";
import { giveItem, deleteItem } from "../give.mjs";
import { errataFlags } from "../errata.mjs";
import { openHealing } from "../healing.mjs";
import { openSummon, openBanish, spiritsOf, setServices } from "../summoning.mjs";
import { forceBudget } from "../summoning-rules.mjs";
import { throwExplosive } from "../blast.mjs";

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
      toggleSustain: EdgeActorSheet.#onToggleSustain,
      rollRitual: EdgeActorSheet.#onRitual,
      rollForm: EdgeActorSheet.#onForm,
      rollMatrix: EdgeActorSheet.#onMatrix,
      toggleAllActions: EdgeActorSheet.#onToggleAllActions,
      toggleDevice: EdgeActorSheet.#onToggleDevice,
      toggleProgram: EdgeActorSheet.#onToggleProgram,
      count: EdgeActorSheet.#onCount,
      rollLegwork: EdgeActorSheet.#onLegwork,
      addContact: EdgeActorSheet.#onAddContact,
      heal: EdgeActorSheet.#onHeal,
      summon: EdgeActorSheet.#onSummon,
      banish: EdgeActorSheet.#onBanish,
      spiritServices: EdgeActorSheet.#onSpiritServices,
      openSpirit: EdgeActorSheet.#onOpenSpirit,
      dismissSpirit: EdgeActorSheet.#onDismissSpirit,
      throwExplosive: EdgeActorSheet.#onThrow,
    },
  };

  static PARTS = {
    sheet: { template: `modules/${MODULE_ID}/templates/sheet/edge-sheet.hbs`, scrollable: [".sre-sheet-body"] },
  };

  /** Active tab; kept on the instance so re-renders after updates stay on it. */
  sheetTab = "main";

  /** Skills list filter: all skills or only those with points. */
  showAllSkills = true;

  /** Matrix tab: only the common actions, or all of them. */
  showAllMatrixActions = false;

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const config = CONFIG.SR6 ?? {};
    const errata = errataFlags();
    const data = buildSheetContext(this.document, { L, config, errata });
    const tab = this.sheetTab;
    const awakened = ["magician", "mysticadept", "aspectedmagician", "adept"].includes(this.document.system.mortype);
    let social = null;
    if (tab === "social") {
      social = buildSocialContext(this.document, { L, config });
      const enrich = (html) => foundry.applications.ux.TextEditor.implementation.enrichHTML(html, { relativeTo: this.document, secrets: this.document.isOwner });
      social.notesHTML = await enrich(social.notes);
      if (social.hasDescription) social.descriptionHTML = await enrich(social.description);
    }
    return {
      ...context,
      ...data,
      magic: tab === "magic" ? this.#magicContext(config) : null,
      matrix: tab === "matrix" ? buildMatrixContext(this.document, { L, config, showAllActions: this.showAllMatrixActions }) : null,
      gear: tab === "gear" ? buildGearContext(this.document, { L, config }) : null,
      social,
      sk: this.sheetTab === "skills"
        ? buildSkillsContext(this.document, { L, config, metatypes: METATYPES, skills: SKILLS, showAll: this.showAllSkills, errata })
        : null,
      combat: this.sheetTab === "combat" ? buildCombatContext(this.document, { L, config }) : null,
      editable: this.isEditable,
      tabs: TABS.filter((id) => id !== "magic" || awakened).map((id) => ({ id, label: L(`SRE.Sheet.Tab.${id}`), active: id === tab })),
      active: Object.fromEntries(TABS.map((id) => [id, id === this.sheetTab])),
    };
  }

  /** Right-click on any item row: open, give to another character, delete. */
  _onFirstRender(context, options) {
    super._onFirstRender?.(context, options);
    const item = (li) => this.document.items.get(li.closest("[data-item-id]")?.dataset.itemId);
    new foundry.applications.ux.ContextMenu.implementation(this.element, "[data-item-id]", [
      { name: "SRE.Give.Open", icon: '<i class="fas fa-up-right-from-square"></i>', callback: (li) => item(li)?.sheet.render(true) },
      { name: "SRE.Give.Button", icon: '<i class="fas fa-hand-holding"></i>', condition: (li) => this.isEditable && !!item(li) && item(li).type !== "skill", callback: (li) => giveItem(item(li)) },
      { name: "SRE.Give.Delete", icon: '<i class="fas fa-trash"></i>', condition: () => this.isEditable, callback: (li) => deleteItem(item(li)) },
    ], { jQuery: false, fixed: true });
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
    if (item) return deleteItem(item);
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

  static async #onToggleSustain(event, target) {
    const item = this.#item(target);
    if (item) return item.update({ "system.isSustained": !item.system.isSustained });
  }

  static async #onRitual(event, target) {
    const item = this.#item(target);
    if (item) return rolls.rollRitual(this.document, item);
  }

  static async #onForm(event, target) {
    const item = this.#item(target);
    if (item) return rolls.rollComplexForm(this.document, item);
  }

  static async #onMatrix(event, target) {
    return rolls.rollMatrixAction(this.document, target.dataset.matrixId);
  }

  static #onToggleAllActions() {
    this.showAllMatrixActions = !this.showAllMatrixActions;
    this.render();
  }

  static async #onToggleDevice(event, target) {
    const item = this.#item(target);
    if (item) return item.update({ "system.usedForPool": !item.system.usedForPool });
  }

  static async #onToggleProgram(event, target) {
    const item = this.#item(target);
    const id = target.dataset.program;
    if (item && id) return item.update({ [`system.program.${id}`]: !item.system.program?.[id] });
  }

  static async #onCount(event, target) {
    const item = this.#item(target);
    if (!item) return;
    const next = Math.max(0, (Number(item.system.count) || 0) + Number(target.dataset.delta));
    return item.update({ "system.count": next });
  }

  static async #onLegwork(event, target) {
    const item = this.#item(target);
    if (item) return rolls.rollLegwork(this.document, item);
  }

  /** Magic tab data plus the spirits this character summoned (they are separate actors). */
  #magicContext(config) {
    const magic = buildMagicContext(this.document, { L, config });
    const spirits = spiritsOf(this.document);
    magic.canConjure = ["magician", "mysticadept", "aspectedmagician"].includes(this.document.system.mortype);
    magic.spirits = spirits.map((a) => {
      const f = a.getFlag("shadowrun-edge", "spirit");
      return { id: a.id, name: a.name, type: L(CONFIG.SR6?.SPIRIT_TYPES?.[a.system.spiritType] ?? a.system.spiritType), force: Number(a.system.rating) || 0, services: f.services, owner: a.isOwner };
    });
    magic.budget = forceBudget(this.document.system.attributes?.mag?.pool, spirits.map((a) => a.system.rating));
    return magic;
  }

  static #onSummon() {
    return openSummon(this.document);
  }

  static #onBanish() {
    return openBanish(this.document);
  }

  static async #onSpiritServices(event, target) {
    const spirit = game.actors.get(target.closest("[data-spirit-id]")?.dataset.spiritId);
    const flag = spirit?.getFlag("shadowrun-edge", "spirit");
    if (flag) await setServices(spirit, flag.services + Number(target.dataset.delta));
    this.render();
  }

  static #onOpenSpirit(event, target) {
    game.actors.get(target.closest("[data-spirit-id]")?.dataset.spiritId)?.sheet.render(true);
  }

  static async #onDismissSpirit(event, target) {
    const spirit = game.actors.get(target.closest("[data-spirit-id]")?.dataset.spiritId);
    if (!spirit?.isOwner) return;
    const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: spirit.name }, content: `<p>${game.i18n.format("SRE.Summon.DismissConfirm", { name: spirit.name })}</p>` });
    if (ok) await spirit.delete();
    this.render();
  }

  static async #onThrow(event, target) {
    const item = this.#item(target);
    if (item) return throwExplosive(this.document, item);
  }

  static #onHeal() {
    return openHealing(this.document);
  }

  static async #onAddContact() {
    const [item] = await this.document.createEmbeddedDocuments("Item", [{ name: L("SRE.Sheet.NewContact"), type: "contact", system: { rating: 1, loyalty: 1 } }]);
    item?.sheet.render(true);
  }

  #item(target) {
    return this.document.items.get(target.closest("[data-item-id]")?.dataset.itemId);
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
