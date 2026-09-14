/**
 * Bridge-station rolls and ship-to-ship combat for the starship sheet.
 * Ported from the original ftrpg.js `FarTrekShipSheet` — the math and chat-card
 * layout are unchanged.
 * @module ftrpg/dice/ship-rolls
 */

import FTRPG from "../config.mjs";
import * as Dialog from "./dialog.mjs";

/* -------------------------------------------- */
/*  Crew helpers                                */
/* -------------------------------------------- */

/**
 * Resolve the Actor assigned to a bridge station, if any.
 * @param {Actor} ship
 * @param {string} role  One of the FTRPG.shipCrewRoles keys.
 * @returns {Promise<Actor|null>}
 */
export async function getCrewActor(ship, role) {
  const uuid = ship.system.crew[role];
  if (!uuid) return null;
  return (await fromUuid(uuid)) ?? null;
}

/**
 * The highest rank among a crew actor's skills matching any of the given names.
 * @param {Actor|null} actor
 * @param {string[]} skillNames  Lower-cased skill names to match.
 * @returns {number}
 */
function crewSkillRank(actor, skillNames) {
  if (!actor) return 0;
  const item = actor.items.find(i => i.type === "skill" && skillNames.includes(i.name.toLowerCase()));
  return item ? Number(item.system.rank) || 0 : 0;
}

/** A crew member's name and skill rank, formatted for a dialog's read-only "Officer" field. */
function crewLabel(actor, rank) {
  return actor ? `${actor.name} (Rank ${rank})` : "None";
}

/* -------------------------------------------- */
/*  Science                                     */
/* -------------------------------------------- */

/** Sensor Scan: 3d6 + (subsystem-adjusted) sensor rating + Science officer's skill. */
export async function rollSensorScan(ship) {
  const sciActor = await getCrewActor(ship, "science");
  const sensors = ship.system.stats.sensors || 0;
  const sciSkill = crewSkillRank(sciActor, ["sensors", "space sciences", "physical sciences"]);
  const crewName = sciActor ? sciActor.name : "Unknown";

  const tn = await Dialog.promptSensorScan({ crewName, sensors, skill: sciSkill });
  if (tn === null) return;

  const sensorStatus = ship.system.subsystems.sensors || 0;
  let effectiveSensors = sensors;
  if (sensorStatus === 1) effectiveSensors = Math.floor(sensors / 2);
  if (sensorStatus >= 2) effectiveSensors = 0;

  const roll = new Roll("3d6 + @sensors + @skill", { sensors: effectiveSensors, skill: sciSkill });
  await roll.evaluate();
  const status = roll.total >= tn
    ? `<span style="color:#4f4; font-weight:bold;">CONTACT</span>`
    : `<span style="color:#f66; font-weight:bold;">NO READING</span>`;

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: ship }),
    content: `<div class="ftrpg-chat-card"><div class="ftrpg-card-header header-blue"><span>SENSORS</span><span style="font-size:0.7em">TN ${tn}</span></div><div class="ftrpg-card-content"><div style="text-align:center; font-size:1.2em; margin-bottom:5px;">Result: <strong>${roll.total}</strong></div><div style="text-align:center;">${status}</div>${sensorStatus > 0 ? `<div style="font-size:0.8em; color:#f88; text-align:center; margin-top:5px;">&#9888; Sensors at ${sensorStatus === 1 ? "50%" : "OFFLINE"}</div>` : ""}</div></div>`,
    rolls: [roll]
  });
}

/* -------------------------------------------- */
/*  Engineering                                 */
/* -------------------------------------------- */

/** "Worried Engineer": the assigned Engineer spends one of their own Fate points to force a reroll. */
export async function rollWorriedEngineer(ship) {
  const engActor = await getCrewActor(ship, "engineering");
  if (!engActor) return ui.notifications.error("No Engineer assigned!");
  const fate = engActor.system.fate?.value || 0;
  if (fate < 1) return ui.notifications.warn(`${engActor.name} has no Fate Points!`);
  await engActor.update({ "system.fate.value": fate - 1 });
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: engActor }),
    content: `<div class="ftrpg-chat-card"><div class="ftrpg-card-header header-blue">WORRIED ENGINEER</div><div class="ftrpg-card-content"><div style="font-style:italic; color:#aaa; margin-bottom:5px;">"I canna change the laws of physics... but I can bend them!"</div><div style="text-align:center; color:#ffcc00; font-weight:bold;">FATE SPENT &mdash; Force a reroll of last damage/effect.</div><div style="text-align:center; font-size:0.8em; margin-top:5px;">Remaining Fate: ${fate - 1}</div></div></div>`
  });
}

