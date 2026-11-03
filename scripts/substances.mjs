/**
 * Toxins and drugs (pp. 121–125). A toxin is given to targets (doses, vector, protection); each target's owner
 * rolls Toxin Resistance (Body + Willpower + protection) through the system dialog and applies what is left:
 * damage, statuses and attribute changes with the toxin's duration. A drug taken by choice works fully (no test);
 * given by force, it goes the toxin way. When a drug wears off, its crash follows (unresisted Stun, statuses,
 * changes). Antidotes: before the effect, the exposure is neutralized; the Antidote spell (February 2020 errata)
 * lowers the Power by its hits.
 */
import { substance } from "./substances-data.mjs";
import { exposurePower, toxinOutcome, durationSeconds, speedRounds, effectChanges, crashOf } from "./substance-rules.mjs";
import { registerTask, runTest, hitsOf, patchTask } from "./linked-roll.mjs";
import { applyDamage } from "./sheet/system-rolls.mjs";
import { statusLabel } from "./statuses.mjs";
import * as ui2 from "./ui/edge-ui.mjs";

const MODULE_ID = "shadowrun-edge";
const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));

export const substanceOf = (item) => substance(item?.flags?.[MODULE_ID]?.substance);

const body = (actor) => Number(actor.system.attributes?.bod?.pool) || 0;
const resistPool = (actor) => Number(actor.system.derived?.resist_toxin?.pool)
  || (Number(actor.system.attributes?.bod?.pool) || 0) + (Number(actor.system.attributes?.wil?.pool) || 0);

async function rollDuration(def, actor) {
  const roll = def.duration?.dice ? (await new Roll(def.duration.dice).evaluate()).total : 0;
  return durationSeconds(def.duration, body(actor), roll);
}

const statusImg = (id) => CONFIG.statusEffects?.find((s) => s.id === id)?.img ?? "icons/svg/aura.svg";

/** Status effects (each its own effect, so the module's status rules see them) with a duration. */
function statusEffects(statuses, seconds, source) {
  return statuses.map((s) => {
    const { id, level } = typeof s === "string" ? { id: s, level: 1 } : s;
    return {
      name: `${statusLabel(id)} (${source})`, img: statusImg(id), statuses: [id], system: { level },
      duration: { seconds, startTime: game.time.worldTime }, flags: { [MODULE_ID]: { substanceStatus: source } },
    };
  });
}

