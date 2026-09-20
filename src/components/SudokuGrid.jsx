import React from 'react'
import './SudokuGrid.css'

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

export default function SudokuGrid({ grid, animatingRows, mutatingCells }) {
  const isMutating = (row, col) => {
    return mutatingCells.some(m => m.row === row && (m.col1 === col || m.col2 === col));
  };

  const isAnimating = (row) => {
    return animatingRows.has(row);
  };

  const isOriginal = (row, col) => {
    return SAMPLE_PUZZLE[row][col] !== 0;
  };

  return (
    <div className="sudoku-grid-container">
      <div className="sudoku-grid">
        {grid.map((row, rowIdx) => (
          <div
            key={rowIdx}
            className={`sudoku-row ${isAnimating(rowIdx) ? 'animating' : ''}`}
          >
            {row.map((cell, colIdx) => (
              <div
                key={`${rowIdx}-${colIdx}`}
                className={`sudoku-cell ${isOriginal(rowIdx, colIdx) ? 'original' : 'filled'} ${
                  isMutating(rowIdx, colIdx) ? 'mutating' : ''
                }`}
              >
                {cell}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="legend">
        <div className="legend-item">
          <div className="legend-box original-box"></div>
          <span>Original (fixed)</span>
        </div>
        <div className="legend-item">
          <div className="legend-box filled-box"></div>
          <span>Filled by GA</span>
        </div>
        <div className="legend-item">
          <div className="legend-box animating-box"></div>
          <span>Weaving animation</span>
        </div>
        <div className="legend-item">
          <div className="legend-box mutating-box"></div>
          <span>Mutation swap</span>
        </div>
      </div>
    </div>
  );
}
