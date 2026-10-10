// app.js

import {
  FilesetResolver,
  FaceLandmarker,
  DrawingUtils,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs";

import {
  extractGazeFeature,
  fitCalibration,
  projectGaze,
  updateGazeDebugDot,
} from "./gaze_tracking.js";

import {
  loadText,
  nextPage,
  previousPage,
  zoomIn,
  zoomOut,
  selectWordAt,
  getSelectedWord,
} from "./reader_layout.js";

import { lookupDefinition } from "./definitions.js";

import { createHandTracker, processHands } from "./hand_tracking.js";

const video = document.getElementById("video");
const status = document.getElementById("status");

let faceLandmarker = null;
let handTracker = null;

const featureHistory = [];
const predictionHistory = [];

let latestFeature = null;
let calibration = null;
let lastVideoTime = -1;

// placeholder story
loadText(
  "The weary traveler entered a quiet village at sunset. " +
    "A lantern flickered beside the door of an enormous house. " +
    "Inside, a bewildered child waited beside the fireplace. " +
    "Outside, the evening wind whispered through the trees.",
);

const readerStage = document.getElementById("reading-stage");
const themeSelect = document.getElementById("theme-select");
const applyThemeButton = document.getElementById("apply-theme-button");
const themeStatus = document.getElementById("theme-status");

const pageThemes = {
  classic: {
    name: "Classic",
    image: "",
  },

  fantasy: {
    name: "Fantasy",
    image:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1800&q=80",
  },

  horror: {
    name: "Horror",
    image: "",
  },

  scifi: {
    name: "Sci-Fi",
    image: "",
  },

  mystery: {
    name: "Mystery",
    image: "",
  },

  sports: {
    name: "Sports",
    image: "",
  },
};

function applySelectedTheme() {
  if (!readerStage || !themeSelect) {
    console.error("Theme controls or reading stage not found.");
    return;
  }

  const theme = pageThemes[themeSelect.value];

  if (!theme) {
    if (themeStatus) {
      themeStatus.textContent = "Please choose a valid theme.";
    }
    return;
  }

  const backgroundImage = `linear-gradient(
      rgba(255, 255, 255, 0.58),
      rgba(255, 255, 255, 0.72)
    ), url("${theme.image}")`;

  readerStage.style.backgroundImage = backgroundImage;
  readerStage.style.backgroundPosition = "center";
  readerStage.style.backgroundRepeat = "no-repeat";
  readerStage.style.backgroundSize = "cover";

  if (themeStatus) {
    themeStatus.textContent = `Theme applied: ${theme.name}`;
  }
}

applyThemeButton?.addEventListener("click", applySelectedTheme);

// -----------------------------
// shared interface
// -----------------------------

async function showDefinition() {
  const word = getSelectedWord();

  const wordElement = document.getElementById("definition-word");
  const bodyElement = document.getElementById("definition-body");
  const sourceElement = document.getElementById("definition-source");

  if (!word) {
    wordElement.textContent = "No word selected";
    bodyElement.textContent = "Look at a word in the reading area first.";
    sourceElement.textContent = "";
    return;
  }

  wordElement.textContent = word;
  bodyElement.textContent = "Looking up definition...";
  sourceElement.textContent = "";

  const result = await lookupDefinition(word);

  if (!result) return;

  bodyElement.textContent = result.definition;

  sourceElement.textContent = [
    result.partOfSpeech,
    result.example ? `Example: ${result.example}` : "",
    result.source,
  ]
    .filter(Boolean)
    .join(" · ");
}

function handleGesture(gesture) {
  // hand_tracking.js must emit one of these string names.
  switch (gesture) {
    case "next-page":
      nextPage();
      break;

    case "previous-page":
      previousPage();
      break;

    case "zoom-in":
      zoomIn();
      break;

    case "zoom-out":
      zoomOut();
      break;

    case "define-word":
      showDefinition();
      break;

    default:
      console.warn("Unknown gesture:", gesture);
  }
}

// PDF importer integration:
window.readerAPI = {
  loadText(text) {
    loadText(text);
  },
  nextPage,
  previousPage,
  zoomIn,
  zoomOut,
  defineSelectedWord: showDefinition,
};

// manual controls for testing without hand gestures.
document
  .getElementById("previous-button")
  .addEventListener("click", previousPage);

document.getElementById("next-button").addEventListener("click", nextPage);

document.getElementById("zoom-in-button").addEventListener("click", zoomIn);

document.getElementById("zoom-out-button").addEventListener("click", zoomOut);

document
  .getElementById("test-define-button")
  ?.addEventListener("click", showDefinition);

// -----------------------------
// shared vision pipeline
// -----------------------------

function renderLoop() {
  if (
    faceLandmarker &&
    video.readyState >= 2 &&
    video.currentTime !== lastVideoTime
  ) {
    const timestamp = performance.now();

    try {
      const faceResults = faceLandmarker.detectForVideo(video, timestamp);

      drawFaceMesh(faceResults);

      latestFeature = extractGazeFeature(faceResults);

      const sampleTime = performance.now();

      if (latestFeature) {
        featureHistory.push({
          time: sampleTime,
          feature: { ...latestFeature },
        });
      }

      while (
        featureHistory.length &&
        sampleTime - featureHistory[0].time > 2500
      ) {
        featureHistory.shift();
      }

      if (latestFeature && calibration) {
        const point = projectGaze(latestFeature, calibration);

        updateGazeDebugDot(point);

        const screenX = point.x * window.innerWidth;
        const screenY = point.y * window.innerHeight;

        predictionHistory.push({
          time: performance.now(),
          x: screenX,
          y: screenY,
        });

        while (
          predictionHistory.length &&
          performance.now() - predictionHistory[0].time > 8000
        ) {
          predictionHistory.shift();
        }

        selectWordAt(screenX, screenY);
      } else {
        updateGazeDebugDot(null);
      }

      if (handTracker) {
        const handResults = handTracker.detectForVideo(video, timestamp);

        processHands(handResults, handleGesture);
      }
    } catch (error) {
      console.error("Vision processing error:", error);
    }

    lastVideoTime = video.currentTime;
  }

  requestAnimationFrame(renderLoop);
}

async function initialize() {
  try {
    status.textContent = "Loading tracking models...";

    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
    );

    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "./models/face_landmarker.task",
      },
      runningMode: "VIDEO",
      numFaces: 1,
    });

    // null is ok while hand tracking is unfinished
    handTracker = await createHandTracker(vision);

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: "user",
      },
      audio: false,
    });

    video.srcObject = stream;
    await video.play();

    status.textContent = "Camera ready. Complete gaze calibration to begin.";

    requestAnimationFrame(renderLoop);
  } catch (error) {
    console.error(error);

    status.textContent =
      "Could not initialize camera or vision models. Check permissions, model files, and console errors.";
  }
}

