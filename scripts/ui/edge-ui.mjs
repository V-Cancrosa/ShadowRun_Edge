/**
 * Building blocks for the module's dialogs in the Edge sheet layout (styles/edge-dialogs.css, .sre-ed-*):
 * header, tiles, panels, option tiles (radio), toggle chips (checkbox), −/+ steppers, notes and monitors.
 * Everything is plain form markup, so DialogV2 callbacks read the values by name as before.
 */
const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
const attr = (name, value) => (value === undefined || value === null || value === false ? "" : value === true ? ` ${name}` : ` ${name}="${esc(value)}"`);

export function head({ kind, name, sub }) {
  return `<header class="sre-ed-head"><div class="sre-ed-kind">${esc(kind)}</div><div class="sre-ed-name">${esc(name)}</div>${sub ? `<div class="sre-ed-sub" data-sre="sub">${esc(sub)}</div>` : ""}</header>`;
}

/** Tiles: [{ id, big, label, calc, accent, money }] — `id` lets the dialog update the tile live (setTile). */
export function tiles(list) {
  const items = list.filter(Boolean);
  return `<div class="sre-ed-tiles${items.length === 1 ? " single" : ""}">${items.map((t) => `
    <div class="sre-ed-tile${t.accent ? " accent" : ""}${t.money ? " money" : ""}"${attr("data-tile", t.id)}>
      <div class="sre-ed-big" data-part="big">${esc(t.big)}</div>
      <div><div class="sre-ed-tile-label">${esc(t.label)}</div><div class="sre-ed-calc" data-part="calc">${esc(t.calc ?? "")}</div></div>
    </div>`).join("")}</div>`;
}

export function setTile(root, id, { big, calc } = {}) {
  const tile = root?.querySelector(`[data-tile="${id}"]`);
  if (!tile) return;
  if (big !== undefined) tile.querySelector("[data-part=big]").textContent = big;
  if (calc !== undefined) tile.querySelector("[data-part=calc]").textContent = calc;
}

export function panel(title, inner, { hint, attrs = "" } = {}) {
  return `<section class="sre-ed-panel"${attrs}><h3>${esc(title)}${hint ? `<small>${esc(hint)}</small>` : ""}</h3>${inner}</section>`;
}

const avatar = (a) => (a ? `<span class="sre-ed-av"${a.img ? ` style="background-image:url('${esc(a.img)}')"` : ""}>${a.img ? "" : esc(String(a.name ?? "?").charAt(0))}</span>` : "");

/** Option tiles (one choice): [{ value, label, small, icon, avatar: { img, name }, checked, disabled }]. */
export function options(name, list, { cards = false, people = false } = {}) {
  return `<div class="sre-ed-opts${cards ? " cards" : ""}${people ? " people" : ""}">${list.map((o) => `
    <label class="sre-ed-opt"${attr("data-value", o.value)}>
      <input type="radio" name="${esc(name)}" value="${esc(o.value)}"${attr("checked", !!o.checked)}${attr("disabled", !!o.disabled)}>
      ${o.icon ? `<i class="${esc(o.icon)}"></i>` : ""}${avatar(o.avatar)}<b>${esc(o.label)}</b>${o.small ? `<small>${esc(o.small)}</small>` : ""}
    </label>`).join("")}</div>`;
}

/** Option tiles with several choices (checkboxes): [{ value, label, small, avatar, checked }]. */
export function toggles(name, list, { people = false } = {}) {
  return `<div class="sre-ed-opts${people ? " people" : ""}">${list.map((o) => `
    <label class="sre-ed-opt">
      <input type="checkbox" name="${esc(name)}" value="${esc(o.value)}"${attr("checked", !!o.checked)}>
      ${avatar(o.avatar)}<b>${esc(o.label)}</b>${o.small ? `<small>${esc(o.small)}</small>` : ""}
    </label>`).join("")}</div>`;
}

export function chip(name, label, { checked = false, value = "", attrs = "" } = {}) {
  return `<label class="sre-ed-chip"${attrs}><input type="checkbox" name="${esc(name)}"${attr("checked", checked)}><span>${esc(label)}</span>${value ? `<b>${esc(value)}</b>` : ""}</label>`;
}

export function chips(list) {
  return `<div class="sre-ed-chips">${list.filter(Boolean).join("")}</div>`;
}

export function stepper(name, value, { min, max, placeholder } = {}) {
  return `<div class="sre-ed-step"><button type="button" data-step="-1">−</button><input type="number" name="${esc(name)}" value="${esc(value ?? "")}"${attr("min", min)}${attr("max", max)}${attr("placeholder", placeholder)}><button type="button" data-step="1">+</button></div>`;
}

