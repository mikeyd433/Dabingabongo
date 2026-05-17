import { useCallback } from 'react';
import { PitchDetector } from 'pitchy';
import { freqToNote } from '../utils/music.js';

const SLICE_SIZE = 2048;
const CONFIDENCE_THRESHOLD = 0.80;

export function usePitchDetection() {
  const detectPitch = useCallback((audioBuffer) => {
    if (!audioBuffer) return null;

    const data = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;

    // Analyze middle third for best results
    const start = Math.floor(data.length / 3);
    const end = Math.min(start + SLICE_SIZE, data.length);
    const slice = data.slice(start, end);

    if (slice.length < SLICE_SIZE) {
      // Pad if too short
      const padded = new Float32Array(SLICE_SIZE);
      padded.set(slice);
      const detector = PitchDetector.forFloat32Array(SLICE_SIZE);
      const [pitch, clarity] = detector.findPitch(padded, sampleRate);
      const note = freqToNote(pitch);
      if (!note) return null;
      return {
        ...note,
        frequency: pitch,
        confidence: clarity,
        lowConfidence: clarity < CONFIDENCE_THRESHOLD,
      };
    }

    const detector = PitchDetector.forFloat32Array(slice.length);
    const [pitch, clarity] = detector.findPitch(slice, sampleRate);

    if (!pitch || pitch <= 0) return null;

    const note = freqToNote(pitch);
    if (!note) return null;

    return {
      ...note,
      frequency: pitch,
      confidence: clarity,
      lowConfidence: clarity < CONFIDENCE_THRESHOLD,
    };
  }, []);

  return { detectPitch };
}
