/**
 * The item wizard's preview card: the stats of the item being made as label/value chips, pure for tests.
 * `L` localizes a key; values are shown as typed (formulas with R stay formulas, with their value when known).
 */
import { CATEGORIES } from "./categories.mjs";

const filled = (v) => v !== undefined && v !== null && String(v).trim() !== "";
/** The calculated value is worth showing only next to a formula (e.g. "R × 500"), not next to a plain number. */
const calc = (raw, preview) => (preview && /[a-z]/i.test(String(raw)) ? ` ${preview}` : "");

/** @returns {{ label: string, value: string, wide?: boolean }[]} */
export function previewChips(state, L = (k) => k, previews = {}) {
  const category = CATEGORIES[state.category] ?? {};
  const chips = [];
  const add = (label, value, wide = false) => filled(value) && chips.push({ label: L(label), value: String(value), wide });
  if (filled(state.rating)) add("SRE.Wizard.Rating", state.rating);
  if (category.weapon) {
    if (filled(state.dv)) add("SRE.Wizard.DV", `${state.dv}${state.stun ? "S" : "P"}`);
    const modes = Object.entries(state.modes ?? {}).filter(([, on]) => on).map(([m]) => m).join("/");
    add("SRE.Wizard.Modes", modes);
    if ((state.ar ?? []).some(filled)) add("SRE.Wizard.AR", state.ar.map((v) => (filled(v) ? v : "—")).join("/"), true);
    add("SRE.Wizard.Ammo", state.ammo);
  }
  add("SRE.Wizard.Defense", state.defense);
  add("shadowrun6.item.capacity", state.capacity);
  add("shadowrun6.item.essence", filled(state.essence) ? `${state.essence}${calc(state.essence, previews.essence)}` : "");
  if (filled(state.a) || filled(state.s)) add("SRE.Wizard.AttackSleaze", `${state.a || "—"}/${state.s || "—"}`);
  if (filled(state.d) || filled(state.f)) add("SRE.Wizard.DataFirewall", `${state.d || "—"}/${state.f || "—"}`);
  add("shadowrun6.label.progSlots", state.progSlots);
  if (filled(state.avail)) add("SRE.Wizard.Avail", `${state.avail}${state.legality ? `(${state.legality})` : ""}${calc(state.avail, previews.avail)}`);
  if (filled(state.price)) add("SRE.Wizard.Price", `${state.price}¥${calc(state.price, previews.price)}`, true);
  return chips;
}

/** Which wizard steps look done: kind always, paste after a parse, stats with a name, extras when anything is set. */
export function stepsDone(state, { parsed = false } = {}) {
  return {
    kind: true,
    paste: parsed,
    stats: filled(state.name),
    extras: (state.effects?.length ?? 0) + (state.mods?.length ?? 0) > 0 || filled(state.description),
  };
}
