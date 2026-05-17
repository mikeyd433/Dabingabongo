import React, { useState, useEffect, useCallback, useRef } from 'react';
import SourcePanel from './components/SourcePanel/SourcePanel.jsx';
import ModeBar from './components/ModeBar/ModeBar.jsx';
import LaneMixer from './components/LaneMixer/LaneMixer.jsx';
import Transport from './components/Transport/Transport.jsx';
import { useAudioEngine } from './hooks/useAudioEngine.js';
import { usePitchDetection } from './hooks/usePitchDetection.js';
import { midiToLabel, getOctaveKeys, semitoneDelta } from './utils/music.js';

// ──────────────────────────────────────────────
// Interval Mode lane definitions
// ──────────────────────────────────────────────
const INTERVAL_LANES_TEMPLATE = [
  { id: 'root',    label: 'Root',         semitones: 0   },
  { id: 'min2',   label: 'Minor 2nd',    semitones: 1   },
  { id: 'maj2',   label: 'Major 2nd',    semitones: 2   },
  { id: 'min3',   label: 'Minor 3rd',    semitones: 3   },
  { id: 'maj3',   label: 'Major 3rd',    semitones: 4   },
  { id: 'p4',     label: 'Perfect 4th',  semitones: 5   },
  { id: 'tritone',label: 'Tritone',      semitones: 6   },
  { id: 'p5',     label: 'Perfect 5th',  semitones: 7   },
  { id: 'min6',   label: 'Minor 6th',    semitones: 8   },
  { id: 'maj6',   label: 'Major 6th',    semitones: 9   },
  { id: 'min7',   label: 'Minor 7th',    semitones: 10  },
  { id: 'maj7',   label: 'Major 7th',    semitones: 11  },
  { id: 'oct_up', label: 'Octave Up',    semitones: 12  },
  { id: 'oct_dn', label: 'Octave Down',  semitones: -12 },
  { id: 'customA',label: 'Custom A',     semitones: 0, isCustom: true },
  { id: 'customB',label: 'Custom B',     semitones: 0, isCustom: true },
];

function makeLane(template) {
  return {
    ...template,
    fineTune: 0,
    volume: 80,
    muted: false,
    soloed: false,
  };
}

function buildIntervalLanes() {
  return INTERVAL_LANES_TEMPLATE.map(makeLane);
}

function buildKeyboardLanes(selectedKeys, rootMidi) {
  if (!rootMidi) return [];
  return [...selectedKeys]
    .sort((a, b) => a - b)
    .map(midi => ({
      id: `key_${midi}`,
      label: midiToLabel(midi),
      semitones: semitoneDelta(rootMidi, midi),
      fineTune: 0,
      volume: 80,
      muted: false,
      soloed: false,
    }));
}

const DEFAULT_ROOT_MIDI = 48; // C3

