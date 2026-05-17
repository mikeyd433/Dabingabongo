# Harmony Helper — SPEC.md

## Overview

A browser-based vocal harmony tool hosted at `dabingabongo.com/harmony`. The user records or uploads a vocal clip, sets a root note, then generates pitch-shifted copies of that clip across harmony intervals or custom chord shapes. The goal is to hear what each harmony note sounds like so the user can match it with their own voice. There is no audio export, no backend, and no session persistence.

## Stack

| Concern | Choice |
|---|---|
| Framework | React (functional components + hooks) |
| Build tool | Vite |
| Pitch shifting | Tone.js — `PitchShift` effect node (phase vocoder) |
| Pitch detection | pitchy — McLeod pitch method |
| Audio recording | Browser MediaRecorder API |
| Styling | plain CSS — no UI component library |

## Application Structure

harmony/
├── index.html
├── vite.config.js
├── package.json
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── App.css
    ├── components/
    │   ├── SourcePanel/
    │   │   ├── SourcePanel.jsx
    │   │   └── SourcePanel.css
    │   ├── ModeBar/
    │   │   ├── ModeBar.jsx
    │   │   └── ModeBar.css
    │   ├── Keyboard/
    │   │   ├── Keyboard.jsx
    │   │   └── Keyboard.css
    │   ├── LaneMixer/
    │   │   ├── LaneMixer.jsx
    │   │   ├── Lane.jsx
    │   │   └── LaneMixer.css
    │   └── Transport/
    │       ├── Transport.jsx
    │       └── Transport.css
    ├── hooks/
    │   ├── useAudioEngine.js
    │   ├── usePitchDetection.js
    │   └── useMediaRecorder.js
    ├── data/
    │   └── chords.js
    └── utils/
        └── music.js

## Page Layout

Single scrollable page. Sections stack vertically:
1. Source Panel — load audio, view waveform, set root note
2. Mode Bar — mode toggle + chord preset dropdown
3. Lane Area — Interval Mode lanes or Keyboard + Keyboard Mode lanes
4. Transport Bar — playback controls, fixed to bottom of viewport

## Section 1: Source Panel

### Audio Loading

Two mutually exclusive input methods:

**Upload**
- Drag-and-drop zone or click-to-browse file picker
- Accepts: `audio/*` (mp3, wav, ogg, m4a, webm, flac)
- On file select: decode via Web Audio API `AudioContext.decodeAudioData()`

**Record**
- "Record" button triggers `getUserMedia({ audio: true })`
- While recording: button label changes to "Stop", shows animated indicator
- On stop: `MediaRecorder` blob is decoded the same way as an uploaded file
- Microphone stream is stopped and released after recording ends

### Waveform Display

- Rendered on an HTML `<canvas>` element once audio is decoded
- Draws peak amplitude per pixel column from the decoded `AudioBuffer`
- Read-only — no trimming or playhead, purely visual reference
- Hidden / shows placeholder text before audio is loaded

### Root Note

Two sub-modes, toggled by a small switch or button pair:

**Auto-Detect**
- Runs `pitchy` on the decoded audio buffer after loading
- Analyzes a representative slice of the audio (middle third of the buffer)
- Displays the detected note name + octave (e.g. "E3") and a confidence percentage
- If confidence is below ~80%, shows a warning and suggests switching to manual
- User can override the detected note using the manual picker even when in auto mode

**Manual Picker**
- Dropdown selector of all notes C2–C6 in chromatic order
- Default: C3
- Selecting a note immediately updates the root used for all shift calculations

The root note is the anchor for all pitch shift math.

## Section 2: Mode Bar

### Mode Toggle

Two-state toggle: **Interval Mode** | **Keyboard Mode**

- Switching modes clears all current lanes (except root) and resets chord preset to "— No Preset —"
- Default: Interval Mode

### Chord Preset Dropdown

- Default: "— No Preset —"
- Selecting a preset replaces all lanes with the chord's intervals
- In Keyboard Mode: corresponding keys highlight
- If user manually changes notes after preset, dropdown resets to "— No Preset —"
- Chords stored as semitone arrays from root

Categories:
```
Triads: Major [0,4,7], Minor [0,3,7], Diminished [0,3,6], Augmented [0,4,8], Sus2 [0,2,7], Sus4 [0,5,7]
7ths: Dominant 7 [0,4,7,10], Major 7 [0,4,7,11], Minor 7 [0,3,7,10], Minor-Major 7 [0,3,7,11], Diminished 7 [0,3,6,9], Half-Diminished 7 [0,3,6,10], Augmented 7 [0,4,8,10]
9ths: Major 9 [0,4,7,11,14], Minor 9 [0,3,7,10,14], Dominant 9 [0,4,7,10,14], Add 9 [0,4,7,14], Minor Add 9 [0,3,7,14]
11ths: Major 11 [0,4,7,11,14,17], Minor 11 [0,3,7,10,14,17], Dominant 11 [0,4,7,10,14,17]
13ths: Major 13 [0,4,7,11,14,17,21], Minor 13 [0,3,7,10,14,17,21], Dominant 13 [0,4,7,10,14,17,21]
Suspended: Sus2 [0,2,7], Sus4 [0,5,7], 7sus2 [0,2,7,10], 7sus4 [0,5,7,10]
Altered: 7b5 [0,4,6,10], 7#5 [0,4,8,10], 7b9 [0,4,7,10,13], 7#9 [0,4,7,10,15], 7#11 [0,4,7,10,14,18], 7alt [0,4,6,10,13,15]
Power: Power [0,7], Power+Octave [0,7,12]
```

