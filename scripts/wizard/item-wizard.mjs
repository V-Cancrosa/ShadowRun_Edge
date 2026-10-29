import { ACTOR_EFFECT_TARGETS, CATEGORIES, EFFECT_TARGETS, WEAPON_SKILLS, emptyState, typeLabel } from "./categories.mjs";
import { parseStatLine, evaluate } from "./parser.mjs";
import { collectFormulas } from "./formulas.mjs";
import { addToCatalog, modsToFlagData } from "../catalog.mjs";

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

function toHTML(text) {
  if (!text) return "";
  return text.split(/\n\s*\n/).map((p) => `<p>${Handlebars.escapeExpression(p).replace(/\n/g, "<br>")}</p>`).join("");
}

function availDef(state, rating) {
  if (!state.avail) return "";
  return `${int(state.avail, rating)}${state.legality ? `(${state.legality})` : ""}`;
}

/**
 * Active Effects from wizard effect rows.
 * - Item targets (EFFECT_TARGETS) change the item they sit on, or for a mod the item it is installed in.
 *   Toggled effects (bipod deployed, smartgun with a smartlink) start off, like the system's own mods.
 * - Character targets (ACTOR_EFFECT_TARGETS) apply to the character carrying the item (augmentations).
 *   A value of "R" becomes "@item.system.rating", which the system resolves, so it follows the Rating.
 */
export function buildEffects(effects, rating, fallbackName) {
  // `target` may also be a list (catalog data), so one switch covers e.g. all adrenaline pump bonuses.
  const targetsOf = (e) => [].concat(e.target ?? []);
  return (effects ?? [])
    .filter((e) => targetsOf(e).length && targetsOf(e).every((t) => EFFECT_TARGETS[t] || ACTOR_EFFECT_TARGETS[t])
      && String(e.value ?? "").trim())
    .map((e) => {
      const onActor = targetsOf(e).every((t) => ACTOR_EFFECT_TARGETS[t]);
      const raw = String(e.value).trim();
      const value = onActor && /^R$/i.test(raw) ? "@item.system.rating" : String(evaluate(raw, rating));
      const keys = targetsOf(e).flatMap((t) => (onActor ? ACTOR_EFFECT_TARGETS[t] : EFFECT_TARGETS[t]) ?? []);
      return {
        name: e.label?.trim() || fallbackName,
        img: "icons/svg/upgrade.svg",
        type: "base",
        disabled: !!e.toggle,
        transfer: onActor,
        changes: keys.map((key) => ({ key, mode: 2, value })),
        system: { level: 1, advanced: false },
      };
    });
}

/** Source book and page, plus the rating formulas the item recalculates from. */
function withCommon(data, state) {
  if (state.page) Object.assign(data.system, { product: state.product || "core", page: Number(state.page) });
  const formulas = collectFormulas(state);
  if (formulas) foundry.utils.setProperty(data, `flags.${MODULE_ID}.formulas`, formulas);
  // Mount and Capacity cost, checked when the mod is installed (scripts/mounts.mjs).
  const mount = (Array.isArray(state.mount) ? state.mount : String(state.mount ?? "").split(",")).filter(Boolean);
  if (data.type === "mod" && mount.length) foundry.utils.setProperty(data, `flags.${MODULE_ID}.mount`, mount);
  if (state.capacityCost) foundry.utils.setProperty(data, `flags.${MODULE_ID}.capacityCost`, state.capacityCost);
  return data;
}

/** Notes the item sheet has no field for (capacity taken, damage element), placed before the description. */
function notesHTML(state) {
  const notes = [];
  if (state.capacityCost) notes.push(game.i18n.format("SRE.Wizard.Note.CapacityCost", { value: state.capacityCost }));
  if (state.notes) notes.push(Handlebars.escapeExpression(state.notes));
  return notes.length ? `<p><em>${notes.join("<br>")}</em></p>` : "";
}

/** Turns the wizard state of the "mod" category into a shadowrun6-eden mod item with its Active Effects. */
export function buildModData(state) {
  const rating = int(state.rating);
  const name = state.name.trim() || game.i18n.localize("SRE.Wizard.Category.mod");
  return withCommon({
    name,
    type: "mod",
    system: {
      type: state.type,
      rating,
      availDef: availDef(state, rating),
      price: evaluate(state.price, rating),
      description: notesHTML(state) + toHTML(state.description),
    },
    effects: buildEffects(state.effects, rating, name),
  }, state);
}

