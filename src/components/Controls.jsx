import React from 'react'
import './Controls.css'

export default function Controls({
  isRunning,
  speed,
  onStart,
  onStop,
  onReset,
  onMutation,
  onSpeedChange
}) {
  return (
    <div className="controls-container">
      <h2>Controls</h2>

      <div className="button-group">
        {!isRunning ? (
          <button className="btn btn-primary" onClick={onStart}>
            ▶ Start Evolution
          </button>
        ) : (
          <button className="btn btn-danger" onClick={onStop}>
            ⏸ Stop
          </button>
        )}
        <button className="btn btn-secondary" onClick={onReset}>
          🔄 Reset
        </button>
      </div>

      <div className="button-group">
        <button className="btn btn-info" onClick={onMutation}>
          🧬 Test Mutation
        </button>
      </div>

      <div className="control-group">
        <label htmlFor="speed">Speed</label>
        <div className="speed-control">
          <input
            id="speed"
            type="range"
            min="1"
            max="100"
            value={speed}
            onChange={(e) => onSpeedChange(Number(e.target.value))}
            className="speed-slider"
          />
          <span className="speed-value">{speed}%</span>
        </div>
      </div>

      <div className="info-box">
        <h3>How it works</h3>
        <ul>
          <li><strong>Population:</strong> 100 individuals per generation</li>
          <li><strong>Fitness:</strong> Based on column & box uniqueness</li>
          <li><strong>Weaving:</strong> Animates every other row each generation</li>
          <li><strong>Mutation:</strong> Random swaps within rows</li>
          <li><strong>Goal:</strong> Reach fitness score of 243 (perfect)</li>
        </ul>
      </div>
    </div>
  );
}
