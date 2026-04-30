import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Container, Paper, Typography, Button, IconButton, Stack,
  Alert, CircularProgress, Card, CardContent, Grid, Chip, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  FormControl, InputLabel, Select, MenuItem, Tooltip, Snackbar,
  useTheme, alpha, Tabs, Tab, LinearProgress, Accordion,
  AccordionSummary, AccordionDetails, Badge,
  List, ListItem, ListItemAvatar, ListItemText, Avatar,
} from '@mui/material';
import {
  Stop, Pause, PlayArrow, Videocam, Mic,
  CloudUpload, Download, Timer, Storage,
  ExpandMore, CloudDone, Delete, CheckCircle,
  RadioButtonChecked, History, PlayCircle,
} from '@mui/icons-material';
import { format } from 'date-fns';
import api from '../../../services/api';
import { useMeetingRecorder, RECORDING_MODE } from '../../../context/MeetingRecorderContext';
import { fetchMeetingById, selectCurrentMeeting } from '../../../store/slices/actionTracker/meetingSlice';

// ─── Formatters ───────────────────────────────────────────────────────────────
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

// ─── Recording Badge ──────────────────────────────────────────────────────────
const RecordingBadge = ({ time, isPaused }) => (
  <Stack direction="row" alignItems="center" spacing={1}>
    <Box
      sx={{
        width: 10, height: 10, borderRadius: '50%',
        bgcolor: isPaused ? 'warning.main' : 'error.main',
        animation: isPaused ? 'none' : 'pulse 1.5s infinite',
        '@keyframes pulse': {
          '0%,100%': { opacity: 1, transform: 'scale(1)' },
          '50%':     { opacity: 0.5, transform: 'scale(0.85)' },
        },
      }}
    />
    <Typography variant="caption" fontFamily="monospace" fontWeight={700}>
      {isPaused ? 'PAUSED' : 'REC'} · {formatTime(time)}
    </Typography>
  </Stack>
);

