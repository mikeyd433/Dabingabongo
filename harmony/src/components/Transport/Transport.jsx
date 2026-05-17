import React from 'react';
import './Transport.css';

export default function Transport({
  isPlaying,
  loop,
  audioReady,
  onPlayAll,
  onStop,
  onLoopToggle,
}) {
  return (
    <div className="transport-bar">
      <div className="transport-inner">
        <button
          className="transport-btn play-all-btn"
          onClick={onPlayAll}
          disabled={!audioReady}
          aria-label="Play all lanes"
        >
          {isPlaying ? (
            <><span className="transport-icon">↺</span> Restart</>
          ) : (
            <><span className="transport-icon">▶</span> Play All</>
          )}
        </button>

        <button
          className="transport-btn stop-btn"
          onClick={onStop}
          disabled={!isPlaying}
          aria-label="Stop playback"
        >
          <span className="transport-icon">■</span> Stop
        </button>

        <button
          className={`transport-btn loop-btn ${loop ? 'active' : ''}`}
          onClick={onLoopToggle}
          aria-pressed={loop}
          aria-label={`Loop ${loop ? 'on' : 'off'}`}
        >
          <span className="transport-icon">↻</span>
          Loop {loop ? 'ON' : 'OFF'}
        </button>

        {isPlaying && (
          <div className="playing-indicator">
            <span className="playing-dot" />
            Playing
          </div>
        )}
      </div>
    </div>
  );
}