## Section 3: Lane Area

### Interval Mode

16 fixed lanes, always rendered:
| Lane Label | Semitones |
|---|---|
| Root | 0 |
| Minor 2nd | +1 |
| Major 2nd | +2 |
| Minor 3rd | +3 |
| Major 3rd | +4 |
| Perfect 4th | +5 |
| Tritone | +6 |
| Perfect 5th | +7 |
| Minor 6th | +8 |
| Major 6th | +9 |
| Minor 7th | +10 |
| Major 7th | +11 |
| Octave Up | +12 |
| Octave Down | -12 |
| Custom A | user-defined (-24 to +24) |
| Custom B | user-defined (-24 to +24) |

When chord preset applied, lanes in the preset are highlighted/activated; others are dimmed but still accessible.

### Keyboard Mode

**Virtual Keyboard**
- One octave of piano keys (12 keys: 7 white, 5 black)
- Centered on root note
- Root key always highlighted, cannot be deselected
- Tapping a key toggles it selected/deselected
- Chord preset highlights corresponding keys

**Lane Generation**
- One lane per selected key (including root)
- Deselecting a key removes its lane
- "Clear Chord" button resets to root only
- Lane order: pitch order (lowest to highest)

## Section 4: Lane Controls (Both Modes)

Every lane has:

### Lane Header
- Interval Mode: Interval name + semitone label (e.g. "Perfect 5th +7 st")
- Keyboard Mode: Note name + octave + semitone label (e.g. "G3 +7 st")

### Controls
| Control | Type | Range | Notes |
|---|---|---|---|
| Fine-tune | Slider | ±50 cents | Applied on top of semitone shift |
| Volume | Slider | 0–100% | Per-lane gain |
| Mute | Toggle button | on/off | Silences this lane during Play All |
| Solo | Toggle button | on/off | Only this lane plays. One at a time. |
| Play | Button | — | One-shot playback of this lane only |

### Solo/Mute Interaction
- Solo overrides mute
- Only one lane soloed at a time
- Releasing solo returns to normal mix

## Section 5: Transport Bar

Fixed to bottom of viewport.
| Control | Behavior |
|---|---|
| Play All | Starts all non-muted lanes. Solo overrides. Restarts if already playing. |
| Stop | Stops all playback immediately. |
| Loop | Toggle. Default: on. |

## Audio Engine

### Tone.js Architecture

Each lane signal chain:
```
AudioBuffer (shared)
    └── Tone.js Player
        └── PitchShift (semitones + cents)
            └── Volume (gain)
                └── Tone.Destination
```

- `PitchShift.pitch` = lane semitones
- `PitchShift.detune` = fine-tune cents (-50 to +50)  
  NOTE: Tone.js PitchShift doesn't have a `detune` property. Instead, represent fine-tune as fractional semitones: `PitchShift.pitch = semitones + (fineTuneCents / 100)`. Update this in real time when the fine-tune slider moves.
- `Volume.volume` = per-lane dB (converted from 0–100% linear)
- Muted lanes: `Volume.volume = -Infinity`

### Node Lifecycle
- Created when audio loaded and lanes initialized
- Keyboard mode: nodes created/disposed as keys are selected/deselected
- Stop: Players stopped, nodes NOT disposed
- Mode switch / clear chord: dispose and rebuild
- New audio load: dispose and rebuild

### Playback
- Use `Player.start()` / `Player.stop()` directly (no Transport needed)
- All Play All lanes started in same JS tick

## Pitch Detection

```js
import { PitchDetector } from 'pitchy';

function detectPitch(audioBuffer, sampleRate) {
  const data = audioBuffer.getChannelData(0);
  const start = Math.floor(data.length / 3);
  const slice = data.slice(start, start + 2048);
  const detector = PitchDetector.forFloat32Array(slice.length);
  const [pitch, clarity] = detector.findPitch(slice, sampleRate);
  return { frequency: pitch, confidence: clarity };
}
```

## Music Utilities (src/utils/music.js)

```js
export const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
export function midiToLabel(midi) { ... }
export function labelToMidi(label) { ... }
export function semitoneDelta(rootMidi, targetMidi) { ... }
export function getOctaveKeys(rootMidi) { ... }  // returns array of {midi, name, isBlack}
export function linearToDb(linear) { ... }  // 0–1 → dB, 0 → -Infinity
```

## State Shape

Top-level state in App.jsx:
```js
{
  audioBuffer: null,
  rootNote: null,  // { label: 'E3', midi: 52 }
  rootNoteMode: 'auto',  // 'auto' | 'manual'
  detectedNote: null,  // { label, midi, confidence }
  mode: 'interval',  // 'interval' | 'keyboard'
  chordPreset: null,
  selectedKeys: new Set(),  // MIDI note numbers (keyboard mode)
  lanes: [],
  isPlaying: false,
  loop: true,
}
```

## Edge Cases
- No audio loaded: Play All disabled
- User switches mode while playing: stop, switch, clear
- New audio loaded while playing: stop, dispose, decode, rebuild
- Fine-tune/volume moved while playing: update in real time (no restart)
- Chord preset with no root note: disable preset dropdown

## Important Implementation Notes
- Call `await Tone.start()` inside a user gesture handler before any audio plays
- Get audio context via `Tone.getContext().rawContext` for `decodeAudioData`
- `pitchy` expects Float32Array — pass `audioBuffer.getChannelData(0)`
- Virtual keyboard: CSS layout (white keys flex row, black keys absolutely positioned) — no third-party piano
- Dispose Tone.js nodes with `.dispose()` to avoid memory leaks
