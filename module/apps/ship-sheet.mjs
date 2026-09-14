/**
 * The starship sheet: a 3-column bridge layout with drag-and-drop crew
 * assignment per station, shield/subsystem monitors, and ship-to-ship combat.
 * @module ftrpg/apps/ship-sheet
 */

import FTRPG, { SYSTEM_ID } from "../config.mjs";
import * as ShipRolls from "../dice/ship-rolls.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
const { TextEditor } = foundry.applications.ux;

/**
 * @extends {ActorSheetV2}
 */
export default class FTRPGShipSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  /** @inheritdoc */
  static DEFAULT_OPTIONS = {
    id: "ftrpg-ship-{id}",
    classes: ["ftrpg", "sheet", "ship"],
    position: { width: 900, height: 800 },
    window: { resizable: true, icon: "fa-solid fa-rocket" },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      rollShipFire: this.#onShipFire,
      rollHelmManeuver: this.#onHelmManeuver,
      rollDamageControl: this.#onDamageControl,
      rollWorriedEngineer: this.#onWorriedEngineer,
      rollSensorScan: this.#onSensorScan,
      toggleShields: this.#onToggleShields,
      rollIncomingHit: this.#onIncomingHit,
      rollSystemDamage: this.#onSystemDamage,
      rollCasualties: this.#onCasualties,
      systemStatusToggle: this.#onSystemStatusToggle,
      crewRemove: this.#onCrewRemove
    }
  };

  /** @inheritdoc */
  static PARTS = {
    body: { template: `systems/${SYSTEM_ID}/templates/actor/ship-sheet.hbs`, root: true, scrollable: [""] }
  };

  /* -------------------------------------------- */
  /*  Context                                     */
  /* -------------------------------------------- */

  /** @inheritdoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    const system = actor.system;

    const shieldPct = Math.round((system.health.shields.value / system.health.shields.max) * 100);
    const shieldLoss = 100 - shieldPct;
    const penalty = Math.floor(shieldLoss / 25);
    const effectiveSR = Math.max(0, (system.stats.sr || 0) - penalty);

    const crewData = {};
    for (const role of Object.keys(FTRPG.shipCrewRoles)) {
      const uuid = system.crew[role];
      if (!uuid) continue;
      const crewActor = await fromUuid(uuid);
      if (crewActor) crewData[role] = { name: crewActor.name, img: crewActor.img, uuid };
    }

    return Object.assign(context, {
      actor, system, config: FTRPG,
      editable: this.isEditable,
      shieldPct, effectiveSR, crewData,
      enrichedNotes: await TextEditor.implementation.enrichHTML(system.stats.notes ?? "", {
        relativeTo: actor, secrets: actor.isOwner
      })
    });
  }

  /* -------------------------------------------- */
  /*  Drag & drop — assign crew to a station      */
  /* -------------------------------------------- */

  /** @inheritdoc */
  async _onDropActor(event, actor) {
    const dropTarget = event.target.closest(".station-drop-zone");
    if (!dropTarget) return null;
    const role = dropTarget.dataset.role;
    await this.actor.update({ [`system.crew.${role}`]: actor.uuid });
    ui.notifications.info(`${actor.name} assigned to ${role.toUpperCase()}.`);
    return actor;
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  static async #onCrewRemove(event, target) {
    const role = target.dataset.role;
    await this.actor.update({ [`system.crew.${role}`]: "" });
  }

  static async #onShipFire(event, target) {
    return ShipRolls.rollShipFire(this.actor, target.dataset.weaponType);
  }

  static async #onHelmManeuver() {
    return ShipRolls.rollHelmAction(this.actor);
  }

  static async #onSensorScan() {
    return ShipRolls.rollSensorScan(this.actor);
  }

  static async #onWorriedEngineer() {
    return ShipRolls.rollWorriedEngineer(this.actor);
  }

  static async #onDamageControl(event, target) {
    const type = target.dataset.type;
    if (type === "repair") return ShipRolls.rollJuryRig(this.actor);
    if (type === "route") return ShipRolls.rollRouteEnergy(this.actor);
  }

  static async #onToggleShields() {
    return ShipRolls.toggleShields(this.actor);
  }

  static async #onIncomingHit() {
    return ShipRolls.rollIncomingHit(this.actor);
  }

  static async #onSystemDamage() {
    return ShipRolls.rollSystemDamage(this.actor);
  }

  static async #onCasualties() {
    return ShipRolls.rollCasualties(this.actor);
  }

  static async #onSystemStatusToggle(event, target) {
    return ShipRolls.toggleSystemStatus(this.actor, target.dataset.system);
  }
}