const meshCanvas = document.getElementById("facemesh-canvas");
const meshContext = meshCanvas?.getContext("2d");

const drawingUtils = meshContext ? new DrawingUtils(meshContext) : null;

function drawFaceMesh(results) {
  if (!meshCanvas || !meshContext || !drawingUtils) {
    return;
  }

  if (video.videoWidth && video.videoHeight) {
    if (
      meshCanvas.width !== video.videoWidth ||
      meshCanvas.height !== video.videoHeight
    ) {
      meshCanvas.width = video.videoWidth;
      meshCanvas.height = video.videoHeight;
    }
  }

  meshContext.clearRect(0, 0, meshCanvas.width, meshCanvas.height);

  const landmarks = results.faceLandmarks?.[0];

  if (!landmarks) {
    return;
  }

  drawingUtils.drawConnectors(
    landmarks,
    FaceLandmarker.FACE_LANDMARKS_TESSELATION,
    {
      color: "#85F5B4A0",
      lineWidth: 1,
    },
  );

  drawingUtils.drawConnectors(
    landmarks,
    FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
    {
      color: "#FFFFFF",
      lineWidth: 1.5,
    },
  );

  drawingUtils.drawConnectors(
    landmarks,
    FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
    { color: "#40E0D0", lineWidth: 1.5 },
  );

  drawingUtils.drawConnectors(
    landmarks,
    FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
    { color: "#FFCF55", lineWidth: 1.5 },
  );

  drawingUtils.drawConnectors(
    landmarks,
    FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS,
    { color: "#40E0D0", lineWidth: 2 },
  );

  drawingUtils.drawConnectors(
    landmarks,
    FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS,
    { color: "#FFCF55", lineWidth: 2 },
  );
}

initialize();

