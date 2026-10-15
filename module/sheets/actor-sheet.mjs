const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class SRActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["shadowrun-edge", "actor"],
    position: { width: 680, height: 760 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      rollAttribute: SRActorSheet.#onRollAttribute,
      rollItem: SRActorSheet.#onRollItem,
      createItem: SRActorSheet.#onCreateItem,
      editItem: SRActorSheet.#onEditItem,
      deleteItem: SRActorSheet.#onDeleteItem
    }
  };

  static PARTS = {
    sheet: {
      template: "systems/shadowrun-edge/templates/actor/actor-sheet.hbs",
      scrollable: [""]
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.document;
    const system = actor.system;
    Object.assign(context, {
      system,
      systemFields: system.schema.fields,
      isNpc: actor.type === "npc",
      attributes: Object.entries(CONFIG.SRE.attributes).map(([key, label]) => ({
        key, label, value: system.attributes[key]
      })),
      skills: actor.itemTypes.skill.map(skill => ({
        item: skill,
        pool: actor.getSkillPool(skill, skill.system.attribute),
        attributeLabel: CONFIG.SRE.attributes[skill.system.attribute]
      })),
      weapons: actor.itemTypes.weapon,
      gear: actor.itemTypes.gear,
      biographyHTML: await foundry.applications.ux.TextEditor.implementation.enrichHTML(system.biography, {
        secrets: actor.isOwner,
        relativeTo: actor
      })
    });
    return context;
  }

  _getItem(target) {
    return this.document.items.get(target.closest("[data-item-id]")?.dataset.itemId);
  }

  static #onRollAttribute(event, target) {
    return this.document.rollAttribute(target.dataset.attribute);
  }

  static #onRollItem(event, target) {
    const item = this._getItem(target);
    if (item?.type === "skill") return this.document.rollSkill(item);
    if (item?.type === "weapon") return this.document.rollWeapon(item);
  }

  static #onCreateItem(event, target) {
    const type = target.dataset.type;
    const name = game.i18n.format("SRE.NewItem", { type: game.i18n.localize(`TYPES.Item.${type}`) });
    return this.document.createEmbeddedDocuments("Item", [{ name, type }]);
  }

  static #onEditItem(event, target) {
    return this._getItem(target)?.sheet.render({ force: true });
  }

  static #onDeleteItem(event, target) {
    return this._getItem(target)?.deleteDialog();
  }
}
