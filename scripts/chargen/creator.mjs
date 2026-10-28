/**
 * Character creator (SR6 core pp. 62–69): priorities, metatype, attributes, skills, qualities, Karma, contacts,
 * knowledge and languages. Budgets and rule checks update live; "Create" makes a shadowrun6-eden Player actor.
 * Gear is bought afterwards from the catalog (the purchase dialog takes the character's nuyen).
 */
import { ATTRIBUTES, COLUMNS, MAGIC_TYPES, METATYPES, PRIORITY, ROWS, SKILLS, effectiveRow, emptyDraft, evaluateDraft } from "./rules.mjs";
import { QUALITIES } from "./qualities.mjs";
import { buildCharacter } from "./build.mjs";

const MODULE_ID = "shadowrun-edge";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const TABS = ["priorities", "attributes", "skills", "qualities", "extras", "summary"];

const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
const attrLabel = (a) => ({ edge: L("SRE.Chargen.Edge"), magic: L("SRE.Chargen.MagicRes") }[a] ?? L(`attrib.${a}`));
const skillLabel = (s) => L(`skill.${s}`);

/** Copies form values into the draft, turning numbered objects back into arrays. */
export function mergeForm(draft, form) {
  const toArray = (v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.values(v) : v ?? []);
  const next = foundry.utils.deepClone(draft);
  for (const [key, value] of Object.entries(form ?? {})) {
    if (["qualities", "contacts", "knowledge", "languages"].includes(key)) next[key] = toArray(value);
    else if (value && typeof value === "object" && !Array.isArray(value)) next[key] = { ...(next[key] ?? {}), ...value };
    else next[key] = value;
  }
  // Nested skill entries ({ points, karma, spec, specKarma }) merge per skill.
  if (form?.skills) {
    next.skills = { ...draft.skills };
    for (const [s, v] of Object.entries(form.skills)) next.skills[s] = { ...(draft.skills[s] ?? {}), ...v };
  }
  return next;
}

