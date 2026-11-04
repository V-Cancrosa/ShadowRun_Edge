/**
 * The modules around Shadowrun Edge, fitted to its roll engine (the stage after 13):
 * - Combat tracker and Carousel Combat Tracker: "roll initiative" (one combatant, all, NPCs) rolls with the Edge
 *   engine — rank + dice from the system, no window, the +3-for-1-Edge button stays on the card. Through
 *   lib-wrapper when active, else a plain wrap of Combat#rollInitiative.
 * - Dice Tray and "/r Nd6": a bare pool of d6 becomes an Edge test for the selected token (hits, glitches, Edge after
 *   the roll); other formulas roll as before. World setting "dicePools".
 * - Sequencer + JB2A: an attack shows a shot or a swing from the attacker to each target, a combat spell a bolt;
 *   a defense that is hit shows an impact. World setting "attackFx": everything / blasts only / off.
 * (Dice So Nice: the wild die in Edge cyan; Chat Portrait: no second portrait on the card — in edge-roll.mjs.)
 */
import { engineOn, edgeTest, engineData } from "./dice/edge-roll.mjs";
import { initiativeTest, initiativeOf } from "./dice/initiative.mjs";
import { chainOf, outcome } from "./dice/combat-chain.mjs";
import { errata } from "./errata.mjs";

const MODULE_ID = "shadowrun-edge";
const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "dicePools", {
    name: "SRE.Integrations.Pools.Name", hint: "SRE.Integrations.Pools.Hint", scope: "world", config: true, type: Boolean, default: true,
  });
  game.settings.register(MODULE_ID, "attackFx", {
    name: "SRE.Integrations.Fx.Name", hint: "SRE.Integrations.Fx.Hint", scope: "world", config: true, type: String,
    choices: { all: "SRE.Integrations.Fx.all", blasts: "SRE.Integrations.Fx.blasts", off: "SRE.Integrations.Fx.off" }, default: "all",
  });
});

const setting = (key, fallback) => {
  try {
    return game.settings.get(MODULE_ID, key);
  } catch {
    return fallback;
  }
};

// ───── Initiative from the combat tracker and the Carousel ─────

/** Edge-engine initiative for the given combatants (owned ones; NPCs and hidden ones whispered to the GM). */
export async function engineInitiative(combat, ids) {
  const list = (typeof ids === "string" ? [ids] : ids ?? []).map((id) => combat.combatants.get(id)).filter((c) => c?.actor && c.isOwner);
  for (const c of list) {
    const ini = initiativeOf(c);
    const secret = c.hidden || !c.actor.hasPlayerOwner;
    await initiativeTest(c.actor, { ...ini, quick: true, combatant: c, rollMode: secret ? "gmroll" : null });
  }
  return combat;
}

Hooks.once("setup", () => {
  if (game.system.id !== "shadowrun6-eden") return;
  const wrapper = function (wrapped, ids, options = {}) {
    if (!engineOn()) return wrapped(ids, options);
    return engineInitiative(this, ids);
  };
  if (game.modules.get("lib-wrapper")?.active && globalThis.libWrapper) {
    libWrapper.register(MODULE_ID, "CONFIG.Combat.documentClass.prototype.rollInitiative", wrapper, "MIXED");
  } else {
    const proto = CONFIG.Combat.documentClass.prototype;
    const original = proto.rollInitiative;
    proto.rollInitiative = function (ids, options) {
      return wrapper.call(this, original.bind(this), ids, options);
    };
  }
});

// ───── Dice Tray and "/r Nd6" as Edge pools ─────

/** The pool of a bare "Nd6" formula (no modifiers, no other dice), else null. Pure. */
export function bareD6Pool(formula) {
  const m = String(formula ?? "").trim().match(/^(\d{1,2})d6$/i);
  return m ? Number(m[1]) : null;
}

/** The pool of a "/r Nd6" chat command (also /roll, /gmr, /br, /sr), with its roll mode. Pure. */
export function commandPool(text) {
  const m = String(text ?? "").trim().match(/^\/(r|roll|gmr|gmroll|br|broll|blindroll|sr|selfroll)\s+(\d{1,2})d6\s*$/i);
  if (!m) return null;
  const mode = { gmr: "gmroll", gmroll: "gmroll", br: "blindroll", broll: "blindroll", blindroll: "blindroll", sr: "selfroll", selfroll: "selfroll" }[m[1].toLowerCase()] ?? null;
  return { pool: Number(m[2]), mode };
}

function poolActor() {
  return canvas?.tokens?.controlled?.[0]?.actor ?? game.user.character ?? null;
}

