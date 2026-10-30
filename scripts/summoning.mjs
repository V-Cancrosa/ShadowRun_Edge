/**
 * Summoning and banishing spirits (core rulebook pp. 146–148, system issue #223). A summoned spirit becomes a
 * system "Spirit" actor (its stats come from Force and type, computed by the system) owned by the summoner's
 * player, with its owed services tracked in module flags. Players who may not create actors get the spirit
 * created by the active GM through the module socket.
 */
import { CORE_SPIRITS, summoningResult, banishingResult, optionalPowers, forceBudget } from "./summoning-rules.mjs";
import { errata } from "./errata.mjs";
import * as rolls from "./sheet/system-rolls.mjs";
import * as ui2 from "./ui/edge-ui.mjs";
import { registerTask, runTest, hitsOf, patchTask } from "./linked-roll.mjs";

const MODULE_ID = "shadowrun-edge";
const SOCKET = `module.${MODULE_ID}`;
const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
const spiritLabel = (type) => L(CONFIG.SR6?.SPIRIT_TYPES?.[type] ?? type);

/** Spirits summoned by this character that still exist. */
export function spiritsOf(actor) {
  return game.actors.filter((a) => a.getFlag(MODULE_ID, "spirit")?.summoner === actor.id);
}

async function hits(pool) {
  const roll = await new Roll(`${Math.max(0, pool)}d6cs>=5`).evaluate();
  return { roll, hits: roll.total };
}

export async function openSummon(actor) {
  const magic = Number(actor.system.attributes?.mag?.pool) || 0;
  const budget = forceBudget(magic, spiritsOf(actor).map((s) => s.system.rating));
  const all = Object.keys(CONFIG.SR6?.SPIRIT_TYPES ?? {});
  const types = [...CORE_SPIRITS.filter((t) => !all.length || all.includes(t)), ...all.filter((t) => !CORE_SPIRITS.includes(t))];
  const pool = Number(actor.system.skills?.conjuring?.pool) || 0;
  const icons = { air: "fas fa-wind", beasts: "fas fa-paw", earth: "fas fa-mountain", fire: "fas fa-fire", kin: "fas fa-user", water: "fas fa-water" };
  const typeTiles = types.map((t, i) => ({
    value: t, label: spiritLabel(t), icon: icons[t] ?? "fas fa-ghost", checked: i === 0,
    small: CORE_SPIRITS.includes(t) ? "" : L("SRE.Summon.OtherBook"),
  }));
  const startForce = Math.max(1, Math.min(magic, budget.left || 1));
  const content = `<div class="sre-ed">
    ${ui2.head({ kind: L("SRE.Summon.Kind"), name: actor.name, sub: L("SRE.Summon.Sub", { magic, used: budget.used, max: budget.max }) })}
    <div class="sre-ed-body">
      ${ui2.tiles([
        { id: "pool", big: pool, label: L("SRE.Roll.Pool"), calc: L("SRE.Summon.PoolCalc"), accent: true },
        { id: "spirit", big: startForce * 2, label: L("SRE.Summon.SpiritRolls"), calc: L("SRE.Summon.SpiritCalc", { force: startForce }) },
      ])}
      ${ui2.panel(L("SRE.Summon.Type"), ui2.options("type", typeTiles, { cards: true }))}
      ${ui2.panel(L("SRE.Summon.Force"), ui2.rows([
        ui2.row(L("SRE.Summon.ForceLabel", { left: budget.left }), ui2.stepper("force", startForce, { min: 1 })),
        ui2.chips([ui2.chip("reagents", L("SRE.Summon.ReagentsShort"))]),
        ui2.row(L("SRE.Heal.ManualHits"), `<input type="number" name="manualHits" min="0" placeholder="—">`),
      ]) + ui2.note("", "ok", { id: "forecast" }) + ui2.note("", "warn", { id: "budget" }))}
    </div>
  </div>`;
  const result = ui2.okOnly(await foundry.applications.api.DialogV2.wait({
    classes: ["sre-dialog"],
    window: { title: L("SRE.Summon.Title", { name: actor.name }) },
    position: { width: 500 },
    content,
    render: (event, dialog) => ui2.wire(dialog, (form) => {
      const force = Math.max(1, Number(form.elements.force.value) || 1);
      ui2.setTile(form, "spirit", { big: force * 2, calc: L("SRE.Summon.SpiritCalc", { force }) });
      const net = pool / 3 - (force * 2) / 3;
      ui2.setNote(form, "forecast", L("SRE.Summon.Forecast", { services: Math.max(0, Math.round(net)), drain: Math.round((force * 2) / 3), magic }));
      ui2.setNote(form, "budget", force > budget.left ? L("SRE.Summon.OverBudget", { max: budget.max }) : "");
      ui2.setMainLabel(dialog, L("SRE.Summon.ButtonN", { n: pool }));
    }),
    buttons: ui2.buttons(L("SRE.Summon.Button"), (e, b) => ({ type: b.form.elements.type.value, force: Number(b.form.elements.force.value) || 1, reagents: b.form.elements.reagents.checked, manualHits: b.form.elements.manualHits.value === "" ? null : Number(b.form.elements.manualHits.value) }), { icon: "fas fa-hat-wizard" }),
    rejectClose: false,
  }));
  if (!result) return;
  if (result.force > budget.left) ui.notifications.warn(L("SRE.Summon.OverBudget", { max: budget.max }));
  // The spirit doesn't spend Edge: its Force × 2 dice are rolled here, the summoner rolls through the system.
  const spirit = await hits(result.force * 2);
  const label = spiritLabel(result.type);
  const task = {
    kind: "summon", actor: actor.uuid, type: result.type, typeLabel: label, force: result.force, magic,
    spiritHits: spirit.hits, reagents: result.reagents, created: false,
  };
  return runTest(actor, { pool, label: L("SRE.Summon.CardTitle", { type: label, force: result.force }), manualHits: result.manualHits, task });
}

