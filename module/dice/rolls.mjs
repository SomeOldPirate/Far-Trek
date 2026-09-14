/**
 * Attribute, skill, weapon, initiative and survival rolls for characters and NPCs.
 * Ported from the original ftrpg.js — the math and chat-card layout are unchanged.
 * @module ftrpg/dice/rolls
 */

/**
 * Sum the bonus a creature's active talents grant to a given roll type.
 * @param {Actor} actor
 * @param {string} type      "skill" | "attack" | "init" | "attr"
 * @param {string} [target]  Skill name, "melee"/"ranged", or an attribute key.
 * @returns {number}
 */
export function getTalentBonus(actor, type, target = "") {
  const talents = actor.items.filter(i => i.type === "talent" && i.system.isActive);
  let bonus = 0;
  for (const t of talents) {
    const s = t.system;
    if (s.modType !== type) continue;
    if (target === "" || s.modTarget.toLowerCase() === target.toLowerCase() || s.modTarget === "all") {
      bonus += s.modValue;
    }
  }
  return bonus;
}

/**
 * The "SPEND FATE (REROLL)" button, shown only when the actor has Fate remaining.
 * @param {Actor} actor
 * @param {string} label
 * @param {string} formula
 * @returns {string}
 */
export function fateButtonHTML(actor, label, formula) {
  const fate = actor.system.fate?.value || 0;
  if (fate <= 0) return "";
  return `<button class="fate-reroll" data-actor-uuid="${actor.uuid}" data-label="${label}" data-formula="${formula}"><i class="fas fa-dice"></i> SPEND FATE (REROLL)</button>`;
}

/**
 * A basic attribute test: 3d6 + attribute + situational modifier.
 * @param {Actor} actor
 * @param {object} options
 * @param {string} options.label
 * @param {string} options.key  Attribute key (st/dx/iq/ca).
 * @param {number} [options.mod=0]
 */
export async function rollAttributeTest(actor, { label, key, mod = 0 }) {
  const attrValue = Number(actor.system.attributes?.[key]?.value) || 0;
  const roll = new Roll("3d6 + @attr + @mod", { attr: attrValue, mod });
  await roll.evaluate();
  const fateBtn = fateButtonHTML(actor, label, `3d6 + ${attrValue} + ${mod}`);
  const content = `<div class="ftrpg-chat-card"><div class="ftrpg-card-header header-blue"><span>${label}</span><span style="font-size:0.7em">TEST</span></div><div class="ftrpg-card-content"><div style="text-align:center; margin-bottom:5px;"><span class="ftrpg-card-label">BASE (${attrValue}) + MOD (${mod}) + 3d6</span></div><div class="ftrpg-card-result">${roll.total}</div>${fateBtn}</div></div>`;
  return roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), content });
}

/**
 * Combat initiative: 3d6 + DEX (+ talent bonuses). Also sets the actor's
 * initiative on the active combat, if it is a combatant.
 * @param {Actor} actor
 */
export async function rollInitiative(actor) {
  const dx = Number(actor.system.attributes?.dx?.value) || 0;
  const talentBonus = getTalentBonus(actor, "init");
  const roll = new Roll("3d6 + @dx + @talent", { dx, talent: talentBonus });
  await roll.evaluate();
  if (game.combat) {
    const c = game.combat.combatants.find(c => c.actorId === actor.id);
    if (c) await game.combat.setInitiative(c.id, roll.total);
  }
  const flavor = talentBonus !== 0 ? `<div style="font-size:0.8em; color:#eebb00;">(Includes +${talentBonus} from Talents)</div>` : "";
  const fateBtn = fateButtonHTML(actor, "Initiative", `3d6 + ${dx} + ${talentBonus}`);
  const content = `<div class="ftrpg-chat-card"><div class="ftrpg-card-header header-gold"><span>Initiative</span><span style="font-size:0.7em">COMBAT</span></div><div class="ftrpg-card-content"><div style="text-align:center; margin-bottom:5px;"><span class="ftrpg-card-label">DEXTERITY (${dx}) + 3d6</span></div><div class="ftrpg-card-result">${roll.total}</div>${flavor}<div class="ftrpg-card-alert" style="background-color:#333; color:#eebb00; border-color:#eebb00;">READY FOR ACTION</div>${fateBtn}</div></div>`;
  return roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), content });
}

