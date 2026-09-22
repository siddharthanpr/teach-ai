// Teach AI — Neural Network engine: objective functions, data generation,
// and a hand-rolled fully-connected regression net (forward + backprop + SGD).
(function () {
  "use strict";

  function gaussianNoise() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function parseParams(str) {
    return String(str)
      .split(",")
      .map((s) => parseFloat(s.trim()))
      .filter((v) => !Number.isNaN(v));
  }

  // Each objective: a label, a human formula string, a default params
  // string, the x-domain it's sampled over, and fn(x, params) -> y (or
  // null where the function is undefined, e.g. log's domain).
  const OBJECTIVES = {
    quadratic: {
      label: "Quadratic",
      formula: "a·x² + b·x + c",
      defaultParams: "1, 0, -2",
      domain: [-4, 4],
      fn: (x, p) => (p[0] || 0) * x * x + (p[1] || 0) * x + (p[2] || 0),
    },
    cubic: {
      label: "Cubic",
      formula: "a·x³ + b·x² + c·x + d",
      defaultParams: "0.5, 0, -2, 0",
      domain: [-3.5, 3.5],
      fn: (x, p) => (p[0] || 0) * x ** 3 + (p[1] || 0) * x * x + (p[2] || 0) * x + (p[3] || 0),
    },
    polynomial: {
      label: "Polynomial (custom degree)",
      formula: "a·xⁿ + b·xⁿ⁻¹ + … (highest degree first, any length)",
      defaultParams: "0.3, 0, -1.5, 0, 1",
      domain: [-3, 3],
      fn: (x, p) => (p.length ? p.reduce((acc, c) => acc * x + c, 0) : 0),
    },
    sinusoid: {
      label: "Sinusoid",
      formula: "a·sin(b·x + c) + d",
      defaultParams: "2, 1.3, 0, 0",
      domain: [-6, 6],
      fn: (x, p) => (p[0] || 0) * Math.sin((p[1] || 1) * x + (p[2] || 0)) + (p[3] || 0),
    },
    log: {
      label: "Logarithmic",
      formula: "a·ln(b·x + c) + d  (only where b·x + c > 0)",
      defaultParams: "1.5, 1, 5, 0",
      domain: [-3, 4],
      fn: (x, p) => {
        const v = (p[1] || 1) * x + (p[2] || 0);
        return v > 1e-6 ? (p[0] || 0) * Math.log(v) + (p[3] || 0) : null;
      },
    },
    complex: {
      label: "Complex nonlinear",
      formula: "a·sin(b·x) + c·x·cos(d·x)",
      defaultParams: "1.5, 2, 0.35, 1",
      domain: [-5, 5],
      fn: (x, p) => (p[0] || 0) * Math.sin((p[1] || 1) * x) + (p[2] || 0) * x * Math.cos((p[3] || 1) * x),
    },
  };

  function generateData(objectiveKey, paramsStr, n, noiseStd) {
    const obj = OBJECTIVES[objectiveKey];
    const params = parseParams(paramsStr);
    const [xMin, xMax] = obj.domain;
    const points = [];
    let attempts = 0;
    while (points.length < n && attempts < n * 30) {
      attempts++;
      const x = xMin + Math.random() * (xMax - xMin);
      const yTrue = obj.fn(x, params);
      if (yTrue === null || !Number.isFinite(yTrue)) continue;
      points.push({ x, y: yTrue + gaussianNoise() * noiseStd, yTrue });
    }
    points.sort((a, b) => a.x - b.x);
    return { points, domain: obj.domain, params };
  }

  function trueCurve(objectiveKey, paramsStr, samples) {
    const obj = OBJECTIVES[objectiveKey];
    const params = parseParams(paramsStr);
    const [xMin, xMax] = obj.domain;
    const pts = [];
    for (let i = 0; i <= samples; i++) {
      const x = xMin + ((xMax - xMin) * i) / samples;
      const y = obj.fn(x, params);
      if (y !== null && Number.isFinite(y)) pts.push({ x, y });
    }
    return pts;
  }

  function computeNormalization(points, domain) {
    const xScale = Math.max(Math.abs(domain[0]), Math.abs(domain[1])) || 1;
    const ys = points.map((p) => p.y);
    const yMean = ys.reduce((a, b) => a + b, 0) / ys.length;
    const variance = ys.reduce((a, b) => a + (b - yMean) ** 2, 0) / ys.length;
    const yStd = Math.sqrt(variance) || 1;
    return { xScale, yMean, yStd };
  }

  function parseHiddenLayers(str) {
    const sizes = String(str)
      .split(",")
      .map((s) => Math.max(1, Math.min(8, Math.round(Number(s.trim())))))
      .filter((n) => Number.isFinite(n) && n > 0)
      .slice(0, 4);
    return sizes.length ? sizes : [4];
  }

  // ---- network ----
  function createNetwork(sizes) {
    const layers = [];
    for (let l = 1; l < sizes.length; l++) {
      const prevSize = sizes[l - 1];
      const size = sizes[l];
      const isOutput = l === sizes.length - 1;
      const scale = isOutput ? Math.sqrt(1 / prevSize) : Math.sqrt(2 / prevSize);
      const W = [];
      for (let j = 0; j < size; j++) {
        const row = [];
        for (let i = 0; i < prevSize; i++) row.push(gaussianNoise() * scale);
        W.push(row);
      }
      layers.push({ W, b: new Array(size).fill(0) });
    }
    return { sizes, layers };
  }

  // opts.training + opts.dropoutRate enable inverted dropout on hidden
  // layers only (never on the linear output layer).
  function forward(net, xNorm, opts) {
    opts = opts || {};
    const activations = [[xNorm]];
    const preActs = [];
    const dropMasks = [];
    let current = [xNorm];
    for (let l = 0; l < net.layers.length; l++) {
      const { W, b } = net.layers[l];
      const isOutput = l === net.layers.length - 1;
      const z = new Array(W.length);
      for (let j = 0; j < W.length; j++) {
        let sum = b[j];
        const row = W[j];
        for (let i = 0; i < current.length; i++) sum += row[i] * current[i];
        z[j] = sum;
      }
      preActs.push(z);
      let out;
      if (isOutput) {
        out = z.slice();
        dropMasks.push(null);
      } else {
        out = z.map((v) => (v > 0 ? v : 0));
        if (opts.training && opts.dropoutRate > 0) {
          const keepProb = 1 - opts.dropoutRate;
          const mask = out.map(() => (Math.random() < keepProb ? 1 / keepProb : 0));
          out = out.map((v, idx) => v * mask[idx]);
          dropMasks.push(mask);
        } else {
          dropMasks.push(null);
        }
      }
      activations.push(out);
      current = out;
    }
    return { activations, preActs, dropMasks, output: current[0] };
  }

  function predict(net, x, norm) {
    const cache = forward(net, x / norm.xScale, { training: false });
    return cache.output * norm.yStd + norm.yMean;
  }

  function datasetMSE(net, points, norm) {
    let sum = 0;
    for (const p of points) {
      const d = predict(net, p.x, norm) - p.y;
      sum += d * d;
    }
    return sum / points.length;
  }

  // One mini-batch SGD step. Returns the batch's mean-squared error (in
  // normalized-y space, comparable across steps).
  function trainStep(net, points, norm, opts) {
    const L = net.layers.length;
    const grads = net.layers.map((layer) => ({
      dW: layer.W.map((row) => row.map(() => 0)),
      db: layer.b.map(() => 0),
    }));
    const batchSize = Math.max(1, Math.min(opts.batchSize, points.length));
    let totalLoss = 0;

    for (let s = 0; s < batchSize; s++) {
      const sample = points[Math.floor(Math.random() * points.length)];
      const xNorm = sample.x / norm.xScale;
      const targetNorm = (sample.y - norm.yMean) / norm.yStd;
      const cache = forward(net, xNorm, { training: true, dropoutRate: opts.dropoutRate });
      const err = cache.output - targetNorm;
      totalLoss += err * err;

      let dZ = [2 * err]; // linear output activation: dL/dz == dL/dOutput
      for (let l = L - 1; l >= 0; l--) {
        const inputAct = cache.activations[l];
        const { W } = net.layers[l];
        for (let j = 0; j < W.length; j++) {
          grads[l].db[j] += dZ[j];
          const row = W[j];
          for (let i = 0; i < inputAct.length; i++) grads[l].dW[j][i] += dZ[j] * inputAct[i];
        }
        if (l > 0) {
          const prevSize = inputAct.length;
          const dPrevAct = new Array(prevSize).fill(0);
          for (let i = 0; i < prevSize; i++) {
            let sum = 0;
            for (let j = 0; j < W.length; j++) sum += W[j][i] * dZ[j];
            dPrevAct[i] = sum;
          }
          const mask = cache.dropMasks[l - 1];
          const afterDrop = mask ? dPrevAct.map((v, idx) => v * mask[idx]) : dPrevAct;
          const prevPreAct = cache.preActs[l - 1];
          dZ = afterDrop.map((v, idx) => (prevPreAct[idx] > 0 ? v : 0));
        }
      }
    }

    for (let l = 0; l < L; l++) {
      const { W, b } = net.layers[l];
      const { dW, db } = grads[l];
      for (let j = 0; j < W.length; j++) {
        b[j] -= opts.lr * (db[j] / batchSize);
        for (let i = 0; i < W[j].length; i++) W[j][i] -= opts.lr * (dW[j][i] / batchSize);
      }
    }

    return { mse: totalLoss / batchSize };
  }

  // ---- parametric models (the "what am I fitting WITH" side) ----
  // These are separate from OBJECTIVES (the "what generated the data"
  // side) so you can e.g. fit a sinusoid MODEL to quadratic-generated
  // data and see the mismatch. Each has a closed-form predict() and an
  // ANALYTIC gradient per parameter (hand-derived calculus, not
  // autodiff) — small parameter counts make this the natural choice.
  const MODELS = {
    linear: {
      label: "Straight line",
      formula: "m·x + b",
      paramNames: ["m", "b"],
      predict: (x, p) => p[0] * x + p[1],
      grad: (x, p) => [x, 1],
    },
    quadratic: {
      label: "Quadratic",
      formula: "a·x² + b·x + c",
      paramNames: ["a", "b", "c"],
      predict: (x, p) => p[0] * x * x + p[1] * x + p[2],
      grad: (x, p) => [x * x, x, 1],
    },
    cubic: {
      label: "Cubic",
      formula: "a·x³ + b·x² + c·x + d",
      paramNames: ["a", "b", "c", "d"],
      predict: (x, p) => p[0] * x ** 3 + p[1] * x * x + p[2] * x + p[3],
      grad: (x, p) => [x ** 3, x * x, x, 1],
    },
    polynomial: {
      label: "Polynomial (custom degree)",
      formula: "p₀·xⁿ + p₁·xⁿ⁻¹ + … (degree set below, highest-degree first)",
      paramNames: null, // dynamic — sized by the modelDegree control
      predict: (x, p) => (p.length ? p.reduce((acc, c) => acc * x + c, 0) : 0),
      grad: (x, p) => {
        const n = p.length - 1;
        const g = new Array(p.length);
        for (let k = 0; k <= n; k++) g[k] = Math.pow(x, n - k);
        return g;
      },
    },
    sinusoid: {
      label: "Sinusoid",
      formula: "a·sin(b·x + c) + d",
      paramNames: ["a", "b", "c", "d"],
      predict: (x, p) => p[0] * Math.sin(p[1] * x + p[2]) + p[3],
      grad: (x, p) => {
        const inner = p[1] * x + p[2];
        return [Math.sin(inner), p[0] * Math.cos(inner) * x, p[0] * Math.cos(inner), 1];
      },
    },
    log: {
      label: "Logarithmic",
      formula: "a·ln(b·x + c) + d",
      paramNames: ["a", "b", "c", "d"],
      predict: (x, p) => {
        const v = p[1] * x + p[2];
        return v > 1e-6 ? p[0] * Math.log(v) + p[3] : null;
      },
      grad: (x, p) => {
        const v = p[1] * x + p[2];
        if (v <= 1e-6) return null;
        return [Math.log(v), (p[0] * x) / v, p[0] / v, 1];
      },
    },
    complex: {
      label: "Complex nonlinear",
      formula: "a·sin(b·x) + c·x·cos(d·x)",
      paramNames: ["a", "b", "c", "d"],
      predict: (x, p) => p[0] * Math.sin(p[1] * x) + p[2] * x * Math.cos(p[3] * x),
      grad: (x, p) => [
        Math.sin(p[1] * x),
        p[0] * Math.cos(p[1] * x) * x,
        x * Math.cos(p[3] * x),
        -p[2] * x * x * Math.sin(p[3] * x),
      ],
    },
  };

  function createParamModel(modelKey, degree) {
    const spec = MODELS[modelKey];
    const count = spec.paramNames ? spec.paramNames.length : Math.max(1, Math.min(9, Math.round(degree))) + 1;
    const params = new Array(count).fill(0).map(() => gaussianNoise() * 0.3);
    return { modelKey, params };
  }

  function paramPredict(model, x, norm) {
    const v = MODELS[model.modelKey].predict(x / norm.xScale, model.params);
    return v === null || !Number.isFinite(v) ? null : v * norm.yStd + norm.yMean;
  }

  function paramDatasetMSE(model, points, norm) {
    let sum = 0, count = 0;
    for (const p of points) {
      const pred = paramPredict(model, p.x, norm);
      if (pred === null) continue;
      const d = pred - p.y;
      sum += d * d;
      count++;
    }
    return count ? sum / count : NaN;
  }

  // One SGD step over a mini-batch, using each family's analytic
  // gradient rather than backprop (there's no hidden layer to chain
  // through — the whole model IS the formula).
  function paramTrainStep(model, points, norm, opts) {
    const spec = MODELS[model.modelKey];
    const n = model.params.length;
    const grads = new Array(n).fill(0);
    const batchSize = Math.max(1, Math.min(opts.batchSize, points.length));
    let totalLoss = 0, used = 0;
    for (let s = 0; s < batchSize; s++) {
      const sample = points[Math.floor(Math.random() * points.length)];
      const xNorm = sample.x / norm.xScale;
      const targetNorm = (sample.y - norm.yMean) / norm.yStd;
      const pred = spec.predict(xNorm, model.params);
      if (pred === null || !Number.isFinite(pred)) continue; // outside domain (log) — skip
      const g = spec.grad(xNorm, model.params);
      if (!g) continue;
      const err = pred - targetNorm;
      totalLoss += err * err;
      used++;
      for (let k = 0; k < n; k++) grads[k] += 2 * err * g[k];
    }
    const denom = used || 1;
    for (let k = 0; k < n; k++) model.params[k] -= opts.lr * (grads[k] / denom);
    return { mse: totalLoss / denom };
  }

  window.TeachAI = window.TeachAI || {};
  window.TeachAI.nn = {
    MODELS,
    createParamModel,
    paramPredict,
    paramDatasetMSE,
    paramTrainStep,
    OBJECTIVES,
    OBJECTIVES,
    parseParams,
    parseHiddenLayers,
    generateData,
    trueCurve,
    computeNormalization,
    createNetwork,
    forward,
    predict,
    datasetMSE,
    trainStep,
    gaussianNoise,
  };
})();