/** Route Energy: TN 10 check to grant +2 to Shields/Helm or Weapons this round. */
export async function rollRouteEnergy(ship) {
  const engActor = await getCrewActor(ship, "engineering");
  const eng = ship.system.stats.engineering || 0;
  const engSkill = crewSkillRank(engActor, ["engineering", "starship engineer"]);
  const crewName = crewLabel(engActor, engSkill);

  const target = await Dialog.promptRouteEnergy(crewName);
  if (!target) return;

  const roll = new Roll("3d6 + @skill + @eng", { skill: engSkill, eng });
  await roll.evaluate();
  const success = roll.total >= 10;
  const resultHTML = success
    ? `<div style="color:#4f4; font-weight:bold;">POWER ROUTED &mdash; +2 to ${target}</div>`
    : `<div style="color:#f66; font-weight:bold;">FAILURE</div>`;
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: ship }),
    content: `<div class="ftrpg-chat-card"><div class="ftrpg-card-header header-blue">ENGINEERING</div><div class="ftrpg-card-content"><div style="text-align:center; font-size:1.2em;">Roll: <b>${roll.total}</b></div>${resultHTML}</div></div>`,
    rolls: [roll]
  });
}

/** Jury-Rig: TN 17 check (+2 with the Jury Rig talent) to restore one level on a damaged subsystem. */
export async function rollJuryRig(ship) {
  const engActor = await getCrewActor(ship, "engineering");
  const eng = ship.system.stats.engineering || 0;
  const engSkill = crewSkillRank(engActor, ["engineering", "starship engineer"]);
  const crewName = crewLabel(engActor, engSkill);
  const hasJuryRig = engActor ? engActor.items.some(i => i.name.toLowerCase() === "jury rig") : false;

  const damaged = Object.entries(ship.system.subsystems)
    .filter(([, val]) => val > 0 && val < 3)
    .map(([key, level]) => ({ key, level }));
  if (!damaged.length) return ui.notifications.info("No damaged systems to repair!");

  const sysKey = await Dialog.promptJuryRig(damaged, { crewName, hasJuryRig });
  if (!sysKey) return;

  const bonus = hasJuryRig ? 2 : 0;
  const roll = new Roll("3d6 + @skill + @eng + @bonus", { skill: engSkill, eng, bonus });
  await roll.evaluate();
  const success = roll.total >= 17;
  const resultHTML = success
    ? `<div style="color:#4f4; font-weight:bold;">SUCCESS &mdash; ${sysKey.toUpperCase()} restored one level.</div>`
    : `<div style="color:#f66; font-weight:bold;">FAILURE</div>`;
  if (success) await ship.update({ [`system.subsystems.${sysKey}`]: ship.system.subsystems[sysKey] - 1 });
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: ship }),
    content: `<div class="ftrpg-chat-card"><div class="ftrpg-card-header header-blue">JURY RIG</div><div class="ftrpg-card-content"><div style="text-align:center; font-size:1.2em;">Roll: <b>${roll.total}</b></div>${resultHTML}</div></div>`,
    rolls: [roll]
  });
}

/* -------------------------------------------- */
/*  Helm                                        */
/* -------------------------------------------- */

/** Helm Station: choose between a standard maneuver and an evasive action. */
export async function rollHelmAction(ship) {
  const helmActor = await getCrewActor(ship, "helm");
  const pilotSkill = crewSkillRank(helmActor, ["starship navigation", "navigation", "helm", "pilot"]);
  const choice = await Dialog.promptHelmAction();
  if (choice === "maneuver") return rollShipManeuver(ship, pilotSkill);
  if (choice === "evasion") return rollEvasiveAction(ship, pilotSkill);
}