/**
 * "I was hit" consciousness check: 3d6 + STR + armor vs weapon TN + (wounds x3).
 * Adds a wound on success (still standing, but worn down).
 * @param {Actor} actor
 * @param {object} options
 * @param {number} options.weaponTN
 * @param {number} [options.mod=0]
 */
export async function rollSurvival(actor, { weaponTN, mod = 0 }) {
  const wounds = Number(actor.system.wounds?.value) || 0;
  const st = Number(actor.system.attributes?.st?.value) || 0;
  const armor = Number(actor.system.armor?.value) || 0;
  const targetTN = weaponTN + (wounds * 3);
  const roll = new Roll("3d6 + @st + @armor + @mod", { st, armor, mod });
  await roll.evaluate();
  const success = roll.total >= targetTN;
  const resultHTML = success
    ? `<div style="color:#6f6; font-weight:bold; margin-top:10px;">STILL STANDING</div>`
    : `<div style="color:#f66; font-weight:bold; margin-top:10px;">UNCONSCIOUS</div>`;
  if (success) await actor.update({ "system.wounds.value": wounds + 1 });
  const fateBtn = fateButtonHTML(actor, "Survival", `3d6 + ${st} + ${armor} + ${mod}`);
  const content = `<div class="ftrpg-chat-card"><div class="ftrpg-card-header header-red"><span>Consciousness</span><span style="font-size:0.7em">TN ${targetTN}</span></div><div class="ftrpg-card-content"><div style="text-align:center;"><span class="ftrpg-card-label">BASE ${weaponTN} + WOUNDS ${wounds * 3}</span></div><div class="ftrpg-card-result">${roll.total}</div><div style="text-align:center;">${resultHTML}</div>${fateBtn}</div></div>`;
  return roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), content });
}

/**
 * A skill test: 3d6 + attribute + rank + talent bonus + situational modifier.
 * Any of the four attributes may be applied to any skill — the item's own
 * `attribute` field is only the default offered in the roll prompt.
 * @param {Actor} actor
 * @param {Item} item  A "skill" item.
 * @param {number} [mod=0]
 * @param {string} [attrKey]  Override attribute key (st/dx/iq/ca); defaults to the item's configured attribute.
 */
export async function rollSkill(actor, item, mod = 0, attrKey = null) {
  attrKey = attrKey || item.system.attribute || "iq";
  const attrValue = Number(actor.system.attributes?.[attrKey]?.value) || 0;
  const rank = Number(item.system.rank) || 0;
  const talentBonus = getTalentBonus(actor, "skill", item.name);
  const roll = new Roll("3d6 + @attr + @rank + @talent + @mod", { attr: attrValue, rank, talent: talentBonus, mod });
  await roll.evaluate();
  const fateBtn = fateButtonHTML(actor, item.name, `3d6 + ${attrValue} + ${rank} + ${talentBonus} + ${mod}`);
  const talentText = talentBonus !== 0 ? `<div style="text-align:center; margin-bottom:2px;"><span class="ftrpg-card-label" style="color:#eebb00;">TALENT BONUS:</span> ${talentBonus > 0 ? "+" + talentBonus : talentBonus}</div>` : "";
  const content = `<div class="ftrpg-chat-card"><div class="ftrpg-card-header header-gold"><span>${item.name}</span><span style="font-size:0.7em">SKILL</span></div><div class="ftrpg-card-content"><div style="text-align:center; margin-bottom:5px;"><span class="ftrpg-card-label">${attrKey.toUpperCase()} (${attrValue}) + RANK (${rank}) + MOD (${mod})</span></div>${talentText}<div class="ftrpg-card-result">${roll.total}</div>${fateBtn}</div></div>`;
  return roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), content });
}

/**
 * A weapon attack: 3d6 + attribute + skill rank + talent bonus + situational modifier.
 * The skill applied is chosen in the roll prompt (defaulting to the weapon's
 * configured `attackSkillName`) — any of the actor's skills may be used.
 * @param {Actor} actor
 * @param {Item} item  A "weapon" item.
 * @param {number} [mod=0]
 * @param {number} [skillRank]  Override skill rank; defaults to looking up the weapon's configured attack skill.
 */
