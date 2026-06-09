const MAX_MESSAGES = 10;
const MESSAGE_LIFETIME = 15000;
const DEFAULT_COLOR = "#00ff88";
const BADGE_CACHE_LIMIT = 200;

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
    const { data } = detail.event;
    const username = (data.nick || data.displayName || "").toLowerCase();

    if (USER_BLACKLIST.has(username)) return;

    messageQueue.push(data);
  }

  if (!rafPending) {
    rafPending = true;
    requestAnimationFrame(flushQueue);
  }
});

function flushQueue() {
  rafPending = false;

  const batch = messageQueue.splice(Math.max(0, messageQueue.length - MAX_MESSAGES));

  const fragment = document.createDocumentFragment();
  for (const data of batch) fragment.appendChild(createMessage(data));

  chat.appendChild(fragment);

  while (chat.children.length > MAX_MESSAGES) {
    recycleNode(chat.firstElementChild);
  }
}

function getNode() {
  if (nodePool.length) {
    const node = nodePool.pop();
    node.classList.remove("message-removing");
    return node;
  }

  const node = template.content.firstElementChild.cloneNode(true);

  node._refs = {
    username: node.querySelector(".username"),
    usernameText: node.querySelector(".username-text"),
    badges: node.querySelector(".badges"),
    text: node.querySelector(".text"),
    eventText: node.querySelector(".event-text"),
  };

  return node;
}

function recycleNode(node) {
  clearTimeout(node._timeoutId);
  clearTimeout(node._exitTimeoutId);

  const { username, usernameText, badges, text, eventText } = node._refs;

  node.classList.remove("with-event");
  username.style.cssText = "";
  usernameText.textContent = "";
  badges.innerHTML = "";
  text.innerHTML = "";
  eventText.textContent = "";

  node.remove();

  if (nodePool.length < MAX_MESSAGES) nodePool.push(node);
}

function setupRemoval(node) {
  const token = Symbol();
  node._removalToken = token;

  node._timeoutId = setTimeout(() => {
    if (node._removalToken !== token) return;

    node.classList.add("message-removing");

    node._exitTimeoutId = setTimeout(() => {
      if (node.parentNode) recycleNode(node);
    }, 300);
  }, MESSAGE_LIFETIME);
}

function escapeHtml(str) {
  _escapeDiv.textContent = str;
  return _escapeDiv.innerHTML;
}

function getBadges(badges) {
  if (!badges?.length) return "";

  if (badgeCache.size >= BADGE_CACHE_LIMIT) badgeCache.clear();

  let html = "";

  for (const badge of badges) {
    let cached = badgeCache.get(badge.url);

    if (!cached) {
      cached = `<img class="chat-badge" src="${escapeHtml(badge.url)}" alt="">`;
      badgeCache.set(badge.url, cached);
    }

    html += cached;
  }

  return html;
}

function renderMessageContent(text, emotes = []) {
  if (!emotes.length) return escapeHtml(text);

  let html = "";
  let cursor = 0;

  for (const emote of emotes) {
    html += escapeHtml(text.slice(cursor, emote.start));

    const src = emote.urls?.["1"] ?? emote.urls?.["2"] ?? emote.urls?.["4"] ?? "";
    html += `<img class="chat-emote" src="${escapeHtml(src)}" alt="${escapeHtml(emote.name)}">`;

    cursor = emote.end + 1;
  }

  html += escapeHtml(text.slice(cursor));
  return html;
}

function createMessage(data) {
  const color = data.displayColor || DEFAULT_COLOR;
  const node = getNode();
  const { username, usernameText, badges, text, eventText } = node._refs;

  username.style.color = color;
  username.style.setProperty("--user-color", color);
  usernameText.textContent = data.displayName || "";
  badges.innerHTML = getBadges(data.badges);
  text.innerHTML = renderMessageContent(data.text, data.emotes);

  if (data.tags?.["first-msg"] === "1") {
    node.classList.add("with-event");
    eventText.textContent = "first message";
  }

  setupRemoval(node);

  return node;
}
