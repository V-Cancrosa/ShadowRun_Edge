import { SRE } from "../config.mjs";

const { HTMLField, NumberField, SchemaField, StringField } = foundry.data.fields;

function integer(initial, label) {
  return new NumberField({ required: true, nullable: false, integer: true, min: 0, initial, label });
}

/** A condition monitor: `value` is boxes of damage taken, `max` is derived. */
function monitor(label) {
  return new SchemaField({
    value: integer(0, "SRE.Monitor.damage"),
    max: integer(0, "SRE.Monitor.max")
  }, { label });
}

export class CharacterData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const attributes = {};
    for (const [key, label] of Object.entries(SRE.attributes)) {
      const initial = (key === "magic" || key === "resonance") ? 0 : 1;
      attributes[key] = integer(initial, label);
    }
    return {
      attributes: new SchemaField(attributes),
      essence: new NumberField({ required: true, nullable: false, min: 0, initial: 6, label: "SRE.Essence" }),
      edge: new SchemaField({
        value: integer(1, "SRE.EdgePoints"),
        max: integer(1, "SRE.Monitor.max")
      }),
      monitors: new SchemaField({
        physical: monitor("SRE.Monitor.physical"),
        stun: monitor("SRE.Monitor.stun")
      }),
      metatype: new StringField({ required: true, blank: true, initial: "", label: "SRE.Metatype" }),
      nuyen: integer(0, "SRE.Nuyen"),
      karma: integer(0, "SRE.Karma"),
      biography: new HTMLField({ required: true, blank: true, label: "SRE.Biography" })
    };
  }

  prepareDerivedData() {
    const a = this.attributes;
    const { physical, stun } = this.monitors;
    physical.max = 8 + Math.ceil(a.body / 2);
    stun.max = 8 + Math.ceil(a.willpower / 2);
    this.edge.max = a.edge;

    // -1 dice for every full 3 boxes of damage on each monitor.
    this.woundModifier = -(Math.floor(physical.value / 3) + Math.floor(stun.value / 3));
    this.initiative = { base: a.reaction + a.intuition, dice: 1 };
  }
}

export class NpcData extends CharacterData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      professionalRating: integer(0, "SRE.ProfessionalRating")
    };
  }
}
