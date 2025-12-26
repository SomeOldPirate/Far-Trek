/**
 * Far Trek RPG System Logic
 * Master File: Active Talents, Phaser Modes, Defense Logic, Syntax Fixed
 */

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
        s.notes = String(s.notes ?? ""); 
    }
    // New Talent Fields
    if (this.type === "talent") {
        s.attackBonus = Number(s.attackBonus ?? 0);
        s.skillBonus = Number(s.skillBonus ?? 0);
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
      context.config = { attributes: { "st": "Strength", "dx": "Dexterity", "iq": "Intelligence", "ca": "Charisma" } };
      return context; 
  }
}

// --- 3. ACTOR SHEET ---
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
    html.find('.item-delete').click(ev => { this.actor.deleteEmbeddedDocuments("Item", [$(ev.currentTarget).parents(".item").data("itemId")]); });
    html.find('.item-edit').click(ev => { this.actor.items.get($(ev.currentTarget).parents(".item").data("itemId")).sheet.render(true); });
    html.find('.item-roll').click(this._onItemRoll.bind(this));
    html.find('.phaser-mode').click(this._onPhaserToggle.bind(this));
  }

  async _onPhaserToggle(event) {
    event.preventDefault(); event.stopPropagation();
    const btn = $(event.currentTarget);
    const item = this.actor.items.get(btn.parents(".item").data("itemId"));
    
    const currentMode = item.getFlag("ftrpg", "phaserMode") || "stun";
    
    if (currentMode === "stun") {
        await item.setFlag("ftrpg", "phaserMode", "heavy");
        await item.update({ "system.weaponTN": 17 });
        ui.notifications.info(`${item.name} set to HEAVY STUN (TN 17)`);
    } 
    else if (currentMode === "heavy") {
        await item.setFlag("ftrpg", "phaserMode", "kill");
        await item.update({ "system.weaponTN": 20 });
        ui.notifications.warn(`${item.name} set to KILL (TN 20)`);
    } 
    else {
        await item.setFlag("ftrpg", "phaserMode", "stun");
        await item.update({ "system.weaponTN": 14 });
        ui.notifications.info(`${item.name} set to STUN (TN 14)`);
    }
  }

  _getFateButtonHTML(label, formula) {
      const fate = this.actor.system.resources.fate.value;
      if (fate > 0) return `<button class="fate-reroll" data-actor-uuid="${this.actor.uuid}" data-label="${label}" data-formula="${formula}"><i class="fas fa-dice"></i> SPEND FATE (REROLL)</button>`;
      return "";
  }

  async _onInitRoll(event) {
    event.preventDefault();
    const dx = Number(this.actor.system.attributes.dx?.value) || 0;
    let roll = new Roll("3d6 + @dx", { dx: dx });
    await roll.evaluate();
    if (game.combat) { const c = game.combat.combatants.find(c => c.actorId === this.actor.id); if (c) await game.combat.setInitiative(c.id, roll.total); }
    const fateBtn = this._getFateButtonHTML("Initiative", `3d6 + ${dx}`);
    let content = `<div class="ftrpg-chat-card"><div class="ftrpg-card-header header-gold"><span>Initiative</span><span style="font-size:0.7em">COMBAT</span></div><div class="ftrpg-card-content"><div style="text-align:center; margin-bottom:5px;"><span class="ftrpg-card-label">DEXTERITY (${dx}) + 3d6</span></div><div class="ftrpg-card-result">${roll.total}</div><div class="ftrpg-card-alert" style="background-color:#333; color:#eebb00; border-color:#eebb00;">READY FOR ACTION</div>${fateBtn}</div></div>`;
    roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: content });
  }

  async _onItemRoll(event) {
    event.preventDefault();
    const item = this.actor.items.get($(event.currentTarget).parents(".item").data("itemId"));
    
    // --- CALCULATE TALENT BONUSES ---
    const allTalents = this.actor.items.filter(i => i.type === "talent");
    const talentAttackBonus = allTalents.reduce((acc, t) => acc + (Number(t.system.attackBonus) || 0), 0);
    const talentSkillBonus = allTalents.reduce((acc, t) => acc + (Number(t.system.skillBonus) || 0), 0);

    new Dialog({ title: `Roll ${item.name}`, content: `<form><div class="form-group"><label>Situational Modifier</label><input type="number" name="modifier" value="0" autofocus/></div></form>`, buttons: { roll: { label: "ENGAGE", callback: async (html) => {
        const mod = Number(html.find('[name="modifier"]').val()) || 0; 
        
        // --- WEAPON ROLL ---
        if (item.type === "weapon") {
            const attrKey = item.system.attackAttribute || "dx";
            const attrValue = Number(this.actor.system.attributes[attrKey]?.value) || 0;
            const skillName = item.system.attackSkillName.toLowerCase();
            const skillItem = this.actor.items.find(i => i.type === "skill" && i.name.toLowerCase() === skillName);
            const skillRank = skillItem ? Number(skillItem.system.rank) : 0;
            let defenseStat = (attrKey === "dx") ? "DEXTERITY" : "STRENGTH";

            // Add @talent to the roll
            let roll = new Roll("3d6 + @attr + @skill + @talent + @mod", {
                attr: attrValue, 
                skill: skillRank, 
                talent: talentAttackBonus, // Use Attack Bonus Sum
                mod: mod
            });
            await roll.evaluate();
            
            const fateBtn = this._getFateButtonHTML(item.name, `3d6 + ${attrValue} + ${skillRank} + ${talentAttackBonus} + ${mod}`);
            
            // Generate Talent Text if applicable
            let talentText = "";
            if (talentAttackBonus !== 0) {
                talentText = `<div style="text-align:center; margin-bottom:2px;"><span class="ftrpg-card-label" style="color:#eebb00;">TALENT BONUS:</span> ${talentAttackBonus > 0 ? "+"+talentAttackBonus : talentAttackBonus}</div>`;
            }

            let modeText = "";
            if (item.system.hasStun) {
                const mode = item.getFlag("ftrpg", "phaserMode") || "stun";
                if (mode === "kill") modeText = `<div style="color:#ff4444; font-size:0.8em; font-weight:bold; margin-top:5px;">SETTING: KILL (TN 20)</div>`;
                else if (mode === "heavy") modeText = `<div style="color:#ffaa00; font-size:0.8em; font-weight:bold; margin-top:5px;">SETTING: HEAVY STUN (TN 17)</div>`;
                else modeText = `<div style="color:#44ff44; font-size:0.8em; font-weight:bold; margin-top:5px;">SETTING: STUN (TN 14)</div>`;
            }

            let content = `
                <div class="ftrpg-chat-card">
                    <div class="ftrpg-card-header header-red"><span>${item.name}</span><span style="font-size:0.7em">ATTACK</span></div>
                    <div class="ftrpg-card-content">
                        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                            <div><span class="ftrpg-card-label">ATTR:</span> ${attrKey.toUpperCase()} (${attrValue})</div>
                            <div><span class="ftrpg-card-label">SKILL:</span> ${skillRank}</div>
                        </div>
                        ${talentText}
                        <div style="text-align:center; margin-bottom:5px;"><span class="ftrpg-card-label">MODIFIER:</span> ${mod}</div>
                        <div class="ftrpg-card-result">${roll.total}</div>
                        <div class="ftrpg-card-alert" style="text-align:left;">
                            <div style="border-bottom:1px solid #555; padding-bottom:5px; margin-bottom:5px;">
                                <div class="ftrpg-card-label" style="color:#aaa;">TO AVOID HIT:</div>
                                <div style="color:#fff;">Target rolls <strong>${defenseStat}</strong> vs</div>
                                <div style="font-size: 1.2em; font-weight: bold; color: #fff;">TN ${roll.total}</div>
                            </div>
                            <div>
                                <div class="ftrpg-card-label" style="color:#aaa;">IF DAMAGE TAKEN:</div>
                                <div style="color:#fff;">Consciousness Check</div>
                                <div style="font-size: 0.9em;">Roll <strong>STRENGTH</strong> vs TN ${item.system.weaponTN} (+Wounds)</div>
                            </div>
                            ${modeText}
                        </div>
                        ${fateBtn}
                    </div>
                </div>`;
            roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: content });
            
        // --- SKILL ROLL ---
        } else if (item.type === "skill") {
            const attrKey = item.system.attribute || "iq";
            const attrValue = Number(this.actor.system.attributes[attrKey]?.value) || 0;
            const rank = Number(item.system.rank) || 0;

            // Add @talent to the roll
            let roll = new Roll("3d6 + @attr + @rank + @talent + @mod", {
                attr: attrValue, 
                rank: rank, 
                talent: talentSkillBonus, // Use Skill Bonus Sum
                mod: mod
            });
            await roll.evaluate();
            
            const fateBtn = this._getFateButtonHTML(item.name, `3d6 + ${attrValue} + ${rank} + ${talentSkillBonus} + ${mod}`);
            
            let talentText = "";
            if (talentSkillBonus !== 0) {
                talentText = `<div style="text-align:center; margin-bottom:2px;"><span class="ftrpg-card-label" style="color:#eebb00;">TALENT BONUS:</span> ${talentSkillBonus > 0 ? "+"+talentSkillBonus : talentSkillBonus}</div>`;
            }

            let content = `<div class="ftrpg-chat-card"><div class="ftrpg-card-header header-gold"><span>${item.name}</span><span style="font-size:0.7em">SKILL</span></div><div class="ftrpg-card-content"><div style="text-align:center; margin-bottom:5px;"><span class="ftrpg-card-label">${attrKey.toUpperCase()} (${attrValue}) + RANK (${rank}) + MOD (${mod})</span></div>${talentText}<div class="ftrpg-card-result">${roll.total}</div>${fateBtn}</div></div>`;
            roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: content});
        }
    }}}}, { classes: ["ftrpg-dialog"], width: 300 }).render(true);
  }

  async _onRoll(event) {
    event.preventDefault();
    const label = event.currentTarget.dataset.label;
    const key = event.currentTarget.dataset.key;
    const attrValue = Number(this.actor.system.attributes[key]?.value) || 0;
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
    const wounds = Number(this.actor.system.wounds.value) || 0;
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
      content: `<form>
            <div class="form-group">
                <label>Weapon that hit you?</label>
                <select name="weapon-tn">${weaponOptions}</select>
            </div>
            <div class="form-group">
                <label>Modifier</label>
                <input type="number" name="modifier" value="0"/>
            </div>
            <p style="text-align:center; font-size:0.8em; color:#888;">Current Wounds: <b>${wounds}</b> (+${wounds*3} to TN)</p>
        </form>`,
      buttons: { roll: { label: "ROLL", callback: async (html) => {
            const weaponTN = parseInt(html.find('[name="weapon-tn"]').val());
            const mod = Number(html.find('[name="modifier"]').val()) || 0;
            const st = Number(this.actor.system.attributes.st?.value) || 0;
            const armor = Number(this.actor.system.armor.value) || 0;
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

export class FarTrekShipSheet extends ActorSheet {
  static get defaultOptions() { return foundry.utils.mergeObject(super.defaultOptions, { classes: ["ftrpg", "sheet", "ship"], template: "systems/ftrpg/ship-sheet.html", width: 700, height: 600 }); }
  async getData() { const context = await super.getData(); context.system = this.actor.system; const shieldPct = context.system.shields.value; const baseSR = context.system.stats.sr.value; const penalty = Math.floor((100 - shieldPct) / 25); context.effectiveSR = Math.max(0, baseSR - penalty); return context; }
  activateListeners(html) { super.activateListeners(html); html.find('.roll-ship-attack').click(this._onShipAttack.bind(this)); html.find('.roll-shield-damage').click(this._onShieldDamage.bind(this)); }
  async _onShipAttack(event) { event.preventDefault(); const wr = this.actor.system.stats.wr.value; new Dialog({ title: "Ship Attack", content: `<form><p>Your WR is <b>${wr}</b>.</p><div class="form-group"><label>Target SR:</label><input type="number" name="target-sr" value="0"/></div><div class="form-group"><label>Modifier:</label><input type="number" name="modifier" value="0"/></div></form>`, buttons: { fire: { label: "FIRE PHOTONS", callback: async (html) => { const targetSR = parseInt(html.find('[name="target-sr"]').val()) || 0; const mod = parseInt(html.find('[name="modifier"]').val()) || 0; const diff = wr - targetSR; let roll = new Roll(`3d6 + @diff + @mod`, {diff: diff, mod: mod}); await roll.evaluate(); let resultText = ""; const total = roll.total; if (total <= 9) resultText = "NO EFFECT. Target loses 1d6x5% Shields."; else if (total <= 14) resultText = "GRAZE! Level 1 Damage."; else if (total <= 17) resultText = "DIRECT HIT! Level 2 Damage."; else resultText = "CRITICAL HIT! Level 3 Damage."; let content = `<div class="ftrpg-chat-card"><div class="ftrpg-card-header header-red"><span>Ship Attack</span><span style="font-size:0.7em">WR ${wr} vs SR ${targetSR}</span></div><div class="ftrpg-card-content"><div class="ftrpg-card-result">${total}</div><div class="ftrpg-card-alert">${resultText}</div></div></div>`; roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: content }); } } } }, { classes: ["ftrpg-dialog"], width: 350 }).render(true); }
  async _onShieldDamage(event) { event.preventDefault(); let roll = new Roll("1d6 * 5"); await roll.evaluate(); const currentShields = this.actor.system.shields.value; const newShields = Math.max(0, currentShields - roll.total); await this.actor.update({"system.shields.value": newShields}); let content = `<div class="ftrpg-chat-card"><div class="ftrpg-card-header header-blue"><span>Shield Impact</span><span style="font-size:0.7em">HIT</span></div><div class="ftrpg-card-content"><div style="text-align:center;">Shields drop by <b style="color:#f66;">${roll.total}%</b></div><div style="text-align:center; font-size:1.2em; margin-top:5px;">Current Status: <b>${newShields}%</b></div></div></div>`; roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: content }); }
}

