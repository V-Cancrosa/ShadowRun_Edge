/**
 * Wizard categories follow the gear tables of the SR6 core rulebook.
 * `columns` lists the numeric table columns in rulebook order; the parser fills them from the right.
 * `fields` decides which inputs the wizard shows for the category.
 */
export const CATEGORIES = {
  firearm: {
    label: "SRE.Wizard.Category.firearm",
    types: ["WEAPON_FIREARMS"],
    weapon: true,
    fields: ["dv", "modes", "ar", "ammo"],
    columns: ["avail", "price"],
    example: "Pistolet 3P SA/BF 10/10/8/—/— 15(c) 2(L) 750¥",
  },
  melee: {
    label: "SRE.Wizard.Category.melee",
    types: ["WEAPON_CLOSE_COMBAT"],
    weapon: true,
    fields: ["dv", "ar", "strWeapon"],
    columns: ["ar0", "avail", "price"],
    example: "Miecz 4P 9 3(L) 300¥",
  },
  projectile: {
    label: "SRE.Wizard.Category.projectile",
    types: ["WEAPON_RANGED"],
    weapon: true,
    fields: ["dv", "ar", "ammo"],
    columns: ["avail", "price"],
    example: "Łuk 2P 4/8/6/—/— 1(c) 2 R*100¥",
  },
  special: {
    label: "SRE.Wizard.Category.special",
    types: ["WEAPON_SPECIAL"],
    weapon: true,
    fields: ["dv", "modes", "ar", "ammo"],
    columns: ["avail", "price"],
    example: "Granatnik 4P SS 4/10/6/2/— 6(c) 4(I) 2000¥",
  },
  armor: {
    label: "SRE.Wizard.Category.armor",
    types: ["ARMOR"],
    fields: ["defense"],
    columns: ["defense", "capacity", "avail", "price"],
    example: "Kurtka 3 6 2 800¥",
  },
  cyberware: {
    label: "SRE.Wizard.Category.cyberware",
    actorEffects: true,
    types: ["CYBERWARE"],
    rating: true,
    fields: ["essence", "capacity"],
    columns: ["essence", "capacity", "avail", "price"],
    example: "Wszczep 0.1 — 2 1000¥",
  },
  bioware: {
    label: "SRE.Wizard.Category.bioware",
    actorEffects: true,
    types: ["BIOWARE", "GENETICS", "NANOWARE"],
    rating: true,
    fields: ["essence"],
    columns: ["essence", "avail", "price"],
    example: "Wzmocnione mięśnie R*0.2 R+2(L) R*7000¥",
  },
  electronics: {
    label: "SRE.Wizard.Category.electronics",
    types: ["ELECTRONICS"],
    rating: true,
    fields: ["matrix"],
    columns: ["rating", "progSlots", "avail", "price"],
    example: "Komlink 2 1/1 2 2 500¥",
  },
  software: {
    label: "SRE.Wizard.Category.software",
    types: ["SOFTWARE", "CODEMODS"],
    rating: true,
    fields: [],
    columns: ["rating", "avail", "price"],
    example: "Autosoft R R*2(L) R*500¥",
  },
  ammo: {
    label: "SRE.Wizard.Category.ammo",
    types: ["AMMUNITION"],
    countable: true,
    fields: ["count"],
    columns: ["avail", "price"],
    example: "Amunicja 3(L) 100¥",
  },
  mod: {
    label: "SRE.Wizard.Category.mod",
    itemType: "mod",
    types: ["accessory_weapon", "weapon_mod", "armor_mod", "accessory_electronics", "visual_enhancement", "audio_enhancement"],
    rating: true,
    fields: ["effects"],
    columns: ["rating", "avail", "price"],
    example: "Celownik 2 300¥",
  },
  gear: {
    label: "SRE.Wizard.Category.gear",
    types: ["CHEMICALS", "BIOLOGY", "SURVIVAL", "TOOLS", "MAGICAL", "ACCESSORY", "ARMOR_ADDITION"],
    rating: true,
    countable: true,
    fields: ["count"],
    columns: ["rating", "avail", "price"],
    example: "Medkit R R(L) R*250¥",
  },
};

