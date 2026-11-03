/**
 * Stage 13B: the module's own roll engine. Every test the module starts (sheets, linked tasks, soak, weapons, spells)
 * goes through one window, one roll and one chat card here; the system's numbers (pools, Attack Ratings, Damage,
 * wound and sustaining modifiers) are read from its prepared data, its dice and dialog are not used.
 * Rules: scripts/dice/dice-rules.mjs (pp. 35–48 with errata). World setting "rollEngine": edge | system.
 *
 * A roll lives in the chat message flag `shadowrun-edge.roll`; the card's HTML is rebuilt from it whenever it
 * changes (Edge after the roll, damage applied), so linked tasks under it see the current hits.
 */
import * as R from "./dice-rules.mjs";
import * as ui2 from "../ui/edge-ui.mjs";
import { canBreakRules } from "../ui/conflict.mjs";

const MODULE_ID = "shadowrun-edge";
const SOCKET = `module.${MODULE_ID}`;
const FLAG = "roll";
const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== "" && v !== null ? Number(v) : d);

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "rollEngine", {
    name: "SRE.Roll.Setting.Name", hint: "SRE.Roll.Setting.Hint", scope: "world", config: true, type: String,
    choices: { edge: "SRE.Roll.Setting.edge", system: "SRE.Roll.Setting.system" }, default: "edge",
  });
});

/** Whether the module's engine rolls (else the system's dialog and cards, as before 0.37). */
export function engineOn() {
  try {
    return game.settings.get(MODULE_ID, "rollEngine") !== "system";
  } catch {
    return true;
  }
}

// ───── Actor data the engine reads (the system computes it) ─────

export function edgeOf(actor) {
  return { value: num(actor?.system?.edge?.value), max: num(actor?.system?.edge?.max) };
}

function woundOf(actor) {
  try {
    return Math.max(0, num(actor?.getWoundModifier?.()));
  } catch {
    return 0;
  }
}

function sustainOf(actor) {
  try {
    return Math.max(0, num(actor?.getSustainedModifier?.()));
  } catch {
    return 0;
  }
}

function systemSetting(key, fallback) {
  try {
    return game.settings.get("shadowrun6-eden", key);
  } catch {
    return fallback;
  }
}

/** Targets of this user, with their physical Defense Rating. */
function targets() {
  return [...(game.user?.targets ?? [])].map((t) => ({
    uuid: t.actor?.uuid ?? null, token: t.document?.uuid ?? null, name: t.name ?? t.actor?.name ?? "?",
    img: t.document?.texture?.src ?? t.actor?.img ?? "", dr: num(t.actor?.system?.defenserating?.physical?.pool),
  }));
}

function combatantOf(actor) {
  const combat = game.combat;
  if (!combat?.started || !actor) return null;
  return combat.combatants.find((c) => c.actor?.id === actor.id || c.actor === actor) ?? null;
}

/** Bonus Edge gained this round (combatant flag) and the per-round limit (system setting, book 2). */
function gainState(actor) {
  const c = combatantOf(actor);
  const flag = c?.getFlag(MODULE_ID, "edgeGain");
  const round = game.combat?.round ?? 0;
  return { combatant: c, gainedRound: flag?.round === round ? num(flag.n) : 0, maxRound: num(systemSetting("maxEdgePerRound", R.MAX_GAIN_PER_ROUND), R.MAX_GAIN_PER_ROUND), inCombat: !!c };
}

/** Gives `want` bonus Edge within the limits; returns how much was given. */
export async function gainEdge(actor, want) {
  const st = gainState(actor);
  const { value } = edgeOf(actor);
  const n = R.gainable(want, { current: value, gainedRound: st.gainedRound, maxRound: st.maxRound, inCombat: st.inCombat });
  if (!n) return 0;
  if (actor.isOwner) await actor.update({ "system.edge.value": value + n });
  else gmDo({ type: "sre-edge-add", uuid: actor.uuid, n });
  if (st.combatant?.isOwner) await st.combatant.setFlag(MODULE_ID, "edgeGain", { round: game.combat.round, n: st.gainedRound + n });
  return n;
}

async function spendEdge(actor, n) {
  const { value } = edgeOf(actor);
  await actor.update({ "system.edge.value": Math.max(0, value - n) });
}

/** Something on another user's actor or message: the active GM does it. */
function gmDo(data) {
  if (game.user.isGM) return handleGm(data, game.user.id);
  game.socket.emit(SOCKET, data);
}

async function handleGm(data) {
  const actor = data.uuid ? await fromUuid(data.uuid) : null;
  const a = actor?.actor ?? actor;
  switch (data.type) {
    case "sre-edge-add": {
      if (!a) return;
      const { value } = edgeOf(a);
      return a.update({ "system.edge.value": Math.max(0, Math.min(R.EDGE_CAP, value + num(data.n))) });
    }
    case "sre-edge-twos":
      return a?.setFlag(MODULE_ID, "twosGlitch", true);
    case "sre-roll-update": {
      const message = game.messages.get(data.messageId);
      if (message) return message.update(data.update);
      return;
    }
  }
}

