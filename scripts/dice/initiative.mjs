/**
 * Stage 13C: Initiative and Edge outside a roll, on the Edge engine.
 * - Initiative (p. 39): Initiative rank + Initiative Dice (at most 5D6) added up; the score goes to the combat
 *   tracker when the actor fights in the current combat. "+3 to your Initiative Score" (1 Edge, p. 46) before or
 *   during the fight, from the window or later from the card.
 * - Edge any time (pp. 46–47): give an ally 1 Edge (2), heal a Stun box (3), heal a Physical box (4), a special
 *   effect (5, the gamemaster says what happens). Each is one expenditure; the same boost may be multiplied.
 */
import * as R from "./dice-rules.mjs";
import * as ui2 from "../ui/edge-ui.mjs";
import { canBreakRules } from "../ui/conflict.mjs";
import { edgeOf, spendEdge, edgeLocked } from "./edge-roll.mjs";

const MODULE_ID = "shadowrun-edge";
const FLAG = "initiative";
const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== "" && v !== null ? Number(v) : d);

/** Initiative Score (p. 39). Pure. */
export function initiativeScore(base, faces, { mod = 0, boosts = 0 } = {}) {
  return num(base) + faces.reduce((s, f) => s + num(f), 0) + num(mod) + 3 * num(boosts);
}

function combatantOf(actor, combat = game.combat) {
  if (!combat || !actor) return null;
  const base = actor.isToken ? actor.token?.baseActor ?? actor : actor;
  return combat.combatants.find((c) => (actor.isToken ? c.tokenId === actor.token?.id : c.actor?.id === base.id)) ?? null;
}

/**
 * Puts the score into the combat tracker (and so into the Carousel, which reads it): the actor's combatant gets it;
 * an actor not yet fighting joins with its tokens on the viewed scene first (creating the combat when there is none),
 * as Foundry's own "roll initiative" does.
 */
async function toTracker(actor, total, combatant = null) {
  let c = combatant ?? combatantOf(actor);
  if (!c) {
    const tokens = actor.isToken ? [actor.token] : (actor.getActiveTokens?.(true, true) ?? []);
    const docs = tokens.map((t) => t?.document ?? t).filter((t) => t && t.parent?.id === canvas?.scene?.id);
    if (!docs.length) return false;
    try {
      const TD = foundry.documents?.TokenDocument ?? TokenDocument;
      await (TD.implementation ?? TD).createCombatants(docs);
    } catch (err) {
      console.warn("shadowrun-edge | initiative: could not join combat", err);
      return false;
    }
    c = combatantOf(actor);
  }
  if (!c) return false;
  if (c.isOwner) await c.combat.setInitiative(c.id, total);
  else if (game.users.activeGM) game.socket.emit("module.shadowrun-edge", { type: "sre-init", combatId: c.combat.id, combatantId: c.id, total });
  return true;
}

Hooks.once("ready", () => {
  game.socket.on("module.shadowrun-edge", async (data, senderId) => {
    if (data?.type !== "sre-init" || !game.users.activeGM?.isSelf) return;
    const combat = game.combats.get(data.combatId);
    const c = combat?.combatants.get(data.combatantId);
    const user = game.users.get(senderId);
    // Only for a combatant whose actor the sender owns.
    if (!c || !user || !c.actor?.testUserPermission(user, "OWNER")) return;
    await combat.setInitiative(c.id, Number(data.total) || 0);
  });
});

function cardHtml(d) {
  const faces = d.faces.map((f, i) => `<span style="--i:${i}" class="sre-die${f >= 5 ? " hit" : ""}">${f}</span>`).join("");
  const parts = [`${d.base}`, `${d.faces.join("+") || 0}`, d.mod ? `${d.mod > 0 ? "+" : ""}${d.mod}` : "", d.boosts ? `+${3 * d.boosts} Edge` : ""].filter(Boolean).join(" + ").replace(/\+ -/g, "− ");
  return `<div class="sre-rc sre-rc-init" data-sre-card="initiative">
    <header class="sre-rc-head">${d.img ? `<img src="${esc(d.img)}" alt="">` : ""}<div><div class="sre-rc-kind">${esc(L("SRE.Roll.Kind.initiative"))}</div><div class="sre-rc-title">${esc(d.label)}</div></div></header>
    <div class="sre-dice-strip">${faces}</div>
    <div class="sre-rc-result"><span class="sre-rc-hits"><b>${d.total}</b> ${esc(L("SRE.Roll.InitScore"))}</span><span class="sre-rc-pool">${esc(parts)}</span></div>
    ${d.tracked ? `<div class="sre-rc-note">${esc(L("SRE.Roll.InitTracked"))}</div>` : ""}
    <div class="sre-rc-post" data-owner-only><button type="button" data-sre-init="boost"><i class="fas fa-bolt"></i> ${esc(L("SRE.Roll.InitBoost"))}</button></div>
  </div>`;
}

