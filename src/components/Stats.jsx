import React from 'react'
import './Stats.css'

export default function Stats({ stats }) {
  const fitnessPercent = (stats.fitness / 243) * 100;

  return (
    <div className="stats-container">
      <h2>Evolution Statistics</h2>

      <div className="stat-item">
        <label>Generation</label>
        <div className="stat-value">{stats.generation}</div>
      </div>

      <div className="stat-item">
        <label>Best Fitness</label>
        <div className="stat-value">{stats.fitness}/243</div>
        <div className="fitness-bar">
          <div className="fitness-fill" style={{ width: `${fitnessPercent}%` }}></div>
        </div>
        <div className="fitness-percent">{fitnessPercent.toFixed(1)}%</div>
      </div>

      <div className="stat-item">
        <label>Average Fitness</label>
        <div className="stat-value">{stats.avgFitness}</div>
      </div>

      <div className={`stat-item solve-status ${stats.isSolved ? 'solved' : ''}`}>
        <label>Status</label>
        <div className="stat-value">
          {stats.isSolved ? '✓ SOLVED!' : 'In Progress'}
        </div>
      </div>
    </div>
  );
}
