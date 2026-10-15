import { CATEGORIES, WEAPON_SKILLS, emptyState } from "./categories.mjs";
import { parseStatLine, evaluate } from "./parser.mjs";

const MODULE_ID = "shadowrun-edge";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Presets shipped with the module, loaded once. */
let builtinPresets = null;
async function loadBuiltinPresets() {
  if (!builtinPresets) {
    try {
      const response = await fetch(`modules/${MODULE_ID}/data/presets.json`);
      const presets = response.ok ? await response.json() : [];
      builtinPresets = presets.map((p) => ({ ...p, builtin: true }));
    } catch {
      builtinPresets = [];
    }
  }
  return builtinPresets;
}

function worldPresets() {
  return game.settings.get(MODULE_ID, "presets") ?? [];
}

const int = (value, rating) => Math.trunc(evaluate(value, rating));

/**
 * Turns the wizard state into Item data for the shadowrun6-eden "gear" type.
 * Field names follow the system's template.json.
 */
export function buildItemData(state) {
  const category = CATEGORIES[state.category];
  const rating = int(state.rating);
  const avail = int(state.avail, rating);
  const price = evaluate(state.price, rating);
  const system = {
    type: state.type,
    subtype: state.subtype,
    rating,
    needsRating: !!category.rating && rating > 0,
    avail,
    availDef: state.avail ? `${avail}${state.legality ? `(${state.legality})` : ""}` : "",
    price,
    priceDef: state.price && /R/i.test(state.price) ? state.price : "",
    description: state.description
      ? state.description.split(/\n\s*\n/).map((p) => `<p>${Handlebars.escapeExpression(p).replace(/\n/g, "<br>")}</p>`).join("")
      : "",
  };

  if (category.weapon) {
    const [skill, skillSpec] = WEAPON_SKILLS[state.subtype] ?? ["", ""];
    const dmg = int(state.dv, rating);
    Object.assign(system, {
      dmg,
      stun: !!state.stun,
      dmgDef: state.dv ? `${dmg}${state.stun ? "S" : "P"}` : "",
      attackRating: state.ar.map((v) => int(v, rating)),
      skill,
      skillSpec,
      strWeapon: !!state.strWeapon,
    });
    if (category.fields.includes("modes")) system.modes = { ...state.modes };
    if (category.fields.includes("ammo")) {
      system.ammocap = int(state.ammo, rating);
      system.ammocount = system.ammocap;
    }
  }
  if (category.fields.includes("defense")) {
    system.defense = Math.abs(int(state.defense, rating));
    system.capacity = int(state.capacity, rating);
    system.social = int(state.social, rating);
  }
  if (category.fields.includes("essence")) system.essence = evaluate(state.essence, rating);
  if (state.category === "cyberware") system.capacity = int(state.capacity, rating);
  if (category.fields.includes("matrix")) {
    Object.assign(system, {
      a: int(state.a, rating),
      s: int(state.s, rating),
      d: int(state.d, rating),
      f: int(state.f, rating),
      progSlots: int(state.progSlots, rating),
    });
    if (rating > 0) system.matrix = { deviceRating: rating };
  }
  if (category.countable) {
    system.countable = true;
    system.count = Math.max(1, int(state.count, rating));
  }

  return {
    name: state.name.trim() || game.i18n.localize(category.label),
    type: "gear",
    system,
  };
}

/**
 * Creates gear the way the rulebook lists it: pick a category, paste a table row or fill the columns,
 * and the wizard fills the shadowrun6-eden item fields (skill, specialization, attack ratings, etc.).
 */
