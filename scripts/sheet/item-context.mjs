/**
 * Data for the Edge item sheet, from a shadowrun6-eden item. Pure (no Foundry globals) for tools/test_sheet.mjs.
 * Editable fields always show the item's source values; prepared values are shown read-only.
 */

const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== "" && v !== null ? Number(v) : d);
const RANGED = new Set(["WEAPON_FIREARMS", "WEAPON_RANGED", "WEAPON_SPECIAL"]);
const AUGMENTS = new Set(["CYBERWARE", "BIOWARE", "NANOWARE", "GENETICS"]);
const DEVICES = new Set(["COMMLINK", "CYBERDECK", "RIGGER_CONSOLE", "CYBERJACK"]);
export const AR_RANGES = ["close", "near", "medium", "far", "extreme"];

/** Options for a select from a { value: i18nKey } map. */
export function options(map, selected, L, { blank } = {}) {
  const list = Object.entries(map ?? {}).map(([value, key]) => ({ value, label: L(typeof key === "object" ? key.label ?? value : key), selected: String(value) === String(selected ?? "") }));
  if (blank !== undefined) list.unshift({ value: "", label: blank, selected: !selected });
  return list;
}

/** Which stat panel the item gets. */
export function itemKind(item) {
  const t = item.type;
  if (t !== "gear") return t;
  const type = item.system?.type;
  if (type === "WEAPON_CLOSE_COMBAT") return "melee";
  if (RANGED.has(type)) return "ranged";
  if (type === "ARMOR" || type === "ARMOR_ADDITION") return "armor";
  if (AUGMENTS.has(type)) return "augment";
  if (DEVICES.has(item.system?.subtype)) return "device";
  return "gear";
}

/** Readable summary of an Active Effect change ("system.attributes.rea.mod" + 1 → "REA +1"). */
export function changeText(change, L) {
  const key = String(change.key ?? "");
  const m = key.match(/^system\.attributes\.(\w+)\.mod$/);
  const label = m ? L(`attrib.${m[1]}`) : key.replace(/^system\./, "").replace(/\.(mod|pool|value)$/, "");
  const v = String(change.value ?? "");
  const value = v.startsWith("@item.") ? L("SRE.ItemSheet.ByRating") : (/^-/.test(v) ? v : `+${v}`);
  return { label, value };
}

/**
 * @param {object} item   item document (prepared) with _source, effects, parent
 * @param {object} opts   { L, config: CONFIG.SR6, moduleId, grades: GRADES, gradeUpdates, baseValues, skills: ids }
 */
