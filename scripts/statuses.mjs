/**
 * The system's statuses (CONFIG.statusEffects) given their rules effect (pp. 51–53, scripts/status-rules.mjs):
 * - Initiative and Defense Rating changes live on the status effect itself (updated with its level);
 * - gaining a status removes the ones it cancels (Burning ↔ Wet/Chilled, Petrified → damaging statuses);
 * - at each new combat round: ongoing damage cards (Burning, Corrosive, Poisoned, resisted through the system's
 *   soak card), Poisoned goes down by 1, and Nauseated characters test Body + Willpower (2);
 * - Burning can be put out with Agility + Reaction (2).
 * Dice pool modifiers are offered in the roll dialog (scripts/roll-dialog.mjs).
 */
import { KNOWN, statusChanges, cancels, ongoingDamage } from "./status-rules.mjs";
import * as rolls from "./sheet/system-rolls.mjs";
import { registerTask, runTest, hitsOf, patchTask } from "./linked-roll.mjs";
import { spendAction, actionsLeft } from "./actions.mjs";
import * as ui2 from "./ui/edge-ui.mjs";
import { resolveConflict } from "./ui/conflict.mjs";

const MODULE_ID = "shadowrun-edge";
const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));

const statusOf = (effect) => [...(effect.statuses ?? [])].find((s) => KNOWN.includes(s));
const levelOf = (effect) => Math.max(1, Number(effect.system?.level) || 1);

/** The actor's active statuses the module knows, with their level and effect. */
export function actorStatuses(actor) {
  return [...(actor?.effects ?? [])]
    .filter((e) => !e.disabled && statusOf(e))
    .map((e) => ({ id: statusOf(e), level: levelOf(e), effect: e, stun: !!e.getFlag?.(MODULE_ID, "stun") }));
}

/** Localized status name, from the system's status list. */
export function statusLabel(id) {
  const def = CONFIG.statusEffects?.find((s) => s.id === id);
  return def ? game.i18n.localize(def.name ?? def.label ?? id) : id;
}

const pool = (actor, ...attrs) => attrs.reduce((sum, a) => sum + (Number(actor.system.attributes?.[a]?.pool) || 0), 0);

// ── Changes on the status effect ──
Hooks.on("preCreateActiveEffect", (effect, data, options, userId) => {
  if (userId !== game.user.id) return;
  const id = statusOf(effect);
  if (!id) return;
  const changes = statusChanges(id, levelOf(effect));
  if (changes.length) effect.updateSource({ changes });
});

Hooks.on("preUpdateActiveEffect", (effect, changes, options, userId) => {
  if (userId !== game.user.id) return;
  const id = statusOf(effect);
  const level = foundry.utils.getProperty(changes, "system.level");
  if (!id || level === undefined) return;
  const next = statusChanges(id, level);
  if (next.length) changes.changes = next;
});

// ── Statuses that cancel others ──
Hooks.on("createActiveEffect", async (effect, options, userId) => {
  if (userId !== game.user.id) return;
  const id = statusOf(effect);
  const actor = effect.parent;
  if (!id || !(actor instanceof Actor)) return;
  const gone = cancels(id);
  const remove = actor.effects.filter((e) => e.id !== effect.id && [...(e.statuses ?? [])].some((s) => gone.includes(s))).map((e) => e.id);
  if (remove.length) await actor.deleteEmbeddedDocuments("ActiveEffect", remove);
});

