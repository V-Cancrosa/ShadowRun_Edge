/**
 * Statuses and effects, one source of truth (the "Statuses" stage after stage 13).
 * - The module's own statuses join the system's list (CONFIG.statusEffects), so they show in the token HUD and are
 *   switched on and off like any other: Dumpshock (Edge locked, p. 176), Link-locked (IC), Convergence (p. 176).
 * - One effect per status: toxins, gas and drug crashes raise the system's status effect (its static id, so the
 *   HUD finds it) and record their source and end time on it; nothing makes a second copy.
 * - Ending: statuses and module effects whose time is up are removed by the active GM (world time and combat
 *   rounds), with a chat note. World setting "effectExpiry": automatic, ask the GM (a card with Remove / Keep), or
 *   off. Nothing is ever removed against the GM's choice.
 * - The token HUD shows each status's level, sources and time left, and a row with the module's other effects
 *   (drugs, crashes) that a right-click removes.
 */
import { KNOWN } from "./status-rules.mjs";

const MODULE_ID = "shadowrun-edge";
const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== "" && v !== null ? Number(v) : d);

/** The system's static effect id for a status (shadowrun6-eden util staticId). Pure. */
export function staticId(status) {
  const s = String(status);
  return s.length >= 16 ? s.substring(0, 16) : s.padEnd(16, "0");
}

/** The module's statuses. Pure data. */
export const MODULE_STATUSES = [
  { id: "sreDumpshock", name: "SRE.Effects.Status.dumpshock", img: "icons/svg/daze.svg" },
  { id: "sreLinkLock", name: "SRE.Effects.Status.linkLock", img: "icons/svg/net.svg" },
  { id: "sreConvergence", name: "SRE.Effects.Status.convergence", img: "icons/svg/eye.svg" },
];

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "effectExpiry", {
    name: "SRE.Effects.Expiry.Name", hint: "SRE.Effects.Expiry.Hint", scope: "world", config: true, type: String,
    choices: { auto: "SRE.Effects.Expiry.auto", ask: "SRE.Effects.Expiry.ask", off: "SRE.Effects.Expiry.off" }, default: "auto",
  });
});

// The system builds its list in its own init; the module's statuses are added after it.
Hooks.once("setup", () => {
  if (!Array.isArray(CONFIG.statusEffects)) return;
  for (const s of MODULE_STATUSES) {
    if (CONFIG.statusEffects.some((x) => x.id === s.id)) continue;
    CONFIG.statusEffects.push({ ...s, _id: staticId(s.id) });
  }
});

export const statusEffectOf = (actor, id) => actor?.effects?.get?.(staticId(id)) ?? null;

/** The sources recorded on an effect ([{ name, until }], until = world time in seconds, or null for no end). */
export function sourcesOf(effect) {
  return [...(effect?.getFlag?.(MODULE_ID, "sources") ?? [])];
}

/** Time left in seconds for an effect: its latest source, else its own duration (null = no end). Pure. */
export function timeLeft(sources, duration, now) {
  const ends = (sources ?? []).map((s) => s.until).filter((u) => u !== null && u !== undefined);
  if (ends.length && (sources ?? []).every((s) => s.until !== null && s.until !== undefined)) return Math.max(0, Math.max(...ends) - now);
  if ((sources ?? []).some((s) => s.until === null || s.until === undefined) && (sources ?? []).length) return null;
  if (duration?.seconds && duration.startTime !== undefined && duration.startTime !== null) return Math.max(0, duration.startTime + duration.seconds - now);
  return null;
}

/** Sources still running at `now`. Pure. */
export function liveSources(sources, now) {
  return (sources ?? []).filter((s) => s.until === null || s.until === undefined || s.until > now);
}

/** "12 min", "3 h", "45 s". Pure. */
export function formatLeft(seconds, L = (k) => k) {
  if (seconds === null || seconds === undefined) return "";
  if (seconds >= 86400) return `${Math.ceil(seconds / 86400)} ${L("SRE.Effects.Unit.d")}`;
  if (seconds >= 3600) return `${Math.ceil(seconds / 3600)} ${L("SRE.Effects.Unit.h")}`;
  if (seconds >= 60) return `${Math.ceil(seconds / 60)} ${L("SRE.Effects.Unit.min")}`;
  return `${Math.ceil(seconds)} ${L("SRE.Effects.Unit.s")}`;
}

