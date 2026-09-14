/**
 * Shared DataModel scaffolding for Far Trek RPG.
 * @module ftrpg/data/base
 */

const fields = foundry.data.fields;

/**
 * A required integer field.
 * @param {object} [options]
 * @param {number} [options.initial=0]
 * @param {number} [options.min]
 * @param {number} [options.max]
 * @returns {foundry.data.fields.NumberField}
 */
export function int({ initial = 0, min, max } = {}) {
  const cfg = { required: true, integer: true, initial };
  if (min !== undefined) cfg.min = min;
  if (max !== undefined) cfg.max = max;
  return new fields.NumberField(cfg);
}

/**
 * A plain (non-blank-required) string field.
 * @param {string} [initial=""]
 * @returns {foundry.data.fields.StringField}
 */
export function str(initial = "") {
  return new fields.StringField({ required: true, blank: true, initial });
}

/**
 * A required string constrained to a fixed set of choices.
 * @param {Record<string, string>} choices
 * @param {string} initial
 * @returns {foundry.data.fields.StringField}
 */
export function choice(choices, initial) {
  return new fields.StringField({ required: true, blank: false, initial, choices });
}

/**
 * A rich-text field edited with ProseMirror.
 * @param {string} [initial=""]
 * @returns {foundry.data.fields.HTMLField}
 */
export function html(initial = "") {
  return new fields.HTMLField({ initial, textSearch: true });
}

/**
 * Common base for all Far Trek RPG type data models.
 * @abstract
 * @extends {foundry.abstract.TypeDataModel}
 */
export class FTRPGTypeDataModel extends foundry.abstract.TypeDataModel {
  static LOCALIZATION_PREFIXES = ["FTRPG.Shared"];
}

export { fields };
