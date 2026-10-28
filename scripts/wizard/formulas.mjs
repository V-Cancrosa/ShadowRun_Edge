/**
 * Rating formulas kept on an item (e.g. price "R*250", essence "R*0.1"), so changing the Rating on the item sheet
 * recalculates the dependent stats like the rulebook tables do. Pure functions, testable in Node.
 */
import { evaluate } from "./parser.mjs";

const FORMULA_KEYS = ["price", "avail", "essence", "capacity", "dv", "defense"];
const usesRating = (value) => /\bR\b|Rating/i.test(String(value ?? ""));

/** Formula fields of a wizard state that depend on the rating, or null when nothing does. */
export function collectFormulas(state) {
  const formulas = {};
  for (const key of FORMULA_KEYS) {
    if (usesRating(state[key])) formulas[key] = state[key];
  }
  if (state.ar?.some(usesRating)) formulas.ar = [...state.ar];
  if (!Object.keys(formulas).length) return null;
  if (formulas.avail) formulas.legality = state.legality ?? "";
  if (formulas.dv) formulas.stun = !!state.stun;
  return formulas;
}

/** Item update data (flat "system.*" keys) for the given formulas at a new rating. */
export function ratingUpdates(formulas, rating) {
  const int = (expr) => Math.trunc(evaluate(expr, rating));
  const updates = {};
  if (formulas.price) updates["system.price"] = evaluate(formulas.price, rating);
  if (formulas.avail) {
    updates["system.avail"] = int(formulas.avail);
    updates["system.availDef"] = `${int(formulas.avail)}${formulas.legality ? `(${formulas.legality})` : ""}`;
  }
  if (formulas.essence) updates["system.essence"] = evaluate(formulas.essence, rating);
  if (formulas.capacity) updates["system.capacity"] = int(formulas.capacity);
  if (formulas.defense) updates["system.defense"] = Math.abs(int(formulas.defense));
  if (formulas.dv) {
    updates["system.dmg"] = int(formulas.dv);
    updates["system.dmgDef"] = `${int(formulas.dv)}${formulas.stun ? "S" : "P"}`;
  }
  if (formulas.ar) updates["system.attackRating"] = formulas.ar.map(int);
  return updates;
}
