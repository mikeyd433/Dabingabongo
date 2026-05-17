export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Convert a MIDI note number to a label like "E3"
 */
export function midiToLabel(midi) {
  const octave = Math.floor(midi / 12) - 1;
  const name = NOTE_NAMES[midi % 12];
  return `${name}${octave}`;
}

/**
 * Convert a label like "E3" to a MIDI note number
 */
export function labelToMidi(label) {
  const match = label.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) return null;
  const [, name, octave] = match;
  const noteIndex = NOTE_NAMES.indexOf(name);
  if (noteIndex === -1) return null;
  return noteIndex + (parseInt(octave, 10) + 1) * 12;
}

/**
 * Get semitone delta from rootMidi to targetMidi
 */
export function semitoneDelta(rootMidi, targetMidi) {
  return targetMidi - rootMidi;
}

/**
 * Returns array of {midi, name, isBlack} for one octave centered on rootMidi.
 * Returns 12 keys starting from the root's octave C.
 */
export function getOctaveKeys(rootMidi) {
  // Start from the C of the root's octave
  const octave = Math.floor(rootMidi / 12) - 1;
  const cMidi = (octave + 1) * 12; // C of that octave
  const blackKeys = new Set([1, 3, 6, 8, 10]); // C#, D#, F#, G#, A#
  const keys = [];
  for (let i = 0; i < 12; i++) {
    const midi = cMidi + i;
    keys.push({
      midi,
      name: midiToLabel(midi),
      isBlack: blackKeys.has(i),
    });
  }
  return keys;
}

/**
 * Convert linear volume (0-1) to dB.
 * 0 → -Infinity, 1 → 0 dB
 */
export function linearToDb(linear) {
  if (linear <= 0) return -Infinity;
  return 20 * Math.log10(linear);
}

/**
 * Frequency in Hz to MIDI note number (float)
 */
export function freqToMidi(freq) {
  return 69 + 12 * Math.log2(freq / 440);
}

/**
 * Frequency in Hz to nearest note label and cents deviation
 */
export function freqToNote(freq) {
  if (!freq || freq <= 0) return null;
  const midiFloat = freqToMidi(freq);
  const midiRound = Math.round(midiFloat);
  const cents = Math.round((midiFloat - midiRound) * 100);
  return {
    midi: midiRound,
    label: midiToLabel(midiRound),
    cents,
  };
}

/**
 * All notes from C2 to C6 as {label, midi} for manual picker
 */
export function getPickerNotes() {
  const notes = [];
  for (let midi = labelToMidi('C2'); midi <= labelToMidi('C6'); midi++) {
    notes.push({ label: midiToLabel(midi), midi });
  }
  return notes;
}
