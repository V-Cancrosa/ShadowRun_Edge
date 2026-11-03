/**
 * "Karta Edge" for items: an optional item sheet in the style of the Edge character sheet. Like the actor
 * sheet it keeps the system's data format, so the system's item sheet stays usable for anything not shown here.
 */
import { buildItemContext } from "./item-context.mjs";
import { GRADES, gradeUpdates, baseValues, applyGrade } from "../grades.mjs";
import { SKILLS } from "../chargen/rules.mjs";
import { giveItem, deleteItem } from "../give.mjs";
import * as rolls from "./system-rolls.mjs";
import * as garage from "../garage.mjs";

const MODULE_ID = "shadowrun-edge";
const L = (key) => game.i18n.localize(key);

const { HandlebarsApplicationMixin } = foundry.applications.api;
const ItemSheetV2 = foundry.applications.sheets.ItemSheetV2;

export const ITEM_TABS = ["stats", "mods", "description", "effects"];

export class EdgeItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["sre-sheet", "sre-item-sheet"],
    position: { width: 720, height: 640 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      showItemTab: EdgeItemSheet.#onTab,
      toggleMode: EdgeItemSheet.#onToggleMode,
      toggleField: EdgeItemSheet.#onToggleField,
      setGrade: EdgeItemSheet.#onGrade,
      reloadItem: EdgeItemSheet.#onReload,
      uninstallMod: EdgeItemSheet.#onUninstall,
      openMod: EdgeItemSheet.#onOpenMod,
      createEffect: EdgeItemSheet.#onCreateEffect,
      editEffect: EdgeItemSheet.#onEditEffect,
      toggleEffect: EdgeItemSheet.#onToggleEffect,
      deleteEffect: EdgeItemSheet.#onDeleteEffect,
      rollItem: EdgeItemSheet.#onRoll,
      giveItem: EdgeItemSheet.#onGive,
      deleteItem: EdgeItemSheet.#onDelete,
      systemItemSheet: EdgeItemSheet.#onSystemSheet,
      garageTakeOut: EdgeItemSheet.#onGarageTakeOut,
      garageOpen: EdgeItemSheet.#onGarageOpen,
      garageSync: EdgeItemSheet.#onGarageSync,
      garageDrive: EdgeItemSheet.#onGarageDrive,
    },
  };

  static PARTS = {
    sheet: { template: `modules/${MODULE_ID}/templates/sheet/edge-item-sheet.hbs`, scrollable: [".sre-sheet-body"] },
  };

  itemTab = "stats";

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const data = buildItemContext(this.document, { L, config: CONFIG.SR6 ?? {}, moduleId: MODULE_ID, grades: GRADES, gradeUpdates, baseValues, skills: SKILLS });
    const tabs = ITEM_TABS.filter((id) => id !== "mods" || data.hasMods).map((id) => ({
      id, active: id === this.itemTab,
      label: id === "mods" ? `${L("SRE.ItemSheet.Tab.mods")}${data.modCount ? ` (${data.modCount})` : ""}`
        : id === "effects" ? `${L("SRE.ItemSheet.Tab.effects")}${data.effects.length ? ` (${data.effects.length})` : ""}`
          : L(`SRE.ItemSheet.Tab.${id}`),
    }));
    const descriptionHTML = await foundry.applications.ux.TextEditor.implementation.enrichHTML(data.description, { relativeTo: this.document, secrets: this.document.isOwner });
    // The Garage (13D): the Vehicle actor made from this item, with its state.
    let garageCtx = null;
    if (data.kind === "vehicle") {
      const v = garage.linkedVehicle(this.document);
      const modes = CONFIG.SR6?.VEHICLE_MODE ?? {};
      garageCtx = { vehicle: v ? {
        name: v.name, img: v.img, mode: modes[v.system?.vehicle?.opMode] ? L(modes[v.system.vehicle.opMode]) : v.system?.vehicle?.opMode ?? "",
        speed: Number(v.system?.vehicle?.speed) || 0, top: Number(v.system?.tspd) || 0, dmg: Number(v.system?.physical?.dmg) || 0, max: Number(v.system?.physical?.max) || 0,
      } : null, canDrive: !!v?.isOwner };
    }
    return {
      ...context, ...data, tabs, descriptionHTML, garage: garageCtx,
      editable: this.isEditable,
      active: Object.fromEntries(ITEM_TABS.map((id) => [id, id === this.itemTab])),
    };
  }

  /** Header controls: give the item to another character or delete it (items on a character only). */
  _getHeaderControls() {
    const controls = super._getHeaderControls();
    if (this.document.actor?.isOwner && this.document.type !== "skill") {
      controls.unshift(
        { icon: "fas fa-hand-holding", label: "SRE.Give.Button", action: "giveItem" },
        { icon: "fas fa-trash", label: "SRE.Give.Delete", action: "deleteItem" },
      );
    }
    controls.push({ icon: "fas fa-table-list", label: "SRE.ItemSheet.SystemSheet", action: "systemItemSheet" });
    return controls;
  }

  /** Form values the system stores in another shape: the Attack Rating array and the stun flag. */
  _processFormData(event, form, formData) {
    const data = super._processFormData(event, form, formData);
    const ar = data.sre?.ar;
    if (ar) {
      const current = Array.isArray(this.document._source.system.attackRating) ? [...this.document._source.system.attackRating] : [0, 0, 0, 0, 0];
      for (const [i, v] of Object.entries(ar)) current[Number(i)] = Number(v) || 0;
      foundry.utils.setProperty(data, "system.attackRating", current);
    }
    delete data.sre;
    if (typeof data.system?.stun === "string") data.system.stun = data.system.stun === "true";
    return data;
  }

  _onFirstRender(context, options) {
    super._onFirstRender?.(context, options);
    new foundry.applications.ux.DragDrop.implementation({
      dropSelector: ".sre-es",
      permissions: { drop: () => this.isEditable },
      callbacks: { drop: this._onDrop.bind(this) },
    }).bind(this.element);
  }

  static async #onGarageTakeOut() {
    await garage.takeOut(this.document);
    this.render();
  }

  static async #onGarageOpen() {
    garage.linkedVehicle(this.document)?.sheet.render(true);
  }

  static async #onGarageSync() {
    await garage.sync(this.document);
    this.render();
  }

  static async #onGarageDrive(event, target) {
    const v = garage.linkedVehicle(this.document);
    if (!v?.isOwner) return;
    const veh = await import("../vehicles.mjs");
    const run = { handling: veh.openHandling, drivers: veh.driversTest, ram: veh.openRam }[target.dataset.maneuver];
    return run?.(v);
  }

  /** Dropping a mod on the sheet installs it (the module's mount rules check the slot and Capacity). */
  async _onDrop(event) {
    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    if (data?.type !== "Item" || !this.isEditable) return;
    const dropped = await Item.implementation.fromDropData(data);
    if (!dropped || dropped.type !== "mod") return;
    const actor = this.document.actor;
    if (!actor) return ui.notifications.warn(L("SRE.ItemSheet.ModNeedsActor"));
    if (dropped.parent === actor) return dropped.update({ "system.embeddedInUuid": this.document.uuid });
    const copy = dropped.toObject();
    delete copy._id;
    copy.system.embeddedInUuid = this.document.uuid;
    return actor.createEmbeddedDocuments("Item", [copy]);
  }

  static #onTab(event, target) {
    this.itemTab = target.dataset.tab;
    this.render();
  }

  static async #onToggleMode(event, target) {
    const m = target.dataset.mode;
    return this.document.update({ [`system.modes.${m}`]: !this.document._source.system.modes?.[m] });
  }

  static async #onToggleField(event, target) {
    const field = target.dataset.field;
    return this.document.update({ [field]: !foundry.utils.getProperty(this.document._source, field) });
  }

  static async #onGrade(event, target) {
    return applyGrade(this.document, target.dataset.grade);
  }

  static async #onReload() {
    return rolls.reloadWeapon(this.document);
  }

  static async #onUninstall(event, target) {
    const mod = this.document.actor?.items.get(target.closest("[data-mod-id]")?.dataset.modId);
    return mod?.update({ "system.embeddedInUuid": null });
  }

  static #onOpenMod(event, target) {
    this.document.actor?.items.get(target.closest("[data-mod-id]")?.dataset.modId)?.sheet.render(true);
  }

  static async #onCreateEffect() {
    const [effect] = await this.document.createEmbeddedDocuments("ActiveEffect", [{ name: this.document.name, img: this.document.img, transfer: true }]);
    effect?.sheet.render(true);
  }

  static #onEditEffect(event, target) {
    this.document.effects.get(target.closest("[data-effect-id]")?.dataset.effectId)?.sheet.render(true);
  }

  static async #onToggleEffect(event, target) {
    const effect = this.document.effects.get(target.closest("[data-effect-id]")?.dataset.effectId);
    return effect?.update({ disabled: !effect.disabled });
  }

  static async #onDeleteEffect(event, target) {
    return this.document.effects.get(target.closest("[data-effect-id]")?.dataset.effectId)?.deleteDialog();
  }

  /** The item's own roll from its sheet (weapon attack, spell, ritual, complex form). */
  static async #onRoll() {
    const item = this.document;
    const actor = item.actor;
    if (!actor) return;
    if (item.type === "spell") return rolls.rollSpell(actor, item);
    if (item.type === "ritual") return rolls.rollRitual(actor, item);
    if (item.type === "complexform") return rolls.rollComplexForm(actor, item);
    return rolls.rollWeapon(actor, item);
  }

  static async #onGive() {
    return giveItem(this.document);
  }

  static async #onDelete() {
    return deleteItem(this.document);
  }

  /** The system's own sheet for this item, for fields this sheet does not show. */
  static #onSystemSheet() {
    const cls = Object.values(CONFIG.Item.sheetClasses?.[this.document.type] ?? {})
      .find((s) => s.id?.startsWith("shadowrun6-eden."))?.cls;
    if (!cls) return;
    const v2 = cls.prototype instanceof foundry.applications.api.ApplicationV2;
    (v2 ? new cls({ document: this.document }) : new cls(this.document)).render(true);
  }
}

Hooks.once("init", () => {
  if (game.system.id !== "shadowrun6-eden") return;
  const collection = foundry.documents?.collections?.Items ?? globalThis.Items;
  collection.registerSheet(MODULE_ID, EdgeItemSheet, { makeDefault: true, label: "SRE.ItemSheet.Label" });
});
