/**
 * Karma vote: the GM posts a chat card listing the player characters, everyone votes how much Karma each one
 * earned, and the GM closes the vote and awards it (system.karma and system.karma_total).
 * Players cannot edit the GM's chat message, so their votes go to the active GM through the module socket.
 */
const MODULE_ID = "shadowrun-edge";
const SOCKET = `module.${MODULE_ID}`;
const FLAG = "karmaVote";

/** Per character: number of votes, average and the suggested award (rounded average). */
export function tally(vote) {
  return Object.fromEntries(vote.actors.map(({ id }) => {
    const values = Object.values(vote.votes?.[id] ?? {}).map(Number);
    const average = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    return [id, { count: values.length, average: Math.round(average * 10) / 10, suggested: Math.round(average) }];
  }));
}

/** Whether a user may vote for a character (players do not vote for their own character when the rule is on). */
export function canVote(vote, actorOwners, userId, actorId) {
  if (vote.status !== "open") return false;
  if (!vote.actors.some((a) => a.id === actorId)) return false;
  return !(vote.noSelfVote && actorOwners.includes(userId));
}

const esc = (text) => Handlebars.escapeExpression(String(text));

/** Card HTML shared by everyone; per-user highlights are added when the message renders. */
export function renderCard(vote) {
  const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
  const results = tally(vote);
  const rows = vote.actors.map((actor) => {
    const r = results[actor.id];
    let right;
    if (vote.status === "closed") {
      right = `<span class="sre-kv-award">+${vote.awarded?.[actor.id] ?? 0} ${L("SRE.KarmaVote.Karma")}</span>`;
    } else {
      const buttons = Array.from({ length: vote.max + 1 }, (_, n) =>
        `<button type="button" class="sre-kv-value" data-actor="${actor.id}" data-value="${n}">${n}</button>`).join("");
      right = `<div class="sre-kv-buttons">${buttons}</div><span class="sre-kv-count">${L("SRE.KarmaVote.Votes", { count: r.count })}</span>`;
    }
    return `<div class="sre-kv-row" data-actor="${actor.id}">
      <img src="${esc(actor.img)}" alt=""><span class="sre-kv-name">${esc(actor.name)}</span>${right}</div>`;
  }).join("");
  const footer = vote.status === "closed"
    ? `<p class="sre-kv-status">${L("SRE.KarmaVote.Closed")}</p>`
    : `<p class="hint">${L(vote.noSelfVote ? "SRE.KarmaVote.HintNoSelf" : "SRE.KarmaVote.Hint", { max: vote.max })}</p>
       <button type="button" class="sre-kv-close"><i class="fas fa-flag-checkered"></i> ${L("SRE.KarmaVote.Close")}</button>`;
  return `<div class="sre-karma-vote">
    <h3><i class="fas fa-star"></i> ${esc(vote.title || L("SRE.KarmaVote.Title"))}</h3>${rows}${footer}</div>`;
}

function ownersOf(actorId) {
  const actor = game.actors.get(actorId);
  if (!actor) return [];
  return game.users.filter((u) => !u.isGM && actor.testUserPermission(u, "OWNER")).map((u) => u.id);
}

const isActiveGM = () => (game.users.activeGM ?? game.users.find((u) => u.isGM && u.active))?.id === game.user.id;

/** GM side: records a vote on the card. */
async function recordVote(messageId, userId, actorId, value) {
  const message = game.messages.get(messageId);
  const vote = message?.getFlag(MODULE_ID, FLAG);
  if (!vote || !canVote(vote, ownersOf(actorId), userId, actorId)) return;
  const n = Math.trunc(Number(value));
  if (!(n >= 0 && n <= vote.max)) return;
  const updated = foundry.utils.deepClone(vote);
  updated.votes ??= {};
  updated.votes[actorId] ??= {};
  updated.votes[actorId][userId] = n;
  await message.update({ content: renderCard(updated), [`flags.${MODULE_ID}.${FLAG}`]: updated });
}

/** GM dialog: starts a vote for the chosen player characters. */
export async function startKarmaVote() {
  if (!game.user.isGM) return;
  const L = (key) => game.i18n.localize(key);
  const characters = game.actors.filter((a) => a.type === "Player" && a.hasPlayerOwner);
  if (!characters.length) {
    ui.notifications.warn(L("SRE.KarmaVote.NoCharacters"));
    return;
  }
  const list = characters.map((a) => `<label class="sre-kv-pick"><input type="checkbox" name="actor" value="${a.id}" checked>
    <img src="${esc(a.img)}" alt=""> ${esc(a.name)}</label>`).join("");
  const content = `
    <div class="form-group"><label>${L("SRE.KarmaVote.TitleField")}</label>
      <input type="text" name="title" placeholder="${esc(L("SRE.KarmaVote.Title"))}"></div>
    <div class="sre-kv-picks">${list}</div>
    <div class="form-group"><label>${L("SRE.KarmaVote.Max")}</label>
      <input type="number" name="max" value="5" min="1" max="20" step="1"></div>
    <div class="form-group"><label>${L("SRE.KarmaVote.NoSelf")}</label>
      <input type="checkbox" name="noSelf" checked></div>`;
  const settings = await foundry.applications.api.DialogV2.wait({
    classes: ["sre-dialog"],
    window: { title: L("SRE.KarmaVote.Title"), icon: "fas fa-star" },
    content,
    buttons: [{
      action: "start", label: L("SRE.KarmaVote.Start"), icon: "fas fa-check", default: true,
      callback: (event, button) => {
        const f = button.form.elements;
        const ids = [...button.form.querySelectorAll("input[name=actor]:checked")].map((i) => i.value);
        return { ids, max: Math.min(20, Math.max(1, Math.trunc(Number(f.max.value) || 5))), noSelf: f.noSelf.checked, title: f.title.value.trim() };
      },
    }],
    rejectClose: false,
  });
  if (!settings?.ids?.length) return;
  const vote = {
    status: "open",
    title: settings.title,
    max: settings.max,
    noSelfVote: settings.noSelf,
    actors: settings.ids.map((id) => game.actors.get(id)).map((a) => ({ id: a.id, name: a.name, img: a.img })),
    votes: {},
  };
  await ChatMessage.create({
    speaker: { alias: game.i18n.localize("SRE.KarmaVote.Title") },
    content: renderCard(vote),
    flags: { [MODULE_ID]: { [FLAG]: vote } },
  });
}

