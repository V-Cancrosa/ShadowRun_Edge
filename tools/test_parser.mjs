// Checks how the item wizard reads rulebook table rows. Run: node tools/test_parser.mjs
import assert from "node:assert/strict";
import { parseStatLine, evaluate } from "../scripts/wizard/parser.mjs";
import { CATEGORIES } from "../scripts/wizard/categories.mjs";

const parse = (category, line, subtype) => parseStatLine(line, CATEGORIES[category], subtype);

let r = parse("firearm", "Fichetti Security 600 2P SA 9/8/6/–/– 30(c) 2(L) 350¥");
assert.equal(r.name, "Fichetti Security 600");
assert.deepEqual(r.fields.ar, ["9", "8", "6", "", ""]);
assert.equal(r.fields.dv, "2");
assert.equal(r.fields.modes.SA, true);
assert.equal(r.fields.ammo, "30");
assert.equal(r.fields.avail, "2");
assert.equal(r.fields.legality, "L");
assert.equal(r.fields.price, "350");

r = parse("firearm", "Rifle 4S(e) SA/BF/FA 4/11/9/7/1 40(c) 4(I) 1,250¥");
assert.equal(r.fields.stun, true);
assert.equal(r.fields.modes.FA, true);
assert.equal(r.fields.price, "1250");

r = parse("melee", "Knife 3P 8 2(L) 300¥");
assert.deepEqual(r.fields.ar, ["8", "", "", "", ""]);

r = parse("armor", "Helmet +1 2 1 100¥");
assert.deepEqual([r.fields.defense, r.fields.capacity, r.fields.avail], ["1", "2", "1"]);

r = parse("cyberware", "Cybereyes Rating x 0.1 Rating x 4 3(L) Rating x 1,000¥");
assert.deepEqual([r.fields.essence, r.fields.capacity, r.fields.price], ["R*0.1", "R*4", "R*1000"]);

r = parse("cyberware", "Datajack 0,1 — 2 1000¥");
assert.deepEqual([r.fields.essence, r.fields.capacity, r.fields.avail], ["0.1", "", "2"]);

r = parse("electronics", "Deck 3 6/5 4 5(I) 50000¥", "CYBERDECK");
assert.deepEqual([r.fields.rating, r.fields.a, r.fields.s, r.fields.progSlots], ["3", "6", "5", "4"]);

r = parse("electronics", "Link 1 1/1 1 2 100¥", "COMMLINK");
assert.deepEqual([r.fields.rating, r.fields.d, r.fields.f, r.fields.avail], ["1", "1", "1", "2"]);

r = parse("gear", "Medkit R R(L) R*250¥");
assert.equal(r.fields.rating, undefined);
assert.equal(r.fields.avail, "R");

assert.equal(evaluate("R*0.1", 3), 0.3);
assert.equal(evaluate("R+2", 4), 6);
assert.equal(evaluate("Rating x 1000", 2), 2000);
assert.equal(evaluate("alert(1)"), 0);

console.log("parser OK");