// ─── Audio Waveform ───────────────────────────────────────────────────────────
const AudioWaveform = ({ active, barCount = 40 }) => (
  <Box sx={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'3px', height: 64 }}>
    {Array.from({ length: barCount }).map((_, i) => (
      <Box
        key={i}
        sx={{
          width: 3, borderRadius: 2,
          bgcolor: active ? 'primary.main' : 'action.disabled',
          height: active ? undefined : 6,
          animation: active ? `wave ${0.6 + (i % 7) * 0.1}s ease-in-out infinite alternate` : 'none',
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

// ─── Main Component ───────────────────────────────────────────────────────────
const MeetingRecorder = ({ meetingId, meetingStatus, onRefresh }) => {
  const { id }         = useParams();
  const dispatch       = useDispatch();
  const theme          = useTheme();
  const effectiveId    = meetingId || id;
  const currentMeeting = useSelector(selectCurrentMeeting);
  const recorder       = useMeetingRecorder();

  // ── Local UI state ──────────────────────────────────────────────────────
  const [activeTab,             setActiveTab]             = useState(0);
  const [saveDialogOpen,        setSaveDialogOpen]        = useState(false);
  const [previewDialogOpen,     setPreviewDialogOpen]     = useState(false);
  const [selectedRecording,     setSelectedRecording]     = useState(null);
  const [savedRecordings,       setSavedRecordings]       = useState([]);
  const [loadingRecordings,     setLoadingRecordings]     = useState(false);
  const [uploadStatus,          setUploadStatus]          = useState('idle');
  const [uploadProgress,        setUploadProgress]        = useState(0);
  const [uploadError,           setUploadError]           = useState(null);
  const [recordingName,         setRecordingName]         = useState('');
  const [recordingDescription,  setRecordingDescription]  = useState('');
  const [recordingCategory,     setRecordingCategory]     = useState('meeting');
  const [snackbar,              setSnackbar]              = useState({ open: false, message: '', severity: 'success' });
  const [advancedOpen,          setAdvancedOpen]          = useState(false);
  const [streamUrl,             setStreamUrl]             = useState(null);

  // ── Derived ─────────────────────────────────────────────────────────────
  const isAudioMode   = recorder.recordingMode === RECORDING_MODE.audio;
  const activeFormats = isAudioMode ? recorder.AUDIO_FORMATS : recorder.RECORDING_FORMATS;

  // FIX #4: button is always enabled in audio mode; in video mode wait for stream
  const canStart = isAudioMode
    ? true
    : (recorder.streamReady && !recorder.streamError);

  // ── Effects ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (effectiveId) recorder.setMeetingId(effectiveId);
  }, [effectiveId]);    // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    recorder.enumerateDevices();
  }, []);              // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (effectiveId) {
      loadRecordings();
      if (!currentMeeting) dispatch(fetchMeetingById(effectiveId));
    }
  }, [effectiveId]);   // eslint-disable-line react-hooks/exhaustive-deps

  // ── Recordings CRUD ─────────────────────────────────────────────────────
  const loadRecordings = useCallback(async () => {
    if (!effectiveId) return;
    setLoadingRecordings(true);
    try {
      const res = await api.get(`/meetings/${effectiveId}/recordings`);
      const raw = res.data.items || res.data || [];
      setSavedRecordings(raw.map(r => ({
        ...r,
        created_at:   r.created_at ? new Date(r.created_at) : null,
        duration:     r.duration   || 0,
        file_size:    r.file_size  || 0,
        stream_url:   r.stream_url   || `/api/v1/meetings/${effectiveId}/recordings/${r.id}/stream`,
        download_url: r.download_url || `/api/v1/meetings/${effectiveId}/recordings/${r.id}/download`,
      })));
    } catch {
      showSnack('Failed to load recordings', 'error');
    } finally {
      setLoadingRecordings(false);
    }
  }, [effectiveId]);

  const showSnack = (message, severity = 'success') =>
    setSnackbar({ open: true, message, severity });

  const deleteRecording = useCallback(async (recordingId) => {
    if (!window.confirm('Delete this recording?')) return;
    try {
      await api.delete(`/meetings/${effectiveId}/recordings/${recordingId}`);
      showSnack('Recording deleted');
      loadRecordings();
      if (selectedRecording?.id === recordingId) {
        setSelectedRecording(null);
        setPreviewDialogOpen(false);
      }
    } catch {
      showSnack('Failed to delete recording', 'error');
    }
  }, [effectiveId, loadRecordings, selectedRecording]);

  const downloadRecording = useCallback((recording) => {
    window.open(recording.download_url, '_blank');
  }, []);

  // ── Save / Upload ───────────────────────────────────────────────────────
  const saveRecording = useCallback(async () => {
    if (!recorder.recordedBlob || !currentMeeting) return;

    setUploadStatus('uploading');
    setUploadProgress(0);
    setUploadError(null);

    const formats  = isAudioMode ? recorder.AUDIO_FORMATS : recorder.RECORDING_FORMATS;
    const ext      = formats[recorder.fileFormat]?.extension || '.webm';
    const base     = recordingName || currentMeeting.title || 'recording';
    const fileName = `${base.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}${ext}`;

    const fd = new FormData();
    fd.append('file',        recorder.recordedBlob, fileName);
    fd.append('title',       recordingName || `${currentMeeting.title} - Recording`);
    fd.append('description', recordingDescription);
    fd.append('category',    recordingCategory);
    fd.append('duration',    recorder.recordingTime);
    fd.append('quality',     isAudioMode ? 'audio' : recorder.quality);
    fd.append('format',      recorder.fileFormat);
    fd.append('file_size',   recorder.recordingSize);
    fd.append('mode',        recorder.recordingMode);

    try {
      const xhr = new XMLHttpRequest();
      await new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        });
        xhr.addEventListener('load',  () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Status ${xhr.status}`)));
        xhr.addEventListener('error', () => reject(new Error('Network error')));
        xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));
        xhr.open('POST', `/api/v1/meetings/${effectiveId}/recordings`);
        xhr.setRequestHeader('Accept', 'application/json');
        const token = localStorage.getItem('access_token');
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(fd);
      });

      setUploadStatus('success');
      showSnack('Recording saved!');
      setSaveDialogOpen(false);
      setRecordingName('');
      setRecordingDescription('');
      setTimeout(() => {
        recorder.discardRecording();
        loadRecordings();
        setUploadStatus('idle');
        setUploadProgress(0);
      }, 1500);
    } catch (err) {
      setUploadStatus('error');
      setUploadError(err.message || 'Upload failed');
      showSnack(err.message || 'Upload failed', 'error');
    }
  }, [recorder, currentMeeting, effectiveId, recordingName, recordingDescription, recordingCategory, loadRecordings, isAudioMode]);

  // ── Preview (authenticated stream) ──────────────────────────────────────
  const handleOpenPreview = useCallback(async (recording) => {
    setSelectedRecording(recording);
    setStreamUrl(null);
    setPreviewDialogOpen(true);
    try {
      const token    = localStorage.getItem('access_token');
      const response = await fetch(recording.stream_url, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      setStreamUrl(URL.createObjectURL(blob));
    } catch (err) {
      console.error('Stream fetch failed:', err);
      setStreamUrl(recording.stream_url); // fallback to direct URL
      showSnack('Using direct stream URL (auth may not apply)', 'warning');
    }
  }, []);

  const handleClosePreview = useCallback(() => {
    setPreviewDialogOpen(false);
    setStreamUrl(prev => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────
  if (!currentMeeting && !recorder.currentMeetingId) {
    return (
      <Box sx={{ display:'flex', justifyContent:'center', alignItems:'center', height:'60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="Record New" />
        <Tab label={
          <Badge badgeContent={savedRecordings.length} color="primary" max={99}>
            Past Recordings
          </Badge>
        } />
      </Tabs>

      {/* ── Record Tab ── */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          {/* ── Stream error banner (always visible) ── */}
          {recorder.streamError && (
            <Grid size={{ xs: 12 }}>
              <Alert
                severity="error"
                action={
                  <Button size="small" onClick={recorder.enumerateDevices}>
                    Retry
                  </Button>
                }
              >
                {recorder.streamError}
              </Alert>
            </Grid>
          )}

          {/* ── Preview / Waveform area ── */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Paper sx={{ borderRadius: 3, overflow: 'hidden', border: `1px solid ${theme.palette.divider}` }}>
              <Box sx={{ position: 'relative', minHeight: 280 }}>
                {/* Audio mode – no recorded URL yet */}
                {isAudioMode && !recorder.recordedUrl && (
                  <Box sx={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight: 280, p: 4, gap: 3 }}>
                    <Box sx={{ width: 80, height: 80, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', bgcolor: alpha(theme.palette.primary.main, 0.08), border: `2px solid ${theme.palette.primary.main}` }}>
                      <Mic sx={{ fontSize: 36, color: 'primary.main' }} />
                    </Box>
                    <AudioWaveform active={recorder.isRecording && !recorder.isPaused} />
                    {recorder.isRecording && <RecordingBadge time={recorder.recordingTime} isPaused={recorder.isPaused} />}
                  </Box>
                )}

                {/* Video mode – live preview via context videoRef (FIX #5) */}
                {!isAudioMode && !recorder.recordedUrl && (
                  <video
                    ref={recorder.videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ width:'100%', display:'block', backgroundColor:'#000', minHeight: 280 }}
                  />
                )}

                {/* Completed recording playback */}
                {recorder.recordedUrl && (
                  isAudioMode ? (
                    <Box sx={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight: 280, gap: 3, p: 4 }}>
                      <CheckCircle sx={{ fontSize: 48, color: 'success.main' }} />
                      <Typography variant="body2" fontWeight={600} color="success.main">Recording complete</Typography>
                      <audio src={recorder.recordedUrl} controls style={{ width:'90%', maxWidth: 420 }} />
                    </Box>
                  ) : (
                    <video src={recorder.recordedUrl} controls style={{ width:'100%', display:'block', maxHeight: 500 }} />
                  )
                )}
              </Box>
            </Paper>
          </Grid>

          {/* ── Controls ── */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={2}>
              <Card sx={{ borderRadius: 3 }}>
                <CardContent>
                  <Typography variant="overline" color="text.secondary">Controls</Typography>
                  <Box sx={{ mt: 1.5 }}>
                    {!recorder.recordedUrl ? (
                      !recorder.isRecording ? (
                        <Button
                          variant="contained"
                          color="error"
                          fullWidth
                          size="large"
                          startIcon={<RadioButtonChecked />}
                          onClick={recorder.startRecording}
                          disabled={!canStart}
                          sx={{ py: 1.5, borderRadius: 2, fontWeight: 700 }}
                        >
                          Start Recording
                        </Button>
                      ) : (
                        <Stack spacing={1.5}>
                          <Box sx={{ textAlign:'center', py: 1.5, borderRadius: 2, bgcolor: recorder.isPaused ? alpha(theme.palette.warning.main, 0.08) : alpha(theme.palette.error.main, 0.06) }}>
                            <RecordingBadge time={recorder.recordingTime} isPaused={recorder.isPaused} />
                          </Box>
                          <Stack direction="row" spacing={1}>
                            <Button
                              variant="outlined"
                              color={recorder.isPaused ? 'primary' : 'warning'}
                              fullWidth
                              startIcon={recorder.isPaused ? <PlayArrow /> : <Pause />}
                              onClick={recorder.isPaused ? recorder.resumeRecording : recorder.pauseRecording}
                            >
                              {recorder.isPaused ? 'Resume' : 'Pause'}
                            </Button>
                            <Button variant="contained" color="error" fullWidth startIcon={<Stop />} onClick={recorder.stopRecording}>
                              Stop
                            </Button>
                          </Stack>
                        </Stack>
                      )
                    ) : (
                      <Stack spacing={1.5}>
                        <Button variant="contained" fullWidth startIcon={<CloudUpload />} onClick={() => setSaveDialogOpen(true)} sx={{ py: 1.5 }}>
                          Save Recording
                        </Button>
                        <Button variant="outlined" color="error" fullWidth startIcon={<Delete />} onClick={recorder.discardRecording}>
                          Discard
                        </Button>
                      </Stack>
                    )}
                  </Box>
                </CardContent>
              </Card>

              {/* Advanced Settings */}
              <Card sx={{ borderRadius: 3 }}>
                <Accordion expanded={advancedOpen} onChange={() => setAdvancedOpen(v => !v)} elevation={0} sx={{ bgcolor:'transparent' }}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="overline" color="text.secondary">Advanced Settings</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={1.5}>
                      {!isAudioMode && (
                        <FormControl fullWidth size="small" disabled={recorder.isRecording}>
                          <InputLabel>Camera</InputLabel>
                          <Select value={recorder.selectedCamera} onChange={(e) => recorder.setSelectedCamera(e.target.value)} label="Camera">
                            {recorder.cameras.map(c => (
                              <MenuItem key={c.deviceId} value={c.deviceId}>{c.label || `Camera ${c.deviceId.slice(0,8)}`}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      )}
                      <FormControl fullWidth size="small" disabled={recorder.isRecording}>
                        <InputLabel>Microphone</InputLabel>
                        <Select value={recorder.selectedMic} onChange={(e) => recorder.setSelectedMic(e.target.value)} label="Microphone">
                          {recorder.microphones.map(m => (
                            <MenuItem key={m.deviceId} value={m.deviceId}>{m.label || `Mic ${m.deviceId.slice(0,8)}`}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      {!isAudioMode && (
                        <FormControl fullWidth size="small" disabled={recorder.isRecording}>
                          <InputLabel>Quality</InputLabel>
                          <Select value={recorder.quality} onChange={(e) => recorder.setQuality(e.target.value)} label="Quality">
                            {Object.entries(recorder.RECORDING_QUALITY).map(([k, v]) => (
                              <MenuItem key={k} value={k}>{v.label} · {v.fileSize}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      )}
                      <FormControl fullWidth size="small" disabled={recorder.isRecording}>
                        <InputLabel>Format</InputLabel>
                        <Select value={recorder.fileFormat} onChange={(e) => recorder.setFileFormat(e.target.value)} label="Format">
                          {Object.entries(activeFormats).map(([k, v]) => (
                            <MenuItem key={k} value={k}>{v.label}</MenuItem>
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

      {/* ── Past Recordings Tab ── */}
      {activeTab === 1 && (
        <Paper sx={{ borderRadius: 3, border: `1px solid ${theme.palette.divider}`, overflow:'hidden' }}>
          <Box sx={{ px: 3, py: 2, borderBottom: `1px solid ${theme.palette.divider}`, bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
            <Typography variant="subtitle1" fontWeight={600}>
              <History sx={{ mr: 1, verticalAlign:'middle' }} />
              Past Recordings ({savedRecordings.length})
            </Typography>
          </Box>

          {loadingRecordings ? (
            <Box sx={{ p: 6, textAlign:'center' }}>
              <CircularProgress size={36} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Loading recordings…</Typography>
            </Box>
          ) : savedRecordings.length === 0 ? (
            <Box sx={{ p: 6, textAlign:'center' }}>
              <History sx={{ fontSize: 48, color:'text.disabled', mb: 2 }} />
              <Typography variant="h6" fontWeight={600} gutterBottom>No Recordings Yet</Typography>
              <Typography variant="body2" color="text.secondary">Start recording to save your first meeting.</Typography>
            </Box>
          ) : (
            <List disablePadding>
              {savedRecordings.map((rec, i) => (
                <React.Fragment key={rec.id}>
                  <ListItem sx={{ px: 3, py: 2, '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) } }}>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: rec.mode === 'audio' ? alpha(theme.palette.secondary.main, 0.12) : alpha(theme.palette.primary.main, 0.12), color: rec.mode === 'audio' ? 'secondary.main' : 'primary.main' }}>
                        {rec.mode === 'audio' ? <Mic /> : <Videocam />}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={<Typography variant="subtitle2" fontWeight={600}>{rec.title}</Typography>}
                      secondary={
                        <Stack direction="row" spacing={1.5} sx={{ mt: 0.5 }} flexWrap="wrap" alignItems="center">
                          <Typography variant="caption" color="text.secondary">{formatDate(rec.created_at)}</Typography>
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

      {/* ── Save Dialog ── */}
      <Dialog
        open={saveDialogOpen}
        onClose={() => uploadStatus !== 'uploading' && setSaveDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Save Recording</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth size="small" label="Title"
              value={recordingName}
              onChange={e => setRecordingName(e.target.value)}
              placeholder={`${currentMeeting?.title} – Recording`}
              disabled={uploadStatus === 'uploading'}
            />
            <TextField
              fullWidth size="small" label="Description (optional)"
              multiline rows={2}
              value={recordingDescription}
              onChange={e => setRecordingDescription(e.target.value)}
              disabled={uploadStatus === 'uploading'}
            />
            <FormControl fullWidth size="small" disabled={uploadStatus === 'uploading'}>
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
                <Chip icon={<Timer sx={{ fontSize: 14 }} />} size="small" label={formatTime(recorder.recordingTime)} />
                <Chip icon={<Storage sx={{ fontSize: 14 }} />} size="small" label={formatFileSize(recorder.recordingSize)} />
              </Stack>
            </Box>

            {uploadStatus === 'uploading' && (
              <Box>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
                  <Typography variant="caption" fontWeight={600}>Uploading…</Typography>
                  <Typography variant="caption" fontWeight={600}>{uploadProgress}%</Typography>
                </Stack>
                <LinearProgress variant="determinate" value={uploadProgress} sx={{ height: 6, borderRadius: 3 }} />
              </Box>
            )}
            {uploadStatus === 'error' && uploadError && <Alert severity="error">{uploadError}</Alert>}
            {uploadStatus === 'success' && <Alert severity="success" icon={<CloudDone />}>Recording saved!</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)} disabled={uploadStatus === 'uploading'}>Cancel</Button>
          <Button
            variant="contained"
            onClick={saveRecording}
            disabled={uploadStatus === 'uploading' || uploadStatus === 'success'}
            startIcon={uploadStatus === 'uploading' ? <CircularProgress size={18} /> : <CloudUpload />}
          >
            {uploadStatus === 'uploading' ? 'Uploading…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Preview Dialog ── */}
      <Dialog open={previewDialogOpen} onClose={handleClosePreview} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{selectedRecording?.title}</DialogTitle>
        <DialogContent>
          <Box sx={{ borderRadius: 2, overflow:'hidden', bgcolor:'#000', minHeight: 300, display:'flex', alignItems:'center', justifyContent:'center' }}>
            {!streamUrl ? (
              <CircularProgress />
            ) : selectedRecording?.mode === 'audio' ? (
              <Box sx={{ p: 4, width:'100%' }}>
                <audio src={streamUrl} controls autoPlay style={{ width:'100%' }} />
              </Box>
            ) : (
              <video src={streamUrl} controls autoPlay style={{ width:'100%', maxHeight: 460 }} />
            )}
          </Box>
          {selectedRecording?.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>{selectedRecording.description}</Typography>
          )}
          <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap">
            <Chip size="small" label={formatTime(selectedRecording?.duration || 0)} />
            <Chip size="small" label={formatFileSize(selectedRecording?.file_size || 0)} />
            <Chip size="small" label={formatDate(selectedRecording?.created_at)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePreview}>Close</Button>
          <Button startIcon={<Download />} onClick={() => downloadRecording(selectedRecording)}>Download</Button>
          <Button color="error" startIcon={<Delete />} onClick={() => { deleteRecording(selectedRecording.id); handleClosePreview(); }}>Delete</Button>
        </DialogActions>
      </Dialog>

      {/* ── Snackbar ── */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(p => ({ ...p, open: false }))}
        anchorOrigin={{ vertical:'bottom', horizontal:'right' }}
      >
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Container>
  );
};

export default MeetingRecorder;