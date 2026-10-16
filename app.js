// app.js

import {
  FilesetResolver,
  FaceLandmarker,
  HandLandmarker,
  DrawingUtils,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs";

import { initializeGazeCalibration } from "./gaze_calibration.js";

import {
  extractGazeFeature,
  projectGaze,
  updateGazeDebugDot,
  createGazeSmoother,
} from "./gaze_tracking.js";

import {
  // loadText,
  nextPage,
  previousPage,
  zoomIn,
  zoomOut,
  selectWordAt,
  getSelectedWord,
} from "./reader_layout.js";

import { showDefinition, initializeDefinitionPanel } from "./definitions.js";

// Casey: import specific functions from hand_tracking.js,
// for hand and gesture tracking
import {
  createHandTracker,
  processHands,
  createGestureTracker,
  processGesture,
} from "./hand_tracking.js";

import { initializeStoryLoader } from "./story_loader.js";

import { initializeThemeManager } from "./theme_manager.js";

const video = document.getElementById("video");
const status = document.getElementById("status");

let faceLandmarker = null;
let handTracker = null;
// Casey: adding the gesture recognizer
let gestureRecognizer = null;

const featureHistory = [];
const predictionHistory = [];

let latestFeature = null;
let calibration = null;
let lastVideoTime = -1;

const gazeSmoother = createGazeSmoother(0.28);

const gazeCalibration = initializeGazeCalibration({
  status,

  getLatestFeature: () => latestFeature,
  featureHistory,
  predictionHistory,

  getCalibration: () => calibration,
  setCalibration: (value) => {
    calibration = value;
  },
});

initializeStoryLoader();
initializeThemeManager();
initializeDefinitionPanel();

// -----------------------------
// manual debug controls for testing without hand gestures
// -----------------------------

document
  .getElementById("previous-button")
  .addEventListener("click", previousPage);

document.getElementById("next-button").addEventListener("click", nextPage);

// -----------------------------
// hand gesture handling
// -----------------------------

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

/*
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
*/

// -----------------------------
// vision pipeline
// -----------------------------

let timeIntervals = [];

function renderLoop() {
  if (
    faceLandmarker &&
    video.readyState >= 2 &&
    video.currentTime !== lastVideoTime
  ) {
    // log the timestamp.
    const timestamp = performance.now();

    // // Create an array of time intervals
    // // of ~500ms.
    // // ***I'm actually giving it some wiggle room since I've learned
    // // that the browser cannot read exactly 500 milliseconds as fast
    // // as I thought it could.
    // if (timestamp % 500 >= 490 || timestamp % 500 <= 10) {
    //   timeIntervals.push(timestamp);
    //   console.log("add newest timestamp.");
    // }
  
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
        const rawPoint = projectGaze(latestFeature, calibration);
        const point = gazeSmoother.update(rawPoint);

        if (point) {
          updateGazeDebugDot(point);

          // TEMPORARY GAZE DEBUGGING
          console.log("Gaze prediction:", {
            feature: latestFeature,
            rawPoint,
            smoothedPoint: point,
            dotVisible: !document.getElementById("gaze-debug-dot").hidden,
          });

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
      } else {
        gazeSmoother.reset();
        updateGazeDebugDot(null);

        // TEMPORARY GAZE DEBUGGING
        if (!latestFeature) {
          console.warn("Gaze unavailable: no valid eye feature.");
        } else if (!calibration) {
          console.warn("Gaze unavailable: calibration is null.");
        }
      }

      if (handTracker) {
        const handResults = handTracker.detectForVideo(video, timestamp);

        processHands(handResults, handleGesture, timestamp, timeIntervals);
        drawHandLandmarks(handResults);
      }
      // Casey: adding the condition for the gesture recognizer
      if (gestureRecognizer) {
        const gestureResults = gestureRecognizer.recognizeForVideo(
          video,
          timestamp,
        );

        processGesture(gestureResults, handleGesture);
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
    // Casey: adding the call to create gesture tracker
    handTracker = await createHandTracker(vision);
    gestureRecognizer = await createGestureTracker(vision);

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

    gazeCalibration.openCalibrationIntro();
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
    FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
    { color: "#d27c60", lineWidth: 1.5 },
  );

  drawingUtils.drawConnectors(
    landmarks,
    FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
    { color: "#d27c60", lineWidth: 1.5 },
  );

  drawingUtils.drawConnectors(
    landmarks,
    FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS,
    { color: "#fffaf1", lineWidth: 2 },
  );

  drawingUtils.drawConnectors(
    landmarks,
    FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS,
    { color: "#fffaf1", lineWidth: 2 },
  );
}

function drawHandLandmarks(results) {
  if (!drawingUtils || !results?.landmarks) {
    return;
  }

  for (const landmarks of results.landmarks) {
    drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
      color: "#d27c60",
      lineWidth: 1.25,
    });

    drawingUtils.drawLandmarks(landmarks, {
      color: "#fffaf1",
      fillColor: "#d27c60",
      lineWidth: 1,
      radius: 2,
    });
  }
}

initialize();
