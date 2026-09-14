/**
 * DialogV2-based prompts for the various rolls and ship actions.
 * Each replaces a `new Dialog({...}).render(true)` call from the original ftrpg.js;
 * forms are small enough that their markup stays inline rather than moving to .hbs.
 * @module ftrpg/dice/dialog
 */

import FTRPG from "../config.mjs";

const { DialogV2 } = foundry.applications.api;
const { FormDataExtended } = foundry.applications.ux;

/**
 * The generic "Situational Modifier" prompt used for attribute, skill and weapon rolls.
 * @param {string} title
 * @returns {Promise<number|null>} The modifier, or null if cancelled.
 */
export async function promptModifier(title) {
  const result = await DialogV2.prompt({
    window: { title },
    classes: ["ftrpg-dialog"],
    position: { width: 300 },
    content: `<div class="form-group"><label>Situational Modifier</label><input type="number" name="modifier" value="0" autofocus/></div>`,
    ok: {
      label: "ENGAGE",
      callback: (event, button) => Number(new FormDataExtended(button.form).object.modifier) || 0
    },
    rejectClose: false
  });
  return result ?? null;
}

/**
 * Skill check prompt: which attribute to apply (any of the four, defaulting
 * to the skill's configured attribute) plus a situational modifier.
 * @param {Item} item  A "skill" item.
 * @param {object} attributes  The rolling actor's `system.attributes`.
 * @returns {Promise<{attrKey: string, mod: number}|null>}
 */
export async function promptSkillCheck(item, attributes) {
  const attrOptions = Object.keys(attributes).map(k => {
    const val = attributes[k]?.value ?? 0;
    const label = FTRPG.attributes[k] ?? k.toUpperCase();
    const selected = k === (item.system.attribute || "iq") ? "selected" : "";
    return `<option value="${k}" ${selected}>${label.toUpperCase()} (${val >= 0 ? "+" : ""}${val})</option>`;
  }).join("");
  const result = await DialogV2.prompt({
    window: { title: `${item.name} Check` },
    classes: ["ftrpg-dialog"],
    position: { width: 320 },
    content: `<div class="form-group"><label>Attribute</label><select name="attrKey">${attrOptions}</select></div><div class="form-group"><label>Situational Modifier</label><input type="number" name="modifier" value="0" autofocus/></div><p style="text-align:center; font-size:0.8em; color:#888;">Skill Rank: <b>${item.system.rank}</b></p>`,
    ok: {
      label: "ROLL",
      callback: (event, button) => {
        const fd = new FormDataExtended(button.form).object;
        return { attrKey: fd.attrKey, mod: Number(fd.modifier) || 0 };
      }
    },
    rejectClose: false
  });
  return result ?? null;
}

/**
 * Weapon attack prompt: which of the actor's skills to apply (defaulting to
 * the weapon's configured attack skill) plus a situational modifier.
 * @param {Item} item  A "weapon" item.
 * @param {Item[]} actorSkills  The rolling actor's "skill" items.
 * @returns {Promise<{skillRank: number, mod: number}|null>}
 */
export async function promptWeaponAttack(item, actorSkills) {
  let skillOptions = `<option value="0">None (Rank 0)</option>`;
  for (const s of actorSkills) {
    const selected = s.name.toLowerCase() === (item.system.attackSkillName || "Marksmanship").toLowerCase();
    skillOptions += `<option value="${s.system.rank}" ${selected ? "selected" : ""}>${s.name} (${s.system.rank})</option>`;
  }
  const result = await DialogV2.prompt({
    window: { title: `Attack: ${item.name}` },
    classes: ["ftrpg-dialog"],
    position: { width: 320 },
    content: `<div class="form-group"><label>Attack Skill</label><select name="skillRank">${skillOptions}</select></div><div class="form-group"><label>Situational Modifier</label><input type="number" name="modifier" value="0" autofocus/></div>`,
    ok: {
      label: "ENGAGE",
      callback: (event, button) => {
        const fd = new FormDataExtended(button.form).object;
        return { skillRank: Number(fd.skillRank) || 0, mod: Number(fd.modifier) || 0 };
      }
    },
    rejectClose: false
  });
  return result ?? null;
}

