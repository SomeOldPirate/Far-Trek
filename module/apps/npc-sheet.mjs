/**
 * The NPC sheet — a compact statblock reusing the character sheet's data and actions.
 * @module ftrpg/apps/npc-sheet
 */

import { SYSTEM_ID } from "../config.mjs";
import FTRPGCharacterSheet from "./character-sheet.mjs";

/**
 * @extends {FTRPGCharacterSheet}
 */
export default class FTRPGNpcSheet extends FTRPGCharacterSheet {

  /** @inheritdoc */
  static DEFAULT_OPTIONS = {
    id: "ftrpg-npc-{id}",
    classes: ["ftrpg", "sheet", "npc"],
    position: { width: 350, height: 600 },
    window: { resizable: true, icon: "fa-solid fa-user-injured" }
  };

  /** @inheritdoc */
  static PARTS = {
    body: { template: `systems/${SYSTEM_ID}/templates/actor/npc-sheet.hbs`, root: true, scrollable: [""] }
  };

  /** @inheritdoc */
  static TABS = {};
}
