import React from 'react';
import { CHORD_CATEGORIES } from '../../data/chords.js';
import './ModeBar.css';

export default function ModeBar({
  mode,
  chordPreset,
  rootNote,
  onModeChange,
  onChordPresetChange,
}) {
  const handleModeChange = (newMode) => {
    if (newMode !== mode) {
      onModeChange(newMode);
    }
  };

  const handlePresetChange = (e) => {
    const val = e.target.value;
    if (val === '') {
      onChordPresetChange(null);
    } else {
      const [catIdx, chordIdx] = val.split(':').map(Number);
      const chord = CHORD_CATEGORIES[catIdx].chords[chordIdx];
      onChordPresetChange(chord);
    }
  };

  // Find current preset's value string for the select
  const currentPresetValue = chordPreset
    ? (() => {
        for (let ci = 0; ci < CHORD_CATEGORIES.length; ci++) {
          const chords = CHORD_CATEGORIES[ci].chords;
          for (let ch = 0; ch < chords.length; ch++) {
            if (chords[ch].name === chordPreset.name &&
                JSON.stringify(chords[ch].intervals) === JSON.stringify(chordPreset.intervals)) {
              return `${ci}:${ch}`;
            }
          }
        }
        return '';
      })()
    : '';

  return (
    <div className="mode-bar panel-card">
      {/* Mode Toggle */}
      <div className="mode-toggle-group">
        <button
          className={`mode-toggle-btn ${mode === 'interval' ? 'active' : ''}`}
          onClick={() => handleModeChange('interval')}
          aria-pressed={mode === 'interval'}
        >
          Interval Mode
        </button>
        <button
          className={`mode-toggle-btn ${mode === 'keyboard' ? 'active' : ''}`}
          onClick={() => handleModeChange('keyboard')}
          aria-pressed={mode === 'keyboard'}
        >
          Keyboard Mode
        </button>
      </div>

      {/* Chord Preset */}
      <div className="chord-preset-group">
        <label className="chord-preset-label">Chord Preset</label>
        <select
          className="chord-preset-select"
          value={currentPresetValue}
          onChange={handlePresetChange}
          disabled={!rootNote}
          title={!rootNote ? 'Set a root note first' : ''}
        >
          <option value="">— No Preset —</option>
          {CHORD_CATEGORIES.map((cat, ci) => (
            <optgroup key={cat.label} label={cat.label}>
              {cat.chords.map((chord, ch) => (
                <option key={`${ci}:${ch}`} value={`${ci}:${ch}`}>
                  {chord.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {!rootNote && (
          <span className="preset-hint">Set a root note to use presets</span>
        )}
      </div>
    </div>
  );
}
