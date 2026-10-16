// reader_layout.js

const storyText = document.getElementById("story-text");
const artwork = document.getElementById("artwork");
const pageStatus = document.getElementById("page-status");
const selectedWordLabel = document.getElementById("selected-word");
const fontSizeIndicator = document.getElementById("font-size-indicator");

let readingScreens = [];
let screenIndex = 0;
const BASE_FONT_SIZE_REM = 2;
let fontSize = BASE_FONT_SIZE_REM;

let currentStoryTitle = "Story";
let pageIllustrations = [];

let selectedElement = null;
let selectedWord = null;

let pendingElement = null;
let pendingSince = 0;

let artworkRequestId = 0;

function animateContent(element) {
  if (!element) return;

  element.classList.remove("content-enter");

  void element.offsetWidth;

  element.classList.add("content-enter");
}

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
    animateContent(storyText);
    return;
  }

  const sentences = readingScreens[screenIndex];

  for (const sentence of sentences) {
    storyText.appendChild(renderSentence(sentence));
  }

  const illustrationPath = pageIllustrations[screenIndex];
  renderArtwork(illustrationPath, screenIndex + 1);

  pageStatus.textContent = `Page ${screenIndex + 1} of ${readingScreens.length}`;

  animateContent(storyText);
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
  updateFontSizeIndicator();
}

export function zoomOut() {
  fontSize = Math.max(fontSize - 0.2, 1.4);
  storyText.style.setProperty("--reader-font-size", `${fontSize}rem`);
  updateFontSizeIndicator();
}

function updateFontSizeIndicator() {
  if (!fontSizeIndicator) return;

  const percentage = Math.round((fontSize / BASE_FONT_SIZE_REM) * 100);

  fontSizeIndicator.textContent = `Text size: ${percentage}%`;
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

if (storyText) {
  storyText.style.setProperty("--reader-font-size", `${fontSize}rem`);
  updateFontSizeIndicator();
}

function renderArtwork(illustrationPath, segmentNumber) {
  const requestId = ++artworkRequestId;

  if (!illustrationPath) {
    artwork.replaceChildren();
    artwork.classList.remove("has-illustration");
    return;
  }

  const nextImage = new Image();

  nextImage.className = "page-illustration";
  nextImage.alt = `${currentStoryTitle}, illustration for segment ${segmentNumber}`;

  nextImage.decoding = "async";
  nextImage.src = illustrationPath;

  nextImage
    .decode()
    .then(() => {
      if (requestId !== artworkRequestId) return;

      artwork.classList.add("has-illustration");

      const previousImages = [
        ...artwork.querySelectorAll(".page-illustration"),
      ];

      artwork.appendChild(nextImage);

      void nextImage.offsetWidth;

      requestAnimationFrame(() => {
        if (requestId !== artworkRequestId) {
          nextImage.remove();
          return;
        }

        nextImage.classList.add("is-visible");
      });

      nextImage.addEventListener("transitionend", (event) => {
        if (event.propertyName !== "opacity") return;
        if (requestId !== artworkRequestId) return;

        previousImages.forEach((image) => image.remove());
      });
    })
    .catch(() => {
      if (requestId !== artworkRequestId) return;

      console.warn("Could not load illustration:", illustrationPath);

      artwork.replaceChildren();
      artwork.classList.remove("has-illustration");
    });
}
