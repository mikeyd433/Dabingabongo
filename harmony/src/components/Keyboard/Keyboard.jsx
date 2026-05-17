import React from 'react';
import { getOctaveKeys } from '../../utils/music.js';
import './Keyboard.css';

/**
 * One-octave virtual piano keyboard.
 * rootMidi determines which octave to display.
 * selectedKeys: Set of MIDI note numbers.
 * onKeyToggle: (midi) => void
 */
export default function Keyboard({ rootMidi, selectedKeys, onKeyToggle }) {
  const keys = rootMidi != null ? getOctaveKeys(rootMidi) : [];
  const whiteKeys = keys.filter(k => !k.isBlack);
  const blackKeys = keys.filter(k => k.isBlack);

  // Map chromatic index (0-11) to white-key position for absolute-positioning black keys
  // White key positions: C=0, D=1, E=2, F=3, G=4, A=5, B=6
  // Black keys: C#(1), D#(3), F#(6), G#(8), A#(10) → between whites 0-1, 1-2, 3-4, 4-5, 5-6
  const blackKeyPositions = {
    1: 0.6,   // C# between C(0) and D(1)
    3: 1.6,   // D# between D(1) and E(2)
    6: 3.6,   // F# between F(3) and G(4)
    8: 4.6,   // G# between G(4) and A(5)
    10: 5.6,  // A# between A(5) and B(6)
  };

  if (!rootMidi) {
    return (
      <div className="keyboard-placeholder">
        Set a root note to display keyboard
      </div>
    );
  }

  // Each white key is 40px wide, so total width = 7 * 40 = 280px
  const WHITE_KEY_WIDTH = 40;

  return (
    <div className="keyboard-wrapper">
      <div className="keyboard" aria-label="Virtual piano keyboard">
        {/* White keys */}
        {whiteKeys.map((key) => {
          const isRoot = key.midi === rootMidi;
          const isSelected = selectedKeys.has(key.midi);
          return (
            <button
              key={key.midi}
              className={`key white-key ${isRoot ? 'root' : ''} ${isSelected ? 'selected' : ''}`}
              onClick={() => {
                if (!isRoot) onKeyToggle(key.midi);
              }}
              aria-label={`${key.name}${isRoot ? ' (root)' : ''}`}
              aria-pressed={isSelected}
              title={key.name}
            >
              <span className="key-label">{key.name}</span>
            </button>
          );
        })}

        {/* Black keys (absolutely positioned) */}
        {blackKeys.map((key) => {
          const chromaticIdx = key.midi % 12;
          const posRatio = blackKeyPositions[chromaticIdx];
          if (posRatio === undefined) return null;
          const leftPx = posRatio * WHITE_KEY_WIDTH;
          const isSelected = selectedKeys.has(key.midi);

          return (
            <button
              key={key.midi}
              className={`key black-key ${isSelected ? 'selected' : ''}`}
              style={{ left: `${leftPx}px` }}
              onClick={() => onKeyToggle(key.midi)}
              aria-label={key.name}
              aria-pressed={isSelected}
              title={key.name}
            />
          );
        })}
      </div>

      <div className="keyboard-root-label">
        Root: {keys.find(k => k.midi === rootMidi)?.name ?? '—'}
      </div>
    </div>
  );
}