Hooks.once("ready", () => {
  game.socket.on(SOCKET, (data, senderId) => {
    if (!String(data?.type ?? "").startsWith("sre-edge-") && data?.type !== "sre-roll-update") return;
    if (!game.users.activeGM?.isSelf || !game.users.get(senderId)) return;
    handleGm(data, senderId);
  });
});

// ───── The request ─────

/**
 * @typedef {object} TestRequest
 * @property {string} kind      skill | attribute | test | defense | soak | drain | weapon | spell | ritual | complexform | vehicle | legwork
 * @property {string} label     what is rolled ("Pistols + Agility")
 * @property {string} [title]   heading (item name, test name)
 * @property {number} pool      dice before the window's modifiers
 * @property {number} [threshold]
 * @property {boolean} [wild]
 * @property {boolean} [allowBuy=true]
 * @property {boolean} [useWound=true]
 * @property {boolean} [useSustain]
 * @property {string[]} [context]  for Edge Actions: melee, ranged, multi, influence, con, block, hit_dirt
 * @property {object} [attack]  { ar: number[5], dv, stun, modes, ranged, ammo: {count, cap, item} }
 * @property {object} [spell]   { drain, combat, area, indirect }
 * @property {object} [soak]    { dv, monitor, kind: damage|drain, magic }
 * @property {number} [skillRank] for Big Speech's teamwork cap
 * @property {boolean} [untrained]
 * @property {object} [task]    linked task (scripts/linked-roll.mjs)
 * @property {object} [extra]   anything carried to the card (itemUuid…)
 */

const MODES = ["SS", "SA", "BF", "BFW", "FA"];

/** Attack Rating per range, Damage and rounds for a fire mode (as the system's weapon dialog computes them). */
export function fireMode(attack, mode, faArea = 1) {
  const base = attack?.ar ?? [0, 0, 0, 0, 0];
  const m = attack?.arMods ?? {};
  let arMod = 0;
  let dmg = 0;
  let rounds = attack?.ranged ? 1 : 0;
  switch (mode) {
    case "SA": rounds = 2; arMod = Math.min(0, num(m.SA, -2)); dmg = 1; break;
    case "BF": rounds = 4; arMod = Math.min(0, num(m.BF, -4)); dmg = 2; break;
    case "BFW": rounds = 4; arMod = Math.min(0, num(m.SA, -2)); dmg = 1; break;
    case "FA": rounds = 10; arMod = Math.min(0, num(m.FA, -6)) - (Math.max(1, num(faArea, 1)) - 1) * 2; break;
  }
  const ar = base.map((v) => (num(v) > 0 ? Math.max(0, num(v) + arMod) : num(v)));
  return { ar, dv: num(attack?.dv) + dmg, rounds, arMod };
}

/** Modes a weapon has (system.modes SS/SA/BF/FA flags); BF also allows a wide burst. */
export function modesOf(attack) {
  if (!attack?.ranged) return [];
  const has = attack.modes ?? {};
  const list = MODES.filter((m) => (m === "BFW" ? has.BF : has[m]));
  return list.length ? list : ["SS"];
}

// ───── The window ─────

function edgeChoices(actor, req, tgts) {
  const { value, max } = edgeOf(actor);
  const list = [{ value: "", label: L("SRE.Roll.Edge.none"), small: L("SRE.Roll.Edge.have", { n: value }) }];
  const can = (cost) => cost <= value || canBreakRules();
  const add = (id, cost, extra = {}) => list.push({ value: id, label: L(`SRE.Roll.Boost.${id}`), small: `${cost} Edge${extra.small ? ` · ${extra.small}` : ""}`, disabled: !can(cost), cost });
  if (req.allowEdge !== false) {
    add("add_edge", 4, { small: L("SRE.Roll.Edge.addEdgeHint", { n: max }) });
    if (tgts.length) {
      add("negate_foe", 2, { small: tgts[0].name });
      add("twos_glitch", 5, { small: tgts[0].name });
    }
    for (const a of R.edgeActionsFor(req.context ?? [])) {
      list.push({ value: `action:${a.id}`, label: L(`SRE.Roll.Action.${a.id}`), small: `${a.cost} Edge · ${L(`SRE.Roll.ActionHint.${a.id}`)}`, disabled: !can(a.cost), cost: a.cost });
    }
    list.push({ value: "burn:smackdown", label: L("SRE.Roll.Burn.smackdown"), small: L("SRE.Roll.Burn.smackdownHint"), disabled: max < 1 && !canBreakRules() });
  }
  return list;
}

function rangeLabels() {
  return ["close", "near", "medium", "far", "extreme"].map((r) => L(`SRE.Roll.Range.${r}`));
}

