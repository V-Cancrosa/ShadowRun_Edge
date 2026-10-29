/**
 * The system's roll dialog in the Edge sheet layout: header, dice pool and Edge tiles, panels (weapon, spell,
 * opposed test, Edge spending, modifiers) and toggle chips. The system's own fields are moved, not copied, and
 * stay inside the form, so its listeners, recalculations and the roll itself work exactly as before.
 */
const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function panel(title, hint) {
  const p = el("section", "sre-rd-panel");
  const h = el("h3");
  h.append(title);
  if (hint) h.append(el("small", "", hint));
  p.append(h);
  return p;
}

/** A field row: the label cell before the control's cell (as the system's tables have it) and the control's cell. */
function fieldPair(control) {
  if (control.tagName === "SELECT") control.removeAttribute("style");
  const cell = control.closest("td") ?? control;
  const label = cell.previousElementSibling?.tagName === "TD" ? cell.previousElementSibling : null;
  return [label, cell].filter(Boolean);
}

/** A checkbox shown as a toggle chip; the checkbox itself stays (hidden) inside the chip. */
function chip(checkbox, text, extra) {
  const c = el("label", "sre-rd-chip");
  c.append(checkbox, el("span", "", text));
  if (extra) c.append(el("b", "sre-rd-chip-value", extra));
  const sync = () => c.classList.toggle("on", checkbox.checked);
  checkbox.addEventListener("change", sync);
  sync();
  return c;
}

function stat(label, valueNode) {
  const s = el("span", "sre-rd-stat");
  s.append(el("i", "", label));
  const v = el("span", "sre-rd-stat-value");
  for (const n of [].concat(valueNode)) if (n) v.append(n);
  s.append(v);
  return s;
}

