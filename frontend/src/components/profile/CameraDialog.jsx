/**
 * CameraDialog.jsx
 *
 * Flow:  SHOOT  →  CROP  →  onCapture(file)
 *
 * Crop step: pure-canvas overlay, no external libs.
 * Square crop box (1:1) — drag to move, drag corners to resize.
 * Zoom (0.5×–3×) and rotation (−45°–+45°) sliders.
 */

import React, {
  useState, useEffect, useCallback, useRef,
} from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, IconButton, CircularProgress, Alert, Stack,
  Box, Tooltip, Typography, Fade, Slider,
} from '@mui/material';
import {
  PhotoCamera, CheckCircleOutline,
  FlipCameraAndroid as FlipCameraIcon,
  Close, Crop as CropIcon,
  ZoomIn, ZoomOut,
  RotateRight as RotateRightIcon,
} from '@mui/icons-material';

// ─── tiny helpers ─────────────────────────────────────────────────────────────
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ─── exportCrop ───────────────────────────────────────────────────────────────
// Re-renders the image with rotation+zoom, extracts the crop rectangle,
// and resolves a jpeg File.
const exportCrop = ({ imageSrc, cropInfo, rotation, zoom, outputSize = 520 }) =>
  new Promise((resolve, reject) => {
    if (!imageSrc || !cropInfo) return reject(new Error('missing crop info'));
    const img = new Image();
    img.onload = () => {
      const { displayBox, canvasSize } = cropInfo;

      // 1. Reproduce the exact same transform used by CropCanvas
      const tmp = document.createElement('canvas');
      tmp.width  = canvasSize.w;
      tmp.height = canvasSize.h;
      const ctx  = tmp.getContext('2d');
      ctx.translate(canvasSize.w / 2, canvasSize.h / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(zoom, zoom);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      // 2. Extract the crop region into the output canvas
      const out = document.createElement('canvas');
      out.width  = outputSize;
      out.height = outputSize;
      out.getContext('2d').drawImage(
        tmp,
        displayBox.x, displayBox.y, displayBox.size, displayBox.size,
        0, 0, outputSize, outputSize,
      );

      out.toBlob(
        blob => resolve(new File([blob], 'profile-crop.jpg', { type: 'image/jpeg' })),
        'image/jpeg', 0.92,
      );
    };
    img.onerror = reject;
    img.src = imageSrc;
  });

// ─── CropCanvas ───────────────────────────────────────────────────────────────
const HANDLE_R  = 14;   // hit-test radius for corner handles (display px)
const MIN_SIZE  = 60;   // minimum crop box size in canvas px
const CANVAS_W  = 560;
const CANVAS_H  = 420;

const CropCanvas = ({ imageSrc, rotation, zoom, onCropChange }) => {
  const canvasRef = useRef(null);
  const imgRef    = useRef(null);
  const dragRef   = useRef(null);     // active pointer drag state
  const boxRef    = useRef(null);     // current crop box (canvas px) — mutable, no re-render
  const [, forceRedraw] = useState(0);

  // ── init: load image, set initial box ──────────────────────────────────────
  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const size = Math.round(Math.min(CANVAS_W, CANVAS_H) * 0.78);
      boxRef.current = {
        x: Math.round((CANVAS_W - size) / 2),
        y: Math.round((CANVAS_H - size) / 2),
        size,
      };
      forceRedraw(n => n + 1);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // ── notify parent whenever box / transform changes ─────────────────────────
  useEffect(() => {
    if (boxRef.current) {
      onCropChange({
        displayBox: { ...boxRef.current },
        canvasSize: { w: CANVAS_W, h: CANVAS_H },
      });
    }
  });   // every render — cheap because we just copy plain numbers

  // ── draw ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const img    = imgRef.current;
    const box    = boxRef.current;
    if (!canvas || !img || !box) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // image
    ctx.save();
    ctx.translate(CANVAS_W / 2, CANVAS_H / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    ctx.restore();

    const { x, y, size } = box;

    // dim outside
    ctx.fillStyle = 'rgba(0,0,0,0.58)';
    ctx.fillRect(0, 0, CANVAS_W, y);
    ctx.fillRect(0, y + size, CANVAS_W, CANVAS_H - y - size);
    ctx.fillRect(0, y, x, size);
    ctx.fillRect(x + size, y, CANVAS_W - x - size, size);

    // border
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth   = 2;
    ctx.strokeRect(x, y, size, size);

    // rule-of-thirds
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth   = 1;
    [1, 2].forEach(i => {
      const t = i / 3;
      ctx.beginPath(); ctx.moveTo(x + size * t, y); ctx.lineTo(x + size * t, y + size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y + size * t); ctx.lineTo(x + size, y + size * t); ctx.stroke();
    });

    // circle ghost
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.restore();

    // corner handles
    [[x, y], [x + size, y], [x, y + size], [x + size, y + size]].forEach(([cx, cy]) => {
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fillStyle = 'white';
      ctx.fill();
    });
  }); // every render

  // ── pointer helpers ───────────────────────────────────────────────────────
  const toCanvas = (e) => {
    const rect  = canvasRef.current.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const src   = e.touches ? e.touches[0] : e;
    return [(src.clientX - rect.left) * scaleX, (src.clientY - rect.top) * scaleY];
  };

  const hitTest = (px, py) => {
    const box = boxRef.current;
    if (!box) return 'none';
    const { x, y, size } = box;
    for (const [name, cx, cy] of [
      ['tl', x,        y       ],
      ['tr', x + size, y       ],
      ['bl', x,        y + size],
      ['br', x + size, y + size],
    ]) {
      if (Math.hypot(px - cx, py - cy) <= HANDLE_R * 1.5) return name;
    }
    if (px >= x && px <= x + size && py >= y && py <= y + size) return 'move';
    return 'none';
  };

  const onPointerDown = (e) => {
    const [px, py] = toCanvas(e);
    const hit = hitTest(px, py);
    if (hit === 'none') return;
    e.preventDefault();
    dragRef.current = { hit, startX: px, startY: py, box: { ...boxRef.current } };
  };

  const onPointerMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const [px, py] = toCanvas(e);
    const drag = dragRef.current;

    // update cursor
    if (!drag) {
      const hit = hitTest(px, py);
      canvas.style.cursor =
        hit === 'move' ? 'move'
        : hit === 'tl' || hit === 'br' ? 'nwse-resize'
        : hit === 'tr' || hit === 'bl' ? 'nesw-resize'
        : 'default';
      return;
    }

    e.preventDefault();
    const dx = px - drag.startX;
    const dy = py - drag.startY;
    let { x, y, size } = drag.box;

    if (drag.hit === 'move') {
      x = clamp(x + dx, 0, CANVAS_W - size);
      y = clamp(y + dy, 0, CANVAS_H - size);
    } else {
      let ns = size, nx = x, ny = y;
      if (drag.hit === 'br') {
        ns = clamp(size + Math.max(dx, dy), MIN_SIZE, Math.min(CANVAS_W - x, CANVAS_H - y));
      } else if (drag.hit === 'tl') {
        ns = clamp(size - Math.min(dx, dy), MIN_SIZE, Math.min(x + size, y + size));
        nx = x + size - ns; ny = y + size - ns;
      } else if (drag.hit === 'tr') {
        ns = clamp(size + dx - dy, MIN_SIZE, Math.min(CANVAS_W - x, y + size));
        ny = y + size - ns;
      } else if (drag.hit === 'bl') {
        ns = clamp(size - dx + dy, MIN_SIZE, Math.min(x + size, CANVAS_H - y));
        nx = x + size - ns;
      }
      x = clamp(nx, 0, CANVAS_W - ns);
      y = clamp(ny, 0, CANVAS_H - ns);
      size = ns;
    }

    boxRef.current = { x, y, size };
    forceRedraw(n => n + 1);
  };

  const onPointerUp = () => { dragRef.current = null; };

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none' }}
      onMouseDown={onPointerDown}
      onMouseMove={onPointerMove}
      onMouseUp={onPointerUp}
      onMouseLeave={onPointerUp}
      onTouchStart={onPointerDown}
      onTouchMove={onPointerMove}
      onTouchEnd={onPointerUp}
    />
  );
};