/** A standard Helm maneuver: 3d6 + Helm bonus + (subsystem-adjusted) Maneuver + pilot skill vs a TN. */
export async function rollShipManeuver(ship, pilotSkill) {
  const tn = await Dialog.promptShipManeuver();
  if (tn === null) return;

  const helm = ship.system.stats.helm || 0;
  const maneuver = ship.system.stats.maneuver || 0;
  const impulseStatus = ship.system.subsystems.impulse || 0;
  let finalMan = maneuver;
  if (impulseStatus === 1) finalMan = Math.floor(maneuver / 2);
  if (impulseStatus >= 2) finalMan = 0;

  const roll = new Roll("3d6 + @helm + @man + @skill", { helm, man: finalMan, skill: pilotSkill });
  await roll.evaluate();
  const status = roll.total >= tn
    ? `<span style="color:#4f4; font-weight:bold;">SUCCESS</span>`
    : `<span style="color:#f66; font-weight:bold;">FAILURE</span>`;
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: ship }),
    content: `<div class="ftrpg-chat-card"><div class="ftrpg-card-header header-gold"><span>NAVIGATION</span><span style="font-size:0.7em">TN ${tn}</span></div><div class="ftrpg-card-content"><div style="text-align:center; font-size:1.2em; margin-bottom:5px;">Result: <strong>${roll.total}</strong></div><div style="text-align:center;">${status}</div></div></div>`,
    rolls: [roll]
  });
}

/** Evasive Action: defend against an incoming attack; on a failed defense, offers to resolve the impact. */
export async function rollEvasiveAction(ship, pilotSkill) {
  const input = await Dialog.promptEvasiveAction();
  if (!input) return;
  const { atn, wr, wtype } = input;

  const helm = ship.system.stats.helm || 0;
  const maneuver = ship.system.stats.maneuver || 0;
  const impulseStatus = ship.system.subsystems.impulse || 0;
  let finalMan = maneuver;
  if (impulseStatus === 1) finalMan = Math.floor(maneuver / 2);
  if (impulseStatus >= 2) finalMan = 0;

  const roll = new Roll("3d6 + @helm + @man + @skill", { helm, man: finalMan, skill: pilotSkill });
  await roll.evaluate();
  const evaded = roll.total >= atn;
  const resultHTML = evaded
    ? `<div style="text-align:center; color:#4f4; font-weight:bold; font-size:1.2em;">EVADED!</div><div style="text-align:center; font-size:0.9em; margin-top:5px;">Defense ${roll.total} vs Attack ${atn}</div>`
    : `<div style="text-align:center; color:#f66; font-weight:bold; font-size:1.2em;">HIT!</div><div style="text-align:center; font-size:0.9em; margin-top:5px;">Defense ${roll.total} vs Attack ${atn}</div>`;
  const damageHTML = !evaded
    ? `<div style="margin-top:10px; border-top:1px dashed #555; padding-top:5px; text-align:center;"><button type="button" class="resolve-narrative-impact" data-uuid="${ship.uuid}" data-atn="${atn}" data-wr="${wr}" data-wtype="${wtype}" data-defense="${roll.total}" style="background:#550000; color:#fff; border:1px solid #aa0000; width:100%;">RESOLVE IMPACT (WR ${wr})</button></div>`
    : "";

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: ship }),
    content: `<div class="ftrpg-chat-card"><div class="ftrpg-card-header header-blue">EVASION RESULT</div><div class="ftrpg-card-content">${resultHTML}${damageHTML}</div></div>`,
    rolls: [roll]
  });
}

/* -------------------------------------------- */
/*  Weapons                                     */
/* -------------------------------------------- */

/**
 * Fire Weapons from a specific station (Helm fires Phasers, Navigation fires Torpedoes).
 * @param {Actor} ship
 * @param {"phasers"|"torps"} weaponType
 */