/** Opens the roll window; resolves to the chosen options, or null when cancelled. */
async function rollWindow(actor, req) {
  const wound = req.useWound === false ? 0 : woundOf(actor);
  const sustain = req.useSustain ? sustainOf(actor) : 0;
  const tgts = targets();
  const modes = modesOf(req.attack);
  const ranges = rangeLabels();
  const st = {};
  const tiles = [
    { id: "pool", big: req.pool, label: L("SRE.Roll.Pool"), calc: "", accent: true },
    { id: "edge", big: edgeOf(actor).value, label: "Edge", calc: "" },
    req.attack ? { id: "ar", big: "", label: L("SRE.Roll.AR"), calc: "" } : null,
    req.attack ? { id: "dv", big: "", label: L("SRE.Roll.DV"), calc: "" } : null,
    req.spell ? { id: "drain", big: req.spell.drain, label: L("SRE.Roll.Drain"), calc: "" } : null,
    req.soak ? { id: "dv", big: req.soak.dv, label: L("SRE.Roll.Incoming"), calc: "" } : null,
  ];
  const attackPanel = req.attack ? ui2.panel(L("SRE.Roll.AttackPanel"), [
    modes.length ? ui2.options("mode", modes.map((m, i) => ({ value: m, label: L(`SRE.Roll.Mode.${m}`), small: L(`SRE.Roll.ModeHint.${m}`), checked: i === 0 })), { cards: true }) : "",
    ui2.rows([
      req.attack.ranged ? ui2.row(L("SRE.Roll.Range.label"), `<select name="range">${ranges.map((r, i) => `<option value="${i}"${i === 1 ? " selected" : ""}>${esc(r)}</option>`).join("")}</select>`) : "",
      modes.includes("FA") ? ui2.row(L("SRE.Roll.FaArea"), ui2.stepper("faArea", 1, { min: 1, max: 10 }), { attrs: ' data-for="FA"' }) : "",
      tgts.length ? ui2.row(L("SRE.Roll.Targets"), `<span>${tgts.map((t) => `${esc(t.name)} (${L("SRE.Roll.DR")} ${t.dr})`).join(", ")}</span>`) : "",
      req.attack.ammo?.cap ? ui2.row(L("SRE.Roll.Ammo"), `<span data-sre="ammo">${req.attack.ammo.count}/${req.attack.ammo.cap}</span>`) : "",
    ]),
    ui2.note("", "info", { id: "gain" }),
  ].join("")) : "";
  const spellPanel = req.spell ? ui2.panel(L("SRE.Roll.SpellPanel"), ui2.rows([
    req.spell.combat ? ui2.row(L("SRE.Roll.AmpUp"), ui2.stepper("ampUp", 0, { min: 0, max: 20 }), { small: L("SRE.Roll.AmpUpHint") }) : "",
    req.spell.area ? ui2.row(L("SRE.Roll.IncreaseArea"), ui2.stepper("area", 0, { min: 0, max: 20 }), { small: L("SRE.Roll.IncreaseAreaHint") }) : "",
  ])) : "";
  const content = `<div class="sre-ed sre-roll-window">
    ${ui2.head({ kind: L(`SRE.Roll.Kind.${req.kind}`), name: req.title ?? req.label, sub: req.title ? req.label : "" })}
    <div class="sre-ed-body">
      ${ui2.tiles(tiles)}
      ${attackPanel}${spellPanel}
      ${ui2.panel(L("SRE.Roll.Modifiers"), ui2.rows([
        ui2.row(L("SRE.Roll.Modifier"), ui2.stepper("mod", 0, { min: -30, max: 30 })),
        req.allowThreshold !== false && !req.soak ? ui2.row(L("SRE.Roll.Threshold"), ui2.stepper("threshold", num(req.threshold) || "", { min: 0, max: 30, placeholder: "—" })) : "",
        ui2.row(L("SRE.Roll.Retry"), ui2.stepper("retry", 0, { min: 0, max: 10 }), { small: L("SRE.Roll.RetryHint") }),
      ]) + ui2.chips([
        wound ? ui2.chip("wound", L("SRE.Roll.Wound"), { checked: true, value: `−${wound}` }) : "",
        sustain ? ui2.chip("sustain", L("SRE.Roll.Sustain"), { checked: true, value: `−${sustain}` }) : "",
        ui2.chip("wild", L("SRE.Roll.Wild"), { checked: !!req.wild }),
        req.allowBuy !== false ? ui2.chip("buy", L("SRE.Roll.Buy")) : "",
      ]))}
      ${req.allowEdge !== false ? ui2.panel(L("SRE.Roll.EdgePanel"), ui2.options("edge", edgeChoices(actor, req, tgts).map((o, i) => ({ ...o, checked: i === 0 }))), { hint: L("SRE.Roll.EdgeOnce") }) : ""}
      ${ui2.panel(L("SRE.Roll.Visibility"), `<select name="rollMode">${Object.entries(CONFIG.Dice.rollModes).map(([k, v]) => `<option value="${k}"${k === game.settings.get("core", "rollMode") ? " selected" : ""}>${esc(L(v?.label ?? v))}</option>`).join("")}</select>`)}
      ${ui2.note("", "warn", { id: "warn" })}
    </div>
  </div>`;

  const read = (form) => {
    const f = new FormData(form);
    const get = (k) => f.get(k);
    const mode = get("mode") ?? (req.attack?.ranged ? "SS" : null);
    const fm = req.attack ? fireMode(req.attack, mode, num(get("faArea"), 1)) : null;
    const range = req.attack ? (req.attack.ranged ? num(get("range"), 1) : 0) : null;
    const edge = get("edge") ?? "";
    const o = {
      mod: num(get("mod")), threshold: num(get("threshold")), retry: num(get("retry")),
      wound: wound && f.has("wound") ? wound : 0, sustain: sustain && f.has("sustain") ? sustain : 0,
      wild: f.has("wild"), buy: f.has("buy"), edge, rollMode: get("rollMode"),
      mode, range, faArea: num(get("faArea"), 1), fm, ampUp: num(get("ampUp")), area: num(get("area")),
    };
    o.untrainedFix = edge === "action:sudden_insight" && req.untrained ? 1 : 0;
    o.pool = Math.max(0, num(req.pool) + o.mod - o.wound - o.sustain + R.retryPenalty(o.retry) + o.untrainedFix);
    o.ar = fm ? num(fm.ar[range]) : null;
    o.dv = fm ? fm.dv + (edge === "action:vitals" ? 3 : 0) : null;
    o.drain = req.spell ? num(req.spell.drain) + o.ampUp * 2 + o.area : null;
    return o;
  };
  const refresh = (dialog, form) => {
    const o = read(form);
    const root = dialog.element;
    ui2.setTile(root, "pool", { big: o.buy ? `${R.boughtHits(o.pool)}✓` : o.pool, calc: o.buy ? L("SRE.Roll.BoughtCalc", { n: o.pool }) : [o.mod && `${o.mod > 0 ? "+" : ""}${o.mod}`, o.wound && `−${o.wound}`, o.sustain && `−${o.sustain}`, o.retry && `${R.retryPenalty(o.retry)}`].filter(Boolean).join(" ") });
    if (req.attack) {
      ui2.setTile(root, "ar", { big: o.ar > 0 ? o.ar : "—", calc: o.fm?.arMod ? `${o.fm.arMod}` : "" });
      ui2.setTile(root, "dv", { big: `${o.dv}${req.attack.stun ? L("SRE.Roll.StunShort") : L("SRE.Roll.PhysShort")}`, calc: o.fm?.rounds ? L("SRE.Roll.Rounds", { n: o.fm.rounds }) : "" });
      const dr = Math.max(0, ...tgts.map((t) => t.dr));
      const g = tgts.length ? R.edgeFromRatings(o.ar, dr) : null;
      ui2.setNote(root, "gain", g?.attacker ? L("SRE.Roll.GainYou", { ar: o.ar, dr }) : g?.defender ? L("SRE.Roll.GainThem", { ar: o.ar, dr }) : "");
      ui2.showFor(form, o.mode ?? "");
    }
    if (req.spell) ui2.setTile(root, "drain", { big: o.drain });
    const cost = edgeChoices(actor, req, tgts).find((c) => c.value === o.edge)?.cost ?? 0;
    const warn = [];
    if (o.buy && o.edge) warn.push(L("SRE.Roll.WarnBuyEdge"));
    if (cost > edgeOf(actor).value) warn.push(L("SRE.Roll.WarnEdge", { n: cost, have: edgeOf(actor).value }));
    if (req.attack?.ammo?.cap && o.fm?.rounds > req.attack.ammo.count) warn.push(L("SRE.Roll.WarnAmmo", { n: o.fm.rounds, have: req.attack.ammo.count }));
    ui2.setNote(root, "warn", warn.join(" "));
    ui2.setMainLabel(dialog, o.buy ? L("SRE.Roll.BuyButton", { n: R.boughtHits(o.pool) }) : L("SRE.Roll.RollButton", { n: o.pool }));
    Object.assign(st, o);
  };
  const result = await foundry.applications.api.DialogV2.wait({
    classes: ["sre-dialog", "sre-roll-dialog-v2"],
    window: { title: req.title ?? req.label, icon: "fas fa-dice-six" },
    position: { width: 520 },
    content,
    buttons: ui2.buttons(L("SRE.Roll.RollButton", { n: req.pool }), (event, button) => read(button.form), { icon: "fas fa-dice-six" }),
    render: (event, dialog) => {
      const form = ui2.wire(dialog, (f) => refresh(dialog, f));
      if (form) refresh(dialog, form);
    },
    rejectClose: false,
  });
  return ui2.okOnly(result);
}