export default function App() {
  // ── Core state ──
  const [audioBuffer, setAudioBuffer] = useState(null);
  const [rootNote, setRootNote] = useState(null);
  const [rootNoteMode, setRootNoteMode] = useState('auto');
  const [detectedNote, setDetectedNote] = useState(null);
  const [mode, setMode] = useState('interval');
  const [chordPreset, setChordPreset] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [lanes, setLanes] = useState(buildIntervalLanes);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loop, setLoop] = useState(true);

  // ── Engine & detection ──
  const engine = useAudioEngine();
  const { detectPitch } = usePitchDetection();

  // Rebuild engine nodes whenever lanes or audioBuffer change
  const rebuildNodes = useCallback((currentLanes) => {
    engine.buildNodes(currentLanes);
    engine.setLoop(loop);
  }, [engine, loop]);

  // ── Handle new audio loaded ──
  const handleAudioLoad = useCallback(async (buffer) => {
    // Stop & dispose old nodes
    engine.stopAll();
    engine.disposeAll();
    setIsPlaying(false);

    setAudioBuffer(buffer);
    engine.setAudioBuffer(buffer);

    // Auto-detect pitch
    const result = detectPitch(buffer);
    setDetectedNote(result);

    if (result) {
      const note = { label: result.label, midi: result.midi };
      setRootNote(note);
      // Rebuild keyboard selection around new root
      if (mode === 'keyboard') {
        const newKeys = new Set([result.midi]);
        setSelectedKeys(newKeys);
        const newLanes = buildKeyboardLanes(newKeys, result.midi);
        setLanes(newLanes);
        engine.buildNodes(newLanes);
      } else {
        // Rebuild with same interval lanes (audio changed)
        setLanes(prev => {
          engine.buildNodes(prev);
          return prev;
        });
      }
    } else {
      // No detection: default root
      const defaultNote = { label: midiToLabel(DEFAULT_ROOT_MIDI), midi: DEFAULT_ROOT_MIDI };
      if (!rootNote) setRootNote(defaultNote);
      setLanes(prev => {
        engine.buildNodes(prev);
        return prev;
      });
    }
  }, [engine, detectPitch, mode, rootNote]);

  // ── Root note changes ──
  const handleRootNoteChange = useCallback((note) => {
    setRootNote(note);
    setChordPreset(null); // reset preset on manual root change
    if (mode === 'keyboard') {
      // Re-derive keyboard lanes with new root
      setSelectedKeys(prev => {
        const newKeys = new Set([note.midi]);
        const newLanes = buildKeyboardLanes(newKeys, note.midi);
        setLanes(newLanes);
        if (audioBuffer) {
          engine.buildNodes(newLanes);
          engine.setLoop(loop);
        }
        return newKeys;
      });
    }
  }, [mode, audioBuffer, engine, loop]);

  const handleRootNoteModeChange = useCallback((newMode) => {
    setRootNoteMode(newMode);
    if (newMode === 'auto' && detectedNote) {
      setRootNote({ label: detectedNote.label, midi: detectedNote.midi });
    }
  }, [detectedNote]);

  // ── Mode switch ──
  const handleModeChange = useCallback((newMode) => {
    if (newMode === mode) return;
    engine.stopAll();
    engine.disposeAll();
    setIsPlaying(false);
    setChordPreset(null);
    setMode(newMode);

    if (newMode === 'interval') {
      const newLanes = buildIntervalLanes();
      setLanes(newLanes);
      if (audioBuffer) {
        engine.setAudioBuffer(audioBuffer);
        engine.buildNodes(newLanes);
        engine.setLoop(loop);
      }
    } else {
      // keyboard mode
      const root = rootNote?.midi ?? DEFAULT_ROOT_MIDI;
      const newKeys = new Set([root]);
      setSelectedKeys(newKeys);
      const newLanes = buildKeyboardLanes(newKeys, root);
      setLanes(newLanes);
      if (audioBuffer) {
        engine.setAudioBuffer(audioBuffer);
        engine.buildNodes(newLanes);
        engine.setLoop(loop);
      }
    }
  }, [mode, engine, audioBuffer, rootNote, loop]);

  // ── Chord preset ──
  const handleChordPresetChange = useCallback((preset) => {
    setChordPreset(preset);
    if (!preset) return;

    const root = rootNote?.midi ?? DEFAULT_ROOT_MIDI;

    if (mode === 'interval') {
      // In interval mode, just highlight (handled by lanes list — nothing structural changes)
      // We don't rebuild lanes; chord highlights are visual only
    } else {
      // In keyboard mode, select preset keys
      const newMidis = preset.intervals.map(st => root + st);
      const newKeys = new Set(newMidis);
      setSelectedKeys(newKeys);
      const newLanes = buildKeyboardLanes(newKeys, root);
      setLanes(newLanes);
      if (audioBuffer) {
        engine.stopAll();
        engine.disposeAll();
        setIsPlaying(false);
        engine.buildNodes(newLanes);
        engine.setLoop(loop);
      }
    }
  }, [mode, rootNote, audioBuffer, engine, loop]);

  // ── Key toggle (keyboard mode) ──
  const handleKeyToggle = useCallback((midi) => {
    const root = rootNote?.midi;
    if (midi === root) return; // root always selected

    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(midi)) {
        next.delete(midi);
        engine.removeLane(`key_${midi}`);
      } else {
        next.add(midi);
        if (audioBuffer) {
          const newLane = {
            id: `key_${midi}`,
            label: midiToLabel(midi),
            semitones: semitoneDelta(root, midi),
            fineTune: 0,
            volume: 80,
            muted: false,
            soloed: false,
          };
          engine.addLane(newLane);
        }
      }
      // Rebuild lanes array in pitch order
      const newLanes = buildKeyboardLanes(next, root);
      setLanes(newLanes);
      // If we added, the engine.addLane above handles it.
      // If a preset was active and user changed manually, clear preset.
      setChordPreset(null);
      return next;
    });
  }, [rootNote, audioBuffer, engine]);

  // ── Clear chord (keyboard mode) ──
  const handleClearChord = useCallback(() => {
    const root = rootNote?.midi ?? DEFAULT_ROOT_MIDI;
    engine.stopAll();
    engine.disposeAll();
    setIsPlaying(false);
    setChordPreset(null);
    const newKeys = new Set([root]);
    setSelectedKeys(newKeys);
    const newLanes = buildKeyboardLanes(newKeys, root);
    setLanes(newLanes);
    if (audioBuffer) {
      engine.buildNodes(newLanes);
      engine.setLoop(loop);
    }
  }, [rootNote, audioBuffer, engine, loop]);

  // ── Lane control handlers ──
  const handleSemitoneChange = useCallback((id, semitones) => {
    setLanes(prev => prev.map(l =>
      l.id === id ? { ...l, semitones } : l
    ));
    const lane = lanes.find(l => l.id === id);
    if (lane) engine.updatePitch(id, semitones, lane.fineTune);
  }, [lanes, engine]);

  const handleFineTuneChange = useCallback((id, cents) => {
    setLanes(prev => prev.map(l =>
      l.id === id ? { ...l, fineTune: cents } : l
    ));
    const lane = lanes.find(l => l.id === id);
    if (lane) engine.updatePitch(id, lane.semitones, cents);
  }, [lanes, engine]);

  const handleVolumeChange = useCallback((id, pct) => {
    setLanes(prev => prev.map(l =>
      l.id === id ? { ...l, volume: pct } : l
    ));
    const lane = lanes.find(l => l.id === id);
    if (lane) engine.updateVolume(id, pct, lane.muted);
  }, [lanes, engine]);

  const handleMuteToggle = useCallback((id) => {
    setLanes(prev => {
      const updated = prev.map(l =>
        l.id === id ? { ...l, muted: !l.muted } : l
      );
      const lane = updated.find(l => l.id === id);
      if (lane) engine.updateVolume(id, lane.volume, lane.muted);
      return updated;
    });
  }, [engine]);

  const handleSoloToggle = useCallback((id) => {
    setLanes(prev => {
      const isSoloed = prev.find(l => l.id === id)?.soloed;
      // Only one lane soloed at a time
      const updated = prev.map(l => ({
        ...l,
        soloed: l.id === id ? !isSoloed : false,
      }));
      const soloId = updated.find(l => l.soloed)?.id ?? null;
      // Update volumes for solo
      for (const lane of updated) {
        const shouldPlay = soloId
          ? lane.id === soloId
          : !lane.muted;
        engine.updateVolume(lane.id, lane.volume, !shouldPlay);
      }
      return updated;
    });
  }, [engine]);

  // ── Playback ──
  const handlePlay = useCallback(async (id) => {
    await engine.playLane(id);
  }, [engine]);

  const handlePlayAll = useCallback(async () => {
    if (!audioBuffer) return;
    const soloLane = lanes.find(l => l.soloed);
    const soloId = soloLane?.id ?? null;
    engine.setLoop(loop);
    await engine.playAll(lanes, soloId);
    setIsPlaying(true);
  }, [audioBuffer, lanes, loop, engine]);

  const handleStop = useCallback(() => {
    engine.stopAll();
    setIsPlaying(false);
  }, [engine]);

  const handleLoopToggle = useCallback(() => {
    setLoop(prev => {
      engine.setLoop(!prev);
      return !prev;
    });
  }, [engine]);

  // Initial build of interval lane nodes (only once we have audio)
  const prevAudioRef = useRef(null);
  useEffect(() => {
    if (audioBuffer && audioBuffer !== prevAudioRef.current) {
      prevAudioRef.current = audioBuffer;
      engine.setAudioBuffer(audioBuffer);
      engine.buildNodes(lanes);
      engine.setLoop(loop);
    }
  }, [audioBuffer, lanes, engine, loop]);

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <div className="app-title">Harmony Helper</div>
          <div className="app-subtitle">dabingabongo.com</div>
        </div>
        <a href="/login.html" className="header-back-link">← Tools</a>
      </header>

      <main className="app-main">
        <SourcePanel
          audioBuffer={audioBuffer}
          rootNote={rootNote}
          rootNoteMode={rootNoteMode}
          detectedNote={detectedNote}
          onAudioLoad={handleAudioLoad}
          onRootNoteChange={handleRootNoteChange}
          onRootNoteModeChange={handleRootNoteModeChange}
        />

        <ModeBar
          mode={mode}
          chordPreset={chordPreset}
          rootNote={rootNote}
          onModeChange={handleModeChange}
          onChordPresetChange={handleChordPresetChange}
        />

        <LaneMixer
          mode={mode}
          lanes={lanes}
          rootMidi={rootNote?.midi ?? null}
          selectedKeys={selectedKeys}
          chordPreset={chordPreset}
          audioReady={!!audioBuffer}
          onSemitoneChange={handleSemitoneChange}
          onFineTuneChange={handleFineTuneChange}
          onVolumeChange={handleVolumeChange}
          onMuteToggle={handleMuteToggle}
          onSoloToggle={handleSoloToggle}
          onPlay={handlePlay}
          onKeyToggle={handleKeyToggle}
          onClearChord={handleClearChord}
        />
      </main>

      <Transport
        isPlaying={isPlaying}
        loop={loop}
        audioReady={!!audioBuffer}
        onPlayAll={handlePlayAll}
        onStop={handleStop}
        onLoopToggle={handleLoopToggle}
      />
    </div>
  );
}