export async function rollShipFire(ship, weaponType) {
  const subsystems = ship.system.subsystems;
  const status = subsystems[weaponType] || 0;
  if (status >= 2) return ui.notifications.error(`${weaponType.toUpperCase()} OFFLINE!`);

  const isTorps = weaponType === "torps";
  const helmActor = await getCrewActor(ship, "helm");
  const navActor = await getCrewActor(ship, "navigation");
  const helmSkill = crewSkillRank(helmActor, ["starship combat", "gunnery", "phasers"]);
  const navSkill = crewSkillRank(navActor, ["starship combat", "gunnery", "torpedoes"]);
  const skill = isTorps ? navSkill : helmSkill;
  const crewName = isTorps ? crewLabel(navActor, navSkill) : crewLabel(helmActor, helmSkill);

  const shipTactical = ship.system.stats.tactical || 0;
  const torpDamage = Number(ship.system.stats.torpedo_damage) || 4;
  const defaultWr = isTorps ? torpDamage : shipTactical;

  const input = await Dialog.promptShipFire(weaponType, { wr: defaultWr, crewName });
  if (!input) return;
  let { wr, rangeTN, maxTubes } = input;

  if (isTorps) {
    if (rangeTN < 14) return ui.notifications.warn("Torpedoes require Long range or greater (TN 14+).");
    const ammo = ship.system.ammo?.torpedoes?.value || 0;
    if (ammo < maxTubes) return ui.notifications.warn(`Insufficient torpedoes! (${ammo} remaining)`);
    await ship.update({ "system.ammo.torpedoes.value": ammo - maxTubes });
  }

  if (status === 1) {
    wr = Math.floor(wr / 2);
    ui.notifications.warn(`${weaponType.toUpperCase()} damaged: WR halved to ${wr}.`);
  }

  const targets = Array.from(game.user.targets);
  const target = targets[0]?.actor ?? null;

  const attackRoll = new Roll("3d6 + @skill + @tactical", { skill, tactical: shipTactical });
  await attackRoll.evaluate();
  const displayType = isTorps ? "TORPEDOES" : "PHASERS";

  if (attackRoll.total < rangeTN) {
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: ship }),
      content: `<div class="ftrpg-chat-card"><div class="ftrpg-card-header header-red"><span>${displayType}</span><span style="font-size:0.7em">TN ${rangeTN}</span></div><div class="ftrpg-card-content"><div style="text-align:center; font-size:1.1em; margin-bottom:5px; color:#f66; font-weight:bold;">MISSED</div><div style="text-align:center;">Roll: <strong>${attackRoll.total}</strong> vs TN <strong>${rangeTN}</strong></div></div></div>`,
      rolls: [attackRoll]
    });
    return;
  }

  const hitContent = target
    ? `<div class="ftrpg-chat-card"><div class="ftrpg-card-header header-red"><span>${displayType}</span><span style="font-size:0.7em">ATTACK</span></div><div class="ftrpg-card-content"><div style="text-align:center; font-size:1.1em; margin-bottom:5px;">Firing on <strong>${target.name}</strong></div><div style="text-align:center; margin-bottom:10px;">Attack Total: <span style="font-weight:bold; color:#ffcc00; font-size:1.2em;">${attackRoll.total}</span></div><div style="text-align:center; background:#440000; color:#ffcc00; font-weight:bold; font-size:1.2em; border:1px solid #ffcc00; padding:5px; margin:5px 0;">WR: ${wr}</div><button type="button" class="apply-auto-hit" data-attack-total="${attackRoll.total}" data-wr="${wr}" data-max-tubes="${maxTubes}" data-weapon-type="${weaponType}" data-target-uuid="${target.uuid}" data-attacker-uuid="${ship.uuid}" data-tn="${rangeTN}" style="background:#550000; color:#fff; border:1px solid #aa0000; width:100%;">NO EVASION &mdash; TAKE HIT</button></div></div>`
    : `<div class="ftrpg-chat-card"><div class="ftrpg-card-header header-red"><span>${displayType}</span><span style="font-size:0.7em">HIT</span></div><div class="ftrpg-card-content"><div style="text-align:center; margin-bottom:5px;">Attack: <b>${attackRoll.total}</b> <span style="color:#4f4;">(HIT)</span></div><div style="text-align:center; background:#440000; color:#ffcc00; font-weight:bold; font-size:1.2em; border:1px solid #ffcc00; padding:5px;">WR: ${wr}</div><div style="text-align:center; color:#aaa; font-style:italic; font-size:0.8em; margin-top:5px;">No target selected &mdash; apply manually.</div></div></div>`;
  ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: ship }), content: hitContent, rolls: [attackRoll] });
}

/* -------------------------------------------- */
/*  Damage resolution                           */
/* -------------------------------------------- */

