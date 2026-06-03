const MAX_MESSAGES = 10;
const MESSAGE_LIFETIME = 150000;
const DEFAULT_COLOR = "#00ff88";

const chat = document.getElementById("chat");
const template = document.getElementById("message-template");
const badgeCache = new Map();

window.addEventListener("onEventReceived", ({ detail }) => {
  if (detail.listener !== "message") return;

  renderMessage(detail.event.data);
});

function getBadgesHTML(badges) {
  if (!badges?.length) return "";

  const key = badges.map((b) => b.url).join("|");

  let html = badgeCache.get(key);

  if (html) return html;

  html = badges.map((b) => `<img src="${b.url}" alt="">`).join("");

  badgeCache.set(key, html);

  return html;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderMessageContent(text, emotes = []) {
  if (!emotes.length) {
    return escapeHtml(text);
  }

  let result = "";
  let lastIndex = 0;

  for (const emote of emotes) {
    result += escapeHtml(text.slice(lastIndex, emote.start));

    result += `
      <img
        class="chat-emote"
        src="${emote.urls["1"] || emote.urls["2"] || emote.urls["4"]}"
        alt="${emote.name}"
      >
    `;

    lastIndex = emote.end + 1;
  }

  result += escapeHtml(text.slice(lastIndex));

  return result;
}

function renderMessage(data) {
  const color = data.displayColor || DEFAULT_COLOR;

  const message = template.content.firstElementChild.cloneNode(true);

  // -------------------------
  // Cached nodes
  // -------------------------

  message.dataset.created = Date.now();

  const username = message.querySelector(".username");

  const usernameText = message.querySelector(".username-text");

  const badges = message.querySelector(".badges");

  const text = message.querySelector(".text");

  // -------------------------
  // Username
  // -------------------------

  username.style.color = color;

  username.style.backgroundColor = `color-mix(in srgb, #000000 100%, ${color} 30%)`;

  usernameText.textContent = data.displayName || "";

  // -------------------------
  // Badges
  // -------------------------

  badges.innerHTML = getBadgesHTML(data.badges);

  // -------------------------
  // Message text
  // -------------------------

  text.innerHTML = renderMessageContent(data.text, data.emotes);

  // -------------------------
  // Add to DOM
  // -------------------------

  chat.appendChild(message);

  // -------------------------
  // Remove old messages
  // -------------------------

  while (chat.children.length > MAX_MESSAGES) {
    chat.firstElementChild.remove();
  }
}

setInterval(() => {
  const now = Date.now();

  for (const message of chat.children) {
    if (now - Number(message.dataset.created) > MESSAGE_LIFETIME) {
      message.classList.add("message-removing");
    }
  }
}, 1000);
