// reader_layout.js

const storyText = document.getElementById("story-text");
const artwork = document.getElementById("artwork");
const pageStatus = document.getElementById("page-status");
const selectedWordLabel = document.getElementById("selected-word");

let readingScreens = [];
let screenIndex = 0;
let fontSize = 2;

let currentStoryTitle = "Story";
let pageIllustrations = [];

let selectedElement = null;
let selectedWord = null;

let pendingElement = null;
let pendingSince = 0;

function splitIntoScreens(text, sentencesPerScreen = 2) {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (!normalized) return [];

  let cleaned;

  if (typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter("en", {
      granularity: "sentence",
    });

    cleaned = Array.from(segmenter.segment(normalized), (item) =>
      item.segment.trim(),
    ).filter(Boolean);
  } else {
    const sentences = normalized.match(/[^.!?]+(?:[.!?]+|$)/g) ?? [normalized];

    cleaned = sentences.map((sentence) => sentence.trim()).filter(Boolean);
  }

  const chunkSize = Number(sentencesPerScreen) === 3 ? 3 : 2;
  const screens = [];

  for (let i = 0; i < cleaned.length; i += chunkSize) {
    screens.push(cleaned.slice(i, i + chunkSize));
  }

  return screens;
}

function clearSelection() {
  selectedElement?.classList.remove("gaze-selected");

  selectedElement = null;
  selectedWord = null;
  pendingElement = null;
  pendingSince = 0;

  if (selectedWordLabel) {
    selectedWordLabel.textContent = "—";
  }
}

function renderSentence(sentence) {
  const paragraph = document.createElement("p");
  const tokens = sentence.match(/\S+/g) ?? [];

  tokens.forEach((token, index) => {
    if (index > 0) {
      paragraph.appendChild(document.createTextNode(" "));
    }

    const normalized = token
      .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}'’-]+$/gu, "")
      .toLocaleLowerCase("en");

    const span = document.createElement("span");

    span.className = "gaze-word";
    span.textContent = token;
    span.dataset.word = normalized;

    paragraph.appendChild(span);
  });

  return paragraph;
}

function renderScreen() {
  storyText.replaceChildren();
  clearSelection();

  if (readingScreens.length === 0) {
    storyText.textContent = "Choose a story to begin reading.";
    pageStatus.textContent = "No story loaded";
    artwork.replaceChildren();
    return;
  }

  const sentences = readingScreens[screenIndex];

  for (const sentence of sentences) {
    storyText.appendChild(renderSentence(sentence));
  }

  const illustrationPath = pageIllustrations[screenIndex];

  if (illustrationPath) {
    const img = document.createElement("img");

    img.className = "page-illustration";
    img.src = illustrationPath;
    img.alt = `${currentStoryTitle}, illustration for segment ${screenIndex + 1}`;

    img.loading = "eager";
    img.decoding = "async";

    img.onerror = () => {
      const message = document.createElement("p");

      message.textContent = `Could not load illustration for segment ${screenIndex + 1}.`;

      artwork.replaceChildren(message);
    };

    artwork.replaceChildren(img);
  } else {
    const caption = document.createElement("p");

    caption.textContent =
      `No illustration assigned for ${currentStoryTitle}, ` +
      `segment ${screenIndex + 1}.`;

    artwork.replaceChildren(caption);
  }

  pageStatus.textContent = `Page ${screenIndex + 1} of ${readingScreens.length}`;
}

export function loadText(text, sentencesPerScreen = 2, options = {}) {
  readingScreens = splitIntoScreens(text, sentencesPerScreen);
  screenIndex = 0;
  currentStoryTitle = options.title ?? "Story";
  pageIllustrations = options.illustrations ?? [];
  renderScreen();
}

export function nextPage() {
  if (readingScreens.length === 0) return;

  screenIndex = (screenIndex + 1) % readingScreens.length;
  renderScreen();
}

export function previousPage() {
  if (readingScreens.length === 0) return;

  screenIndex =
    (screenIndex - 1 + readingScreens.length) % readingScreens.length;

  renderScreen();
}

export function zoomIn() {
  fontSize = Math.min(fontSize + 0.2, 3.4);
  storyText.style.setProperty("--reader-font-size", `${fontSize}rem`);
}

export function zoomOut() {
  fontSize = Math.max(fontSize - 0.2, 1.4);
  storyText.style.setProperty("--reader-font-size", `${fontSize}rem`);
}

export function getSelectedWord() {
  return selectedWord;
}

export function selectWordAt(x, y) {
  const stage = document.getElementById("reading-stage");
  const stageRect = stage.getBoundingClientRect();
  const textRect = storyText.getBoundingClientRect();

  const insideStage =
    x >= stageRect.left &&
    x <= stageRect.right &&
    y >= stageRect.top &&
    y <= stageRect.bottom;

  const insideText =
    x >= textRect.left - 20 &&
    x <= textRect.right + 20 &&
    y >= textRect.top - 20 &&
    y <= textRect.bottom + 20;

  if (!insideStage || !insideText) {
    pendingElement = null;
    pendingSince = 0;
    return;
  }

  let candidate = document.elementFromPoint(x, y)?.closest(".gaze-word");

  if (!candidate || !storyText.contains(candidate) || !candidate.dataset.word) {
    let nearestDistance = Infinity;
    let nearestElement = null;

    for (const word of storyText.querySelectorAll(".gaze-word")) {
      if (!word.dataset.word) continue;

      const rect = word.getBoundingClientRect();

      const nearestX = Math.max(rect.left, Math.min(x, rect.right));
      const nearestY = Math.max(rect.top, Math.min(y, rect.bottom));

      const distance = Math.hypot(x - nearestX, y - nearestY);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestElement = word;
      }
    }

    candidate = nearestDistance <= 30 ? nearestElement : null;
  }

  if (!candidate) {
    pendingElement = null;
    pendingSince = 0;
    return;
  }

  // dwell before changing the selected word
  if (candidate !== pendingElement) {
    pendingElement = candidate;
    pendingSince = performance.now();
    return;
  }

  if (performance.now() - pendingSince < 200) {
    return;
  }

  if (candidate === selectedElement) {
    return;
  }

  selectedElement?.classList.remove("gaze-selected");

  selectedElement = candidate;
  selectedElement.classList.add("gaze-selected");

  selectedWord = candidate.dataset.word;

  if (selectedWordLabel) {
    selectedWordLabel.textContent = selectedWord;
  }
}
