/**
 * Chord definitions as semitone arrays from root.
 * Organized by category.
 */

export const CHORD_CATEGORIES = [
  {
    label: 'Triads',
    chords: [
      { name: 'Major', intervals: [0, 4, 7] },
      { name: 'Minor', intervals: [0, 3, 7] },
      { name: 'Diminished', intervals: [0, 3, 6] },
      { name: 'Augmented', intervals: [0, 4, 8] },
      { name: 'Sus2', intervals: [0, 2, 7] },
      { name: 'Sus4', intervals: [0, 5, 7] },
    ],
  },
  {
    label: '7ths',
    chords: [
      { name: 'Dominant 7', intervals: [0, 4, 7, 10] },
      { name: 'Major 7', intervals: [0, 4, 7, 11] },
      { name: 'Minor 7', intervals: [0, 3, 7, 10] },
      { name: 'Minor-Major 7', intervals: [0, 3, 7, 11] },
      { name: 'Diminished 7', intervals: [0, 3, 6, 9] },
      { name: 'Half-Diminished 7', intervals: [0, 3, 6, 10] },
      { name: 'Augmented 7', intervals: [0, 4, 8, 10] },
    ],
  },
  {
    label: '9ths',
    chords: [
      { name: 'Major 9', intervals: [0, 4, 7, 11, 14] },
      { name: 'Minor 9', intervals: [0, 3, 7, 10, 14] },
      { name: 'Dominant 9', intervals: [0, 4, 7, 10, 14] },
      { name: 'Add 9', intervals: [0, 4, 7, 14] },
      { name: 'Minor Add 9', intervals: [0, 3, 7, 14] },
    ],
  },
  {
    label: '11ths',
    chords: [
      { name: 'Major 11', intervals: [0, 4, 7, 11, 14, 17] },
      { name: 'Minor 11', intervals: [0, 3, 7, 10, 14, 17] },
      { name: 'Dominant 11', intervals: [0, 4, 7, 10, 14, 17] },
    ],
  },
  {
    label: '13ths',
    chords: [
      { name: 'Major 13', intervals: [0, 4, 7, 11, 14, 17, 21] },
      { name: 'Minor 13', intervals: [0, 3, 7, 10, 14, 17, 21] },
      { name: 'Dominant 13', intervals: [0, 4, 7, 10, 14, 17, 21] },
    ],
  },
  {
    label: 'Suspended',
    chords: [
      { name: 'Sus2', intervals: [0, 2, 7] },
      { name: 'Sus4', intervals: [0, 5, 7] },
      { name: '7sus2', intervals: [0, 2, 7, 10] },
      { name: '7sus4', intervals: [0, 5, 7, 10] },
    ],
  },
  {
    label: 'Altered',
    chords: [
      { name: '7b5', intervals: [0, 4, 6, 10] },
      { name: '7#5', intervals: [0, 4, 8, 10] },
      { name: '7b9', intervals: [0, 4, 7, 10, 13] },
      { name: '7#9', intervals: [0, 4, 7, 10, 15] },
      { name: '7#11', intervals: [0, 4, 7, 10, 14, 18] },
      { name: '7alt', intervals: [0, 4, 6, 10, 13, 15] },
    ],
  },
  {
    label: 'Power',
    chords: [
      { name: 'Power', intervals: [0, 7] },
      { name: 'Power+Octave', intervals: [0, 7, 12] },
    ],
  },
];

// Flat list for easy lookup
export const ALL_CHORDS = CHORD_CATEGORIES.flatMap(cat =>
  cat.chords.map(chord => ({ ...chord, category: cat.label }))
);
