/**
 * Healing dialog (core rulebook pp. 119–121): first aid, medkit, healing magic and natural recovery.
 * The test is rolled here (hits on 5–6) or its hits are typed in after a roll made with the system (e.g. a
 * Heal spell with Edge). The result goes to chat with an "Apply" button; the patient's owner or the GM applies it.
 * Each of first aid, medkit and magic works once per set of injuries; new damage starts a new set.
 */
import { METHODS, ONCE_PER_INJURIES, healingPool, healingResult, treatmentThreshold, isDead } from "./healing-rules.mjs";
import { errataFlags } from "./errata.mjs";

const MODULE_ID = "shadowrun-edge";
const SOCKET = `module.${MODULE_ID}`;
const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));

function damageOf(actor) {
  const s = actor.system;
  return { stun: Number(s.stun?.dmg) || 0, physical: Number(s.physical?.dmg) || 0, overflow: Number(s.overflow?.dmg) || 0 };
}

/** Characters the user may pick as healer: owned ones, the selected token first. */
function healers(target) {
  const list = game.actors.filter((a) => a.isOwner && ["Player", "NPC"].includes(a.type));
  const selected = canvas?.tokens?.controlled?.[0]?.actor;
  const order = [selected, game.user.character, target].filter(Boolean);
  return [...new Set([...order.filter((a) => a.isOwner), ...list])];
}

export async function openHealing(target) {
  if (!target) return;
  if (isDead(target.system)) return ui.notifications.error(L("SRE.Heal.Dead", { name: target.name }));
  const used = target.getFlag(MODULE_ID, "healed") ?? {};
  const options = METHODS.map((m) => `<option value="${m}">${L(`SRE.Heal.Method.${m}`)}${used[m] ? ` — ${L("SRE.Heal.AlreadyUsed")}` : ""}</option>`).join("");
  const healerOptions = healers(target).map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join("");
  const d = damageOf(target);
  const content = `<div class="sre-heal">
    <p class="sre-heal-state">${L("SRE.Heal.State", { name: esc(target.name), stun: d.stun, physical: d.physical, overflow: d.overflow })}</p>
    <label>${L("SRE.Heal.MethodLabel")} <select name="method">${options}</select></label>
    <label data-for="firstAid medkit magic">${L("SRE.Heal.Healer")} <select name="healer">${healerOptions}</select></label>
    <label class="checkbox" data-for="firstAid"><input type="checkbox" name="kit" checked> ${L("SRE.Heal.Kit")}</label>
    <label class="checkbox" data-for="medkit"><input type="checkbox" name="useMedkitRating"> ${L("SRE.Heal.UseMedkitRating")}</label>
    <label data-for="medkit">${L("SRE.Heal.MedkitRating")} <input type="number" name="medkitRating" value="3" min="1" max="6"></label>
    <label class="checkbox" data-for="restStun restPhysical"><input type="checkbox" name="assistance"> ${L("SRE.Heal.Assistance")}</label>
    <label data-for="firstAid medkit magic">${L("SRE.Heal.DrainBoxes")} <input type="number" name="drainBoxes" value="0" min="0" max="${d.stun}"></label>
    <label data-for="firstAid medkit magic">${L("SRE.Heal.Prefer")} <select name="prefer"><option value="physical">${L("SRE.Heal.PreferPhysical")}</option><option value="stun">${L("SRE.Heal.PreferStun")}</option></select></label>
    <label>${L("SRE.Heal.ManualHits")} <input type="number" name="manualHits" placeholder="${L("SRE.Heal.ManualHitsPlaceholder")}" min="0"></label>
    <p class="hint">${L("SRE.Heal.Hint")}</p>
  </div>`;
  const result = await foundry.applications.api.DialogV2.prompt({
    window: { title: L("SRE.Heal.Title", { name: target.name }) },
    content,
    render: (event, dialog) => {
      const root = dialog.element ?? event?.target?.element;
      const form = root?.querySelector("form") ?? root;
      const sync = () => {
        const m = form.querySelector("[name=method]").value;
        for (const el of form.querySelectorAll("[data-for]")) el.hidden = !el.dataset.for.split(" ").includes(m);
      };
      form?.querySelector("[name=method]")?.addEventListener("change", sync);
      if (form) sync();
    },
    ok: {
      label: L("SRE.Heal.Roll"),
      callback: (event, button) => {
        const f = button.form.elements;
        return {
          method: f.method.value, healer: f.healer?.value, kit: f.kit?.checked, useMedkitRating: f.useMedkitRating?.checked,
          medkitRating: Number(f.medkitRating?.value) || 0, assistance: f.assistance?.checked, drainBoxes: Number(f.drainBoxes?.value) || 0,
          prefer: f.prefer?.value ?? "physical", manualHits: f.manualHits.value === "" ? null : Number(f.manualHits.value),
        };
      },
    },
    rejectClose: false,
  });
  if (!result) return;
  return healingTest(target, result);
}