const drainType = (physical) => L(physical ? "SRE.Summon.Physical" : "SRE.Summon.Stun");

/** Drain resistance through the system's soak card (its "Apply damage" button puts it on the right monitor). */
async function resistDrain(actorUuid, drain, physical) {
  const actor = await fromUuid(actorUuid);
  if (!actor?.isOwner) return;
  return rolls.rollSoakTest(actor, {
    soakType: "drain", damage: drain, monitor: physical ? "physical" : "stun",
    pool: Number(actor.system.defensepool?.drain?.pool) || 0, label: L("SRE.Summon.DrainLabel", { drain }),
  });
}

registerTask("summon", {
  render(task, hits) {
    const res = summoningResult({ summonerHits: hits, spiritHits: task.spiritHits, magic: task.magic });
    let action = "";
    if (res.success) {
      action = task.created
        ? `<p>${L("SRE.Summon.CreatedShort")}</p>`
        : `<button type="button" class="sre-task-apply">${L("SRE.Summon.CreateButton", { services: res.services })}</button>`;
    }
    return `<div class="sre-blast-card">
      <h3>${L("SRE.Summon.CardTitle", { type: esc(task.typeLabel), force: task.force })}</h3>
      <p>${L("SRE.Summon.CardRolls", { hits, spirit: task.spiritHits, dice: task.force * 2 })}${task.reagents ? ` ${L("SRE.Summon.ReagentsNote")}` : ""}</p>
      <p><strong>${res.success ? L("SRE.Summon.Success", { services: res.services }) : L("SRE.Summon.Failure")}</strong></p>
      ${action}
      <p><button type="button" class="sre-drain">${L("SRE.Summon.DrainButton", { drain: res.drain, type: drainType(res.physical) })}</button></p>
      <p class="hint">${L("SRE.Summon.CardHintEdge")}</p>
    </div>`;
  },
  bind(root, message, task) {
    const res = () => summoningResult({ summonerHits: hitsOf(message), spiritHits: task.spiritHits, magic: task.magic });
    root.querySelector(".sre-drain")?.addEventListener("click", () => resistDrain(task.actor, res().drain, res().physical));
    root.querySelector(".sre-task-apply")?.addEventListener("click", async (event) => {
      const actor = await fromUuid(task.actor);
      if (!actor?.isOwner) return ui.notifications.warn(L("SRE.Blast.NotOwner"));
      const r = res();
      if (!r.success) return;
      event.currentTarget.disabled = true;
      const data = {
        name: L("SRE.Summon.SpiritName", { type: task.typeLabel, force: task.force }),
        type: "Spirit",
        system: { rating: task.force, spiritType: task.type },
        flags: { [MODULE_ID]: { spirit: { summoner: actor.id, services: r.services, force: task.force, worldTime: game.time.worldTime } } },
      };
      if (game.user.can("ACTOR_CREATE")) await createSpirit(data, game.user.id);
      else if (game.users.activeGM) game.socket.emit(SOCKET, { type: "summonSpirit", summonerId: actor.id, data });
      else return ui.notifications.warn(L("SRE.Give.NoGM"));
      ui.notifications.info(L("SRE.Summon.Created", { name: data.name, services: r.services, powers: optionalPowers(task.force) }).replace(/<[^>]+>/g, ""));
      await patchTask(message, { created: true });
    });
  },
});

