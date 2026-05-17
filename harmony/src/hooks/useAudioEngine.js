import { useRef, useCallback } from 'react';
import * as Tone from 'tone';
import { linearToDb } from '../utils/music.js';

/**
 * Manages the Tone.js audio nodes for all lanes.
 * Each lane: Player -> PitchShift -> Volume -> Destination
 */
export function useAudioEngine() {
  // Map of laneId -> { player, pitchShift, volume }
  const nodesRef = useRef(new Map());
  const audioBufferRef = useRef(null);

  const disposeAll = useCallback(() => {
    for (const [, nodes] of nodesRef.current) {
      try {
        nodes.player.stop();
        nodes.player.dispose();
        nodes.pitchShift.dispose();
        nodes.volume.dispose();
      } catch (e) {
        // Ignore disposal errors
      }
    }
    nodesRef.current.clear();
  }, []);

  const setAudioBuffer = useCallback((buffer) => {
    audioBufferRef.current = buffer;
  }, []);

  /**
   * Build nodes for a set of lanes.
   * lanes: [{ id, semitones, fineTune, volume, muted }]
   */
  const buildNodes = useCallback((lanes) => {
    disposeAll();
    const buffer = audioBufferRef.current;
    if (!buffer) return;

    const toneBuffer = new Tone.ToneAudioBuffer(buffer);

    for (const lane of lanes) {
      const player = new Tone.Player({
        url: toneBuffer,
        loop: false,
      });

      const pitchShift = new Tone.PitchShift({
        pitch: lane.semitones + (lane.fineTune / 100),
      });

      const vol = new Tone.Volume({
        volume: lane.muted ? -Infinity : linearToDb(lane.volume / 100),
      });

      player.connect(pitchShift);
      pitchShift.connect(vol);
      vol.toDestination();

      nodesRef.current.set(lane.id, { player, pitchShift, volume: vol });
    }
  }, [disposeAll]);

  /**
   * Add a single lane node without rebuilding all.
   */
  const addLane = useCallback((lane) => {
    const buffer = audioBufferRef.current;
    if (!buffer) return;

    const toneBuffer = new Tone.ToneAudioBuffer(buffer);
    const player = new Tone.Player({ url: toneBuffer, loop: false });
    const pitchShift = new Tone.PitchShift({ pitch: lane.semitones + (lane.fineTune / 100) });
    const vol = new Tone.Volume({
      volume: lane.muted ? -Infinity : linearToDb(lane.volume / 100),
    });

    player.connect(pitchShift);
    pitchShift.connect(vol);
    vol.toDestination();

    nodesRef.current.set(lane.id, { player, pitchShift, volume: vol });
  }, []);

  /**
   * Remove a single lane's nodes.
   */
  const removeLane = useCallback((laneId) => {
    const nodes = nodesRef.current.get(laneId);
    if (!nodes) return;
    try {
      nodes.player.stop();
      nodes.player.dispose();
      nodes.pitchShift.dispose();
      nodes.volume.dispose();
    } catch (e) {}
    nodesRef.current.delete(laneId);
  }, []);

  /**
   * Update pitch for a lane in real time.
   */
  const updatePitch = useCallback((laneId, semitones, fineTune) => {
    const nodes = nodesRef.current.get(laneId);
    if (nodes) {
      nodes.pitchShift.pitch = semitones + (fineTune / 100);
    }
  }, []);

  /**
   * Update volume for a lane in real time.
   */
  const updateVolume = useCallback((laneId, volume, muted) => {
    const nodes = nodesRef.current.get(laneId);
    if (nodes) {
      nodes.volume.volume.value = muted ? -Infinity : linearToDb(volume / 100);
    }
  }, []);

  /**
   * Update loop setting for all players.
   */
  const setLoop = useCallback((loop) => {
    for (const [, nodes] of nodesRef.current) {
      nodes.player.loop = loop;
    }
  }, []);

  /**
   * Play a specific lane only.
   */
  const playLane = useCallback(async (laneId) => {
    await Tone.start();
    const nodes = nodesRef.current.get(laneId);
    if (!nodes) return;
    try {
      nodes.player.stop();
      nodes.player.start();
    } catch (e) {
      console.error('playLane error:', e);
    }
  }, []);

  /**
   * Stop a specific lane.
   */
  const stopLane = useCallback((laneId) => {
    const nodes = nodesRef.current.get(laneId);
    if (nodes) {
      try { nodes.player.stop(); } catch (e) {}
    }
  }, []);

  /**
   * Play all lanes (with solo/mute applied via volume nodes).
   * soloId: laneId of soloed lane, or null
   * mutedIds: Set of muted lane ids
   * lanes: full lanes array for volume info
   */
  const playAll = useCallback(async (lanes, soloId) => {
    await Tone.start();
    // Stop all first
    for (const [, nodes] of nodesRef.current) {
      try { nodes.player.stop(); } catch (e) {}
    }
    // Apply solo/mute volumes, then start
    for (const lane of lanes) {
      const nodes = nodesRef.current.get(lane.id);
      if (!nodes) continue;
      let shouldPlay;
      if (soloId !== null) {
        shouldPlay = lane.id === soloId;
      } else {
        shouldPlay = !lane.muted;
      }
      nodes.volume.volume.value = shouldPlay
        ? linearToDb(lane.volume / 100)
        : -Infinity;
      try { nodes.player.start(); } catch (e) {}
    }
  }, []);

  /**
   * Stop all lanes.
   */
  const stopAll = useCallback(() => {
    for (const [, nodes] of nodesRef.current) {
      try { nodes.player.stop(); } catch (e) {}
    }
  }, []);

  return {
    setAudioBuffer,
    buildNodes,
    addLane,
    removeLane,
    updatePitch,
    updateVolume,
    setLoop,
    playLane,
    stopLane,
    playAll,
    stopAll,
    disposeAll,
  };
}
