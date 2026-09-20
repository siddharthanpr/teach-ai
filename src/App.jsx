import React, { useState, useEffect } from 'react'
import SudokuGrid from './components/SudokuGrid'
import Stats from './components/Stats'
import Controls from './components/Controls'
import { SudokuGA } from './sudokuGA'
import './App.css'

const SAMPLE_PUZZLE = [
  [5, 3, 0, 0, 7, 0, 0, 0, 0],
  [6, 0, 0, 1, 9, 5, 0, 0, 0],
  [0, 9, 8, 0, 0, 0, 0, 6, 0],
  [8, 0, 0, 0, 6, 0, 0, 0, 3],
  [4, 0, 0, 8, 0, 3, 0, 0, 1],
  [7, 0, 0, 0, 2, 0, 0, 0, 6],
  [0, 6, 0, 0, 0, 0, 2, 8, 0],
  [0, 0, 0, 4, 1, 9, 0, 0, 5],
  [0, 0, 0, 0, 8, 0, 0, 7, 9]
];

export default function App() {
  const [ga, setGA] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(100);
  const [currentGrid, setCurrentGrid] = useState(SAMPLE_PUZZLE);
  const [animatingRows, setAnimatingRows] = useState(new Set());
  const [mutatingCells, setMutatingCells] = useState([]);
  const [stats, setStats] = useState({
    generation: 0,
    fitness: 0,
    avgFitness: 0,
    isSolved: false
  });

  useEffect(() => {
    const newGA = new SudokuGA(SAMPLE_PUZZLE);
    setGA(newGA);
    setCurrentGrid(newGA.population[0]);
  }, []);

  useEffect(() => {
    if (!isRunning || !ga) return;

    const interval = setInterval(() => {
      ga.evolve();
      setCurrentGrid(ga.getBestSolution());

      const avgFitness = ga.population.reduce((sum, ind) => sum + ind.fitness, 0) / ga.population.length;
      setStats({
        generation: ga.generation,
        fitness: ga.bestFitness,
        avgFitness: avgFitness.toFixed(2),
        isSolved: ga.isSolved()
      });

      animateWeavingRows();

      if (ga.isSolved()) {
        setIsRunning(false);
      }
    }, 101 - speed);

    return () => clearInterval(interval);
  }, [isRunning, ga, speed]);

  const animateWeavingRows = () => {
    const rows = new Set();
    for (let i = 0; i < 9; i += 2) {
      rows.add(i);
    }
    setAnimatingRows(rows);

    setTimeout(() => {
      setAnimatingRows(new Set());
    }, 200);
  };

  const handleMutation = () => {
    if (!ga) return;

    const mutations = [];
    for (let row = 0; row < 9; row++) {
      if (Math.random() < 0.3) {
        const emptyIndices = [];
        for (let col = 0; col < 9; col++) {
          if (SAMPLE_PUZZLE[row][col] === 0) {
            emptyIndices.push(col);
          }
        }
        if (emptyIndices.length >= 2) {
          const idx1 = Math.floor(Math.random() * emptyIndices.length);
          const idx2 = Math.floor(Math.random() * emptyIndices.length);
          mutations.push({ row, col1: emptyIndices[idx1], col2: emptyIndices[idx2] });
        }
      }
    }

    setMutatingCells(mutations);
    setTimeout(() => setMutatingCells([]), 300);
  };

  const handleStart = () => {
    setIsRunning(true);
  };

  const handleStop = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    const newGA = new SudokuGA(SAMPLE_PUZZLE);
    setGA(newGA);
    setCurrentGrid(newGA.population[0]);
    setIsRunning(false);
    setStats({
      generation: 0,
      fitness: 0,
      avgFitness: 0,
      isSolved: false
    });
  };

  return (
    <div className="app-container">
      <div className="app-header">
        <h1>🧬 Sudoku Genetic Algorithm Solver</h1>
        <p className="subtitle">Visualizing evolution with animated row weaving and mutations</p>
      </div>

      <div className="app-content">
        <div className="grid-section">
          <SudokuGrid
            grid={currentGrid}
            animatingRows={animatingRows}
            mutatingCells={mutatingCells}
          />
        </div>

        <div className="control-section">
          <Stats stats={stats} />
          <Controls
            isRunning={isRunning}
            speed={speed}
            onStart={handleStart}
            onStop={handleStop}
            onReset={handleReset}
            onMutation={handleMutation}
            onSpeedChange={setSpeed}
          />
        </div>
      </div>
    </div>
  );
}