Hooks.once('init', async function() {
  CONFIG.Combat.initiative = { formula: "3d6 + @attributes.dx.value", decimals: 2 };
  CONFIG.Item.documentClass = FarTrekItem;
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("ftrpg", FarTrekActorSheet, { types: ["character"], makeDefault: true, label: "Character Sheet" });
  Actors.registerSheet("ftrpg", FarTrekShipSheet, { types: ["ship"], makeDefault: true, label: "Starship Sheet" });
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("ftrpg", FarTrekItemSheet, { makeDefault: true });
});

Hooks.once('ready', async function() {
  $(document).on('click', '.fate-reroll', async (ev) => {
        ev.preventDefault(); ev.stopPropagation(); 
        const btn = $(ev.currentTarget);
        const actor = await fromUuid(btn.data('actorUuid'));
        if (!actor) return ui.notifications.error("Far Trek: Actor not found.");
        const currentFate = actor.system.resources.fate.value;
        if (currentFate <= 0) return ui.notifications.warn(`${actor.name} has no Fate Points remaining!`);
        await actor.update({"system.resources.fate.value": currentFate - 1});
        ui.notifications.info(`${actor.name} spent a Fate Point!`);
        const label = btn.data('label');
        const formula = String(btn.data('formula')); 
        let roll = new Roll(formula);
        await roll.evaluate();
        let content = `<div class="ftrpg-chat-card"><div class="ftrpg-card-header" style="background:#663399; color:#fff;"><span>${label}</span><span style="font-size:0.7em">FATE REROLL</span></div><div class="ftrpg-card-content"><div class="ftrpg-card-result" style="color:#dcdcdc; text-shadow:0 0 5px #663399;">${roll.total}</div><div style="text-align:center; font-size:0.8em; color:#aaa; margin-top:5px;">Remaining Fate: <strong>${currentFate - 1}</strong></div></div></div>`;
        roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: actor }), content: content });
  });
});

Hooks.once('diceSoNiceReady', (dice3d) => {
  dice3d.addSystem({ id: "ftrpg", name: "Far Trek RPG" }, "default");
  dice3d.addColorset({ name: "tos-command", description: "TOS Command", category: "Far Trek", foreground: "#eebb00", background: "#000000", outline: "#eebb00", edge: "#eebb00", texture: "none", material: "plastic", font: "Arial", fontScale: { "d6": 1.1, "d20": 1.0 }}, "default");
});