export async function rollWeapon(actor, item, mod = 0, skillRank = null) {
  const attrKey = item.system.attackAttribute || "dx";
  const attrValue = Number(actor.system.attributes?.[attrKey]?.value) || 0;
  if (skillRank === null) {
    const skillName = item.system.attackSkillName.toLowerCase();
    const skillItem = actor.items.find(i => i.type === "skill" && i.name.toLowerCase() === skillName);
    skillRank = skillItem ? Number(skillItem.system.rank) : 0;
  }
  const defenseStat = (attrKey === "dx") ? "DEXTERITY" : "STRENGTH";

  let talentBonus = getTalentBonus(actor, "attack", "all");
  const range = item.system.range?.toLowerCase() || "";
  talentBonus += range.includes("close") || range.includes("melee")
    ? getTalentBonus(actor, "attack", "melee")
    : getTalentBonus(actor, "attack", "ranged");

  const roll = new Roll("3d6 + @attr + @skill + @talent + @mod", { attr: attrValue, skill: skillRank, talent: talentBonus, mod });
  await roll.evaluate();
  const fateBtn = fateButtonHTML(actor, item.name, `3d6 + ${attrValue} + ${skillRank} + ${talentBonus} + ${mod}`);
  const talentText = talentBonus !== 0 ? `<div style="text-align:center; margin-bottom:2px;"><span class="ftrpg-card-label" style="color:#eebb00;">TALENT BONUS:</span> ${talentBonus > 0 ? "+" + talentBonus : talentBonus}</div>` : "";

  let modeText = "";
  if (item.system.hasStun) {
    const mode = item.getFlag("ftrpg", "phaserMode") || "stun";
    if (mode === "kill") modeText = `<div style="color:#ff4444; font-size:0.8em; font-weight:bold; margin-top:5px;">SETTING: KILL (TN 20)</div>`;
    else if (mode === "heavy") modeText = `<div style="color:#ffaa00; font-size:0.8em; font-weight:bold; margin-top:5px;">SETTING: HEAVY STUN (TN 17)</div>`;
    else modeText = `<div style="color:#44ff44; font-size:0.8em; font-weight:bold; margin-top:5px;">SETTING: STUN (TN 14)</div>`;
  }

  const content = `<div class="ftrpg-chat-card"><div class="ftrpg-card-header header-red"><span>${item.name}</span><span style="font-size:0.7em">ATTACK</span></div><div class="ftrpg-card-content"><div style="display:flex; justify-content:space-between; margin-bottom:5px;"><div><span class="ftrpg-card-label">ATTR:</span> ${attrKey.toUpperCase()} (${attrValue})</div><div><span class="ftrpg-card-label">SKILL:</span> ${skillRank}</div></div>${talentText}<div style="text-align:center; margin-bottom:5px;"><span class="ftrpg-card-label">MODIFIER:</span> ${mod}</div><div class="ftrpg-card-result">${roll.total}</div><div class="ftrpg-card-alert" style="text-align:left;"><div style="border-bottom:1px solid #555; padding-bottom:5px; margin-bottom:5px;"><div class="ftrpg-card-label" style="color:#aaa;">TO AVOID HIT:</div><div style="color:#fff;">Target rolls <strong>${defenseStat}</strong> vs</div><div style="font-size: 1.2em; font-weight: bold; color: #fff;">TN ${roll.total}</div></div><div><div class="ftrpg-card-label" style="color:#aaa;">IF DAMAGE TAKEN:</div><div style="color:#fff;">Consciousness Check</div><div style="font-size: 0.9em;">Roll <strong>STRENGTH</strong> vs TN ${item.system.weaponTN} (+Wounds)</div></div>${modeText}</div>${fateBtn}</div></div>`;
  return roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), content });
}

/**
 * Post a talent's description/notes to chat (talents don't roll anything themselves).
 * @param {Actor} actor
 * @param {Item} item  A "talent" item.
 */
export async function postTalentInfo(actor, item) {
  const content = `<div class="ftrpg-chat-card"><div class="ftrpg-card-header header-blue"><span>${item.name}</span><span style="font-size:0.7em">TALENT</span></div><div class="ftrpg-card-content" style="text-align:left;">${item.system.notes || "No description provided."}</div></div>`;
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
}