/** Weapon skill and specialization implied by the subtype (SR6 core, Firearms/Close Combat/Athletics/Engineering). */
export const WEAPON_SKILLS = {
  TASERS: ["firearms", "tasers"],
  HOLDOUTS: ["firearms", "holdouts"],
  PISTOLS_LIGHT: ["firearms", "pistols_light"],
  MACHINE_PISTOLS: ["firearms", "machine_pistols"],
  PISTOLS_HEAVY: ["firearms", "pistols_heavy"],
  SUBMACHINE_GUNS: ["firearms", "submachine_guns"],
  SHOTGUNS: ["firearms", "shotguns"],
  RIFLE_ASSAULT: ["firearms", "rifles"],
  RIFLE_HUNTING: ["firearms", "rifles"],
  RIFLE_SNIPER: ["firearms", "rifles"],
  LMG: ["firearms", "machine_guns"],
  MMG: ["firearms", "machine_guns"],
  HMG: ["firearms", "machine_guns"],
  ASSAULT_CANNON: ["firearms", "assault_cannons"],
  BLADES: ["close_combat", "blades"],
  CLUBS: ["close_combat", "clubs"],
  UNARMED: ["close_combat", "unarmed"],
  WHIPS: ["exotic_weapons", "whips"],
  OTHER_CLOSE: ["close_combat", ""],
  BOWS: ["athletics", "archery"],
  CROSSBOWS: ["athletics", "archery"],
  THROWING: ["athletics", "throwing"],
  // SR6 core p. 258: launchers use Exotic Weapons.
  LAUNCHERS: ["exotic_weapons", "launchers"],
  THROWERS: ["exotic_weapons", "spray"],
  DMSO: ["exotic_weapons", ""],
  DART: ["exotic_weapons", ""],
  OTHER_SPECIAL: ["exotic_weapons", ""],
};

/** Empty wizard state for a category; every value is a string so rating formulas can be typed in. */
/** Item fields a mod effect can change on the item it is installed in (Active Effect keys, mode ADD). */
export const EFFECT_TARGETS = {
  ar: ["system.attackRating.0", "system.attackRating.1", "system.attackRating.2", "system.attackRating.3", "system.attackRating.4"],
  ar0: ["system.attackRating.0"],
  ar1: ["system.attackRating.1"],
  ar2: ["system.attackRating.2"],
  ar3: ["system.attackRating.3"],
  ar4: ["system.attackRating.4"],
  dmg: ["system.dmg"],
  defense: ["system.defense"],
  social: ["system.social"],
  ammocap: ["system.ammocap"],
};

/**
 * Character stats an augmentation changes while it is in the character's inventory (Active Effects with
 * transfer, mode ADD). Paths are the ones the system's own effect editor offers (CONFIG.SR6.ACTIVE_EFFECT_OPTIONS);
 * the system caps attribute bonuses at +4.
 */
export const ACTOR_EFFECT_TARGETS = {
  bod: ["system.attributes.bod.mod"],
  agi: ["system.attributes.agi.mod"],
  rea: ["system.attributes.rea.mod"],
  str: ["system.attributes.str.mod"],
  wil: ["system.attributes.wil.mod"],
  log: ["system.attributes.log.mod"],
  int: ["system.attributes.int.mod"],
  cha: ["system.attributes.cha.mod"],
  iniDice: ["system.initiative.physical.diceMod"],
  matrixIni: ["system.initiative.matrix.mod"],
  defenseRating: ["system.defenserating.physical.mod"],
  damageResist: ["system.defensepool.damage_physical.mod"],
  toxinResist: ["system.defensepool.toxin.mod"],
  athletics: ["system.skills.athletics.modifier"],
};

/** Label key of an item type shown in the wizard. */
export function typeLabel(category, type) {
  return category.itemType === "mod" ? `SR6.Item.mod.TYPES.${type}` : `shadowrun6.itemtype.${type}`;
}

export function emptyState(categoryId = "firearm") {
  const category = CATEGORIES[categoryId];
  return {
    category: categoryId,
    type: category.types[0],
    subtype: "",
    name: "",
    rating: "",
    avail: "",
    legality: "",
    price: "",
    dv: "",
    stun: false,
    modes: { SS: false, SA: false, BF: false, FA: false },
    ar: ["", "", "", "", ""],
    ammo: "",
    strWeapon: false,
    defense: "",
    capacity: "",
    social: "",
    essence: "",
    a: "",
    s: "",
    d: "",
    f: "",
    progSlots: "",
    count: "1",
    description: "",
    statLine: "",
    // Mods installed automatically when the item lands on an actor: [{ uuid, name }]
    mods: [],
    // Effects of a mod: [{ label, target, value, toggle }]
    effects: [],
  };
}