export function buildItemContext(item, { L = (k) => k, config = {}, moduleId = "shadowrun-edge", grades = null, gradeUpdates = null, baseValues = null, skills = [] } = {}) {
  const s = item.system ?? {};
  const src = item._source?.system ?? s;
  const kind = itemKind(item);
  const actor = item.parent ?? null;
  const gear = item.type === "gear";
  const typeLabel = gear ? L(config.GEAR_TYPES?.[s.type] ?? s.type ?? "") : L(`TYPES.Item.${item.type}`);
  const subLabel = gear && s.subtype ? L(config.GEAR_SUBTYPES?.[s.type]?.[s.subtype] ?? s.subtype) : "";

  const chips = [{ label: L("SRE.ItemSheet.Type"), value: [typeLabel, subLabel].filter(Boolean).join(" · ") }];
  if (gear && (s.needsRating || num(s.rating))) chips.push({ label: L("SRE.Sheet.Rating"), value: num(s.rating) });
  if (gear && num(s.price)) chips.push({ label: L("SRE.Sheet.Cost"), value: `${num(s.price).toLocaleString()}¥` });
  if (gear && (s.availDef || num(s.avail))) chips.push({ label: L("SRE.ItemSheet.Avail"), value: s.availDef || num(s.avail) });
  if (src.product || src.page) chips.push({ label: L("SRE.ItemSheet.Source"), value: [String(src.product ?? "").toUpperCase(), src.page ? `s. ${src.page}` : ""].filter(Boolean).join(" ") });

  const ctx = {
    id: item.id, name: item.name, img: item.img, kind, onActor: !!actor, chips,
    isGear: gear,
    gearTypes: gear ? options(config.GEAR_TYPES, src.type, L) : [],
    gearSubtypes: gear ? options(config.GEAR_SUBTYPES?.[src.type], src.subtype, L, { blank: "—" }) : [],
    src,
    description: src.description ?? "",
    effects: [...(item.effects ?? [])].map((e) => ({
      id: e.id, name: e.name, img: e.img, disabled: !!e.disabled,
      changes: (e.changes ?? []).map((c) => changeText(c, L)),
    })),
  };

  if (kind === "ranged" || kind === "melee") {
    const ar = Array.isArray(src.attackRating) ? src.attackRating : [];
    const skillIds = skills.length ? skills : Object.keys(config.skill_special ?? {});
    Object.assign(ctx, {
      ranged: kind === "ranged",
      stunOptions: options(config.WEAPON_STUN_OPTION, String(src.stun), L),
      skillOptions: skillIds.map((id) => ({ value: id, label: L(`skill.${id}`), selected: id === src.skill })),
      specOptions: options(config.skill_special?.[src.skill], src.skillSpec, L, { blank: "—" }),
      modes: ["SS", "SA", "BF", "FA"].map((m) => ({ id: m, label: L(`shadowrun6.item.mode_${m.toLowerCase()}`), on: !!src.modes?.[m] })),
      ar: AR_RANGES.slice(0, kind === "melee" ? 1 : 5).map((r, i) => ({ index: i, label: L(`SRE.ItemSheet.Range.${r}`), value: num(ar[i]) })),
      ammoTypes: options(config.AMMO_TYPES, src.ammoLoaded ?? "regular", L),
      pool: actor ? num(s.pool) + num(s.modes?.dicePoolMod) : null,
      dv: s.dmgDef || "",
    });
  }
  if (kind === "augment" && grades && gradeUpdates && baseValues) {
    const flag = item.flags?.[moduleId]?.grade;
    const current = flag?.id ?? "standard";
    const base = baseValues(src, flag);
    ctx.grades = Object.keys(grades).map((id) => {
      const u = gradeUpdates(base, id);
      return {
        id, label: L(`SRE.Grade.Name.${id}`), active: id === current,
        essence: num(u["system.essence"]).toFixed(2), price: num(u["system.price"]).toLocaleString(), avail: u["system.availDef"] ?? u["system.avail"] ?? "",
      };
    });
  }
  // Mods installed in this item on its actor, or the built-in mods it carries before it lands on one.
  if (gear || item.type === "mod") {
    const mods = actor ? [...actor.items].filter((m) => m.type === "mod" && m.system?.embeddedInUuid && m.system.embeddedInUuid === item.uuid) : [];
    ctx.mods = mods.map((m) => ({ id: m.id, name: m.name, slot: m.flags?.[moduleId]?.slot ? L(`SRE.Mount.Slot.${m.flags[moduleId].slot}`) : "" }));
    ctx.builtIn = !actor ? (item.flags?.[moduleId]?.mods ?? []).map((m) => m.name) : [];
  }
  ctx.hasMods = gear;
  ctx.modCount = (ctx.mods?.length ?? 0) + (ctx.builtIn?.length ?? 0);

  if (item.type === "spell") {
    Object.assign(ctx, {
      categoryOptions: options(config.spell_category, src.category, L),
      typeOptions: options(config.spell_type, src.type, L),
      rangeOptions: options(config.spell_range, src.range, L),
      durationOptions: options(config.spell_duration, src.duration, L),
      damageOptions: options(config.spell_damage, src.damage, L),
      castPool: actor ? num(actor.system?.skills?.sorcery?.pool) : null,
      drainPool: actor ? num(actor.system?.defensepool?.drain?.pool) : null,
    });
  }
  if (item.type === "adeptpower") ctx.activationOptions = options(config.adeptpower_activation, src.activation, L, { blank: "—" });
  if (item.type === "quality") ctx.categoryOptions = options(config.QUALITY_CATEGORIES, src.category, L);
  if (item.type === "lifestyle") ctx.lifestyleOptions = options(config.LIFESTYLE_TYPE, src.type, L);
  if (item.type === "sin") ctx.sinOptions = options(config.SIN_QUALITY, src.quality, L);
  if (item.type === "complexform") ctx.durationOptions = options(config.spell_duration, src.duration, L);
  if (item.type === "skill") ctx.native = num(src.points) >= 4;
  ctx.known = ["ranged", "melee", "armor", "augment", "device", "gear", "spell", "adeptpower", "quality", "focus", "ritual",
    "complexform", "contact", "lifestyle", "sin", "skill", "mod", "metamagic", "echo"].includes(kind);
  return ctx;
}
