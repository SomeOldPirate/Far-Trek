/**
 * A single item sheet that shows a different field group depending on item.type.
 * @module ftrpg/apps/item-sheet
 */

import FTRPG, { SYSTEM_ID } from "../config.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;
const { TextEditor } = foundry.applications.ux;

/**
 * @extends {ItemSheetV2}
 */
export default class FTRPGItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  /** @inheritdoc */
  static DEFAULT_OPTIONS = {
    id: "ftrpg-item-{id}",
    classes: ["ftrpg", "sheet", "item"],
    position: { width: 500, height: 450 },
    window: { resizable: true, icon: "fa-solid fa-box" },
    form: { submitOnChange: true, closeOnSubmit: false }
  };

  /** @inheritdoc */
  static PARTS = {
    body: { template: `systems/${SYSTEM_ID}/templates/item/item-sheet.hbs`, root: true, scrollable: [""] }
  };

  /** @inheritdoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = this.item;
    const sys = item.system;

    const context2 = Object.assign(context, {
      item, system: sys, config: FTRPG,
      editable: this.isEditable,
      fields: sys.schema.fields,
      enrichedNotes: await TextEditor.implementation.enrichHTML(sys.notes ?? "", {
        relativeTo: item, secrets: item.isOwner
      })
    });

    // For weapons: the dropdown only offers the three personal combat skills.
    // Any unusual existing value is preserved as an extra option so legacy
    // data isn't silently dropped on first save.
    if (item.type === "weapon") {
      const COMBAT_SKILLS = ["Marksmanship", "Armed Melee", "Unarmed Melee"];
      const skillNames = new Set(COMBAT_SKILLS);
      if (sys.attackSkillName) skillNames.add(sys.attackSkillName);
      context2.skillOptions = Array.from(skillNames).sort((a, b) => a.localeCompare(b));
    }

    return context2;
  }
}