/**
 * Turns a status on (or raises it) with a source: the system's own effect for that status, with the source and its
 * end time recorded. Level: the highest asked. Used by toxins, gas, crashes and the Matrix.
 */
export async function addStatus(actor, id, { level = 1, source = "", seconds = null, flags = {} } = {}) {
  if (!actor) return null;
  const until = seconds ? game.time.worldTime + seconds : null;
  let effect = statusEffectOf(actor, id);
  if (!effect) {
    await actor.toggleStatusEffect(id, { active: true });
    effect = statusEffectOf(actor, id);
    if (!effect) return null;
    await effect.setFlag(MODULE_ID, "byModule", true);
  }
  const sources = sourcesOf(effect).filter((s) => s.name !== source);
  if (source) sources.push({ name: source, until });
  const update = { [`flags.${MODULE_ID}.sources`]: sources, ...Object.fromEntries(Object.entries(flags).map(([k, v]) => [`flags.${MODULE_ID}.${k}`, v])) };
  const def = CONFIG.statusEffects?.find((s) => s.id === id);
  if (def?.hasLevels && num(level, 1) > num(effect.system?.level, 1)) update["system.level"] = Math.min(num(def.maxLevel, 99), num(level, 1));
  await effect.update(update);
  return effect;
}

/** Removes one source; the status goes when no source is left and only the module had put it on. */
export async function removeSource(actor, source) {
  for (const effect of [...(actor?.effects ?? [])]) {
    const sources = sourcesOf(effect);
    if (!sources.some((s) => s.name === source)) continue;
    const left = sources.filter((s) => s.name !== source);
    if (!left.length && effect.getFlag(MODULE_ID, "byModule")) await effect.delete();
    else await effect.setFlag(MODULE_ID, "sources", left);
  }
}

// ───── What the Effects tab and the HUD show ─────

/** The kind of an effect for display. Pure: statuses (with module rules or a marker), module, item, other. */
export function effectKind(effect, actor) {
  const statuses = [...(effect.statuses ?? [])];
  if (statuses.length) return statuses.some((s) => KNOWN.includes(s) || MODULE_STATUSES.some((m) => m.id === s)) ? "status" : "marker";
  const f = effect.flags?.[MODULE_ID] ?? {};
  if (f.substance || f.substanceStatus || f.noEdge) return "module";
  if (effect.parent && actor && effect.parent !== actor) return "item";
  return "other";
}

/** Rows for every effect on an actor (including the ones its items give). */
export function effectRows(actor, { now = 0, L = (k) => k, statusLabel = (id) => id } = {}) {
  const list = typeof actor?.allApplicableEffects === "function" ? [...actor.allApplicableEffects()] : [...(actor?.effects ?? [])];
  return list.map((e) => {
    const status = [...(e.statuses ?? [])][0] ?? null;
    const def = status ? CONFIG.statusEffects?.find((s) => s.id === status) : null;
    const sources = liveSources(sourcesOf(e), now);
    const left = timeLeft(sourcesOf(e), e.duration, now);
    return {
      id: e.id, uuid: e.uuid, name: status ? statusLabel(status) : e.name, img: e.img, status,
      kind: effectKind(e, actor), level: def?.hasLevels ? num(e.system?.level, 1) : null, disabled: !!e.disabled,
      sources: sources.map((s) => s.name).join(", "), left: formatLeft(left, L), fromItem: e.parent && e.parent !== actor ? e.parent.name : "",
      onActor: e.parent === actor,
    };
  }).sort((a, b) => ["status", "module", "marker", "item", "other"].indexOf(a.kind) - ["status", "module", "marker", "item", "other"].indexOf(b.kind));
}

// ───── Ending effects: world time and combat rounds (active GM) ─────

function allActors() {
  const tokens = (canvas?.tokens?.placeables ?? []).filter((t) => !t.document.actorLink && t.actor).map((t) => t.actor);
  return [...(game.actors ?? []), ...tokens];
}

