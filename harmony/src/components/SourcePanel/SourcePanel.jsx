import React, { useRef, useCallback, useEffect } from 'react';
import { getContext as getToneContext } from 'tone';
import { useMediaRecorder } from '../../hooks/useMediaRecorder.js';
import { getPickerNotes } from '../../utils/music.js';
import './SourcePanel.css';

const PICKER_NOTES = getPickerNotes();

function drawWaveform(canvas, audioBuffer) {
  const dpr = window.devicePixelRatio || 1;
  const displayW = canvas.clientWidth;
  const displayH = canvas.clientHeight;
  if (!displayW || !displayH) return;

  canvas.width = displayW * dpr;
  canvas.height = displayH * dpr;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const W = displayW;
  const H = displayH;

  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, W, H);

  if (!audioBuffer) {
    ctx.fillStyle = '#444';
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No audio loaded', W / 2, H / 2 + 5);
    return;
  }

  const data = audioBuffer.getChannelData(0);
  const step = Math.ceil(data.length / W);

  ctx.beginPath();
  ctx.strokeStyle = '#7c6af7';
  ctx.lineWidth = 1;

  for (let x = 0; x < W; x++) {
    let min = 1.0, max = -1.0;
    for (let j = 0; j < step; j++) {
      const d = data[x * step + j] || 0;
      if (d < min) min = d;
      if (d > max) max = d;
    }
    ctx.moveTo(x, ((1 + min) / 2) * H);
    ctx.lineTo(x, ((1 + max) / 2) * H);
  }
  ctx.stroke();
}

function WaveformCanvas({ audioBuffer }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    drawWaveform(canvas, audioBuffer);

    const ro = new ResizeObserver(() => drawWaveform(canvas, audioBuffer));
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [audioBuffer]);

  return <canvas ref={canvasRef} className="waveform-canvas" />;
}

export default function SourcePanel({
  audioBuffer,
  rootNote,
  rootNoteMode,
  detectedNote,
  onAudioLoad,
  onRootNoteChange,
  onRootNoteModeChange,
}) {
  const fileInputRef = useRef(null);

  const decodeBlob = useCallback(async (blob) => {
    try {
      // Use Tone.js context so it matches what the engine uses
      const rawCtx = getToneContext().rawContext;
      const arrayBuffer = await blob.arrayBuffer();
      const decoded = await rawCtx.decodeAudioData(arrayBuffer);
      onAudioLoad(decoded);
    } catch (err) {
      console.error('Failed to decode audio:', err);
      alert('Could not decode this audio file. Try a different format.');
    }
  }, [onAudioLoad]);

  const { isRecording, startRecording, stopRecording } = useMediaRecorder(decodeBlob);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) decodeBlob(file);
    e.target.value = '';
  }, [decodeBlob]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) decodeBlob(file);
  }, [decodeBlob]);

  const handleDragOver = (e) => e.preventDefault();

  const handleRecordToggle = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleManualNoteChange = (e) => {
    const midi = parseInt(e.target.value, 10);
    const note = PICKER_NOTES.find(n => n.midi === midi);
    if (note) onRootNoteChange(note);
  };

  const confidencePct = detectedNote
    ? Math.round(detectedNote.confidence * 100)
    : null;

  return (
    <section className="source-panel">
      <h2 className="panel-title">Source Audio</h2>

      <div className="source-inputs">
        {/* Upload */}
        <div
          className="drop-zone"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          aria-label="Upload audio file"
        >
          <span className="drop-zone-icon">&#9835;</span>
          <span className="drop-zone-text">
            {audioBuffer ? 'Click or drop to replace' : 'Drop audio or click to upload'}
          </span>
          <span className="drop-zone-hint">MP3, WAV, OGG, M4A, FLAC, WebM</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="file-input-hidden"
            onChange={handleFileChange}
          />
        </div>

        <div className="source-divider">or</div>

        {/* Record */}
        <button
          className={`record-btn ${isRecording ? 'recording' : ''}`}
          onClick={handleRecordToggle}
          aria-label={isRecording ? 'Stop recording' : 'Start recording'}
        >
          {isRecording ? (
            <>
              <span className="record-dot pulsing" />
              Stop Recording
            </>
          ) : (
            <>
              <span className="record-dot" />
              Record
            </>
          )}
        </button>
      </div>

      {/* Waveform */}
      <div className="waveform-container">
        <WaveformCanvas audioBuffer={audioBuffer} />
        {audioBuffer && (
          <div className="audio-duration">
            {(audioBuffer.duration).toFixed(2)}s &middot; {audioBuffer.sampleRate} Hz
          </div>
        )}
      </div>

      {/* Root Note */}
      <div className="root-note-section">
        <h3 className="section-subtitle">Root Note</h3>
        <div className="root-mode-toggle">
          <button
            className={`mode-btn ${rootNoteMode === 'auto' ? 'active' : ''}`}
            onClick={() => onRootNoteModeChange('auto')}
          >
            Auto-Detect
          </button>
          <button
            className={`mode-btn ${rootNoteMode === 'manual' ? 'active' : ''}`}
            onClick={() => onRootNoteModeChange('manual')}
          >
            Manual
          </button>
        </div>

        {rootNoteMode === 'auto' && (
          <div className="auto-detect-result">
            {!audioBuffer ? (
              <span className="detect-hint">Load audio to detect root note</span>
            ) : detectedNote ? (
              <div className="detected-note">
                <span className="note-badge">{detectedNote.label}</span>
                <span className={`confidence ${detectedNote.lowConfidence ? 'low' : 'high'}`}>
                  {confidencePct}% confidence
                </span>
                {detectedNote.lowConfidence && (
                  <span className="confidence-warning">
                    Low confidence — consider switching to Manual
                  </span>
                )}
              </div>
            ) : (
              <span className="detect-hint">Detection failed — switch to Manual</span>
            )}
          </div>
        )}

        <div className="manual-picker-row">
          <label className="picker-label">
            {rootNoteMode === 'auto' ? 'Override:' : 'Note:'}
          </label>
          <select
            className="note-picker"
            value={rootNote?.midi ?? ''}
            onChange={handleManualNoteChange}
          >
            <option value="" disabled>Select note</option>
            {PICKER_NOTES.map(n => (
              <option key={n.midi} value={n.midi}>{n.label}</option>
            ))}
          </select>
          {rootNote && (
            <span className="current-root-badge">{rootNote.label}</span>
          )}
        </div>
      </div>
    </section>
  );
}