export function row(label, control, { attrs = "", avatar: av, small } = {}) {
  return `<div class="sre-ed-row"${attrs}>${avatar(av)}<label>${esc(label)}${small ? ` <small>${esc(small)}</small>` : ""}</label>${control}</div>`;
}

export function rows(list) {
  return `<div class="sre-ed-rows">${list.filter(Boolean).join("")}</div>`;
}

/** A note line; `html` for trusted, already escaped markup (e.g. a localized string with <b>). */
export function note(text, kind = "ok", { id, html = false } = {}) {
  return `<div class="sre-ed-note ${kind}"${attr("data-note", id)}${text ? "" : " hidden"}>${html ? text : esc(text)}</div>`;
}

export function setNote(root, id, text) {
  const n = root?.querySelector(`[data-note="${id}"]`);
  if (!n) return;
  n.textContent = text ?? "";
  n.hidden = !text;
}

/** Condition monitor row: filled boxes, with `heal` of them (from the end) outlined as the forecast. */
export function monitorRow(id, label, max, dmg) {
  return `<div class="sre-ed-monitor" data-monitor="${esc(id)}" data-max="${max}" data-dmg="${dmg}"><span>${esc(label)}</span><span class="sre-ed-boxes">${monitorBoxes(id, max, dmg, 0)}</span><span>${dmg}/${max}</span></div>`;
}

function monitorBoxes(id, max, dmg, heal) {
  return Array.from({ length: max }, (_, i) => {
    const cls = i >= dmg ? "" : i >= dmg - heal ? " heal" : ` ${id}`;
    return `<span class="sre-ed-box${cls}"></span>`;
  }).join("");
}

export function setMonitorForecast(root, heal = {}) {
  for (const m of root?.querySelectorAll("[data-monitor]") ?? []) {
    const id = m.dataset.monitor;
    m.querySelector(".sre-ed-boxes").innerHTML = monitorBoxes(id, Number(m.dataset.max), Number(m.dataset.dmg), Number(heal[id]) || 0);
  }
}

/** Footer buttons for DialogV2.wait: a quiet cancel and the main action. */
export function buttons(label, callback, { icon, cancel } = {}) {
  return [
    { action: "cancel", label: cancel ?? game.i18n.localize("Cancel"), class: "sre-ed-ghost" },
    { action: "ok", label, icon, default: true, class: "sre-ed-main", callback },
  ];
}

/** Wires the steppers and returns the form; call from the DialogV2 render callback. */
export function wire(dialog, onChange) {
  const root = dialog?.element;
  const form = root?.querySelector("form") ?? root;
  if (!form) return null;
  form.addEventListener("click", (event) => {
    const b = event.target.closest("[data-step]");
    if (!b) return;
    const input = b.parentElement.querySelector("input");
    const min = input.min === "" ? -Infinity : Number(input.min);
    const max = input.max === "" ? Infinity : Number(input.max);
    input.value = Math.min(max, Math.max(min, (Number(input.value) || 0) + Number(b.dataset.step)));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  if (onChange) {
    form.addEventListener("change", () => onChange(form));
    form.addEventListener("input", () => onChange(form));
    onChange(form);
  }
  // The main button's label can follow the dialog (e.g. "Roll 9 dice").
  return form;
}

export function setMainLabel(dialog, text) {
  const b = dialog?.element?.querySelector(".form-footer button[data-action='ok']");
  const span = b?.querySelector("span") ?? b;
  if (span) span.textContent = text;
}

/** Shows only the elements whose data-for lists the current value. */
export function showFor(form, value) {
  for (const el of form.querySelectorAll("[data-for]")) el.hidden = !el.dataset.for.split(" ").includes(value);
}

/** Result of DialogV2.wait with buttons(): null when cancelled or closed. */
export const okOnly = (r) => (r && r !== "cancel" ? r : null);

/** A short confirmation in the Edge layout; resolves to true or false. */
export async function confirm({ title, kind, name, text, button, icon, warn = false }) {
  const r = await foundry.applications.api.DialogV2.wait({
    classes: ["sre-dialog"],
    window: { title: title ?? name },
    position: { width: 420 },
    content: `<div class="sre-ed">${head({ kind, name })}<div class="sre-ed-body">${note(text, warn ? "warn" : "info")}</div></div>`,
    buttons: buttons(button, () => true, { icon }),
    rejectClose: false,
  });
  return r === true;
}
