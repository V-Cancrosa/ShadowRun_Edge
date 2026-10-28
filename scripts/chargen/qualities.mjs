/**
 * Qualities of the SR6 core rulebook (pp. 70–79): name, Karma cost (positive) or bonus (negative), levels, page.
 * Names only, no rulebook text; `effects` are the bonuses the system has fields for.
 *   levels: [min, max]      quality with levels, Karma per level
 *   detail: "attribute" | "skill" | "text"   the player picks what the quality applies to
 *   variable: true          the bonus is chosen within [min, max] (Allergy)
 */
const positive = (id, name, karma, page, extra = {}) => ({ id, name, karma, page, positive: true, ...extra });
const negative = (id, name, karma, page, extra = {}) => ({ id, name, karma, page, positive: false, ...extra });

const LIST = [
  positive("ambidextrous", "Ambidextrous", 4, 70),
  positive("analytical_mind", "Analytical Mind", 3, 70),
  positive("aptitude", "Aptitude", 12, 70, { detail: "skill" }),
  positive("astral_chameleon", "Astral Chameleon", 9, 70),
  positive("blandness", "Blandness", 8, 70),
  positive("built_tough", "Built Tough", 4, 70, { levels: [1, 4], effects: [{ target: "physical", perLevel: 1 }] }),
  positive("catlike", "Catlike", 12, 71),
  positive("dermal_deposits", "Dermal Deposits", 7, 71, { effects: [{ target: "defenseRating", value: 1 }] }),
  positive("double_jointed", "Double-Jointed", 12, 71),
  positive("elemental_resistance", "(Elemental) Resistance", 12, 71, { detail: "text" }),
  positive("exceptional", "Exceptional", 12, 71, { detail: "attribute" }),
  positive("first_impression", "First Impression", 12, 71),
  positive("focused_concentration", "Focused Concentration", 12, 71, { levels: [1, 3] }),
  positive("gearhead", "Gearhead", 10, 71),
  positive("guts", "Guts", 12, 71),
  positive("hardening", "Hardening", 10, 72),
  positive("high_pain_tolerance", "High Pain Tolerance", 7, 72),
  positive("home_ground", "Home Ground", 10, 72, { detail: "text" }),
  positive("human_looking", "Human-Looking", 8, 72),
  positive("indomitable", "Indomitable", 12, 72),
  positive("juryrigger", "Juryrigger", 12, 72),
  positive("long_reach", "Long Reach", 12, 72),
  positive("low_light_vision", "Low-Light Vision", 6, 72),
  positive("magic_resistance", "Magic Resistance", 8, 72),
  positive("mentor_spirit", "Mentor Spirit", 10, 73, { detail: "text" }),
  positive("photographic_memory", "Photographic Memory", 12, 73),
  positive("quick_healer", "Quick Healer", 8, 73),
  positive("resistance_to_pathogens", "Resistance to Pathogens", 12, 73),
  positive("spirit_affinity", "Spirit/Sprite Affinity", 14, 73, { detail: "text" }),
  positive("thermographic_vision", "Thermographic Vision", 8, 73),
  positive("toughness", "Toughness", 12, 73),
  positive("toxin_resistance", "Toxin Resistance", 12, 73),
  positive("will_to_live", "Will to Live", 8, 74, { levels: [1, 3], effects: [{ target: "overflow", perLevel: 2 }] }),

  negative("addiction", "Addiction", 2, 74, { levels: [1, 6], detail: "text" }),
  negative("allergy", "Allergy", 20, 74, { variable: true, min: 2, max: 20, detail: "text" }),
  negative("ar_vertigo", "AR Vertigo", 10, 75),
  negative("astral_beacon", "Astral Beacon", 10, 75),
  negative("bad_luck", "Bad Luck", 10, 75),
  negative("bad_rep", "Bad Rep", 8, 75),
  negative("combat_paralysis", "Combat Paralysis", 8, 75),
  negative("dependents", "Dependents", 4, 75, { levels: [1, 3] }),
  negative("distinctive_style", "Distinctive Style", 6, 76),
  negative("elf_poser", "Elf Poser", 6, 76),
  negative("glass_jaw", "Glass Jaw", 4, 76, { levels: [1, 4], effects: [{ target: "stun", perLevel: -1 }] }),
  negative("gremlins", "Gremlins", 6, 76),
  negative("honorbound", "Honorbound", 10, 76, { detail: "text" }),
  negative("impaired", "Impaired", 8, 76, { levels: [1, 4], detail: "attribute" }),
  negative("incompetent", "Incompetent", 10, 76, { detail: "skill" }),
  negative("in_debt", "In Debt", 0, 77),
  negative("insomnia", "Insomnia", 4, 77),
  negative("loss_of_confidence", "Loss of Confidence", 6, 78),
  negative("low_pain_tolerance", "Low Pain Tolerance", 10, 78),
  negative("ork_poser", "Ork Poser", 6, 78),
  negative("prejudiced", "Prejudiced", 8, 78, { detail: "text" }),
  negative("scorched", "Scorched", 6, 78),
  negative("sensitive_system", "Sensitive System", 8, 78),
  negative("simsense_vertigo", "Simsense Vertigo", 6, 78),
  negative("sinner", "SINner", 8, 78),
  negative("social_stress", "Social Stress", 8, 79, { detail: "text" }),
  negative("spirit_bane", "Spirit/Sprite Bane", 12, 79, { detail: "text" }),
  negative("uncouth", "Uncouth", 6, 79),
  negative("uneducated", "Uneducated", 6, 79),
  negative("unsteady_hands", "Unsteady Hands", 4, 79),
  negative("weak_immune_system", "Weak Immune System", 8, 79),
];

export const QUALITIES = Object.fromEntries(LIST.map((q) => [q.id, q]));
