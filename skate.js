const mapUpload = document.querySelector("#mapUpload");
const tokenUpload = document.querySelector("#tokenUpload");
const clearTokens = document.querySelector("#clearTokens");
const mapStage = document.querySelector("#mapStage");
const emptyState = document.querySelector("#emptyState");
const tokenTray = document.querySelector("#tokenTray");
const tokenCount = document.querySelector("#tokenCount");
const analysisFileUpload = document.querySelector("#analysisFileUpload");
const analysisFileCount = document.querySelector("#analysisFileCount");
const excludeTokens = document.querySelector("#excludeTokens");
const clearExclusions = document.querySelector("#clearExclusions");
const exclusionChips = document.querySelector("#exclusionChips");
const caseInsensitive = document.querySelector("#caseInsensitive");
const originalTokenTotal = document.querySelector("#originalTokenTotal");
const filteredTokenTotal = document.querySelector("#filteredTokenTotal");
const savedTokenTotal = document.querySelector("#savedTokenTotal");
const analysisEmpty = document.querySelector("#analysisEmpty");
const analysisResults = document.querySelector("#analysisResults");
const activeAnalysisFile = document.querySelector("#activeAnalysisFile");
const activeFileStats = document.querySelector("#activeFileStats");
const activeFileSavings = document.querySelector("#activeFileSavings");
const filteredPreview = document.querySelector("#filteredPreview");
const copyFiltered = document.querySelector("#copyFiltered");
const downloadFiltered = document.querySelector("#downloadFiltered");
const analysisStatus = document.querySelector("#analysisStatus");

let activeToken = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let analysisFiles = [];
let filterTimer = null;

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

analysisFileUpload.addEventListener("change", async (event) => {
  const files = Array.from(event.target.files);
  if (!files.length) return;

  analysisStatus.textContent = "Lendo arquivos…";

  const loadedFiles = await Promise.all(
    files.map(async (file, index) => ({
      id: `${Date.now()}-${index}-${file.name}`,
      name: file.name,
      type: file.type || "text/plain",
      content: await file.text(),
    })),
  );

  analysisFiles = loadedFiles;
  activeAnalysisFile.innerHTML = "";

  loadedFiles.forEach((file) => {
    const option = document.createElement("option");
    option.value = file.id;
    option.textContent = file.name;
    activeAnalysisFile.appendChild(option);
  });

  analysisFileUpload.value = "";
  analysisStatus.textContent = "";
  refreshAnalysis();
});

excludeTokens.addEventListener("input", () => {
  window.clearTimeout(filterTimer);
  filterTimer = window.setTimeout(refreshAnalysis, 160);
});

caseInsensitive.addEventListener("change", refreshAnalysis);
activeAnalysisFile.addEventListener("change", renderActiveAnalysis);

clearExclusions.addEventListener("click", () => {
  excludeTokens.value = "";
  refreshAnalysis();
  excludeTokens.focus();
});

copyFiltered.addEventListener("click", async () => {
  const file = getActiveAnalysisFile();
  if (!file) return;

  try {
    await navigator.clipboard.writeText(file.filteredContent);
    setAnalysisStatus("Contexto filtrado copiado.");
  } catch {
    filteredPreview.select();
    document.execCommand("copy");
    setAnalysisStatus("Contexto filtrado copiado.");
  }
});

