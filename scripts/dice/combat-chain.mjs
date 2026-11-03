/**
 * Stage 13C: the combat chain on the Edge engine's cards (core rulebook pp. 104–107 with the February 2020 errata
 * p. 105, combat spells pp. 132–133): attack → each target's defense test → hit or miss with the net hits → damage
 * resistance → Apply. The numbers come from the system's prepared data (defense pools, Body soak pool); the steps
 * are the module's.
 * - Weapons: Defense test against the attacker's hits; ties go to the attacker (errata); DV + net hits; soak.
 * - Direct Combat spells: Willpower + Intuition; net hits (+ Amp Up) are the damage, not resisted.
 * - Indirect Combat spells: Reaction + Willpower; Magic / 2 (up) + net hits + Amp Up; Body resists.
 * - Defense Rating ≥ Attack Rating + 4 gives the defender a point of Edge when they defend (p. 45).
 * - Edge Actions carried from the attack: Called Shot — Disarm (no damage), Knockout Blow (damage > Willpower:
 *   Stun monitor filled), Tumble (damage > Body: Prone).
 */
import * as R from "./dice-rules.mjs";
import { edgeTest, engineData, engineHits, gainEdge } from "./edge-roll.mjs";
import { errata } from "../errata.mjs";

const MODULE_ID = "shadowrun-edge";
const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== "" && v !== null ? Number(v) : d);

/** What an attack card asks of its targets (null for other cards). Pure. */
export function chainOf(data) {
  if (!data) return null;
  if (data.kind === "weapon" && data.attack) {
    return { defense: "physical", soak: "damage_physical", base: num(data.attack.dv), stun: !!data.attack.stun, resist: true, ar: num(data.attack.ar), effects: data.attack.effects ?? [], bullets: !!data.attack.bullets };
  }
  if ((data.kind === "spell") && data.spell?.combat) {
    const direct = !data.spell.indirect;
    const amp = num(data.spell.ampUp);
    return {
      defense: direct ? "spells_direct" : "spells_indirect", soak: direct ? null : "damage_physical",
      base: direct ? amp : Math.ceil(num(data.spell.magic) / 2) + amp, stun: data.spell.damage === "stun", resist: !direct,
      ar: num(data.spell.ar), effects: [],
    };
  }
  return null;
}

/** The result of a defense against an attack. Pure. */
export function outcome(chain, attackHits, defenseHits, { tiesToAttacker = true } = {}) {
  const o = R.opposed(attackHits, defenseHits, { tiesToAttacker });
  if (!o.wins) return { hit: false, net: 0 };
  if (chain.effects?.includes("disarm")) return { hit: true, net: o.net, disarm: true, dv: 0 };
  return { hit: true, net: o.net, dv: num(chain.base) + o.net, resist: !!chain.resist, monitor: chain.stun ? "stun" : "physical" };
}

/** You can't dodge bullets (system option): the attack's own Simple test decides; net hits over the threshold add. Pure. */
export function bulletOutcome(chain, result) {
  if (!result?.success) return { hit: false, net: 0 };
  if (chain.effects?.includes("disarm")) return { hit: true, net: num(result.net), disarm: true, dv: 0 };
  return { hit: true, net: num(result.net), dv: num(chain.base) + num(result.net), resist: true, monitor: chain.stun ? "stun" : "physical" };
}

/** After damage resistance: what the attack's Edge Actions do (Knockout Blow, Tumble). Pure. */
export function afterDamage(effects = [], damage, { wil = 0, bod = 0 } = {}) {
  const out = [];
  if (effects.includes("knockout_blow") && damage > num(wil)) out.push("knockout");
  if (effects.includes("tumble") && damage > num(bod)) out.push("prone");
  return out;
}

function tiesToAttacker() {
  try {
    return errata("tiesToAttacker") !== false;
  } catch {
    return true;
  }
}

/** The defender for a button without a target: the selected token, else the user's character. */
function pickedDefender() {
  return canvas?.tokens?.controlled?.[0]?.actor ?? game.user.character ?? null;
}

