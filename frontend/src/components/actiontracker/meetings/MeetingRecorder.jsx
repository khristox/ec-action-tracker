// src/components/actiontracker/meetings/MeetingRecorder.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  IconButton,
  Stack,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Grid,
  Chip,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Tooltip,
  Snackbar,
  useTheme,
  useMediaQuery,
  alpha,
  Tabs,
  Tab,
  ToggleButton,
  ToggleButtonGroup,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Badge,
} from '@mui/material';
import {
  FiberManualRecord,
  Stop,
  Pause,
  PlayArrow,
  Videocam,
  Mic,
  CloudUpload,
  Download,
  FilePresent,
  MeetingRoom,
  Timer,
  Memory,
  Storage,
  GraphicEq,
  ExpandMore,
  CloudDone,
  Warning,
  Speed,
  Replay,
  Delete,
  ArrowBack,
  CheckCircle,
  RadioButtonChecked,
  VolumeUp,
} from '@mui/icons-material';
import { format } from 'date-fns';
import api from '../../../services/api';
import { fetchMeetingById, selectCurrentMeeting } from '../../../store/slices/actionTracker/meetingSlice';

// Recording quality presets
const RECORDING_QUALITY = {
  low:    { width: 640,  height: 480,  bitrate: 500000,  label: 'Low (480p)',    fileSize: '~5 MB/min' },
  medium: { width: 1280, height: 720,  bitrate: 1000000, label: 'Medium (720p)', fileSize: '~10 MB/min' },
  high:   { width: 1920, height: 1080, bitrate: 2500000, label: 'High (1080p)',  fileSize: '~20 MB/min' },
};

const RECORDING_FORMATS = {
  webm: { mimeType: 'video/webm', extension: '.webm', label: 'WebM', browserSupport: 'All modern browsers' },
  mp4:  { mimeType: 'video/mp4',  extension: '.mp4',  label: 'MP4',  browserSupport: 'Limited browser support' },
};

const AUDIO_FORMATS = {
  webm: { mimeType: 'audio/webm', extension: '.webm', label: 'WebM Audio', browserSupport: 'All modern browsers' },
  ogg:  { mimeType: 'audio/ogg',  extension: '.ogg',  label: 'OGG Audio',  browserSupport: 'All modern browsers' },
  mp3:  { mimeType: 'audio/mp3',  extension: '.mp3',  label: 'MP3 Audio',  browserSupport: 'Limited browser support' },
};

const RECORDING_MODE = { video: 'video', audio: 'audio' };

const UPLOAD_STATUS = { IDLE: 'idle', UPLOADING: 'uploading', SUCCESS: 'success', ERROR: 'error' };

// ─── Animated waveform bars ──────────────────────────────────────────────────
const AudioWaveform = ({ active, barCount = 40 }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '3px',
      height: 64,
    }}
  >
    {Array.from({ length: barCount }).map((_, i) => (
      <Box
        key={i}
        sx={{
          width: 3,
          borderRadius: 2,
          bgcolor: active ? 'primary.main' : 'action.disabled',
          transition: 'background-color 0.3s',
          height: active ? undefined : 6,
          animation: active
            ? `wave ${0.6 + (i % 7) * 0.1}s ease-in-out infinite alternate`
            : 'none',
          animationDelay: `${(i * 0.04) % 0.8}s`,
          '@keyframes wave': {
            from: { height: '4px' },
            to:   { height: `${18 + (i % 5) * 9}px` },
          },
        }}
      />
    ))}
  </Box>
);

// ─── Recording timer chip ────────────────────────────────────────────────────
const RecordingBadge = ({ time, isPaused }) => (
  <Stack direction="row" alignItems="center" spacing={1}>
    <Box
      sx={{
        width: 10,
        height: 10,
        borderRadius: '50%',
        bgcolor: isPaused ? 'warning.main' : 'error.main',
        animation: isPaused ? 'none' : 'pulse 1.5s infinite',
        '@keyframes pulse': {
          '0%,100%': { opacity: 1, transform: 'scale(1)' },
          '50%':     { opacity: 0.5, transform: 'scale(0.85)' },
        },
      }}
    />
    <Typography variant="caption" fontFamily="monospace" fontWeight={700} color="text.primary">
      {isPaused ? 'PAUSED' : 'REC'} · {formatTime(time)}
    </Typography>
  </Stack>
);

