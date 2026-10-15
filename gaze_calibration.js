// gaze_calibration.js

import { fitCalibration, updateGazeDebugDot } from "./gaze_tracking.js";

export function initializeGazeCalibration({
  status,
  getLatestFeature,
  featureHistory,
  predictionHistory,
  getCalibration,
  setCalibration,
}) {
  // -----------------------------
  // Calibration modal elements
  // -----------------------------

  const calibrationModal = document.getElementById("calibration-modal");
  const calibrationModalTitle = document.getElementById(
    "calibration-modal-title",
  );
  const calibrationIntroView = document.getElementById(
    "calibration-intro-view",
  );
  const calibrationResultView = document.getElementById(
    "calibration-result-view",
  );
  const calibrationModalNotice = document.getElementById(
    "calibration-modal-notice",
  );
  const calibrationResultText = document.getElementById(
    "calibration-result-text",
  );

  const calibrationStartButton = document.getElementById(
    "calibration-start-button",
  );
  const calibrationSkipButton = document.getElementById(
    "calibration-skip-button",
  );
  const calibrationModalCloseButton = document.getElementById(
    "calibration-modal-close",
  );
  const calibrationResultCloseButton = document.getElementById(
    "calibration-result-close-button",
  );
  const calibrationRetryButton = document.getElementById(
    "calibration-retry-button",
  );
  const calibrationValidationView = document.getElementById(
    "calibration-validation-view",
  );
  const calibrationValidationStartButton = document.getElementById(
    "calibration-validation-start-button",
  );
  const calibrationResultSummary = document.getElementById(
    "calibration-result-summary",
  );
  const calibrationResultRecommendation = document.getElementById(
    "calibration-result-recommendation",
  );
  const calibrationResultMetrics = document.getElementById(
    "calibration-result-metrics",
  );

  let calibrationInProgress = false;
  const CLICKS_PER_TARGET = 3;

  // -----------------------------
  // Calibration modal controls
  // -----------------------------

  function openCalibrationIntro(notice = "") {
    if (!calibrationModal) return;

    calibrationModalTitle.textContent = "Ready to calibrate your gaze?";
    calibrationIntroView.hidden = false;
    calibrationValidationView.hidden = true;
    calibrationResultView.hidden = true;
    calibrationModalNotice.textContent = notice;
    calibrationModal.hidden = false;

    calibrationStartButton?.focus();
  }

  function closeCalibrationModal() {
    if (calibrationModal) {
      calibrationModal.hidden = true;
    }
  }

  function showCalibrationResult({ summary, recommendation, metrics = "" }) {
    if (!calibrationModal) return;

    calibrationModalTitle.textContent = "Calibration results";
    calibrationIntroView.hidden = true;
    calibrationValidationView.hidden = true;
    calibrationResultView.hidden = false;

    calibrationResultSummary.textContent = summary;
    calibrationResultRecommendation.textContent = recommendation;
    calibrationResultMetrics.textContent = metrics;
    calibrationResultMetrics.hidden = !metrics;

    calibrationModal.hidden = false;
    calibrationResultCloseButton?.focus();
  }

  function showValidationInstructions() {
    if (!calibrationModal) return;

    calibrationModalTitle.textContent = "One last quick check";
    calibrationIntroView.hidden = true;
    calibrationValidationView.hidden = false;
    calibrationResultView.hidden = true;

    calibrationModal.hidden = false;
    calibrationValidationStartButton?.focus();
  }

  calibrationStartButton?.addEventListener("click", () => {
    if (!getLatestFeature()) {
      calibrationModalNotice.textContent =
        "No eyes detected. Check your camera and make sure your face is visible.";
      return;
    }

    closeCalibrationModal();
    runCalibration();
  });

  calibrationSkipButton?.addEventListener("click", () => {
    closeCalibrationModal();
    status.textContent =
      "Calibration skipped. You can calibrate later using the button above.";
  });

  calibrationValidationStartButton?.addEventListener("click", () => {
    closeCalibrationModal();
    runCalibrationValidation();
  });

  calibrationModalCloseButton?.addEventListener("click", closeCalibrationModal);

  calibrationResultCloseButton?.addEventListener(
    "click",
    closeCalibrationModal,
  );

  calibrationRetryButton?.addEventListener("click", () => {
    openCalibrationIntro(
      "Let's try again. Keep your head steady and look directly at each dot.",
    );
  });

  window.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      calibrationModal &&
      !calibrationModal.hidden
    ) {
      closeCalibrationModal();
    }
  });

  // -----------------------------
  // Calibration helpers
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
      x: median(features.map((feature) => feature.x)),
      y: median(features.map((feature) => feature.y)),
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

  function collectRecentFeatures(windowMs = 850) {
    const now = performance.now();

    return featureHistory
      .filter((sample) => now - sample.time <= windowMs)
      .map((sample) => ({ ...sample.feature }));
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

  function collectClicksForTarget(
    targetDot,
    targetViewport,
    pointIndex,
    totalPoints,
    samples,
  ) {
    return new Promise((resolve) => {
      let clickCount = 0;
      let lastAcceptedClick = -Infinity;

      targetDot.textContent = `0/${CLICKS_PER_TARGET}`;
      targetDot.classList.remove("is-complete");

      const handleClick = () => {
        const now = performance.now();

        if (now - lastAcceptedClick < 250) {
          status.textContent =
            `Point ${pointIndex}/${totalPoints}: ` +
            "Pause briefly between clicks while looking at the dot.";
          return;
        }

        const observations = collectRecentFeatures(650);

        if (observations.length < 5) {
          status.textContent =
            "Not enough recent eye samples. Keep your face visible and try again.";
          return;
        }

        lastAcceptedClick = now;

        samples.push({
          feature: medianFeature(observations),
          target: { ...targetViewport },
        });

        clickCount += 1;

        targetDot.textContent =
          clickCount < CLICKS_PER_TARGET
            ? `${clickCount}/${CLICKS_PER_TARGET}`
            : "✓";

        if (clickCount < CLICKS_PER_TARGET) {
          status.textContent =
            `Point ${pointIndex}/${totalPoints}: ` +
            `${clickCount}/${CLICKS_PER_TARGET} clicks recorded. ` +
            "Keep looking at the dot.";
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

  // -----------------------------
  // validation
  // -----------------------------

  async function runCalibrationValidation() {
    const stage = document.getElementById("reading-stage");
    const targetDot = document.getElementById("calibration-target");

    if (!stage || !targetDot || !getCalibration()) {
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
      status.textContent =
        "Center validation: look at the dot without clicking.";

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
      const message =
        "We couldn't collect enough steady gaze readings to judge this calibration.\n\n" +
        "You can continue reading, but we can't yet tell how well the gaze tracker " +
        "will follow your eyes.\n\n" +
        "For a better result, check that your face is well lit, both eyes are " +
        "visible, and the camera can see you clearly.";

      status.textContent = "Not enough gaze data to estimate accuracy.";
      showCalibrationResult(message);
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

    let summary;
    let recommendation;

    // This is the code that builds the message that we see when we look at
    // the blue dot in the final calibration phase.
    if (accuracyPercent >= 80 && medianError <= 100) {
      summary = "Calibration looks good.";
      recommendation = "Continue reading. Recalibrate if the gaze dot drifts.";
    } else if (accuracyPercent >= 50 && medianError <= 200) {
      summary = "Tracking may wander at times.";
      recommendation =
        "You can continue. Recalibrate if word selection feels off.";
    } else {
      summary = "Tracking may be inaccurate.";
      recommendation =
        "Recalibrate with better lighting and both eyes visible.";
    }

    // Show what has been assigned above.
    showCalibrationResult({
      summary,
      recommendation,
      metrics:
        `Center check: ${accuracyPercent}% within ${radiusPixels}px; ` +
        `median distance ${Math.round(medianError)}px. Center only.`,
    });

    status.textContent =
      `Center check: ${accuracyPercent}% within ${radiusPixels}px. ` +
      `Median distance: ${Math.round(medianError)}px.`;

    showCalibrationResult(message);
  }

  // -----------------------------
  // run calibration
  // -----------------------------

  async function runCalibration() {
    if (calibrationInProgress) return;

    const stage = document.getElementById("reading-stage");
    const targetDot = document.getElementById("calibration-target");

    if (!stage || !targetDot) {
      status.textContent = "Reader shell or calibration target not found.";
      return;
    }

    if (!getLatestFeature()) {
      openCalibrationIntro(
        "No eye tracking yet. Face the camera and try again.",
      );
      return;
    }

    calibrationInProgress = true;

    // Casey: commented this out so it can be referred to.
    // const outerTargets = [
    //   { x: 0.08, y: 0.08 },
    //   { x: 0.5, y: 0.08 },
    //   { x: 0.92, y: 0.08 },
    //   { x: 0.92, y: 0.5 },
    //   { x: 0.92, y: 0.92 },
    //   { x: 0.5, y: 0.92 },
    //   { x: 0.08, y: 0.92 },
    //   { x: 0.08, y: 0.5 },
    // ];

    // Casey: Making it so that all of the calibration dots show up.
    // Ones at a lower y do not seem to show up for calibration
    // so I'm putting all of them at y=0.08 so that I can calibrate gaze
    // to test defining words
    const outerTargets = [
      { x: 0.08, y: 0.08 },
      { x: 0.32, y: 0.08 },
      { x: 0.68, y: 0.08 },
      { x: 0.92, y: 0.08 },
      { x: 0.08, y: 0.5 },
      { x: 0.32, y: 0.5 },
      { x: 0.68, y: 0.5 },
      { x: 0.92, y: 0.5 },
    ];

    // Casey: just shuffling all these dots on the same y-level for now
    // const sequence = [...shuffle(outerTargets), { x: 0.5, y: 0.5 }];
    const sequence = [...shuffle(outerTargets), { x: 0.5, y: 0.29 }];

    const samples = [];

    setCalibration(null);
    predictionHistory.length = 0;
    updateGazeDebugDot(null);

    targetDot.style.display = "flex";
    targetDot.style.pointerEvents = "auto";

    try {
      for (let i = 0; i < sequence.length; i++) {
        const target = sequence[i];

        const targetViewport = placeTargetWithinStage(targetDot, stage, target);

        targetDot.classList.remove("is-complete", "is-validation");
        targetDot.textContent = "0/3";

        status.textContent =
          `Calibration point ${i + 1}/${sequence.length}: ` +
          "look at the dot, then click it three times.";

        await collectClicksForTarget(
          targetDot,
          targetViewport,
          i + 1,
          sequence.length,
          samples,
        );

        await delay(250);
      }

      const expectedSamples = sequence.length * CLICKS_PER_TARGET;

      if (samples.length !== expectedSamples) {
        throw new Error(
          `Expected ${expectedSamples} calibration samples but collected ${samples.length}.`,
        );
      }

      setCalibration(fitCalibration(samples));

      status.textContent =
        "Calibration complete. One quick gaze check remains.";

      showValidationInstructions();
    } catch (error) {
      setCalibration(null);
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
    ?.addEventListener("click", () => openCalibrationIntro());

  window.addEventListener("resize", () => {
    setCalibration(null);
    status.textContent = "Screen changed. Recalibrate gaze.";
  });

  return {
    openCalibrationIntro,
    runCalibration,
  };
}
