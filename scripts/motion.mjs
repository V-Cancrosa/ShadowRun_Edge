/**
 * Edge Motion (stage 11A, styles/edge-motion.css): the player's animation level and the one-off classes that play
 * when an Edge window opens, switches tabs or a module dialog appears.
 * Levels: full, reduced (short fades, no travel), off; "auto" follows the system's reduced-motion preference.
 */
const MODULE_ID = "shadowrun-edge";
export const LEVELS = ["auto", "full", "reduced", "off"];

/** The level in effect: the setting, with "auto" read from the operating system's preference. */
export function motionLevel(setting, prefersReduced = false) {
  if (setting === "full" || setting === "reduced" || setting === "off") return setting;
  return prefersReduced ? "reduced" : "full";
}

function applyLevel() {
  let setting = "auto";
  try {
    setting = game.settings.get(MODULE_ID, "motion");
  } catch {
    /* not registered yet */
  }
  const level = motionLevel(setting, globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  for (const l of ["full", "reduced", "off"]) document.body.classList.toggle(`sre-motion-${l}`, l === level);
  return level;
}

/** Adds a class for one play of its animation, then removes it (also when the animation never runs). */
function playOnce(element, cls, ms = 900) {
  if (!element || document.body.classList.contains("sre-motion-off")) return;
  element.classList.remove(cls);
  void element.offsetWidth;
  element.classList.add(cls);
  setTimeout(() => element.classList.remove(cls), ms);
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "motion", {
    name: "SRE.Motion.Setting.Name",
    hint: "SRE.Motion.Setting.Hint",
    scope: "client",
    config: true,
    type: String,
    choices: Object.fromEntries(LEVELS.map((l) => [l, `SRE.Motion.Level.${l}`])),
    default: "auto",
    onChange: () => applyLevel(),
  });
});

Hooks.once("ready", () => {
  applyLevel();
  globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").addEventListener?.("change", () => applyLevel());
});

/** Edge sheets: open (first render) and tab switches; module dialogs: pop in. */
Hooks.on("renderApplicationV2", (app, element, context, options) => {
  const el = element instanceof HTMLElement ? element : app.element;
  if (!el?.classList) return;
  if (el.classList.contains("sre-sheet")) {
    const sameTab = !app._sreLastTab || app._sreLastTab === app.sheetTab;
    if (options?.isFirstRender) playOnce(el, "sre-fx-open");
    else if (!sameTab) playOnce(el, "sre-fx-tab", 500);
    // Changes since the last render of the same tab: numbers count, Edge pips flare, monitor boxes light up.
    const now = snapshot(el);
    if (!options?.isFirstRender && sameTab && app._sreSnapshot) animateChanges(el, app._sreSnapshot, now);
    app._sreSnapshot = now;
    app._sreLastTab = app.sheetTab;
    return;
  }
  if (el.classList.contains("sre-dialog") && options?.isFirstRender) playOnce(el, "sre-fx-pop", 500);
});

// ───── 11B + 11C: numbers, Edge, damage monitors ─────

const NUMBERS = ".sre-es-ktile > strong, .sre-es-chip > strong, .sre-es-pool, .sre-es-wound strong, .sre-ed-big";

