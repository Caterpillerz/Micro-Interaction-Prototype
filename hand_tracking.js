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

    // creating displacement variables (past and current positions) 
    // for flipping pages. Only using the index finger.
    // let past_xPosition = indexTip.x;
    // let curr_xPosition;


    // let timer = setInterval(function() {
    //   curr_xPosition = indexTip.x;
    //   let displacement = curr_xPosition - past_xPosition;
    //   if (displacement >= 0.5) {
    //     emitGesture("previous-page");
    //   }
    //   if (displacement <= -0.5) {
    //     emitGesture("next-page");
    //   }

    // }, 500);



    
    // CASEY: gesture recognition goes here. when a gesture is recognized, call:
    // emitGesture("next-page");
    // emitGesture("previous-page");
    // emitGesture("zoom-in");
    // emitGesture("zoom-out");
    // emitGesture("define-word");
    
  }
}

// I'm going to create a separate helper function for logging the index finger's
// x in moments of time. I think having this function NOT be called in app.js's renderLoop()
// will be the secret sauce to getting the page flipping functions off the ground.
// function getPastXPosition() {

// } 

export function processGesture(results, emitGesture) {
  if (results.gestures.length > 0) {
    const gesture = results.gestures[0][0];
    const gestureType = gesture.categoryName;
    document.getElementById("gest").textContent = gestureType;

    // pull up definition w/ victory gesture
    if (gestureType === "Victory") {
      emitGesture("define-word");
      document.getElementById("show-me-my-deffies").textContent = gestureType;
    }
  }
}