// ── New combat round: ongoing damage and nausea ──
Hooks.on("updateCombat", async (combat, changes) => {
  if (!("round" in changes) || !game.users.activeGM?.isSelf || game.system.id !== "shadowrun6-eden") return;
  for (const combatant of combat.combatants) {
    const actor = combatant.actor;
    if (!actor) continue;
    const statuses = actorStatuses(actor);
    const damage = ongoingDamage(statuses);
    const nauseated = statuses.some((s) => s.id === "nauseated");
    if (!damage.length && !nauseated) continue;
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="sre-blast-card"><h3>${L("SRE.Status.RoundTitle", { name: esc(actor.name), round: combat.round })}</h3></div>`,
      flags: { [MODULE_ID]: { statusRound: { actor: actor.uuid, damage, nauseated, combatant: combatant.id, combat: combat.id } } },
    });
    // Poisoned weakens by 1 each round (the damage just posted is the current one).
    for (const s of statuses.filter((x) => x.id === "poisoned")) {
      if (s.level <= 1) await s.effect.delete();
      else await s.effect.update({ "system.level": s.level - 1 });
    }
  }
});

Hooks.on("renderChatMessageHTML", (message, html) => {
  const data = message.getFlag(MODULE_ID, "statusRound");
  if (!data) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  const card = root?.querySelector(".sre-blast-card");
  if (!card || card.querySelector(".sre-status-round")) return;
  const box = document.createElement("div");
  box.className = "sre-status-round";
  box.innerHTML = [
    ...data.damage.map((d, i) => `<p>${esc(statusLabel(d.id))} ${d.dv}: <button type="button" data-soak="${i}">${L("SRE.Status.Resist", { dv: d.dv, type: d.monitor === "stun" ? "S" : "P" })}</button>
      ${d.id === "burning" ? `<button type="button" data-extinguish="1">${L("SRE.Status.Extinguish")}</button>` : ""}</p>`),
    data.nauseated ? `<p>${esc(statusLabel("nauseated"))}: <button type="button" data-nausea="1">${L("SRE.Status.NauseaTest")}</button></p>` : "",
  ].join("");
  card.append(box);
  const owner = async () => {
    const actor = await fromUuid(data.actor);
    if (!actor?.isOwner) ui.notifications.warn(L("SRE.Blast.NotOwner"));
    return actor?.isOwner ? actor : null;
  };
  for (const button of box.querySelectorAll("[data-soak]")) {
    button.addEventListener("click", async () => {
      const actor = await owner();
      const d = data.damage[Number(button.dataset.soak)];
      if (!actor || !d) return;
      return rolls.rollSoakTest(actor, {
        soakType: d.monitor === "stun" ? "damage_stun" : "damage_phys", damage: d.dv, monitor: d.monitor,
        pool: Number(actor.system.defensepool?.damage_physical?.pool) || pool(actor, "bod"),
        label: `${statusLabel(d.id)} (${d.dv}${d.monitor === "stun" ? "S" : "P"})`,
      });
    });
  }
  box.querySelector("[data-extinguish]")?.addEventListener("click", async () => {
    const actor = await owner();
    if (!actor) return;
    return runTest(actor, {
      pool: pool(actor, "agi", "rea"), label: L("SRE.Status.ExtinguishLabel"), threshold: 2,
      task: { kind: "extinguish", actor: actor.uuid, applied: false },
    });
  });
  box.querySelector("[data-nausea]")?.addEventListener("click", async () => {
    const actor = await owner();
    if (!actor) return;
    return runTest(actor, {
      pool: pool(actor, "bod", "wil"), label: L("SRE.Status.NauseaLabel"), threshold: 2,
      task: { kind: "nausea", actor: actor.uuid, combat: data.combat, combatant: data.combatant, applied: false },
    });
  });
});

/** Agility + Reaction (2): success puts the fire out. */
registerTask("extinguish", {
  render(task, hits) {
    const ok = hits >= 2;
    return `<div class="sre-blast-card"><p><strong>${L(ok ? "SRE.Status.ExtinguishOk" : "SRE.Status.ExtinguishFail", { hits })}</strong></p>
      ${ok ? `<button type="button" class="sre-task-apply"${task.applied ? " disabled" : ""}>${L(task.applied ? "SRE.Heal.Applied" : "SRE.Status.RemoveBurning")}</button>` : ""}</div>`;
  },
  bind(root, message, task) {
    root.querySelector(".sre-task-apply")?.addEventListener("click", async (event) => {
      if (hitsOf(message) < 2) return;
      const actor = await fromUuid(task.actor);
      if (!actor?.isOwner) return;
      event.currentTarget.disabled = true;
      const ids = actor.effects.filter((e) => e.statuses?.has("burning")).map((e) => e.id);
      if (ids.length) await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
      await patchTask(message, { applied: true });
    });
  },
});

/** Body + Willpower (2) at the start of the round: fail, no actions; success, one Minor Action less. */
registerTask("nausea", {
  render(task, hits) {
    const ok = hits >= 2;
    return `<div class="sre-blast-card"><p><strong>${L(ok ? "SRE.Status.NauseaOk" : "SRE.Status.NauseaFail", { hits })}</strong></p>
      ${ok ? `<button type="button" class="sre-task-apply"${task.applied ? " disabled" : ""}>${L(task.applied ? "SRE.Heal.Applied" : "SRE.Status.SpendMinor")}</button>` : ""}</div>`;
  },
  bind(root, message, task) {
    root.querySelector(".sre-task-apply")?.addEventListener("click", async (event) => {
      const combatant = game.combats.get(task.combat)?.combatants.get(task.combatant);
      if (!combatant?.isOwner) return;
      event.currentTarget.disabled = true;
      await spendAction(combatant, "minor");
      await patchTask(message, { applied: true });
    });
  },
});

/** Take Cover (Minor Action, p. 111): the Cover status at the chosen level, spending a Minor Action in combat. */
export async function takeCover(actor) {
  const level = ui2.okOnly(await foundry.applications.api.DialogV2.wait({
    classes: ["sre-dialog"],
    window: { title: L("SRE.Status.TakeCover") },
    position: { width: 440 },
    content: `<div class="sre-ed">${ui2.head({ kind: L("SRE.Status.TakeCover"), name: actor.name })}
      <div class="sre-ed-body">${ui2.panel(L("SRE.Status.CoverLevel"), ui2.options("level", [1, 2, 3, 4].map((n) => ({
        value: String(n), label: `${statusLabel("cover")} ${["I", "II", "III", "IV"][n - 1]}`, small: game.i18n.localize(`SRE.Status.CoverHint.${n}`), checked: n === 2,
      }))))}${ui2.note(L("SRE.Status.CoverNote"), "info")}</div></div>`,
    buttons: ui2.buttons(L("SRE.Status.TakeCover"), (e, b) => Number(b.form.elements.level.value) || 1, { icon: "fas fa-shield-halved" }),
    rejectClose: false,
  }));
  if (!level) return;
  const combatant = game.combat?.started ? game.combat.combatants.find((c) => c.actorId === actor.id) : null;
  if (combatant && game.settings.get(MODULE_ID, "trackActions")) {
    if (actionsLeft(combatant).minor.left <= 0) {
      const choice = await resolveConflict({
        title: L("SRE.Status.TakeCover"), name: actor.name, problems: [L("SRE.Blast.AvoidNoMinor", { name: actor.name })],
        options: [{ id: "cover", label: L("SRE.Status.CoverAnyway"), breaksRules: true }],
      });
      if (choice !== "cover") return;
    } else await spendAction(combatant, "minor");
  }
  let effect = actor.effects.find((e) => e.statuses?.has("cover"));
  if (!effect) {
    await actor.toggleStatusEffect("cover", { active: true });
    effect = actor.effects.find((e) => e.statuses?.has("cover"));
  }
  return effect?.update({ "system.level": level });
}


// ── Unconscious and dead from the condition monitors (p. 38; Overflow p. 121) ──
// The system sets them when its own sheet, token bars or damage change a monitor (Actor#checkUnconscious); the
// Edge sheets, healing and other module changes write the monitors directly, so the same check runs after any
// change of physical, stun or overflow damage — once, on the client that made it.
export function monitorChanged(changes) {
  const s = changes?.system ?? {};
  return ["physical", "stun", "overflow"].some((k) => s[k] && "dmg" in s[k]);
}
Hooks.on("updateActor", (actor, changes, options, userId) => {
  if (userId !== game.user.id || !monitorChanged(changes) || typeof actor.checkUnconscious !== "function") return;
  actor.checkUnconscious();
});