/** A whole number at the start of a text ("11", "−2", "12,450¥"), or null. */
export function leadingNumber(text) {
  const m = String(text ?? "").trim().match(/^([−-]?)(\d[\d,\s]*)/);
  if (!m) return null;
  const n = Number(m[2].replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? (m[1] ? -n : n) : null;
}

/** What a sheet shows now: numbers by position, Edge pips on, filled boxes per monitor, the wound penalty. */
function snapshot(el) {
  const numbers = [...el.querySelectorAll(NUMBERS)].map((n) => leadingNumber(n.firstChild?.textContent ?? n.textContent));
  const pips = [...el.querySelectorAll(".sre-es-pip")].map((p) => p.classList.contains("on"));
  const boxes = {};
  for (const b of el.querySelectorAll(".sre-es-box[data-monitor]")) {
    (boxes[b.dataset.monitor] ??= []).push(b.classList.contains("filled"));
  }
  return { numbers, pips, boxes, wound: leadingNumber(el.querySelector(".sre-es-wound strong")?.textContent?.replace("−", "")) ?? 0 };
}

const level = () => (document.body.classList.contains("sre-motion-full") ? "full" : document.body.classList.contains("sre-motion-reduced") ? "reduced" : "off");

/** Counts a number from its old value to the new one (only the leading text, the rest of the element stays). */
function countUp(node, from, to, ms = 420) {
  const text = node.firstChild?.nodeType === Node.TEXT_NODE ? node.firstChild : null;
  if (!text) return;
  const original = text.textContent;
  const sign = original.trim().startsWith("−") ? "−" : "";
  const suffix = original.trim().replace(/^[−-]?\d[\d,\s]*/, "");
  const t0 = performance.now();
  const step = (t) => {
    if (!text.isConnected) return;
    const k = Math.min(1, (t - t0) / ms);
    const v = Math.round(Math.abs(from) + (Math.abs(to) - Math.abs(from)) * (1 - (1 - k) ** 3));
    text.textContent = k < 1 ? `${sign}${v.toLocaleString("en-US")}${suffix}` : original;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function animateChanges(el, before, now) {
  const lvl = level();
  if (lvl === "off") return;
  const nodes = [...el.querySelectorAll(NUMBERS)];
  if (nodes.length === before.numbers.length) {
    nodes.forEach((node, i) => {
      const a = before.numbers[i];
      const b = now.numbers[i];
      if (a === null || b === null || a === b) return;
      playOnce(node.closest(".sre-es-ktile, .sre-es-chip, .sre-es-qb, .sre-ed-tile") ?? node, "sre-fx-changed", 700);
      if (lvl === "full") countUp(node, a, b);
    });
  }
  const pips = [...el.querySelectorAll(".sre-es-pip")];
  if (pips.length === before.pips.length) {
    pips.forEach((pip, i) => {
      if (now.pips[i] && !before.pips[i]) playOnce(pip, "sre-fx-gain", 800);
      if (!now.pips[i] && before.pips[i]) playOnce(pip, "sre-fx-spend", 400);
    });
  }
  for (const [id, filled] of Object.entries(now.boxes)) {
    const old = before.boxes[id];
    if (!old || old.length !== filled.length) continue;
    const boxes = [...el.querySelectorAll(`.sre-es-box[data-monitor="${id}"]`)];
    const hit = filled.map((f, i) => (f && !old[i] ? i : -1)).filter((i) => i >= 0);
    const healed = filled.map((f, i) => (!f && old[i] ? i : -1)).filter((i) => i >= 0).reverse();
    hit.forEach((i, n) => { boxes[i].style.animationDelay = lvl === "full" ? `${n * 90}ms` : "0ms"; playOnce(boxes[i], "sre-fx-hit", 900 + n * 90); });
    healed.forEach((i, n) => { boxes[i].style.animationDelay = lvl === "full" ? `${n * 90}ms` : "0ms"; playOnce(boxes[i], "sre-fx-heal", 900 + n * 90); });
  }
  if (now.wound > before.wound) playOnce(el.querySelector(".sre-es-wound"), "sre-fx-shake", 400);
}

// ───── Damage numbers over tokens ─────

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "floatingNumbers", {
    name: "SRE.Motion.Floating.Name", hint: "SRE.Motion.Floating.Hint", scope: "client", config: true, type: Boolean, default: true,
  });
});

/** Damage before the change travels with the update to every client (the update options are shared). */
Hooks.on("preUpdateActor", (actor, changes, options) => {
  const s = actor.system ?? {};
  options.sreDamage = { physical: Number(s.physical?.dmg) || 0, stun: Number(s.stun?.dmg) || 0 };
});

/** The change in boxes per monitor: "+3" (damage) or "−2" (healed), or nothing. */
export function damageDelta(before, after) {
  const out = [];
  for (const id of ["physical", "stun"]) {
    const d = (Number(after?.[id]) || 0) - (Number(before?.[id]) || 0);
    if (d) out.push({ id, d });
  }
  return out;
}

Hooks.on("updateActor", (actor, changes, options) => {
  if (!options?.sreDamage || !canvas?.ready || level() === "off") return;
  let on = true;
  try {
    on = game.settings.get(MODULE_ID, "floatingNumbers");
  } catch {
    /* not registered */
  }
  if (!on) return;
  const s = actor.system ?? {};
  const deltas = damageDelta(options.sreDamage, { physical: s.physical?.dmg, stun: s.stun?.dmg });
  if (!deltas.length) return;
  for (const token of actor.getActiveTokens?.(true) ?? []) {
    deltas.forEach(({ id, d }, i) => {
      const text = d > 0 ? `−${d}${id === "physical" ? "P" : "S"}` : `+${-d}${id === "physical" ? "P" : "S"}`;
      const fill = d < 0 ? 0x4fd68a : id === "physical" ? 0xff5470 : 0x3fd4e8;
      canvas.interface?.createScrollingText?.(token.center, text, {
        anchor: CONST.TEXT_ANCHOR_POINTS.TOP, direction: CONST.TEXT_ANCHOR_POINTS.TOP, distance: token.h * (1 + i * 0.4),
        fontSize: 32, fill, stroke: 0x101117, strokeThickness: 4, jitter: 0.25, duration: level() === "full" ? 1600 : 700,
      });
    });
  }
});

// ───── 11D: roll cards in the chat ─────