export class ItemWizard extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @param {{actor?: Actor, folder?: string}} options */
  constructor(options = {}) {
    super(options);
    this.actor = options.actor ?? null;
    this.state = emptyState();
    this.state.subtype = this.#subtypes()[0]?.value ?? "";
    this.lastParse = null;
  }

  static DEFAULT_OPTIONS = {
    id: "sre-item-wizard-{id}",
    classes: ["sre-item-wizard"],
    tag: "form",
    window: { title: "SRE.Wizard.Title", icon: "fas fa-wand-magic-sparkles", resizable: true },
    position: { width: 560, height: "auto" },
    form: { handler: ItemWizard.#onSubmit, submitOnChange: false, closeOnSubmit: false },
    actions: {
      parse: ItemWizard.#onParse,
      applyPreset: ItemWizard.#onApplyPreset,
      savePreset: ItemWizard.#onSavePreset,
      deletePreset: ItemWizard.#onDeletePreset,
      reset: ItemWizard.#onReset,
    },
  };

  static PARTS = {
    form: { template: `modules/${MODULE_ID}/templates/item-wizard.hbs` },
  };

  get title() {
    const title = game.i18n.localize("SRE.Wizard.Title");
    return this.actor ? `${title}: ${this.actor.name}` : title;
  }

  #subtypes(type = this.state.type) {
    const subtypes = CONFIG.SR6?.GEAR_SUBTYPES?.[type] ?? {};
    return Object.entries(subtypes).map(([value, label]) => ({ value, label: game.i18n.localize(label) }));
  }

  async #presets() {
    const all = [...(await loadBuiltinPresets()), ...worldPresets()];
    return all.filter((p) => p.state?.category === this.state.category);
  }

  async _prepareContext() {
    const category = CATEGORIES[this.state.category];
    const show = Object.fromEntries(category.fields.map((f) => [f, true]));
    const presets = await this.#presets();
    const [skill, spec] = WEAPON_SKILLS[this.state.subtype] ?? [];
    return {
      state: this.state,
      show,
      weapon: !!category.weapon,
      hasRating: !!category.rating,
      countable: !!category.countable,
      isCyberdeck: this.state.subtype === "CYBERDECK",
      example: category.example,
      categories: Object.entries(CATEGORIES).map(([value, c]) => ({ value, label: game.i18n.localize(c.label) })),
      multiType: category.types.length > 1,
      types: category.types.map((value) => ({ value, label: game.i18n.localize(`shadowrun6.itemtype.${value}`) })),
      subtypes: this.#subtypes(),
      legalities: [
        { value: "", label: game.i18n.localize("SRE.Wizard.Legal") },
        { value: "L", label: game.i18n.localize("SRE.Wizard.Licensed") },
        { value: "I", label: game.i18n.localize("SRE.Wizard.Illegal") },
      ],
      presets: presets.map((p) => ({ id: p.id, label: p.label ?? p.state.name, custom: !p.builtin })),
      skillHint: skill ? [
        game.i18n.localize(`skill.${skill}`),
        spec ? game.i18n.localize(`shadowrun6.special.${skill}.${spec}`) : null,
      ].filter(Boolean).join(" / ") : "",
      preview: this.#previews(),
      lastParse: this.lastParse,
      target: this.actor
        ? game.i18n.format("SRE.Wizard.TargetActor", { name: this.actor.name })
        : game.i18n.localize("SRE.Wizard.TargetWorld"),
    };
  }

  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    this.element.addEventListener("change", (event) => this.#onChange(event));
  }

  /** Reads the form into the state; switching category or type re-renders the visible columns. */
  #readForm() {
    const data = foundry.utils.expandObject(new foundry.applications.ux.FormDataExtended(this.element).object);
    const s = data.state ?? {};
    s.ar = [0, 1, 2, 3, 4].map((i) => s.ar?.[i] ?? "");
    s.modes = { SS: !!s.modes?.SS, SA: !!s.modes?.SA, BF: !!s.modes?.BF, FA: !!s.modes?.FA };
    for (const [key, value] of Object.entries(s)) {
      if (typeof value === "number") s[key] = String(value);
      else if (value === null || value === undefined) s[key] = "";
    }
    Object.assign(this.state, s);
  }

  /** Values calculated from rating formulas, shown next to their inputs. */
  #previews() {
    const rating = int(this.state.rating);
    const { avail, legality, price, essence } = this.state;
    return {
      avail: avail ? `= ${int(avail, rating)}${legality ? `(${legality})` : ""}` : "",
      price: price ? `= ${evaluate(price, rating)}¥` : "",
      essence: essence ? `= ${evaluate(essence, rating)}` : "",
    };
  }

  #onChange(event) {
    const name = event.target?.name ?? "";
    const before = { category: this.state.category, type: this.state.type };
    this.#readForm();
    if (name === "state.category" && this.state.category !== before.category) {
      const keep = { name: this.state.name, description: this.state.description };
      this.state = Object.assign(emptyState(this.state.category), keep);
      this.state.subtype = this.#subtypes()[0]?.value ?? "";
      this.lastParse = null;
    } else if (name === "state.type" && this.state.type !== before.type) {
      this.state.subtype = this.#subtypes()[0]?.value ?? "";
    }
    // Only layout changes re-render; re-rendering on every input would swallow a click on "Create".
    if (["state.category", "state.type", "state.subtype"].includes(name)) {
      this.render();
      return;
    }
    for (const [key, text] of Object.entries(this.#previews())) {
      const el = this.element.querySelector(`[data-preview="${key}"]`);
      if (el) el.textContent = text;
    }
  }

  static #onParse() {
    this.#readForm();
    const category = CATEGORIES[this.state.category];
    const { name, fields, unparsed } = parseStatLine(this.state.statLine, category, this.state.subtype);
    if (name && !this.state.name) this.state.name = name;
    Object.assign(this.state, fields);
    this.lastParse = {
      count: Object.keys(fields).length,
      unparsed: unparsed.join(" "),
    };
    this.render();
  }

  static async #onApplyPreset(event, target) {
    const id = target.closest("[data-preset-id]")?.dataset.presetId
      ?? this.element.querySelector("[name='preset']")?.value;
    const preset = (await this.#presets()).find((p) => p.id === id);
    if (!preset) return;
    this.state = foundry.utils.mergeObject(emptyState(preset.state.category), foundry.utils.deepClone(preset.state));
    this.lastParse = null;
    this.render();
  }

  static async #onSavePreset() {
    this.#readForm();
    if (!game.user.isGM) {
      ui.notifications.warn(game.i18n.localize("SRE.Wizard.PresetGMOnly"));
      return;
    }
    const label = this.state.name.trim();
    if (!label) {
      ui.notifications.warn(game.i18n.localize("SRE.Wizard.PresetNeedsName"));
      return;
    }
    const presets = worldPresets().filter((p) => p.label !== label || p.state.category !== this.state.category);
    const state = foundry.utils.deepClone(this.state);
    delete state.statLine;
    presets.push({ id: foundry.utils.randomID(), label, state });
    await game.settings.set(MODULE_ID, "presets", presets);
    ui.notifications.info(game.i18n.format("SRE.Wizard.PresetSaved", { name: label }));
    this.render();
  }

  static async #onDeletePreset() {
    const id = this.element.querySelector("[name='preset']")?.value;
    const presets = worldPresets();
    const preset = presets.find((p) => p.id === id);
    if (!preset || !game.user.isGM) return;
    await game.settings.set(MODULE_ID, "presets", presets.filter((p) => p.id !== id));
    ui.notifications.info(game.i18n.format("SRE.Wizard.PresetDeleted", { name: preset.label }));
    this.render();
  }

  static #onReset() {
    this.state = emptyState(this.state.category);
    this.state.subtype = this.#subtypes()[0]?.value ?? "";
    this.lastParse = null;
    this.render();
  }

  static async #onSubmit(event) {
    this.#readForm();
    const data = buildItemData(this.state);
    const openSheet = event.submitter?.dataset.open === "true";
    let item;
    if (this.actor) {
      [item] = await this.actor.createEmbeddedDocuments("Item", [data]);
    } else {
      item = await Item.implementation.create(data);
    }
    if (!item) return;
    ui.notifications.info(game.i18n.format("SRE.Wizard.Created", { name: item.name }));
    if (openSheet) {
      item.sheet.render(true);
      this.close();
    }
  }
}

export function openItemWizard(options = {}) {
  return new ItemWizard(options).render(true);
}
