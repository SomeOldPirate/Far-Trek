/**
 * Far Trek RPG System Logic
 * Master File: Characters, Ships, NPCs, Automation
 * Fixed: System Damage Auto-Application via Chat Buttons
 */

// --- 0. DATA MODELS ---
const { SchemaField, NumberField, StringField, BooleanField } = foundry.data.fields;

export class ShipDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      stats: new SchemaField({
        scale: new NumberField({ required: true, initial: 1, integer: true, min: 1, max: 10 }),
        tactical: new NumberField({ required: true, initial: 0, integer: true }),
        engineering: new NumberField({ required: true, initial: 0, integer: true }),
        helm: new NumberField({ required: true, initial: 0, integer: true }),
        sensors: new NumberField({ required: true, initial: 0, integer: true }),
        notes: new StringField({ required: false, initial: "" })
      }),
      subsystems: new SchemaField({
        shields: new NumberField({ required: true, initial: 0, integer: true, min: 0, max: 3 }),
        impulse: new NumberField({ required: true, initial: 0, integer: true, min: 0, max: 3 }),
        warp: new NumberField({ required: true, initial: 0, integer: true, min: 0, max: 3 }),
        phasers: new NumberField({ required: true, initial: 0, integer: true, min: 0, max: 3 }),
        torps: new NumberField({ required: true, initial: 0, integer: true, min: 0, max: 3 }),
        sensors: new NumberField({ required: true, initial: 0, integer: true, min: 0, max: 3 })
      }),
      health: new SchemaField({
        structure: new SchemaField({
          value: new NumberField({ required: true, initial: 20, integer: true }),
          max: new NumberField({ required: true, initial: 20, integer: true }),
          threshold: new NumberField({ required: true, initial: 5, integer: true })
        }),
        shields: new SchemaField({
          value: new NumberField({ required: true, initial: 100, integer: true }),
          max: new NumberField({ required: true, initial: 100, integer: true }),
          active: new BooleanField({ initial: true })
        }),
        power: new SchemaField({
          value: new NumberField({ required: true, initial: 10, integer: true }),
          max: new NumberField({ required: true, initial: 10, integer: true })
        })
      })
    };
  }
}

// --- 1. ITEM DATA MODEL ---
export class FarTrekItem extends Item {
  prepareDerivedData() {
    super.prepareDerivedData();
    const s = this.system ?? {};
    if (this.type === "skill") { s.rank = Number(s.rank ?? 0); s.attribute = String(s.attribute ?? "iq"); }
    if (this.type === "weapon") { 
        s.weaponTN = Number(s.weaponTN ?? 5); 
        s.attackAttribute = String(s.attackAttribute ?? "dx"); 
        s.attackSkillName = String(s.attackSkillName ?? "Marksmanship"); 
        s.hasStun = Boolean(s.hasStun ?? false); 
        s.range = String(s.range ?? "Close");
        s.notes = String(s.notes ?? ""); 
    }
    if (this.type === "talent") {
        s.modType = String(s.modType ?? "none"); 
        s.modTarget = String(s.modTarget ?? ""); 
        s.modValue = Number(s.modValue ?? 0);
        s.isActive = Boolean(s.isActive ?? true);
        s.notes = String(s.notes ?? "");
    }
    if (this.type === "equipment") { s.notes = String(s.notes ?? ""); }
  }
}

// --- 2. ITEM SHEET ---
class FarTrekItemSheet extends ItemSheet {
  static get defaultOptions() { 
      return foundry.utils.mergeObject(super.defaultOptions, { 
          classes: ["ftrpg", "sheet", "item"], template: "systems/ftrpg/item-sheet.html", width: 500, height: 450 
      }); 
  }
  async getData() { 
      const context = await super.getData(); 
      context.system = this.item.system; 
      context.config = { 
          attributes: { "st": "Strength", "dx": "Dexterity", "iq": "Intelligence", "ca": "Charisma" },
          modTypes: { "none": "None", "skill": "Skill Roll", "attack": "Attack Roll", "init": "Initiative", "attr": "Attribute" }
      };
      return context; 
  }
}