const formatTime = (seconds) => {
  if (!seconds && seconds !== 0) return '00:00';
  const hrs  = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return hrs > 0
    ? `${String(hrs).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`
    : `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
};

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024, sizes = ['B','KB','MB','GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatDate = (dateString) => {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? '—' : format(d, 'MMM dd, yyyy · HH:mm');
  } catch { return '—'; }
};

// ============================================================================
const MeetingRecorder = () => {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const dispatch  = useDispatch();
  const theme     = useTheme();
  const isMobile  = useMediaQuery(theme.breakpoints.down('sm'));

  const currentMeeting = useSelector(selectCurrentMeeting);

  // ── Mode (default: audio) ──────────────────────────────────────────────────
  const [recordingMode, setRecordingMode] = useState(RECORDING_MODE.audio);

  // ── Recording state ────────────────────────────────────────────────────────
  const [isRecording,   setIsRecording]   = useState(false);
  const [isPaused,      setIsPaused]      = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedUrl,   setRecordedUrl]   = useState(null);
  const [recordedBlob,  setRecordedBlob]  = useState(null);
  const [recordingSize, setRecordingSize] = useState(0);

  // ── Upload state ───────────────────────────────────────────────────────────
  const [uploadStatus,          setUploadStatus]          = useState(UPLOAD_STATUS.IDLE);
  const [uploadProgress,        setUploadProgress]        = useState(0);
  const [uploadError,           setUploadError]           = useState(null);
  const [uploadAbortController, setUploadAbortController] = useState(null);

  // ── Devices ────────────────────────────────────────────────────────────────
  const [cameras,        setCameras]        = useState([]);
  const [microphones,    setMicrophones]    = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [selectedMic,    setSelectedMic]    = useState('');
  const [streamReady,    setStreamReady]    = useState(false);
  const [streamError,    setStreamError]    = useState(null);

  // ── Settings ───────────────────────────────────────────────────────────────
  const [quality,    setQuality]    = useState('medium');
  const [fileFormat, setFileFormat] = useState('webm');

  // ── UI / metadata ──────────────────────────────────────────────────────────
  const [recordingName,        setRecordingName]        = useState('');
  const [recordingDescription, setRecordingDescription] = useState('');
  const [recordingCategory,    setRecordingCategory]    = useState('meeting');
  const [savedRecordings,      setSavedRecordings]      = useState([]);
  const [loadingRecordings,    setLoadingRecordings]    = useState(false);
  const [activeTab,            setActiveTab]            = useState(0);
  const [snackbar,             setSnackbar]             = useState({ open: false, message: '', severity: 'success' });
  const [saveDialogOpen,       setSaveDialogOpen]       = useState(false);
  const [previewDialogOpen,    setPreviewDialogOpen]    = useState(false);
  const [selectedRecording,    setSelectedRecording]    = useState(null);
  const [advancedOpen,         setAdvancedOpen]         = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const videoElementRef  = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef        = useRef(null);
  const timerRef         = useRef(null);
  const chunksRef        = useRef([]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const showSnack = (message, severity = 'success') =>
    setSnackbar({ open: true, message, severity });

  const getRecordingDate = (rec) => {
    if (!rec?.created_at) return '—';
    if (rec.created_at instanceof Date && !isNaN(rec.created_at)) return formatDate(rec.created_at);
    return formatDate(rec.created_at);
  };

  // ── Data loading ───────────────────────────────────────────────────────────
  const loadRecordings = useCallback(async () => {
    setLoadingRecordings(true);
    try {
      const res = await api.get(`/meetings/${id}/recordings`);
      const raw = res.data.items || res.data || [];
      setSavedRecordings(raw.map(r => ({
        ...r,
        created_at: r.created_at ? new Date(r.created_at) : null,
        duration:   r.duration   || 0,
        file_size:  r.file_size  || 0,
      })));
    } catch (err) {
      console.error(err);
      showSnack('Failed to load recordings', 'error');
    } finally {
      setLoadingRecordings(false);
    }
  }, [id]);

  const deleteRecording = useCallback(async (recordingId) => {
    if (!window.confirm('Delete this recording?')) return;
    try {
      await api.delete(`/meetings/${id}/recordings/${recordingId}`);
      showSnack('Recording deleted');
      loadRecordings();
      setSelectedRecording(null);
    } catch (err) {
      showSnack('Failed to delete recording', 'error');
    }
  }, [id, loadRecordings]);

  const downloadRecording = useCallback((recording) => {
    const a = document.createElement('a');
    a.href     = recording.url;
    a.download = recording.file_name || `${recording.title}.${recording.format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  // ── Upload ─────────────────────────────────────────────────────────────────
  const saveRecording = useCallback(async () => {
    if (!recordedBlob || !currentMeeting) return;
    setUploadStatus(UPLOAD_STATUS.UPLOADING);
    setUploadProgress(0);
    setUploadError(null);

    const ctrl     = new AbortController();
    setUploadAbortController(ctrl);

    const isAudio  = recordingMode === RECORDING_MODE.audio;
    const formats  = isAudio ? AUDIO_FORMATS : RECORDING_FORMATS;
    const ext      = formats[fileFormat]?.extension || '.webm';
    const base     = recordingName || currentMeeting.title || 'recording';
    const fileName = `${base.replace(/[^a-z0-9]/gi,'_')}_${Date.now()}${ext}`;

    const fd = new FormData();
    fd.append('file',        recordedBlob, fileName);
    fd.append('meeting_id',  id);
    fd.append('title',       recordingName || `${currentMeeting.title} - Recording`);
    fd.append('description', recordingDescription);
    fd.append('category',    recordingCategory);
    fd.append('duration',    recordingTime);
    fd.append('quality',     isAudio ? 'audio' : quality);
    fd.append('format',      fileFormat);
    fd.append('file_size',   recordedBlob.size);
    fd.append('mode',        recordingMode);

    try {
      const xhr = new XMLHttpRequest();
      await new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        });
        xhr.addEventListener('load',  () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Status ${xhr.status}`)));
        xhr.addEventListener('error', () => reject(new Error('Network error')));
        xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));
        xhr.open('POST', `/api/v1/meetings/${id}/recordings`);
        xhr.setRequestHeader('Accept', 'application/json');
        const token = localStorage.getItem('access_token');
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(fd);
      });
      setUploadStatus(UPLOAD_STATUS.SUCCESS);
      showSnack('Recording saved!');
      setSaveDialogOpen(false);
      setRecordingName('');
      setRecordingDescription('');
      setTimeout(() => {
        discardRecording();
        loadRecordings();
        setUploadStatus(UPLOAD_STATUS.IDLE);
        setUploadProgress(0);
      }, 1500);
    } catch (err) {
      setUploadStatus(UPLOAD_STATUS.ERROR);
      setUploadError(err.message || 'Upload failed');
      showSnack(err.message || 'Upload failed', 'error');
    } finally {
      setUploadAbortController(null);
    }
  }, [recordedBlob, currentMeeting, id, recordingName, recordingDescription,
      recordingCategory, recordingTime, quality, fileFormat, recordingMode, loadRecordings]);

  const cancelUpload = useCallback(() => {
    uploadAbortController?.abort();
    setUploadStatus(UPLOAD_STATUS.IDLE);
    setUploadProgress(0);
    setUploadError(null);
    showSnack('Upload cancelled', 'info');
  }, [uploadAbortController]);

  // ── Stream / recording controls ────────────────────────────────────────────
  const startPreview = useCallback(async () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setStreamReady(false);
    setStreamError(null);
    try {
      const isVideo = recordingMode === RECORDING_MODE.video;
      const stream  = await navigator.mediaDevices.getUserMedia({
        video: isVideo ? {
          deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
          width:  { ideal: RECORDING_QUALITY[quality].width },
          height: { ideal: RECORDING_QUALITY[quality].height },
        } : false,
        audio: {
          deviceId:        selectedMic ? { exact: selectedMic } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl:  true,
        },
      });
      streamRef.current = stream;
      if (videoElementRef.current && isVideo) videoElementRef.current.srcObject = stream;
      setStreamReady(true);
    } catch (err) {
      setStreamError(err.message || 'Cannot access microphone');
      showSnack('Failed to access microphone', 'error');
    }
  }, [recordingMode, selectedCamera, selectedMic, quality]);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;
    const isAudio   = recordingMode === RECORDING_MODE.audio;
    const formats   = isAudio ? AUDIO_FORMATS : RECORDING_FORMATS;
    const mimeType  = formats[fileFormat]?.mimeType || (isAudio ? 'audio/webm' : 'video/webm');
    const supported = MediaRecorder.isTypeSupported(mimeType);
    if (!supported) showSnack(`${mimeType} not supported, using default`, 'warning');

    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current, supported ? { mimeType } : {});
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data?.size > 0) {
        chunksRef.current.push(e.data);
        setRecordingSize(chunksRef.current.reduce((a, c) => a + c.size, 0));
      }
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      setRecordedUrl(URL.createObjectURL(blob));
      setRecordedBlob(blob);
      setRecordingSize(blob.size);
    };
    recorder.onerror = () => { showSnack('Recording error', 'error'); stopRecording(); };

    recorder.start(1000);
    setIsRecording(true);
    setIsPaused(false);
    timerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000);
  }, [recordingMode, fileFormat]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current.stop();
    setIsRecording(false);
    setIsPaused(false);
    clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000);
    }
  }, []);

  const discardRecording = useCallback(() => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
    setRecordedBlob(null);
    setRecordingTime(0);
    setRecordingSize(0);
    chunksRef.current = [];
    setUploadStatus(UPLOAD_STATUS.IDLE);
    setUploadProgress(0);
    setUploadError(null);
  }, [recordedUrl]);

  const handleModeChange = (_, newMode) => {
    if (!newMode || isRecording) return;
    setFileFormat('webm');
    setRecordingMode(newMode);
  };

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
          .then(s => s.getTracks().forEach(t => t.stop())).catch(() => {});
        const devs  = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) return;
        const vids  = devs.filter(d => d.kind === 'videoinput');
        const auds  = devs.filter(d => d.kind === 'audioinput');
        setCameras(vids);
        setMicrophones(auds);
        if (vids.length) setSelectedCamera(p => p || vids[0].deviceId);
        if (auds.length) setSelectedMic(p => p || auds[0].deviceId);
      } catch (err) { setStreamError('Cannot access media devices'); }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isRecording && !recordedUrl) startPreview();
  }, [startPreview, isRecording, recordedUrl]);

  useEffect(() => () => {
    uploadAbortController?.abort();
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
  }, []);

  useEffect(() => {
    if (id) { dispatch(fetchMeetingById(id)); loadRecordings(); }
  }, [id, dispatch, loadRecordings]);

  // ── Render guards ──────────────────────────────────────────────────────────
  if (!currentMeeting) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const canRecord = ['started','ongoing','in_progress'].includes(currentMeeting?.status?.short_name);

  <Tabs
    value={canRecord ? activeTab : 1}           // ← force to recordings tab
    onChange={(_, v) => canRecord && setActiveTab(v)}  // ← ignore clicks when locked
    sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
  >
    {canRecord && <Tab label="Record" />}        {/* ← hide Record tab entirely */}
    <Tab
      label={
        <Badge badgeContent={savedRecordings.length} color="primary" max={99}>
          <Box sx={{ pr: savedRecordings.length ? 1.5 : 0 }}>Recordings</Box>
        </Badge>
      }
    />
  </Tabs>

  {!canRecord && (
    <Alert severity="info" icon={<MeetingRoom />} sx={{ mb: 2 }}>
      This meeting hasn't started yet — recording is disabled. Existing recordings are shown below.
    </Alert>
  )}


  const isAudioMode     = recordingMode === RECORDING_MODE.audio;
  const activeFormats   = isAudioMode ? AUDIO_FORMATS : RECORDING_FORMATS;
  const isUploading     = uploadStatus === UPLOAD_STATUS.UPLOADING;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      {/* ── Header ── */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ lineHeight: 1.2 }}>
            Meeting Recorder
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {currentMeeting?.title}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<ArrowBack />}
          onClick={() => navigate(`/meetings/${id}`)}
        >
          Back
        </Button>
      </Stack>

      {/* ── Tabs ── */}
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="Record" />
        <Tab
          label={
            <Badge badgeContent={savedRecordings.length} color="primary" max={99}>
              <Box sx={{ pr: savedRecordings.length ? 1.5 : 0 }}>Recordings</Box>
            </Badge>
          }
        />
      </Tabs>

      {/* ══════════════════════ RECORD TAB ══════════════════════ */}
      {canRecord && activeTab === 0 && (
        <Grid container spacing={3}>

          {/* ── Left: preview / visualizer ── */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Paper
              elevation={0}
              sx={{
                borderRadius: 3,
                overflow: 'hidden',
                border: `1px solid ${theme.palette.divider}`,
                bgcolor: theme.palette.mode === 'dark' ? '#0d0d0d' : '#f9f9f9',
              }}
            >
              {/* Preview area */}
              <Box sx={{ position: 'relative', minHeight: 280 }}>

                {/* Audio mode — waveform visualizer */}
                {isAudioMode && !recordedUrl && (
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: 280,
                      p: 4,
                      gap: 3,
                    }}
                  >
                    <Box
                      sx={{
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: isRecording && !isPaused
                          ? alpha(theme.palette.error.main, 0.12)
                          : alpha(theme.palette.primary.main, 0.08),
                        border: `2px solid ${isRecording && !isPaused
                          ? theme.palette.error.main
                          : theme.palette.primary.main}`,
                        transition: 'all 0.3s',
                      }}
                    >
                      <Mic
                        sx={{
                          fontSize: 36,
                          color: isRecording && !isPaused ? 'error.main' : 'primary.main',
                        }}
                      />
                    </Box>
                    <AudioWaveform active={isRecording && !isPaused} />
                    {isRecording && <RecordingBadge time={recordingTime} isPaused={isPaused} />}
                    {!isRecording && !streamReady && !streamError && (
                      <Typography variant="body2" color="text.secondary">
                        Initialising microphone…
                      </Typography>
                    )}
                    {streamReady && !isRecording && (
                      <Typography variant="body2" color="text.secondary">
                        Microphone ready · press Start Recording
                      </Typography>
                    )}
                  </Box>
                )}

                {/* Video mode — live preview */}
                {!isAudioMode && !recordedUrl && (
                  <>
                    <video
                      ref={videoElementRef}
                      autoPlay
                      playsInline
                      muted
                      style={{ width: '100%', display: 'block', backgroundColor: '#000', minHeight: 280 }}
                    />
                    {isRecording && (
                      <Box sx={{ position: 'absolute', top: 12, left: 12, bgcolor: 'rgba(0,0,0,0.6)', borderRadius: 2, px: 1.5, py: 0.5 }}>
                        <RecordingBadge time={recordingTime} isPaused={isPaused} />
                      </Box>
                    )}
                  </>
                )}

                {/* Playback after recording */}
                {recordedUrl && (
                  isAudioMode ? (
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: 280,
                        gap: 3,
                        p: 4,
                      }}
                    >
                      <Box
                        sx={{
                          width: 80,
                          height: 80,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: alpha(theme.palette.success.main, 0.1),
                          border: `2px solid ${theme.palette.success.main}`,
                        }}
                      >
                        <CheckCircle sx={{ fontSize: 36, color: 'success.main' }} />
                      </Box>
                      <Typography variant="body2" fontWeight={600} color="success.main">
                        Recording complete
                      </Typography>
                      <audio src={recordedUrl} controls style={{ width: '90%', maxWidth: 420 }} />
                      <Stack direction="row" spacing={2}>
                        <Chip icon={<Timer sx={{ fontSize: 14 }} />} label={formatTime(recordingTime)} size="small" />
                        <Chip icon={<Storage sx={{ fontSize: 14 }} />} label={formatFileSize(recordingSize)} size="small" />
                      </Stack>
                    </Box>
                  ) : (
                    <video src={recordedUrl} controls style={{ width: '100%', display: 'block', maxHeight: 500 }} />
                  )
                )}

                {/* Stream error overlay */}
                {streamError && !streamReady && !isRecording && !recordedUrl && (
                  <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
                    <Alert
                      severity="error"
                      icon={<Warning />}
                      action={<Button size="small" onClick={startPreview}>Retry</Button>}
                    >
                      {streamError}
                    </Alert>
                  </Box>
                )}
              </Box>
            </Paper>
          </Grid>

          {/* ── Right: controls ── */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={2}>

              {/* Mode toggle */}
              <Card elevation={0} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 3 }}>
                <CardContent sx={{ pb: '16px !important' }}>
                  <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
                    Mode
                  </Typography>
                  <ToggleButtonGroup
                    value={recordingMode}
                    exclusive
                    onChange={handleModeChange}
                    fullWidth
                    size="small"
                    disabled={isRecording}
                    sx={{ mt: 1 }}
                  >
                    <ToggleButton value={RECORDING_MODE.audio} sx={{ gap: 0.75, py: 1 }}>
                      <Mic fontSize="small" />
                      Audio
                    </ToggleButton>
                    <ToggleButton value={RECORDING_MODE.video} sx={{ gap: 0.75, py: 1 }}>
                      <Videocam fontSize="small" />
                      Video
                    </ToggleButton>
                  </ToggleButtonGroup>
                </CardContent>
              </Card>

              {/* Main controls */}
              <Card elevation={0} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 3 }}>
                <CardContent sx={{ pb: '16px !important' }}>
                  <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
                    Controls
                  </Typography>

                  <Box sx={{ mt: 1.5 }}>
                    {!recordedUrl ? (
                      !isRecording ? (
                        <Button
                          variant="contained"
                          color="error"
                          fullWidth
                          size="large"
                          startIcon={<RadioButtonChecked />}
                          onClick={startRecording}
                          disabled={!streamReady}
                          sx={{ py: 1.5, borderRadius: 2, fontWeight: 700 }}
                        >
                          Start Recording
                        </Button>
                      ) : (
                        <Stack spacing={1.5}>
                          {/* Timer display */}
                          <Box
                            sx={{
                              textAlign: 'center',
                              py: 1.5,
                              borderRadius: 2,
                              bgcolor: isPaused
                                ? alpha(theme.palette.warning.main, 0.08)
                                : alpha(theme.palette.error.main, 0.06),
                            }}
                          >
                            <RecordingBadge time={recordingTime} isPaused={isPaused} />
                          </Box>
                          <Stack direction="row" spacing={1}>
                            <Button
                              variant="outlined"
                              color={isPaused ? 'primary' : 'warning'}
                              fullWidth
                              startIcon={isPaused ? <PlayArrow /> : <Pause />}
                              onClick={isPaused ? resumeRecording : pauseRecording}
                              sx={{ borderRadius: 2 }}
                            >
                              {isPaused ? 'Resume' : 'Pause'}
                            </Button>
                            <Button
                              variant="contained"
                              color="error"
                              fullWidth
                              startIcon={<Stop />}
                              onClick={stopRecording}
                              sx={{ borderRadius: 2 }}
                            >
                              Stop
                            </Button>
                          </Stack>
                        </Stack>
                      )
                    ) : (
                      <Stack spacing={1.5}>
                        <Button
                          variant="contained"
                          fullWidth
                          size="large"
                          startIcon={isUploading ? <CircularProgress size={18} color="inherit" /> : <CloudUpload />}
                          onClick={() => setSaveDialogOpen(true)}
                          disabled={isUploading}
                          sx={{ py: 1.5, borderRadius: 2, fontWeight: 700 }}
                        >
                          {isUploading ? 'Uploading…' : 'Save Recording'}
                        </Button>
                        <Button
                          variant="outlined"
                          color="error"
                          fullWidth
                          startIcon={<Delete />}
                          onClick={discardRecording}
                          disabled={isUploading}
                          sx={{ borderRadius: 2 }}
                        >
                          Discard
                        </Button>
                      </Stack>
                    )}
                  </Box>
                </CardContent>
              </Card>

              {/* Advanced settings */}
              <Card elevation={0} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 3 }}>
                <Accordion
                  expanded={advancedOpen}
                  onChange={() => setAdvancedOpen(!advancedOpen)}
                  elevation={0}
                  sx={{ bgcolor: 'transparent', '&:before': { display: 'none' } }}
                >
                  <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: 2, py: 0.5 }}>
                    <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
                      Advanced Settings
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ px: 2, pb: 2 }}>
                    <Stack spacing={1.5}>
                      {!isAudioMode && (
                        <FormControl fullWidth size="small" disabled={isRecording}>
                          <InputLabel>Camera</InputLabel>
                          <Select value={selectedCamera} onChange={e => setSelectedCamera(e.target.value)} label="Camera">
                            {cameras.map(c => (
                              <MenuItem key={c.deviceId} value={c.deviceId}>
                                {c.label || `Camera ${c.deviceId.slice(0,8)}`}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      )}
                      <FormControl fullWidth size="small" disabled={isRecording}>
                        <InputLabel>Microphone</InputLabel>
                        <Select value={selectedMic} onChange={e => setSelectedMic(e.target.value)} label="Microphone">
                          {microphones.map(m => (
                            <MenuItem key={m.deviceId} value={m.deviceId}>
                              {m.label || `Mic ${m.deviceId.slice(0,8)}`}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      {!isAudioMode && (
                        <FormControl fullWidth size="small" disabled={isRecording}>
                          <InputLabel>Quality</InputLabel>
                          <Select value={quality} onChange={e => setQuality(e.target.value)} label="Quality">
                            {Object.entries(RECORDING_QUALITY).map(([k, v]) => (
                              <MenuItem key={k} value={k}>
                                <Stack>
                                  <Typography variant="body2">{v.label}</Typography>
                                  <Typography variant="caption" color="text.secondary">{v.fileSize}</Typography>
                                </Stack>
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      )}
                      <FormControl fullWidth size="small" disabled={isRecording}>
                        <InputLabel>Format</InputLabel>
                        <Select value={fileFormat} onChange={e => setFileFormat(e.target.value)} label="Format">
                          {Object.entries(activeFormats).map(([k, v]) => (
                            <MenuItem key={k} value={k}>
                              <Stack>
                                <Typography variant="body2">{v.label}</Typography>
                                <Typography variant="caption" color="text.secondary">{v.browserSupport}</Typography>
                              </Stack>
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              </Card>

            </Stack>
          </Grid>
        </Grid>
      )}

      {/* ══════════════════════ RECORDINGS TAB ══════════════════════ */}
      {activeTab === 1 && (
        <Paper elevation={0} sx={{ borderRadius: 3, border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
          {loadingRecordings ? (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <CircularProgress size={36} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Loading recordings…
              </Typography>
            </Box>
          ) : savedRecordings.length === 0 ? (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <VolumeUp sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" fontWeight={600} gutterBottom>No Recordings Yet</Typography>
              <Typography variant="body2" color="text.secondary">
                Switch to the Record tab to capture your meeting.
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {savedRecordings.map((rec, i) => (
                <React.Fragment key={rec.id}>
                  <ListItem
                    sx={{
                      px: 3,
                      py: 2,
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                      '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                    }}
                    onClick={() => { setSelectedRecording(rec); setPreviewDialogOpen(true); }}
                  >
                    <ListItemAvatar>
                      <Avatar
                        sx={{
                          bgcolor: rec.mode === 'audio'
                            ? alpha(theme.palette.secondary.main, 0.12)
                            : alpha(theme.palette.primary.main, 0.12),
                          color: rec.mode === 'audio' ? 'secondary.main' : 'primary.main',
                        }}
                      >
                        {rec.mode === 'audio' ? <Mic /> : <Videocam />}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                          <Typography variant="subtitle2" fontWeight={600}>{rec.title}</Typography>
                          {rec.mode === 'audio' && <Chip size="small" label="Audio" color="secondary" variant="outlined" />}
                        </Stack>
                      }
                      secondary={
                        <Stack direction="row" spacing={1.5} sx={{ mt: 0.5 }} flexWrap="wrap" alignItems="center">
                          <Typography variant="caption" color="text.secondary">{getRecordingDate(rec)}</Typography>
                          <Typography variant="caption" color="text.disabled">·</Typography>
                          <Typography variant="caption" color="text.secondary">{formatTime(rec.duration)}</Typography>
                          <Typography variant="caption" color="text.disabled">·</Typography>
                          <Typography variant="caption" color="text.secondary">{formatFileSize(rec.file_size)}</Typography>
                          {rec.quality && (
                            <>
                              <Typography variant="caption" color="text.disabled">·</Typography>
                              <Typography variant="caption" color="text.secondary">{rec.quality}</Typography>
                            </>
                          )}
                        </Stack>
                      }
                    />
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="Download">
                        <IconButton size="small" onClick={e => { e.stopPropagation(); downloadRecording(rec); }}>
                          <Download fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={e => { e.stopPropagation(); deleteRecording(rec.id); }}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </ListItem>
                  {i < savedRecordings.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </Paper>
      )}

      {/* ══════════════════════ SAVE DIALOG ══════════════════════ */}
      <Dialog
        open={saveDialogOpen}
        onClose={() => !isUploading && setSaveDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Save Recording</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <TextField
              fullWidth size="small" label="Title"
              value={recordingName}
              onChange={e => setRecordingName(e.target.value)}
              placeholder={`${currentMeeting?.title} – Recording`}
              disabled={isUploading}
            />
            <TextField
              fullWidth size="small" label="Description (optional)"
              multiline rows={2}
              value={recordingDescription}
              onChange={e => setRecordingDescription(e.target.value)}
              disabled={isUploading}
            />
            <FormControl fullWidth size="small" disabled={isUploading}>
              <InputLabel>Category</InputLabel>
              <Select value={recordingCategory} onChange={e => setRecordingCategory(e.target.value)} label="Category">
                <MenuItem value="meeting">Meeting Recording</MenuItem>
                <MenuItem value="presentation">Presentation</MenuItem>
                <MenuItem value="discussion">Discussion</MenuItem>
                <MenuItem value="training">Training</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>

            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.info.main, 0.06), border: `1px solid ${alpha(theme.palette.info.main, 0.2)}` }}>
              <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                <Chip icon={<Timer sx={{ fontSize: 14 }} />} size="small" label={formatTime(recordingTime)} />
                <Chip icon={<Storage sx={{ fontSize: 14 }} />} size="small" label={formatFileSize(recordingSize)} />
                <Chip icon={isAudioMode ? <Mic sx={{ fontSize: 14 }} /> : <Videocam sx={{ fontSize: 14 }} />} size="small"
                  label={isAudioMode ? 'Audio' : `Video · ${quality}`} />
              </Stack>
            </Box>

            {isUploading && (
              <Box>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
                  <Typography variant="caption" fontWeight={600}>Uploading…</Typography>
                  <Typography variant="caption" fontWeight={600}>{uploadProgress}%</Typography>
                </Stack>
                <LinearProgress variant="determinate" value={uploadProgress} sx={{ height: 6, borderRadius: 3 }} />
                <Button size="small" color="error" onClick={cancelUpload} sx={{ mt: 1 }}>
                  Cancel
                </Button>
              </Box>
            )}

            {uploadStatus === UPLOAD_STATUS.ERROR && uploadError && (
              <Alert severity="error" action={
                <Button color="inherit" size="small" startIcon={<Replay />} onClick={saveRecording}>
                  Retry
                </Button>
              }>
                {uploadError}
              </Alert>
            )}

            {uploadStatus === UPLOAD_STATUS.SUCCESS && (
              <Alert severity="success" icon={<CloudDone />}>Recording saved!</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSaveDialogOpen(false)} disabled={isUploading}>Cancel</Button>
          <Button
            variant="contained"
            onClick={saveRecording}
            disabled={isUploading || uploadStatus === UPLOAD_STATUS.SUCCESS}
            startIcon={isUploading ? <CircularProgress size={18} color="inherit" /> : <CloudUpload />}
          >
            {isUploading ? 'Uploading…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ══════════════════════ PREVIEW DIALOG ══════════════════════ */}
      <Dialog
        open={previewDialogOpen}
        onClose={() => setPreviewDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>{selectedRecording?.title}</DialogTitle>
        <DialogContent sx={{ pt: 0 }}>
          <Box sx={{ borderRadius: 2, overflow: 'hidden', bgcolor: '#000' }}>
            {selectedRecording?.mode === 'audio' ? (
              <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                <GraphicEq sx={{ fontSize: 56, color: 'primary.main' }} />
                <audio src={selectedRecording?.url} controls style={{ width: '100%' }} />
              </Box>
            ) : (
              <video src={selectedRecording?.url} controls style={{ width: '100%', maxHeight: 460 }} />
            )}
          </Box>
          {selectedRecording?.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              {selectedRecording.description}
            </Typography>
          )}
          <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap">
            <Chip size="small" label={formatTime(selectedRecording?.duration || 0)} />
            <Chip size="small" label={formatFileSize(selectedRecording?.file_size || 0)} />
            {selectedRecording?.quality && <Chip size="small" label={selectedRecording.quality} />}
            {selectedRecording?.format && <Chip size="small" label={selectedRecording.format.toUpperCase()} />}
            <Chip size="small" label={getRecordingDate(selectedRecording || {})} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPreviewDialogOpen(false)}>Close</Button>
          <Button startIcon={<Download />} onClick={() => downloadRecording(selectedRecording)}>Download</Button>
          <Button color="error" startIcon={<Delete />} onClick={() => { deleteRecording(selectedRecording.id); setPreviewDialogOpen(false); }}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Snackbar ── */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(p => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          onClose={() => setSnackbar(p => ({ ...p, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default MeetingRecorder;