/**
 * The shared per-hit impact loop: shield drain, effect roll, and (on a strong
 * enough effect) a subsystem hit-location roll. `autoApply` mirrors the two
 * entry points in the original system: the GM's manual "Incoming Hit" dialog
 * commits shield/subsystem damage immediately, while the attacker's "NO EVASION"
 * chat button only proposes it via follow-up buttons for the target's owner to confirm.
 * @param {Actor} target
 * @param {number} numHits
 * @param {number} wr
 * @param {boolean} autoApply
 * @returns {Promise<string>} The assembled per-hit damage log HTML.
 */
async function resolveImpactHits(target, numHits, wr, autoApply) {
  let damageLog = "";
  let currentShieldVal = target.system.health.shields.value;
  const sMax = target.system.health.shields.max || 100;
  const shieldStatus = target.system.subsystems.shields || 0;
  let shieldsUp = target.system.health.shields.active && currentShieldVal > 0 && shieldStatus < 2;
  const baseSR = target.system.stats.sr || 0;

  for (let i = 0; i < numHits; i++) {
    let drain = 0, sr = 0, shieldMsg = "";
    if (shieldsUp) {
      const drainRoll = new Roll("1d6 * 5");
      await drainRoll.evaluate();
      drain = drainRoll.total;
      const sPct = Math.round((currentShieldVal / sMax) * 100);
      const penalty = Math.floor((100 - sPct) / 25);
      let eSR = Math.max(0, baseSR - penalty);
      if (shieldStatus === 1) eSR = Math.floor(eSR / 2);
      sr = eSR;
      shieldMsg = autoApply
        ? `<div style="color:#6cf; font-size:0.8em;">Shields: -${drain}%</div>`
        : `<span style="color:#6cf; font-size:0.8em;">Shields -${drain}%</span>`;
    } else {
      shieldMsg = autoApply
        ? `<div style="color:#ff4444; font-size:0.8em; font-weight:bold;">DIRECT HULL IMPACT</div>`
        : `<span style="color:#ff4444; font-size:0.8em;">HULL HIT</span>`;
    }

    const effectRoll = new Roll("3d6 + @wr - @sr", { wr, sr });
    await effectRoll.evaluate();
    const effect = effectRoll.total;

    let sysHitDesc = "", sysLabel = "", applyBtn = "";
    if (effect >= 10) {
      const locRoll = new Roll("1d6");
      await locRoll.evaluate();
      const sysKeys = FTRPG.shipSystems;
      const hitKey = sysKeys[locRoll.total - 1];
      const hitLevel = effect >= 18 ? 3 : effect >= 15 ? 2 : 1;

      if (autoApply) {
        sysHitDesc = ` | <strong>${FTRPG.shipSystemLabels[hitKey]} HIT</strong>`;
        const curStatus = target.system.subsystems[hitKey] || 0;
        if (hitLevel > curStatus) {
          await target.update({ [`system.subsystems.${hitKey}`]: hitLevel });
          if (hitLevel >= 2 && hitKey === "shields") {
            await target.update({ "system.health.shields.active": false });
            shieldsUp = false;
          }
        }
      } else {
        sysLabel = FTRPG.shipSystemLabels[hitKey];
        const btnColor = hitLevel === 1 ? "#664400" : "#aa0000";
        applyBtn = `<button type="button" class="roll-system-damage-context" data-level="${hitLevel}" data-uuid="${target.uuid}" data-sys="${hitKey}" style="font-size:0.7em; background:${btnColor}; width:100%; margin-top:3px;">APPLY ${hitLevel === 3 ? "CRIT" : hitLevel === 2 ? "HIT" : "GRAZE"}</button>`;
      }
    }

    const severity = effect >= 18 ? "CRITICAL" : effect >= 15 ? "DIRECT HIT" : effect >= 10 ? "GRAZE" : "SHIELD HIT";
    const severityHTML = autoApply
      ? severity
      : (effect >= 18 ? `<span style="color:#cc0000; font-weight:bold;">CRITICAL (DL 3)</span>`
        : effect >= 15 ? `<span style="color:#ff6600; font-weight:bold;">DIRECT HIT (DL 2)</span>`
        : effect >= 10 ? `<span style="color:#eebb00; font-weight:bold;">GRAZE (DL 1)</span>`
        : `<span style="color:#6cf;">SHIELD HIT</span>`);

    if (drain > 0) {
      const newSVal = Math.max(0, currentShieldVal - drain);
      currentShieldVal = newSVal;
      await target.update({ "system.health.shields.value": newSVal });
      if (newSVal <= 0) {
        await target.update({ "system.health.shields.active": false });
        shieldsUp = false;
        shieldMsg += autoApply
          ? `<div style="color:#ff0000; font-size:0.7em;">SHIELDS COLLAPSED</div>`
          : ` <span style="color:#f00; font-size:0.7em;">COLLAPSED</span>`;
      }
    }

    if (autoApply) {
      damageLog += `<div style="border-top:1px dashed #555; margin-top:5px; font-size:0.9em; padding:3px;"><div>Impact ${i + 1}: Effect ${effect} (${severityHTML})${sysHitDesc}</div>${shieldMsg}</div>`;
    } else {
      damageLog += `<div style="margin-top:8px; padding-top:5px; border-top:1px dashed #555;"><div style="display:flex; justify-content:space-between;"><span style="font-weight:bold; color:#ffcc00;">IMPACT #${i + 1}</span><span>Effect: <strong>${effect}</strong></span></div><div style="font-size:0.9em; text-align:right;">${severityHTML}</div>${sysLabel ? `<div style="font-size:0.8em; text-align:right;">Location: ${sysLabel}</div>` : ""}<div style="background:#002233; padding:3px; margin-top:3px; border-radius:3px; display:flex; justify-content:space-between; align-items:center;">${shieldMsg}<button type="button" class="apply-ship-damage" data-uuid="${target.uuid}" data-value="${drain}" style="font-size:0.7em; padding:1px 5px; height:auto; line-height:normal;">APPLY</button></div>${applyBtn}</div>`;
    }
  }
  return damageLog;
}