/** A drug's effect on an actor, with its duration and what happens when it wears off. */
export async function applyDrug(actor, def, { seconds } = {}) {
  const time = seconds ?? (await rollDuration(def, actor));
  const notes = (def.notes ?? []).map((n) => L(`SRE.Substance.Note.${n}`)).join(" ");
  await actor.createEmbeddedDocuments("ActiveEffect", [{
    name: def.name, img: "icons/svg/pill.svg", changes: effectChanges(def), description: notes,
    duration: { seconds: time, startTime: game.time.worldTime },
    flags: { [MODULE_ID]: { substance: { id: def.id, seconds: time, crash: !!def.crash }, physicalPool: (def.notes ?? []).includes("zenPhysical") ? -1 : 0 } },
  }]);
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="sre-blast-card"><h3>${esc(def.name)}: ${esc(actor.name)}</h3><p>${L("SRE.Substance.Taken", { time: formatTime(time) })}</p>${notes ? `<p class="hint">${esc(notes)}</p>` : ""}</div>`,
  });
}

function formatTime(seconds) {
  if (seconds >= 86400) return `${Math.round(seconds / 86400)} ${L("SRE.Substance.Unit.days")}`;
  if (seconds >= 3600) return `${Math.round((seconds / 3600) * 10) / 10} ${L("SRE.Substance.Unit.hours")}`;
  return `${Math.round(seconds / 60)} ${L("SRE.Substance.Unit.minutes")}`;
}

/** The "Give" / "Take" dialog from an item with a substance. */
export async function useSubstance(actor, item) {
  const def = substanceOf(item);
  if (!def) return;
  const targets = [...game.user.targets].map((t) => t.actor).filter(Boolean);
  const people = (targets.length ? targets : [actor]).map((a, i) => ({ value: a.uuid, label: a.name, avatar: { img: a.img, name: a.name }, checked: true }));
  const drug = def.kind === "drug";
  const content = `<div class="sre-ed">
    ${ui2.head({ kind: L(drug ? "SRE.Substance.Drug" : "SRE.Substance.Toxin"), name: def.name, sub: L("SRE.Substance.Sub", { power: def.power, count: Number(item.system.count) || 0 }) })}
    <div class="sre-ed-body">
      ${ui2.panel(L("SRE.Substance.Targets"), ui2.toggles("target", people, { people: true }))}
      ${ui2.panel(L("SRE.Substance.Vector"), ui2.options("vector", def.vectors.map((v, i) => ({ value: v, label: L(`SRE.Substance.Vectors.${v}`), checked: i === 0 }))))}
      ${ui2.panel(L("SRE.Substance.Options"), ui2.rows([
        ui2.row(L("SRE.Substance.Doses"), ui2.stepper("doses", 1, { min: 1 })),
        drug ? ui2.chips([ui2.chip("forced", L("SRE.Substance.Forced"))]) : ui2.row(L("SRE.Substance.Protection"), ui2.stepper("protection", 0, { min: 0 })),
        drug ? "" : ui2.chips([ui2.chip("protected", L("SRE.Substance.Protected"))]),
      ]))}
      ${ui2.note(L(drug ? "SRE.Substance.DrugHint" : "SRE.Substance.ToxinHint"), "info")}
    </div>
  </div>`;
  const choice = ui2.okOnly(await foundry.applications.api.DialogV2.wait({
    classes: ["sre-dialog"],
    window: { title: def.name },
    position: { width: 480 },
    content,
    render: (event, dialog) => ui2.wire(dialog),
    buttons: ui2.buttons(L(drug ? "SRE.Substance.Take" : "SRE.Substance.Give"), (e, b) => {
      const f = b.form.elements;
      return {
        targets: [...b.form.querySelectorAll("input[name=target]:checked")].map((i) => i.value),
        vector: f.vector.value, doses: Math.max(1, Number(f.doses.value) || 1),
        protection: Number(f.protection?.value) || 0, protected: !!f.protected?.checked, forced: !!f.forced?.checked,
      };
    }, { icon: drug ? "fas fa-pills" : "fas fa-syringe" }),
    rejectClose: false,
  }));
  if (!choice?.targets.length) return;
  // Doses used up from the item (it stays at 0 so the GM can see it was spent).
  const count = Number(item.system.count) || 0;
  if (item.system.countable) await item.update({ "system.count": Math.max(0, count - choice.doses * choice.targets.length) });
  for (const uuid of choice.targets) {
    const target = await fromUuid(uuid);
    if (!target) continue;
    if (drug && !choice.forced) {
      if (target.isOwner) await applyDrug(target, def);
      else await exposure(actor, target, def, choice);
    } else await exposure(actor, target, def, choice);
  }
}

/** An exposure card for one target: when it takes effect, the resistance test, the antidote. */
export async function exposure(source, target, def, choice) {
  const rounds = speedRounds(def.speed);
  const combat = game.combat?.started ? game.combat : null;
  // A gas cloud gives the Power of its zone (full, half, a quarter); otherwise the doses decide.
  const power = choice.power ?? exposurePower(def.power, { doses: choice.doses });
  return ChatMessage.create({
    speaker: source ? ChatMessage.getSpeaker({ actor: source }) : ChatMessage.getSpeaker(),
    content: `<div class="sre-blast-card"><h3>${L("SRE.Substance.Exposure", { name: esc(def.name), target: esc(target.name) })}</h3></div>`,
    flags: {
      [MODULE_ID]: {
        exposure: {
          id: def.id, target: target.uuid, targetName: target.name, power, vector: choice.vector, doses: choice.doses,
          protection: choice.protection ?? 0, protected: !!choice.protected, forced: !!choice.forced,
          due: combat && rounds !== null ? combat.round + rounds : null, combat: combat?.id ?? null, speed: def.speed, antidote: false,
        },
      },
    },
  });
}

Hooks.on("renderChatMessageHTML", (message, html) => {
  const data = message.getFlag(MODULE_ID, "exposure");
  if (!data) return;
  const def = substance(data.id);
  const root = html instanceof HTMLElement ? html : html?.[0];
  const card = root?.querySelector(".sre-blast-card");
  if (!def || !card || card.querySelector(".sre-exposure")) return;
  const box = document.createElement("div");
  box.className = "sre-exposure";
  const when = data.due !== null ? L("SRE.Substance.Due", { round: data.due }) : def.speed?.minutes ? L("SRE.Substance.DueMinutes", { n: def.speed.minutes }) : L("SRE.Substance.DueNow");
  box.innerHTML = `<p>${L("SRE.Substance.Power", { power: data.power, doses: data.doses })} · ${esc(L(`SRE.Substance.Vectors.${data.vector}`))} · ${esc(when)}</p>
    ${data.protected ? `<p class="sre-heal-warn">${L("SRE.Substance.ProtectedNote")}</p>` : ""}
    ${data.antidote ? `<p><strong>${L("SRE.Substance.Neutralized")}</strong></p>` : `<p>
      <button type="button" data-resist="1">${L("SRE.Substance.Resist", { pool: "" }).trim()}</button>
      <button type="button" data-antidote="1">${L("SRE.Substance.Antidote")}</button></p>`}`;
  card.append(box);
  box.querySelector("[data-resist]")?.addEventListener("click", async () => {
    const target = await fromUuid(data.target);
    if (!target?.isOwner) return ui.notifications.warn(L("SRE.Blast.NotOwner"));
    return runTest(target, {
      pool: resistPool(target) + (Number(data.protection) || 0), label: L("SRE.Substance.TestLabel", { name: def.name, power: data.power }),
      task: { kind: "toxin", id: data.id, target: data.target, power: data.power, forced: data.forced, retests: 0, applied: false },
    });
  });
  box.querySelector("[data-antidote]")?.addEventListener("click", async () => {
    if (!message.isOwner && !game.user.isGM) return ui.notifications.warn(L("SRE.Blast.NotOwner"));
    await message.setFlag(MODULE_ID, "exposure", { ...data, antidote: true });
  });
});

/** Toxin Resistance result: the Power left, then damage and effects on a button. */
registerTask("toxin", {
  render(task, hits) {
    const def = substance(task.id);
    if (!def) return "";
    const out = toxinOutcome(def, task.power, hits);
    const effects = [...(out.statuses ?? []).map((s) => statusLabel(s)), ...(out.changes ?? []).map((c) => `${c.attr.toUpperCase()} ${c.value > 0 ? "+" : ""}${c.value}`)];
    const drugEffect = def.kind === "drug" && out.left > 0;
    const doable = out.damage || effects.length || drugEffect;
    return `<div class="sre-blast-card">
      <h3>${esc(def.name)}</h3>
      <p>${L("SRE.Substance.Left", { power: task.power, hits, left: out.left })}</p>
      ${out.left ? `<p><strong>${[
        out.damage ? L("SRE.Substance.Damage", { n: out.damage, type: out.monitor === "physical" ? "P" : "S" }) : "",
        effects.length ? esc(effects.join(", ")) : "", drugEffect ? L("SRE.Substance.DrugWorks") : "",
      ].filter(Boolean).join(" · ")}</strong></p>` : `<p><strong>${L("SRE.Substance.NoEffect")}</strong></p>`}
      ${doable ? `<button type="button" class="sre-task-apply"${task.applied ? " disabled" : ""}>${L(task.applied ? "SRE.Heal.Applied" : "SRE.Substance.Apply")}</button>` : ""}
      ${out.left ? `<button type="button" data-retest="1">${L("SRE.Substance.Retest")}</button> <button type="button" data-spell="1">${L("SRE.Substance.AntidoteSpell")}</button>` : ""}
    </div>`;
  },
  bind(root, message, task) {
    const def = substance(task.id);
    root.querySelector(".sre-task-apply")?.addEventListener("click", async (event) => {
      const target = await fromUuid(task.target);
      if (!target?.isOwner || !def) return ui.notifications.warn(L("SRE.Blast.NotOwner"));
      event.currentTarget.disabled = true;
      const out = toxinOutcome(def, task.power, hitsOf(message));
      if (out.damage) await applyDamage(target, out.monitor, out.damage);
      if (def.kind === "drug" && out.left > 0) await applyDrug(target, def);
      else if (out.left > 0) {
        const seconds = await rollDuration(def, target);
        const docs = statusEffects(out.statuses, seconds, def.name);
        if (out.changes.length) {
          docs.push({
            name: def.name, img: "icons/svg/poison.svg", duration: { seconds, startTime: game.time.worldTime },
            changes: out.changes.map((c) => ({ key: `system.attributes.${c.attr}.mod`, mode: 2, value: String(c.value) })),
            description: (out.changes.some((c) => c.note) ? L("SRE.Substance.Note.truthSerum") : ""),
            flags: { [MODULE_ID]: { substanceStatus: def.name } },
          });
        }
        if (docs.length) await target.createEmbeddedDocuments("ActiveEffect", docs);
      }
      await patchTask(message, { applied: true });
    });
    root.querySelector("[data-retest]")?.addEventListener("click", async () => {
      const target = await fromUuid(task.target);
      if (!target?.isOwner || !def) return;
      // Still exposed after 10 combat rounds: another test, Power +1 per test after the first (cumulative).
      const retests = (Number(task.retests) || 0) + 1;
      const power = Number(task.power) + 1;
      return runTest(target, {
        pool: resistPool(target), label: L("SRE.Substance.TestLabel", { name: def.name, power }),
        task: { ...task, power, retests, applied: false },
      });
    });
    root.querySelector("[data-spell]")?.addEventListener("click", async () => {
      const caster = canvas?.tokens?.controlled?.find((t) => t.actor?.isOwner)?.actor ?? game.user.character;
      if (!caster) return ui.notifications.warn(L("SRE.Blast.AvoidSelect"));
      const left = toxinOutcome(def, task.power, hitsOf(message)).left;
      return runTest(caster, {
        pool: Number(caster.system.skills?.sorcery?.pool) || 0, label: L("SRE.Substance.AntidoteLabel", { power: left }),
        task: { kind: "antidote", id: task.id, target: task.target, power: left, applied: false },
      });
    });
  },
});

/** Antidote spell (February 2020 errata, p. 135): each hit lowers the Power; at 0 the toxin's effects end. */
registerTask("antidote", {
  render(task, hits) {
    const left = Math.max(0, task.power - hits);
    return `<div class="sre-blast-card"><p>${L("SRE.Substance.AntidoteResult", { power: task.power, hits, left })}</p>
      ${left === 0 ? `<button type="button" class="sre-task-apply"${task.applied ? " disabled" : ""}>${L(task.applied ? "SRE.Heal.Applied" : "SRE.Substance.EndEffects")}</button>` : ""}</div>`;
  },
  bind(root, message, task) {
    root.querySelector(".sre-task-apply")?.addEventListener("click", async (event) => {
      const target = await fromUuid(task.target);
      const def = substance(task.id);
      if (!target?.isOwner || !def) return ui.notifications.warn(L("SRE.Blast.NotOwner"));
      event.currentTarget.disabled = true;
      const ids = target.effects.filter((e) => e.getFlag(MODULE_ID, "substanceStatus") === def.name || e.getFlag(MODULE_ID, "substance")?.id === def.id).map((e) => e.id);
      if (ids.length) await target.deleteEmbeddedDocuments("ActiveEffect", ids);
      await patchTask(message, { applied: true });
    });
  },
});

// ── Drugs wearing off: the crash (GM side, on world time and combat rounds) ──
async function checkCrashes() {
  if (!game.users.activeGM?.isSelf) return;
  const actors = [...game.actors, ...(canvas?.tokens?.placeables ?? []).filter((t) => !t.document.actorLink).map((t) => t.actor)].filter(Boolean);
  for (const actor of actors) {
    for (const effect of actor.effects.filter((e) => e.getFlag(MODULE_ID, "substance"))) {
      const remaining = effect.duration?.remaining;
      if (remaining === null || remaining === undefined || remaining > 0) continue;
      const flag = effect.getFlag(MODULE_ID, "substance");
      const def = substance(flag.id);
      await effect.delete();
      const crash = def && crashOf(def);
      if (!crash) continue;
      const seconds = Math.max(60, (Number(flag.seconds) || 0) * crash.factor);
      const docs = statusEffects(crash.statuses, seconds, `${def.name}: ${L("SRE.Substance.Crash")}`);
      if (crash.changes.length || crash.pool) {
        docs.push({
          name: `${def.name}: ${L("SRE.Substance.Crash")}`, img: "icons/svg/downgrade.svg", changes: crash.changes,
          duration: { seconds, startTime: game.time.worldTime },
          flags: { [MODULE_ID]: { substanceStatus: def.name, pool: crash.pool } },
        });
      }
      if (docs.length) await actor.createEmbeddedDocuments("ActiveEffect", docs);
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="sre-blast-card"><h3>${L("SRE.Substance.CrashTitle", { name: esc(def.name), actor: esc(actor.name) })}</h3>
          ${crash.stun ? `<button type="button" class="sre-crash-stun">${L("SRE.Substance.CrashStun", { n: crash.stun })}</button>` : ""}</div>`,
        flags: { [MODULE_ID]: { crash: { actor: actor.uuid, stun: crash.stun, applied: false } } },
      });
    }
  }
}

Hooks.on("updateWorldTime", () => checkCrashes());
Hooks.on("updateCombat", (combat, changes) => {
  if ("round" in changes || "turn" in changes) checkCrashes();
});

Hooks.on("renderChatMessageHTML", (message, html) => {
  const data = message.getFlag(MODULE_ID, "crash");
  if (!data) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  const button = root?.querySelector(".sre-crash-stun");
  if (!button) return;
  if (data.applied) button.disabled = true;
  button.addEventListener("click", async () => {
    const actor = await fromUuid(data.actor);
    if (!actor?.isOwner) return ui.notifications.warn(L("SRE.Blast.NotOwner"));
    button.disabled = true;
    // Unresisted (p. 124–125).
    await applyDamage(actor, "stun", data.stun);
    if (message.isOwner) await message.setFlag(MODULE_ID, "crash", { ...data, applied: true });
  });
});