// --- 3. CHARACTER SHEET ---
export class FarTrekActorSheet extends ActorSheet {
  static get defaultOptions() { 
      return foundry.utils.mergeObject(super.defaultOptions, { 
          classes: ["ftrpg", "sheet", "actor"], template: "systems/ftrpg/actor-sheet.html", width: 600, height: 700, 
          tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "main" }] 
      }); 
  }
  
  async getData() {
    const context = await super.getData();
    context.system = this.actor.system;
    
    if (!context.system.attributes) context.system.attributes = { st: {value: 0}, dx: {value: 0}, iq: {value: 0}, ca: {value: 0} };

    const talents = context.items.filter(i => i.type === 'talent' && i.system.isActive && i.system.modType === 'attr');
    for (let t of talents) {
        let attr = t.system.modTarget.toLowerCase();
        if (context.system.attributes[attr]) {
            context.system.attributes[attr].value += t.system.modValue;
        }
    }

    const processWeapons = (items) => {
        return items.filter(i => i.type === 'weapon').map(w => {
            if (w.system.hasStun) {
                w.showStunToggle = true;
                w.phaserMode = w.flags.ftrpg?.phaserMode || "stun"; 
            }
            return w;
        });
    };

    context.weapons = processWeapons(context.items);
    context.skills = context.items.filter(i => i.type === 'skill');
    context.talents = context.items.filter(i => i.type === 'talent');
    context.equipment = context.items.filter(i => i.type === 'equipment');
    
    const className = context.system.details?.class?.value?.toLowerCase().trim() || "";
    let borderClass = "border-civilian"; 
    if (className.includes("red")) borderClass = "border-red";
    else if (className.includes("blue")) borderClass = "border-blue";
    else if (className.includes("gold")) borderClass = "border-gold";
    context.borderClass = borderClass;
    
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find('.rollable').click(this._onRoll.bind(this));
    html.find('.roll-survival').click(this._onSurvivalRoll.bind(this));
    html.find('.roll-init').click(this._onInitRoll.bind(this));
    html.find('.item-create').click(async ev => await Item.create({ name: `New ${ev.currentTarget.dataset.type.capitalize()}`, type: ev.currentTarget.dataset.type }, { parent: this.actor }));
    html.find('.item-delete').click(ev => { const li = $(ev.currentTarget).closest("[data-item-id]"); if (li.length) this.actor.deleteEmbeddedDocuments("Item", [li.attr("data-item-id")]); });
    html.find('.item-edit').click(ev => { const li = $(ev.currentTarget).closest("[data-item-id]"); if (li.length) this.actor.items.get(li.attr("data-item-id")).sheet.render(true); });
    html.find('.item-roll').click(this._onItemRoll.bind(this));
    html.find('.phaser-mode').click(this._onPhaserToggle.bind(this));
  }

  _getTalentBonus(type, target = "") {
      const talents = this.actor.items.filter(i => i.type === "talent" && i.system.isActive);
      let bonus = 0;
      for (let t of talents) {
          const s = t.system;
          if (s.modType === type) {
              if (target === "" || s.modTarget.toLowerCase() === target.toLowerCase() || s.modTarget === "all") {
                  bonus += s.modValue;
              }
          }
      }
      return bonus;
  }

  async _onPhaserToggle(event) {
    event.preventDefault(); event.stopPropagation();
    const btn = $(event.currentTarget);
    const li = btn.closest("[data-item-id]");
    if (!li.length) return;
    const item = this.actor.items.get(li.attr("data-item-id"));
    if (!item) return;
    const currentMode = item.getFlag("ftrpg", "phaserMode") || "stun";
    if (currentMode === "stun") { await item.setFlag("ftrpg", "phaserMode", "heavy"); await item.update({ "system.weaponTN": 17 }); ui.notifications.info(`${item.name} set to HEAVY STUN (TN 17)`); } 
    else if (currentMode === "heavy") { await item.setFlag("ftrpg", "phaserMode", "kill"); await item.update({ "system.weaponTN": 20 }); ui.notifications.warn(`${item.name} set to KILL (TN 20)`); } 
    else { await item.setFlag("ftrpg", "phaserMode", "stun"); await item.update({ "system.weaponTN": 14 }); ui.notifications.info(`${item.name} set to STUN (TN 14)`); }
  }

  _getFateButtonHTML(label, formula) {
      const fate = this.actor.system.resources?.fate?.value || 0;
      if (fate > 0) return `<button class="fate-reroll" data-actor-uuid="${this.actor.uuid}" data-label="${label}" data-formula="${formula}"><i class="fas fa-dice"></i> SPEND FATE (REROLL)</button>`;
      return "";
  }

  async _onInitRoll(event) {
    event.preventDefault();
    const dx = Number(this.actor.system.attributes?.dx?.value) || 0;
    const talentBonus = this._getTalentBonus("init");
    let roll = new Roll("3d6 + @dx + @talent", { dx: dx, talent: talentBonus });
    await roll.evaluate();
    if (game.combat) { const c = game.combat.combatants.find(c => c.actorId === this.actor.id); if (c) await game.combat.setInitiative(c.id, roll.total); }
    let flavor = talentBonus !== 0 ? `<div style="font-size:0.8em; color:#eebb00;">(Includes +${talentBonus} from Talents)</div>` : "";
    const fateBtn = this._getFateButtonHTML("Initiative", `3d6 + ${dx} + ${talentBonus}`);
    let content = `<div class="ftrpg-chat-card"><div class="ftrpg-card-header header-gold"><span>Initiative</span><span style="font-size:0.7em">COMBAT</span></div><div class="ftrpg-card-content"><div style="text-align:center; margin-bottom:5px;"><span class="ftrpg-card-label">DEXTERITY (${dx}) + 3d6</span></div><div class="ftrpg-card-result">${roll.total}</div>${flavor}<div class="ftrpg-card-alert" style="background-color:#333; color:#eebb00; border-color:#eebb00;">READY FOR ACTION</div>${fateBtn}</div></div>`;
    roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: content });
  }

  async _onItemRoll(event) {
    event.preventDefault();
    const li = $(event.currentTarget).closest("[data-item-id]");
    if (!li.length) return ui.notifications.error("Item ID not found.");
    const item = this.actor.items.get(li.attr("data-item-id"));
    if (!item) return ui.notifications.error("Item not found.");
    
    if (item.type === "talent") {
        let content = `<div class="ftrpg-chat-card"><div class="ftrpg-card-header header-blue"><span>${item.name}</span><span style="font-size:0.7em">TALENT</span></div><div class="ftrpg-card-content" style="text-align:left;">${item.system.description || item.system.notes || "No description provided."}</div></div>`;
        return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: content });
    }

    new Dialog({ title: `Roll ${item.name}`, content: `<form><div class="form-group"><label>Situational Modifier</label><input type="number" name="modifier" value="0" autofocus/></div></form>`, buttons: { roll: { label: "ENGAGE", callback: async (html) => {
        const mod = Number(html.find('[name="modifier"]').val()) || 0; 
        if (item.type === "weapon") {
            const attrKey = item.system.attackAttribute || "dx";
            const attrValue = Number(this.actor.system.attributes?.[attrKey]?.value) || 0;
            const skillName = item.system.attackSkillName.toLowerCase();
            const skillItem = this.actor.items.find(i => i.type === "skill" && i.name.toLowerCase() === skillName);
            const skillRank = skillItem ? Number(skillItem.system.rank) : 0;
            let defenseStat = (attrKey === "dx") ? "DEXTERITY" : "STRENGTH";
            let talentBonus = this._getTalentBonus("attack", "all");
            const range = item.system.range?.toLowerCase() || "";
            if (range.includes("close") || range.includes("melee")) talentBonus += this._getTalentBonus("attack", "melee");
            else talentBonus += this._getTalentBonus("attack", "ranged");
            let roll = new Roll("3d6 + @attr + @skill + @talent + @mod", { attr: attrValue, skill: skillRank, talent: talentBonus, mod: mod });
            await roll.evaluate();
            const fateBtn = this._getFateButtonHTML(item.name, `3d6 + ${attrValue} + ${skillRank} + ${talentBonus} + ${mod}`);
            let talentText = talentBonus !== 0 ? `<div style="text-align:center; margin-bottom:2px;"><span class="ftrpg-card-label" style="color:#eebb00;">TALENT BONUS:</span> ${talentBonus > 0 ? "+"+talentBonus : talentBonus}</div>` : "";
            let modeText = "";
            if (item.system.hasStun) {
                const mode = item.getFlag("ftrpg", "phaserMode") || "stun";
                if (mode === "kill") modeText = `<div style="color:#ff4444; font-size:0.8em; font-weight:bold; margin-top:5px;">SETTING: KILL (TN 20)</div>`;
                else if (mode === "heavy") modeText = `<div style="color:#ffaa00; font-size:0.8em; font-weight:bold; margin-top:5px;">SETTING: HEAVY STUN (TN 17)</div>`;
                else modeText = `<div style="color:#44ff44; font-size:0.8em; font-weight:bold; margin-top:5px;">SETTING: STUN (TN 14)</div>`;
            }
            let content = `<div class="ftrpg-chat-card"><div class="ftrpg-card-header header-red"><span>${item.name}</span><span style="font-size:0.7em">ATTACK</span></div><div class="ftrpg-card-content"><div style="display:flex; justify-content:space-between; margin-bottom:5px;"><div><span class="ftrpg-card-label">ATTR:</span> ${attrKey.toUpperCase()} (${attrValue})</div><div><span class="ftrpg-card-label">SKILL:</span> ${skillRank}</div></div>${talentText}<div style="text-align:center; margin-bottom:5px;"><span class="ftrpg-card-label">MODIFIER:</span> ${mod}</div><div class="ftrpg-card-result">${roll.total}</div><div class="ftrpg-card-alert" style="text-align:left;"><div style="border-bottom:1px solid #555; padding-bottom:5px; margin-bottom:5px;"><div class="ftrpg-card-label" style="color:#aaa;">TO AVOID HIT:</div><div style="color:#fff;">Target rolls <strong>${defenseStat}</strong> vs</div><div style="font-size: 1.2em; font-weight: bold; color: #fff;">TN ${roll.total}</div></div><div><div class="ftrpg-card-label" style="color:#aaa;">IF DAMAGE TAKEN:</div><div style="color:#fff;">Consciousness Check</div><div style="font-size: 0.9em;">Roll <strong>STRENGTH</strong> vs TN ${item.system.weaponTN} (+Wounds)</div></div>${modeText}</div>${fateBtn}</div></div>`;
            roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: content });
        } else if (item.type === "skill") {
            const attrKey = item.system.attribute || "iq";
            const attrValue = Number(this.actor.system.attributes?.[attrKey]?.value) || 0;
            const rank = Number(item.system.rank) || 0;
            const talentBonus = this._getTalentBonus("skill", item.name);
            let roll = new Roll("3d6 + @attr + @rank + @talent + @mod", { attr: attrValue, rank: rank, talent: talentBonus, mod: mod });
            await roll.evaluate();
            const fateBtn = this._getFateButtonHTML(item.name, `3d6 + ${attrValue} + ${rank} + ${talentBonus} + ${mod}`);
            let talentText = talentBonus !== 0 ? `<div style="text-align:center; margin-bottom:2px;"><span class="ftrpg-card-label" style="color:#eebb00;">TALENT BONUS:</span> ${talentBonus > 0 ? "+"+talentBonus : talentBonus}</div>` : "";
            let content = `<div class="ftrpg-chat-card"><div class="ftrpg-card-header header-gold"><span>${item.name}</span><span style="font-size:0.7em">SKILL</span></div><div class="ftrpg-card-content"><div style="text-align:center; margin-bottom:5px;"><span class="ftrpg-card-label">${attrKey.toUpperCase()} (${attrValue}) + RANK (${rank}) + MOD (${mod})</span></div>${talentText}<div class="ftrpg-card-result">${roll.total}</div>${fateBtn}</div></div>`;
            roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: content});
        }
    }}}}, { classes: ["ftrpg-dialog"], width: 300 }).render(true);
  }

  async _onRoll(event) {
    event.preventDefault();
    const label = event.currentTarget.dataset.label;
    const key = event.currentTarget.dataset.key;
    const attrValue = Number(this.actor.system.attributes?.[key]?.value) || 0;
    new Dialog({ title: `${label} Test`, content: `<form><div class="form-group"><label>Situational Modifier</label><input type="number" name="modifier" value="0" autofocus/></div></form>`, buttons: { roll: { label: "ENGAGE", callback: async (html) => {
        const mod = Number(html.find('[name="modifier"]').val()) || 0;
        let roll = new Roll(`3d6 + @attr + @mod`, { attr: attrValue, mod: mod });
        await roll.evaluate();
        const fateBtn = this._getFateButtonHTML(label, `3d6 + ${attrValue} + ${mod}`);
        let content = `<div class="ftrpg-chat-card"><div class="ftrpg-card-header header-blue"><span>${label}</span><span style="font-size:0.7em">TEST</span></div><div class="ftrpg-card-content"><div style="text-align:center; margin-bottom:5px;"><span class="ftrpg-card-label">BASE (${attrValue}) + MOD (${mod}) + 3d6</span></div><div class="ftrpg-card-result">${roll.total}</div>${fateBtn}</div></div>`;
        roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: content });
    }}}}, { classes: ["ftrpg-dialog"], width: 300 }).render(true);
  }

  async _onSurvivalRoll(event) {
    event.preventDefault();
    const wounds = Number(this.actor.system.wounds?.value) || 0;
    const weaponOptions = `
        <option value="5">Fist / Unarmed (TN 5)</option>
        <option value="8">Knife / Dagger (TN 8)</option>
        <option value="11">Pistol / Club (TN 11)</option>
        <option value="14">Rifle / Phaser Stun (TN 14)</option>
        <option value="17">Heavy Stun (TN 17)</option>
        <option value="20">Phaser Kill / Disruptor (TN 20)</option>
    `;
    new Dialog({
      title: "Consciousness Check",
      content: `<form><div class="form-group"><label>Weapon that hit you?</label><select name="weapon-tn">${weaponOptions}</select></div><div class="form-group"><label>Modifier</label><input type="number" name="modifier" value="0"/></div><p style="text-align:center; font-size:0.8em; color:#888;">Current Wounds: <b>${wounds}</b> (+${wounds*3} to TN)</p></form>`,
      buttons: { roll: { label: "ROLL", callback: async (html) => {
            const weaponTN = parseInt(html.find('[name="weapon-tn"]').val());
            const mod = Number(html.find('[name="modifier"]').val()) || 0;
            const st = Number(this.actor.system.attributes?.st?.value) || 0;
            const armor = Number(this.actor.system.armor?.value) || 0;
            const targetTN = weaponTN + (wounds * 3);
            let roll = new Roll(`3d6 + @st + @armor + @mod`, { st: st, armor: armor, mod: mod });
            await roll.evaluate();
            const success = roll.total >= targetTN;
            let resultHTML = success ? `<div style="color:#6f6; font-weight:bold; margin-top:10px;">STILL STANDING</div>` : `<div style="color:#f66; font-weight:bold; margin-top:10px;">UNCONSCIOUS</div>`;
            if (success) { await this.actor.update({ "system.wounds.value": wounds + 1 }); }
            const fateBtn = this._getFateButtonHTML("Survival", `3d6 + ${st} + ${armor} + ${mod}`);
            let content = `<div class="ftrpg-chat-card"><div class="ftrpg-card-header header-red"><span>Consciousness</span><span style="font-size:0.7em">TN ${targetTN}</span></div><div class="ftrpg-card-content"><div style="text-align:center;"><span class="ftrpg-card-label">BASE ${weaponTN} + WOUNDS ${wounds*3}</span></div><div class="ftrpg-card-result">${roll.total}</div><div style="text-align:center;">${resultHTML}</div>${fateBtn}</div></div>`;
            roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: content });
    }}}}, { classes: ["ftrpg-dialog"], width: 300 }).render(true);
  }
}

