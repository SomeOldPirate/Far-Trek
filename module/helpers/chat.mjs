/**
 * Chat-card button handlers: Fate rerolls and the ship combat automation buttons.
 * Ported from the original ftrpg.js `$(document).on('click', ...)` delegates, rebound
 * per-message via `renderChatMessageHTML` instead of a single jQuery listener on `document`.
 * @module ftrpg/helpers/chat
 */

import FTRPG from "../config.mjs";
import { applyAutoHit, rollIncomingHit, rollReflexSave } from "../dice/ship-rolls.mjs";

/**
 * Attach this system's chat-card button handlers to a newly rendered message.
 * @param {ChatMessage} message
 * @param {HTMLElement} html
 */
export function onRenderChatMessage(message, html) {
  html.querySelector(".fate-reroll")?.addEventListener("click", onFateReroll);
  html.querySelector(".apply-ship-damage")?.addEventListener("click", onApplyShipDamage);
  html.querySelector(".roll-system-damage-context")?.addEventListener("click", onRollSystemDamageContext);
  html.querySelector(".apply-auto-hit")?.addEventListener("click", onApplyAutoHit);
  html.querySelector(".resolve-narrative-impact")?.addEventListener("click", onResolveNarrativeImpact);
  html.querySelector(".roll-reflex-save")?.addEventListener("click", onRollReflexSave);
}

/** Spend one Fate point and reroll the formula attached to the button. */
async function onFateReroll(event) {
  event.preventDefault();
  const btn = event.currentTarget;
  const actor = await fromUuid(btn.dataset.actorUuid);
  if (!actor) return;
  const fate = actor.system.fate?.value || 0;
  if (fate <= 0) return ui.notifications.warn("No Fate points remaining!");
  await actor.update({ "system.fate.value": fate - 1 });
  const roll = new Roll(String(btn.dataset.formula));
  await roll.evaluate();
  const label = btn.dataset.label || "Action";
  const content = `<div class="ftrpg-chat-card">
    <div class="ftrpg-card-header" style="background:#663399;color:#fff;">
      <span>FATE INTERVENTION</span><span style="font-size:0.7em">${label.toUpperCase()}</span>
    </div>
    <div class="ftrpg-card-content">
      <div style="text-align:center;font-style:italic;color:#aaa;margin-bottom:5px;">"There are always possibilities..."</div>
      <div class="ftrpg-card-result" style="text-shadow:0 0 10px #663399;">${roll.total}</div>
      <div class="ftrpg-card-alert" style="background:#220a33;border-color:#663399;color:#dcdcdc;">
        Fate Spent. Remaining: <strong>${fate - 1}</strong>
      </div>
    </div></div>`;
  ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content, rolls: [roll] });
}

/** Drain a target ship's shields by the value on the button (Shield Absorption result). */
async function onApplyShipDamage(event) {
  event.preventDefault();
  const btn = event.currentTarget;
  const value = parseInt(btn.dataset.value);
  const target = await fromUuid(btn.dataset.uuid);
  if (!target?.isOwner) return ui.notifications.error("Target not found/owned.");
  const cur = target.system.health.shields.value;
  await target.update({ "system.health.shields.value": Math.max(0, cur - value) });
  ChatMessage.create({ content: `Shields drained by ${value}%` });
}

/** Roll a 1d6 hit location and, if a target UUID is attached, apply the damage level. */
async function onRollSystemDamageContext(event) {
  event.preventDefault();
  const btn = event.currentTarget;
  const level = parseInt(btn.dataset.level);
  const uuid = btn.dataset.uuid;

  const roll = new Roll("1d6");
  await roll.evaluate();
  const index = roll.total - 1;
  const sysKey = FTRPG.shipSystems[index];
  const loc = FTRPG.shipSystemLabels[sysKey];

  let updateMsg = "";
  if (uuid) {
    const target = await fromUuid(uuid);
    if (target?.documentName === "Actor") {
      const currentStatus = target.system.subsystems[sysKey] || 0;
      if (level > currentStatus) {
        await target.update({ [`system.subsystems.${sysKey}`]: level });
        updateMsg = `<div style="color:#4f4; font-weight:bold; margin-top:5px; border-top:1px solid #555;">${loc} STATUS UPDATED</div>`;
      } else {
        updateMsg = `<div style="color:#eebb00; font-size:0.8em; margin-top:5px; border-top:1px solid #555;">(System already at equal/higher damage)</div>`;
      }
    }
  }

  const effect = level === 1 ? "System Damaged (50% Effectiveness)." : (level === 2 ? "System OFFLINE." : "System DESTROYED.");
  ChatMessage.create({ content: `<div class="ftrpg-chat-card"><div class="ftrpg-card-header header-red">SYSTEM HIT (LEVEL ${level})</div><div class="ftrpg-card-content"><div style="text-align:center; color:#f66; font-weight:bold;">${loc}</div><div style="text-align:center;">Roll: ${roll.total}</div><div style="font-size:0.8em; margin-top:5px; font-style:italic;">${effect}</div>${updateMsg}</div></div>` });
}

/** Resolve an auto-hit (no evasion attempted) proposed on the attacker's own "FIRE" chat card. */
async function onApplyAutoHit(event) {
  event.preventDefault();
  const btn = event.currentTarget;
  const target = await fromUuid(btn.dataset.targetUuid);
  if (!target) return ui.notifications.error("Target ship not found!");
  return applyAutoHit(target, {
    attackTotal: parseInt(btn.dataset.attackTotal),
    wr: parseInt(btn.dataset.wr),
    weaponType: btn.dataset.weaponType,
    maxTubes: parseInt(btn.dataset.maxTubes) || 1,
    tn: parseInt(btn.dataset.tn) || 0
  });
}

/** Reopen the GM's "Incoming Hit" dialog, pre-filled from a failed Evasive Action roll. */
async function onResolveNarrativeImpact(event) {
  const btn = event.currentTarget;
  const actor = await fromUuid(btn.dataset.uuid);
  if (!actor) return ui.notifications.error("Ship actor not found.");
  return rollIncomingHit(actor, {
    atn: parseInt(btn.dataset.atn) || 0,
    wr: parseInt(btn.dataset.wr) || 0,
    wtype: btn.dataset.wtype,
    defense: parseInt(btn.dataset.defense) || 0
  });
}

/** A Dexterity save against an exploding console, from a System Damage chat card. */
async function onRollReflexSave(event) {
  const btn = event.currentTarget;
  const actor = await fromUuid(btn.dataset.uuid);
  if (!actor) return;
  return rollReflexSave(actor, parseInt(btn.dataset.tn));
}
