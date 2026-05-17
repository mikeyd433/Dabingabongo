import React, { useCallback } from 'react';

/**
 * Single lane row with controls.
 *
 * Props:
 *   lane: { id, label, semitones, fineTune, volume, muted, soloed }
 *   isSoloed: bool (any lane is soloed)
 *   onFineTuneChange(id, cents)
 *   onVolumeChange(id, pct)
 *   onMuteToggle(id)
 *   onSoloToggle(id)
 *   onPlay(id)
 *   audioReady: bool
 */
export default function Lane({
  lane,
  isSoloed,
  onFineTuneChange,
  onVolumeChange,
  onMuteToggle,
  onSoloToggle,
  onPlay,
  audioReady,
}) {
  const isEffectivelyMuted =
    !lane.soloed && isSoloed
      ? true
      : lane.muted && !lane.soloed;

  const handleFineTune = useCallback(
    (e) => onFineTuneChange(lane.id, Number(e.target.value)),
    [lane.id, onFineTuneChange]
  );

  const handleVolume = useCallback(
    (e) => onVolumeChange(lane.id, Number(e.target.value)),
    [lane.id, onVolumeChange]
  );

  return (
    <div className={`lane ${isEffectivelyMuted ? 'lane-muted' : ''} ${lane.soloed ? 'lane-soloed' : ''}`}>
      {/* Header */}
      <div className="lane-header">
        <span className="lane-label">{lane.label}</span>
        <span className="lane-semitones">
          {lane.semitones > 0 ? `+${lane.semitones}` : lane.semitones} st
        </span>
      </div>

      {/* Controls */}
      <div className="lane-controls">
        {/* Fine-tune */}
        <div className="lane-control-group">
          <label className="control-label">Fine</label>
          <div className="slider-row">
            <input
              type="range"
              min={-50}
              max={50}
              step={1}
              value={lane.fineTune}
              onChange={handleFineTune}
              aria-label={`Fine tune for ${lane.label}`}
            />
            <span className="slider-value">
              {lane.fineTune > 0 ? `+${lane.fineTune}` : lane.fineTune}¢
            </span>
          </div>
        </div>

        {/* Volume */}
        <div className="lane-control-group">
          <label className="control-label">Vol</label>
          <div className="slider-row">
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={lane.volume}
              onChange={handleVolume}
              aria-label={`Volume for ${lane.label}`}
            />
            <span className="slider-value">{lane.volume}%</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="lane-buttons">
          <button
            className={`lane-btn mute-btn ${lane.muted ? 'active' : ''}`}
            onClick={() => onMuteToggle(lane.id)}
            aria-pressed={lane.muted}
            aria-label={`${lane.muted ? 'Unmute' : 'Mute'} ${lane.label}`}
          >
            M
          </button>
          <button
            className={`lane-btn solo-btn ${lane.soloed ? 'active' : ''}`}
            onClick={() => onSoloToggle(lane.id)}
            aria-pressed={lane.soloed}
            aria-label={`${lane.soloed ? 'Unsolo' : 'Solo'} ${lane.label}`}
          >
            S
          </button>
          <button
            className="lane-btn play-btn"
            onClick={() => onPlay(lane.id)}
            disabled={!audioReady}
            aria-label={`Play ${lane.label}`}
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  );
}