function textOf(node) {
  return (node?.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function restructure(app, form) {
  if (!form || form.dataset.sreRd) return;
  form.dataset.sreRd = "1";
  const q = (sel) => form.querySelector(sel);
  const actor = app.actor ?? app.options?.actor;
  const prepared = app.prepared ?? app.options?.prepared ?? {};
  const original = [...form.children];
  const hiddenBox = original.find((n) => n.classList?.contains("hidden"));

  const root = el("div", "sre-rd");
  // In the form from the start: whatever happens below, every moved field stays part of the form.
  form.prepend(root);

  // ── Header: kind of test, its name, attribute choice, warnings ──
  const h3 = form.querySelector("h3");
  const kind = textOf(h3?.querySelector("span:not(.plus-attribute)") ?? h3);
  const check = q("#rolldia-checkText");
  const head = el("header", "sre-rd-head");
  const title = el("div", "sre-rd-title");
  title.append(el("div", "sre-rd-kind", foundry.utils.escapeHTML(check ? kind : L("SRE.Roll.Test"))));
  if (check) {
    check.className = "sre-rd-name";
    title.append(check);
  } else title.append(el("div", "sre-rd-name", foundry.utils.escapeHTML(kind)));
  const itemName = prepared.item?.name ?? prepared.spell?.name;
  if (itemName && !textOf(check).includes(itemName)) title.append(el("div", "sre-rd-sub", foundry.utils.escapeHTML(itemName)));
  head.append(title);
  const attrib = q("select[name='attrib']");
  if (attrib) {
    const box = el("label", "sre-rd-attr");
    box.append(`+ ${L("shadowrun6.label.attribute")}`, attrib);
    head.append(box);
  }
  root.append(head);
  const notes = form.querySelectorAll(".matrix-command-line, .roll-dialog-message");
  if (notes.length) {
    const box = el("div", "sre-rd-notes");
    box.append(...notes);
    root.append(box);
  }

  const body = el("div", "sre-rd-body");
  root.append(body);

  // ── Tiles: dice pool and Edge ──
  const tiles = el("div", "sre-rd-tiles");
  const poolLabel = q("label[name='dicePool']");
  const poolTile = el("div", "sre-rd-tile sre-rd-pool");
  const poolBig = el("div", "sre-rd-big");
  if (poolLabel) poolBig.append(poolLabel);
  const calc = el("div", "sre-rd-calc");
  const poolText = el("div");
  poolText.append(el("div", "sre-rd-tile-label", L("SRE.Roll.Pool")), calc);
  poolTile.append(poolBig, poolText);
  tiles.append(poolTile);
  const edgeLabel = q("label[name='edgePool']");
  let pips = null;
  if (edgeLabel) {
    const edgeTile = el("div", "sre-rd-tile sre-rd-edge");
    const big = el("div", "sre-rd-big");
    big.append(edgeLabel);
    pips = el("div", "sre-rd-pips");
    const t = el("div");
    t.append(el("div", "sre-rd-tile-label", "Edge"), pips);
    edgeTile.append(big, t);
    tiles.append(edgeTile);
  } else tiles.classList.add("single");
  body.append(tiles);

  // ── Weapon ──
  const distance = q("#distance");
  const damage = q("span[name='calcDamage']");
  if (distance || damage) {
    const p = panel(L("SRE.Roll.Weapon"), foundry.utils.escapeHTML(prepared.item?.name ?? ""));
    const stats = el("div", "sre-rd-stats");
    const table = damage?.closest("table");
    const heads = table ? [...table.querySelectorAll("th")] : [];
    const cells = table ? [...(table.rows[1]?.cells ?? [])] : [];
    cells.forEach((cell, i) => stats.append(stat(textOf(heads[i]), [...cell.childNodes].length ? cell : null)));
    p.append(stats);
    const grid = el("div", "sre-rd-grid");
    for (const sel of ["#fireMode", "#fullAutoArea", "#bfType", "#distance", "#ammoLoaded"]) {
      const c = q(sel);
      if (c) grid.append(...fieldPair(c));
    }
    p.append(grid);
    body.append(p);
  }

  // ── Spell ──
  const drain = q("#spellDrain");
  if (drain) {
    const p = panel(L("SRE.Roll.Spell"), foundry.utils.escapeHTML(prepared.spell?.name ?? prepared.item?.name ?? ""));
    const stats = el("div", "sre-rd-stats");
    const table = drain.closest("table");
    const heads = [...table.querySelectorAll("th")];
    [...(drain.closest("tr")?.cells ?? [])].forEach((cell, i) => stats.append(stat(textOf(heads[i]), cell)));
    p.append(stats);
    const grid = el("div", "sre-rd-grid");
    for (const sel of ["#ampUp", "#incArea"]) {
      const c = q(sel);
      if (c) grid.append(...fieldPair(c));
    }
    if (grid.children.length) p.append(grid);
    body.append(p);
  }

  // ── Opposed test: Attack Rating vs Defense Rating ──
  const dr = q("#dr");
  const baseAR = q("#baseAR");
  if (dr || baseAR) {
    const p = panel(L("SRE.Roll.Opposed"), L("SRE.Roll.OpposedHint"));
    const vs = el("div", "sre-rd-vs");
    const left = el("div", "sre-rd-side");
    left.append(L("SRE.Roll.AR"), " ");
    if (baseAR) {
      baseAR.classList.add("sre-rd-v");
      left.append(baseAR);
    }
    const arMod = q("#arMod");
    if (arMod) left.append(" + ", arMod);
    const right = el("div", "sre-rd-side");
    right.append(L("SRE.Roll.DR"), " ");
    if (dr) right.append(dr);
    vs.append(left, el("b", "sre-rd-versus", "vs"), right);
    const sA = q("#situationalEdgeA");
    const sD = q("#situationalEdgeD");
    const leftChip = el("div", "sre-rd-side");
    if (sA) leftChip.append(chip(sA, L("shadowrun6.roll.edge.situational")));
    const rightChip = el("div", "sre-rd-side");
    if (sD) rightChip.append(chip(sD, L("shadowrun6.roll.edge.situational")));
    vs.append(leftChip, el("span"), rightChip);
    p.append(vs);
    const result = q("#edgeLabel");
    if (result) {
      result.removeAttribute("style");
      result.classList.add("sre-rd-result");
      p.append(result);
    }
    body.append(p);
  }

  // ── Edge spending ──
  const boost = q(".edgeBoosts");
  const action = q(".edgeActions");
  if (boost || action) {
    const p = panel(L("shadowrun6.roll.edge.spending"));
    const grid = el("div", "sre-rd-grid two");
    for (const [label, c] of [[L("shadowrun6.roll.edge.boost"), boost], [L("shadowrun6.label.action"), action]]) {
      if (!c) continue;
      c.removeAttribute("style");
      grid.append(el("label", "", foundry.utils.escapeHTML(label)), c);
    }
    p.append(grid);
    body.append(p);
  }

  // ── Modifiers: pool modifier, threshold, extended test, toggles ──
  const mods = panel(L("SRE.Roll.Modifiers"));
  const modBox = el("div", "sre-rd-mods");
  const modifier = q("#modifier");
  if (modifier) {
    const row = el("div", "sre-rd-mod");
    row.append(el("label", "", L("shadowrun6.roll.modifier")));
    const step = el("div", "sre-rd-step");
    const bump = (d) => {
      modifier.value = (parseInt(modifier.value) || 0) + d;
      modifier.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const minus = el("button", "", "−");
    const plus = el("button", "", "+");
    for (const [b, d] of [[minus, -1], [plus, 1]]) {
      b.type = "button";
      b.addEventListener("click", () => bump(d));
    }
    modifier.removeAttribute("style");
    step.append(minus, modifier, plus);
    row.append(step);
    modBox.append(row);
  }
  const threshold = q("#threshold");
  const extendedParts = [...form.querySelectorAll(".needed-for-extended")];
  if (threshold && !threshold.closest(".needed-for-extended")) {
    const row = el("div", "sre-rd-mod");
    row.append(el("label", "", L("shadowrun6.roll.threshold")), threshold);
    modBox.append(row);
  }
  if (extendedParts.length) {
    const row = el("div", "sre-rd-extended");
    row.append(...extendedParts);
    modBox.append(row);
  }
  const chips = el("div", "sre-rd-chips");
  const wound = q("#useWoundModifier");
  const woundValue = actor && typeof actor.getWoundModifier === "function" ? Number(actor.getWoundModifier()) || 0 : 0;
  if (wound) chips.append(chip(wound, L("SRE.Roll.Wound"), woundValue ? `−${woundValue}` : ""));
  const sustained = q("#useSustainedSpellModifier");
  const sustainedValue = actor && typeof actor.getSustainedModifier === "function" ? Number(actor.getSustainedModifier()) || 0 : 0;
  if (sustained) chips.append(chip(sustained, L("SRE.Roll.Sustained"), sustainedValue ? `−${sustainedValue}` : ""));
  const wild = q("input[name='useWildDie']");
  if (wild) chips.append(chip(wild, L("SRE.Roll.Wild")));
  const extended = q(".extended-test");
  if (extended) {
    extended.removeAttribute("style");
    chips.append(chip(extended, L("shadowrun6.roll.extended")));
  }
  const grunt = q("#useGruntGroup");
  if (grunt) chips.append(chip(grunt, textOf(grunt.closest("td")?.previousElementSibling) || "Grunt"));
  modBox.append(chips);
  mods.append(modBox);
  body.append(mods);

  // ── Anything the layout above doesn't know (newer system versions): keep it usable ──
  const leftovers = el("div", "sre-rd-leftovers");
  leftovers.append(...original.filter((n) => n !== hiddenBox && !root.contains(n)));
  const stray = [...leftovers.querySelectorAll("input, select, textarea")].filter((c) => c.type !== "hidden");
  if (stray.length) {
    const p = panel(L("SRE.Roll.Other"));
    const grid = el("div", "sre-rd-grid");
    for (const c of stray) grid.append(...fieldPair(c));
    p.append(grid);
    body.append(p);
  }
  form.append(leftovers);
  if (hiddenBox) form.append(hiddenBox);

  // ── Live parts: pool breakdown, Edge pips, the roll button's dice count ──
  const appEl = form.closest(".app, .application");
  const rollButton = appEl?.querySelector(".dialog-buttons button[data-button='normal'], .dialog-buttons button.normal");
  const boughtButton = appEl?.querySelector(".dialog-buttons button[data-button='bought'], .dialog-buttons button.bought");
  rollButton?.classList.add("sre-rd-roll");
  boughtButton?.classList.add("sre-rd-buy");
  const rollIcon = rollButton?.querySelector("i")?.outerHTML ?? "";
  const update = () => {
    const n = parseInt(poolLabel?.textContent) || 0;
    const parts = [`${L("SRE.Roll.Base")} ${Number(prepared.pool) || 0}`];
    const m = parseInt(modifier?.value) || 0;
    if (m) parts.push(`${L("SRE.Roll.Mod")} ${m > 0 ? "+" : "−"}${Math.abs(m)}`);
    if (wound?.checked && woundValue) parts.push(`${L("SRE.Roll.WoundShort")} −${woundValue}`);
    if (sustained?.checked && sustainedValue) parts.push(`${L("SRE.Roll.SustainedShort")} −${sustainedValue}`);
    calc.textContent = parts.join(" · ");
    if (rollButton) rollButton.innerHTML = `${rollIcon} ${foundry.utils.escapeHTML(L(n === 1 ? "SRE.Roll.RollOne" : "SRE.Roll.RollN", { n }))}`;
    const result = form.querySelector(".sre-rd-result");
    if (result) result.classList.toggle("empty", !result.textContent.trim());
    if (pips && edgeLabel) {
      const value = parseInt(edgeLabel.textContent) || 0;
      const max = Math.max(value, Number(actor?.system?.edge?.max) || value);
      pips.innerHTML = Array.from({ length: Math.min(max, 7) }, (_, i) => `<span class="sre-rd-pip${i < value ? " on" : ""}"></span>`).join("");
    }
  };
  update();
  const observer = new MutationObserver(update);
  for (const n of [poolLabel, edgeLabel].filter(Boolean)) observer.observe(n, { childList: true, characterData: true, subtree: true });
  form.addEventListener("change", update);
  form.addEventListener("input", update);

  appEl?.classList.add("sre-rd-app");
  if (typeof app.setPosition === "function") app.setPosition({ width: Math.max(app.position?.width ?? 0, 520), height: "auto" });
}

Hooks.on("renderRollDialog", (app, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  const form = (root?.tagName === "FORM" ? root : root?.querySelector("form")) ?? app.element?.[0]?.querySelector?.("form");
  try {
    restructure(app, form);
  } catch (err) {
    // Never block a roll: on any surprise the dialog keeps the system's own layout.
    console.warn("shadowrun-edge | roll dialog layout", err);
  }
});