/**
 * GM-side "Incoming Hit": manually enter the attacker's total/WR/weapon type
 * (and, if evaded, the defender's roll) and immediately apply the resulting damage.
 * @param {Actor} ship
 * @param {{atn?: number, wr?: number, wtype?: string, defense?: number}} [defaults]
 */
export async function rollIncomingHit(ship, defaults = {}) {
  const input = await Dialog.promptIncomingHit(defaults);
  if (!input) return;
  const { atn, wr, defense, wtype, maxVolley } = input;

  let numHits = 1;
  if (wtype === "torps") {
    const margin = Math.max(0, atn - defense);
    numHits = Math.min(maxVolley, 1 + Math.floor(margin / 3));
  }

  const damageLog = await resolveImpactHits(ship, numHits, wr, true);
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: ship }),
    content: `<div class="ftrpg-chat-card"><div class="ftrpg-card-header header-red">IMPACT REPORT</div><div class="ftrpg-card-content">${damageLog}</div></div>`
  });
}

/**
 * Auto-hit resolution from an attacker's "NO EVASION — TAKE HIT" chat button:
 * proposes (rather than immediately applies) shield/subsystem damage for the
 * target's owner to confirm via follow-up buttons.
 * @param {Actor} target
 * @param {{attackTotal: number, wr: number, weaponType: string, maxTubes: number, tn: number}} data
 */
export async function applyAutoHit(target, { attackTotal, wr, weaponType, maxTubes, tn }) {
  let numHits = 1;
  if (weaponType === "torps") {
    const margin = Math.max(0, attackTotal - tn);
    numHits = Math.min(maxTubes, 1 + Math.floor(margin / 3));
  }
  const damageHTML = await resolveImpactHits(target, numHits, wr, false);
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: target }),
    content: `<div class="ftrpg-chat-card"><div class="ftrpg-card-header header-red"><span>DIRECT HIT</span><span style="font-size:0.7em">NO EVASION</span></div><div class="ftrpg-card-content"><div style="text-align:center; font-size:1.1em; margin-bottom:5px;"><strong>${target.name}</strong></div>${damageHTML}</div></div>`
  });
}

/* -------------------------------------------- */
/*  System status                               */
/* -------------------------------------------- */

