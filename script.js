const MAX_MESSAGES = 10;
const MESSAGE_LIFETIME = 15000;
const DEFAULT_COLOR = "#fff";

const USER_BLACKLIST = new Set(["streamelements", "nightbot", "moobot", "wizebot", "streamlabs", "jeetbot", "vsestream"]);

const EVENT_COLORS = {
  follow: "#4cc9f0",
  subscriber: "#f7b801",
  raid: "#9b5de5",
};

const EVENT_TYPES = {
  firstMessage: "first message",
  follow: "new follow",
  subscriber: "new sub",
  raid: "raid",
};

const EVENT_TEXTS = {
  follow: [
    "дарова, аннигилятор",
    "добро пожаловать в убежище",
    "проходи, не стесняйся",
    "ещё один боец в строю",
    "располагайся поудобнее",
    "рады видеть на борту",
    "залетай в движ",
    "теперь ты один из нас",
  ],
  subscriber: [
    "добро пожаловать в элиту",
    "уважение за поддержку",
    "саб-комьюнити стало сильнее",
    "легендарное решение",
    "статус повышен",
    "теперь с VIP-пропуском",
    "официально в клубе",
    "респект за подписку",
  ],
  raid: [
    "дарова, аннигиляторы",
    "портал открыт",
    "подкрепление прибыло",
    "новый отряд на позиции",
    "рейдеры замечены",
    "десант успешно высадился",
    "боевой отряд прибыл",
  ],
};

const ALLOWED_EVENTS = new Set(Object.keys(EVENT_TYPES));

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

    messageQueue.push({ listener, data });
  } else if (listener === "event") {
    const { data, type } = detail.event;

    if (!ALLOWED_EVENTS.has(type)) return;

    messageQueue.push({ listener, data, type });
  } else {
    return;
  }

  if (!rafPending) {
    rafPending = true;
    requestAnimationFrame(flushQueue);
  }
});

function flushQueue() {
  rafPending = false;

  if (messageQueue.length > MAX_MESSAGES) messageQueue = messageQueue.slice(-MAX_MESSAGES);

  const fragment = document.createDocumentFragment();

  for (const item of messageQueue) fragment.appendChild(item.listener === "event" ? createEvent(item) : createMessage(item.data));

  messageQueue = [];

  chat.appendChild(fragment);

  while (chat.children.length > MAX_MESSAGES) {
    recycleNode(chat.firstElementChild);
  }
}

function getNode() {
  if (nodePool.length) return nodePool.pop();

  const node = template.content.firstElementChild.cloneNode(true);
  node._baseClassName = node.className;
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

  node.className = node._baseClassName;
  username.style.color = "";
  username.style.removeProperty("--user-color");
  usernameText.innerHTML = "";
  badges.innerHTML = "";
  text.innerHTML = "";
  eventText.innerHTML = "";

  node.remove();

  if (nodePool.length < MAX_MESSAGES) nodePool.push(node);
}

function setupRemoval(node) {
  const token = (setupRemoval._counter = (setupRemoval._counter ?? 0) + 1);
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

  if (badgeCache.size >= 200) badgeCache.delete(badgeCache.keys().next().value);

  let html = "";
  for (const badge of badges) {
    let img = badgeCache.get(badge.url);
    if (!img) {
      img = `<img class="chat-badge" src="${escapeHtml(badge.url)}" alt="">`;
      badgeCache.set(badge.url, img);
    }
    html += img;
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

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function applyUserStyle(node, data, colorOverride) {
  const color = colorOverride || data.displayColor || DEFAULT_COLOR;

  const { username, usernameText } = node._refs;
  username.style.color = color;
  username.style.setProperty("--user-color", color);
  usernameText.textContent = data.displayName || "";
}

function createMessage(data) {
  const node = getNode();
  const { badges, text, eventText } = node._refs;

  applyUserStyle(node, data);
  badges.innerHTML = getBadges(data.badges);
  text.innerHTML = renderMessageContent(data.text, data.emotes);

  if (data.tags?.["first-msg"] === "1") {
    node.classList.add("with-event");
    eventText.textContent = EVENT_TYPES.firstMessage;
  }

  setupRemoval(node);
  return node;
}

function createEvent({ data, type }) {
  const node = getNode();
  const { badges, text, eventText } = node._refs;

  applyUserStyle(node, data, EVENT_COLORS[type]);
  text.textContent = randomFrom(EVENT_TEXTS[type] ?? [""]);
  node.classList.add("with-event");

  eventText.textContent = type === "raid" ? `${EVENT_TYPES[type]} × ${data.amount}` : EVENT_TYPES[type];

  setupRemoval(node);
  return node;
}
