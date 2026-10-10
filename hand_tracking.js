import {
  HandLandmarker,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs";

// These functions are specific to hand-tracking.

// This seems to create the model for the hand,
// (the graph of dots) using hand_landmarker.task
export async function createHandTracker(vision) {
  const handLandmarker = await HandLandmarker.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: "./models/hand_landmarker.task",
  },
  runningMode: "VIDEO",
  numHands: 1,
  });

  return handLandmarker;

}

// and this does something with that hand model.
// I will probably create functions with a head like this
// in order to process different gestures to perform different actions.
export function processHands(results, emitGesture) {
  if (results.landmarks.length > 0) {
    const hand = results.landmarks[0];
    const thumbTip = hand[4];
    const indexTip = hand[8];
    
    document.getElementById("thumb-tip").textContent =
      `4: ${thumbTip.x}, ${thumbTip.y}`;
    document.getElementById("index-tip").textContent =
      `8: ${indexTip.x}, ${indexTip.y}`;
    
    // CASEY: gesture recognition goes here. when a gesture is recognized, call:
    // emitGesture("next-page");
    // emitGesture("previous-page");
    // emitGesture("zoom-in");
    // emitGesture("zoom-out");
    // emitGesture("define-word");
    
  }
}