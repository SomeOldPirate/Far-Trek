/**
 * Item data models for every Far Trek RPG item subtype.
 * @module ftrpg/data/items
 */

import FTRPG from "../config.mjs";
import { FTRPGTypeDataModel, fields, int, str, choice, html } from "./base.mjs";

/**
 * The generic catch-all item type.
 * @extends {FTRPGTypeDataModel}
 */
export class ItemData extends FTRPGTypeDataModel {
  static defineSchema() {
    return { notes: html("") };
  }
}

/**
 * A trained skill, rolled against one of the four attributes.
 * @extends {FTRPGTypeDataModel}
 */
export class SkillData extends FTRPGTypeDataModel {
  static defineSchema() {
    return {
      rank: int({ initial: 0 }),
      attribute: choice(FTRPG.attributes, "iq"),
      notes: html("")
    };
  }
}

/**
 * A weapon, with its Target Number and (for phasers) a stun/heavy/kill setting.
 * @extends {FTRPGTypeDataModel}
 */
export class WeaponData extends FTRPGTypeDataModel {
  static defineSchema() {
    return {
      weaponTN: int({ initial: 5 }),
      attackAttribute: choice(FTRPG.attributes, "dx"),
      attackSkillName: str("Marksmanship"),
      hasStun: new fields.BooleanField({ initial: false }),
      range: str("Close"),
      /** Displayed on the NPC statblock. Free text (e.g. "1d6"). */
      damage: str(),
      notes: html("")
    };
  }
}

/**
 * A talent: optionally an automated bonus to a skill, attack, initiative or attribute.
 * @extends {FTRPGTypeDataModel}
 */
export class TalentData extends FTRPGTypeDataModel {
  static defineSchema() {
    return {
      modType: choice(FTRPG.modTypes, "none"),
      /** A skill name, "melee"/"ranged" for attacks, an attribute key, or "all". */
      modTarget: str(),
      modValue: new fields.NumberField({ required: true, integer: true, initial: 0 }),
      isActive: new fields.BooleanField({ initial: true }),
      notes: html("")
    };
  }
}

/**
 * Miscellaneous carried equipment.
 * @extends {FTRPGTypeDataModel}
 */
export class EquipmentData extends FTRPGTypeDataModel {
  static defineSchema() {
    return { notes: html("") };
  }
}

export const itemDataModels = {
  item: ItemData,
  skill: SkillData,
  weapon: WeaponData,
  talent: TalentData,
  equipment: EquipmentData
};
