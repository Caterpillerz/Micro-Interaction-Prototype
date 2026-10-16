import {
  HandLandmarker,
  GestureRecognizer
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs";


// let timeIntervals = [];

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
export function processHands(results, emitGesture, timestamp, timeIntervals) {
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
    document.getElementById("timestamp").textContent = 
      `${timestamp}`;

    // zoom-out
    if (distance < 0.01) {
      emitGesture("zoom-out");
    }

    // zoom-in
    if (distance > 0.1) {
      emitGesture("zoom-in");
    }

    // Create an array of time intervals
    // of ~500ms.
    // ***I'm actually giving it some wiggle room since I've learned
    // that the browser cannot read exactly 500 milliseconds as fast
    // as I thought it could.
    if (timestamp % 500 >= 490 || timestamp % 500 <= 10) {
      // create an object that stores the timestamp and the index position.
      // put it in the array.
      let pastIndexPosition = {time: timestamp,  position: indexTip.x};
      timeIntervals.push(pastIndexPosition);
      console.log("add newest timestamp.");
    }
    
    // log what the array's doing on the website for debugging purposes.
    if (timeIntervals.length > 0) {
      document.getElementById("last-timestamp").textContent = 
        `${timeIntervals[timeIntervals.length - 1].time}, ${timeIntervals[timeIntervals.length - 1].position}`;
    }

    // USAGE TIP: when turning the page, the user should swipe quickly and return their hand
    // to its position before the swipe before putting their hand down. That's the least buggy way
    // to flip pages :')
    // flip the page using the array / history of time intervals.
    // adding a cooldown time of ~2 seconds
    let currentIndexPosition = indexTip.x;
    if (timeIntervals.length > 0) {
      // if the timeIntervals has data about you finger's position in it,
      // displacement should be difference between your finger's current position
      // and its position ~500ms ago (the last object in the array).
      let pastIndexPosition = timeIntervals[timeIntervals.length - 1].position;
      let displacement = currentIndexPosition - pastIndexPosition;
      if (displacement < -0.3) {
        emitGesture("previous-page");
        // *** clearing the timeIntervals saves the webpage from blowing up with data
        // and prevents us from accidentally blasting forward/backward a million pages
        // since we only flip pages when the timeIntervals array has stuff in it.
        timeIntervals.splice(0);
        pastIndexPosition = 0;
        displacement = 0;
      }
      if (displacement > 0.3) {
        emitGesture("next-page");
        timeIntervals.splice(0);
        pastIndexPosition = 0;
        displacement = 0;
      }
    }
  }
}

function zoomIn() {

}

function zoomOut() {
  
}

function flipPage() {
  
  
}

// I'm going to create a separate helper function for logging the index finger's
// x in moments of time. I think having this function NOT be called in app.js's renderLoop()
// will be the secret sauce to getting the page flipping functions off the ground.
// function logPastXPosition(positionToBeLogged) {
//   let pastXPosition = positionToBeLogged;
//   return pastXPosition;
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