/**
 * "Consciousness Check" prompt: which weapon hit you, plus a modifier.
 * @param {number} wounds
 * @returns {Promise<{weaponTN: number, mod: number}|null>}
 */
export async function promptSurvival(wounds) {
  const options = FTRPG.consciousnessWeapons.map(w => `<option value="${w.tn}">${w.label}</option>`).join("");
  const result = await DialogV2.prompt({
    window: { title: "Consciousness Check" },
    classes: ["ftrpg-dialog"],
    position: { width: 320 },
    content: `<div class="form-group"><label>Weapon that hit you?</label><select name="weaponTN">${options}</select></div><div class="form-group"><label>Modifier</label><input type="number" name="modifier" value="0"/></div><p style="text-align:center; font-size:0.8em; color:#888;">Current Wounds: <b>${wounds}</b> (+${wounds * 3} to TN)</p>`,
    ok: {
      label: "ROLL",
      callback: (event, button) => {
        const fd = new FormDataExtended(button.form).object;
        return { weaponTN: parseInt(fd.weaponTN) || 0, mod: Number(fd.modifier) || 0 };
      }
    },
    rejectClose: false
  });
  return result ?? null;
}

/**
 * "System Damage" severity picker: Graze / Direct Hit / Critical.
 * @returns {Promise<number|null>} 1, 2, 3, or null if cancelled.
 */
export async function promptSeverity() {
  return DialogV2.wait({
    window: { title: "System Damage" },
    classes: ["ftrpg-dialog"],
    content: `<p style="text-align:center;">Severity?</p>`,
    buttons: [
      { action: "l1", label: "Graze", callback: () => 1 },
      { action: "l2", label: "Direct Hit", callback: () => 2 },
      { action: "l3", label: "Critical", callback: () => 3 }
    ],
    rejectClose: false
  });
}

/**
 * "Sensor Scan" difficulty picker.
 * @param {{crewName: string, sensors: number, skill: number}} info
 * @returns {Promise<number|null>} The chosen TN, or null if cancelled.
 */
export async function promptSensorScan({ crewName, sensors, skill }) {
  const result = await DialogV2.prompt({
    window: { title: "Sensor Scan" },
    classes: ["ftrpg-dialog"],
    position: { width: 340 },
    content: `<div class="form-group"><label>Scan Difficulty (TN)</label><select name="tn"><option value="8">Easy (TN 8)</option><option value="11" selected>Average (TN 11)</option><option value="14">Hard (TN 14)</option><option value="17">Heroic (TN 17)</option><option value="20">Legendary (TN 20)</option></select></div><p style="text-align:center; font-size:0.8em; color:#888;">Science Officer: <b>${crewName}</b> | Sensors: +${sensors} | Skill: +${skill}</p>`,
    ok: {
      label: "SCAN",
      callback: (event, button) => parseInt(new FormDataExtended(button.form).object.tn) || 11
    },
    rejectClose: false
  });
  return result ?? null;
}

/**
 * Choose which Helm action to take: a standard maneuver or an evasive action.
 * @returns {Promise<"maneuver"|"evasion"|null>}
 */
export async function promptHelmAction() {
  return DialogV2.wait({
    window: { title: "Helm Station" },
    classes: ["ftrpg-dialog"],
    content: `<p style="text-align:center;">Select Action:</p>`,
    buttons: [
      { action: "maneuver", label: "Standard Maneuver", callback: () => "maneuver" },
      { action: "evasion", label: "Evasive Action", callback: () => "evasion" }
    ],
    rejectClose: false
  });
}

/**
 * A standard Helm maneuver: difficulty TN only.
 * @returns {Promise<number|null>} The chosen TN, or null if cancelled.
 */
