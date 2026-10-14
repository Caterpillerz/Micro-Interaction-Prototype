import {
  HandLandmarker,
  GestureRecognizer
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

// This seems to create the model for recognized gestures
export async function createGestureTracker(vision) {
  const gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "./models/gesture_recognizer.task"
    },
    runningMode: "VIDEO",
    numHands: 1
  });


  return gestureRecognizer;
}


// and this does something with that hand model.
// I will probably create functions with a head like this
// in order to process different gestures to perform different actions.
export function processHands(results, emitGesture) {
  if (results.landmarks.length > 0) {
    const hand = results.landmarks[0];
    const thumbTip = hand[4];
    const indexTip = hand[8];

    // getting the fingertips' distance from each other.
    let y_distance = indexTip.y - thumbTip.y;
    let x_distance = indexTip.x - thumbTip.x;
    let distance = (x_distance ** 2) + (y_distance ** 2);
    
    document.getElementById("thumb-tip").textContent =
      `4: ${thumbTip.x}, ${thumbTip.y}`;
    document.getElementById("index-tip").textContent =
      `8: ${indexTip.x}, ${indexTip.y}`;
    document.getElementById("total-dist").textContent = 
      `4-8: ${distance}`;


    // zoom-out
    if (distance < 0.01) {
      emitGesture("zoom-out");
    }

    // zoom-in
    if (distance > 0.1) {
      emitGesture("zoom-in");
    }

    
    // CASEY: gesture recognition goes here. when a gesture is recognized, call:
    // emitGesture("next-page");
    // emitGesture("previous-page");
    // emitGesture("zoom-in");
    // emitGesture("zoom-out");
    // emitGesture("define-word");
    
  }
}

export function processGesture(results) {
  if (results.gestures.length > 0) {
    const gesture = results.gestures[0][0];
    const gestureType = gesture.categoryName;
    document.getElementById("gest").textContent = gestureType;


    console.log(gestureType);
  }
}