// ───── Rolling ─────

/** Rolls `n` dice (the first one wild when asked) with Foundry dice, so Dice So Nice shows them. */
async function throwDice(n, { wild = false, explode = false } = {}) {
  if (n <= 0) return { dice: [], rolls: [] };
  const x = explode ? "x6" : "";
  const formula = wild ? (n > 1 ? `1d6${x}[wild] + ${n - 1}d6${x}` : `1d6${x}[wild]`) : `${n}d6${x}`;
  const roll = await new Roll(formula).evaluate();
  const dice = [];
  roll.dice.forEach((term, t) => {
    const count = wild && t === 0 ? 1 : wild ? n - 1 : n;
    term.results.forEach((r, i) => dice.push({ v: r.result, wild: wild && t === 0 && i === 0, exploded: i >= count }));
  });
  return { dice, rolls: [roll] };
}

/** One roll of the engine: the window (unless `options` is given), the dice, Edge, the card. */
export async function edgeTest(actor, req, options = null) {
  if (!actor) return null;
  const o = options ?? (await rollWindow(actor, req));
  if (!o) return null;
  const notes = [];
  const edge = { pre: null, action: null, burn: null, post: [], spent: 0 };
  const tgts = targets();

  // Edge from Attack Rating vs Defense Rating at the start of an attack (p. 45).
  let gained = 0;
  let theirGain = 0;
  if (req.attack && tgts.length && o.ar !== null) {
    const dr = Math.max(0, ...tgts.map((t) => t.dr));
    const g = R.edgeFromRatings(o.ar, dr);
    if (g.attacker) gained = await gainEdge(actor, 1);
    theirGain = g.defender;
  }

  // Edge before the roll: one expenditure (p. 44, errata "per action").
  let pool = o.pool;
  let explode = false;
  let twos = !!actor.getFlag?.(MODULE_ID, "twosGlitch");
  if (twos && actor.isOwner) await actor.unsetFlag(MODULE_ID, "twosGlitch");
  const { value: edgeNow, max: edgeMax } = edgeOf(actor);
  let cost = 0;
  if (o.edge && !o.buy) {
    if (o.edge.startsWith("action:")) {
      const a = R.EDGE_ACTIONS.find((x) => x.id === o.edge.slice(7));
      edge.action = a?.id;
      cost = R.costOf(a);
    } else if (o.edge === "burn:smackdown") {
      edge.burn = "smackdown";
    } else {
      edge.pre = o.edge;
      cost = R.costOf(R.BOOSTS.find((b) => b.id === o.edge));
    }
    if (cost > edgeNow + gained && !canBreakRules()) return ui.notifications.warn(L("SRE.Roll.WarnEdge", { n: cost, have: edgeNow + gained }));
    if (cost) await spendEdge(actor, cost);
    edge.spent = cost;
    if (edge.pre === "add_edge") {
      pool += edgeMax;
      explode = true;
    }
    if (edge.pre === "negate_foe" && tgts[0]?.uuid) gmDo({ type: "sre-edge-add", uuid: tgts[0].uuid, n: -1 });
    if (edge.pre === "twos_glitch" && tgts[0]?.uuid) gmDo({ type: "sre-edge-twos", uuid: tgts[0].uuid });
    if (edge.burn) {
      // Burning Edge (p. 48): a point of Edge rank is lost for good, and every Edge point is spent.
      await actor.update({ "system.edge.value": 0, "system.edge.max": Math.max(0, edgeMax - 1) });
      notes.push(L("SRE.Roll.Burned"));
    }
  }

  // The dice.
  let dice = [];
  let rolls = [];
  let first = null;
  if (edge.burn === "smackdown" || o.buy) {
    // no dice
  } else if (edge.action === "big_speech") {
    // Roll twice: the first is a teamwork test whose hits add dice to the second (p. 47).
    const a = await throwDice(pool, { wild: o.wild, explode });
    const ra = R.evaluate(a.dice, { twos });
    const extra = req.skillRank ? R.teamworkDice([ra.hits], req.skillRank) : ra.hits;
    first = { dice: a.dice, hits: ra.hits, extra };
    const b = await throwDice(pool + extra, { wild: o.wild, explode });
    dice = b.dice;
    rolls = [...a.rolls, ...b.rolls];
  } else {
    ({ dice, rolls } = await throwDice(pool, { wild: o.wild, explode }));
  }

  const data = {
    v: 1, actorUuid: actor.uuid, kind: req.kind, title: req.title ?? "", label: req.label, img: req.img ?? actor.img,
    pool, basePool: num(req.pool), mods: { mod: o.mod, wound: o.wound, sustain: o.sustain, retry: o.retry, untrained: o.untrainedFix },
    threshold: num(o.threshold) || num(req.threshold), wild: !!o.wild, buy: !!o.buy, twos, explode,
    dice, first, edge, gained, notes,
    attack: req.attack ? { ar: o.ar, dv: o.dv, stun: !!req.attack.stun, mode: o.mode, rounds: o.fm?.rounds ?? 0, range: o.range, faArea: o.faArea, ranged: !!req.attack.ranged, theirGain, effects: edgeEffects(edge.action) } : null,
    spell: req.spell ? { ...req.spell, drain: o.drain, ampUp: o.ampUp, area: o.area } : null,
    soak: req.soak ?? null,
    targets: tgts,
    extra: req.extra ?? {},
  };
  data.result = resultOf(data);

  // Ammunition (as the system: rounds of the fire mode).
  const ammo = req.attack?.ammo;
  if (ammo?.item && ammo.cap > 0 && data.attack.rounds > 0) {
    const item = await fromUuid(ammo.item);
    if (item?.isOwner) await item.update({ "system.ammocount": Math.max(0, num(item.system.ammocount) - data.attack.rounds) });
  }

  const flags = { [MODULE_ID]: { [FLAG]: data } };
  if (req.task) flags[MODULE_ID].task = req.task;
  const msg = {
    speaker: ChatMessage.getSpeaker({ actor }),
    content: cardHtml(data),
    rolls,
    sound: rolls.length ? CONFIG.sounds.dice : null,
    flags,
  };
  ChatMessage.applyRollMode(msg, o.rollMode ?? game.settings.get("core", "rollMode"));
  return ChatMessage.create(msg);
}

