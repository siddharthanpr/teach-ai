// Teach AI — Genetic Algorithm engine for the Sudoku playground.
(function () {
  "use strict";

  const PUZZLE = [
    [5,3,0,0,7,0,0,0,0],
    [6,0,0,1,9,5,0,0,0],
    [0,9,8,0,0,0,0,6,0],
    [8,0,0,0,6,0,0,0,3],
    [4,0,0,8,0,3,0,0,1],
    [7,0,0,0,2,0,0,0,6],
    [0,6,0,0,0,0,2,8,0],
    [0,0,0,4,1,9,0,0,5],
    [0,0,0,0,8,0,0,7,9]
  ];
  const MAX_FITNESS = 243;

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function randomIndividual() {
    const g = PUZZLE.map((r) => r.slice());
    for (let r = 0; r < 9; r++) {
      const present = new Set(g[r].filter((v) => v !== 0));
      const missing = shuffle([1,2,3,4,5,6,7,8,9].filter((v) => !present.has(v)));
      let k = 0;
      for (let c = 0; c < 9; c++) if (g[r][c] === 0) g[r][c] = missing[k++];
    }
    return g;
  }

  function fitness(g) {
    let score = 0;
    for (let r = 0; r < 9; r++) score += new Set(g[r]).size;
    for (let c = 0; c < 9; c++) {
      const s = new Set();
      for (let r = 0; r < 9; r++) s.add(g[r][c]);
      score += s.size;
    }
    for (let br = 0; br < 3; br++) {
      for (let bc = 0; bc < 3; bc++) {
        const s = new Set();
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) s.add(g[br * 3 + i][bc * 3 + j]);
        score += s.size;
      }
    }
    return score;
  }

  // How many duplicate-conflicts row r's own cells cause, via their column
  // and box memberships, within THIS grid. Lower = cleaner fit in context.
  function rowConflictScore(grid, r) {
    let conflicts = 0;
    for (let c = 0; c < 9; c++) {
      const v = grid[r][c];
      for (let i = 0; i < 9; i++) if (i !== r && grid[i][c] === v) conflicts++;
      const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
      for (let i = br; i < br + 3; i++) {
        for (let j = bc; j < bc + 3; j++) {
          if ((i !== r || j !== c) && grid[i][j] === v) conflicts++;
        }
      }
    }
    return conflicts;
  }
  // Same idea for column c: conflicts its cells cause via their row/box memberships.
  function colConflictScore(grid, c) {
    let conflicts = 0;
    for (let r = 0; r < 9; r++) {
      const v = grid[r][c];
      for (let j = 0; j < 9; j++) if (j !== c && grid[r][j] === v) conflicts++;
      const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
      for (let i = br; i < br + 3; i++) {
        for (let j = bc; j < bc + 3; j++) {
          if ((i !== r || j !== c) && grid[i][j] === v) conflicts++;
        }
      }
    }
    return conflicts;
  }

  // Fitness-guided crossover: for each row (or column), take it from
  // whichever parent has FEWER conflicts there — not a fixed parity
  // pattern. Returns the child plus a source map ('A'/'B' per index) so
  // callers can show which parent actually won each slot.
  function crossoverRows(a, b) {
    const child = [];
    const source = [];
    for (let r = 0; r < 9; r++) {
      const useA = rowConflictScore(a, r) <= rowConflictScore(b, r);
      child.push((useA ? a : b)[r].slice());
      source.push(useA ? "A" : "B");
    }
    return { child, source };
  }
  function crossoverCols(a, b) {
    const child = a.map((row) => row.slice());
    const source = [];
    for (let c = 0; c < 9; c++) {
      const useA = colConflictScore(a, c) <= colConflictScore(b, c);
      source.push(useA ? "A" : "B");
      if (!useA) for (let r = 0; r < 9; r++) child[r][c] = b[r][c];
    }
    return { child, source };
  }
  // "both": each crossover independently rolls rows-or-cols, rather than
  // mixing the two axes within a single child.
  function resolveCrossoverMethod(method) {
    if (method === "both") return Math.random() < 0.5 ? "rows" : "cols";
    return method;
  }
  function crossover(a, b, method) {
    return method === "cols" ? crossoverCols(a, b) : crossoverRows(a, b);
  }

  // One mutation roll per row: on a hit, swap two of that row's free cells.
  function mutate(grid, rate) {
    const g = grid.map((r) => r.slice());
    const rows = [];
    for (let r = 0; r < 9; r++) {
      if (Math.random() >= rate) continue;
      const free = [];
      for (let c = 0; c < 9; c++) if (PUZZLE[r][c] === 0) free.push(c);
      if (free.length < 2) continue;
      const a = free[Math.floor(Math.random() * free.length)];
      let b = free[Math.floor(Math.random() * free.length)];
      if (b === a) b = free[(free.indexOf(a) + 1) % free.length];
      [g[r][a], g[r][b]] = [g[r][b], g[r][a]];
      rows.push(r);
    }
    return { grid: g, rows };
  }

  // Actual greedy pick: the single fittest individual in the pool. The
  // pool isn't guaranteed sorted (buildSoftmaxPool draws in random order),
  // so this scans rather than assuming pool[0] is best.
  function selectGreedy(pool) {
    let best = pool[0];
    for (const ind of pool) if (ind.fitness > best.fitness) best = ind;
    return best;
  }

  // Builds the breeding pool with its OWN epsilon-greedy: for each of the
  // topCount slots, with probability topEpsilon fill it with a uniformly
  // random individual from the WHOLE population instead of the next-best
  // rank. topEpsilon=0 reduces to a strict top-N% cutoff. `population`
  // must already be sorted descending by fitness.
  function buildPool(population, topCount, topEpsilon) {
    const pool = [];
    for (let slot = 0; slot < topCount; slot++) {
      if (Math.random() < topEpsilon) {
        pool.push(population[Math.floor(Math.random() * population.length)]);
      } else {
        pool.push(population[slot]);
      }
    }
    return pool;
  }

  // Boltzmann/softmax draw: P(i) ∝ exp(fitness_i / temperature) over the
  // WHOLE population. Subtracts the max fitness before exponentiating for
  // numerical stability — doesn't change the distribution, just keeps
  // exp() from overflowing at low temperatures.
  function selectSoftmax(population, temperature) {
    const t = Math.max(0.01, temperature);
    let maxF = -Infinity;
    for (const ind of population) if (ind.fitness > maxF) maxF = ind.fitness;
    const weights = population.map((ind) => Math.exp((ind.fitness - maxF) / t));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < population.length; i++) {
      r -= weights[i];
      if (r <= 0) return population[i];
    }
    return population[population.length - 1];
  }

  // Builds the breeding pool by repeatedly softmax-drawing (with
  // replacement) from the WHOLE population, instead of a rank-based
  // cutoff. This is an ALTERNATIVE to buildPool()/topEpsilon above — pick
  // one pool-building method or the other, per poolMethod.
  function buildSoftmaxPool(population, topCount, temperature) {
    const pool = [];
    for (let slot = 0; slot < topCount; slot++) pool.push(selectSoftmax(population, temperature));
    return pool;
  }

  // Picks a parent FROM an already-built pool (whichever pool-building
  // method produced it — this stage doesn't care). This is a SEPARATE
  // softmax from buildSoftmaxPool's: its own selectionTemperature, applied
  // to whichever pool already exists, not the whole population.
  // "epsilon" — TRUE epsilon-greedy: with probability selectionEpsilon,
  // explore by picking uniformly at random from the pool; otherwise
  // (the "greedy" 1-ε branch) deterministically take the single fittest
  // individual in the pool. No randomness at all on the greedy branch.
  // "interleave" — deterministic round-robin through the pool, in the
  // order it was built.
  // "softmax" — Boltzmann pick within the pool, using selectionTemperature.
  function selectParent(pool, method, selectionEpsilon, selectionTemperature, cursor) {
    if (method === "interleave") {
      const ind = pool[cursor.i % pool.length];
      cursor.i += 1;
      return ind;
    }
    if (method === "softmax") {
      return selectSoftmax(pool, selectionTemperature);
    }
    if (Math.random() < selectionEpsilon) {
      return pool[Math.floor(Math.random() * pool.length)];
    }
    return selectGreedy(pool);
  }

  function makeIndividual(grid) {
    return { grid, fitness: fitness(grid) };
  }

  function initPopulation(size) {
    const pop = [];
    for (let i = 0; i < size; i++) pop.push(makeIndividual(randomIndividual()));
    pop.sort((a, b) => b.fitness - a.fitness);
    return pop;
  }

  function statsFor(pop, topNPercent) {
    const n = pop.length;
    const topCount = Math.max(1, Math.round((n * topNPercent) / 100));
    const avg = pop.reduce((s, i) => s + i.fitness, 0) / n;
    const topSlice = pop.slice(0, topCount);
    const topAvg = topSlice.reduce((s, i) => s + i.fitness, 0) / topCount;
    const topVariance = topSlice.reduce((s, i) => s + (i.fitness - topAvg) ** 2, 0) / topCount;
    const topStd = Math.sqrt(topVariance);
    return { avg, topN: topAvg, topNStd: topStd, best: pop[0].fitness };
  }

  function evolve(state, params) {
    const targetSize = state.population.length;
    const topCount = Math.max(2, Math.round((targetSize * params.topNPercent) / 100));
    // poolMethod: "topn" (rank-based, fuzzed by topEpsilon) or "softmax"
    // (drawn ∝ exp(fitness/topTemperature)) — two alternative ways to
    // build the SAME-sized pool.
    const pool = params.poolMethod === "softmax"
      ? buildSoftmaxPool(state.population, topCount, params.topTemperature)
      : buildPool(state.population, topCount, params.topEpsilon);

    const cursor = { i: 0 };
    const next = [makeIndividual(state.population[0].grid.map((r) => r.slice()))]; // elitism: keep the champion

    // Random injection: replace a share of each new generation with brand-new
    // random individuals instead of bred children — a cheap diversity boost
    // against premature convergence. Only fires every injectionInterval
    // generations (default 1 = every generation), not continuously.
    const newGenNumber = state.generation + 1;
    const interval = Math.max(1, params.injectionInterval || 1);
    const injectCount = newGenNumber % interval === 0
      ? Math.min(targetSize - 1, Math.round((targetSize * (params.injectionPercent || 0)) / 100))
      : 0;
    for (let i = 0; i < injectCount; i++) next.push(makeIndividual(randomIndividual()));

    while (next.length < targetSize) {
      const pa = selectParent(pool, params.selectionMethod, params.selectionEpsilon, params.selectionTemperature, cursor);
      const pb = selectParent(pool, params.selectionMethod, params.selectionEpsilon, params.selectionTemperature, cursor);
      const { child: crossedGrid } = crossover(pa.grid, pb.grid, resolveCrossoverMethod(params.crossoverMethod));
      const { grid } = mutate(crossedGrid, params.mutationRate);
      next.push(makeIndividual(grid));
    }
    next.sort((a, b) => b.fitness - a.fitness);
    state.population = next;
    state.generation += 1;
    const s = statsFor(next, params.topNPercent);
    state.history.push({ gen: state.generation, avg: s.avg, topN: s.topN, topNStd: s.topNStd, best: s.best });
    return s;
  }

  window.TeachAI = window.TeachAI || {};
  window.TeachAI.ga = {
    PUZZLE,
    MAX_FITNESS,
    randomIndividual,
    fitness,
    crossover,
    resolveCrossoverMethod,
    mutate,
    buildPool,
    buildSoftmaxPool,
    selectParent,
    selectSoftmax,
    makeIndividual,
    initPopulation,
    statsFor,
    evolve,
    shuffle,
  };
})();