/** Creates the spirit actor, owned by the summoning user. */
async function createSpirit(data, userId) {
  const owner = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
  return Actor.implementation.create({ ...data, ownership: { default: 0, [userId]: owner } });
}

/** Banishing the targeted spirit (Conjuring + Magic vs Force × 2; net hits remove services). */
export async function openBanish(actor) {
  const target = [...game.user.targets][0]?.actor ?? canvas?.tokens?.controlled?.find((t) => t.actor?.type === "Spirit")?.actor;
  if (!target || target.type !== "Spirit") return ui.notifications.warn(L("SRE.Summon.TargetSpirit"));
  const force = Number(target.system.rating) || 1;
  const flag = target.getFlag(MODULE_ID, "spirit");
  const banishPool = Number(actor.system.skills?.conjuring?.pool) || 0;
  const content = `<div class="sre-ed">
    ${ui2.head({ kind: L("SRE.Summon.BanishKind"), name: target.name, sub: L("SRE.Summon.BanishSub", { force }) })}
    <div class="sre-ed-body">
      ${ui2.tiles([
        { big: banishPool, label: L("SRE.Roll.Pool"), calc: L("SRE.Summon.PoolCalc"), accent: true },
        { big: force * 2, label: L("SRE.Summon.SpiritRolls"), calc: L("SRE.Summon.SpiritCalc", { force }) },
      ])}
      ${ui2.panel(L("SRE.Summon.Options"), ui2.rows([
        ui2.row(L("SRE.Summon.ServicesLeft"), ui2.stepper("services", flag?.services ?? 1, { min: 0 })),
        ui2.chips([ui2.chip("reagents", L("SRE.Summon.ReagentsShort"))]),
        ui2.row(L("SRE.Heal.ManualHits"), `<input type="number" name="manualHits" min="0" placeholder="—">`),
      ]))}
      ${ui2.note(L("SRE.Summon.BanishHintShort"), "info")}
    </div>
  </div>`;
  const result = ui2.okOnly(await foundry.applications.api.DialogV2.wait({
    classes: ["sre-dialog"],
    window: { title: L("SRE.Summon.BanishTitle", { name: target.name }) },
    position: { width: 480 },
    content,
    render: (event, dialog) => ui2.wire(dialog),
    buttons: ui2.buttons(L("SRE.Summon.BanishButton"), (e, b) => ({ services: Number(b.form.elements.services.value) || 0, reagents: b.form.elements.reagents.checked, manualHits: b.form.elements.manualHits.value === "" ? null : Number(b.form.elements.manualHits.value) }), { icon: "fas fa-ban" }),
    rejectClose: false,
  }));
  if (!result) return;
  const spirit = await hits(force * 2);
  const task = {
    kind: "banish", actor: actor.uuid, target: target.uuid, targetName: target.name, force, services: result.services,
    spiritHits: spirit.hits, magic: Number(actor.system.attributes?.mag?.pool) || 0, finalDrain: errata("banishFinalDrain"), applied: false,
  };
  return runTest(actor, { pool: banishPool, label: L("SRE.Summon.BanishCard", { name: target.name }), manualHits: result.manualHits, task });
}