// --- 4. NPC SHEET ---
export class FarTrekNPCSheet extends FarTrekActorSheet {
  static get defaultOptions() { 
      return foundry.utils.mergeObject(super.defaultOptions, { 
          classes: ["ftrpg", "sheet", "npc"], template: "systems/ftrpg/npc-sheet.html", width: 350, height: 600, tabs: [] 
      }); 
  }
}

// --- 5. SHIP SHEET ---
export class FarTrekShipSheet extends ActorSheet {
  static get defaultOptions() { 
      return foundry.utils.mergeObject(super.defaultOptions, { 
          classes: ["ftrpg", "sheet", "ship"], template: "systems/ftrpg/ship-sheet.html", width: 800, height: 750
      }); 
  }
  async getData() { 
      const context = await super.getData(); 
      context.system = this.actor.system; 
      const current = context.system.health.shields.value || 0;
      const max = context.system.health.shields.max || 100;
      context.shieldPct = Math.round((current / max) * 100);
      const hullCurrent = context.system.health.structure.value || 0;
      const hullMax = context.system.health.structure.max || 1;
      context.hullPct = Math.round((hullCurrent / hullMax) * 100);
      const baseSR = context.system.stats.helm || 0; 
      const penalty = Math.floor((100 - context.shieldPct) / 25);
      const impulse = context.system.subsystems?.impulse || 0;
      let effectiveSR = baseSR - penalty;
      if (impulse === 1) effectiveSR -= 2;
      if (impulse >= 2) effectiveSR = Math.floor(effectiveSR / 2);
      context.effectiveSR = Math.max(0, effectiveSR);
      context.statusLabels = ["OK", "DMG (-2)", "OFFLINE", "DESTROYED"];
      context.statusColors = ["#4f4", "#eebb00", "#f66", "#555"];
      return context; 
  }
  activateListeners(html) { 
      super.activateListeners(html); 
      html.find('.roll-ship-attack').click(this._onShipAttack.bind(this)); 
      html.find('.roll-damage-control').click(this._onDamageControl.bind(this)); 
      html.find('.toggle-shields').click(this._onToggleShields.bind(this));
      html.find('.roll-incoming-hit').click(this._onIncomingHit.bind(this));
      html.find('.roll-system-damage').click(this._onSystemDamage.bind(this));
      html.find('.roll-casualties').click(this._onCasualties.bind(this));
      html.find('.bridge-report').click(this._onBridgeReport.bind(this));
      html.find('.system-status-toggle').click(this._onSystemStatusToggle.bind(this));
  }
  