/** Effects of an Edge Action carried to the defense and damage steps. */
function edgeEffects(action) {
  return ["knockout_blow", "tumble", "disarm", "vitals", "shank", "fire_from_cover", "anticipation", "tactical_roll", "wrest", "bring_the_drama"].includes(action) ? [action] : [];
}

export function resultOf(data) {
  if (data.edge?.burn === "smackdown") return R.smackdown(data.threshold);
  if (data.buy) {
    const hits = R.boughtHits(data.pool);
    const t = num(data.threshold);
    return { hits, ones: 0, glitch: false, critical: false, success: t ? hits >= t : hits > 0, net: Math.max(0, hits - t), bought: true };
  }
  return R.evaluate(data.dice ?? [], { threshold: data.threshold, twos: data.twos, autoHits: num(data.autoHits) });
}

/** Hits of a message rolled by the engine (null for other messages). */
export function engineHits(message) {
  const d = message?.getFlag?.(MODULE_ID, FLAG);
  return d ? num(d.result?.hits) : null;
}

export function engineData(message) {
  return message?.getFlag?.(MODULE_ID, FLAG) ?? null;
}

// ───── The card ─────

function verdict(r) {
  if (!r) return null;
  if (r.critical) return "critical";
  if (r.glitch) return "glitch";
  return r.success ? "success" : "failure";
}

