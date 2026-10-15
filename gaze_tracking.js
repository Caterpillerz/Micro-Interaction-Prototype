// gaze_tracking.js

function getEyeRatios(
  landmarks,
  irisIndex,
  firstCornerIndex,
  secondCornerIndex,
  upperLidIndex,
  lowerLidIndex,
) {
  const iris = landmarks[irisIndex];
  const firstCorner = landmarks[firstCornerIndex];
  const secondCorner = landmarks[secondCornerIndex];
  const upper = landmarks[upperLidIndex];
  const lower = landmarks[lowerLidIndex];

  const horizontalSpan = secondCorner.x - firstCorner.x;
  const verticalSpan = lower.y - upper.y;

  // exclude nearly closed eyes
  if (Math.abs(horizontalSpan) < 0.005 || Math.abs(verticalSpan) < 0.003) {
    return null;
  }

  return {
    x: (iris.x - firstCorner.x) / horizontalSpan,
    y: (iris.y - upper.y) / verticalSpan,
  };
}

export function extractGazeFeature(results) {
  const landmarks = results.faceLandmarks?.[0];

  if (!landmarks || landmarks.length < 478) {
    return null;
  }

  const left = getEyeRatios(landmarks, 468, 33, 133, 159, 145);

  const right = getEyeRatios(landmarks, 473, 362, 263, 386, 374);

  if (!left || !right) {
    return null;
  }

  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
  };
}

const gazeDot = document.getElementById("gaze-debug-dot");

export function updateGazeDebugDot(gazePoint) {
  if (!gazeDot) {
    return;
  }

  if (
    !gazePoint ||
    !Number.isFinite(gazePoint.x) ||
    !Number.isFinite(gazePoint.y)
  ) {
    gazeDot.hidden = true;
    return;
  }

  const x = gazePoint.x * window.innerWidth;
  const y = gazePoint.y * window.innerHeight;

  gazeDot.style.left = `${x}px`;
  gazeDot.style.top = `${y}px`;
  gazeDot.hidden = false;
}

export function createGazeSmoother(alpha = 0.28) {
  const smoothing = Math.max(0.01, Math.min(1, alpha));
  let previous = null;

  return {
    update(point) {
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        previous = null;
        return null;
      }

      if (!previous) {
        previous = { x: point.x, y: point.y };
      } else {
        previous.x += smoothing * (point.x - previous.x);
        previous.y += smoothing * (point.y - previous.y);
      }

      return { ...previous };
    },

    reset() {
      previous = null;
    },
  };
}

function solveLinearSystem(matrix, values) {
  const n = values.length;
  const a = matrix.map((row, i) => [...row, values[i]]);

  for (let col = 0; col < n; col++) {
    let pivot = col;

    for (let row = col + 1; row < n; row++) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) {
        pivot = row;
      }
    }

    if (Math.abs(a[pivot][col]) < 1e-12) {
      throw new Error("Calibration is unstable. Please recalibrate.");
    }

    [a[col], a[pivot]] = [a[pivot], a[col]];

    const divisor = a[col][col];

    for (let j = col; j <= n; j++) {
      a[col][j] /= divisor;
    }

    for (let row = 0; row < n; row++) {
      if (row === col) continue;

      const factor = a[row][col];

      for (let j = col; j <= n; j++) {
        a[row][j] -= factor * a[col][j];
      }
    }
  }

  return a.map((row) => row[n]);
}

function makeModelRow(feature, normalization) {
  return [
    1,
    (feature.x - normalization.means[0]) / normalization.scales[0],
    (feature.y - normalization.means[1]) / normalization.scales[1],
  ];
}

export function fitCalibration(samples) {
  if (samples.length < 5) {
    throw new Error("At least five calibration samples are required.");
  }

  const features = samples.map((sample) => sample.feature);

  const means = [
    features.reduce((sum, f) => sum + f.x, 0) / features.length,
    features.reduce((sum, f) => sum + f.y, 0) / features.length,
  ];

  const scales = [0, 1].map((axis) => {
    const values = features.map((f) => (axis === 0 ? f.x : f.y));
    const variance =
      values.reduce((sum, value) => sum + (value - means[axis]) ** 2, 0) /
      values.length;

    const standardDeviation = Math.sqrt(variance);
    return standardDeviation > 1e-6 ? standardDeviation : 1;
  });

  const normalization = { means, scales };
  const parameterCount = 3;

  const normal = Array.from({ length: parameterCount }, () =>
    Array(parameterCount).fill(0),
  );

  const targetX = Array(parameterCount).fill(0);
  const targetY = Array(parameterCount).fill(0);

  for (const sample of samples) {
    const row = makeModelRow(sample.feature, normalization);

    for (let i = 0; i < parameterCount; i++) {
      for (let j = 0; j < parameterCount; j++) {
        normal[i][j] += row[i] * row[j];
      }

      targetX[i] += row[i] * sample.target.x;
      targetY[i] += row[i] * sample.target.y;
    }
  }

  const lambda = 0.05;
  normal[1][1] += lambda;
  normal[2][2] += lambda;

  return {
    ...normalization,
    x: solveLinearSystem(normal, targetX),
    y: solveLinearSystem(normal, targetY),
  };
}

export function projectGaze(feature, calibration) {
  const row = makeModelRow(feature, calibration);

  const predict = (coefficients) =>
    coefficients.reduce((sum, coefficient, i) => sum + coefficient * row[i], 0);

  return {
    x: predict(calibration.x),
    y: predict(calibration.y),
  };
}