  async _onShipAttack(event) { 
      event.preventDefault(); 
      const tactical = this.actor.system.stats.tactical || 0; 
      const subsystems = this.actor.system.subsystems;
      const targets = Array.from(game.user.targets);
      let target = targets[0] ? targets[0].actor : null;
      let targetName = "Unknown Target";
      let targetSR = 0;

      if (target) {
          targetName = target.name;
          const tSys = target.system;
          const baseSR = tSys.stats.helm || 0;
          const sVal = tSys.health.shields.value;
          const sMax = tSys.health.shields.max;
          const sPct = Math.round((sVal/sMax)*100);
          const shieldPen = Math.floor((100 - sPct) / 25);
          let effSR = Math.max(0, baseSR - shieldPen);
          const impStatus = tSys.subsystems?.impulse || 0;
          if (impStatus === 1) effSR -= 2;
          if (impStatus >= 2) effSR = Math.floor(effSR / 2);
          targetSR = Math.max(0, effSR);
      }

      new Dialog({ 
          title: `Engage ${targetName}`, 
          content: `<form><div class="form-group"><label>Weapon System</label><select name="weaponType"><option value="phasers">Phasers</option><option value="torps">Photon Torpedoes</option></select></div><div class="form-group"><label>Weapon Rating (WR)</label><input type="number" name="wr" value="2" placeholder="Phasers=2, Torps=4"/></div><div class="form-group"><label>Tactical Skill (To Hit)</label><input type="number" name="skill" value="0"/></div><div class="form-group"><label>Target Shield Rating (SR)</label><input type="number" name="target-sr" value="${targetSR}"/></div></form>`, 
          buttons: { 
              fire: { 
                  label: "FIRE", 
                  callback: async (html) => { 
                      const type = html.find('[name="weaponType"]').val();
                      const status = subsystems[type] || 0;
                      if (status >= 2) return ui.notifications.error(`${type.toUpperCase()} OFFLINE!`);
                      const skill = parseInt(html.find('[name="skill"]').val()) || 0;
                      const wr = parseInt(html.find('[name="wr"]').val()) || 0;
                      const sr = parseInt(html.find('[name="target-sr"]').val()) || 0;
                      
                      let penalty = (status === 1) ? -2 : 0;
                      let attackRoll = new Roll(`3d6 + @skill + @tactical + @pen`, {skill, tactical, pen: penalty});
                      await attackRoll.evaluate();
                      
                      let effectFormula = `3d6 + ${wr} - ${sr}`;
                      let effectRoll = new Roll(effectFormula);
                      await effectRoll.evaluate();
                      
                      let total = effectRoll.total;
                      let resultTitle = "";
                      let resultDesc = "";
                      let applyBtn = "";
                      let resultColor = "#ccc";

                      // TABLE 1: SHIELD EFFECTS
                      if (total <= 9) {
                          resultTitle = "SHIELD ABSORPTION";
                          resultDesc = "Shields hold. Reduce shields by 1d6 x 5%.";
                          resultColor = "#6cf";
                          let dropRoll = new Roll("1d6 * 5");
                          await dropRoll.evaluate();
                          resultDesc += ` <br><b>Drop: -${dropRoll.total}%</b>`;
                          if (target) { applyBtn = `<button class="apply-ship-damage" data-uuid="${target.uuid}" data-type="shields" data-value="${dropRoll.total}">APPLY SHIELD DRAIN</button>`; }
                      } else if (total <= 14) {
                          resultTitle = "GRAZE (LEVEL 1)";
                          resultDesc = "Shields penetrated. Level 1 Damage to a section.";
                          resultColor = "#eebb00";
                          // FIXED: INJECT UUID
                          if (target) applyBtn = `<button class="roll-system-damage-context" data-level="1" data-uuid="${target.uuid}">ROLL SECTION HIT (LVL 1)</button>`;
                          else applyBtn = `<button class="roll-system-damage-context" data-level="1">ROLL SECTION HIT (LVL 1)</button>`;
                      } else if (total <= 17) {
                          resultTitle = "DIRECT HIT (LEVEL 2)";
                          resultDesc = "Shields penetrated! Console explodes! Level 2 Damage.";
                          resultColor = "#ff6600";
                          if (target) applyBtn = `<button class="roll-system-damage-context" data-level="2" data-uuid="${target.uuid}">ROLL SECTION HIT (LVL 2)</button>`;
                          else applyBtn = `<button class="roll-system-damage-context" data-level="2">ROLL SECTION HIT (LVL 2)</button>`;
                      } else {
                          resultTitle = "CRITICAL HIT (LEVEL 3)";
                          resultDesc = "She's gonna blow! System obliterated. Level 3 Damage.";
                          resultColor = "#cc0000";
                          if (target) applyBtn = `<button class="roll-system-damage-context" data-level="3" data-uuid="${target.uuid}">ROLL SECTION HIT (LVL 3)</button>`;
                          else applyBtn = `<button class="roll-system-damage-context" data-level="3">ROLL SECTION HIT (LVL 3)</button>`;
                      }

                      let content = `<div class="ftrpg-chat-card"><div class="ftrpg-card-header header-red"><span>${type.toUpperCase()}</span><span style="font-size:0.7em">WR ${wr} vs SR ${sr}</span></div><div class="ftrpg-card-content"><div style="text-align:center; border-bottom:1px solid #555; padding-bottom:5px; margin-bottom:5px;">Attack Roll: <b>${attackRoll.total}</b></div><div style="text-align:center;"><span class="ftrpg-card-label">EFFECT ROLL (3d6 + WR - SR)</span><div class="ftrpg-card-result" style="font-size:24px;">${total}</div></div><div style="background:${resultColor}; color:#000; padding:5px; border-radius:5px; text-align:center; margin-top:5px; font-weight:bold;">${resultTitle}</div><div style="text-align:center; font-size:0.9em; margin-top:5px;">${resultDesc}</div>${applyBtn}</div></div>`;
                      
                      ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: content, rolls: [attackRoll, effectRoll], type: CONST.CHAT_MESSAGE_TYPES.ROLL });
                  } 
              } 
          } 
      }, { classes: ["ftrpg-dialog"], width: 400 }).render(true); 
  }

  async _onSystemStatusToggle(event) {
      event.preventDefault();
      const sysName = event.currentTarget.dataset.system;
      const currentStatus = this.actor.system.subsystems[sysName] || 0;
      const newStatus = (currentStatus + 1) > 3 ? 0 : currentStatus + 1;
      await this.actor.update({ [`system.subsystems.${sysName}`]: newStatus });
  }
  
  async _onBridgeReport(event) {
      event.preventDefault();
      const s = this.actor.system.health.shields.value;
      let msg = s > 75 ? "Shields holding." : (s > 25 ? "Shields failing!" : "Shields offline!");
      const sub = this.actor.system.subsystems;
      let damages = [];
      for (const [key, val] of Object.entries(sub)) { if (val >= 2) damages.push(`${key.toUpperCase()} OFFLINE`); }
      if (damages.length > 0) msg += " ALERTS: " + damages.join(", ");
      ChatMessage.create({ content: `<div style="font-style:italic; color:#eebb00; background:#333; padding:5px; border:1px solid #555;">"${msg}"</div>`, speaker: ChatMessage.getSpeaker({ actor: this.actor }) });
  }
  
  async _onSystemDamage(event) {
      event.preventDefault();
      new Dialog({ title: "System Damage", content: `<p style="text-align:center;">Severity?</p>`, buttons: {
          l1: { label: "Graze", callback: () => this._processSystemHit(1) },
          l2: { label: "Direct Hit", callback: () => this._processSystemHit(2) },
          l3: { label: "Critical", callback: () => this._processSystemHit(3) }
      }}).render(true);
  }
  
  async _processSystemHit(level) {
      let roll = new Roll("1d6");
      await roll.evaluate();
      const sysKeys = ["shields", "impulse", "warp", "phasers", "torps", "sensors"];
      const locations = ["SHIELDS", "IMPULSE", "WARP", "PHASERS", "TORPEDOES", "SENSORS"];
      const index = roll.total - 1;
      const sysKey = sysKeys[index];
      
      if (this.actor.type === "ship") {
          const currentStatus = this.actor.system.subsystems[sysKey] || 0;
          if (level > currentStatus) await this.actor.update({ [`system.subsystems.${sysKey}`]: level });
      }
      
      let effect = level === 1 ? "Penalty (-2) to all rolls." : (level === 2 ? "System OFFLINE." : "System DESTROYED.");
      ChatMessage.create({ content: `<div class="ftrpg-chat-card"><div class="ftrpg-card-header header-red">SYSTEM DAMAGE</div><div class="ftrpg-card-content"><div style="text-align:center; color:#f66; font-weight:bold;">${locations[index]}</div><div style="text-align:center;">Severity Level ${level} applied.</div><div style="font-size:0.8em; margin-top:5px; font-style:italic;">${effect}</div></div></div>`, speaker: ChatMessage.getSpeaker({ actor: this.actor }) });
  }
  
  async _onCasualties(event) {
      event.preventDefault();
      let roll = new Roll("1d6");
      await roll.evaluate();
      let c = Math.max(0, roll.total - 2);
      ChatMessage.create({ content: `Casualties: ${c > 0 ? c + " injured/lost" : "None"}.`, speaker: ChatMessage.getSpeaker({ actor: this.actor }) });
  }
  
  async _onIncomingHit(event) {
      event.preventDefault();
      const shields = this.actor.system.health.shields;
      if (shields.active && shields.value > 0) {
          let roll = new Roll("1d6 * 5");
          await roll.evaluate();
          let newVal = Math.max(0, shields.value - roll.total);
          await this.actor.update({"system.health.shields.value": newVal});
          ChatMessage.create({ content: `Shields Hit! -${roll.total}%. Integrity: ${newVal}%`, speaker: ChatMessage.getSpeaker({ actor: this.actor }) });
      } else {
          new Dialog({ title: "Direct Hit", content: `<form><label>Damage</label><input type="number" name="dmg"/></form>`, buttons: { apply: { label: "Apply", callback: async (html) => {
              const dmg = parseInt(html.find('[name="dmg"]').val()) || 0;
              await this.actor.update({"system.health.structure.value": Math.max(0, this.actor.system.health.structure.value - dmg)});
          }}}}).render(true);
      }
  }
  
  async _onToggleShields(event) {
      const active = this.actor.system.health.shields.active;
      await this.actor.update({"system.health.shields.active": !active});
  }
  
  async _onDamageControl(event) {
      event.preventDefault();
      const type = event.currentTarget.dataset.type;
      const eng = this.actor.system.stats.engineering || 0;
      if (type === 'shields' && (this.actor.system.subsystems.shields || 0) >= 2) return ui.notifications.error("Shield Gens Offline!");
      new Dialog({ title: "Damage Control", content: `<form><label>Eng Skill</label><input type="number" name="skill"/></form>`, buttons: { roll: { label: "Roll", callback: async (html) => {
          const skill = parseInt(html.find('[name="skill"]').val()) || 0;
          let roll = new Roll(`3d6 + @skill + @eng`, { skill, eng });
          await roll.evaluate();
          let restored = 0;
          if (type === 'shields') { let r = new Roll("1d6 * 5"); await r.evaluate(); restored = r.total; }
          else { restored = Math.floor(roll.total / 5) || 1; }
          const path = `system.health.${type}`;
          const current = this.actor.system.health[type].value;
          const max = this.actor.system.health[type].max;
          await this.actor.update({ [`${path}.value`]: Math.min(max, current + restored) });
          ChatMessage.create({ content: `Repairs: +${restored} to ${type}.`, speaker: ChatMessage.getSpeaker({ actor: this.actor }) });
      }}}}).render(true);
  }
}