downloadFiltered.addEventListener("click", () => {
  const file = getActiveAnalysisFile();
  if (!file) return;

  const blob = new Blob([file.filteredContent], { type: `${file.type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = createFilteredFilename(file.name);
  link.click();
  URL.revokeObjectURL(url);
  setAnalysisStatus("Arquivo filtrado baixado.");
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

/**
 * Remove itens literais ou padrões de um conteúdo antes de montar o contexto.
 * Padrões usam o formato /expressão/flags; os demais itens são tratados
 * literalmente. Quebras de linha são preservadas para manter a estrutura.
 */
function preprocessContent(content, exclude_tokens = [], options = {}) {
  const ignoreCase = options.caseInsensitive !== false;
  const invalidPatterns = [];
  let filteredContent = content;

  exclude_tokens.forEach((token) => {
    const rule = compileExclusionRule(token, ignoreCase);

    if (!rule) {
      invalidPatterns.push(token);
      return;
    }

    filteredContent = filteredContent.replace(rule, preserveLineStructure);
  });

  return { content: filteredContent, invalidPatterns };
}

function parseExclusions(value) {
  const entries = value
    .split(/\r?\n/)
    .flatMap((line) => {
      const trimmed = line.trim();
      return isRegexLiteral(trimmed) ? [trimmed] : line.split(",");
    })
    .map((entry) => entry.trim())
    .filter(Boolean);

  return Array.from(new Set(entries));
}

function isRegexLiteral(value) {
  if (!value.startsWith("/")) return false;
  const lastSlash = value.lastIndexOf("/");
  return lastSlash > 0 && /^[dgimsuvy]*$/.test(value.slice(lastSlash + 1));
}

function compileExclusionRule(token, ignoreCase) {
  try {
    if (isRegexLiteral(token)) {
      const lastSlash = token.lastIndexOf("/");
      const source = token.slice(1, lastSlash);
      const requestedFlags = token.slice(lastSlash + 1);
      const safeFlags = requestedFlags.replace(/[gdy]/g, "");
      const flags = Array.from(new Set(`${safeFlags}${ignoreCase ? "i" : ""}g`)).join("");
      return new RegExp(source, flags);
    }

    const flags = ignoreCase ? "giu" : "gu";
    return new RegExp(escapeRegExp(token), flags);
  } catch {
    return null;
  }
}

function preserveLineStructure(match) {
  const lines = match.split(/(\r?\n)/);
  return lines
    .map((part) => (/^\r?\n$/.test(part) ? part : part.length ? " " : ""))
    .join("");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countTokens(content) {
  const tokens = content.match(
    /[\p{L}\p{M}]+(?:['’_-][\p{L}\p{M}\p{N}]+)*|\p{N}+(?:[.,]\p{N}+)*|[^\s]/gu,
  );
  return tokens ? tokens.length : 0;
}

function refreshAnalysis() {
  const exclusions = parseExclusions(excludeTokens.value);
  const invalidPatterns = new Set();

  renderExclusionChips(exclusions);

  analysisFiles = analysisFiles.map((file) => {
    const result = preprocessContent(file.content, exclusions, {
      caseInsensitive: caseInsensitive.checked,
    });
    result.invalidPatterns.forEach((pattern) => invalidPatterns.add(pattern));

    const originalTokens = countTokens(file.content);
    const filteredTokens = countTokens(result.content);

    return {
      ...file,
      filteredContent: result.content,
      originalTokens,
      filteredTokens,
      savedTokens: Math.max(0, originalTokens - filteredTokens),
    };
  });

  updateAnalysisTotals();
  renderActiveAnalysis();

  if (invalidPatterns.size) {
    setAnalysisStatus(`${invalidPatterns.size} padrão(ões) inválido(s) ignorado(s).`, false);
  } else if (analysisFiles.length && exclusions.length) {
    setAnalysisStatus("Filtro aplicado automaticamente.");
  } else {
    analysisStatus.textContent = "";
  }
}

function renderExclusionChips(exclusions) {
  exclusionChips.innerHTML = "";

  exclusions.forEach((exclusion) => {
    const chip = document.createElement("span");
    chip.className = "exclusion-chip";

    const label = document.createElement("span");
    label.textContent = exclusion;
    label.title = exclusion;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = "×";
    removeButton.setAttribute("aria-label", `Remover exclusão ${exclusion}`);
    removeButton.addEventListener("click", () => removeExclusion(exclusion));

    chip.append(label, removeButton);
    exclusionChips.appendChild(chip);
  });
}

function removeExclusion(exclusionToRemove) {
  const exclusions = parseExclusions(excludeTokens.value).filter(
    (exclusion) => exclusion !== exclusionToRemove,
  );
  excludeTokens.value = exclusions.join("\n");
  refreshAnalysis();
}

function updateAnalysisTotals() {
  const totals = analysisFiles.reduce(
    (sum, file) => ({
      original: sum.original + (file.originalTokens || 0),
      filtered: sum.filtered + (file.filteredTokens || 0),
      saved: sum.saved + (file.savedTokens || 0),
    }),
    { original: 0, filtered: 0, saved: 0 },
  );

  analysisFileCount.textContent = analysisFiles.length;
  originalTokenTotal.textContent = formatNumber(totals.original);
  filteredTokenTotal.textContent = formatNumber(totals.filtered);
  savedTokenTotal.textContent = formatNumber(totals.saved);
  analysisEmpty.hidden = analysisFiles.length > 0;
  analysisResults.hidden = analysisFiles.length === 0;
}

function renderActiveAnalysis() {
  const file = getActiveAnalysisFile();
  if (!file) {
    filteredPreview.value = "";
    return;
  }

  filteredPreview.value = file.filteredContent;
  activeFileStats.textContent = `${formatNumber(file.originalTokens)} → ${formatNumber(file.filteredTokens)} tokens`;
  activeFileSavings.textContent = `${formatNumber(file.savedTokens)} economizados`;
}

function getActiveAnalysisFile() {
  return analysisFiles.find((file) => file.id === activeAnalysisFile.value) || analysisFiles[0];
}

function createFilteredFilename(filename) {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex <= 0) return `${filename}.filtrado`;
  return `${filename.slice(0, dotIndex)}.filtrado${filename.slice(dotIndex)}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function setAnalysisStatus(message, clearAutomatically = true) {
  analysisStatus.textContent = message;

  if (clearAutomatically) {
    window.setTimeout(() => {
      if (analysisStatus.textContent === message) analysisStatus.textContent = "";
    }, 2400);
  }
}

// API reutilizável para integrações que preferem exclude_tokens: list[str].
window.preprocessContent = preprocessContent;

refreshAnalysis();
