import {
  FilesetResolver,
  FaceLandmarker,
  HandLandmarker,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs";

// These functions control the vision that sees the hand
// and the camera/video on the website.

const vision = await FilesetResolver.forVisionTasks(
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
);

const video = document.getElementById("video");

async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: 640,
      height: 480,
      facingMode: "user",
    },
    audio: false,
  });

  video.srcObject = stream;

  video.addEventListener("loadeddata", () => {
    renderLoop();
  });
}

let lastVideoTime = -1;

function renderLoop() {
  if (video.currentTime !== lastVideoTime) {
    const timeStamp = performance.now();
    const faceLandmarkerResults = faceLandmarker.detectForVideo(
      video,
      timeStamp
    );
    const handLandmarkerResults = handLandmarker.detectForVideo(
      video,
      timeStamp
    );
    processFace(faceLandmarkerResults);
    processHands(handLandmarkerResults);
    lastVideoTime = video.currentTime;
  }
  requestAnimationFrame(renderLoop);
}

// These functions are specific to hand-tracking.

const handLandmarker = await HandLandmarker.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: "./models/hand_landmarker.task",
  },
  runningMode: "VIDEO",
  numHands: 1,
});

function processHands(results) {
  if (results.landmarks.length > 0) {
    const hand = results.landmarks[0];
    const thumbTip = hand[4];
    const indexTip = hand[8];
    document.getElementById("thumb-tip").textContent =
      `4: ${thumbTip.x}, ${thumbTip.y}`;
    document.getElementById("index-tip").textContent =
      `8: ${indexTip.x}, ${indexTip.y}`;
  }
}