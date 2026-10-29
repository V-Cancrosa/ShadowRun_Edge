/**
 * Builds the "Katalog Shadowrun Edge" compendium from catalog/core.mjs.
 *
 *   node tools/build_catalog.mjs            writes JSON sources to packs/_source/katalog
 *   node tools/build_catalog.mjs --pack     also compiles them into the LevelDB pack packs/katalog
 *
 * Every table row goes through the item wizard's parser and item builder, so the catalog and the wizard
 * create identical items. The build fails when a row is not fully recognized.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODULE_ID = "shadowrun-edge";
const SOURCE_DIR = join(ROOT, "packs/_source/katalog");
const PACK_DIR = join(ROOT, "packs/katalog");

// ── Minimal Foundry globals the wizard code needs outside Foundry ──
function flatten(obj, prefix = "", out = {}) {
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === "object") flatten(value, `${prefix}${key}.`, out);
    else out[`${prefix}${key}`] = value;
  }
  return out;
}
const strings = {
  ...flatten(JSON.parse(readFileSync(join(ROOT, "lang/pl/shadowrun6-eden.json"), "utf8"))),
  ...flatten(JSON.parse(readFileSync(join(ROOT, "lang/pl/shadowrun-edge.json"), "utf8"))),
};
function setProperty(obj, path, value) {
  const keys = path.split(".");
  let target = obj;
  for (const key of keys.slice(0, -1)) target = target[key] ??= {};
  target[keys.at(-1)] = value;
}
globalThis.foundry = {
  applications: { api: { ApplicationV2: class {}, HandlebarsApplicationMixin: (c) => c } },
  utils: { deepClone: (x) => structuredClone(x), setProperty },
};
globalThis.game = {
  i18n: {
    localize: (key) => strings[key] ?? key,
    format: (key, data) => (strings[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => data[k] ?? ""),
  },
};
globalThis.Hooks = { on() {}, once() {} };
const escapeHTML = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
globalThis.Handlebars = { escapeExpression: escapeHTML };

const { CATEGORIES, emptyState, typeLabel } = await import("../scripts/wizard/categories.mjs");
const { parseStatLine, evaluate } = await import("../scripts/wizard/parser.mjs");
const { collectFormulas } = await import("../scripts/wizard/formulas.mjs");
const { buildItemData } = await import("../scripts/wizard/item-wizard.mjs");
const { SECTIONS, AUGMENT_EFFECTS, TRAITS } = await import("../catalog/core.mjs");

const L = (key) => game.i18n.localize(key);

/** Stable 16-character Foundry ID derived from a key, so rebuilds keep document IDs. */
function stableId(key) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = createHash("sha256").update(key).digest();
  return Array.from(bytes.subarray(0, 16), (b) => alphabet[b % alphabet.length]).join("");
}

