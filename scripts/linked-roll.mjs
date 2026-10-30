/**
 * Module tests rolled through the system's roll dialog. The system's chat message gets a module "task" flag;
 * when the message renders, the task's handler adds its result (healing, scatter, services…) under the roll,
 * computed from the message's current hits, so Edge spent after the roll (which updates the same message)
 * changes the result too. Effects happen only on an "Apply"-style button, from the hits at that moment.
 * With hits typed in by hand there is no system roll: the module posts its own message with the same task.
 */
import * as rolls from "./sheet/system-rolls.mjs";

const MODULE_ID = "shadowrun-edge";
const SOCKET = `module.${MODULE_ID}`;
const FLAG = "task";

/** kind → { render(task, hits, message) → HTML, bind?(root, message, task, hits) } */
const HANDLERS = new Map();

export function registerTask(kind, handler) {
  HANDLERS.set(kind, handler);
}

/** Hits of a task message: typed-in hits, else the (possibly Edge-updated) system roll. */
export function hitsOf(message) {
  const task = message?.getFlag?.(MODULE_ID, FLAG);
  if (task && task.manualHits !== null && task.manualHits !== undefined) return Number(task.manualHits) || 0;
  return Number(message?.rolls?.[0]?.total) || 0;
}

/** Waits for the chat message of a roll this user makes for this actor. */
function captureNextRoll(actor, timeout = 120000) {
  let stop;
  const promise = new Promise((resolve) => {
    const id = Hooks.on("createChatMessage", (message) => {
      if (message.author?.id !== game.user.id || !message.rolls?.length) return;
      if (message.speaker?.actor && message.speaker.actor !== actor.id) return;
      stop();
      resolve(message);
    });
    const timer = setTimeout(() => {
      stop();
      resolve(null);
    }, timeout);
    stop = () => {
      Hooks.off("createChatMessage", id);
      clearTimeout(timer);
    };
  });
  return { promise, stop: () => stop() };
}

/**
 * Rolls `pool` through the system dialog and attaches `task` to the resulting chat message.
 * @returns {Promise<ChatMessage|null>} null when the dialog was cancelled
 */
export async function systemTest(actor, { pool, label, threshold, useWoundModifier, task }) {
  const capture = captureNextRoll(actor);
  let result;
  try {
    result = await rolls.rollPool(actor, { pool, label, kind: "test", threshold, useWoundModifier });
  } catch (err) {
    capture.stop();
    throw err;
  }
  if (!result) {
    capture.stop();
    return null;
  }
  // 3.x posts the message after the dialog resolves; give it a moment.
  const message = await Promise.race([capture.promise, new Promise((r) => setTimeout(() => r(null), 10000))]);
  capture.stop();
  if (!message) return null;
  await message.setFlag(MODULE_ID, FLAG, task);
  return message;
}

/** Posts a module message for a task with hits typed in by hand. */
export async function manualTest(actor, { label, hits, task }) {
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="sre-task-host"><h3>${foundry.utils.escapeHTML(label)}</h3></div>`,
    flags: { [MODULE_ID]: { [FLAG]: { ...task, manualHits: Number(hits) || 0 } } },
  });
}

/** Rolls through the dialog, or posts a manual message when hits were typed in. */
export function runTest(actor, { pool, label, threshold, useWoundModifier, manualHits, task }) {
  if (manualHits !== null && manualHits !== undefined && manualHits !== "") return manualTest(actor, { label, hits: manualHits, task });
  return systemTest(actor, { pool, label, threshold, useWoundModifier, task });
}

/** Records something on the task (e.g. applied); the GM does it for users who don't own the message. */
export async function patchTask(message, patch) {
  if (message.isOwner) return message.setFlag(MODULE_ID, FLAG, { ...message.getFlag(MODULE_ID, FLAG), ...patch });
  if (game.users.activeGM) game.socket.emit(SOCKET, { type: "patchTask", messageId: message.id, patch });
}

Hooks.on("renderChatMessageHTML", (message, html) => {
  const task = message.getFlag(MODULE_ID, FLAG);
  const handler = task && HANDLERS.get(task.kind);
  if (!handler) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  const content = root?.querySelector(".message-content") ?? root;
  if (!content || content.querySelector(".sre-task")) return;
  const hits = hitsOf(message);
  const box = document.createElement("div");
  box.className = "sre-task";
  try {
    box.innerHTML = handler.render(task, hits, message);
    content.append(box);
    handler.bind?.(box, message, task, hits);
  } catch (err) {
    console.warn(`${MODULE_ID} | task ${task.kind}`, err);
  }
});

Hooks.once("ready", () => {
  game.socket.on(SOCKET, async (data, senderId) => {
    if (data?.type !== "patchTask" || !game.users.activeGM?.isSelf) return;
    const message = game.messages.get(data.messageId);
    const task = message?.getFlag(MODULE_ID, FLAG);
    if (!task) return;
    // Only "done" markers may be set this way, never the task's numbers.
    const allowed = Object.fromEntries(Object.entries(data.patch ?? {}).filter(([k, v]) => ["applied", "exploded", "created"].includes(k) && v === true));
    if (!Object.keys(allowed).length || !game.users.get(senderId)) return;
    await message.setFlag(MODULE_ID, FLAG, { ...task, ...allowed });
  });
});
