/**
 * The player character sheet. Also the base class for the NPC sheet.
 * @module ftrpg/apps/character-sheet
 */

import FTRPG, { SYSTEM_ID } from "../config.mjs";
import * as Dice from "../dice/rolls.mjs";
import { promptModifier, promptSurvival, promptSkillCheck, promptWeaponAttack } from "../dice/dialog.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
const { TextEditor } = foundry.applications.ux;

/**
 * @extends {ActorSheetV2}
 */
export default class FTRPGCharacterSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  /** @inheritdoc */
  static DEFAULT_OPTIONS = {
    id: "ftrpg-character-{id}",
    classes: ["ftrpg", "sheet", "actor"],
    position: { width: 600, height: 700 },
    window: { resizable: true, icon: "fa-solid fa-user-astronaut" },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      rollAttribute: this.#onRollAttribute,
      rollInit: this.#onRollInit,
      rollSurvival: this.#onRollSurvival,
      itemRoll: this.#onItemRoll,
      itemCreate: this.#onItemCreate,
      itemEdit: this.#onItemEdit,
      itemDelete: this.#onItemDelete,
      togglePhaserMode: this.#onTogglePhaserMode,
      fateSpend: this.#onFateSpend,
      fateRefresh: this.#onFateRefresh
    }
  };

  /** @inheritdoc */
  static PARTS = {
    header: { template: `systems/${SYSTEM_ID}/templates/actor/character-header.hbs` },
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    attributes: { template: `systems/${SYSTEM_ID}/templates/actor/character-attributes.hbs`, scrollable: [""] },
    inventory: { template: `systems/${SYSTEM_ID}/templates/actor/character-inventory.hbs`, scrollable: [""] }
  };

  /** @inheritdoc */
  static TABS = {
    primary: {
      tabs: [
        { id: "attributes", label: "Attributes" },
        { id: "inventory", label: "Inventory & Skills" }
      ],
      initial: "attributes"
    }
  };

  /* -------------------------------------------- */
  /*  Context                                     */
  /* -------------------------------------------- */

  /** @inheritdoc */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    context.tabs ??= this._prepareTabs?.("primary") ?? {};
    if (partId in context.tabs) context.tab = context.tabs[partId];
    return context;
  }

  /** @inheritdoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    const system = actor.system;

    const attributes = foundry.utils.deepClone(system.attributes);
    for (const item of actor.items) {
      if (item.type !== "talent" || !item.system.isActive || item.system.modType !== "attr") continue;
      const key = item.system.modTarget.toLowerCase();
      if (attributes[key]) attributes[key].value += item.system.modValue;
    }

    const weapons = actor.items.filter(i => i.type === "weapon").map(item => {
      const data = { item, showStunToggle: item.system.hasStun };
      if (item.system.hasStun) data.phaserMode = item.getFlag(SYSTEM_ID, "phaserMode") || "stun";
      return data;
    });

    const className = system.details?.class?.toLowerCase().trim() || "";
    let borderClass = "border-civilian";
    if (className.includes("red")) borderClass = "border-red";
    else if (className.includes("blue")) borderClass = "border-blue";
    else if (className.includes("gold")) borderClass = "border-gold";

    // The TN shown on the sheet is an escalation display, not tied to a specific
    // weapon: base 8 (average weapon) + 3 per wound already taken.
    const wounds = Number(system.wounds?.value ?? 0);
    const consciousnessTN = 8 + wounds * 3;

    return Object.assign(context, {
      actor, system, config: FTRPG,
      editable: this.isEditable,
      fields: system.schema.fields,
      attributes,
      weapons,
      skills: actor.items.filter(i => i.type === "skill"),
      talents: actor.items.filter(i => i.type === "talent"),
      equipment: actor.items.filter(i => i.type === "equipment"),
      borderClass,
      consciousnessTN,
      enrichedBiography: await TextEditor.implementation.enrichHTML(system.biography ?? "", {
        relativeTo: actor, secrets: actor.isOwner
      })
    });
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  static async #onRollAttribute(event, target) {
    const key = target.dataset.key;
    const label = target.dataset.label;
    const mod = await promptModifier(`${label} Test`);
    if (mod === null) return;
    Dice.rollAttributeTest(this.actor, { label, key, mod });
  }

  static async #onRollInit() {
    Dice.rollInitiative(this.actor);
  }

  static async #onRollSurvival() {
    const wounds = Number(this.actor.system.wounds?.value) || 0;
    const result = await promptSurvival(wounds);
    if (!result) return;
    Dice.rollSurvival(this.actor, result);
  }

  static async #onItemRoll(event, target) {
    const li = target.closest("[data-item-id]");
    const item = this.actor.items.get(li?.dataset.itemId);
    if (!item) return ui.notifications.error("Item not found.");

    if (item.type === "talent") return Dice.postTalentInfo(this.actor, item);

    if (item.type === "skill") {
      const result = await promptSkillCheck(item, this.actor.system.attributes);
      if (result === null) return;
      Dice.rollSkill(this.actor, item, result.mod, result.attrKey);
    } else if (item.type === "weapon") {
      const actorSkills = this.actor.items.filter(i => i.type === "skill");
      const result = await promptWeaponAttack(item, actorSkills);
      if (result === null) return;
      Dice.rollWeapon(this.actor, item, result.mod, result.skillRank);
    }
  }

  static async #onItemCreate(event, target) {
    const type = target.dataset.type;
    await Item.create({ name: `New ${type.capitalize()}`, type }, { parent: this.actor });
  }

  static #onItemEdit(event, target) {
    const li = target.closest("[data-item-id]");
    this.actor.items.get(li?.dataset.itemId)?.sheet.render(true);
  }

  static async #onItemDelete(event, target) {
    const li = target.closest("[data-item-id]");
    if (li) await this.actor.deleteEmbeddedDocuments("Item", [li.dataset.itemId]);
  }

  static async #onTogglePhaserMode(event, target) {
    event.preventDefault();
    event.stopPropagation();
    const li = target.closest("[data-item-id]");
    const item = this.actor.items.get(li?.dataset.itemId);
    if (!item) return;
    const current = item.getFlag(SYSTEM_ID, "phaserMode") || "stun";
    const next = FTRPG.phaserModes[current].next;
    const { tn, label } = FTRPG.phaserModes[next];
    await item.setFlag(SYSTEM_ID, "phaserMode", next);
    await item.update({ "system.weaponTN": tn });
    const notify = next === "kill" ? "warn" : "info";
    ui.notifications[notify](`${item.name} set to ${label} (TN ${tn})`);
  }

  static async #onFateSpend() {
    const actor = this.actor;
    const current = Number(actor.system.fate?.value ?? 0);
    if (current <= 0) return ui.notifications.warn("No Fate Points remaining!");
    await actor.update({ "system.fate.value": current - 1 });
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="ftrpg-chat-card"><div class="ftrpg-card-header" style="background:#663399; color:#fff;">FATE POINT SPENT</div><div class="ftrpg-card-content" style="text-align:center; font-style:italic; color:#ccc;">"There are always possibilities..."<br><br>Remaining: <strong>${current - 1}</strong></div></div>`
    });
  }

  static async #onFateRefresh() {
    const actor = this.actor;
    const heroicCount = actor.items.filter(i => i.type === "talent" && i.name.toLowerCase() === "heroic").length;
    const isHuman = (actor.system.details?.race ?? "").toLowerCase().includes("human");
    const newMax = 1 + heroicCount + (isHuman ? 1 : 0);
    await actor.update({ "system.fate.value": newMax });
    ui.notifications.info(`Fate refreshed to ${newMax}.`);
  }
}