// ─── CameraDialog ─────────────────────────────────────────────────────────────
const STAGES = { SHOOT: 'shoot', CROP: 'crop' };

const CameraDialog = ({ open, onClose, onCapture }) => {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [stage,         setStage]         = useState(STAGES.SHOOT);
  const [facingMode,    setFacingMode]    = useState('user');
  const [capturedImage, setCapturedImage] = useState(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [error,         setError]         = useState(null);
  const [isFlipping,    setIsFlipping]    = useState(false);
  const [flashActive,   setFlashActive]   = useState(false);
  const [isExporting,   setIsExporting]   = useState(false);
  const [rotation,      setRotation]      = useState(0);
  const [zoom,          setZoom]          = useState(1);
  const [cropInfo,      setCropInfo]      = useState(null);

  // ── stream ────────────────────────────────────────────────────────────────
  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setIsCameraReady(false);
  }, []);

  const startStream = useCallback(async (facing) => {
    stopStream();
    setError(null);
    const attach = (ms) => {
      streamRef.current = ms;
      if (videoRef.current) {
        videoRef.current.srcObject = ms;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch(() => {});
          setIsCameraReady(true);
        };
      }
    };
    try {
      attach(await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      }));
    } catch {
      try { attach(await navigator.mediaDevices.getUserMedia({ video: true, audio: false })); }
      catch { setError('Unable to access camera. Please allow camera permissions and try again.'); }
    }
  }, [stopStream]);

  useEffect(() => {
    if (open) {
      setStage(STAGES.SHOOT);
      setCapturedImage(null);
      setRotation(0);
      setZoom(1);
      setCropInfo(null);
      startStream(facingMode);
    } else {
      stopStream();
      setCapturedImage(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── shoot ─────────────────────────────────────────────────────────────────
  const handleFlip = useCallback(async () => {
    setIsFlipping(true);
    const next = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(next);
    await startStream(next);
    setIsFlipping(false);
  }, [facingMode, startStream]);

  const handleCapture = useCallback(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !isCameraReady) return;

    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 150);

    const { videoWidth: w, videoHeight: h } = video;
    canvas.width  = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (facingMode === 'user') { ctx.translate(w, 0); ctx.scale(-1, 1); }
    ctx.drawImage(video, 0, 0, w, h);

    stopStream();
    setCapturedImage(canvas.toDataURL('image/jpeg', 0.95));
    setRotation(0);
    setZoom(1);
    setStage(STAGES.CROP);
  }, [isCameraReady, facingMode, stopStream]);

  // ── crop ──────────────────────────────────────────────────────────────────
  const handleCropChange = useCallback((info) => { setCropInfo(info); }, []);

  const handleConfirm = useCallback(async () => {
    setIsExporting(true);
    try {
      const file = await exportCrop({ imageSrc: capturedImage, cropInfo, rotation, zoom });
      onCapture(file);
      onClose();
    } catch (err) {
      console.error(err);
      setError('Export failed. Please retake.');
      setStage(STAGES.SHOOT);
      startStream(facingMode);
    } finally {
      setIsExporting(false);
    }
  }, [capturedImage, cropInfo, rotation, zoom, onCapture, onClose, facingMode, startStream]);

  const handleRetake = useCallback(() => {
    setCapturedImage(null);
    setCropInfo(null);
    setRotation(0);
    setZoom(1);
    setStage(STAGES.SHOOT);
    startStream(facingMode);
  }, [facingMode, startStream]);

  const handleClose = useCallback(() => {
    stopStream();
    setCapturedImage(null);
    onClose();
  }, [stopStream, onClose]);

  const isCrop        = stage === STAGES.CROP;
  const isFrontCamera = facingMode === 'user';

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden', bgcolor: '#0d0d0d' } }}
    >
      {/* Title */}
      <DialogTitle sx={{
        fontWeight: 700, color: 'white', bgcolor: '#0d0d0d',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        py: 1.5, px: 2.5,
      }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          {isCrop
            ? <CropIcon sx={{ fontSize: 20, color: 'primary.light' }} />
            : <PhotoCamera sx={{ fontSize: 20, color: 'primary.light' }} />}
          <Typography variant="subtitle1" fontWeight={700} color="white">
            {isCrop ? 'Crop Photo' : 'Take Photo'}
          </Typography>
        </Stack>
        <IconButton size="small" onClick={handleClose}
          sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: 'white' } }}>
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>

      {/* Body */}
      <DialogContent sx={{ p: 0, bgcolor: '#0d0d0d' }}>

        {/* ── SHOOT ── */}
        {!isCrop && (
          <Box sx={{ position: 'relative', width: '100%', aspectRatio: '4/3', overflow: 'hidden', bgcolor: '#111' }}>
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            <video
              ref={videoRef} autoPlay playsInline muted
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
                transform: isFrontCamera ? 'scaleX(-1)' : 'none',
                opacity: isCameraReady ? 1 : 0,
                transition: 'opacity 0.3s',
              }}
            />
            {!isCameraReady && !error && (
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.72)', gap: 1.5 }}>
                <CircularProgress size={36} thickness={3} sx={{ color: 'primary.light' }} />
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)' }}>Starting camera…</Typography>
              </Box>
            )}
            {error && (
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3, bgcolor: 'rgba(0,0,0,0.88)' }}>
                <Alert severity="error" sx={{ borderRadius: 2, width: '100%' }}>{error}</Alert>
              </Box>
            )}
            {/* flash */}
            <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'white', opacity: flashActive ? 0.65 : 0, pointerEvents: 'none', transition: flashActive ? 'none' : 'opacity 0.25s ease-out' }} />
            {/* corner guides */}
            {isCameraReady && (
              <>
                {[
                  { top: 14, left:  14, borderTop: '2px solid', borderLeft:  '2px solid' },
                  { top: 14, right: 14, borderTop: '2px solid', borderRight: '2px solid' },
                  { bottom: 14, left:  14, borderBottom: '2px solid', borderLeft:  '2px solid' },
                  { bottom: 14, right: 14, borderBottom: '2px solid', borderRight: '2px solid' },
                ].map((s, i) => (
                  <Box key={i} sx={{ position: 'absolute', width: 22, height: 22, borderColor: 'rgba(255,255,255,0.7)', ...s }} />
                ))}
                {isFrontCamera && (
                  <Box sx={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', bgcolor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', borderRadius: 10, px: 1.5, py: 0.25 }}>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.68rem', letterSpacing: 0.5 }}>SELFIE</Typography>
                  </Box>
                )}
              </>
            )}
          </Box>
        )}

        {/* ── CROP ── */}
        {isCrop && capturedImage && (
          <Fade in>
            <Box>
              <Box sx={{ bgcolor: '#111' }}>
                <CropCanvas
                  imageSrc={capturedImage}
                  rotation={rotation}
                  zoom={zoom}
                  onCropChange={handleCropChange}
                />
              </Box>

              {/* Controls */}
              <Box sx={{ px: 3, pt: 2, pb: 2.5, bgcolor: '#0d0d0d', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                {/* Zoom */}
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
                  <ZoomOut sx={{ fontSize: 18, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
                  <Slider
                    value={zoom} min={0.5} max={3} step={0.05}
                    onChange={(_, v) => setZoom(v)}
                    size="small"
                    sx={{ color: 'primary.light', '& .MuiSlider-thumb': { width: 16, height: 16 } }}
                  />
                  <ZoomIn sx={{ fontSize: 18, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)', minWidth: 34, textAlign: 'right' }}>
                    {zoom.toFixed(1)}×
                  </Typography>
                </Stack>

                {/* Rotation */}
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <RotateRightIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.4)', flexShrink: 0, transform: 'scaleX(-1)' }} />
                  <Slider
                    value={rotation} min={-45} max={45} step={1}
                    onChange={(_, v) => setRotation(v)}
                    size="small"
                    sx={{ color: 'primary.light', '& .MuiSlider-thumb': { width: 16, height: 16 } }}
                  />
                  <RotateRightIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)', minWidth: 34, textAlign: 'right' }}>
                    {rotation > 0 ? '+' : ''}{rotation}°
                  </Typography>
                </Stack>

                <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: 'rgba(255,255,255,0.22)', fontSize: '0.68rem' }}>
                  Drag the box to move · drag corners to resize
                </Typography>
              </Box>
            </Box>
          </Fade>
        )}

        {/* Hint strip */}
        <Box sx={{ px: 2.5, py: 0.75, bgcolor: '#0d0d0d', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.69rem' }}>
            {isCrop
              ? 'Adjust the crop area, then tap Use Photo.'
              : isCameraReady ? 'Position yourself in the frame, then tap the shutter.'
              : error ? 'Camera unavailable.' : 'Initialising…'}
          </Typography>
        </Box>
      </DialogContent>

      {/* Actions */}
      <DialogActions sx={{
        justifyContent: 'space-between',
        px: 2.5, pb: 2.5, pt: 0.75,
        bgcolor: '#0d0d0d',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        {/* Shoot actions */}
        {!isCrop && (
          <>
            <Button onClick={handleClose} sx={{ color: 'rgba(255,255,255,0.45)', '&:hover': { color: 'white' } }}>
              Cancel
            </Button>
            <Stack direction="row" alignItems="center" spacing={2}>
              {/* Shutter */}
              <Box
                component="button"
                onClick={handleCapture}
                disabled={!isCameraReady}
                sx={{
                  width: 62, height: 62, borderRadius: '50%',
                  border: '3px solid white', bgcolor: 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: isCameraReady ? 'pointer' : 'not-allowed',
                  opacity: isCameraReady ? 1 : 0.3,
                  transition: 'transform 0.12s, opacity 0.2s',
                  '&:active': { transform: 'scale(0.88)' },
                  '&::after': { content: '""', width: 48, height: 48, bgcolor: 'white', borderRadius: '50%', display: 'block' },
                  p: 0,
                }}
              />
              {/* Flip */}
              <Tooltip title={isFrontCamera ? 'Rear camera' : 'Front camera'}>
                <span>
                  <IconButton
                    onClick={handleFlip}
                    disabled={isFlipping || !isCameraReady}
                    sx={{
                      color: 'rgba(255,255,255,0.7)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
                      transition: 'transform 0.35s',
                      transform: isFlipping ? 'rotate(180deg)' : 'none',
                    }}
                  >
                    <FlipCameraIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          </>
        )}

        {/* Crop actions */}
        {isCrop && (
          <>
            <Button
              onClick={handleRetake}
              sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: 'white' } }}
            >
              Retake
            </Button>
            <Stack direction="row" spacing={1.5}>
              <Button
                variant="outlined"
                onClick={() => { setRotation(0); setZoom(1); }}
                sx={{
                  borderColor: 'rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.55)',
                  '&:hover': { borderColor: 'rgba(255,255,255,0.6)', color: 'white', bgcolor: 'rgba(255,255,255,0.05)' },
                  borderRadius: 2,
                }}
              >
                Reset
              </Button>
              <Button
                variant="contained"
                onClick={handleConfirm}
                disabled={isExporting}
                startIcon={isExporting ? <CircularProgress size={16} color="inherit" /> : <CheckCircleOutline />}
                sx={{ borderRadius: 2, px: 3, fontWeight: 700 }}
              >
                Use Photo
              </Button>
            </Stack>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default CameraDialog;