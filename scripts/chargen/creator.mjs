/**
 * Character creator (SR6 core pp. 62–69): priorities, metatype, attributes, skills, qualities, Karma, contacts,
 * knowledge and languages. Budgets and rule checks update live; "Create" makes a shadowrun6-eden Player actor.
 * Gear is bought afterwards from the catalog (the purchase dialog takes the character's nuyen).
 */
import {
  ATTRIBUTES, COLUMNS, MAGIC_TYPES, METATYPES, PRIORITY, ROWS, SKILLS, effectiveRow, emptyDraft, evaluateDraft, qualityKarma,
} from "./rules.mjs";
import { QUALITIES } from "./qualities.mjs";
import { buildCharacter, repairUpdate } from "./build.mjs";
import { errataFlags } from "../errata.mjs";

const MODULE_ID = "shadowrun-edge";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const TABS = ["priorities", "attributes", "skills", "qualities", "extras", "summary"];

const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
const attrLabel = (a) => ({ edge: L("SRE.Chargen.Edge"), magic: L("SRE.Chargen.MagicRes") }[a] ?? L(`attrib.${a}`));
const skillLabel = (s) => L(`skill.${s}`);

/** Which step an error belongs to, by its key (see evaluateDraft). */
const ERROR_TABS = [
  [/^(Priority|Metatype|Magic)/, "priorities"],
  [/^(Adjust|Attr)/, "attributes"],
  [/^(Skill|Spec)/, "skills"],
  [/^(Qualit|Exceptional)/, "qualities"],
  [/^(Karma|Contact|Native)/, "extras"],
];