// ── Icons from the shadowrun6-eden system ──
const ICON_ROOT = "systems/shadowrun6-eden/icons/compendium";
const ICONS = {
  TASERS: "weapons/stun_gun.svg", HOLDOUTS: "weapons/air_pistol.svg", PISTOLS_LIGHT: "weapons/mediumPistol.svg",
  MACHINE_PISTOLS: "weapons/heavySMG.svg", PISTOLS_HEAVY: "weapons/heavyPistol.svg", SUBMACHINE_GUNS: "weapons/SMG.svg",
  SHOTGUNS: "weapons/Shotgun.svg", RIFLE_ASSAULT: "weapons/AssaultRifle.svg", RIFLE_HUNTING: "weapons/SniperRifle.svg",
  RIFLE_SNIPER: "weapons/SniperRifle.svg", LMG: "weapons/AssaultRifle_excellent.svg", MMG: "weapons/AssaultRifle_excellent.svg",
  HMG: "weapons/AssaultRifle_excellent.svg", ASSAULT_CANNON: "weapons/RocketLauncher.svg",
  BLADES: "weapons/Sword.svg", CLUBS: "weapons/BaseballBat.svg", UNARMED: "weapons/unarmed.svg", WHIPS: "weapons/martial_arts.svg",
  BOWS: "weapons/Bow.svg", CROSSBOWS: "weapons/Crossbow.svg", THROWING: "weapons/thrown_weapon.svg",
  LAUNCHERS: "weapons/GrenadeLauncher.svg", DMSO: "weapons/dartgun.svg", DART: "weapons/dartgun.svg",
  AMMUNITION: "ammo/pistolheavy_basic.png", GRENADES: "ammo/grenade_flashbang.png", ROCKETS: "weapons/RocketLauncher.svg",
  MISSILES: "weapons/RocketLauncher.svg", EXPLOSIVES: "default/Default_Ammo.svg",
  ARMOR: "armor/kevlar_body.svg", ARMOR_HELMET: "armor/kevlar_head.svg", ARMOR_SHIELD: "armor/bullet_proof_shield.svg",
  ARMOR_CLOTHES: "clothing/generic_jacket.svg", ARMOR_SOCIAL: "clothing/generic_top.svg",
  COMMLINK: "gear/disposable_cellphone.svg", CYBERDECK: "gear/cyberdeck_excellent.svg", ELECTRONICS: "gear/tech_scanner.svg",
  RFID: "gear/tracer_button.svg", FILE_STORAGE: "gear/memory_chip.svg", OPTICAL: "gear/binoculars.svg",
  AUDIO: "gear/audio_recorder.svg", BREAKING: "gear/lock_picking_set.svg", SECURITY: "gear/handcuffs.svg",
  COMMUNICATION: "gear/radio_communicator.svg", ID_CREDIT: "gear/memory_chip.svg", SENSOR_HOUSING: "gear/radar_detector.svg",
  CYBERJACK: "cyberware/neural_link.svg", CYBER_HEADWARE: "cyberware/neural_link.svg", CYBER_EYEWARE: "cyberware/cybereye.svg",
  CYBER_EARWARE: "cyberware/cyberaudio_suite.svg", CYBER_BODYWARE: "cyberware/grafted_muscle_and_bone_lace.svg",
  CYBER_LIMBS: "cyberware/cyberarm.svg", CYBER_IMPLANT_WEAPON: "cyberware/popup_ranged_weapon.svg",
  BIOWARE: "cyberware/enhanced_antibodies.svg", TOOLS: "gear/tech_tool.svg", CHEMICALS: "gear/chemical_analizer.svg",
  SURVIVAL: "gear/tent_and_camping_equipment.svg", GRAPPLE_GUN: "gear/grapple_gun.svg", BIOTECH: "gear/medtech_bag.svg",
  SLAP_PATCHES: "drugs/stim.svg", MAGICAL: "default/book.svg", ACCESSORY: "upgrades/vehicle_heavy_weapon_mount.svg",
  VEHICLES: "default/Default_Vehicle.svg", BIKES: "vehicles/motorbike.svg", CARS: "vehicles/super_car.svg",
  BOATS: "vehicles/speed_boat.svg", SUBMARINES: "vehicles/ship.svg", FIXED_WING: "vehicles/airplane.svg",
  ROTORCRAFT: "vehicles/helicopter.svg", VTOL: "vehicles/airplane.svg", DRONE: "all-about-drones/the-observer.svg",
  accessory_weapon: "upgrades/smartgun_link.svg", armor_mod: "upgrades/armored_chassis.svg",
  visual_enhancement: "upgrades/infrared_nightvision_scope.svg", audio_enhancement: "cyberware/amplified_hearing.svg",
  software: "default/Default_Program.svg", focus: "clothing/generic_jewelry.svg", SOFTWARE: "default/Default_Program.svg",
};
function iconFor(type, subtype, extra) {
  const key = [extra, subtype, type, type?.startsWith("DRONE") ? "DRONE" : null].find((k) => k && ICONS[k]);
  return `${ICON_ROOT}/${ICONS[key] ?? "gear/tech_bag.svg"}`;
}

// ── Rows to items ──
function normalizeRow(row) {
  return typeof row === "string" ? { line: row, opts: {} } : { line: row[0], opts: row[1] ?? {} };
}