/** Cycle a subsystem's damage level: OK -> DMG -> OFFLINE -> DESTROYED -> OK. */
export async function toggleSystemStatus(ship, sysName) {
  const current = ship.system.subsystems[sysName] || 0;
  const next = current + 1 > 3 ? 0 : current + 1;
  await ship.update({ [`system.subsystems.${sysName}`]: next });
}

/** "System Damage": pick a severity, hit a random subsystem, and (on a bad hit) prompt a console-hazard reflex save. */
export async function rollSystemDamage(ship) {
  const level = await Dialog.promptSeverity();
  if (!level) return;
  return processSystemHit(ship, level);
}

/**
 * Apply a system-damage severity to a randomly rolled subsystem. Level 2+ hits
 * threaten whichever crew member is staffing that station with a console overload.
 * @param {Actor} ship
 * @param {number} level  1 (damaged), 2 (offline), or 3 (destroyed).
 */
export async function processSystemHit(ship, level) {
  const roll = new Roll("1d6");
  await roll.evaluate();
  const index = roll.total - 1;
  const sysKey = FTRPG.shipSystems[index];
  const loc = FTRPG.shipSystemLabels[sysKey];
  const roleKey = FTRPG.shipSystemCrewRole[sysKey];

  const current = ship.system.subsystems[sysKey] || 0;
  if (level > current) await ship.update({ [`system.subsystems.${sysKey}`]: level });

  const effect = level === 1 ? "System Damaged (50% Effectiveness)." : level === 2 ? "System OFFLINE." : "System DESTROYED.";

  let hazardHtml = "";
  if (level >= 2) {
    const crewActor = await getCrewActor(ship, roleKey);
    if (crewActor) {
      const tn = level === 2 ? 17 : 20;
      hazardHtml = `<div style="border-top:1px solid #f00; margin-top:5px; padding-top:5px;"><div style="color:#ffcc00; font-weight:bold;">&#9888;&#65039; CONSOLE OVERLOAD</div><div style="font-size:0.8em;">${crewActor.name} at ${loc}</div><button type="button" class="roll-reflex-save" data-uuid="${crewActor.uuid}" data-tn="${tn}" style="background:#aa0000; color:#fff; font-size:0.8em; margin-top:3px; width:100%;">REFLEX SAVE (TN ${tn})</button></div>`;
    }
  }

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: ship }),
    content: `<div class="ftrpg-chat-card"><div class="ftrpg-card-header header-red">SYSTEM DAMAGE</div><div class="ftrpg-card-content"><div style="text-align:center; color:#f66; font-weight:bold;">${loc}</div><div style="text-align:center;">Level ${level} damage applied.</div><div style="font-size:0.8em; margin-top:5px; font-style:italic;">${effect}</div>${hazardHtml}</div></div>`
  });
}

/** Roll incidental casualties (1d6 - 2, floored at 0). */
export async function rollCasualties(ship) {
  const roll = new Roll("1d6");
  await roll.evaluate();
  const c = Math.max(0, roll.total - 2);
  ChatMessage.create({ content: `Casualties: ${c > 0 ? c + " injured/lost" : "None."}.`, speaker: ChatMessage.getSpeaker({ actor: ship }) });
}

/** Toggle shields up/down (blocked while the shield generator is offline). */
export async function toggleShields(ship) {
  const active = ship.system.health.shields.active;
  const shieldStatus = ship.system.subsystems.shields || 0;
  if (!active && shieldStatus >= 2) return ui.notifications.error("Shield Generator OFFLINE! Repair required.");
  await ship.update({ "system.health.shields.active": !active });
}

/** A Dexterity save against an exploding console, triggered from a system-damage chat card. */
export async function rollReflexSave(actor, tn) {
  const dx = actor.system.attributes?.dx?.value ?? 0;
  const roll = new Roll("3d6 + @dx", { dx });
  await roll.evaluate();
  const result = roll.total >= tn
    ? `<span style="color:#4f4;">SUCCESS (No Damage)</span>`
    : `<span style="color:#f66;">FAILURE (Take Damage)</span>`;
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="ftrpg-chat-card"><div class="ftrpg-card-header header-red">REFLEX SAVE (TN ${tn})</div><div class="ftrpg-card-content"><div style="text-align:center; font-size:1.2em;">Result: <b>${roll.total}</b></div><div style="text-align:center;">${result}</div></div></div>`,
    rolls: [roll]
  });
}