registerTask("banish", {
  render(task, hits) {
    const res = banishingResult({ banisherHits: hits, spiritHits: task.spiritHits, services: task.services });
    const physical = !task.finalDrain && res.drain > task.magic;
    return `<div class="sre-blast-card">
      <h3>${L("SRE.Summon.BanishCard", { name: esc(task.targetName) })}</h3>
      <p>${L("SRE.Summon.CardRolls", { hits, spirit: task.spiritHits, dice: task.force * 2 })}</p>
      <p><strong>${res.departs ? L("SRE.Summon.Departs") : L("SRE.Summon.ServicesNow", { n: res.servicesLeft, net: res.net })}</strong></p>
      ${res.net > 0 ? `<button type="button" class="sre-task-apply"${task.applied ? " disabled" : ""}>${L(task.applied ? "SRE.Heal.Applied" : "SRE.Summon.ApplyBanish")}</button>` : ""}
      <p><button type="button" class="sre-drain">${L("SRE.Summon.DrainButton", { drain: res.drain, type: drainType(physical) })}</button></p>
      <p class="hint">${L(task.finalDrain ? "SRE.Summon.BanishDrainFinal" : "SRE.Summon.BanishDrainInitial", { magic: task.magic })}</p>
    </div>`;
  },
  bind(root, message, task) {
    const res = () => banishingResult({ banisherHits: hitsOf(message), spiritHits: task.spiritHits, services: task.services });
    root.querySelector(".sre-drain")?.addEventListener("click", () => {
      const r = res();
      return resistDrain(task.actor, r.drain, !task.finalDrain && r.drain > task.magic);
    });
    root.querySelector(".sre-task-apply")?.addEventListener("click", async (event) => {
      event.currentTarget.disabled = true;
      const target = await fromUuid(task.target);
      if (target?.getFlag(MODULE_ID, "spirit")) await setServices(target, res().servicesLeft);
      await patchTask(message, { applied: true });
    });
  },
});

/** Owed services of a module-summoned spirit (the spirit's owner, or the GM through the socket). */
export async function setServices(spirit, services) {
  const flag = spirit.getFlag(MODULE_ID, "spirit");
  if (!flag) return;
  const next = Math.max(0, Number(services) || 0);
  if (spirit.isOwner) return spirit.setFlag(MODULE_ID, "spirit", { ...flag, services: next });
  if (game.users.activeGM) game.socket.emit(SOCKET, { type: "spiritServices", spiritId: spirit.id, services: next });
}

/** Drain buttons on older chat cards. */
Hooks.on("renderChatMessageHTML", (message, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  // Cards from before 0.18 (the drain value is on the button); newer cards bind their own buttons.
  for (const button of root?.querySelectorAll(".sre-drain[data-actor]") ?? []) {
    button.addEventListener("click", () => resistDrain(button.dataset.actor, Number(button.dataset.drain) || 0, button.dataset.physical === "1"));
  }
});

Hooks.once("ready", () => {
  game.socket.on(SOCKET, async (data, senderId) => {
    if (!game.users.activeGM?.isSelf) return;
    const user = game.users.get(senderId);
    if (data?.type === "summonSpirit") {
      const summoner = game.actors.get(data.summonerId);
      // Only for the owner of the summoning character, and only a Spirit linked to it.
      if (!user || !summoner?.testUserPermission(user, "OWNER") || data.data?.type !== "Spirit") return;
      if (data.data.flags?.[MODULE_ID]?.spirit?.summoner !== summoner.id) return;
      await createSpirit(data.data, user.id);
    }
    if (data?.type === "spiritServices") {
      const spirit = game.actors.get(data.spiritId);
      const flag = spirit?.getFlag(MODULE_ID, "spirit");
      const summoner = flag && game.actors.get(flag.summoner);
      const next = Math.max(0, Number(data.services) || 0);
      // The summoner's owner may set the services; anyone may lower them (a banishing by an opponent).
      if (!user || !(summoner?.testUserPermission(user, "OWNER") || next < (Number(flag.services) || 0))) return;
      await spirit.setFlag(MODULE_ID, "spirit", { ...flag, services: next });
    }
  });
});