async function healingTest(target, o) {
  const errata = errataFlags();
  const treatment = ["firstAid", "medkit", "magic"].includes(o.method);
  const healer = treatment ? game.actors.get(o.healer) ?? target : target;
  const pool = healingPool(o.method, healer.system, target.system, { ...o, woundModifier: target.getWoundModifier?.() ?? 0, errata });
  const { threshold, autoHit } = treatment ? treatmentThreshold(target.system.essence) : { threshold: 0, autoHit: 0 };
  let roll = null;
  let hits = o.manualHits;
  if (hits === null || hits === undefined) {
    roll = await new Roll(`${pool}d6cs>=5`).evaluate();
    hits = roll.total;
  }
  const res = healingResult({ method: o.method, hits, threshold, autoHit, damage: damageOf(target), drainBoxes: o.drainBoxes, prefer: o.prefer });
  const used = treatment && target.getFlag(MODULE_ID, "healed")?.[o.method];
  const parts = ["overflow", "physical", "stun"].filter((k) => res.heal[k]).map((k) => L(`SRE.Heal.Box.${k}`, { n: res.heal[k] }));
  const content = `<div class="sre-heal-card">
    <h3>${L(`SRE.Heal.Method.${o.method}`)}: ${esc(target.name)}</h3>
    <p>${treatment ? L("SRE.Heal.CardTreatment", { healer: esc(healer.name), pool, hits: res.hits, threshold, auto: autoHit ? L("SRE.Heal.AutoHit") : "" }) : L("SRE.Heal.CardRest", { pool, hits: res.hits })}</p>
    <p class="sre-heal-result"><strong>${parts.length ? parts.join(", ") : L("SRE.Heal.Nothing")}</strong></p>
    ${used ? `<p class="sre-heal-warn">${L("SRE.Heal.UsedWarning")}</p>` : ""}
    ${parts.length ? `<button type="button" class="sre-heal-apply">${L("SRE.Heal.Apply")}</button>` : ""}
  </div>`;
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: healer }),
    content,
    rolls: roll ? [roll] : [],
    flags: { [MODULE_ID]: { healing: { target: target.uuid, method: o.method, heal: res.heal, applied: false } } },
  });
}

/** Applies the healing on the patient (by its owner, or by the GM when asked through the socket). */
async function applyHealing(targetUuid, method, heal) {
  const target = await fromUuid(targetUuid);
  if (!target) return false;
  const d = damageOf(target);
  const update = {
    "system.stun.dmg": Math.max(0, d.stun - (heal.stun || 0)),
    "system.physical.dmg": Math.max(0, d.physical - (heal.physical || 0)),
    "system.overflow.dmg": Math.max(0, d.overflow - (heal.overflow || 0)),
  };
  if (ONCE_PER_INJURIES.includes(method)) update[`flags.${MODULE_ID}.healed.${method}`] = true;
  await target.update(update, { sreHealing: true });
  return true;
}

Hooks.on("renderChatMessageHTML", (message, html) => {
  const data = message.getFlag(MODULE_ID, "healing");
  if (!data) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  const button = root?.querySelector(".sre-heal-apply");
  if (!button) return;
  if (data.applied) {
    button.disabled = true;
    button.textContent = L("SRE.Heal.Applied");
    return;
  }
  button.addEventListener("click", async () => {
    const target = await fromUuid(data.target);
    if (!target) return;
    if (target.isOwner) await applyHealing(data.target, data.method, data.heal);
    else if (game.users.activeGM) game.socket.emit(SOCKET, { type: "applyHealing", messageId: message.id, ...data });
    else return ui.notifications.warn(L("SRE.Give.NoGM"));
    if (message.isOwner) await message.setFlag(MODULE_ID, "healing", { ...data, applied: true });
  });
});

/** New damage starts a new set of injuries: first aid, medkit and magic can be used again. */
Hooks.on("preUpdateActor", (actor, changes, options) => {
  if (options.sreHealing) return;
  const grew = ["stun", "physical", "overflow"].some((k) => {
    const v = foundry.utils.getProperty(changes, `system.${k}.dmg`);
    return v !== undefined && Number(v) > (Number(actor.system[k]?.dmg) || 0);
  });
  if (grew && actor.getFlag(MODULE_ID, "healed")) foundry.utils.setProperty(changes, `flags.${MODULE_ID}.-=healed`, null);
});

Hooks.once("ready", () => {
  game.socket.on(SOCKET, async (data, senderId) => {
    if (data?.type !== "applyHealing" || !game.users.activeGM?.isSelf) return;
    const message = game.messages.get(data.messageId);
    const flag = message?.getFlag(MODULE_ID, "healing");
    // Only heal what the chat card says, once.
    if (!flag || flag.applied || flag.target !== data.target) return;
    await applyHealing(flag.target, flag.method, flag.heal);
    await message.setFlag(MODULE_ID, "healing", { ...flag, applied: true });
  });
});

/** "Healing" button in the header of the system's character and NPC sheets. */
Hooks.on("getActorSheetHeaderButtons", (sheet, buttons) => {
  if (game.system.id !== "shadowrun6-eden" || !["Player", "NPC"].includes(sheet.actor?.type)) return;
  buttons.unshift({ label: L("SRE.Heal.Button"), class: "sre-heal-button", icon: "fas fa-kit-medical", onclick: () => openHealing(sheet.actor) });
});
