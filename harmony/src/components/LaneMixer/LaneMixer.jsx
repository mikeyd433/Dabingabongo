import React from 'react';
import Lane from './Lane.jsx';
import Keyboard from '../Keyboard/Keyboard.jsx';
import './LaneMixer.css';

/**
 * LaneMixer renders the full lane area for both Interval Mode and Keyboard Mode.
 *
 * Props:
 *   mode: 'interval' | 'keyboard'
 *   lanes: array of lane objects
 *   rootMidi: number | null
 *   selectedKeys: Set<number>   (keyboard mode)
 *   chordPreset: chord | null
 *   audioReady: bool
 *   onFineTuneChange(id, cents)
 *   onVolumeChange(id, pct)
 *   onMuteToggle(id)
 *   onSoloToggle(id)
 *   onPlay(id)
 *   onKeyToggle(midi)           (keyboard mode)
 *   onClearChord()              (keyboard mode)
 */
export default function LaneMixer({
  mode,
  lanes,
  rootMidi,
  selectedKeys,
  chordPreset,
  audioReady,
  onFineTuneChange,
  onVolumeChange,
  onMuteToggle,
  onSoloToggle,
  onPlay,
  onKeyToggle,
  onClearChord,
}) {
  // Is any lane soloed?
  const isSoloed = lanes.some(l => l.soloed);

  return (
    <div className="lane-mixer panel-card">
      <div className="panel-title">
        {mode === 'interval' ? 'Harmony Lanes' : 'Keyboard Harmony'}
      </div>

      {mode === 'keyboard' && (
        <div className="keyboard-area">
          <Keyboard
            rootMidi={rootMidi}
            selectedKeys={selectedKeys}
            onKeyToggle={onKeyToggle}
          />
          <button
            className="clear-chord-btn btn-ghost"
            onClick={onClearChord}
            disabled={selectedKeys.size <= 1}
          >
            Clear Chord
          </button>
          {chordPreset && (
            <span className="active-preset-label">
              Active: {chordPreset.name}
            </span>
          )}
        </div>
      )}

      {lanes.length === 0 ? (
        <div className="lanes-empty">
          {mode === 'keyboard'
            ? 'Tap keys above to add harmony lanes'
            : 'No lanes loaded'}
        </div>
      ) : (
        <div className="lanes-list">
          {lanes.map(lane => (
            <Lane
              key={lane.id}
              lane={lane}
              isSoloed={isSoloed}
              audioReady={audioReady}
              onFineTuneChange={onFineTuneChange}
              onVolumeChange={onVolumeChange}
              onMuteToggle={onMuteToggle}
              onSoloToggle={onSoloToggle}
              onPlay={onPlay}
            />
          ))}
        </div>
      )}
    </div>
  );
}