export async function promptShipManeuver() {
  const result = await DialogV2.prompt({
    window: { title: "Ship Maneuver" },
    classes: ["ftrpg-dialog"],
    position: { width: 300 },
    content: `<div class="form-group"><label>Difficulty (TN)</label><input type="number" name="tn" value="11" autofocus/></div>`,
    ok: {
      label: "ENGAGE",
      callback: (event, button) => parseInt(new FormDataExtended(button.form).object.tn) || 11
    },
    rejectClose: false
  });
  return result ?? null;
}

/**
 * Evasive Action: the incoming attack's total, the attacker's WR, and weapon type.
 * @returns {Promise<{atn: number, wr: number, wtype: string}|null>}
 */
export async function promptEvasiveAction() {
  const result = await DialogV2.prompt({
    window: { title: "Evasive Maneuvers" },
    classes: ["ftrpg-dialog"],
    position: { width: 340 },
    content: `<div class="form-group"><label>Incoming Attack Total</label><input type="number" name="atn" placeholder="Attacker's roll" autofocus/></div><div class="form-group"><label>Incoming WR</label><input type="number" name="wr" placeholder="Weapon Rating"/></div><div class="form-group"><label>Weapon Type</label><select name="wtype"><option value="phasers">Phasers</option><option value="torps">Torpedoes</option></select></div>`,
    ok: {
      label: "EVADE",
      callback: (event, button) => {
        const fd = new FormDataExtended(button.form).object;
        return { atn: parseInt(fd.atn) || 0, wr: parseInt(fd.wr) || 0, wtype: fd.wtype };
      }
    },
    rejectClose: false
  });
  return result ?? null;
}

/**
 * Fire Weapons: the WR (pre-filled from the ship's stats), range TN, and —
 * for torpedoes — how many tubes to fire at once.
 * @param {"phasers"|"torps"} weaponType
 * @param {{wr: number, crewName: string}} info
 * @returns {Promise<{rangeTN: number, wr: number, maxTubes: number}|null>}
 */
export async function promptShipFire(weaponType, { wr, crewName }) {
  const isTorps = weaponType === "torps";
  const result = await DialogV2.prompt({
    window: { title: isTorps ? "Fire Photon Torpedoes" : "Fire Phasers" },
    classes: ["ftrpg-dialog"],
    position: { width: 360 },
    content: `<div class="form-group"><label>Weapon Rating (WR)</label><input type="number" name="wr" value="${wr}"/></div><div class="form-group"><label>Firing Officer</label><input type="text" value="${crewName}" disabled style="background:#333; color:#aaa;"/></div><div class="form-group"><label>Target Range (TN)</label><select name="range-tn"><option value="5">Contact (TN 5)</option><option value="8">Close (TN 8)</option><option value="11">Medium (TN 11)</option><option value="14" selected>Long (TN 14)</option><option value="17">Extreme (TN 17)</option><option value="20">Maximum (TN 20)</option></select></div>${isTorps ? `<div class="form-group"><label>Max Volley (Tubes)</label><input type="number" name="max-tubes" value="2"/></div>` : ""}`,
    ok: {
      label: "FIRE",
      callback: (event, button) => {
        const fd = new FormDataExtended(button.form).object;
        return {
          wr: parseInt(fd.wr) || 0,
          rangeTN: parseInt(fd["range-tn"]) || 14,
          maxTubes: isTorps ? (parseInt(fd["max-tubes"]) || 1) : 1
        };
      }
    },
    rejectClose: false
  });
  return result ?? null;
}

/**
 * "Incoming Hit" (GM-side manual entry): the attacker's total, WR, weapon type,
 * and (if evaded) the defender's roll. Pre-fillable from a chained chat button.
 * @param {{atn?: number, wr?: number, wtype?: string, defense?: number}} [defaults]
 * @returns {Promise<{atn: number, wr: number, wtype: string, defense: number, maxVolley: number}|null>}
 */