/** What has run out on an actor: { sources: [{effect, keep}], effects: [effect] }. */
function expired(actor, now) {
  const out = [];
  for (const effect of actor.effects ?? []) {
    const sources = sourcesOf(effect);
    if (sources.length) {
      const live = liveSources(sources, now);
      if (live.length !== sources.length) out.push({ effect, live, gone: sources.filter((s) => !live.includes(s)) });
      continue;
    }
    // Module effects with their own duration (dumpshock, toxin attribute effects). Drugs end in substances.mjs.
    const f = effect.flags?.[MODULE_ID] ?? {};
    if (!(f.noEdge || f.substanceStatus) || f.substance) continue;
    const left = timeLeft([], effect.duration, now);
    if (left !== null && left <= 0) out.push({ effect, live: [], gone: [{ name: effect.name }] });
  }
  return out;
}

async function endEffect({ effect, live }) {
  if (live.length || !(effect.getFlag(MODULE_ID, "byModule") || effect.getFlag(MODULE_ID, "noEdge") || effect.getFlag(MODULE_ID, "substanceStatus") || !effect.statuses?.size)) {
    return effect.setFlag(MODULE_ID, "sources", live);
  }
  return effect.delete();
}

let checking = false;
async function checkExpiry() {
  if (checking || !game.users.activeGM?.isSelf) return;
  let mode = "auto";
  try {
    mode = game.settings.get(MODULE_ID, "effectExpiry");
  } catch {
    /* not registered */
  }
  if (mode === "off") return;
  checking = true;
  try {
    const now = game.time.worldTime;
    for (const actor of allActors()) {
      const list = expired(actor, now);
      if (!list.length) continue;
      const names = list.map(({ effect, gone }) => `${effect.statuses?.size ? effect.name : effect.name}${gone[0]?.name && gone[0].name !== effect.name ? ` (${gone.map((g) => g.name).join(", ")})` : ""}`);
      if (mode === "auto") {
        for (const x of list) await endEffect(x);
        await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id),
          content: `<div class="sre-blast-card"><p>${esc(L("SRE.Effects.Ended", { name: actor.name, list: names.join(", ") }))}</p></div>` });
      } else {
        // Ask: a GM card per actor, once per set of ended effects.
        const key = list.map((x) => x.effect.id).sort().join(",");
        if (actor.getFlag(MODULE_ID, "expiryAsked") === key) continue;
        await actor.setFlag(MODULE_ID, "expiryAsked", key);
        await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id),
          content: `<div class="sre-blast-card"><p>${esc(L("SRE.Effects.AskEnded", { name: actor.name, list: names.join(", ") }))}</p>
            <button type="button" data-sre-expire="remove">${esc(L("SRE.Effects.Remove"))}</button> <button type="button" data-sre-expire="keep">${esc(L("SRE.Effects.Keep"))}</button></div>`,
          flags: { [MODULE_ID]: { expiry: { actor: actor.uuid, ids: list.map((x) => x.effect.id) } } } });
      }
    }
  } finally {
    checking = false;
  }
}

Hooks.on("updateWorldTime", () => checkExpiry());
Hooks.on("updateCombat", (combat, changes) => {
  if ("round" in changes || "turn" in changes) checkExpiry();
});

Hooks.on("renderChatMessageHTML", (message, html) => {
  const data = message.getFlag(MODULE_ID, "expiry");
  if (!data) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  for (const b of root?.querySelectorAll("[data-sre-expire]") ?? []) {
    if (data.done || !game.user.isGM) b.disabled = true;
    b.addEventListener("click", async () => {
      const actor = await fromUuid(data.actor);
      if (!actor || !game.user.isGM) return;
      if (b.dataset.sreExpire === "remove") {
        const now = game.time.worldTime;
        for (const x of expired(actor, now).filter((x) => data.ids.includes(x.effect.id))) await endEffect(x);
      } else {
        // Keep (the GM breaks the rule): the effect stays without an end.
        for (const id of data.ids) {
          const e = actor.effects.get(id);
          if (!e) continue;
          if (sourcesOf(e).length) await e.setFlag(MODULE_ID, "sources", sourcesOf(e).map((s) => ({ ...s, until: null })));
          else await e.update({ "duration.seconds": null });
        }
      }
      await message.setFlag(MODULE_ID, "expiry", { ...data, done: true });
    });
  }
});

