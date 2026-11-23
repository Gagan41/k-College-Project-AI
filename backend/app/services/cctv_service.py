import os
import cv2
import time
import threading
import numpy as np
from datetime import datetime
from typing import Dict, Any, Generator, Optional, Tuple
from app.core.logging import logger
from app.models.cctv import Camera, CrossingDirection

# Force TCP transport and fast 2-second timeout for RTSP to prevent socket hangs on local networks
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp|stimeout;2000000"

class CCTVStreamManager:
    """Manages active camera stream captures, diagnostics, and overlays."""

    def __init__(self):
        self._active_streams: Dict[int, cv2.VideoCapture] = {}
        self._lock = threading.Lock()

    def _open_capture(self, stream_url: str) -> Optional[cv2.VideoCapture]:
        """Safely open VideoCapture for RTSP or HTTP IP cameras with fast 1.5s timeout."""
        try:
            clean_url = str(stream_url).strip().lower()
            # Do NOT lock local hardware device 0 in Python process - leave it available for client-side webcam
            if clean_url in ["0", "webcam", "demo", "test", "simulated", "mock"]:
                return None
            
            if stream_url.startswith("rtsp://") or stream_url.startswith("http://") or stream_url.startswith("https://"):
                params = [
                    cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 1500,
                    cv2.CAP_PROP_READ_TIMEOUT_MSEC, 1500
                ]
                cap = cv2.VideoCapture(stream_url, cv2.CAP_FFMPEG, params)
                if cap.isOpened():
                    return cap
            return None
        except Exception as exc:
            logger.error(f"Error opening camera stream {stream_url}: {exc}")
            return None

    def capture_frame(self, camera: Camera) -> Tuple[bool, np.ndarray]:
        """Capture a live frame from physical RTSP/HTTP camera or fall back to synthetic."""
        clean_url = str(camera.stream_url).strip().lower()
        if clean_url not in ["demo", "test", "simulated", "mock", "0", "webcam"]:
            cap = self._open_capture(camera.stream_url)
            if cap is not None:
                try:
                    ret, frame = cap.read()
                    if ret and frame is not None:
                        return True, frame
                except Exception as e:
                    logger.warning(f"Error reading frame from {camera.name}: {e}")
                finally:
                    cap.release()
        
        # Fall back to high-fidelity synthetic classroom frame
        return False, self.generate_synthetic_frame(camera.name, camera.classroom, camera.crossing_direction)

    def test_connection(self, camera: Camera) -> Dict[str, Any]:
        """Test stream connectivity, calculate latency, frame dimensions, and FPS."""
        start_time = time.time()
        clean_url = str(camera.stream_url).strip().lower()

        # Simulated or local in-classroom overview feed
        if clean_url in ["demo", "test", "simulated", "mock", "0", "webcam"]:
            return {
                "status": "ONLINE",
                "latency_ms": 11.2,
                "message": f"Connected to In-Classroom Panoramic Overview Stream ({camera.classroom})",
                "frame_width": 1280,
                "frame_height": 720,
                "fps_observed": 30.0
            }

        # Test physical RTSP stream
        cap = self._open_capture(camera.stream_url)
        if cap is not None:
            ret, frame = cap.read()
            latency_ms = round((time.time() - start_time) * 1000, 2)
            if ret and frame is not None:
                h, w = frame.shape[:2]
                fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
                cap.release()
                return {
                    "status": "ONLINE",
                    "latency_ms": latency_ms,
                    "message": f"Successfully connected to {camera.camera_type} stream at {w}x{h} ({fps:.1f} FPS)",
                    "frame_width": int(w),
                    "frame_height": int(h),
                    "fps_observed": round(float(fps), 1)
                }
            cap.release()

        latency_ms = round((time.time() - start_time) * 1000, 2)
        return {
            "status": "OFFLINE",
            "latency_ms": latency_ms,
            "message": f"Unable to reach stream at '{camera.stream_url}'. Check IP, port 554, or RTSP credentials.",
            "frame_width": None,
            "frame_height": None,
            "fps_observed": None
        }

    def generate_synthetic_frame(self, camera_name: str, classroom: str, crossing_dir: str) -> np.ndarray:
        """Generate a neutral, clean surveillance monitor standby screen when cameras are awaiting RTSP signal."""
        width, height = 960, 540
        # Dark security monitor canvas
        frame = np.full((height, width, 3), (18, 14, 11), dtype=np.uint8)

        # Subtle grid lines
        for y in range(60, height - 40, 60):
            cv2.line(frame, (0, y), (width, y), (28, 22, 18), 1)
        for x in range(60, width, 80):
            cv2.line(frame, (x, 40), (x, height - 32), (28, 22, 18), 1)

        # Center Status Card
        cx, cy = width // 2, height // 2
        card_w, card_h = 560, 180
        cv2.rectangle(frame, (cx - card_w // 2, cy - card_h // 2), (cx + card_w // 2, cy + card_h // 2), (26, 20, 16), -1)
        cv2.rectangle(frame, (cx - card_w // 2, cy - card_h // 2), (cx + card_w // 2, cy + card_h // 2), (55, 45, 38), 1)

        # Corner reticles
        ret_size = 18
        for sx, sy in [
            (cx - card_w // 2, cy - card_h // 2),
            (cx + card_w // 2, cy - card_h // 2),
            (cx - card_w // 2, cy + card_h // 2),
            (cx + card_w // 2, cy + card_h // 2)
        ]:
            dx = ret_size if sx < cx else -ret_size
            dy = ret_size if sy < cy else -ret_size
            cv2.line(frame, (sx, sy), (sx + dx, sy), (56, 189, 248), 2)
            cv2.line(frame, (sx, sy), (sx, sy + dy), (56, 189, 248), 2)

        # Center Status Text
        cv2.circle(frame, (cx - 190, cy - 25), 8, (0, 165, 255), -1)
        cv2.putText(frame, "CCTV SURVEILLANCE FEED STANDBY", (cx - 165, cy - 18), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2)
        cv2.putText(frame, f"Target Camera: {camera_name}", (cx - 165, cy + 12), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (200, 200, 200), 1)
        cv2.putText(frame, f"Assigned Location: {classroom or 'Unassigned'}", (cx - 165, cy + 34), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (160, 160, 160), 1)
        cv2.putText(frame, "Connecting to RTSP IP stream... (Verify IP & RTSP server)", (cx - 165, cy + 58), cv2.FONT_HERSHEY_SIMPLEX, 0.40, (100, 180, 255), 1)

        # Top HUD Bar
        cv2.rectangle(frame, (0, 0), (width, 42), (15, 23, 42), -1)
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cv2.putText(frame, f"CAM: {camera_name} | {classroom or 'SURVEILLANCE GRID'} | {now_str}", (15, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (255, 255, 255), 1)
        cv2.circle(frame, (width - 30, 21), 6, (0, 165, 255), -1)
        cv2.putText(frame, "STANDBY", (width - 95, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0, 165, 255), 1)

        # Bottom In-Classroom Status Bar
        cv2.rectangle(frame, (0, height - 32), (width, height), (15, 23, 42), -1)
        cv2.putText(frame, "INSTITUTIONAL CCTV EDGE NETWORK • RTSP INGESTION ACTIVE", (20, height - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (56, 189, 248), 1)

        return frame

    def apply_stream_overlay(
        self,
        frame: np.ndarray,
        camera: Camera,
        recognized_faces: Optional[list] = None,
        detected_faces: Optional[list] = None,
        raw_faces: Optional[np.ndarray] = None
    ) -> np.ndarray:
        """Apply high-tech in-classroom security HUD and recognized student tags."""
        h, w = frame.shape[:2]
        
        # Classroom Overview Tag
        cv2.rectangle(frame, (10, 10), (380, 38), (15, 23, 42), -1)
        face_count = len(detected_faces) if detected_faces else (len(recognized_faces) if recognized_faces else 0)
        status_text = f"CCTV AI VISION • {camera.classroom} • {face_count} FACES"
        cv2.putText(frame, status_text, (18, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (56, 189, 248), 1)

        # 1. Recognized student bounding boxes (with names and percentages)
        if recognized_faces:
            for item in recognized_faces:
                x, y, bw, bh = item.get("bounding_box", (0, 0, 0, 0))
                name = item.get("full_name", "Unknown")
                conf = item.get("confidence", 0.0)
                is_spoof = item.get("spoof_detected", False)
                
                color = (0, 50, 255) if is_spoof else (0, 255, 100) if conf > 0.70 else (0, 180, 255)
                cv2.rectangle(frame, (x, y), (x + bw, y + bh), color, 2)
                cl = min(15, bw // 4)
                cv2.line(frame, (x, y), (x + cl, y), (255, 255, 255), 2)
                cv2.line(frame, (x, y), (x, y + cl), (255, 255, 255), 2)
                cv2.line(frame, (x + bw, y), (x + bw - cl, y), (255, 255, 255), 2)
                cv2.line(frame, (x + bw, y), (x + bw, y + cl), (255, 255, 255), 2)
                cv2.line(frame, (x, y + bh), (x + cl, y + bh), (255, 255, 255), 2)
                cv2.line(frame, (x, y + bh), (x, y + bh - cl), (255, 255, 255), 2)
                cv2.line(frame, (x + bw, y + bh), (x + bw - cl, y + bh), (255, 255, 255), 2)
                cv2.line(frame, (x + bw, y + bh), (x + bw, y + bh - cl), (255, 255, 255), 2)
                
                label = f"SPOOF ALERT" if is_spoof else f"{name} ({int(conf*100)}%)"
                cv2.rectangle(frame, (x, y - 22), (x + len(label)*9, y), color, -1)
                cv2.putText(frame, label, (x + 4, y - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)

        # 2. Live RTSP Detected Face Bounding Boxes & Facial Landmark Reticles
        elif detected_faces:
            for i, (x, y, bw, bh) in enumerate(detected_faces):
                color = (0, 255, 128)  # Bright cyber green
                cv2.rectangle(frame, (x, y), (x + bw, y + bh), color, 2)
                
                # Tech Corner Brackets
                cl = max(10, min(18, bw // 4))
                cv2.line(frame, (x, y), (x + cl, y), (255, 255, 255), 3)
                cv2.line(frame, (x, y), (x, y + cl), (255, 255, 255), 3)
                cv2.line(frame, (x + bw, y), (x + bw - cl, y), (255, 255, 255), 3)
                cv2.line(frame, (x + bw, y), (x + bw, y + cl), (255, 255, 255), 3)
                cv2.line(frame, (x, y + bh), (x + cl, y + bh), (255, 255, 255), 3)
                cv2.line(frame, (x, y + bh), (x, y + bh - cl), (255, 255, 255), 3)
                cv2.line(frame, (x + bw, y + bh), (x + bw - cl, y + bh), (255, 255, 255), 3)
                cv2.line(frame, (x + bw, y + bh), (x + bw, y + bh - cl), (255, 255, 255), 3)

                # Floating tag
                label = f"AI VISION: HUMAN FACE DETECTED"
                tag_w = len(label) * 8
                cv2.rectangle(frame, (x, max(0, y - 20)), (x + tag_w, max(20, y)), (15, 23, 42), -1)
                cv2.rectangle(frame, (x, max(0, y - 20)), (x + tag_w, max(20, y)), color, 1)
                cv2.putText(frame, label, (x + 4, max(14, y - 5)), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (0, 255, 128), 1)

            # Draw landmarks if available
            if raw_faces is not None and len(raw_faces) > 0:
                for row in raw_faces:
                    if len(row) >= 14:
                        re = (int(row[4]), int(row[5]))
                        le = (int(row[6]), int(row[7]))
                        nt = (int(row[8]), int(row[9]))
                        rc = (int(row[10]), int(row[11]))
                        lc = (int(row[12]), int(row[13]))
                        for pt in [re, le, nt, rc, lc]:
                            cv2.circle(frame, pt, 2, (0, 255, 255), -1)

        # Top status bar
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cv2.putText(frame, f"{camera.name} | {now_str}", (10, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1)
        return frame

    def stream_video(self, camera: Camera) -> Generator[bytes, None, None]:
        """Generate MJPEG video stream chunks for FastAPI StreamingResponse with real-time face detection overlay."""
        from app.services.biometric_service import detect_faces_detailed
        cap = self._open_capture(camera.stream_url)
        cached_faces = []
        cached_yunet = None
        frame_idx = 0
        try:
            while True:
                if cap is not None and cap.isOpened():
                    ret, frame = cap.read()
                    if not ret or frame is None:
                        frame = self.generate_synthetic_frame(camera.name, camera.classroom, camera.crossing_direction)
                    else:
                        frame_idx += 1
                        # Run detection every 3 frames for ultra-smooth performance (~8 detections/sec at 25 FPS)
                        if frame_idx % 3 == 0 or not cached_faces:
                            try:
                                cached_faces, cached_yunet = detect_faces_detailed(frame)
                            except Exception:
                                pass
                        frame = self.apply_stream_overlay(frame, camera, detected_faces=cached_faces, raw_faces=cached_yunet)
                else:
                    frame = self.generate_synthetic_frame(camera.name, camera.classroom, camera.crossing_direction)

                # Encode to JPEG
                ret, buffer = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 75])
                if ret:
                    frame_bytes = buffer.tobytes()
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
                time.sleep(0.04)  # ~25 FPS
        finally:
            if cap is not None:
                cap.release()

cctv_manager = CCTVStreamManager()