export function cardHtml(d) {
  const r = d.result ?? resultOf(d);
  const order = R.displayOrder(d.dice ?? []);
  const die = (x, pos) => `<span style="--i:${pos}" class="sre-die${x.v >= 5 ? " hit" : ""}${x.v === 1 || (d.twos && x.v === 2) ? " one" : ""}${x.wild ? " wild" : ""}${x.exploded ? " exploded" : ""}${x.rerolled ? " edged" : ""}${x.edged ? " edged" : ""}${d.wild && r.wildCancel && x.v === 5 && !x.wild ? " ignored" : ""}" data-i="${x.i}">${x.v}</span>`;
  const v = verdict(r);
  const lines = [];
  const mods = d.mods ?? {};
  const poolCalc = [`${d.basePool}`, mods.mod ? `${mods.mod > 0 ? "+" : ""}${mods.mod}` : "", mods.wound ? `−${mods.wound} ${L("SRE.Roll.WoundShort")}` : "", mods.sustain ? `−${mods.sustain} ${L("SRE.Roll.SustainShort")}` : "", mods.retry ? `${R.retryPenalty(mods.retry)} ${L("SRE.Roll.RetryShort")}` : "", mods.untrained ? `+1 ${L("SRE.Roll.Action.sudden_insight")}` : "", d.explode ? `+Edge` : ""].filter(Boolean).join(" ");
  if (d.attack) {
    const a = d.attack;
    lines.push(`<div class="sre-rc-stats">
      ${a.mode ? `<span><small>${esc(L("SRE.Roll.ModeShort"))}</small><b>${esc(L(`SRE.Roll.Mode.${a.mode}`))}</b></span>` : ""}
      <span><small>${esc(L("SRE.Roll.AR"))}</small><b>${a.ar > 0 ? a.ar : "—"}</b></span>
      <span><small>${esc(L("SRE.Roll.DV"))}</small><b>${a.dv}${a.stun ? L("SRE.Roll.StunShort") : L("SRE.Roll.PhysShort")}</b></span>
      ${a.rounds ? `<span><small>${esc(L("SRE.Roll.AmmoShort"))}</small><b>${a.rounds}</b></span>` : ""}
      ${d.targets?.length ? `<span><small>${esc(L("SRE.Roll.DR"))}</small><b>${Math.max(0, ...d.targets.map((t) => t.dr))}</b></span>` : ""}
    </div>`);
  }
  if (d.spell) lines.push(`<div class="sre-rc-stats"><span><small>${esc(L("SRE.Roll.Drain"))}</small><b>${d.spell.drain}</b></span>${d.spell.ampUp ? `<span><small>${esc(L("SRE.Roll.AmpUp"))}</small><b>+${d.spell.ampUp}</b></span>` : ""}${d.spell.area ? `<span><small>${esc(L("SRE.Roll.IncreaseArea"))}</small><b>+${d.spell.area * 2} m</b></span>` : ""}</div>`);
  if (d.soak) {
    const left = Math.max(0, num(d.soak.dv) - r.hits);
    const monitor = soakMonitor(d, left);
    lines.push(`<div class="sre-rc-soak"><span>${esc(L("SRE.Roll.SoakLeft", { dv: d.soak.dv, hits: r.hits }))}</span><b class="${monitor}">${left}${monitor === "stun" ? L("SRE.Roll.StunShort") : L("SRE.Roll.PhysShort")}</b>${d.soak.applied ? `<em>${esc(L("SRE.Roll.Applied"))}</em>` : left ? `<button type="button" data-sre-roll="apply"><i class="fas fa-heart-crack"></i> ${esc(L("SRE.Roll.Apply"))}</button>` : ""}</div>`);
  }
  const resist = d.spell ? { kind: "drain", dv: num(d.spell.drain) } : d.kind === "complexform" ? { kind: "fading", dv: num(d.extra?.fading) } : null;
  if (resist && resist.dv > 0) {
    lines.push(`<div class="sre-rc-resist">${d.extra?.resisted ? `<em>${esc(L(`SRE.Roll.Resisted.${resist.kind}`))}</em>` : `<button type="button" data-sre-roll="resist" data-owner-only><i class="fas fa-brain"></i> ${esc(L(`SRE.Roll.Resist.${resist.kind}`, { dv: resist.dv }))}</button>`}</div>`);
  }
  if (d.first) lines.push(`<div class="sre-rc-note">${esc(L("SRE.Roll.BigSpeechFirst", { hits: d.first.hits, extra: d.first.extra }))}</div>`);
  const edgeNotes = [];
  if (d.gained) edgeNotes.push(L("SRE.Roll.Gained", { n: d.gained }));
  if (d.attack?.theirGain) edgeNotes.push(L("SRE.Roll.TheyGain"));
  if (d.edge?.pre) edgeNotes.push(`${L(`SRE.Roll.Boost.${d.edge.pre}`)} (${d.edge.spent})`);
  if (d.edge?.action) edgeNotes.push(`${L(`SRE.Roll.Action.${d.edge.action}`)} (${d.edge.spent}) — ${L(`SRE.Roll.ActionHint.${d.edge.action}`)}`);
  if (d.edge?.burn) edgeNotes.push(L(`SRE.Roll.Burn.${d.edge.burn}`));
  for (const p of d.edge?.post ?? []) edgeNotes.push(`${L(`SRE.Roll.Boost.${p.id}`)}${p.times > 1 ? ` ×${p.times}` : ""} (${p.cost})`);
  if (d.twos) edgeNotes.push(L("SRE.Roll.TwosOnYou"));
  for (const n of d.notes ?? []) edgeNotes.push(n);
  const t = num(d.threshold);
  const canPost = !d.buy && !d.edge?.burn && !(d.edge?.spent > 0) && !(d.edge?.post?.length);
  return `<div class="sre-rc" data-sre-card="roll">
    <header class="sre-rc-head">
      ${d.img ? `<img src="${esc(d.img)}" alt="">` : ""}
      <div><div class="sre-rc-kind">${esc(L(`SRE.Roll.Kind.${d.kind}`))}</div><div class="sre-rc-title">${esc(d.title || d.label)}</div>${d.title ? `<div class="sre-rc-sub">${esc(d.label)}</div>` : ""}</div>
    </header>
    ${lines.join("")}
    <div class="sre-dice-strip">${order.map(die).join("")}${v ? `<span class="sre-stamp sre-stamp-${v}">${esc(L(`SRE.Motion.Verdict.${v}`))}</span>` : ""}</div>
    <div class="sre-rc-result">
      <span class="sre-rc-hits"><b>${r.hits}</b> ${esc(L("SRE.Roll.Hits"))}${t ? ` <small>/ ${t}</small>` : ""}</span>
      ${t && r.success ? `<span class="sre-rc-net">${esc(L("SRE.Roll.Net", { n: r.net }))}</span>` : ""}
      <span class="sre-rc-pool" title="${esc(poolCalc)}">${r.bought ? esc(L("SRE.Roll.Bought", { n: d.pool })) : esc(L("SRE.Roll.PoolOf", { n: d.pool }))}${d.wild ? ` · ${esc(L("SRE.Roll.WildShort"))}` : ""}</span>
    </div>
    ${edgeNotes.length ? `<div class="sre-rc-edge"><i class="fas fa-bolt"></i> ${edgeNotes.map(esc).join(" · ")}</div>` : ""}
    ${canPost ? `<div class="sre-rc-post" data-owner-only>
      <button type="button" data-sre-roll="open"><i class="fas fa-bolt"></i> ${esc(L("SRE.Motion.SpendEdge"))}</button>
      <div class="sre-rc-post-menu" hidden>
        <p>${esc(L("SRE.Roll.PickDice"))}</p>
        <button type="button" data-sre-roll="reroll_one">${esc(L("SRE.Roll.Boost.reroll_one"))} <small>1/${esc(L("SRE.Roll.Die"))}</small></button>
        <button type="button" data-sre-roll="plus_1_die">${esc(L("SRE.Roll.Boost.plus_1_die"))} <small>2/${esc(L("SRE.Roll.Die"))}</small></button>
        <button type="button" data-sre-roll="auto_hit">${esc(L("SRE.Roll.Boost.auto_hit"))} <small>3</small></button>
        <button type="button" data-sre-roll="reroll_failed"${r.glitch ? " disabled" : ""}>${esc(L("SRE.Roll.Boost.reroll_failed"))} <small>4</small></button>
      </div>
    </div>` : ""}
  </div>`;
}

