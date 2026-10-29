/**
 * Summoning and banishing spirits (core rulebook pp. 146–148, system issue #223). A summoned spirit becomes a
 * system "Spirit" actor (its stats come from Force and type, computed by the system) owned by the summoner's
 * player, with its owed services tracked in module flags. Players who may not create actors get the spirit
 * created by the active GM through the module socket.
 */
import { CORE_SPIRITS, summoningResult, banishingResult, optionalPowers, forceBudget } from "./summoning-rules.mjs";
import { errata } from "./errata.mjs";
import * as rolls from "./sheet/system-rolls.mjs";

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

function drainButton(actor, drain, physical) {
  return `<button type="button" class="sre-drain" data-actor="${actor.uuid}" data-drain="${drain}">${L("SRE.Summon.DrainButton", { drain, type: L(physical ? "SRE.Summon.Physical" : "SRE.Summon.Stun") })}</button>`;
}

export async function openSummon(actor) {
  const magic = Number(actor.system.attributes?.mag?.pool) || 0;
  const budget = forceBudget(magic, spiritsOf(actor).map((s) => s.system.rating));
  const all = Object.keys(CONFIG.SR6?.SPIRIT_TYPES ?? {});
  const types = [...CORE_SPIRITS.filter((t) => !all.length || all.includes(t)), ...all.filter((t) => !CORE_SPIRITS.includes(t))];
  const list = types.map((t) => `<option value="${t}">${esc(spiritLabel(t))}${CORE_SPIRITS.includes(t) ? "" : ` (${L("SRE.Summon.OtherBook")})`}</option>`).join("");
  const pool = Number(actor.system.skills?.conjuring?.pool) || 0;
  const result = await foundry.applications.api.DialogV2.prompt({
    classes: ["sre-dialog"],
    window: { title: L("SRE.Summon.Title", { name: actor.name }) },
    content: `<div class="sre-heal">
      <p class="sre-heal-state">${L("SRE.Summon.Info", { pool, magic, used: budget.used, max: budget.max })}</p>
      <label>${L("SRE.Summon.Type")} <select name="type">${list}</select></label>
      <label>${L("SRE.Summon.Force")} <input type="number" name="force" value="${Math.max(1, Math.min(magic, budget.left || 1))}" min="1" max="${Math.max(1, budget.left)}"></label>
      <label class="checkbox"><input type="checkbox" name="reagents"> ${L("SRE.Summon.Reagents")}</label>
      <label>${L("SRE.Heal.ManualHits")} <input type="number" name="manualHits" min="0" placeholder="${L("SRE.Heal.ManualHitsPlaceholder")}"></label>
      <p class="hint">${L("SRE.Summon.Hint")}</p>
    </div>`,
    ok: { label: L("SRE.Summon.Button"), callback: (e, b) => ({ type: b.form.elements.type.value, force: Number(b.form.elements.force.value) || 1, reagents: b.form.elements.reagents.checked, manualHits: b.form.elements.manualHits.value === "" ? null : Number(b.form.elements.manualHits.value) }) },
    rejectClose: false,
  });
  if (!result) return;
  if (result.force > budget.left) ui.notifications.warn(L("SRE.Summon.OverBudget", { max: budget.max }));
  const summoner = result.manualHits === null ? await hits(pool) : { roll: null, hits: result.manualHits };
  const spirit = await hits(result.force * 2);
  const res = summoningResult({ summonerHits: summoner.hits, spiritHits: spirit.hits, magic });
  const label = spiritLabel(result.type);
  let created = "";
  if (res.success) {
    const data = {
      name: L("SRE.Summon.SpiritName", { type: label, force: result.force }),
      type: "Spirit",
      system: { rating: result.force, spiritType: result.type },
      flags: { [MODULE_ID]: { spirit: { summoner: actor.id, services: res.services, force: result.force, worldTime: game.time.worldTime } } },
    };
    if (game.user.can("ACTOR_CREATE")) await createSpirit(data, game.user.id);
    else if (game.users.activeGM) game.socket.emit(SOCKET, { type: "summonSpirit", summonerId: actor.id, data });
    else ui.notifications.warn(L("SRE.Give.NoGM"));
    created = `<p>${L("SRE.Summon.Created", { name: esc(data.name), services: res.services, powers: optionalPowers(result.force) })}</p>`;
  }
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    rolls: [summoner.roll, spirit.roll].filter(Boolean),
    content: `<div class="sre-blast-card">
      <h3>${L("SRE.Summon.CardTitle", { type: esc(label), force: result.force })}</h3>
      <p>${L("SRE.Summon.CardRolls", { hits: summoner.hits, spirit: spirit.hits, dice: result.force * 2 })}${result.reagents ? ` ${L("SRE.Summon.ReagentsNote")}` : ""}</p>
      <p><strong>${res.success ? L("SRE.Summon.Success", { services: res.services }) : L("SRE.Summon.Failure")}</strong></p>
      ${created}
      <p>${drainButton(actor, res.drain, res.physical)}</p>
      <p class="hint">${L("SRE.Summon.CardHint")}</p>
    </div>`,
  });
}

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
  const result = await foundry.applications.api.DialogV2.prompt({
    classes: ["sre-dialog"],
    window: { title: L("SRE.Summon.BanishTitle", { name: target.name }) },
    content: `<div class="sre-heal">
      <p class="sre-heal-state">${L("SRE.Summon.BanishInfo", { name: esc(target.name), force, pool: Number(actor.system.skills?.conjuring?.pool) || 0 })}</p>
      <label>${L("SRE.Summon.ServicesLeft")} <input type="number" name="services" value="${flag?.services ?? 1}" min="0"></label>
      <label class="checkbox"><input type="checkbox" name="reagents"> ${L("SRE.Summon.Reagents")}</label>
      <label>${L("SRE.Heal.ManualHits")} <input type="number" name="manualHits" min="0" placeholder="${L("SRE.Heal.ManualHitsPlaceholder")}"></label>
    </div>`,
    ok: { label: L("SRE.Summon.BanishButton"), callback: (e, b) => ({ services: Number(b.form.elements.services.value) || 0, reagents: b.form.elements.reagents.checked, manualHits: b.form.elements.manualHits.value === "" ? null : Number(b.form.elements.manualHits.value) }) },
    rejectClose: false,
  });
  if (!result) return;
  const pool = Number(actor.system.skills?.conjuring?.pool) || 0;
  const banisher = result.manualHits === null ? await hits(pool) : { roll: null, hits: result.manualHits };
  const spirit = await hits(force * 2);
  const res = banishingResult({ banisherHits: banisher.hits, spiritHits: spirit.hits, services: result.services });
  if (flag) await setServices(target, res.servicesLeft);
  const magic = Number(actor.system.attributes?.mag?.pool) || 0;
  const finalDrain = errata("banishFinalDrain");
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    rolls: [banisher.roll, spirit.roll].filter(Boolean),
    content: `<div class="sre-blast-card">
      <h3>${L("SRE.Summon.BanishCard", { name: esc(target.name) })}</h3>
      <p>${L("SRE.Summon.CardRolls", { hits: banisher.hits, spirit: spirit.hits, dice: force * 2 })}</p>
      <p><strong>${res.departs ? L("SRE.Summon.Departs") : L("SRE.Summon.ServicesNow", { n: res.servicesLeft, net: res.net })}</strong></p>
      <p>${drainButton(actor, res.drain, !finalDrain && res.drain > magic)}</p>
      <p class="hint">${L(finalDrain ? "SRE.Summon.BanishDrainFinal" : "SRE.Summon.BanishDrainInitial", { magic })}</p>
    </div>`,
  });
}

/** Owed services of a module-summoned spirit (the spirit's owner, or the GM through the socket). */
export async function setServices(spirit, services) {
  const flag = spirit.getFlag(MODULE_ID, "spirit");
  if (!flag) return;
  const next = Math.max(0, Number(services) || 0);
  if (spirit.isOwner) return spirit.setFlag(MODULE_ID, "spirit", { ...flag, services: next });
  if (game.users.activeGM) game.socket.emit(SOCKET, { type: "spiritServices", spiritId: spirit.id, services: next });
}

/** Drain resistance from the chat card, through the system's roll dialog (Edge, modifiers). */
Hooks.on("renderChatMessageHTML", (message, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  for (const button of root?.querySelectorAll(".sre-drain") ?? []) {
    button.addEventListener("click", async () => {
      const actor = await fromUuid(button.dataset.actor);
      if (!actor?.isOwner) return;
      const pool = Number(actor.system.defensepool?.drain?.pool) || 0;
      return rolls.rollPool(actor, { pool, label: L("SRE.Summon.DrainLabel", { drain: button.dataset.drain }), kind: "defense" });
    });
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
