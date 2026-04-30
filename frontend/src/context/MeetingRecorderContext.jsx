// src/context/MeetingRecorderContext.jsx
import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';

const MeetingRecorderContext = createContext(null);

export const useMeetingRecorder = () => {
  const context = useContext(MeetingRecorderContext);
  if (!context) throw new Error('useMeetingRecorder must be used within MeetingRecorderProvider');
  return context;
};

export const RECORDING_QUALITY = {
  low:    { width: 640,  height: 480,  bitrate: 500000,  label: 'Low (480p)',    fileSize: '~5 MB/min' },
  medium: { width: 1280, height: 720,  bitrate: 1000000, label: 'Medium (720p)', fileSize: '~10 MB/min' },
  high:   { width: 1920, height: 1080, bitrate: 2500000, label: 'High (1080p)',  fileSize: '~20 MB/min' },
};

export const RECORDING_FORMATS = {
  webm: { mimeType: 'video/webm', extension: '.webm', label: 'WebM',       browserSupport: 'All modern browsers' },
  mp4:  { mimeType: 'video/mp4',  extension: '.mp4',  label: 'MP4',        browserSupport: 'Limited browser support' },
};

export const AUDIO_FORMATS = {
  webm: { mimeType: 'audio/webm', extension: '.webm', label: 'WebM Audio', browserSupport: 'All modern browsers' },
  ogg:  { mimeType: 'audio/ogg',  extension: '.ogg',  label: 'OGG Audio',  browserSupport: 'All modern browsers' },
  mp3:  { mimeType: 'audio/mp3',  extension: '.mp3',  label: 'MP3 Audio',  browserSupport: 'Limited browser support' },
};

export const RECORDING_MODE = { video: 'video', audio: 'audio' };

// ─── Human-readable permission error messages ──────────────────────────────
const friendlyError = (err) => {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Microphone access was denied. Please allow access in your browser settings and try again.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No microphone found. Please connect a microphone and try again.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Microphone is in use by another application. Please close it and try again.';
    case 'OverconstrainedError':
      return 'Selected device is no longer available. Please choose a different microphone.';
    case 'SecurityError':
      return 'Media access blocked due to security settings. Ensure the page is served over HTTPS.';
    default:
      return err?.message || 'Could not access microphone. Please check your device settings.';
  }
};

