/**
 * Data model for the "ship" Actor type.
 * @module ftrpg/data/actor-ship
 */

import { FTRPGTypeDataModel, fields, int, str } from "./base.mjs";

/**
 * A starship: bridge stations, crew assignments, subsystem damage ladder, and shields.
 * @extends {FTRPGTypeDataModel}
 */
export default class ShipData extends FTRPGTypeDataModel {

  static LOCALIZATION_PREFIXES = ["FTRPG.Shared", "FTRPG.Ship"];

  /** @inheritdoc */
  static defineSchema() {
    return {
      stats: new fields.SchemaField({
        tactical: int({ initial: 0 }),        // Phaser WR
        sr: int({ initial: 0 }),              // Base Shield Rating
        torpedo_damage: int({ initial: 4 }),  // Torpedo WR
        maneuver: int({ initial: 0 }),        // Maneuver bonus
        helm: int({ initial: 0 }),            // Helm officer skill bonus (evasion/maneuver rolls)
        sensors: int({ initial: 0 }),         // Science/sensor rating
        engineering: int({ initial: 0 }),     // Engineering rating
        notes: str()
      }),

      ammo: new fields.SchemaField({
        torpedoes: new fields.SchemaField({
          value: int({ initial: 20 }),
          max: int({ initial: 20 })
        })
      }),

      /** Crew assigned to each bridge station, stored as Actor UUIDs. */
      crew: new fields.SchemaField({
        command: str(),
        helm: str(),
        navigation: str(),
        engineering: str(),
        science: str()
      }),

      subsystems: new fields.SchemaField({
        shields: int({ initial: 0, min: 0, max: 3 }),
        impulse: int({ initial: 0, min: 0, max: 3 }),
        warp: int({ initial: 0, min: 0, max: 3 }),
        phasers: int({ initial: 0, min: 0, max: 3 }),
        torps: int({ initial: 0, min: 0, max: 3 }),
        sensors: int({ initial: 0, min: 0, max: 3 })
      }),

      health: new fields.SchemaField({
        shields: new fields.SchemaField({
          value: int({ initial: 100 }),
          max: int({ initial: 100 }),
          active: new fields.BooleanField({ initial: true })
        })
      })
    };
  }
}
