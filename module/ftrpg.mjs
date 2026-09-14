/**
 * Far Trek RPG — a lightweight Foundry VTT system for Foundry V14 and later.
 * @module ftrpg
 */

import FTRPG, { SYSTEM_ID } from "./config.mjs";

import CreatureData from "./data/actor-creature.mjs";
import ShipData from "./data/actor-ship.mjs";
import { itemDataModels } from "./data/items.mjs";

import FTRPGCharacterSheet from "./apps/character-sheet.mjs";
import FTRPGNpcSheet from "./apps/npc-sheet.mjs";
import FTRPGShipSheet from "./apps/ship-sheet.mjs";
import FTRPGItemSheet from "./apps/item-sheet.mjs";

import { onRenderChatMessage } from "./helpers/chat.mjs";

/* -------------------------------------------- */
/*  Init                                        */
/* -------------------------------------------- */

Hooks.once("init", () => {
  console.log("Far Trek RPG | Space: the final frontier.");

  game.ftrpg = {
    config: FTRPG,
    applications: { FTRPGCharacterSheet, FTRPGNpcSheet, FTRPGShipSheet, FTRPGItemSheet }
  };
  CONFIG.FTRPG = FTRPG;

  CONFIG.Actor.dataModels = { character: CreatureData, npc: CreatureData, ship: ShipData };
  CONFIG.Item.dataModels = itemDataModels;

  // Fallback formula for the core "roll initiative" control; the sheet's own
  // Combat Initiative button (dice/rolls.mjs#rollInitiative) is the primary path.
  CONFIG.Combat.initiative = { formula: "3d6 + @attributes.dx.value", decimals: 2 };

  const { DocumentSheetConfig } = foundry.applications.apps;
  DocumentSheetConfig.registerSheet(Actor, SYSTEM_ID, FTRPGCharacterSheet, {
    types: ["character"], makeDefault: true, label: "Character Sheet"
  });
  DocumentSheetConfig.registerSheet(Actor, SYSTEM_ID, FTRPGNpcSheet, {
    types: ["npc"], makeDefault: true, label: "NPC Sheet"
  });
  DocumentSheetConfig.registerSheet(Actor, SYSTEM_ID, FTRPGShipSheet, {
    types: ["ship"], makeDefault: true, label: "Starship Sheet"
  });
  DocumentSheetConfig.registerSheet(Item, SYSTEM_ID, FTRPGItemSheet, {
    types: Object.keys(itemDataModels), makeDefault: true, label: "Item Sheet"
  });
});

/* -------------------------------------------- */
/*  Chat                                        */
/* -------------------------------------------- */

Hooks.on("renderChatMessageHTML", onRenderChatMessage);

/* -------------------------------------------- */
/*  Dice So Nice                                */
/* -------------------------------------------- */

Hooks.once("diceSoNiceReady", dice3d => {
  dice3d.addSystem({ id: SYSTEM_ID, name: "Far Trek RPG" }, "default");
  dice3d.addColorset({
    name: "tos-command", description: "TOS Command", category: "Far Trek",
    foreground: "#eebb00", background: "#000000", outline: "#eebb00", edge: "#eebb00",
    texture: "none", material: "plastic", font: "Arial", fontScale: { d6: 1.1, d20: 1.0 }
  }, "default");
});
