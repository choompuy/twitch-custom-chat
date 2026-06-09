const MAX_MESSAGES = 10;
const MESSAGE_LIFETIME = 15000;
const DEFAULT_COLOR = "#00ff88";
const USER_BLACKLIST = new Set(["streamelements", "nightbot", "moobot", "wizebot", "streamlabs", "jeetbot", "vsestream"]);

const chat = document.getElementById("chat");
const template = document.getElementById("message-template");
const _escapeDiv = document.createElement("div");
const badgeCache = new Map();
const nodePool = [];
let messageQueue = [];
let rafPending = false;

window.addEventListener("onEventReceived", ({ detail }) => {
  const { listener } = detail;

  if (listener === "message") {
    const data = detail.event.data;
    const username = (data.nick || data.displayName || "").toLowerCase();

    if (USER_BLACKLIST.has(username)) return;

    messageQueue.push({
      kind: "message",
      data,
    });
  }

  if (!rafPending) {
    rafPending = true;
    requestAnimationFrame(flushQueue);
  }
});

function flushQueue() {
  rafPending = false;
  const start = Math.max(0, messageQueue.length - MAX_MESSAGES);
  const toRender = messageQueue.slice(start);
  messageQueue.length = 0;

  const fragment = document.createDocumentFragment();

  for (const item of toRender) fragment.appendChild(createMessage(item.data));

  chat.appendChild(fragment);
  while (chat.children.length > MAX_MESSAGES) {
    recycleNode(chat.firstElementChild);
  }
}

function getNode() {
  if (nodePool.length) {
    const n = nodePool.pop();
    n.classList.remove("message-removing");
    return n;
  }

  const node = template.content.firstElementChild.cloneNode(true);
  node._refs = {
    username: node.querySelector(".username"),
    usernameText: node.querySelector(".username-text"),
    badges: node.querySelector(".badges"),
    text: node.querySelector(".text"),
    eventWrapper: node.querySelector(".event-wrapper"),
    eventText: node.querySelector(".event-text"),
  };

  return node;
}

function escapeHtml(str) {
  _escapeDiv.textContent = str;
  return _escapeDiv.innerHTML;
}

function recycleNode(node) {
  clearTimeout(node._timeoutId);
  node._timeoutId = null;
  clearTimeout(node._innerTimeoutId);
  node._innerTimeoutId = null;

  const refs = node._refs;
  refs.username.style.color = "";
  refs.username.style.removeProperty("--user-color");
  refs.usernameText.innerHTML = "";
  refs.badges.innerHTML = "";
  refs.text.innerHTML = "";
  refs.eventWrapper.hidden = true;
  refs.eventText.innerHTML = "";
  node.remove();

  if (nodePool.length < MAX_MESSAGES) nodePool.push(node);
}

function setupRemoval(message) {
  message._msgId = Date.now() + Math.random();

  const id = message._msgId;

  message._timeoutId = setTimeout(() => {
    if (message._msgId !== id) return;

    message.classList.add("message-removing");

    message._innerTimeoutId = setTimeout(() => {
      if (message.parentNode) recycleNode(message);
    }, 300);
  }, MESSAGE_LIFETIME);
}

function getBadges(badges) {
  if (!badges?.length) return "";
  if (badgeCache.size > 500) badgeCache.clear();

  let result = "";
  for (const badge of badges) {
    let cached = badgeCache.get(badge.url);

    if (!cached) {
      cached = `<img class="chat-badge" src="${escapeHtml(badge.url)}" alt="">`;
      badgeCache.set(badge.url, cached);
    }

    result += cached;
  }

  return result;
}

function renderMessageContent(text, emotes = []) {
  if (!emotes.length) return escapeHtml(text);

  let result = "";
  let lastIndex = 0;

  for (const emote of emotes) {
    result += escapeHtml(text.slice(lastIndex, emote.start));

    const src = emote.urls?.["1"] ?? emote.urls?.["2"] ?? emote.urls?.["4"] ?? "";
    result += `<img class="chat-emote" src="${escapeHtml(src)}" alt="${escapeHtml(emote.name)}">`;

    lastIndex = emote.end + 1;
  }

  result += escapeHtml(text.slice(lastIndex));
  return result;
}

function createMessage(data) {
  const color = data.displayColor || DEFAULT_COLOR;
  const message = getNode();

  const { username, usernameText, badges, text, eventWrapper, eventText } = message._refs;

  username.style.color = color;
  username.style.setProperty("--user-color", color);

  usernameText.textContent = data.displayName || "";

  badges.innerHTML = getBadges(data.badges);

  const isFirstMessage = data.tags?.["first-msg"] === "1";
  eventWrapper.hidden = !isFirstMessage;
  eventText.textContent = isFirstMessage ? "first message" : "";

  text.innerHTML = renderMessageContent(data.text, data.emotes);

  setupRemoval(message);

  return message;
}