export const MeetingRecorderProvider = ({ children }) => {
  // ── Core recording state ──────────────────────────────────────────────────
  const [isRecording,    setIsRecording]    = useState(false);
  const [isPaused,       setIsPaused]       = useState(false);
  const [recordingTime,  setRecordingTime]  = useState(0);
  const [recordingMode,  setRecordingMode]  = useState(RECORDING_MODE.audio);
  const [quality,        setQuality]        = useState('medium');
  const [fileFormat,     setFileFormat]     = useState('webm');
  const [recordedBlob,   setRecordedBlob]   = useState(null);
  const [recordedUrl,    setRecordedUrl]    = useState(null);
  const [recordingSize,  setRecordingSize]  = useState(0);

  // ── Device state ──────────────────────────────────────────────────────────
  const [selectedCamera, setSelectedCamera] = useState('');
  const [selectedMic,    setSelectedMic]    = useState('');
  const [cameras,        setCameras]        = useState([]);
  const [microphones,    setMicrophones]    = useState([]);
  const [streamReady,    setStreamReady]    = useState(false);
  const [streamError,    setStreamError]    = useState(null);

  // ── Meeting ───────────────────────────────────────────────────────────────
  const [currentMeetingId, setCurrentMeetingId] = useState(null);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const mediaRecorderRef = useRef(null);
  const streamRef        = useRef(null);
  const timerRef         = useRef(null);
  const chunksRef        = useRef([]);
  // FIX #5: expose videoRef so MeetingRecorder can attach the <video> element
  const videoRef         = useRef(null);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startTimer = () => {
    stopTimer();
    // FIX #1: use functional setter so the timer correctly accumulates
    timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
  };

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    // Also clear the video preview
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  // ── Enumerate devices ─────────────────────────────────────────────────────
  // FIX #2: propagate NotAllowedError instead of silently swallowing it
  const enumerateDevices = useCallback(async () => {
    setStreamError(null);
    try {
      // Trigger a real permission prompt for the relevant mode
      const permStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      permStream.getTracks().forEach(t => t.stop());
    } catch (err) {
      // Permission denied at enumerate time — set a meaningful error
      setStreamError(friendlyError(err));
      return;
    }

    try {
      const devices      = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      const audioDevices = devices.filter(d => d.kind === 'audioinput');

      setCameras(videoDevices);
      setMicrophones(audioDevices);
      setSelectedCamera(prev => prev || videoDevices[0]?.deviceId || '');
      setSelectedMic(prev   => prev || audioDevices[0]?.deviceId  || '');
    } catch (err) {
      setStreamError('Cannot list media devices: ' + err.message);
    }
  }, []);

  // ── Start preview stream ──────────────────────────────────────────────────
  // FIX #3 & #4: always surface NotAllowedError; attach stream to videoRef
  const startPreview = useCallback(async (mode, camId, micId, qual) => {
    const effectiveMode = mode   ?? recordingMode;
    const effectiveCam  = camId  ?? selectedCamera;
    const effectiveMic  = micId  ?? selectedMic;
    const effectiveQual = qual   ?? quality;

    stopStream();
    setStreamReady(false);
    setStreamError(null);

    const isVideo = effectiveMode === RECORDING_MODE.video;
    const constraints = {
      video: isVideo
        ? {
            deviceId: effectiveCam ? { exact: effectiveCam } : undefined,
            width:  { ideal: RECORDING_QUALITY[effectiveQual].width  },
            height: { ideal: RECORDING_QUALITY[effectiveQual].height },
          }
        : false,
      audio: {
        deviceId:        effectiveMic ? { exact: effectiveMic } : undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl:  true,
      },
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Attach to video element for live preview
      if (isVideo && videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setStreamReady(true);
      setStreamError(null);
      return stream;
    } catch (err) {
      setStreamError(friendlyError(err));
      setStreamReady(false);
      return null;
    }
  }, [recordingMode, selectedCamera, selectedMic, quality]);

  // Re-run preview when device selection or mode changes (only if not recording)
  useEffect(() => {
    if (isRecording || recordedUrl) return;
    startPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordingMode, selectedCamera, selectedMic, quality]);

  // ── Start recording ───────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (isRecording) return;

    // Reuse live stream or acquire a fresh one
    let stream = streamRef.current?.active ? streamRef.current : null;
    if (!stream) {
      stream = await startPreview();
      if (!stream) return; // error already set inside startPreview
    }

    const isAudio   = recordingMode === RECORDING_MODE.audio;
    const formats   = isAudio ? AUDIO_FORMATS : RECORDING_FORMATS;
    const mimeType  = formats[fileFormat]?.mimeType || (isAudio ? 'audio/webm' : 'video/webm');
    const supported = MediaRecorder.isTypeSupported(mimeType);
    const options   = supported ? { mimeType } : {};

    chunksRef.current = [];

    let recorder;
    try {
      recorder = new MediaRecorder(stream, options);
    } catch (err) {
      setStreamError('Failed to initialise recorder: ' + err.message);
      return;
    }

    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data?.size > 0) {
        chunksRef.current.push(e.data);
        const total = chunksRef.current.reduce((a, c) => a + c.size, 0);
        setRecordingSize(total);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url  = URL.createObjectURL(blob);
      setRecordedBlob(blob);
      setRecordedUrl(url);
      setRecordingSize(blob.size);
    };

    recorder.onerror = (e) => {
      setStreamError('Recording error: ' + (e.error?.message || 'unknown'));
      stopTimer();
      setIsRecording(false);
      setIsPaused(false);
    };

    recorder.start(1000);
    setIsRecording(true);
    setIsPaused(false);
    startTimer();
  }, [isRecording, recordingMode, fileFormat, startPreview]);

  // ── Stop recording ────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    stopTimer();
    setIsRecording(false);
    setIsPaused(false);
    // Keep the stream alive for potential re-recording
  }, []);

  // ── Pause / Resume ────────────────────────────────────────────────────────
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      stopTimer();
      setIsPaused(true);
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      startTimer();
      setIsPaused(false);
    }
  }, []);

  // ── Discard recording ─────────────────────────────────────────────────────
  const discardRecording = useCallback(() => {
    setRecordedUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
    setRecordedBlob(null);
    setRecordingTime(0);
    setRecordingSize(0);
    chunksRef.current = [];
    // Restart preview so the user can record again immediately
    startPreview();
  }, [startPreview]);

  // ── Full reset ────────────────────────────────────────────────────────────
  const resetRecorder = useCallback(() => {
    stopStream();
    stopTimer();
    setRecordedUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
    setRecordedBlob(null);
    setRecordingTime(0);
    setRecordingSize(0);
    setIsRecording(false);
    setIsPaused(false);
    setStreamReady(false);
    setStreamError(null);
    setCurrentMeetingId(null);
    chunksRef.current = [];
  }, []);

  // ── Meeting ID helper ─────────────────────────────────────────────────────
  const setMeetingId = useCallback((id) => setCurrentMeetingId(id), []);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopTimer();
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Context value ─────────────────────────────────────────────────────────
  const value = {
    // State
    isRecording,
    isPaused,
    recordingTime,
    recordingMode,
    quality,
    fileFormat,
    recordedBlob,
    recordedUrl,
    recordingSize,
    selectedCamera,
    selectedMic,
    cameras,
    microphones,
    streamReady,
    streamError,
    currentMeetingId,

    // Constants
    RECORDING_QUALITY,
    RECORDING_FORMATS,
    AUDIO_FORMATS,
    RECORDING_MODE,

    // Refs
    videoRef, // FIX #5: now exposed so MeetingRecorder can attach <video>

    // Actions
    startPreview,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    discardRecording,
    resetRecorder,
    setMeetingId,
    enumerateDevices,

    // Setters (with side-effect: restart preview when changed)
    setRecordingMode: (mode) => {
      setRecordingMode(mode);
      setFileFormat('webm'); // reset format when switching modes
    },
    setQuality:        setQuality,
    setFileFormat:     setFileFormat,
    setSelectedCamera: setSelectedCamera,
    setSelectedMic:    setSelectedMic,
  };

  return (
    <MeetingRecorderContext.Provider value={value}>
      {children}
    </MeetingRecorderContext.Provider>
  );
};