/** Rank dots like on SR sheets: filled up to the value, empty up to the maximum, marked when over it. */
function dots(value, max) {
  const count = Math.max(max, value);
  return Array.from({ length: count }, (_, i) => ({ filled: i < value, over: i >= max }));
}
function dotsHTML(value, max) {
  return dots(value, max).map((d) => `<span class="sre-cc-dot${d.filled ? " filled" : ""}${d.over ? " over" : ""}"></span>`).join("");
}

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
    return evaluateDraft(this.draft, { errata: errataFlags() });
  }

  #rowLabel(column, letter) {
    const row = PRIORITY[effectiveRow(letter, this.draft.level)];
    switch (column) {
      case "metatype": return `${row.metatypes.map((m) => L(`SRE.Chargen.Metatype.${m}`)).join(", ")} (${row.adjustment})`;
      case "attributes": return String(row.attributes);
      case "skills": return String(row.skills);
      case "magic": {
        // Group types sharing a rating: "Mag/Myst./Adept/Techno 4 · Asp. 5"
        const groups = new Map();
        for (const [t, v] of Object.entries(row.magic)) {
          if (t === "mundane") continue;
          groups.set(v, [...(groups.get(v) ?? []), L(`SRE.Chargen.MagicShort.${t}`)]);
        }
        const parts = [...groups].map(([v, names]) => `${names.join("/")} ${v}`);
        return parts.length ? parts.join(" · ") : L("SRE.Chargen.MagicShort.mundane");
      }
      case "resources": return `${row.resources.toLocaleString()}¥`;
      default: return "";
    }
  }

  async _prepareContext() {
    const d = this.draft;
    const r = this.result;
    const p = d.priorities;
    const metaRow = p.metatype ? PRIORITY[effectiveRow(p.metatype, d.level)] : null;
    const magicRow = p.magic ? PRIORITY[effectiveRow(p.magic, d.level)] : null;
    const adjustable = new Set(r.adjustable);
    const special = CONFIG.SR6?.skill_special ?? {};
    const errors = this.#errors(r);
    const errorCount = (tab) => errors.filter((e) => e.tab === tab).length;

    const attrRow = (a) => ({
      id: a, label: attrLabel(a), short: L(`SRE.Chargen.Short.${a}`),
      points: d.attrPoints[a] ?? 0, adjust: d.adjust[a] ?? 0, karma: d.attrKarma[a] ?? 0,
      final: r.final[a], max: r.max[a], hasPoints: ATTRIBUTES.includes(a), canAdjust: adjustable.has(a),
      atMax: r.final[a] >= r.max[a], over: r.final[a] > r.max[a], dots: dots(r.final[a], r.max[a]),
    });
    const tabs = TABS.map((id, i) => ({
      id, number: i + 1, label: L(`SRE.Chargen.Tab.${id}`), active: id === this.tab,
      errors: id === "summary" ? 0 : errorCount(id), done: id !== "summary" && !errorCount(id),
    }));

    return {
      draft: d,
      tab: this.tab,
      tabs,
      active: Object.fromEntries(TABS.map((id) => [id, id === this.tab])),
      levels: ["standard", "street", "prime"].map((value) => ({ value, label: L(`SRE.Chargen.Level.${value}`) })),
      columns: COLUMNS.map((column) => ({ column, label: L(`SRE.Chargen.Column.${column}`) })),
      priorityGrid: ROWS.map((letter) => ({
        letter,
        cells: COLUMNS.map((column) => ({
          column, letter, text: this.#rowLabel(column, letter),
          selected: p[column] === letter,
          taken: COLUMNS.some((c) => c !== column && p[c] === letter),
        })),
      })),
      metatypeCards: Object.keys(METATYPES).map((value) => ({
        value, label: L(`SRE.Chargen.Metatype.${value}`), selected: d.metatype === value,
        disabled: !!metaRow && !metaRow.metatypes.includes(value),
        specials: Object.entries(METATYPES[value].max).filter(([a, m]) => m !== 6 || (a === "edge" && m !== 6))
          .map(([a, m]) => `${L(`SRE.Chargen.Short.${a}`)} ${m}`).join(" · ") || "—",
      })),
      magicCards: Object.keys(MAGIC_TYPES).map((value) => ({
        value, label: L(`SRE.Chargen.MagicType.${value}`), selected: d.magicType === value,
        disabled: !!magicRow && !(value in magicRow.magic),
        rating: magicRow?.magic[value],
        icon: { full: "fa-hat-wizard", aspected: "fa-wand-sparkles", mystic: "fa-yin-yang", adept: "fa-hand-fist", techno: "fa-microchip", mundane: "fa-user" }[value],
      })),
      attributes: [...ATTRIBUTES.map(attrRow), attrRow("edge"), ...(r.awakened ? [attrRow("magic")] : [])],
      skills: SKILLS.map((s) => ({
        id: s, label: skillLabel(s), ...d.skills[s], rank: r.skills[s].rank, max: r.skills[s].max,
        dots: dots(r.skills[s].rank, r.skills[s].max), trained: r.skills[s].rank > 0,
        specs: [{ value: "", label: "—" }, ...Object.entries(special[s] ?? {}).map(([value, key]) => ({ value, label: L(key) }))],
      })),
      qualityOptions: [
        { value: "", label: L("SRE.Chargen.PickQuality") },
        ...Object.values(QUALITIES).filter((q) => q.positive).map((q) => ({ value: q.id, label: `+ ${q.name} (${q.karma}${q.levels ? "/" + L("SRE.Chargen.PerLevel") : ""})` })),
        ...Object.values(QUALITIES).filter((q) => !q.positive).map((q) => ({ value: q.id, label: `− ${q.name} (${q.variable ? `${q.min}–${q.max}` : q.karma}${q.levels ? "/" + L("SRE.Chargen.PerLevel") : ""})` })),
      ],
      attributeOptions: ATTRIBUTES.map((a) => ({ value: a, label: attrLabel(a) })),
      skillOptions: SKILLS.map((s) => ({ value: s, label: skillLabel(s) })),
      qualities: d.qualities.map((q, i) => {
        const def = QUALITIES[q.id];
        const karma = def ? qualityKarma({ def, level: Math.max(1, Number(q.level) || 1), karma: q.karma, racial: false }) : 0;
        return {
          ...q, index: i, def, levels: def?.levels, variable: def?.variable,
          positive: def?.positive, negative: def && !def.positive,
          badge: def ? `${def.positive ? "−" : "+"}${karma}` : "",
          isAttr: def?.detail === "attribute", isSkill: def?.detail === "skill", isText: def?.detail === "text",
        };
      }),
      racial: r.qualities.filter((q) => q.racial).map((q) => `${q.def.name}${q.def.levels ? ` ${q.level}` : ""}`),
      contacts: d.contacts.map((c, i) => ({ ...c, index: i })),
      knowledge: d.knowledge.map((k, i) => ({ ...k, index: i })),
      languages: d.languages.map((l, i) => ({ ...l, index: i })),
      inDebt: d.qualities.some((q) => q.id === "in_debt"),
      nuyenPerKarma: (d.qualities.some((q) => q.id === "in_debt") ? 5000 : 2000).toLocaleString(),
      result: r,
      nuyenText: r.nuyen.toLocaleString(),
      budgets: this.#budgets(r),
      errors,
      magicNote: this.#magicNote(r),
      header: {
        name: d.name?.trim() || L("SRE.Chargen.Unnamed"),
        initial: (d.name?.trim() || L(`SRE.Chargen.Metatype.${d.metatype}`)).charAt(0),
        metatype: L(`SRE.Chargen.Metatype.${d.metatype}`),
        magic: L(`SRE.Chargen.MagicType.${d.magicType}`),
        level: L(`SRE.Chargen.LevelShort.${d.level}`),
      },
      summary: {
        attributes: [...ATTRIBUTES, "edge", ...(r.awakened ? ["magic"] : [])].map((a) => ({ short: L(`SRE.Chargen.Short.${a}`), value: r.final[a] })),
        skills: SKILLS.filter((s) => r.skills[s].rank).sort((a, b) => r.skills[b].rank - r.skills[a].rank)
          .map((s) => ({ label: skillLabel(s), rank: r.skills[s].rank, spec: r.skills[s].spec ? L(special[s]?.[r.skills[s].spec] ?? r.skills[s].spec) : "" })),
        qualities: r.qualities.map((q) => ({ name: `${q.def.name}${q.def.levels ? ` ${q.level}` : ""}`, positive: q.def.positive, racial: q.racial })),
        contacts: d.contacts.filter((c) => c.name?.trim()),
      },
      isGM: game.user.isGM,
      skipChecks: this.skipChecks,
    };
  }

  /** Budget meters: used/total, fill percentage and state (partial, full, over). */
  #budgets(r) {
    const b = r.budgets;
    const meter = (id) => {
      const { used, total } = b[id];
      const state = used > total ? "over" : used === total && total > 0 ? "full" : "partial";
      return { id, label: L(`SRE.Chargen.Budget.${id}`), text: `${used}/${total}`, pct: total ? Math.min(100, Math.round((used / total) * 100)) : used ? 100 : 0, state };
    };
    return [
      ...["attributes", "adjustment", "skills", "karma", "contacts", "knowledge"].map(meter),
      { id: "nuyen", label: L("SRE.Chargen.Budget.nuyen"), text: `${r.nuyen.toLocaleString()}¥`, pct: 100, state: "info" },
    ];
  }

  /** Error messages with the step they belong to (shown as a badge on that step's tab). */
  #errors(r) {
    return r.errors.map(({ key, data }) => {
      const d = { ...data };
      if (d.attribute) d.attribute = attrLabel(d.attribute);
      if (d.skill) d.skill = skillLabel(d.skill);
      if (d.quality) d.quality = QUALITIES[d.quality]?.name ?? d.quality;
      return { text: L(`SRE.Chargen.Error.${key}`, d), tab: ERROR_TABS.find(([re]) => re.test(key))?.[1] ?? "summary" };
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
      const metaRow = p.metatype ? PRIORITY[effectiveRow(p.metatype, this.draft.level)] : null;
      if (metaRow && !metaRow.metatypes.includes(this.draft.metatype)) this.draft.metatype = metaRow.metatypes[0];
      const magicRow = p.magic ? PRIORITY[effectiveRow(p.magic, this.draft.level)] : null;
      if (magicRow && !(this.draft.magicType in magicRow.magic)) this.draft.magicType = Object.keys(magicRow.magic)[0];
      this.render();
      return;
    }
    this.#refresh();
  }

  /** Updates meters, rank dots, step badges and errors in place, so typing does not re-render (and lose a click). */
  #refresh() {
    const r = this.result;
    const root = this.element;
    for (const meter of this.#budgets(r)) {
      const el = root.querySelector(`[data-budget="${meter.id}"]`);
      if (!el) continue;
      el.querySelector(".sre-cc-budget-value").textContent = meter.text;
      const bar = el.querySelector(".sre-cc-meter-fill");
      if (bar) bar.style.width = `${meter.pct}%`;
      el.dataset.state = meter.state;
    }
    for (const [a, v] of Object.entries(r.final)) {
      const el = root.querySelector(`[data-final="${a}"]`);
      if (!el) continue;
      el.textContent = v;
      const row = el.closest("[data-row]");
      row?.classList.toggle("sre-cc-atmax", v >= r.max[a]);
      row?.classList.toggle("sre-cc-overmax", v > r.max[a]);
      const dotBox = row?.querySelector(".sre-cc-dots");
      if (dotBox) dotBox.innerHTML = dotsHTML(v, r.max[a]);
    }
    for (const s of SKILLS) {
      const el = root.querySelector(`[data-rank="${s}"]`);
      if (!el) continue;
      el.textContent = r.skills[s].rank;
      const row = el.closest("[data-row]");
      row?.classList.toggle("sre-cc-trained", r.skills[s].rank > 0);
      const dotBox = row?.querySelector(".sre-cc-dots");
      if (dotBox) dotBox.innerHTML = dotsHTML(r.skills[s].rank, r.skills[s].max);
    }
    const errors = this.#errors(r);
    const list = root.querySelector(".sre-cc-errors");
    if (list) {
      list.innerHTML = errors.length
        ? errors.map((e) => `<li><i class="fas fa-triangle-exclamation"></i> ${Handlebars.escapeExpression(e.text)}</li>`).join("")
        : `<li class="sre-cc-ok"><i class="fas fa-circle-check"></i> ${Handlebars.escapeExpression(L("SRE.Chargen.AllGood"))}</li>`;
    }
    for (const tab of root.querySelectorAll(".sre-cc-step[data-tab]")) {
      const id = tab.dataset.tab;
      if (id === "summary") continue;
      const count = errors.filter((e) => e.tab === id).length;
      const badge = tab.querySelector(".sre-cc-step-badge");
      if (badge) badge.textContent = count || "";
      tab.classList.toggle("sre-cc-step-error", count > 0);
      tab.classList.toggle("sre-cc-step-done", !count);
    }
    root.querySelector(".sre-cc")?.classList.toggle("sre-cc-has-errors", errors.length > 0);
    const karmaLeft = root.querySelector("[data-karma-left]");
    if (karmaLeft) karmaLeft.textContent = r.karmaLeft;
    const name = root.querySelector("[data-header-name]");
    if (name) name.textContent = this.draft.name?.trim() || L("SRE.Chargen.Unnamed");
    const initial = root.querySelector("[data-header-initial]");
    if (initial) initial.textContent = (this.draft.name?.trim() || L(`SRE.Chargen.Metatype.${this.draft.metatype}`)).charAt(0);
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

/**
 * Characters made by creator versions up to 0.5.0 lack the attributes' "mod" and the skills' "modifier",
 * which makes the system's pools NaN (rolls of 0d6). The GM's client fills the gaps once on load.
 */
Hooks.once("ready", async () => {
  if (game.system.id !== "shadowrun6-eden" || !game.users.activeGM?.isSelf) return;
  const updates = game.actors
    .filter((a) => a.getFlag("shadowrun-edge", "chargen"))
    .map((a) => ({ _id: a.id, ...repairUpdate(a._source.system) }))
    .filter((u) => Object.keys(u).length > 1);
  if (!updates.length) return;
  await Actor.updateDocuments(updates);
  ui.notifications.info(game.i18n.format("SRE.Chargen.Repaired", { count: updates.length }));
});
