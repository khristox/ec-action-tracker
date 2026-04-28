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
  MeetingRoom,
  Timer,
  Storage,
  GraphicEq,
  ExpandMore,
  CloudDone,
  Warning,
  Replay,
  Delete,
  ArrowBack,
  CheckCircle,
  RadioButtonChecked,
  VolumeUp,
  History,
  PlayCircle,
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

// ─── Audio Waveform ──────────────────────────────────────────────────────────
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

// ============================================================================
const MeetingRecorder = () => {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const dispatch  = useDispatch();
  const theme     = useTheme();
  const isMobile  = useMediaQuery(theme.breakpoints.down('sm'));

  const currentMeeting = useSelector(selectCurrentMeeting);

  // ── Mode ──────────────────────────────────────────────────────────────────
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
  const [isPlaying,            setIsPlaying]            = useState(false);
  const [streamUrl,            setStreamUrl]            = useState(null);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const videoElementRef  = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef        = useRef(null);
  const timerRef         = useRef(null);
  const chunksRef        = useRef([]);
  const audioRef         = useRef(null);

  // ── Check if meeting has started ───────────────────────────────────────────
  const canRecord = currentMeeting && ['started', 'ongoing', 'in_progress'].includes(currentMeeting?.status?.short_name);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const showSnack = (message, severity = 'success') =>
    setSnackbar({ open: true, message, severity });

  const getRecordingDate = (rec) => {
    if (!rec?.created_at) return '—';
    return formatDate(rec.created_at);
  };

  // ── Device enumeration ─────────────────────────────────────────────────────
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

  // ── Start preview function ─────────────────────────────────────────────────
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

  // ── Recording functions ────────────────────────────────────────────────────
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

  // ── Start preview when settings change (only if not recording) ────────────
  useEffect(() => {
    if (!isRecording && !recordedUrl && canRecord) {
      startPreview();
    }
  }, [startPreview, isRecording, recordedUrl, canRecord]);

  // ── Function to get authenticated stream URL as blob ───────────────────────
  const getAuthenticatedStreamUrl = useCallback(async (recording) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        console.error('No auth token found');
        showSnack('Authentication required to play this recording', 'warning');
        return null;
      }
      
      const response = await fetch(recording.stream_url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch stream: ${response.status}`);
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      return url;
    } catch (error) {
      console.error('Error fetching authenticated stream:', error);
      showSnack('Failed to load recording stream', 'error');
      return null;
    }
  }, []);

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
        stream_url: r.stream_url || `/api/v1/meetings/${id}/recordings/${r.id}/stream`,
        download_url: r.download_url || `/api/v1/meetings/${id}/recordings/${r.id}/download`,
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
      if (selectedRecording?.id === recordingId) {
        setSelectedRecording(null);
        setPreviewDialogOpen(false);
      }
    } catch (err) {
      showSnack('Failed to delete recording', 'error');
    }
  }, [id, loadRecordings, selectedRecording]);

  const downloadRecording = useCallback((recording) => {
    window.open(recording.download_url, '_blank');
  }, []);

  // ── Upload function ────────────────────────────────────────────────────────
  const saveRecording = useCallback(async () => {
    if (!recordedBlob || !currentMeeting) return;
    setUploadStatus(UPLOAD_STATUS.UPLOADING);
    setUploadProgress(0);
    setUploadError(null);

    const ctrl = new AbortController();
    setUploadAbortController(ctrl);

    const isAudio = recordingMode === RECORDING_MODE.audio;
    const formats = isAudio ? AUDIO_FORMATS : RECORDING_FORMATS;
    const ext = formats[fileFormat]?.extension || '.webm';
    const base = recordingName || currentMeeting.title || 'recording';
    const fileName = `${base.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}${ext}`;

    const fd = new FormData();
    fd.append('file', recordedBlob, fileName);
    fd.append('title', recordingName || `${currentMeeting.title} - Recording`);
    fd.append('description', recordingDescription);
    fd.append('category', recordingCategory);
    fd.append('duration', recordingTime);
    fd.append('quality', isAudio ? 'audio' : quality);
    fd.append('format', fileFormat);
    fd.append('file_size', recordedBlob.size);
    fd.append('mode', recordingMode);

    try {
      const xhr = new XMLHttpRequest();
      await new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        });
        xhr.addEventListener('load', () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Status ${xhr.status}`)));
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
      recordingCategory, recordingTime, quality, fileFormat, recordingMode, loadRecordings, discardRecording]);

  const cancelUpload = useCallback(() => {
    uploadAbortController?.abort();
    setUploadStatus(UPLOAD_STATUS.IDLE);
    setUploadProgress(0);
    setUploadError(null);
    showSnack('Upload cancelled', 'info');
  }, [uploadAbortController]);

  // ── Handle opening preview with authenticated stream ───────────────────────
  const handleOpenPreview = useCallback(async (recording) => {
    setSelectedRecording(recording);
    setPreviewDialogOpen(true);
    setIsPlaying(false);
    
    if (streamUrl && streamUrl.startsWith('blob:')) {
      URL.revokeObjectURL(streamUrl);
      setStreamUrl(null);
    }
    
    const authenticatedUrl = await getAuthenticatedStreamUrl(recording);
    if (authenticatedUrl) {
      setStreamUrl(authenticatedUrl);
    } else {
      setStreamUrl(recording.stream_url);
    }
  }, [getAuthenticatedStreamUrl, streamUrl]);

  // ── Initial data fetch ─────────────────────────────────────────────────────
  useEffect(() => {
    if (id) { 
      dispatch(fetchMeetingById(id)); 
      loadRecordings(); 
    }
  }, [id, dispatch, loadRecordings]);

  // ── Clean up on unmount ────────────────────────────────────────────────────
  useEffect(() => () => {
    uploadAbortController?.abort();
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    if (streamUrl && streamUrl.startsWith('blob:')) URL.revokeObjectURL(streamUrl);
  }, []);

  // ── Clean up blob URL when dialog closes ───────────────────────────────────
  useEffect(() => {
    return () => {
      if (streamUrl && streamUrl.startsWith('blob:')) {
        URL.revokeObjectURL(streamUrl);
      }
    };
  }, [streamUrl]);

  // Show loading state
  if (!currentMeeting) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const isAudioMode = recordingMode === RECORDING_MODE.audio;
  const activeFormats = isAudioMode ? AUDIO_FORMATS : RECORDING_FORMATS;
  const isUploading = uploadStatus === UPLOAD_STATUS.UPLOADING;

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Meeting Recorder</Typography>
          <Typography variant="body2" color="text.secondary">{currentMeeting?.title}</Typography>
        </Box>
        <Button variant="outlined" size="small" startIcon={<ArrowBack />} onClick={() => navigate(`/meetings/${id}`)}>
          Back to Meeting
        </Button>
      </Stack>

      {/* If meeting hasn't started, show only recordings */}
      {!canRecord ? (
        <>
          <Alert 
            severity="info" 
            icon={<MeetingRoom />}
            sx={{ mb: 3, borderRadius: 2 }}
          >
            <Typography variant="body1" fontWeight={600}>Meeting Not Started</Typography>
            <Typography variant="body2">
              Recording is only available when the meeting has started. You can view past recordings below.
            </Typography>
          </Alert>

          {/* Recordings List */}
          <Paper sx={{ borderRadius: 3, border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
            <Box sx={{ px: 3, py: 2, borderBottom: `1px solid ${theme.palette.divider}`, bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
              <Typography variant="subtitle1" fontWeight={600}>
                <History sx={{ mr: 1, verticalAlign: 'middle' }} />
                Past Recordings ({savedRecordings.length})
              </Typography>
            </Box>
            
            {loadingRecordings ? (
              <Box sx={{ p: 6, textAlign: 'center' }}>
                <CircularProgress size={36} />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Loading recordings…</Typography>
              </Box>
            ) : savedRecordings.length === 0 ? (
              <Box sx={{ p: 6, textAlign: 'center' }}>
                <History sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" fontWeight={600} gutterBottom>No Recordings Available</Typography>
                <Typography variant="body2" color="text.secondary">
                  No recordings have been saved for this meeting yet.
                </Typography>
              </Box>
            ) : (
              <List disablePadding>
                {savedRecordings.map((rec, i) => (
                  <React.Fragment key={rec.id}>
                    <ListItem
                      sx={{ px: 3, py: 2, '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) } }}
                    >
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: rec.mode === 'audio' ? alpha(theme.palette.secondary.main, 0.12) : alpha(theme.palette.primary.main, 0.12), color: rec.mode === 'audio' ? 'secondary.main' : 'primary.main' }}>
                          {rec.mode === 'audio' ? <Mic /> : <Videocam />}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={<Typography variant="subtitle2" fontWeight={600}>{rec.title}</Typography>}
                        secondary={
                          <Stack direction="row" spacing={1.5} sx={{ mt: 0.5 }} flexWrap="wrap" alignItems="center">
                            <Typography variant="caption" color="text.secondary">{getRecordingDate(rec)}</Typography>
                            <Typography variant="caption" color="text.disabled">·</Typography>
                            <Typography variant="caption" color="text.secondary">{formatTime(rec.duration)}</Typography>
                            <Typography variant="caption" color="text.disabled">·</Typography>
                            <Typography variant="caption" color="text.secondary">{formatFileSize(rec.file_size)}</Typography>
                          </Stack>
                        }
                      />
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Play Recording">
                          <IconButton 
                            size="small" 
                            color="primary" 
                            onClick={() => handleOpenPreview(rec)}
                          >
                            <PlayCircle fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Download">
                          <IconButton size="small" onClick={() => downloadRecording(rec)}>
                            <Download fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => deleteRecording(rec.id)}>
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
        </>
      ) : (
        // Meeting has started - show full recording interface
        <>
          <Alert 
            severity="success" 
            icon={<CheckCircle />}
            sx={{ mb: 3, borderRadius: 2 }}
          >
            <Typography variant="body1" fontWeight={600}>Meeting In Progress</Typography>
            <Typography variant="body2">You can now record this meeting.</Typography>
          </Alert>

          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
            <Tab label="Record New" />
            <Tab label={<Badge badgeContent={savedRecordings.length} color="primary" max={99}>Past Recordings</Badge>} />
          </Tabs>

          {activeTab === 0 ? (
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 8 }}>
                <Paper sx={{ borderRadius: 3, overflow: 'hidden', border: `1px solid ${theme.palette.divider}` }}>
                  <Box sx={{ position: 'relative', minHeight: 280 }}>
                    {isAudioMode && !recordedUrl && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 280, p: 4, gap: 3 }}>
                        <Box sx={{ width: 80, height: 80, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: alpha(theme.palette.primary.main, 0.08), border: `2px solid ${theme.palette.primary.main}` }}>
                          <Mic sx={{ fontSize: 36, color: 'primary.main' }} />
                        </Box>
                        <AudioWaveform active={isRecording && !isPaused} />
                        {isRecording && <RecordingBadge time={recordingTime} isPaused={isPaused} />}
                        {streamError && (
                          <Alert severity="error" sx={{ mt: 2 }}>{streamError}</Alert>
                        )}
                      </Box>
                    )}
                    {!isAudioMode && !recordedUrl && (
                      <video ref={videoElementRef} autoPlay playsInline muted style={{ width: '100%', display: 'block', backgroundColor: '#000', minHeight: 280 }} />
                    )}
                    {recordedUrl && (
                      isAudioMode ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 280, gap: 3, p: 4 }}>
                          <CheckCircle sx={{ fontSize: 48, color: 'success.main' }} />
                          <Typography variant="body2" fontWeight={600} color="success.main">Recording complete</Typography>
                          <audio src={recordedUrl} controls style={{ width: '90%', maxWidth: 420 }} />
                        </Box>
                      ) : (
                        <video src={recordedUrl} controls style={{ width: '100%', display: 'block', maxHeight: 500 }} />
                      )
                    )}
                  </Box>
                </Paper>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Stack spacing={2}>
                  <Card sx={{ borderRadius: 3 }}>
                    <CardContent>
                      <Typography variant="overline" color="text.secondary">Controls</Typography>
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
                              disabled={!streamReady && !streamError}
                              sx={{ py: 1.5, borderRadius: 2, fontWeight: 700 }}
                            >
                              Start Recording
                            </Button>
                          ) : (
                            <Stack spacing={1.5}>
                              <Box sx={{ textAlign: 'center', py: 1.5, borderRadius: 2, bgcolor: isPaused ? alpha(theme.palette.warning.main, 0.08) : alpha(theme.palette.error.main, 0.06) }}>
                                <RecordingBadge time={recordingTime} isPaused={isPaused} />
                              </Box>
                              <Stack direction="row" spacing={1}>
                                <Button variant="outlined" color={isPaused ? 'primary' : 'warning'} fullWidth startIcon={isPaused ? <PlayArrow /> : <Pause />} onClick={isPaused ? resumeRecording : pauseRecording}>
                                  {isPaused ? 'Resume' : 'Pause'}
                                </Button>
                                <Button variant="contained" color="error" fullWidth startIcon={<Stop />} onClick={stopRecording}>Stop</Button>
                              </Stack>
                            </Stack>
                          )
                        ) : (
                          <Stack spacing={1.5}>
                            <Button variant="contained" fullWidth startIcon={<CloudUpload />} onClick={() => setSaveDialogOpen(true)} sx={{ py: 1.5 }}>Save Recording</Button>
                            <Button variant="outlined" color="error" fullWidth startIcon={<Delete />} onClick={discardRecording}>Discard</Button>
                          </Stack>
                        )}
                      </Box>
                    </CardContent>
                  </Card>

                  <Card sx={{ borderRadius: 3 }}>
                    <Accordion expanded={advancedOpen} onChange={() => setAdvancedOpen(!advancedOpen)} elevation={0} sx={{ bgcolor: 'transparent' }}>
                      <AccordionSummary expandIcon={<ExpandMore />}>
                        <Typography variant="overline" color="text.secondary">Advanced Settings</Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Stack spacing={1.5}>
                          {!isAudioMode && (
                            <FormControl fullWidth size="small" disabled={isRecording}>
                              <InputLabel>Camera</InputLabel>
                              <Select value={selectedCamera} onChange={e => setSelectedCamera(e.target.value)} label="Camera">
                                {cameras.map(c => (<MenuItem key={c.deviceId} value={c.deviceId}>{c.label || `Camera ${c.deviceId.slice(0,8)}`}</MenuItem>))}
                              </Select>
                            </FormControl>
                          )}
                          <FormControl fullWidth size="small" disabled={isRecording}>
                            <InputLabel>Microphone</InputLabel>
                            <Select value={selectedMic} onChange={e => setSelectedMic(e.target.value)} label="Microphone">
                              {microphones.map(m => (<MenuItem key={m.deviceId} value={m.deviceId}>{m.label || `Mic ${m.deviceId.slice(0,8)}`}</MenuItem>))}
                            </Select>
                          </FormControl>
                          {!isAudioMode && (
                            <FormControl fullWidth size="small" disabled={isRecording}>
                              <InputLabel>Quality</InputLabel>
                              <Select value={quality} onChange={e => setQuality(e.target.value)} label="Quality">
                                {Object.entries(RECORDING_QUALITY).map(([k, v]) => (<MenuItem key={k} value={k}>{v.label} · {v.fileSize}</MenuItem>))}
                              </Select>
                            </FormControl>
                          )}
                          <FormControl fullWidth size="small" disabled={isRecording}>
                            <InputLabel>Format</InputLabel>
                            <Select value={fileFormat} onChange={e => setFileFormat(e.target.value)} label="Format">
                              {Object.entries(activeFormats).map(([k, v]) => (<MenuItem key={k} value={k}>{v.label}</MenuItem>))}
                            </Select>
                          </FormControl>
                        </Stack>
                      </AccordionDetails>
                    </Accordion>
                  </Card>
                </Stack>
              </Grid>
            </Grid>
          ) : (
            // Past Recordings Tab when meeting has started
            <Paper sx={{ borderRadius: 3, border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
              <Box sx={{ px: 3, py: 2, borderBottom: `1px solid ${theme.palette.divider}`, bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  <History sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Past Recordings ({savedRecordings.length})
                </Typography>
              </Box>
              
              {loadingRecordings ? (
                <Box sx={{ p: 6, textAlign: 'center' }}>
                  <CircularProgress size={36} />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Loading recordings…</Typography>
                </Box>
              ) : savedRecordings.length === 0 ? (
                <Box sx={{ p: 6, textAlign: 'center' }}>
                  <History sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                  <Typography variant="h6" fontWeight={600} gutterBottom>No Recordings Yet</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Start recording to save your first meeting.
                  </Typography>
                </Box>
              ) : (
                <List disablePadding>
                  {savedRecordings.map((rec, i) => (
                    <React.Fragment key={rec.id}>
                      <ListItem
                        sx={{ px: 3, py: 2, '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) } }}
                      >
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: rec.mode === 'audio' ? alpha(theme.palette.secondary.main, 0.12) : alpha(theme.palette.primary.main, 0.12), color: rec.mode === 'audio' ? 'secondary.main' : 'primary.main' }}>
                            {rec.mode === 'audio' ? <Mic /> : <Videocam />}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={<Typography variant="subtitle2" fontWeight={600}>{rec.title}</Typography>}
                          secondary={
                            <Stack direction="row" spacing={1.5} sx={{ mt: 0.5 }} flexWrap="wrap" alignItems="center">
                              <Typography variant="caption" color="text.secondary">{getRecordingDate(rec)}</Typography>
                              <Typography variant="caption" color="text.disabled">·</Typography>
                              <Typography variant="caption" color="text.secondary">{formatTime(rec.duration)}</Typography>
                              <Typography variant="caption" color="text.disabled">·</Typography>
                              <Typography variant="caption" color="text.secondary">{formatFileSize(rec.file_size)}</Typography>
                            </Stack>
                          }
                        />
                        <Stack direction="row" spacing={0.5}>
                          <Tooltip title="Play Recording">
                            <IconButton size="small" color="primary" onClick={() => handleOpenPreview(rec)}>
                              <PlayCircle fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Download">
                            <IconButton size="small" onClick={() => downloadRecording(rec)}>
                              <Download fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => deleteRecording(rec.id)}>
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
        </>
      )}

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onClose={() => !isUploading && setSaveDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Save Recording</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField fullWidth size="small" label="Title" value={recordingName} onChange={e => setRecordingName(e.target.value)} placeholder={`${currentMeeting?.title} – Recording`} disabled={isUploading} />
            <TextField fullWidth size="small" label="Description (optional)" multiline rows={2} value={recordingDescription} onChange={e => setRecordingDescription(e.target.value)} disabled={isUploading} />
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
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.info.main, 0.06) }}>
              <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                <Chip icon={<Timer sx={{ fontSize: 14 }} />} size="small" label={formatTime(recordingTime)} />
                <Chip icon={<Storage sx={{ fontSize: 14 }} />} size="small" label={formatFileSize(recordingSize)} />
              </Stack>
            </Box>
            {isUploading && (
              <Box>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
                  <Typography variant="caption" fontWeight={600}>Uploading…</Typography>
                  <Typography variant="caption" fontWeight={600}>{uploadProgress}%</Typography>
                </Stack>
                <LinearProgress variant="determinate" value={uploadProgress} sx={{ height: 6, borderRadius: 3 }} />
                <Button size="small" color="error" onClick={cancelUpload} sx={{ mt: 1 }}>Cancel</Button>
              </Box>
            )}
            {uploadStatus === UPLOAD_STATUS.ERROR && uploadError && (
              <Alert severity="error" action={<Button color="inherit" size="small" startIcon={<Replay />} onClick={saveRecording}>Retry</Button>}>{uploadError}</Alert>
            )}
            {uploadStatus === UPLOAD_STATUS.SUCCESS && <Alert severity="success" icon={<CloudDone />}>Recording saved!</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)} disabled={isUploading}>Cancel</Button>
          <Button variant="contained" onClick={saveRecording} disabled={isUploading || uploadStatus === UPLOAD_STATUS.SUCCESS} startIcon={isUploading ? <CircularProgress size={18} /> : <CloudUpload />}>
            {isUploading ? 'Uploading…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog 
        open={previewDialogOpen} 
        onClose={() => { 
          setPreviewDialogOpen(false); 
          if (streamUrl && streamUrl.startsWith('blob:')) {
            URL.revokeObjectURL(streamUrl);
            setStreamUrl(null);
          }
        }} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>{selectedRecording?.title}</DialogTitle>
        <DialogContent>
          <Box sx={{ borderRadius: 2, overflow: 'hidden', bgcolor: '#000', minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {!streamUrl ? (
              <CircularProgress />
            ) : selectedRecording?.mode === 'audio' ? (
              <Box sx={{ p: 4, width: '100%' }}>
                <audio src={streamUrl} controls autoPlay style={{ width: '100%' }} />
              </Box>
            ) : (
              <video src={streamUrl} controls autoPlay style={{ width: '100%', maxHeight: 460 }} />
            )}
          </Box>
          {selectedRecording?.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>{selectedRecording.description}</Typography>
          )}
          <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap">
            <Chip size="small" label={formatTime(selectedRecording?.duration || 0)} />
            <Chip size="small" label={formatFileSize(selectedRecording?.file_size || 0)} />
            <Chip size="small" label={getRecordingDate(selectedRecording || {})} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewDialogOpen(false)}>Close</Button>
          <Button startIcon={<Download />} onClick={() => downloadRecording(selectedRecording)}>Download</Button>
          <Button color="error" startIcon={<Delete />} onClick={() => { deleteRecording(selectedRecording.id); setPreviewDialogOpen(false); }}>Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(p => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Container>
  );
};

export default MeetingRecorder;