/** Monitor for what is left after a soak: drain is Stun unless it is higher than the caster's Magic (p. 131). */
export function soakMonitor(d, left) {
  // Drain (p. 131) and fading (p. 191): Stun, Physical when higher than Magic / Resonance after the test.
  if (d.soak?.kind === "drain" || d.soak?.kind === "fading") return left > num(d.soak.limit ?? d.soak.magic) ? "physical" : "stun";
  return d.soak?.monitor === "stun" ? "stun" : "physical";
}

// ───── After the roll: Edge and applying damage ─────

async function updateRoll(message, data) {
  data.result = resultOf(data);
  const update = { content: cardHtml(data), [`flags.${MODULE_ID}.${FLAG}`]: data };
  if (message.isOwner) return message.update(update);
  gmDo({ type: "sre-roll-update", messageId: message.id, update });
}

async function postBoost(message, boost, picked) {
  const data = foundry.utils.deepClone(engineData(message));
  const actor = await fromUuid(data.actorUuid);
  if (!actor?.isOwner) return ui.notifications.warn(L("SRE.Roll.NotYours"));
  const def = R.BOOSTS.find((b) => b.id === boost);
  const blocked = R.postBlocked(boost, data.result, { buy: data.buy });
  if (blocked) return ui.notifications.warn(L(`SRE.Roll.Blocked.${blocked}`));
  const needsDice = boost === "reroll_one" || boost === "plus_1_die";
  if (needsDice && !picked.length) return ui.notifications.info(L("SRE.Roll.PickDice"));
  const times = needsDice ? picked.length : 1;
  const cost = R.costOf(def, times);
  const have = edgeOf(actor).value;
  if (cost > have && !canBreakRules()) return ui.notifications.warn(L("SRE.Roll.WarnEdge", { n: cost, have }));
  await spendEdge(actor, cost);
  if (boost === "auto_hit") data.autoHits = num(data.autoHits) + 1;
  else if (boost === "plus_1_die") data.dice = R.applyPost(data.dice, boost, { index: picked, times });
  else {
    // Rerolls use Foundry's dice too, so Dice So Nice shows them.
    const which = boost === "reroll_one" ? picked.slice(0, times) : data.dice.map((x, i) => (x.v < 5 ? i : -1)).filter((i) => i >= 0);
    if (which.length) {
      const roll = await new Roll(`${which.length}d6`).evaluate();
      roll.dice[0].results.forEach((res, k) => { data.dice[which[k]] = { ...data.dice[which[k]], v: res.result, rerolled: true }; });
      game.dice3d?.showForRoll?.(roll, game.user, true);
    }
  }
  data.edge.post = [...(data.edge.post ?? []), { id: boost, times, cost }];
  return updateRoll(message, data);
}