async function defend(attackMessage, target) {
  const data = engineData(attackMessage);
  const chain = chainOf(data);
  const actor = target?.uuid ? await fromUuid(target.uuid) : pickedDefender();
  const defender = actor?.actor ?? actor;
  if (!defender) return ui.notifications.warn(L("SRE.Defend.NoDefender"));
  if (!defender.isOwner) return ui.notifications.warn(L("SRE.Roll.NotYours"));
  // Defense Rating 4 above the Attack Rating: the defender gains a point of Edge (p. 45).
  const dr = num(defender.system?.defenserating?.physical?.pool);
  if (chain.ar && R.edgeFromRatings(chain.ar, dr).defender) await gainEdge(defender, 1);
  const pool = num(defender.system?.defensepool?.[chain.defense]?.pool);
  return edgeTest(defender, {
    kind: "defense", title: data.title || data.label, label: L(`SRE.Chain.Defense.${chain.defense}`), pool, useSustain: false,
    context: chain.defense === "physical" ? ["block", "hit_dirt"] : [], allowBuy: true, img: defender.img,
    extra: { chain: { attackId: attackMessage.id, target: defender.uuid } },
  });
}

async function resist(defenseMessage, attackMessage) {
  const def = engineData(defenseMessage);
  const atk = engineData(attackMessage);
  const chain = chainOf(atk);
  const o = outcome(chain, engineHits(attackMessage), num(def.result?.hits), { tiesToAttacker: tiesToAttacker() });
  const defender = await fromUuid(def.actorUuid);
  if (!defender?.isOwner || !o.hit || o.disarm) return;
  if (!o.resist) return applyDirect(defenseMessage, defender, o);
  const pool = num(defender.system?.defensepool?.[chain.soak]?.pool);
  const m = await edgeTest(defender, {
    kind: "soak", title: atk.title || atk.label, label: L("SRE.Chain.SoakLabel", { dv: o.dv }), pool, useWound: false, allowBuy: false, allowThreshold: false,
    img: defender.img,
    soak: {
      dv: o.dv, monitor: o.monitor, kind: "damage", effects: chain.effects,
      wil: num(defender.system?.attributes?.wil?.pool), bod: num(defender.system?.attributes?.bod?.pool),
    },
    extra: { chain: { defenseId: defenseMessage.id } },
  });
  if (m) await markDefense(defenseMessage, { soakId: m.id });
}

/** You can't dodge bullets: a target resists straight from the attack card. */
async function resistFromAttack(attackMessage, target) {
  const atk = engineData(attackMessage);
  const chain = chainOf(atk);
  const o = bulletOutcome(chain, atk.result);
  const actor = target?.uuid ? await fromUuid(target.uuid) : pickedDefender();
  const defender = actor?.actor ?? actor;
  if (!defender?.isOwner || !o.hit || o.disarm) return;
  return edgeTest(defender, {
    kind: "soak", title: atk.title || atk.label, label: L("SRE.Chain.SoakLabel", { dv: o.dv }), pool: num(defender.system?.defensepool?.[chain.soak]?.pool),
    useWound: false, allowBuy: false, allowThreshold: false, img: defender.img,
    soak: { dv: o.dv, monitor: o.monitor, kind: "damage", effects: chain.effects, wil: num(defender.system?.attributes?.wil?.pool), bod: num(defender.system?.attributes?.bod?.pool) },
  });
}

/** Direct Combat spells: the damage is not resisted (p. 132). */
async function applyDirect(defenseMessage, defender, o) {
  const { applyDamage } = await import("../sheet/system-rolls.mjs");
  await applyDamage(defender, o.monitor, o.dv);
  await markDefense(defenseMessage, { applied: true });
}

async function markDefense(message, patch) {
  const data = foundry.utils.deepClone(engineData(message));
  data.extra.chain = { ...data.extra.chain, ...patch };
  const update = { [`flags.${MODULE_ID}.roll`]: data };
  if (message.isOwner) return message.update(update);
}

/** Who may press a target's button: its owners (the GM always). */
function canUse(uuid) {
  if (game.user.isGM) return true;
  try {
    return !!fromUuidSync(uuid)?.isOwner;
  } catch {
    return false;
  }
}