export class CharacterCreator extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    // Not "state": ApplicationV2 already has a read-only `state` (its render state).
    this.draft = emptyDraft();
    this.tab = "priorities";
    this.skipChecks = false;
  }

  static DEFAULT_OPTIONS = {
    id: "sre-character-creator-{id}",
    classes: ["sre-character-creator"],
    tag: "form",
    window: { title: "SRE.Chargen.Title", icon: "fas fa-user-plus", resizable: true },
    position: { width: 760, height: 720 },
    form: { handler: CharacterCreator.#onSubmit, submitOnChange: false, closeOnSubmit: false },
    actions: {
      showTab: CharacterCreator.#onTab,
      addRow: CharacterCreator.#onAddRow,
      removeRow: CharacterCreator.#onRemoveRow,
      reset: CharacterCreator.#onReset,
    },
  };

  static PARTS = {
    form: { template: `modules/${MODULE_ID}/templates/character-creator.hbs`, scrollable: [".sre-cc-body"] },
  };

  get result() {
    return evaluateDraft(this.draft);
  }

  #rowLabel(column, letter) {
    const row = PRIORITY[effectiveRow(letter, this.draft.level)];
    switch (column) {
      case "metatype": return `${row.metatypes.map((m) => L(`SRE.Chargen.Metatype.${m}`)).join(", ")} (${row.adjustment})`;
      case "attributes": return String(row.attributes);
      case "skills": return String(row.skills);
      case "magic": return Object.entries(row.magic).map(([t, v]) => (t === "mundane" ? L("SRE.Chargen.MagicType.mundane") : `${L(`SRE.Chargen.MagicType.${t}`)} ${v}`)).join(", ");
      case "resources": return `${row.resources.toLocaleString()}¥`;
      default: return "";
    }
  }

  async _prepareContext() {
    const d = this.draft;
    const r = this.result;
    const p = d.priorities;
    const metaRow = p.metatype ? PRIORITY[p.metatype] : null;
    const magicRow = p.magic ? PRIORITY[effectiveRow(p.magic, d.level)] : null;
    const adjustable = new Set(r.adjustable);
    const special = CONFIG.SR6?.skill_special ?? {};

    const attrRow = (a, base) => ({
      id: a, label: attrLabel(a), points: d.attrPoints[a] ?? 0, adjust: d.adjust[a] ?? 0, karma: d.attrKarma[a] ?? 0,
      final: r.final[a], max: r.max[a], base, hasPoints: ATTRIBUTES.includes(a), canAdjust: adjustable.has(a),
      atMax: r.final[a] >= r.max[a],
    });

    return {
      draft: d,
      tab: this.tab,
      tabs: TABS.map((id) => ({ id, label: L(`SRE.Chargen.Tab.${id}`), active: id === this.tab })),
      active: Object.fromEntries(TABS.map((id) => [id, id === this.tab])),
      levels: ["standard", "street", "prime"].map((value) => ({ value, label: L(`SRE.Chargen.Level.${value}`) })),
      priorityColumns: COLUMNS.map((column) => ({
        column,
        label: L(`SRE.Chargen.Column.${column}`),
        value: p[column],
        options: [{ value: "", label: "—" }, ...ROWS.map((letter) => ({ value: letter, label: `${letter}: ${this.#rowLabel(column, letter)}` }))],
      })),
      metatypes: (metaRow?.metatypes ?? Object.keys(METATYPES)).map((value) => ({ value, label: L(`SRE.Chargen.Metatype.${value}`) })),
      magicTypes: Object.keys(magicRow?.magic ?? MAGIC_TYPES).map((value) => ({ value, label: L(`SRE.Chargen.MagicType.${value}`) })),
      attributes: [
        ...ATTRIBUTES.map((a) => attrRow(a, 1)),
        attrRow("edge", 1),
        ...(r.awakened ? [attrRow("magic", r.magicBase)] : []),
      ],
      skills: SKILLS.map((s) => ({
        id: s, label: skillLabel(s), ...d.skills[s], rank: r.skills[s].rank,
        specs: [{ value: "", label: "—" }, ...Object.entries(special[s] ?? {}).map(([value, key]) => ({ value, label: L(key) }))],
      })),
      qualityOptions: [
        { value: "", label: "—" },
        ...Object.values(QUALITIES).filter((q) => q.positive).map((q) => ({ value: q.id, label: `+ ${q.name} (${q.karma}${q.levels ? "/" + L("SRE.Chargen.PerLevel") : ""})` })),
        ...Object.values(QUALITIES).filter((q) => !q.positive).map((q) => ({ value: q.id, label: `− ${q.name} (${q.variable ? `${q.min}–${q.max}` : q.karma}${q.levels ? "/" + L("SRE.Chargen.PerLevel") : ""})` })),
      ],
      attributeOptions: ATTRIBUTES.map((a) => ({ value: a, label: attrLabel(a) })),
      skillOptions: SKILLS.map((s) => ({ value: s, label: skillLabel(s) })),
      qualities: d.qualities.map((q, i) => {
        const def = QUALITIES[q.id];
        return {
          ...q, index: i, def, levels: def?.levels, variable: def?.variable,
          isAttr: def?.detail === "attribute", isSkill: def?.detail === "skill", isText: def?.detail === "text",
        };
      }),
      racial: r.qualities.filter((q) => q.racial).map((q) => `${q.def.name}${q.def.levels ? ` ${q.level}` : ""}`),
      contacts: d.contacts.map((c, i) => ({ ...c, index: i })),
      knowledge: d.knowledge.map((k, i) => ({ ...k, index: i })),
      languages: d.languages.map((l, i) => ({ ...l, index: i })),
      inDebt: d.qualities.some((q) => q.id === "in_debt"),
      result: r,
      budgets: this.#budgets(r),
      errors: this.#errors(r),
      magicNote: this.#magicNote(r),
      isGM: game.user.isGM,
      skipChecks: this.skipChecks,
    };
  }

  #budgets(r) {
    const b = r.budgets;
    const chip = (id, used, total, suffix = "") => ({ id, label: L(`SRE.Chargen.Budget.${id}`), text: `${used}/${total}${suffix}`, over: used > total });
    return [
      chip("attributes", b.attributes.used, b.attributes.total),
      chip("adjustment", b.adjustment.used, b.adjustment.total),
      chip("skills", b.skills.used, b.skills.total),
      chip("karma", b.karma.used, b.karma.total),
      chip("contacts", b.contacts.used, b.contacts.total),
      chip("knowledge", b.knowledge.used, b.knowledge.total),
      { id: "nuyen", label: L("SRE.Chargen.Budget.nuyen"), text: `${r.nuyen.toLocaleString()}¥`, over: false },
    ];
  }

  #errors(r) {
    return r.errors.map(({ key, data }) => {
      const d = { ...data };
      if (d.attribute) d.attribute = attrLabel(d.attribute);
      if (d.skill) d.skill = skillLabel(d.skill);
      if (d.quality) d.quality = QUALITIES[d.quality]?.name ?? d.quality;
      return L(`SRE.Chargen.Error.${key}`, d);
    });
  }

  #magicNote(r) {
    const m = r.magicChoices;
    if (this.draft.magicType === "mystic") return L("SRE.Chargen.MagicNote.mystic", { magic: r.magicBase });
    if (m.spells) return L("SRE.Chargen.MagicNote.spells", { count: m.spells });
    if (m.powerPoints) return L("SRE.Chargen.MagicNote.adept", { count: m.powerPoints });
    if (m.complexForms) return L("SRE.Chargen.MagicNote.techno", { count: m.complexForms });
    return "";
  }

  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    this.element.addEventListener("change", (event) => this.#onChange(event));
  }

  #readForm() {
    const data = foundry.utils.expandObject(new foundry.applications.ux.FormDataExtended(this.element).object);
    if ("skipChecks" in data) this.skipChecks = !!data.skipChecks;
    this.draft = mergeForm(this.draft, data.draft ?? {});
  }

  /** Choices that change what the form shows re-render it; everything else only refreshes the budgets. */
  #onChange(event) {
    const name = event.target?.name ?? "";
    this.#readForm();
    const structural = /^draft\.(level|priorities\.|metatype|magicType|qualities\.\d+\.id)/.test(name);
    if (structural) {
      // Keep the metatype and magic type valid for the chosen rows.
      const p = this.draft.priorities;
      if (p.metatype && !PRIORITY[p.metatype].metatypes.includes(this.draft.metatype)) this.draft.metatype = PRIORITY[p.metatype].metatypes[0];
      const magicRow = p.magic ? PRIORITY[effectiveRow(p.magic, this.draft.level)] : null;
      if (magicRow && !(this.draft.magicType in magicRow.magic)) this.draft.magicType = Object.keys(magicRow.magic)[0];
      this.render();
      return;
    }
    this.#refresh();
  }

  /** Updates budgets, final values and errors in place, so typing does not re-render (and lose a click). */
  #refresh() {
    const r = this.result;
    const root = this.element;
    for (const chip of this.#budgets(r)) {
      const el = root.querySelector(`[data-budget="${chip.id}"]`);
      if (!el) continue;
      el.querySelector(".sre-cc-budget-value").textContent = chip.text;
      el.classList.toggle("sre-cc-over", chip.over);
    }
    for (const [a, v] of Object.entries(r.final)) {
      const el = root.querySelector(`[data-final="${a}"]`);
      if (el) {
        el.textContent = v;
        el.classList.toggle("sre-cc-atmax", v >= r.max[a]);
      }
    }
    for (const s of SKILLS) {
      const el = root.querySelector(`[data-rank="${s}"]`);
      if (el) el.textContent = r.skills[s].rank;
    }
    const errors = root.querySelector(".sre-cc-errors");
    if (errors) {
      const list = this.#errors(r);
      errors.innerHTML = list.length
        ? list.map((e) => `<li>${Handlebars.escapeExpression(e)}</li>`).join("")
        : `<li class="sre-cc-ok">${Handlebars.escapeExpression(L("SRE.Chargen.AllGood"))}</li>`;
    }
    const karmaLeft = root.querySelector("[data-karma-left]");
    if (karmaLeft) karmaLeft.textContent = r.karmaLeft;
  }

  static #onTab(event, target) {
    this.#readForm();
    this.tab = target.dataset.tab;
    this.render();
  }

  static #onAddRow(event, target) {
    this.#readForm();
    const list = target.dataset.list;
    const blank = {
      qualities: { id: "", level: 1, detail: "", karma: 0 },
      contacts: { name: "", connection: 1, loyalty: 1, type: "" },
      knowledge: { name: "" },
      languages: { name: "", native: false },
    }[list];
    if (blank) this.draft[list] = [...(this.draft[list] ?? []), blank];
    this.render();
  }

  static #onRemoveRow(event, target) {
    this.#readForm();
    const { list, index } = target.dataset;
    this.draft[list] = this.draft[list].filter((_, i) => i !== Number(index));
    this.render();
  }

  static async #onReset() {
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: L("SRE.Chargen.Title") }, content: `<p>${L("SRE.Chargen.ResetConfirm")}</p>`, rejectClose: false,
    });
    if (!ok) return;
    this.draft = emptyDraft();
    this.tab = "priorities";
    this.render();
  }

  static async #onSubmit() {
    this.#readForm();
    const r = this.result;
    if (r.errors.length && !(game.user.isGM && this.skipChecks)) {
      ui.notifications.warn(L("SRE.Chargen.FixErrors"));
      this.tab = "summary";
      this.render();
      return;
    }
    const { actor, items } = buildCharacter(this.draft, r, {
      metatype: L(`SRE.Chargen.Metatype.${this.draft.metatype}`),
      racial: L("SRE.Chargen.Racial"),
      unnamed: L("SRE.Chargen.Unnamed"),
    });
    const created = await Actor.implementation.create(actor);
    if (!created) return;
    // The creator already paid for everything: no purchase or grade prompts for these items.
    if (items.length) await created.createEmbeddedDocuments("Item", items, { sreSkipAcquire: true });
    ui.notifications.info(L("SRE.Chargen.Created", { name: created.name }));
    created.sheet.render(true);
    this.close();
  }
}

export function openCharacterCreator() {
  return new CharacterCreator().render(true);
}

/** "Character creator" button in the Actors sidebar, for users who may create actors. */
Hooks.on("renderActorDirectory", (app, html) => {
  if (!game.user.can("ACTOR_CREATE")) return;
  const root = html instanceof HTMLElement ? html : html[0];
  const actions = root?.querySelector(".header-actions");
  if (!actions || actions.querySelector(".sre-chargen-button")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.classList.add("sre-chargen-button");
  button.innerHTML = `<i class="fas fa-user-plus"></i> ${L("SRE.Chargen.Button")}`;
  button.addEventListener("click", () => openCharacterCreator());
  actions.append(button);
});
