const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export class SRItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["shadowrun-edge", "item"],
    position: { width: 480, height: 520 },
    window: { resizable: true },
    form: { submitOnChange: true }
  };

  static PARTS = {
    sheet: {
      template: "systems/shadowrun-edge/templates/item/item-sheet.hbs",
      scrollable: [""]
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = this.document;
    Object.assign(context, {
      system: item.system,
      systemFields: item.system.schema.fields,
      isSkill: item.type === "skill",
      isWeapon: item.type === "weapon",
      isGear: item.type === "gear",
      descriptionHTML: await foundry.applications.ux.TextEditor.implementation.enrichHTML(item.system.description, {
        secrets: item.isOwner,
        relativeTo: item
      })
    });
    return context;
  }
}
