/**
 * Compact Edge sheets for NPCs and critters, spirits, and vehicles/drones: one page like a rulebook stat block,
 * with the same rolls as the Edge character sheet (through the system: skills, weapons, pools, vehicle tests),
 * statuses, Take Cover, healing, grunt groups (the system's GruntGroupId token flag) and spirit services.
 */
import { buildNpcContext, buildSpiritContext, buildVehicleContext, gruntGroup } from "./compact-context.mjs";
import { effectsContext, effectActions } from "./effects-panel.mjs";
import * as rolls from "./system-rolls.mjs";
import { actorStatuses, statusLabel, takeCover } from "../statuses.mjs";
import { openHealing } from "../healing.mjs";
import { openBanish, setServices } from "../summoning.mjs";
import { isLightTheme, toggleTheme } from "../theme.mjs";
import * as ui2 from "../ui/edge-ui.mjs";
import * as veh from "../vehicles.mjs";
import { droneTests, droneInitiative, autosoftSlots } from "../vehicle-rules.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
const MODULE_ID = "shadowrun-edge";
const SYSTEM_ID = "shadowrun6-eden";
const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

class EdgeCompactSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["sre-sheet", "sre-compact"],
    position: { width: 940, height: 760 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      rollQuick: EdgeCompactSheet.#onQuick,
      rollSkill: EdgeCompactSheet.#onSkill,
      rollWeapon: EdgeCompactSheet.#onWeapon,
      reload: EdgeCompactSheet.#onReload,
      rollSpell: EdgeCompactSheet.#onSpell,
      rollInitiative: EdgeCompactSheet.#onInitiative,
      openItem: EdgeCompactSheet.#onOpenItem,
      monitor: EdgeCompactSheet.#onMonitor,
      heal: EdgeCompactSheet.#onHeal,
      takeCover: EdgeCompactSheet.#onTakeCover,
      statusLevel: EdgeCompactSheet.#onStatusLevel,
      statusRemove: EdgeCompactSheet.#onStatusRemove,
      systemSheet: EdgeCompactSheet.#onSystemSheet,
      toggleTheme: () => toggleTheme(),
      groupCreate: EdgeCompactSheet.#onGroupCreate,
      groupLeave: EdgeCompactSheet.#onGroupLeave,
      services: EdgeCompactSheet.#onServices,
      banish: EdgeCompactSheet.#onBanish,
      dismiss: EdgeCompactSheet.#onDismiss,
      vehicleTest: EdgeCompactSheet.#onVehicleTest,
      speed: EdgeCompactSheet.#onSpeed,
      handling: EdgeCompactSheet.#onHandling,
      drivers: EdgeCompactSheet.#onDrivers,
      ram: EdgeCompactSheet.#onRam,
      droneTest: EdgeCompactSheet.#onDroneTest,
      droneInitiative: EdgeCompactSheet.#onDroneInitiative,
      groupCommand: EdgeCompactSheet.#onGroupCommand,
      ...effectActions,
    },
  };

  static PARTS = { sheet: { template: `modules/${MODULE_ID}/templates/sheet/edge-compact.hbs`, scrollable: [".sre-compact-body"] } };

  /** The kind-specific part of the context. */
  _compactContext() {
    return buildNpcContext(this.document, { L, config: CONFIG.SR6 ?? {} });
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const data = this._compactContext();
    const light = isLightTheme();
    const notes = await foundry.applications.ux.TextEditor.implementation.enrichHTML(data.notes ?? "", { relativeTo: this.document, secrets: this.document.isOwner });
    return {
      ...context,
      ...data,
      notesHTML: notes,
      actor: this.document,
      name: this.document.name,
      img: this.document.img,
      initial: (this.document.name ?? "?").charAt(0),
      editable: this.isEditable,
      isNpc: data.kind === "NPC" || data.kind === "Critter",
      isSpirit: data.kind === "Spirit",
      isVehicle: data.kind === "Vehicle",
      statuses: actorStatuses(this.document).map((st) => ({
        effectId: st.effect.id, label: statusLabel(st.id), img: st.effect.img, level: st.level,
        hasLevels: !!CONFIG.statusEffects?.find((x) => x.id === st.id)?.hasLevels,
      })),
      group: this.#group(),
      effects: effectsContext(this.document),
      themeSwitch: { light, icon: light ? "fa-moon" : "fa-sun", label: L(light ? "SRE.Theme.ToDark" : "SRE.Theme.ToLight") },
    };
  }

  /** This actor's token on the scene (a synthetic actor's own token, else the first active one). */
  get #token() {
    return this.document.token ?? this.document.getActiveTokens?.(false, true)?.[0] ?? null;
  }

  #group() {
    const token = this.#token;
    if (!token || !canvas?.ready) return null;
    const id = token.getFlag?.(SYSTEM_ID, "GruntGroupId");
    const tokens = canvas.tokens.placeables.map((t) => ({
      groupId: t.document.getFlag(SYSTEM_ID, "GruntGroupId"), name: t.name,
      dmg: t.actor?.system?.physical?.dmg, max: t.actor?.system?.physical?.max,
    }));
    return gruntGroup(id, tokens) ?? { id: null };
  }

  #item(target) {
    return this.document.items.get(target.closest("[data-item-id]")?.dataset.itemId);
  }

  static #onQuick(event, target) {
    const { kind, id, pool, label } = target.dataset;
    return rolls.rollPool(this.document, { pool: Number(pool), label, kind: kind === "derived" ? "common" : kind, id });
  }

  static #onSkill(event, target) {
    return rolls.rollSkill(this.document, target.dataset.skill);
  }

  static #onWeapon(event, target) {
    const item = this.#item(target);
    if (item) return rolls.rollWeapon(this.document, item);
  }

  static #onReload(event, target) {
    const item = this.#item(target);
    if (item) return rolls.reloadWeapon(item);
  }

  static #onSpell(event, target) {
    const item = this.#item(target);
    if (item) return rolls.rollSpell(this.document, item);
  }

  static #onInitiative() {
    const ini = this.document.system.initiative?.physical ?? {};
    return rolls.rollInitiative(this.document, { id: "physical", base: ini.pool, dice: ini.dicePool ?? ini.dice, label: L("SRE.Sheet.Initiative.physical") });
  }

  static #onOpenItem(event, target) {
    return this.#item(target)?.sheet.render(true);
  }

  static async #onMonitor(event, target) {
    const { monitor, index } = target.dataset;
    const current = Number(this.document.system[monitor]?.dmg) || 0;
    const box = Number(index);
    await this.document.update({ [`system.${monitor}.dmg`]: box === current ? box - 1 : box });
  }

  static #onHeal() {
    return openHealing(this.document);
  }

  static #onTakeCover() {
    return takeCover(this.document);
  }

  static async #onStatusLevel(event, target) {
    const effect = this.document.effects.get(target.dataset.effectId);
    if (!effect) return;
    const next = (Number(effect.system?.level) || 1) + Number(target.dataset.delta);
    if (next < 1) return effect.delete();
    return effect.update({ "system.level": next });
  }

  static #onStatusRemove(event, target) {
    return this.document.effects.get(target.dataset.effectId)?.delete();
  }

  static #onSystemSheet() {
    const classes = Object.values(CONFIG.Actor.sheetClasses?.[this.document.type] ?? {});
    const cls = classes.find((s) => s.id?.startsWith(`${SYSTEM_ID}.`))?.cls;
    if (!cls) return;
    const v2 = cls.prototype instanceof foundry.applications.api.ApplicationV2;
    (v2 ? new cls({ document: this.document }) : new cls(this.document)).render(true);
  }

  /** A grunt group from the selected tokens (this one included): the system's GruntGroupId flag. */
  static async #onGroupCreate() {
    const own = this.#token;
    const selected = new Set([...(canvas?.tokens?.controlled ?? []).map((t) => t.document), ...(own ? [own] : [])]);
    if (selected.size < 2) return ui.notifications.warn(L("SRE.Compact.GroupSelect"));
    const used = new Set(canvas.tokens.placeables.map((t) => Number(t.document.getFlag(SYSTEM_ID, "GruntGroupId"))).filter(Number.isFinite));
    let id = 1;
    while (used.has(id)) id++;
    for (const doc of selected) await doc.setFlag(SYSTEM_ID, "GruntGroupId", id);
    this.render();
  }

  static async #onGroupLeave() {
    await this.#token?.unsetFlag(SYSTEM_ID, "GruntGroupId");
    this.render();
  }

  static async #onServices(event, target) {
    const flag = this.document.getFlag(MODULE_ID, "spirit");
    if (!flag) return;
    await setServices(this.document, (Number(flag.services) || 0) + Number(target.dataset.delta));
    this.render();
  }

  /** Banishing this spirit, by the user's character (or the selected token's actor). */
  static async #onBanish() {
    const banisher = canvas?.tokens?.controlled?.find((t) => t.actor && t.actor.id !== this.document.id && t.actor.isOwner)?.actor ?? game.user.character;
    if (!banisher) return ui.notifications.warn(L("SRE.Compact.BanisherSelect"));
    return openBanish(banisher, this.document);
  }

  static async #onDismiss() {
    const ok = await ui2.confirm({
      kind: L("SRE.Summon.DismissKind"), name: this.document.name, text: L("SRE.Summon.DismissConfirm", { name: this.document.name }),
      button: L("SRE.Summon.DismissButton"), icon: "fas fa-door-open", warn: true,
    });
    if (ok) return this.document.delete();
  }

  static #onSpeed(event, target) {
    return veh.setSpeed(this.document, Number(target.dataset.dir));
  }

  static #onHandling() {
    return veh.openHandling(this.document);
  }

  static #onDrivers() {
    return veh.driversTest(this.document);
  }

  static #onRam() {
    return veh.openRam(this.document);
  }

  static #onDroneTest(event, target) {
    return veh.droneTest(this.document, target.dataset.soft);
  }

  static #onDroneInitiative() {
    return veh.droneInitiative(this.document);
  }

  static #onGroupCommand() {
    return veh.groupCommand(this.document);
  }

  static #onVehicleTest(event, target) {
    const { pool, label } = target.dataset;
    if (target.dataset.soak) return rolls.rollPool(this.document, { pool: Number(pool), label, kind: "soak" });
    return rolls.rollVehicle(this.document, { pool: Number(pool), label });
  }
}