// --- 6. HOOKS ---
Hooks.once('init', async function() {
  CONFIG.Combat.initiative = { formula: "3d6 + @attributes.dx.value", decimals: 2 };
  CONFIG.Item.documentClass = FarTrekItem;
  CONFIG.Actor.dataModels = { ship: ShipDataModel };
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("ftrpg", FarTrekActorSheet, { types: ["character"], makeDefault: true, label: "Character Sheet" });
  Actors.registerSheet("ftrpg", FarTrekNPCSheet, { types: ["npc"], makeDefault: true, label: "NPC Sheet" });
  Actors.registerSheet("ftrpg", FarTrekShipSheet, { types: ["ship"], makeDefault: true, label: "Starship Sheet" });
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("ftrpg", FarTrekItemSheet, { makeDefault: true });
});

Hooks.once('ready', async function() {
  $(document).on('click', '.fate-reroll', async (ev) => {
        ev.preventDefault(); 
        const btn = $(ev.currentTarget);
        const actor = await fromUuid(btn.data('actorUuid'));
        if (!actor) return;
        const currentFate = actor.system.resources?.fate?.value || 0;
        if (currentFate > 0) {
            await actor.update({"system.resources.fate.value": currentFate - 1});
            let roll = new Roll(String(btn.data('formula')));
            await roll.evaluate();
            ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `Fate Reroll: ${roll.total}` });
        } else {
            ui.notifications.warn("No Fate points remaining!");
        }
  });
  
  // SHIELD DRAIN LISTENER
  $(document).on('click', '.apply-ship-damage', async (ev) => {
      ev.preventDefault();
      const btn = $(ev.currentTarget);
      const uuid = btn.data('uuid');
      const value = parseInt(btn.data('value'));
      const target = await fromUuid(uuid);
      if (!target || !target.isOwner) return ui.notifications.error("Target not found/owned.");
      
      const cur = target.system.health.shields.value;
      const newVal = Math.max(0, cur - value);
      await target.update({"system.health.shields.value": newVal});
      ChatMessage.create({ content: `Shields drained by ${value}%` });
  });

  // FIXED: AUTO SYSTEM DAMAGE LISTENER
  $(document).on('click', '.roll-system-damage-context', async (ev) => {
      ev.preventDefault();
      const btn = $(ev.currentTarget);
      const level = parseInt(btn.data('level'));
      const uuid = btn.data('uuid'); // Now getting the UUID

      let roll = new Roll("1d6");
      await roll.evaluate();
      const locations = ["SHIELDS", "IMPULSE", "WARP", "PHASERS", "TORPEDOES", "SENSORS"];
      const sysKeys = ["shields", "impulse", "warp", "phasers", "torps", "sensors"];
      const index = roll.total - 1;
      const loc = locations[index];
      const sysKey = sysKeys[index];
      
      let updateMsg = "";

      // AUTOMATION: Update Target Actor if UUID present
      if (uuid) {
          const target = await fromUuid(uuid);
          if (target && target.documentName === "Actor") {
             const currentStatus = target.system.subsystems[sysKey] || 0;
             if (level > currentStatus) {
                 await target.update({ [`system.subsystems.${sysKey}`]: level });
                 updateMsg = `<div style="color:#4f4; font-weight:bold; margin-top:5px; border-top:1px solid #555;">${loc} STATUS UPDATED</div>`;
             } else {
                 updateMsg = `<div style="color:#eebb00; font-size:0.8em; margin-top:5px; border-top:1px solid #555;">(System already at equal/higher damage)</div>`;
             }
          }
      }
      
      let effect = level === 1 ? "Penalty (-2) to rolls." : (level === 2 ? "System OFFLINE." : "System DESTROYED.");

      ChatMessage.create({ content: `<div class="ftrpg-chat-card"><div class="ftrpg-card-header header-red">SYSTEM HIT (LEVEL ${level})</div><div class="ftrpg-card-content"><div style="text-align:center; color:#f66; font-weight:bold;">${loc}</div><div style="text-align:center;">Roll: ${roll.total}</div><div style="font-size:0.8em; margin-top:5px; font-style:italic;">${effect}</div>${updateMsg}</div></div>` });
  });
});

Hooks.once('diceSoNiceReady', (dice3d) => {
  dice3d.addSystem({ id: "ftrpg", name: "Far Trek RPG" }, "default");
  dice3d.addColorset({ name: "tos-command", description: "TOS Command", category: "Far Trek", foreground: "#eebb00", background: "#000000", outline: "#eebb00", edge: "#eebb00", texture: "none", material: "plastic", font: "Arial", fontScale: { "d6": 1.1, "d20": 1.0 }}, "default");
});