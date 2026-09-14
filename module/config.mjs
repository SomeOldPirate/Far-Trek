/**
 * Far Trek RPG — system configuration constants.
 * @module ftrpg/config
 */

export const SYSTEM_ID = "ftrpg";

/** Convenience alias used throughout the system. */
export const FTRPG = {};

/* -------------------------------------------- */
/*  Attributes                                  */
/* -------------------------------------------- */

FTRPG.attributes = {
  st: "Strength",
  dx: "Dexterity",
  iq: "Intelligence",
  ca: "Charisma"
};

FTRPG.attributeOrder = ["st", "dx", "iq", "ca"];

/* -------------------------------------------- */
/*  Items                                       */
/* -------------------------------------------- */

FTRPG.itemTypes = {
  item: "Item",
  skill: "Skill",
  weapon: "Weapon",
  talent: "Talent",
  equipment: "Equipment"
};

/** Talent automation modifier types, offered on the talent item sheet. */
FTRPG.modTypes = {
  none: "None",
  skill: "Skill Roll",
  attack: "Attack Roll",
  init: "Initiative",
  attr: "Attribute"
};

/* -------------------------------------------- */
/*  Weapons                                     */
/* -------------------------------------------- */

/** The stun/heavy-stun/kill ladder a phaser-type weapon cycles through. */
FTRPG.phaserModes = {
  stun: { next: "heavy", tn: 14, label: "STUN" },
  heavy: { next: "kill", tn: 17, label: "HEAVY STUN" },
  kill: { next: "stun", tn: 20, label: "KILL" }
};

/** Options offered on the Consciousness Check dialog: "what hit you?" */
FTRPG.consciousnessWeapons = [
  { tn: 5, label: "Fist / Unarmed (TN 5)" },
  { tn: 8, label: "Knife / Dagger (TN 8)" },
  { tn: 11, label: "Pistol / Club (TN 11)" },
  { tn: 14, label: "Rifle / Phaser Stun (TN 14)" },
  { tn: 17, label: "Heavy Stun (TN 17)" },
  { tn: 20, label: "Phaser Kill / Disruptor (TN 20)" }
];

/* -------------------------------------------- */
/*  Ships                                       */
/* -------------------------------------------- */

FTRPG.shipSystems = ["shields", "impulse", "warp", "phasers", "torps", "sensors"];
FTRPG.shipSystemLabels = {
  shields: "SHIELDS", impulse: "IMPULSE", warp: "WARP",
  phasers: "PHASERS", torps: "TORPEDOES", sensors: "SENSORS"
};

/** Subsystem damage ladder: 0 = OK, 1 = damaged (half effectiveness), 2 = offline, 3 = destroyed. */
FTRPG.systemStatusLabels = ["OK", "DMG", "OFFLN", "DSTRD"];
FTRPG.systemStatusColors = ["#4f4", "#eebb00", "#f66", "#555"];

/** Which crew role staffs each subsystem, for the console-hazard reflex save when it's hit badly. */
FTRPG.shipSystemCrewRole = {
  shields: "navigation", impulse: "helm", warp: "engineering",
  phasers: "helm", torps: "navigation", sensors: "science"
};

/** Bridge station roles a crew member (an Actor) can be assigned to. */
FTRPG.shipCrewRoles = {
  command: "Command",
  helm: "Helm",
  navigation: "Navigation",
  engineering: "Engineering",
  science: "Science"
};

export default FTRPG;