export class EdgeNpcSheet extends EdgeCompactSheet {}

export class EdgeSpiritSheet extends EdgeCompactSheet {
  _compactContext() {
    return buildSpiritContext(this.document, { L, config: CONFIG.SR6 ?? {} });
  }
}

export class EdgeVehicleSheet extends EdgeCompactSheet {
  _compactContext() {
    const data = buildVehicleContext(this.document, { L, config: CONFIG.SR6 ?? {} });
    const st = veh.vehicleState(this.document);
    const modes = CONFIG.SR6?.VEHICLE_MODE ?? { manual: "", riggedAR: "", riggedVR: "", rcc: "", autonomous: "" };
    const owners = game.actors?.filter?.((a) => ["Player", "NPC"].includes(a.type) && (a.isOwner || game.user.isGM)) ?? [];
    const group = veh.rccGroup(this.document);
    const rcc = veh.rccOf(this.document);
    const fromItem = this.document.getFlag(MODULE_ID, "fromItem");
    let garage = null;
    try {
      const item = fromItem ? fromUuidSync(fromItem) : null;
      if (item) garage = { item: item.name, owner: item.actor?.name ?? "" };
    } catch {
      garage = null;
    }
    return {
      ...data,
      garage,
      drive: {
        ...st,
        modes: Object.entries(modes).map(([id, key]) => ({ id, label: key ? L(key) : id, selected: id === st.mode })),
        owners: owners.map((a) => ({ id: a.id, name: a.name, selected: a.id === this.document.system?.vehicle?.belongs })),
        speedPct: st.top ? Math.min(100, Math.round((st.speed / st.top) * 100)) : 0,
        distance: Math.round(st.distance),
        tiles: [
          { label: L("SRE.Vehicle.Distance"), value: `${Math.round(st.distance)} m`, hint: L("SRE.Vehicle.DistanceHint", { from: st.from, half: (st.speed - st.from) / 2 }) },
          { label: L("SRE.Vehicle.Kmh"), value: st.kmh },
          { label: L("SRE.Vehicle.Penalty"), value: st.intervals ? `−${st.intervals}` : "0", hint: L("SRE.Vehicle.IntervalHint", { n: st.interval }) },
          { label: L("SRE.Vehicle.Handling"), value: st.threshold, hint: st.damagePenalty ? L("SRE.Vehicle.DamageHint", { n: st.damagePenalty }) : "" },
          { label: L("SRE.Vehicle.Soak"), value: st.body * 2, hint: L("SRE.Vehicle.SoakHint") },
          { label: L("SRE.Vehicle.Monitor"), value: `${st.monitor.dmg}/${st.monitor.max}`, hint: L("SRE.Vehicle.BreaksAt", { n: st.monitor.max }) },
        ],
        droneTests: droneTests({ pil: st.pilot, sen: st.sensor }, st.softs).map((t) => ({ ...t, label: L(`SRE.Vehicle.Soft.${t.id}`), attrLabel: L(t.attr === "pil" ? "SRE.Compact.Pilot" : "SRE.Compact.Sensor") })),
        droneIni: droneInitiative(st.pilot),
        slots: { used: Object.keys(st.softs).length, max: autosoftSlots(st.pilot) },
        group: group.map((d) => d.name).join(", "), groupCount: group.length, rcc: rcc?.name ?? "", rccMax: rcc ? Number(rcc.system?.devRating) * 3 : null,
      },
    };
  }
}

Hooks.once("init", () => {
  if (game.system.id !== SYSTEM_ID) return;
  const collection = foundry.documents?.collections?.Actors ?? globalThis.Actors;
  collection.registerSheet(MODULE_ID, EdgeNpcSheet, { types: ["NPC", "Critter"], makeDefault: true, label: "SRE.Compact.LabelNpc" });
  collection.registerSheet(MODULE_ID, EdgeSpiritSheet, { types: ["Spirit"], makeDefault: true, label: "SRE.Compact.LabelSpirit" });
  collection.registerSheet(MODULE_ID, EdgeVehicleSheet, { types: ["Vehicle"], makeDefault: true, label: "SRE.Compact.LabelVehicle" });
});