Hooks.on("sre.renderRollCard", (message, card, data) => {
  // ── An attack: a defense button per target ──
  const chain = chainOf(data);
  if (chain) {
    const box = document.createElement("div");
    box.className = "sre-rc-chain";
    const list = data.targets?.length ? data.targets : [null];
    const bullets = chain.bullets ? bulletOutcome(chain, data.result) : null;
    const button = (i) => (bullets
      ? (bullets.hit && !bullets.disarm ? `<button type="button" data-sre-defend="${i}"><i class="fas fa-shield"></i> ${esc(L("SRE.Chain.Soak", { dv: bullets.dv, m: L(bullets.monitor === "stun" ? "SRE.Roll.StunShort" : "SRE.Roll.PhysShort") }))}</button>` : "")
      : `<button type="button" data-sre-defend="${i}"><i class="fas fa-shield-halved"></i> ${esc(L(`SRE.Chain.Defense.${chain.defense}`))}</button>`);
    box.innerHTML = `<div class="sre-rc-chain-title">${esc(L("SRE.Chain.Targets"))}${bullets ? ` · ${esc(L(bullets.hit ? "SRE.Chain.BulletsHit" : "SRE.Chain.Miss"))}` : ""}</div>${list.map((t, i) => {
      const can = t ? canUse(t.uuid) : true;
      return `<div class="sre-rc-target">${t ? `<span>${esc(t.name)} <small>${esc(L("SRE.Roll.DR"))} ${t.dr}</small></span>` : `<span><small>${esc(L("SRE.Chain.NoTarget"))}</small></span>`}
        ${can ? button(i) : ""}</div>`;
    }).join("")}`;
    box.querySelectorAll("[data-sre-defend]").forEach((b) => b.addEventListener("click", (e) => {
      e.preventDefault();
      const t = list[Number(b.dataset.sreDefend)];
      if (bullets) resistFromAttack(message, t);
      else defend(message, t);
    }));
    card.querySelector(".sre-rc-result")?.after(box);
  }

  // ── A defense: the result against the attack's current hits, then resistance ──
  const link = data.extra?.chain;
  if (data.kind === "defense" && link?.attackId) {
    const attackMessage = game.messages.get(link.attackId);
    const atk = engineData(attackMessage);
    const c = chainOf(atk);
    if (!c) return;
    const aHits = engineHits(attackMessage);
    const o = outcome(c, aHits, num(data.result?.hits), { tiesToAttacker: tiesToAttacker() });
    const box = document.createElement("div");
    box.className = `sre-rc-outcome ${o.hit ? "hit" : "miss"}`;
    let action = "";
    if (o.hit && !o.disarm) {
      if (link.applied || link.soakId) action = `<em>${esc(L(link.applied ? "SRE.Roll.Applied" : "SRE.Chain.Soaked"))}</em>`;
      else if (canUse(data.actorUuid)) action = `<button type="button" data-sre-resist><i class="fas fa-${o.resist ? "shield" : "heart-crack"}"></i> ${esc(o.resist ? L("SRE.Chain.Soak", { dv: o.dv, m: L(o.monitor === "stun" ? "SRE.Roll.StunShort" : "SRE.Roll.PhysShort") }) : L("SRE.Chain.ApplyDirect", { dv: o.dv }))}</button>`;
    }
    const verdict = !o.hit ? L("SRE.Chain.Miss") : o.disarm ? L("SRE.Chain.Disarmed") : L("SRE.Chain.Hit", { dv: o.dv, m: L(o.monitor === "stun" ? "SRE.Roll.StunShort" : "SRE.Roll.PhysShort"), net: o.net });
    box.innerHTML = `<div><small>${esc(L("SRE.Chain.Versus", { a: aHits, d: num(data.result?.hits), name: atk.title || atk.label }))}</small><b>${esc(verdict)}</b></div>${action}`;
    box.querySelector("[data-sre-resist]")?.addEventListener("click", (e) => {
      e.preventDefault();
      resist(message, attackMessage);
    });
    card.querySelector(".sre-rc-result")?.after(box);
  }
});

// When an attack's hits change (Edge after the roll), its defense cards show the new result.
Hooks.on("updateChatMessage", (message) => {
  const data = engineData(message);
  if (!chainOf(data)) return;
  for (const m of game.messages.contents.slice(-50)) {
    if (engineData(m)?.extra?.chain?.attackId === message.id) ui.chat?.updateMessage?.(m);
  }
});

// After an applied resistance: Knockout Blow and Tumble (pp. 47–48).
Hooks.on("sre.soakApplied", async (actor, data, left) => {
  const fx = afterDamage(data.soak?.effects ?? [], left, { wil: data.soak?.wil, bod: data.soak?.bod });
  if (fx.includes("knockout")) {
    const stun = actor.system?.stun ?? {};
    const rest = Math.max(0, num(stun.max) - num(stun.dmg));
    if (rest) {
      const { applyDamage } = await import("../sheet/system-rolls.mjs");
      await applyDamage(actor, "stun", rest);
    }
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p class="sre-rc-note">${esc(L("SRE.Chain.Knockout", { name: actor.name }))}</p>` });
  }
  if (fx.includes("prone")) {
    await actor.toggleStatusEffect?.("prone", { active: true });
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p class="sre-rc-note">${esc(L("SRE.Chain.Prone", { name: actor.name }))}</p>` });
  }
});
