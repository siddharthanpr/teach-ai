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

  function crossoverRows(a, b) {
    return a.map((row, i) => (i % 2 === 0 ? row.slice() : b[i].slice()));
  }
  function crossoverCols(a, b) {
    const child = a.map((row) => row.slice());
    for (let j = 1; j < 9; j += 2) for (let i = 0; i < 9; i++) child[i][j] = b[i][j];
    return child;
  }
  function crossover(a, b, method) {
    return method === "cols" ? crossoverCols(a, b) : crossoverRows(a, b);
  }

  function mutate(grid, rate) {
    const g = grid.map((r) => r.slice());
    const rows = [];
    for (let r = 0; r < 9; r++) {
      if (Math.random() < rate) {
        const free = [];
        for (let c = 0; c < 9; c++) if (PUZZLE[r][c] === 0) free.push(c);
        if (free.length >= 2) {
          const a = free[Math.floor(Math.random() * free.length)];
          let b = free[Math.floor(Math.random() * free.length)];
          if (b === a) b = free[(free.indexOf(a) + 1) % free.length];
          [g[r][a], g[r][b]] = [g[r][b], g[r][a]];
          rows.push(r);
        }
      }
    }
    return { grid: g, rows };
  }

  function selectFitnessProportional(pool) {
    const total = pool.reduce((s, ind) => s + ind.fitness, 0);
    let r = Math.random() * total;
    for (const ind of pool) {
      r -= ind.fitness;
      if (r <= 0) return ind;
    }
    return pool[pool.length - 1];
  }

  function selectParent(pool, method, epsilon) {
    if (method === "epsilon" && Math.random() < epsilon) {
      return pool[Math.floor(Math.random() * pool.length)];
    }
    return selectFitnessProportional(pool);
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
    const topAvg = pop.slice(0, topCount).reduce((s, i) => s + i.fitness, 0) / topCount;
    return { avg, topN: topAvg, best: pop[0].fitness };
  }

  function evolve(state, params) {
    const targetSize = state.population.length;
    const topCount = Math.max(2, Math.round((targetSize * params.topNPercent) / 100));
    const pool = state.population.slice(0, topCount);

    const next = [makeIndividual(state.population[0].grid.map((r) => r.slice()))];
    while (next.length < targetSize) {
      const pa = selectParent(pool, params.selectionMethod, params.epsilon);
      const pb = selectParent(pool, params.selectionMethod, params.epsilon);
      const crossed = crossover(pa.grid, pb.grid, params.crossoverMethod);
      const { grid } = mutate(crossed, params.mutationRate);
      next.push(makeIndividual(grid));
    }
    next.sort((a, b) => b.fitness - a.fitness);
    state.population = next;
    state.generation += 1;
    const s = statsFor(next, params.topNPercent);
    state.history.push({ gen: state.generation, avg: s.avg, topN: s.topN, best: s.best });
    return s;
  }

  window.TeachAI = window.TeachAI || {};
  window.TeachAI.ga = {
    PUZZLE,
    MAX_FITNESS,
    randomIndividual,
    fitness,
    crossover,
    mutate,
    selectParent,
    makeIndividual,
    initPopulation,
    statsFor,
    evolve,
    shuffle,
  };
})();