export async function promptIncomingHit(defaults = {}) {
  const { atn = "", wr = "", wtype = "phasers", defense = 0 } = defaults;
  const result = await DialogV2.prompt({
    window: { title: "Incoming Hit" },
    classes: ["ftrpg-dialog"],
    position: { width: 360 },
    content: `<div class="form-group"><label>Attacker's Total (TN)</label><input type="number" name="atn" value="${atn}" placeholder="Attack Roll" autofocus/></div><div class="form-group"><label>Attacker's WR</label><input type="number" name="wr" value="${wr}" placeholder="Weapon Rating"/></div><div class="form-group"><label>Defender's Roll (if evaded)</label><input type="number" name="def" value="${defense}"/></div><div class="form-group"><label>Weapon Type</label><select name="wtype"><option value="phasers" ${wtype === "phasers" ? "selected" : ""}>Phasers</option><option value="torps" ${wtype === "torps" ? "selected" : ""}>Torpedoes</option></select></div><div class="form-group"><label>Max Volley (Torps)</label><input type="number" name="max-volley" value="2"/></div>`,
    ok: {
      label: "APPLY IMPACT",
      callback: (event, button) => {
        const fd = new FormDataExtended(button.form).object;
        return {
          atn: parseInt(fd.atn) || 0,
          wr: parseInt(fd.wr) || 0,
          defense: parseInt(fd.def) || 0,
          wtype: fd.wtype,
          maxVolley: parseInt(fd["max-volley"]) || 2
        };
      }
    },
    rejectClose: false
  });
  return result ?? null;
}

/**
 * Jury-Rig repair: pick which damaged subsystem to attempt to restore.
 * @param {{key: string, level: number}[]} damaged
 * @param {{crewName: string, hasJuryRig: boolean}} info
 * @returns {Promise<string|null>} The chosen system key, or null if cancelled.
 */
export async function promptJuryRig(damaged, { crewName, hasJuryRig }) {
  const options = damaged.map(d => `<option value="${d.key}">${d.key.toUpperCase()} (Level ${d.level})</option>`).join("");
  const bonusText = hasJuryRig ? `<div style="color:#6cf; font-size:0.8em; margin-bottom:5px;">+2 Jury Rig Talent bonus applied.</div>` : "";
  const result = await DialogV2.prompt({
    window: { title: "Jury-Rig System" },
    classes: ["ftrpg-dialog"],
    position: { width: 340 },
    content: `<div class="form-group"><label>Target System</label><select name="target-sys">${options}</select></div><div class="form-group"><label>Engineer</label><input type="text" value="${crewName}" disabled style="background:#333; color:#aaa;"/></div>${bonusText}`,
    ok: {
      label: "ATTEMPT REPAIR (TN 17)",
      callback: (event, button) => new FormDataExtended(button.form).object["target-sys"]
    },
    rejectClose: false
  });
  return result ?? null;
}

/**
 * Route Energy: pick which station to reinforce.
 * @param {string} crewName
 * @returns {Promise<string|null>} "Shields/Helm" or "Weapons", or null if cancelled.
 */
export async function promptRouteEnergy(crewName) {
  const result = await DialogV2.prompt({
    window: { title: "Route Energy" },
    classes: ["ftrpg-dialog"],
    position: { width: 320 },
    content: `<div class="form-group"><label>Target Station</label><select name="target"><option value="Shields/Helm">Shields / Helm (+2 Defense)</option><option value="Weapons">Weapons (+2 Attack)</option></select></div><div class="form-group"><label>Engineer</label><input type="text" value="${crewName}" disabled style="background:#333; color:#aaa;"/></div>`,
    ok: {
      label: "ROUTE POWER (TN 10)",
      callback: (event, button) => new FormDataExtended(button.form).object.target
    },
    rejectClose: false
  });
  return result ?? null;
}