/**
 * Turns the wizard state into Item data for the shadowrun6-eden "gear" type.
 * Field names follow the system's template.json.
 */
export function buildItemData(state) {
  const category = CATEGORIES[state.category];
  if (category.itemType === "mod") return buildModData(state);
  const rating = int(state.rating);
  const system = {
    type: state.type,
    subtype: state.subtype,
    rating,
    needsRating: !!category.rating && rating > 0,
    avail: int(state.avail, rating),
    availDef: availDef(state, rating),
    price: evaluate(state.price, rating),
    priceDef: state.price && /R/i.test(state.price) ? state.price : "",
    description: notesHTML(state) + toHTML(state.description),
  };

  if (category.weapon) {
    const [skill, skillSpec] = WEAPON_SKILLS[state.subtype] ?? ["", ""];
    const dmg = int(state.dv, rating);
    Object.assign(system, {
      dmg,
      stun: !!state.stun,
      dmgDef: state.dv ? `${dmg}${state.stun ? "S" : "P"}${state.element ? `(${state.element})` : ""}` : "",
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
  // Columns some tables share across categories (cyberjacks have Essence, optical devices have Capacity).
  if (state.essence && system.essence === undefined) system.essence = evaluate(state.essence, rating);
  if (state.capacity && system.capacity === undefined) system.capacity = int(state.capacity, rating);
  if (category.countable) {
    system.countable = true;
    system.count = Math.max(1, int(state.count, rating));
  }

  const name = state.name.trim() || game.i18n.localize(category.label);
  const data = { name, type: "gear", system };
  const effects = buildEffects(state.effects, rating, name);
  if (effects.length) data.effects = effects;
  return withCommon(data, state);
}

/** One-line summary of a parsed table row for the bulk preview. */
function summarize(state) {
  const category = CATEGORIES[state.category];
  const parts = [];
  if (category.weapon) {
    if (state.dv) parts.push(`${state.dv}${state.stun ? "S" : "P"}`);
    const modes = Object.entries(state.modes).filter(([, on]) => on).map(([m]) => m).join("/");
    if (modes) parts.push(modes);
    if (state.ar.some(Boolean)) parts.push(state.ar.map((v) => v || "—").join("/"));
    if (state.ammo) parts.push(`${state.ammo}`);
  }
  for (const key of ["rating", "defense", "capacity", "essence", "a", "s", "d", "f", "progSlots"]) {
    if (state[key]) parts.push(`${key}: ${state[key]}`);
  }
  if (state.avail) parts.push(`${state.avail}${state.legality ? `(${state.legality})` : ""}`);
  if (state.price) parts.push(`${state.price}¥`);
  return parts.join(" · ");
}

/**
 * Creates gear the way the rulebook lists it: pick a category, paste a table row (or a whole table) or fill
 * the columns, and the wizard fills the shadowrun6-eden item fields (skill, specialization, attack ratings, etc.).
 * Items go to an actor, the Items directory, or the catalog compendium.
 */
export class ItemWizard extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @param {{actor?: Actor, target?: "actor"|"world"|"catalog"}} options */
  constructor(options = {}) {
    super(options);
    this.actor = options.actor ?? null;
    this.target = this.actor ? "actor" : (options.target ?? (game.user.isGM ? "catalog" : "world"));
    this.wizardState = emptyState();
    this.wizardState.subtype = this.#subtypes()[0]?.value ?? "";
    this.lastParse = null;
    this.bulk = null;
  }

  static DEFAULT_OPTIONS = {
    id: "sre-item-wizard-{id}",
    classes: ["sre-item-wizard", "sre-dialog"],
    tag: "form",
    window: { title: "SRE.Wizard.Title", icon: "fas fa-wand-magic-sparkles", resizable: true },
    position: { width: 600, height: "auto" },
    form: { handler: ItemWizard.#onSubmit, submitOnChange: false, closeOnSubmit: false },
    actions: {
      parse: ItemWizard.#onParse,
      createBulk: ItemWizard.#onCreateBulk,
      clearBulk: ItemWizard.#onClearBulk,
      applyPreset: ItemWizard.#onApplyPreset,
      savePreset: ItemWizard.#onSavePreset,
      deletePreset: ItemWizard.#onDeletePreset,
      addEffect: ItemWizard.#onAddEffect,
      removeEffect: ItemWizard.#onRemoveEffect,
      removeMod: ItemWizard.#onRemoveMod,
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

  get category() {
    return CATEGORIES[this.wizardState.category];
  }

  #subtypes(type = this.wizardState.type) {
    if (this.category.itemType === "mod") return [];
    const subtypes = CONFIG.SR6?.GEAR_SUBTYPES?.[type] ?? {};
    return Object.entries(subtypes).map(([value, label]) => ({ value, label: game.i18n.localize(label) }));
  }

  async #presets() {
    const all = [...(await loadBuiltinPresets()), ...worldPresets()];
    return all.filter((p) => p.state?.category === this.wizardState.category);
  }

  /** Catalog folder path for the current kind, e.g. ["Broń palna", "Ciężkie pistolety"]. */
  #folderPath() {
    const category = this.category;
    const path = [game.i18n.localize(category.label)];
    if (category.types.length > 1) path.push(game.i18n.localize(typeLabel(category, this.wizardState.type)));
    const subtype = this.#subtypes().find((s) => s.value === this.wizardState.subtype);
    if (subtype) path.push(subtype.label);
    return path;
  }

  async _prepareContext() {
    const category = this.category;
    const show = Object.fromEntries(category.fields.map((f) => [f, true]));
    const presets = await this.#presets();
    const [skill, spec] = WEAPON_SKILLS[this.wizardState.subtype] ?? [];
    const targets = [];
    if (this.actor) targets.push({ value: "actor", label: game.i18n.format("SRE.Wizard.TargetActor", { name: this.actor.name }) });
    targets.push({ value: "world", label: game.i18n.localize("SRE.Wizard.TargetWorld") });
    if (game.user.isGM) targets.push({ value: "catalog", label: game.i18n.localize("SRE.Wizard.TargetCatalog") });
    return {
      state: this.wizardState,
      show,
      isMod: category.itemType === "mod",
      weapon: !!category.weapon,
      hasRating: !!category.rating,
      countable: !!category.countable,
      isCyberdeck: this.wizardState.subtype === "CYBERDECK",
      example: category.example,
      categories: Object.entries(CATEGORIES).map(([value, c]) => ({ value, label: game.i18n.localize(c.label) })),
      multiType: category.types.length > 1,
      types: category.types.map((value) => ({ value, label: game.i18n.localize(typeLabel(category, value)) })),
      subtypes: this.#subtypes(),
      legalities: [
        { value: "", label: game.i18n.localize("SRE.Wizard.Legal") },
        { value: "L", label: game.i18n.localize("SRE.Wizard.Licensed") },
        { value: "I", label: game.i18n.localize("SRE.Wizard.Illegal") },
      ],
      showEffects: category.itemType === "mod" || !!category.actorEffects,
      mountOptions: ["", "top", "barrel", "under", "top,under"].map((value) => ({
        value,
        label: game.i18n.localize(`SRE.Mount.Option.${value.replace(",", "_") || "none"}`),
      })),
      effectTargets: Object.keys(category.actorEffects ? ACTOR_EFFECT_TARGETS : EFFECT_TARGETS).map((value) => ({
        value,
        label: game.i18n.localize(`SRE.Wizard.Effect.Target.${value}`),
      })),
      presets: presets.map((p) => ({ id: p.id, label: p.label ?? p.state.name })),
      skillHint: skill ? [
        game.i18n.localize(`skill.${skill}`),
        spec ? game.i18n.localize(`shadowrun6.special.${skill}.${spec}`) : null,
      ].filter(Boolean).join(" / ") : "",
      preview: this.#previews(),
      lastParse: this.lastParse,
      bulk: this.bulk,
      target: this.target,
      isCatalog: this.target === "catalog",
      targets,
      folderPath: this.#folderPath().join(" / "),
    };
  }

  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    this.element.addEventListener("change", (event) => this.#onChange(event));
    // Mods dragged from a compendium or the Items directory become built-in mods of the item.
    this.element.addEventListener("dragover", (event) => event.preventDefault());
    this.element.addEventListener("drop", (event) => this.#onDrop(event));
  }

  /** Reads the form into the state. */
  #readForm() {
    const data = foundry.utils.expandObject(new foundry.applications.ux.FormDataExtended(this.element).object);
    if (data.target) this.target = data.target;
    const s = data.state ?? {};
    s.ar = [0, 1, 2, 3, 4].map((i) => s.ar?.[i] ?? "");
    s.modes = { SS: !!s.modes?.SS, SA: !!s.modes?.SA, BF: !!s.modes?.BF, FA: !!s.modes?.FA };
    if (s.effects) {
      s.effects = Object.values(s.effects).map((e) => ({
        label: e.label ?? "",
        target: e.target ?? "ar",
        value: e.value == null ? "" : String(e.value),
        toggle: !!e.toggle,
      }));
    }
    for (const [key, value] of Object.entries(s)) {
      if (typeof value === "number") s[key] = String(value);
      else if (value === null || value === undefined) s[key] = "";
    }
    Object.assign(this.wizardState, s);
  }

  /** Values calculated from rating formulas, shown next to their inputs. */
  #previews() {
    const rating = int(this.wizardState.rating);
    const { avail, legality, price, essence } = this.wizardState;
    return {
      avail: avail ? `= ${int(avail, rating)}${legality ? `(${legality})` : ""}` : "",
      price: price ? `= ${evaluate(price, rating)}¥` : "",
      essence: essence ? `= ${evaluate(essence, rating)}` : "",
    };
  }

  #onChange(event) {
    const name = event.target?.name ?? "";
    const before = { category: this.wizardState.category, type: this.wizardState.type };
    this.#readForm();
    if (name === "state.category" && this.wizardState.category !== before.category) {
      const keep = { name: this.wizardState.name, description: this.wizardState.description, statLine: this.wizardState.statLine };
      this.wizardState = Object.assign(emptyState(this.wizardState.category), keep);
      this.wizardState.subtype = this.#subtypes()[0]?.value ?? "";
      this.lastParse = null;
      this.bulk = null;
    } else if (name === "state.type" && this.wizardState.type !== before.type) {
      this.wizardState.subtype = this.#subtypes()[0]?.value ?? "";
    }
    // Only layout changes re-render; re-rendering on every input would swallow a click on "Create".
    if (["state.category", "state.type", "state.subtype", "target"].includes(name)) {
      if (this.bulk) this.#parseBulk();
      this.render();
      return;
    }
    for (const [key, text] of Object.entries(this.#previews())) {
      const el = this.element.querySelector(`[data-preview="${key}"]`);
      if (el) el.textContent = text;
    }
  }

  async #onDrop(event) {
    if (this.category.itemType === "mod") return;
    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    if (data?.type !== "Item") return;
    event.preventDefault();
    const item = await fromUuid(data.uuid);
    if (!item) return;
    if (item.type !== "mod") {
      ui.notifications.warn(game.i18n.localize("SRE.Wizard.Mods.OnlyMods"));
      return;
    }
    this.#readForm();
    this.wizardState.mods = [...(this.wizardState.mods ?? []), { uuid: item.uuid, name: item.name }];
    this.render();
  }

  /** Parses every non-empty line of the paste field as one table row. */
  #parseBulk() {
    const lines = String(this.wizardState.statLine ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    this.bulk = lines.map((line) => {
      const { name, fields, unparsed } = parseStatLine(line, this.category, this.wizardState.subtype);
      const state = Object.assign(emptyState(this.wizardState.category), {
        type: this.wizardState.type,
        subtype: this.wizardState.subtype,
        mods: [...(this.wizardState.mods ?? [])],
        effects: foundry.utils.deepClone(this.wizardState.effects ?? []),
      }, fields, { name: name || line });
      return { state, summary: summarize(state), unparsed: unparsed.join(" ") };
    });
  }

  static #onParse() {
    this.#readForm();
    const lines = String(this.wizardState.statLine ?? "").split(/\r?\n/).filter((l) => l.trim());
    if (lines.length > 1) {
      this.#parseBulk();
      this.lastParse = null;
    } else {
      const { name, fields, unparsed } = parseStatLine(this.wizardState.statLine, this.category, this.wizardState.subtype);
      if (name && !this.wizardState.name) this.wizardState.name = name;
      Object.assign(this.wizardState, fields);
      this.lastParse = { count: Object.keys(fields).length, unparsed: unparsed.join(" ") };
      this.bulk = null;
    }
    this.render();
  }

  static #onClearBulk() {
    this.#readForm();
    this.bulk = null;
    this.render();
  }

  static async #onApplyPreset() {
    const id = this.element.querySelector("[name='preset']")?.value;
    const preset = (await this.#presets()).find((p) => p.id === id);
    if (!preset) return;
    this.wizardState = foundry.utils.mergeObject(emptyState(preset.state.category), foundry.utils.deepClone(preset.state));
    this.lastParse = null;
    this.bulk = null;
    this.render();
  }

  static async #onSavePreset() {
    this.#readForm();
    if (!game.user.isGM) {
      ui.notifications.warn(game.i18n.localize("SRE.Wizard.PresetGMOnly"));
      return;
    }
    const label = this.wizardState.name.trim();
    if (!label) {
      ui.notifications.warn(game.i18n.localize("SRE.Wizard.PresetNeedsName"));
      return;
    }
    const presets = worldPresets().filter((p) => p.label !== label || p.state.category !== this.wizardState.category);
    const state = foundry.utils.deepClone(this.wizardState);
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

  static #onAddEffect() {
    this.#readForm();
    const target = this.category.actorEffects ? "str" : "ar";
    this.wizardState.effects = [...(this.wizardState.effects ?? []), { label: "", target, value: "", toggle: false }];
    this.render();
  }

  static #onRemoveEffect(event, target) {
    this.#readForm();
    const index = Number(target.dataset.index);
    this.wizardState.effects = this.wizardState.effects.filter((_, i) => i !== index);
    this.render();
  }

  static #onRemoveMod(event, target) {
    this.#readForm();
    const index = Number(target.dataset.index);
    this.wizardState.mods = this.wizardState.mods.filter((_, i) => i !== index);
    this.render();
  }

  static #onReset() {
    this.wizardState = emptyState(this.wizardState.category);
    this.wizardState.subtype = this.#subtypes()[0]?.value ?? "";
    this.lastParse = null;
    this.bulk = null;
    this.render();
  }

  /** Item data for a state, with the built-in mods stored in a flag until the item lands on an actor. */
  async #itemData(state) {
    const data = buildItemData(state);
    if (data.type !== "mod" && state.mods?.length) {
      const mods = (await Promise.all(state.mods.map((m) => fromUuid(m.uuid)))).filter(Boolean);
      if (mods.length < state.mods.length) ui.notifications.warn(game.i18n.localize("SRE.Wizard.Mods.Missing"));
      data.flags = { [MODULE_ID]: { mods: modsToFlagData(mods) } };
    }
    return data;
  }

  /** Creates the items in the chosen place and reports how many were made. */
  async #create(states) {
    const data = await Promise.all(states.map((s) => this.#itemData(s)));
    let created;
    try {
      // The wizard sets every value itself, so no purchase or grade prompt afterwards.
      if (this.target === "actor" && this.actor) created = await this.actor.createEmbeddedDocuments("Item", data, { sreSkipAcquire: true });
      else if (this.target === "catalog") created = await addToCatalog(data, this.#folderPath());
      else created = await Item.implementation.createDocuments(data);
    } catch (err) {
      ui.notifications.error(err.message);
      return [];
    }
    if (created?.length === 1) ui.notifications.info(game.i18n.format("SRE.Wizard.Created", { name: created[0].name }));
    else if (created?.length) ui.notifications.info(game.i18n.format("SRE.Wizard.CreatedMany", { count: created.length }));
    return created ?? [];
  }

  static async #onCreateBulk() {
    this.#readForm();
    if (!this.bulk?.length) return;
    const created = await this.#create(this.bulk.map((row) => row.state));
    if (created.length) {
      this.bulk = null;
      this.wizardState.statLine = "";
      this.render();
    }
  }

  static async #onSubmit(event) {
    this.#readForm();
    const [item] = await this.#create([this.wizardState]);
    if (item && event.submitter?.dataset.open === "true") {
      item.sheet.render(true);
      this.close();
    }
  }
}

export function openItemWizard(options = {}) {
  return new ItemWizard(options).render(true);
}