// ───── The Matrix: link-lock and Convergence as statuses, both ways ─────

Hooks.on("updateActor", async (actor, changes, options, userId) => {
  if (userId !== game.user.id) return;
  const m = changes?.flags?.[MODULE_ID]?.matrix;
  if (!m) return;
  const want = { sreLinkLock: !!actor.getFlag(MODULE_ID, "matrix")?.linkLock, sreConvergence: !!actor.getFlag(MODULE_ID, "matrix")?.converged };
  for (const [id, on] of Object.entries(want)) {
    const has = !!statusEffectOf(actor, id);
    if (has !== on) await actor.toggleStatusEffect(id, { active: on });
  }
});
for (const hook of ["createActiveEffect", "deleteActiveEffect"]) {
  Hooks.on(hook, async (effect, options, userId) => {
    if (userId !== game.user.id) return;
    const actor = effect.parent;
    if (!(actor instanceof Actor)) return;
    const on = hook === "createActiveEffect";
    const key = effect.statuses?.has?.("sreLinkLock") ? "linkLock" : effect.statuses?.has?.("sreConvergence") ? "converged" : null;
    if (!key) return;
    const state = actor.getFlag(MODULE_ID, "matrix") ?? {};
    if (!!state[key] !== on) await actor.setFlag(MODULE_ID, "matrix", { ...state, [key]: on });
  });
}

// ───── Token HUD: levels, sources and time on each status; a row with the module's other effects ─────

Hooks.on("renderTokenHUD", (hud, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  const palette = root?.querySelector(".palette.status-effects");
  const actor = hud.actor ?? hud.object?.actor;
  if (!palette || !actor) return;
  const now = game.time.worldTime;
  for (const img of palette.querySelectorAll("[data-status-id]")) {
    const id = img.dataset.statusId;
    const def = CONFIG.statusEffects?.find((s) => s.id === id);
    const effect = statusEffectOf(actor, id) ?? actor.effects.find((e) => e.statuses?.has?.(id));
    const bits = [def ? L(def.name ?? id) : id];
    if (effect) {
      if (def?.hasLevels) bits.push(`${L("SRE.Effects.Level")} ${num(effect.system?.level, 1)}`);
      const src = liveSources(sourcesOf(effect), now).map((s) => s.name).join(", ");
      if (src) bits.push(src);
      const left = formatLeft(timeLeft(sourcesOf(effect), effect.duration, now), L);
      if (left) bits.push(L("SRE.Effects.Left", { t: left }));
    }
    if (!KNOWN.includes(id) && !MODULE_STATUSES.some((m) => m.id === id)) bits.push(L("SRE.Effects.MarkerOnly"));
    img.dataset.tooltipText = bits.join(" · ");
  }
  const others = [...actor.effects].filter((e) => !e.statuses?.size);
  if (!others.length) return;
  const row = document.createElement("div");
  row.className = "sre-hud-effects";
  row.innerHTML = `<div class="sre-hud-title">${esc(L("SRE.Effects.HudOthers"))}</div>${others.map((e) => {
    const left = formatLeft(timeLeft(sourcesOf(e), e.duration, now), L);
    return `<img src="${esc(e.img || "icons/svg/aura.svg")}" data-sre-effect="${e.id}" class="${e.disabled ? "off" : ""}" data-tooltip-text="${esc(`${e.name}${left ? ` · ${L("SRE.Effects.Left", { t: left })}` : ""} · ${L("SRE.Effects.HudHint")}`)}">`;
  }).join("")}`;
  row.addEventListener("click", async (ev) => {
    const el = ev.target.closest("[data-sre-effect]");
    const e = el && actor.effects.get(el.dataset.sreEffect);
    if (e?.isOwner) await e.update({ disabled: !e.disabled });
  });
  row.addEventListener("contextmenu", async (ev) => {
    ev.preventDefault();
    const el = ev.target.closest("[data-sre-effect]");
    const e = el && actor.effects.get(el.dataset.sreEffect);
    if (e?.isOwner) await e.delete();
  });
  palette.append(row);
});