/** GM: closes the vote, lets the GM adjust the suggested awards and adds them to the characters. */
async function closeVote(message) {
  const vote = message.getFlag(MODULE_ID, FLAG);
  if (!vote || vote.status !== "open" || !game.user.isGM) return;
  const results = tally(vote);
  const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
  const rows = vote.actors.map((a) => `<div class="form-group">
      <label>${esc(a.name)} <span class="hint">${L("SRE.KarmaVote.Average", { average: results[a.id].average, count: results[a.id].count })}</span></label>
      <input type="number" name="${a.id}" value="${results[a.id].suggested}" min="0" step="1"></div>`).join("");
  const awards = await foundry.applications.api.DialogV2.wait({
    classes: ["sre-dialog"],
    window: { title: L("SRE.KarmaVote.Close"), icon: "fas fa-flag-checkered" },
    content: `<p class="hint">${L("SRE.KarmaVote.AwardHint")}</p>${rows}`,
    buttons: [{
      action: "award", label: L("SRE.KarmaVote.Award"), icon: "fas fa-star", default: true,
      callback: (event, button) => Object.fromEntries(vote.actors.map((a) =>
        [a.id, Math.max(0, Math.trunc(Number(button.form.elements[a.id].value) || 0))])),
    }],
    rejectClose: false,
  });
  if (!awards) return;
  for (const [actorId, karma] of Object.entries(awards)) {
    const actor = game.actors.get(actorId);
    if (!actor || !karma) continue;
    await actor.update({
      "system.karma": (Number(actor.system.karma) || 0) + karma,
      "system.karma_total": (Number(actor.system.karma_total) || 0) + karma,
    });
  }
  const closed = { ...foundry.utils.deepClone(vote), status: "closed", awarded: awards };
  await message.update({ content: renderCard(closed), [`flags.${MODULE_ID}.${FLAG}`]: closed });
}

/** Wires the card buttons and adds what only this user should see (own vote, GM averages). */
function decorate(message, root) {
  const vote = message.getFlag(MODULE_ID, FLAG);
  const card = root?.querySelector(".sre-karma-vote");
  if (!vote || !card || card.dataset.sreBound) return;
  card.dataset.sreBound = "1";
  const results = tally(vote);

  for (const row of card.querySelectorAll(".sre-kv-row")) {
    const actorId = row.dataset.actor;
    const mine = vote.votes?.[actorId]?.[game.user.id];
    const allowed = canVote(vote, ownersOf(actorId), game.user.id, actorId);
    for (const button of row.querySelectorAll(".sre-kv-value")) {
      if (Number(button.dataset.value) === mine) button.classList.add("sre-kv-mine");
      button.disabled = !allowed;
    }
    if (game.user.isGM && vote.status === "open" && results[actorId].count) {
      const avg = document.createElement("span");
      avg.classList.add("sre-kv-avg");
      avg.textContent = game.i18n.format("SRE.KarmaVote.AverageShort", { average: results[actorId].average });
      row.append(avg);
    }
  }
  card.addEventListener("click", (event) => {
    const value = event.target.closest(".sre-kv-value");
    if (value && !value.disabled) {
      const { actor, value: n } = value.dataset;
      if (isActiveGM()) recordVote(message.id, game.user.id, actor, n);
      else if (!game.users.activeGM) ui.notifications.warn(game.i18n.localize("SRE.KarmaVote.NoGM"));
      else game.socket.emit(SOCKET, { type: "karmaVote", messageId: message.id, userId: game.user.id, actorId: actor, value: n });
      return;
    }
    if (event.target.closest(".sre-kv-close")) closeVote(message);
  });
  const close = card.querySelector(".sre-kv-close");
  if (close && !game.user.isGM) close.remove();
}

Hooks.on("renderChatMessageHTML", (message, html) => decorate(message, html));

Hooks.once("ready", () => {
  game.socket.on(SOCKET, (data, senderId) => {
    if (data?.type !== "karmaVote" || !isActiveGM()) return;
    // Trust the sender's id from the socket when Foundry provides it, not the id inside the payload.
    recordVote(data.messageId, senderId ?? data.userId, data.actorId, data.value);
  });
});

/** "Karma vote" button for the GM in the Actors sidebar. */
Hooks.on("renderActorDirectory", (app, html) => {
  if (!game.user.isGM) return;
  const root = html instanceof HTMLElement ? html : html[0];
  const actions = root?.querySelector(".header-actions");
  if (!actions || actions.querySelector(".sre-karma-vote-button")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.classList.add("sre-karma-vote-button");
  button.innerHTML = `<i class="fas fa-star"></i> ${game.i18n.localize("SRE.KarmaVote.Button")}`;
  button.addEventListener("click", () => startKarmaVote());
  actions.append(button);
});