// -----------------------------
// Eye-Tracking Calibration
// -----------------------------

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);

  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

function medianFeature(features) {
  return {
    x: median(features.map((f) => f.x)),
    y: median(features.map((f) => f.y)),
  };
}

function shuffle(items) {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

function waitForTargetClick(target) {
  return new Promise((resolve) => {
    target.addEventListener("click", resolve, { once: true });
  });
}

function collectRecentFeatures(windowMs = 850) {
  const now = performance.now();

  return featureHistory
    .filter((sample) => now - sample.time <= windowMs)
    .map((sample) => ({ ...sample.feature }));
}

function collectFiveClicksForTarget(
  targetDot,
  targetViewport,
  pointIndex,
  totalPoints,
  samples,
) {
  return new Promise((resolve) => {
    let clickCount = 0;
    let lastAcceptedClick = -Infinity;

    targetDot.textContent = "0/5";
    targetDot.classList.remove("is-complete");

    const handleClick = () => {
      const now = performance.now();

      if (now - lastAcceptedClick < 250) {
        status.textContent =
          `Point ${pointIndex}/${totalPoints}: ` +
          "keep looking at the dot and pause briefly between clicks.";
        return;
      }

      const observations = collectRecentFeatures(650);

      if (observations.length < 5) {
        status.textContent =
          "Not enough eye-tracking samples yet. Keep your face visible " +
          "and try clicking again.";
        return;
      }

      lastAcceptedClick = now;

      samples.push({
        feature: medianFeature(observations),
        target: { ...targetViewport },
      });

      clickCount += 1;
      targetDot.textContent = clickCount < 5 ? `${clickCount}/5` : "✓";

      if (clickCount < 5) {
        status.textContent =
          `Point ${pointIndex}/${totalPoints}: ` +
          `${clickCount}/5 clicks recorded. Keep looking at the dot.`;
        return;
      }

      targetDot.classList.add("is-complete");
      status.textContent = `Point ${pointIndex}/${totalPoints} complete.`;

      targetDot.removeEventListener("click", handleClick);

      window.setTimeout(resolve, 350);
    };

    targetDot.addEventListener("click", handleClick);
  });
}

function collectRecentPredictions(startTime) {
  return predictionHistory.filter(
    (sample) =>
      sample.time >= startTime &&
      Number.isFinite(sample.x) &&
      Number.isFinite(sample.y),
  );
}
function placeTargetWithinStage(targetDot, stage, point) {
  const rect = stage.getBoundingClientRect();

  const px = rect.left + rect.width * point.x;
  const py = rect.top + rect.height * point.y;

  targetDot.style.left = `${px}px`;
  targetDot.style.top = `${py}px`;

  return {
    x: px / window.innerWidth,
    y: py / window.innerHeight,
  };
}

async function runCalibrationValidation() {
  const stage = document.getElementById("reading-stage");
  const targetDot = document.getElementById("calibration-target");

  if (!stage || !targetDot || !calibration) {
    status.textContent = "Unable to start gaze validation.";
    return;
  }

  const targetViewport = placeTargetWithinStage(targetDot, stage, {
    x: 0.5,
    y: 0.5,
  });

  predictionHistory.length = 0;

  targetDot.textContent = "";
  targetDot.classList.remove("is-complete");
  targetDot.classList.add("is-validation");
  targetDot.style.display = "flex";
  targetDot.style.pointerEvents = "none";

  let predictions = [];

  try {
    status.textContent = "Center validation: look at the dot without clicking.";

    await delay(800);

    const captureStart = performance.now();

    await delay(2500);

    predictions = collectRecentPredictions(captureStart);
  } finally {
    targetDot.style.display = "none";
    targetDot.style.pointerEvents = "auto";
    targetDot.classList.remove("is-validation");
  }

  if (predictions.length < 10) {
    status.textContent =
      "Calibration fitted, but too few gaze samples were collected " +
      "for validation. Check the camera view and try again.";
    return;
  }

  const targetX = targetViewport.x * window.innerWidth;
  const targetY = targetViewport.y * window.innerHeight;

  const radiusPixels = 150;

  const distances = predictions.map((sample) =>
    Math.hypot(sample.x - targetX, sample.y - targetY),
  );

  const withinRadius = distances.filter(
    (distance) => distance <= radiusPixels,
  ).length;

  const accuracyPercent = Math.round((withinRadius / distances.length) * 100);

  const sortedDistances = [...distances].sort((a, b) => a - b);
  const medianError = sortedDistances[Math.floor(sortedDistances.length / 2)];

  status.textContent =
    `Center validation: ${accuracyPercent}% of samples ` +
    `within ${radiusPixels}px. Median error: ` +
    `${Math.round(medianError)}px.`;

  window.alert(
    "Gaze calibration validation\n\n" +
      `${accuracyPercent}% of gaze samples landed within ` +
      `${radiusPixels} pixels of the center target.\n\n` +
      `Median distance from target: ${Math.round(medianError)} pixels.\n` +
      `Valid samples: ${predictions.length}.\n\n` +
      "This is a center-only check, not a guarantee of accuracy " +
      "across the entire reading area.",
  );
}

let calibrationInProgress = false;

async function runCalibration() {
  if (calibrationInProgress) return;

  const stage = document.getElementById("reading-stage");
  const targetDot = document.getElementById("calibration-target");

  if (!stage || !targetDot) {
    status.textContent = "Reader shell or calibration target not found.";
    return;
  }

  if (!latestFeature) {
    status.textContent = "No eye tracking yet. Face the camera and try again.";
    return;
  }

  const instructions =
    "Gaze calibration\n\n" +
    "You will calibrate nine points inside the reading area.\n\n" +
    "• First, eight points around the outside appear in shuffled order.\n" +
    "• After those are complete, a point appears in the center.\n" +
    "• For each point, look directly at it and click it five times.\n" +
    "• The point turns green when its five clicks are recorded.\n" +
    "• Work at your own pace; there is no countdown.\n\n" +
    "After calibration, a center validation point appears. " +
    "Look at it without clicking for a few seconds to measure " +
    "the current gaze prediction accuracy.\n\n" +
    "Keep your head relatively still, your face visible, and " +
    "the room well lit.\n\n" +
    "Ready to begin?";

  if (!window.confirm(instructions)) {
    status.textContent = "Calibration cancelled.";
    return;
  }

  calibrationInProgress = true;

  const outerTargets = [
    { x: 0.08, y: 0.08 }, // top-left
    { x: 0.5, y: 0.08 }, // top-center
    { x: 0.92, y: 0.08 }, // top-right
    { x: 0.92, y: 0.5 }, // right-center
    { x: 0.92, y: 0.92 }, // bottom-right
    { x: 0.5, y: 0.92 }, // bottom-center
    { x: 0.08, y: 0.92 }, // bottom-left
    { x: 0.08, y: 0.5 }, // left-center
  ];

  const sequence = [
    ...shuffle(outerTargets),
    { x: 0.5, y: 0.5 }, // center calibration point
  ];

  const samples = [];

  calibration = null;
  predictionHistory.length = 0;
  updateGazeDebugDot(null);

  targetDot.style.display = "flex";
  targetDot.style.pointerEvents = "auto";

  try {
    for (let i = 0; i < sequence.length; i++) {
      const target = sequence[i];

      const targetViewport = placeTargetWithinStage(targetDot, stage, target);

      targetDot.classList.remove("is-complete", "is-validation");
      targetDot.textContent = "0/5";

      status.textContent =
        `Calibration point ${i + 1}/${sequence.length}: ` +
        "look at the dot, then click it five times.";

      await collectFiveClicksForTarget(
        targetDot,
        targetViewport,
        i + 1,
        sequence.length,
        samples,
      );

      await delay(250);
    }

    if (samples.length !== 45) {
      throw new Error(
        `Expected 45 calibration samples but collected ${samples.length}.`,
      );
    }

    calibration = fitCalibration(samples);

    status.textContent = "Calibration complete. Starting center validation...";

    await runCalibrationValidation();
  } catch (error) {
    calibration = null;
    updateGazeDebugDot(null);

    status.textContent = error.message;
    console.error("Calibration error:", error);
  } finally {
    targetDot.style.display = "none";
    targetDot.style.pointerEvents = "auto";
    targetDot.classList.remove("is-complete", "is-validation");

    calibrationInProgress = false;
  }
}

document
  .getElementById("calibrate-button")
  .addEventListener("click", runCalibration);

window.addEventListener("resize", () => {
  calibration = null;
  status.textContent = "Screen changed. Recalibrate gaze.";
});