async function applySoak(message) {
  const data = foundry.utils.deepClone(engineData(message));
  const actor = await fromUuid(data.actorUuid);
  const left = Math.max(0, num(data.soak?.dv) - num(data.result?.hits));
  if (!actor || !left) return;
  const monitor = soakMonitor(data, left);
  const { applyDamage } = await import("../sheet/system-rolls.mjs");
  if (actor.isOwner) await applyDamage(actor, monitor, left);
  else return ui.notifications.warn(L("SRE.Roll.NotYours"));
  data.soak.applied = true;
  return updateRoll(message, data);
}

Hooks.on("renderChatMessageHTML", (message, html) => {
  const data = engineData(message);
  if (!data) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  const card = root?.querySelector("[data-sre-card=roll]");
  if (!card) return;
  root.classList.add("sre-engine-roll");
  const actorOwned = (() => {
    try {
      return !!fromUuidSync(data.actorUuid)?.isOwner;
    } catch {
      return message.isOwner;
    }
  })();
  if (!actorOwned) card.querySelectorAll("[data-owner-only], [data-sre-roll=apply]").forEach((el) => el.remove());
  const picked = new Set();
  card.querySelector("[data-sre-roll=open]")?.addEventListener("click", (e) => {
    e.preventDefault();
    const menu = card.querySelector(".sre-rc-post-menu");
    menu.hidden = !menu.hidden;
    card.classList.toggle("sre-picking", !menu.hidden);
  });
  card.querySelectorAll(".sre-dice-strip .sre-die").forEach((el) => el.addEventListener("click", () => {
    if (!card.classList.contains("sre-picking")) return;
    const i = Number(el.dataset.i);
    if (picked.has(i)) picked.delete(i);
    else picked.add(i);
    el.classList.toggle("picked", picked.has(i));
  }));
  for (const b of card.querySelectorAll(".sre-rc-post-menu [data-sre-roll]")) {
    b.addEventListener("click", (e) => {
      e.preventDefault();
      postBoost(message, b.dataset.sreRoll, [...picked]);
    });
  }
  card.querySelector("[data-sre-roll=resist]")?.addEventListener("click", async (e) => {
    e.preventDefault();
    const actor = await fromUuid(data.actorUuid);
    if (!actor?.isOwner) return;
    const fading = data.kind === "complexform";
    const dv = fading ? num(data.extra?.fading) : num(data.spell?.drain);
    const pool = num(actor.system?.defensepool?.[fading ? "fading" : "drain"]?.pool);
    const { rollSoakTest } = await import("../sheet/system-rolls.mjs");
    const m = await rollSoakTest(actor, { soakType: fading ? "fading" : "drain", damage: dv, pool, label: L(`SRE.Roll.Resist.${fading ? "fading" : "drain"}`, { dv }) });
    if (m) {
      const copy = foundry.utils.deepClone(data);
      copy.extra = { ...copy.extra, resisted: true };
      updateRoll(message, copy);
    }
  });
  card.querySelector("[data-sre-roll=apply]")?.addEventListener("click", (e) => {
    e.preventDefault();
    applySoak(message);
  });
  Hooks.callAll("sre.renderRollCard", message, card, data);
});