function sectionFolder(section, category) {
  if (section.itemType === "software") return [L("TYPES.Item.software"), L(`shadowrun6.gear.subtype.${section.softwareType}`)];
  if (section.itemType === "focus") return [L("shadowrun6.itemtype.MAGICAL"), L("TYPES.Item.focus")];
  const subtypeLabel = section.subtype ? L(`shadowrun6.gear.subtype.${section.subtype}`) : null;
  if (section.vehicle) return [...section.folder, L(`shadowrun6.itemtype.${section.type}`), subtypeLabel];
  if (section.folder) return section.folder;
  const path = [L(category.label)];
  const type = section.type ?? category.types[0];
  if (category.types.length > 1) path.push(L(typeLabel(category, type)));
  if (subtypeLabel) path.push(subtypeLabel);
  return path;
}

/** Wizard state for a row, with every table cell recognized or the build stops. */
function rowState(section, category, { line, opts }) {
  const parseCategory = section.columns ? { ...category, columns: section.columns } : category;
  const { name, fields, unparsed } = parseStatLine(line, parseCategory, section.subtype ?? "");
  if (unparsed.length) throw new Error(`Unrecognized "${unparsed.join(" ")}" in row: ${line}`);
  const state = Object.assign(emptyState(section.categoryKey), {
    type: section.type ?? category.types[0],
    subtype: section.subtype ?? "",
    page: String(section.page ?? ""),
  }, fields, opts.fields ?? {});
  state.name = opts.name ?? name;
  if (!state.name) throw new Error(`No name in row: ${line}`);
  if (opts.rating) state.rating = String(opts.start ?? opts.rating[0]);
  const notes = [];
  if (opts.rating) notes.push(`Stopień ${opts.rating[0]}–${opts.rating[1]}.`);
  if (opts.notes) notes.push(opts.notes);
  state.notes = notes.join(" ");
  state.effects = [...(opts.effects ?? []), ...(AUGMENT_EFFECTS[state.name] ?? [])];
  return state;
}

/** Item data for system item types the wizard does not create (software, focus). */
function simpleItemData(itemType, state, extraSystem) {
  const rating = Math.trunc(evaluate(state.rating));
  const avail = Math.trunc(evaluate(state.avail, rating));
  const notes = state.notes ? `<p><em>${escapeHTML(state.notes)}</em></p>` : "";
  const data = {
    name: state.name,
    type: itemType,
    system: {
      ...extraSystem,
      rating,
      availDef: state.avail ? `${avail}${state.legality ? `(${state.legality})` : ""}` : "",
      price: evaluate(state.price, rating),
      description: notes,
      product: "core",
      page: Number(state.page),
    },
  };
  const formulas = collectFormulas(state);
  if (formulas) data.flags = { [MODULE_ID]: { formulas } };
  return data;
}

const folders = new Map();
function folderId(path) {
  let parent = null;
  for (let i = 0; i < path.length; i++) {
    const key = path.slice(0, i + 1).join(" / ");
    if (!folders.has(key)) {
      const _id = stableId(`folder:${key}`);
      folders.set(key, { _id, name: path[i], type: "Item", folder: parent, sorting: "a", sort: folders.size * 10, color: null, flags: {}, _key: `!folders!${_id}` });
    }
    parent = folders.get(key)._id;
  }
  return parent;
}

const items = [];
const modsByName = new Map();
const pendingMods = [];

for (const section of SECTIONS) {
  const categoryKey = section.itemType ? "software" : section.category;
  const category = CATEGORIES[categoryKey];
  const sectionWithKey = { ...section, categoryKey, columns: section.columns ?? (section.itemType ? ["rating", "avail", "price"] : undefined) };
  const path = sectionFolder(section, category).filter(Boolean);
  const folder = folderId(path);

  for (const row of section.rows) {
    const { line, opts } = normalizeRow(row);
    const state = rowState(sectionWithKey, category, { line, opts });
    let data;
    if (section.itemType === "software") data = simpleItemData("software", state, { type: section.softwareType });
    else if (section.itemType === "focus") data = simpleItemData("focus", state, {});
    else {
      data = buildItemData(state);
      if (data.type === "gear" && opts.set) Object.assign(data.system, opts.set);
    }

    const _id = stableId(`item:${path.join("/")}:${state.name}`);
    if (items.some((i) => i._id === _id)) throw new Error(`Duplicate item in catalog: ${path.join(" / ")} / ${state.name}`);
    data.img = iconFor(data.system.type, data.system.subtype, section.itemType ?? (data.type === "mod" ? data.system.type : null));
    data.effects = (data.effects ?? []).map((effect, index) => {
      const effectId = stableId(`effect:${_id}:${index}`);
      return { ...effect, _id: effectId, origin: null, _key: `!items.effects!${_id}.${effectId}` };
    });
    const doc = { ...data, _id, folder, sort: items.length * 10, flags: data.flags ?? {}, _key: `!items!${_id}` };
    items.push(doc);
    if (doc.type === "mod") modsByName.set(doc.name, doc);
    if (opts.mods?.length) pendingMods.push([doc, opts.mods]);
    if (opts.mounts) (doc.flags[MODULE_ID] ??= {}).mounts = opts.mounts;
  }
}

