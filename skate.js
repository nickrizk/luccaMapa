const mapUpload = document.querySelector("#mapUpload");
const tokenUpload = document.querySelector("#tokenUpload");
const clearTokens = document.querySelector("#clearTokens");
const mapStage = document.querySelector("#mapStage");
const emptyState = document.querySelector("#emptyState");
const tokenTray = document.querySelector("#tokenTray");
const tokenCount = document.querySelector("#tokenCount");

let activeToken = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

// FileReader transforma o arquivo local em uma URL temporaria base64.
// Isso funciona no GitHub Pages porque todo o processamento acontece no navegador.
mapUpload.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    mapStage.style.backgroundImage = `url("${reader.result}")`;
    mapStage.classList.add("has-map");
    emptyState.hidden = true;
  };
  reader.readAsDataURL(file);
});

tokenUpload.addEventListener("change", (event) => {
  const files = Array.from(event.target.files);

  files.forEach((file) => {
    const reader = new FileReader();

    reader.onload = () => {
      addTokenToTray(reader.result);
      addTokenToMap(reader.result);
      updateTokenCount();
    };

    reader.readAsDataURL(file);
  });

  tokenUpload.value = "";
});

clearTokens.addEventListener("click", () => {
  mapStage.querySelectorAll(".map-token").forEach((token) => token.remove());
});

function addTokenToTray(src) {
  const token = document.createElement("img");
  token.className = "token-palette-item";
  token.src = src;
  token.alt = "Token de RPG";
  token.title = "Clique para adicionar ao mapa";

  token.addEventListener("click", () => {
    addTokenToMap(src);
  });

  tokenTray.appendChild(token);
}

function addTokenToMap(src) {
  const token = document.createElement("img");
  const stageRect = mapStage.getBoundingClientRect();

  token.className = "map-token";
  token.src = src;
  token.alt = "Token arrastavel no mapa";
  token.style.left = `${Math.max(25, stageRect.width / 2)}px`;
  token.style.top = `${Math.max(25, stageRect.height / 2)}px`;

  // Eventos de mouse para desktop.
  token.addEventListener("mousedown", startMouseDrag);

  // Eventos de toque para celular e tablet.
  token.addEventListener("touchstart", startTouchDrag, { passive: false });

  mapStage.appendChild(token);
}

function startMouseDrag(event) {
  event.preventDefault();
  beginDrag(event.currentTarget, event.clientX, event.clientY);

  document.addEventListener("mousemove", moveMouseToken);
  document.addEventListener("mouseup", stopMouseDrag);
}

function moveMouseToken(event) {
  moveToken(event.clientX, event.clientY);
}

function stopMouseDrag() {
  endDrag();
  document.removeEventListener("mousemove", moveMouseToken);
  document.removeEventListener("mouseup", stopMouseDrag);
}

function startTouchDrag(event) {
  event.preventDefault();
  const touch = event.touches[0];
  beginDrag(event.currentTarget, touch.clientX, touch.clientY);

  document.addEventListener("touchmove", moveTouchToken, { passive: false });
  document.addEventListener("touchend", stopTouchDrag);
  document.addEventListener("touchcancel", stopTouchDrag);
}

function moveTouchToken(event) {
  event.preventDefault();
  const touch = event.touches[0];
  if (!touch) return;

  moveToken(touch.clientX, touch.clientY);
}

function stopTouchDrag() {
  endDrag();
  document.removeEventListener("touchmove", moveTouchToken);
  document.removeEventListener("touchend", stopTouchDrag);
  document.removeEventListener("touchcancel", stopTouchDrag);
}

function beginDrag(token, clientX, clientY) {
  const tokenRect = token.getBoundingClientRect();

  activeToken = token;
  dragOffsetX = clientX - tokenRect.left;
  dragOffsetY = clientY - tokenRect.top;
  activeToken.classList.add("dragging");
}

function moveToken(clientX, clientY) {
  if (!activeToken) return;

  const stageRect = mapStage.getBoundingClientRect();
  const tokenSize = activeToken.offsetWidth;
  const rawX = clientX - stageRect.left - dragOffsetX + tokenSize / 2;
  const rawY = clientY - stageRect.top - dragOffsetY + tokenSize / 2;

  const x = clamp(rawX, tokenSize / 2, stageRect.width - tokenSize / 2);
  const y = clamp(rawY, tokenSize / 2, stageRect.height - tokenSize / 2);

  activeToken.style.left = `${x}px`;
  activeToken.style.top = `${y}px`;
}

function endDrag() {
  if (!activeToken) return;
  activeToken.classList.remove("dragging");
  activeToken = null;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function updateTokenCount() {
  tokenCount.textContent = tokenTray.children.length;
}
