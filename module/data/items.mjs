import { SRE } from "../config.mjs";

const { HTMLField, NumberField, StringField } = foundry.data.fields;

function integer(initial, label) {
  return new NumberField({ required: true, nullable: false, integer: true, min: 0, initial, label });
}

function description() {
  return new HTMLField({ required: true, blank: true, label: "SRE.Description" });
}

export class SkillData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      rating: integer(0, "SRE.Rating"),
      attribute: new StringField({ required: true, choices: SRE.attributes, initial: "agility", label: "SRE.LinkedAttribute" }),
      specialization: new StringField({ required: true, blank: true, initial: "", label: "SRE.Specialization" }),
      description: description()
    };
  }
}

export class WeaponData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      damage: integer(2, "SRE.DamageValue"),
      damageType: new StringField({ required: true, choices: SRE.damageTypes, initial: "P", label: "SRE.DamageTypeLabel" }),
      attackRating: new StringField({ required: true, blank: true, initial: "", label: "SRE.AttackRating" }),
      skill: new StringField({ required: true, blank: true, initial: "", label: "SRE.SkillName" }),
      attribute: new StringField({ required: true, choices: SRE.attributes, initial: "agility", label: "SRE.LinkedAttribute" }),
      description: description()
    };
  }
}

export class GearData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      quantity: integer(1, "SRE.Quantity"),
      cost: integer(0, "SRE.Cost"),
      description: description()
    };
  }
}