// Qualities and adept powers the system lacks (scripts/traits.mjs applies their effects).
for (const trait of TRAITS) {
  const path = [L("SRE.Traits.Folder"), L(`TYPES.Item.${trait.type}`)];
  const folder = folderId(path);
  const _id = stableId(`item:${path.join("/")}:${trait.name}`);
  const img = trait.type === "adeptpower"
    ? `${ICON_ROOT}/default/mage-shield.svg`
    : `${ICON_ROOT}/default/Default_Skill.svg`;
  items.push({
    _id, folder, sort: items.length * 10, _key: `!items!${_id}`, name: trait.name, type: trait.type, img,
    system: { ...trait.system, description: `<p><em>${escapeHTML(trait.notes)}</em></p>`, product: "core", page: trait.page },
    effects: trait.effects.map((e, index) => {
      const effectId = stableId(`effect:${_id}:${index}`);
      return {
        _id: effectId, _key: `!items.effects!${_id}.${effectId}`, name: e.name, img: "icons/svg/aura.svg", type: "base",
        disabled: false, transfer: true, origin: null, system: { level: 1, advanced: false },
        changes: [{ key: e.key, mode: 2, value: e.value, priority: null }],
      };
    }),
    flags: { [MODULE_ID]: { trait: true } },
  });
}

// Every augmentation effect must match a catalog item, so a renamed row cannot silently lose its effects.
for (const name of Object.keys(AUGMENT_EFFECTS)) {
  if (!items.some((i) => i.name === name)) throw new Error(`AUGMENT_EFFECTS: no catalog item named "${name}"`);
}

// Built-in accessories: stored on the item, installed by the module when the item lands on an actor.
for (const [doc, names] of pendingMods) {
  doc.flags[MODULE_ID] ??= {};
  doc.flags[MODULE_ID].mods = names.map((name) => {
    const mod = modsByName.get(name);
    if (!mod) throw new Error(`Unknown built-in mod "${name}" on ${doc.name}`);
    const copy = structuredClone(mod);
    for (const key of ["_id", "_key", "folder", "sort"]) delete copy[key];
    copy.effects = copy.effects.map(({ _id, _key, ...effect }) => effect);
    // Part of the weapon: no separate cost or availability.
    Object.assign(copy.system, { price: 0, availDef: "", embeddedInUuid: null });
    return copy;
  });
}

rmSync(SOURCE_DIR, { recursive: true, force: true });
mkdirSync(SOURCE_DIR, { recursive: true });
const fileName = (doc) => `${doc.name.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_|_$/g, "")}_${doc._id}.json`;
for (const doc of folders.values()) writeFileSync(join(SOURCE_DIR, `folder_${fileName(doc)}`), JSON.stringify(doc, null, 2));
for (const doc of items) writeFileSync(join(SOURCE_DIR, fileName(doc)), JSON.stringify(doc, null, 2));
console.log(`catalog: ${items.length} items in ${folders.size} folders -> ${SOURCE_DIR}`);

if (process.argv.includes("--pack")) {
  const { compilePack } = await import("@foundryvtt/foundryvtt-cli");
  rmSync(PACK_DIR, { recursive: true, force: true });
  await compilePack(SOURCE_DIR, PACK_DIR, { log: false });
  console.log(`catalog: compiled -> ${PACK_DIR}`);
}
