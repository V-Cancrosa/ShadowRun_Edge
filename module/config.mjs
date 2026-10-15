/** Static configuration for the Shadowrun Edge system, exposed as CONFIG.SRE. */
export const SRE = {
  /** Attributes that can be rolled and linked to skills, mapped to their localization keys. */
  attributes: {
    body: "SRE.Attribute.body",
    agility: "SRE.Attribute.agility",
    reaction: "SRE.Attribute.reaction",
    strength: "SRE.Attribute.strength",
    willpower: "SRE.Attribute.willpower",
    logic: "SRE.Attribute.logic",
    intuition: "SRE.Attribute.intuition",
    charisma: "SRE.Attribute.charisma",
    edge: "SRE.Attribute.edge",
    magic: "SRE.Attribute.magic",
    resonance: "SRE.Attribute.resonance"
  },

  damageTypes: {
    P: "SRE.DamageType.P",
    S: "SRE.DamageType.S"
  },

  /** A die showing this value or higher counts as a hit. */
  hitThreshold: 5
};
