/**
 * Shared data model for the "character" and "npc" Actor types.
 * @module ftrpg/data/actor-creature
 */

import FTRPG from "../config.mjs";
import { FTRPGTypeDataModel, fields, int, str, html } from "./base.mjs";

/**
 * A Starfleet (or civilian) crewmember — player character or NPC alike.
 * @extends {FTRPGTypeDataModel}
 */
export default class CreatureData extends FTRPGTypeDataModel {

  static LOCALIZATION_PREFIXES = ["FTRPG.Shared", "FTRPG.Creature"];

  /** @inheritdoc */
  static defineSchema() {
    const attributes = {};
    for (const key of FTRPG.attributeOrder) {
      attributes[key] = new fields.SchemaField({ value: int({ initial: 0 }) });
    }

    return {
      attributes: new fields.SchemaField(attributes),

      details: new fields.SchemaField({
        race: str(),
        class: str(),
        rank: str(),
        xp: int({ initial: 0 })
      }),

      fate: new fields.SchemaField({
        value: int({ initial: 1, min: 0 }),
        max: int({ initial: 3, min: 0 })
      }),

      wounds: new fields.SchemaField({
        value: int({ initial: 0, min: 0 })
      }),

      armor: new fields.SchemaField({
        value: int({ initial: 0 })
      }),

      biography: html("")
    };
  }

  /**
   * Older exported data (pre-V14 rebuild) stored Fate under `system.resources.fate`
   * instead of the canonical `system.fate` path. Carry it across on import.
   * @inheritdoc
   */
  static migrateData(source) {
    if (source.resources?.fate && !source.fate) source.fate = source.resources.fate;
    return super.migrateData(source);
  }
}