/**
 * Rolls Initiative with the Edge window.
 * @param {Actor} actor
 * @param {{ base: number, dice: number, label: string }} ini  from the system's prepared initiative
 */
export async function initiativeTest(actor, { base, dice, label, quick = false, combatant = null, rollMode = null }) {
  const n = R.initiativeDice(dice);
  const { value } = edgeOf(actor);
  const locked = edgeLocked(actor) && !canBreakRules();
  const content = `<div class="sre-ed">${ui2.head({ kind: L("SRE.Roll.Kind.initiative"), name: label })}<div class="sre-ed-body">
    ${ui2.tiles([{ id: "base", big: num(base), label: L("SRE.Roll.InitRank"), accent: true }, { id: "dice", big: `${n}D6`, label: L("SRE.Roll.InitDice") }, { id: "edge", big: value, label: "Edge" }])}
    ${ui2.panel(L("SRE.Roll.Modifiers"), ui2.rows([ui2.row(L("SRE.Roll.Modifier"), ui2.stepper("mod", 0, { min: -20, max: 20 }))]) + (locked ? "" : ui2.chips([ui2.chip("boost", L("SRE.Roll.InitBoost"), { value: "1 Edge" })])))}
  </div></div>`;
  // From the combat tracker or the Carousel: no window (the +3 boost stays on the card for later).
  const o = quick ? { mod: 0, boost: false } : ui2.okOnly(await foundry.applications.api.DialogV2.wait({
    classes: ["sre-dialog"], window: { title: label, icon: "fas fa-bolt" }, position: { width: 420 }, content,
    buttons: ui2.buttons(L("SRE.Roll.RollButton", { n }), (event, button) => {
      const f = new FormData(button.form);
      return { mod: num(f.get("mod")), boost: f.has("boost") };
    }, { icon: "fas fa-dice-six" }),
    render: (event, dialog) => ui2.wire(dialog),
    rejectClose: false,
  }));
  if (!o) return null;
  let boosts = 0;
  if (o.boost) {
    if (value < 1 && !canBreakRules()) ui.notifications.warn(L("SRE.Roll.WarnEdge", { n: 1, have: value }));
    else {
      await spendEdge(actor, 1);
      boosts = 1;
    }
  }
  const roll = await new Roll(`${n}d6`).evaluate();
  const faces = roll.dice[0]?.results.map((r) => r.result) ?? [];
  const d = { actorUuid: actor.uuid, combatantUuid: combatant?.uuid ?? null, label, img: actor.img, base: num(base), faces, mod: o.mod, boosts };
  d.total = initiativeScore(d.base, faces, d);
  d.tracked = await toTracker(actor, d.total, combatant);
  const msg = {
    speaker: ChatMessage.getSpeaker({ actor, token: combatant?.token ?? undefined }), content: cardHtml(d), rolls: [roll], sound: CONFIG.sounds.dice,
    flags: { [MODULE_ID]: { [FLAG]: d } },
  };
  ChatMessage.applyRollMode(msg, rollMode ?? game.settings.get("core", "rollMode"));
  return ChatMessage.create(msg);
}

async function boostLater(message) {
  const d = foundry.utils.deepClone(message.getFlag(MODULE_ID, FLAG));
  const actor = await fromUuid(d.actorUuid);
  if (!actor?.isOwner) return;
  const { value } = edgeOf(actor);
  if ((value < 1 || (edgeLocked(actor))) && !canBreakRules()) return ui.notifications.warn(L("SRE.Roll.WarnEdge", { n: 1, have: value }));
  await spendEdge(actor, 1);
  d.boosts += 1;
  d.total = initiativeScore(d.base, d.faces, d);
  d.tracked = await toTracker(actor, d.total, d.combatantUuid ? fromUuidSync(d.combatantUuid) : null);
  return message.update({ content: cardHtml(d), [`flags.${MODULE_ID}.${FLAG}`]: d });
}

Hooks.on("renderChatMessageHTML", (message, html) => {
  const d = message.getFlag(MODULE_ID, FLAG);
  if (!d) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  const card = root?.querySelector("[data-sre-card=initiative]");
  if (!card) return;
  let owner = false;
  try {
    owner = !!fromUuidSync(d.actorUuid)?.isOwner;
  } catch {
    owner = message.isOwner;
  }
  if (!owner) card.querySelectorAll("[data-owner-only]").forEach((el) => el.remove());
  card.querySelector("[data-sre-init=boost]")?.addEventListener("click", (e) => {
    e.preventDefault();
    boostLater(message);
  });
});

// ───── Edge any time ─────

const ANYTIME = ["give_ally", "heal_stun", "heal_physical", "special_effect"];