/** Dice of a system roll card, from its tooltip list (classes die_N, hit, wild, ignored, edged). */
export function readDice(items) {
  return items.map((li) => {
    const cls = String(li.className ?? li);
    const value = Number(cls.match(/die_(\d)/)?.[1]) || 0;
    return { value, hit: /\bhit\b/.test(cls), wild: /\bwild\b/.test(cls), ignored: /\bignored\b/.test(cls), edged: /\bedged\b/.test(cls) };
  });
}

/** Hits first (6 before 5), then the rest high to low; ignored dice last. */
export function sortDice(dice) {
  const rank = (d) => (d.ignored ? 3 : d.hit ? 0 : d.value === 1 ? 2 : 1);
  return [...dice].sort((a, b) => rank(a) - rank(b) || b.value - a.value);
}

/** The card's verdict: critical glitch, glitch, success or failure (the system's own words decide), or null. */
export function verdictOf({ header = "", result = "", glitchText = "", criticalText = "", successText = "", failureText = "" }) {
  if (criticalText && header.includes(criticalText)) return "critical";
  if (glitchText && header.includes(glitchText)) return "glitch";
  if (successText && result.trim().startsWith(successText)) return "success";
  if (failureText && result.trim().startsWith(failureText)) return "failure";
  return null;
}

const seenRolls = new Map(); // message id → faces string seen last
const FRESH_MS = 6000;

Hooks.on("renderChatMessageHTML", (message, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  const card = root?.querySelector(".dice-result");
  const items = [...(root?.querySelectorAll(".dice-tooltip .dice-rolls li") ?? [])];
  if (!card || !items.length || !document.body.classList.contains("sre-theme")) return;
  const dice = readDice(items);
  const faces = dice.map((d) => `${d.value}${d.hit ? "h" : ""}`).join(",");
  const lvl = level();
  const before = seenRolls.get(message.id);
  const fresh = !before && Date.now() - (message.timestamp ?? 0) < FRESH_MS;
  seenRolls.set(message.id, faces);
  if (seenRolls.size > 200) seenRolls.delete(seenRolls.keys().next().value);

  // The dice strip under the header (the system keeps its own list in the folded tooltip).
  const sorted = sortDice(dice);
  const strip = document.createElement("div");
  strip.className = "sre-dice-strip";
  const oldFaces = before ? before.split(",") : null;
  strip.innerHTML = sorted.map((d, i) => {
    const cls = ["sre-die", d.hit ? "hit" : "", d.value === 1 ? "one" : "", d.wild ? "wild" : "", d.ignored ? "ignored" : "", d.edged ? "edged" : ""].filter(Boolean).join(" ");
    return `<span class="${cls}" style="--i:${i}">${d.value}</span>`;
  }).join("");
  card.querySelector(".part-header")?.after(strip);

  // Verdict stamp.
  const header = card.querySelector(".part-header")?.textContent ?? "";
  const result = card.querySelector(".resulttext")?.textContent ?? "";
  const L = (k) => game.i18n.localize(k);
  const verdict = verdictOf({
    header, result,
    criticalText: L("shadowrun6.roll.criticalglitch"), glitchText: L("shadowrun6.roll.glitch"),
    successText: L("shadowrun6.roll.success"), failureText: L("shadowrun6.roll.failure"),
  });
  if (verdict) {
    const stamp = document.createElement("span");
    stamp.className = `sre-stamp sre-stamp-${verdict}`;
    stamp.textContent = game.i18n.localize(`SRE.Motion.Verdict.${verdict}`);
    card.style.position = "relative";
    card.append(stamp);
  }

  if (lvl === "off") return;
  if (fresh) {
    strip.classList.add("sre-fx-roll");
    card.querySelector(".sre-stamp")?.classList.add("sre-fx-stamp");
    const total = card.querySelector(".resulttext b");
    const to = leadingNumber(total?.textContent);
    if (total && to !== null && lvl === "full") {
      total.textContent = "0";
      setTimeout(() => countUp(total, 0, to, 500), Math.min(900, dice.length * 45));
      setTimeout(() => { total.textContent = String(to); }, Math.min(900, dice.length * 45) + 650);
    }
    if (verdict === "glitch" || verdict === "critical") playOnce(root, "sre-fx-glitch", 900);
  } else if (oldFaces && before !== faces) {
    // Edge after the roll (a reroll or a bought hit): the dice that changed spin again.
    const prev = sortDice(readDice(oldFaces.map((f) => `die_${parseInt(f, 10)}${f.endsWith("h") ? " hit" : ""}`)));
    [...strip.children].forEach((el, i) => {
      if (`${prev[i]?.value}${prev[i]?.hit}` !== `${sorted[i].value}${sorted[i].hit}`) el.classList.add("sre-fx-reroll");
    });
    card.querySelector(".sre-stamp")?.classList.add("sre-fx-stamp");
  }
});