function poolTest(actor, pool) {
  return edgeTest(actor, { kind: "test", label: L("SRE.Integrations.Pools.Label", { n: pool }), pool, useSustain: true });
}

Hooks.on("chatMessage", (chatLog, text) => {
  if (!engineOn() || !setting("dicePools", true)) return;
  const c = commandPool(text);
  const actor = c && poolActor();
  if (!actor) return;
  poolTest(actor, c.pool);
  return false;
});

// Dice Tray may also create the roll message itself: a bare "Nd6" message of this user becomes the Edge test.
Hooks.on("preCreateChatMessage", (message, data, options, userId) => {
  if (userId !== game.user.id || !engineOn() || !setting("dicePools", true)) return;
  if (message.flags?.[MODULE_ID] || message.flags?.["shadowrun6-eden"] || message.rolls?.length !== 1) return;
  if (data.flavor) return;
  const pool = bareD6Pool(message.rolls[0]?.formula);
  const actor = pool && poolActor();
  if (!actor) return;
  poolTest(actor, pool);
  return false;
});

// ───── Sequencer + JB2A: shots, swings, bolts and impacts ─────

const FX = {
  ranged: ["jb2a.bullet.01.orange", "jb2a.bullet.02.orange", "jb2a.bullet.01", "jb2a.bullet"],
  melee: ["jb2a.melee_generic.slash.01.orange", "jb2a.melee_generic", "jb2a.sword.melee.01.white", "jb2a.unarmed_strike.physical.01.blue", "jb2a.unarmed_strike"],
  spell: ["jb2a.magic_missile.purple", "jb2a.magic_missile", "jb2a.fire_bolt.orange", "jb2a.fire_bolt", "jb2a.eldritch_blast.purple", "jb2a.eldritch_blast"],
  impact: ["jb2a.impact.004.orange", "jb2a.impact.001.orange", "jb2a.impact.004", "jb2a.impact"],
};

/** The first database entry that exists (the free and Patreon JB2A name things differently). */
function pick(list) {
  const db = globalThis.Sequencer?.Database;
  return list.find((n) => db?.entryExists?.(n)) ?? null;
}

function fxOn() {
  if (!game.modules.get("sequencer")?.active || !globalThis.Sequence) return false;
  if (document.body.classList.contains("sre-motion-off")) return false;
  return setting("attackFx", "all") === "all";
}

const tokenOf = (uuid) => {
  try {
    return fromUuidSync(uuid)?.object ?? null;
  } catch {
    return null;
  }
};

function playAttack(message, data) {
  const chain = chainOf(data);
  if (!chain || !data.targets?.length) return;
  const kind = data.kind === "spell" ? "spell" : data.attack?.ranged ? "ranged" : "melee";
  const file = pick(FX[kind]);
  if (!file) return;
  const actorToken = canvas.tokens?.get(message.speaker?.token) ?? fromUuidSync(data.actorUuid)?.getActiveTokens?.()?.[0];
  if (!actorToken) return;
  const seq = new Sequence();
  for (const t of data.targets) {
    const target = tokenOf(t.token);
    if (!target) continue;
    const e = seq.effect().file(file).atLocation(actorToken);
    if (kind === "melee") e.atLocation(target).scaleToObject(1.6);
    else e.stretchTo(target);
    if (!data.result?.success) e.missed();
  }
  seq.play();
}

function playImpact(defenseMessage, data) {
  const attack = game.messages.get(data.extra?.chain?.attackId);
  const atk = engineData(attack);
  const chain = chainOf(atk);
  if (!chain) return;
  let ties = true;
  try {
    ties = errata("tiesToAttacker") !== false;
  } catch {
    ties = true;
  }
  const o = outcome(chain, Number(atk.result?.hits) || 0, Number(data.result?.hits) || 0, { tiesToAttacker: ties });
  if (!o.hit) return;
  const file = pick(FX.impact);
  const target = canvas.tokens?.get(defenseMessage.speaker?.token) ?? fromUuidSync(data.actorUuid)?.getActiveTokens?.()?.[0];
  if (!file || !target) return;
  new Sequence().effect().file(file).atLocation(target).scaleToObject(1.4).play();
}

// Played by the client that made the roll; Sequencer shows it to everyone on the scene.
Hooks.on("createChatMessage", (message, options, userId) => {
  if (userId !== game.user.id || !fxOn()) return;
  const data = engineData(message);
  if (!data) return;
  try {
    if (data.kind === "weapon" || data.kind === "spell") playAttack(message, data);
    else if (data.kind === "defense" && data.extra?.chain?.attackId) playImpact(message, data);
  } catch (err) {
    console.warn(`${MODULE_ID} | attack fx`, err);
  }
});