/** The window for Edge Boosts outside a roll. */
export async function edgeAnytime(actor) {
  if (!actor) return null;
  const { value } = edgeOf(actor);
  if (edgeLocked(actor) && !canBreakRules()) return ui.notifications.warn(L("SRE.Roll.Edge.locked"));
  const allies = game.actors.filter((a) => a.type === "Player" && a.id !== actor.id && a.hasPlayerOwner);
  const content = `<div class="sre-ed">${ui2.head({ kind: L("SRE.Roll.Anytime.Kind"), name: actor.name, sub: L("SRE.Roll.Edge.have", { n: value }) })}<div class="sre-ed-body">
    ${ui2.panel(L("SRE.Roll.Anytime.Boost"), ui2.options("boost", ANYTIME.map((id, i) => {
      const b = R.BOOSTS.find((x) => x.id === id);
      return { value: id, label: L(`SRE.Roll.Boost.${id}`), small: `${b.cost} Edge${b.multi ? ` · ${L("SRE.Roll.Anytime.Multi")}` : ""}`, checked: i === 0, disabled: b.cost > value && !canBreakRules() };
    })))}
    ${ui2.panel(L("SRE.Roll.Anytime.Times"), ui2.rows([ui2.row(L("SRE.Roll.Anytime.Times"), ui2.stepper("times", 1, { min: 1, max: 7 }))]))}
    ${allies.length ? `<div data-for="give_ally">${ui2.panel(L("SRE.Roll.Anytime.Ally"), ui2.options("ally", allies.map((a, i) => ({ value: a.uuid, label: a.name, avatar: { img: a.img, name: a.name }, checked: i === 0 })), { people: true }))}</div>` : ""}
    ${ui2.note("", "warn", { id: "warn" })}
  </div></div>`;
  const o = ui2.okOnly(await foundry.applications.api.DialogV2.wait({
    classes: ["sre-dialog"], window: { title: actor.name, icon: "fas fa-bolt" }, position: { width: 460 }, content,
    buttons: ui2.buttons(L("SRE.Roll.Anytime.Spend"), (event, button) => {
      const f = new FormData(button.form);
      return { boost: f.get("boost"), times: Math.max(1, num(f.get("times"), 1)), ally: f.get("ally") };
    }, { icon: "fas fa-bolt" }),
    render: (event, dialog) => ui2.wire(dialog, (form) => {
      const f = new FormData(form);
      const id = f.get("boost");
      ui2.showFor(form, id);
      const b = R.BOOSTS.find((x) => x.id === id);
      const times = b?.multi ? Math.max(1, num(f.get("times"), 1)) : 1;
      const cost = R.costOf(b, times);
      ui2.setNote(dialog.element, "warn", cost > value ? L("SRE.Roll.WarnEdge", { n: cost, have: value }) : "");
    }),
    rejectClose: false,
  }));
  if (!o?.boost) return null;
  const b = R.BOOSTS.find((x) => x.id === o.boost);
  const times = b.multi ? o.times : 1;
  const cost = R.costOf(b, times);
  if (cost > value && !canBreakRules()) return ui.notifications.warn(L("SRE.Roll.WarnEdge", { n: cost, have: value }));
  await spendEdge(actor, cost);
  let text = L(`SRE.Roll.Anytime.Done.${o.boost}`, { n: times, name: actor.name });
  if (o.boost === "heal_stun" || o.boost === "heal_physical") {
    const key = o.boost === "heal_stun" ? "stun" : "physical";
    const dmg = num(actor.system?.[key]?.dmg);
    await actor.update({ [`system.${key}.dmg`]: Math.max(0, dmg - times) });
  } else if (o.boost === "give_ally" && o.ally) {
    const ally = await fromUuid(o.ally);
    if (ally) {
      text = L("SRE.Roll.Anytime.Done.give_ally", { n: times, name: actor.name, ally: ally.name });
      if (ally.isOwner) await ally.update({ "system.edge.value": Math.min(R.EDGE_CAP, num(ally.system?.edge?.value) + times) });
      else game.socket.emit(`module.${MODULE_ID}`, { type: "sre-edge-add", uuid: ally.uuid, n: times });
    }
  }
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<div class="sre-rc"><div class="sre-rc-edge"><i class="fas fa-bolt"></i> ${esc(text)} (${cost} Edge)</div></div>` });
}

/** Initiative rank and dice of a combatant for its initiative type (the system's iniType flag). Pure-ish. */
export function initiativeOf(combatant) {
  const actor = combatant?.actor;
  const type = combatant?.getFlag?.("shadowrun6-eden", "iniType") ?? "physical";
  const ini = actor?.system?.initiative?.[type] ?? actor?.system?.initiative?.physical ?? actor?.system?.initiative?.matrix ?? {};
  return {
    base: num(ini.pool, num(ini.rank)), dice: num(ini.dicePool, num(ini.dice, 1)),
    label: `${game.i18n?.localize?.(`SRE.Sheet.Initiative.${type}`) ?? type}: ${combatant?.name ?? actor?.name ?? ""}`,
  };
}
