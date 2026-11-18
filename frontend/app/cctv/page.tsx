"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Video,
  Camera as CameraIcon,
  RotateCw,
  Plus,
  Activity,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Laptop,
  Sparkles,
  UserCheck,
  ShieldCheck,
  Clock,
  Layers,
  BookOpen,
  MapPin,
  X,
  ExternalLink,
  Radio,
  Tv,
  Settings2,
  Server,
  Wifi,
  Eye,
  Check,
} from "lucide-react";
import Link from "next/link";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface CameraItem {
  id: number;
  name: string;
  stream_url: string;
  camera_type: string;
  classroom: string;
  crossing_direction: string;
  fps: number;
  resolution: string;
  is_active: boolean;
  last_status: string;
  last_ping?: string | null;
}

interface TestResult {
  status: string;
  latency_ms: number;
  message: string;
  frame_width?: number;
  frame_height?: number;
  fps_observed?: number;
}

interface RecognizedPerson {
  student_id: number;
  roll_number: string;
  full_name: string;
  confidence: number;
  bounding_box: number[];
  liveness_score: number;
  spoof_detected: boolean;
  verification_method?: string;
}

export interface DetectedFaceItem {
  bounding_box: number[];
  is_recognized: boolean;
  student_id?: number | null;
  roll_number?: string | null;
  full_name?: string | null;
  confidence: number;
  liveness_score: number;
  spoof_detected: boolean;
  verification_method?: string;
  verification_status?: string;
  landmarks?: number[][] | null;
}

export interface AcceptancePreviewData {
  student_name: string;
  roll_number: string;
  department: string;
  section: string;
  semester: string;
  period_number: number;
  subject_code: string;
  subject_name: string;
  classroom: string;
  faculty_name: string;
  timestamp: string;
  verification_method: string;
  confidence: number;
  liveness_score: number;
  status: "ACCEPTED" | "RECORDED" | "PRESENT";
  accepted_students?: {
    student_name: string;
    roll_number: string;
    confidence: number;
    verification_method: string;
    status: string;
  }[];
}

interface TimetableSlotItem {
  id: number;
  period_number: number;
  start_time: string;
  end_time: string;
  subject_code?: string;
  subject_name?: string;
  classroom: string;
  section: string;
  faculty_name?: string;
  day_of_week?: string;
}

export interface ActiveClassInfo {
  has_active_class: boolean;
  has_conflict?: boolean;
  conflict_message?: string;
  classroom: string;
  current_time?: string;
  current_date?: string;
  day_of_week?: string;
  timetable_id?: number;
  period_number?: number;
  start_time?: string;
  end_time?: string;
  subject_code?: string;
  subject_name?: string;
  department?: string;
  semester?: number;
  section?: string;
  faculty_name?: string;
  faculty_email?: string;
  camera_id?: number | null;
  camera_name?: string | null;
  session_id?: number | null;
  session_status?: string;
  message?: string;
  next_class?: {
    period_number: number;
    start_time: string;
    end_time: string;
    subject_code: string;
    subject_name: string;
    faculty_name: string;
    section?: string;
  } | null;
}


/**
 * Draws a 3D-style Biometric Mesh / Constellation of sticks & glowing nodes.
 * - When matched: Vibrant glowing green sticks & glowing green dots.
 * - When unmatched: Vibrant glowing red sticks & glowing red dots.
 * - When spoof detected: Alert amber/red sticks.
 */
export function drawBiometricFaceMesh(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  isRecognized: boolean,
  isSpoof: boolean = false,
  landmarks?: number[][] | null,
  labelInfo?: { name?: string; roll?: string; confidence?: number; statusTag?: string }
) {
  const isSpoofActive = isSpoof || labelInfo?.statusTag === "SPOOF_ALERT";

  // Visual Theme Palette (Matching image.png: Luminous Cyan-White Geometric Wireframe)
  // When Recognized: High-coherence Emerald-Cyan
  // When Verifying/Reading: Brilliant Electric Cyan (#00f0ff / #38bdf8) with crisp white nodes
  // When Spoof: Alert Amber-Crimson
  const primaryColor = isSpoofActive
    ? "#f59e0b"
    : isRecognized
    ? "#10b981"
    : "#00f0ff";

  const glowColor = isSpoofActive
    ? "rgba(245, 158, 11, 0.70)"
    : isRecognized
    ? "rgba(16, 185, 129, 0.65)"
    : "rgba(0, 240, 255, 0.65)";

  const wireColor = isSpoofActive
    ? "rgba(251, 191, 36, 0.85)"
    : isRecognized
    ? "rgba(110, 231, 183, 0.90)"
    : "rgba(224, 242, 254, 0.88)";

  const nodeHaloColor = isSpoofActive
    ? "rgba(245, 158, 11, 0.95)"
    : isRecognized
    ? "rgba(52, 211, 153, 0.95)"
    : "rgba(56, 189, 248, 0.95)";

  // Adaptive 3D Structural Fitting (Unique per face geometry)
  const cx = x + w * 0.5;

  let reX = cx + w * 0.22, reY = y + h * 0.38; // Right eye pupil
  let leX = cx - w * 0.22, leY = y + h * 0.38; // Left eye pupil
  let ntX = cx, ntY = y + h * 0.58;             // Nose tip
  let rcX = cx + w * 0.20, rcY = y + h * 0.74; // Right mouth corner
  let lcX = cx - w * 0.20, lcY = y + h * 0.74; // Left mouth corner

  if (landmarks && landmarks.length >= 5) {
    reX = landmarks[0][0]; reY = landmarks[0][1];
    leX = landmarks[1][0]; leY = landmarks[1][1];
    ntX = landmarks[2][0]; ntY = landmarks[2][1];
    rcX = landmarks[3][0]; rcY = landmarks[3][1];
    lcX = landmarks[4][0]; lcY = landmarks[4][1];
  }

  // Inter-pupillary distance vector and face roll angle
  const dxEye = reX - leX;
  const dyEye = reY - leY;
  const eyeDist = Math.hypot(dxEye, dyEye) || (w * 0.44);
  const rollAngle = Math.atan2(dyEye, dxEye);

  // Normal and Tangential Unit Vectors aligned with face head tilt
  const uX = Math.cos(rollAngle); // lateral axis along eye line
  const uY = Math.sin(rollAngle);
  const nX = -uY;                 // vertical downward axis along face bridge
  const nY = uX;

  // Midpoints
  const midEyeX = (reX + leX) * 0.5;
  const midEyeY = (reY + leY) * 0.5;
  const midMouthX = (rcX + lcX) * 0.5;
  const midMouthY = (rcY + lcY) * 0.5;

  // Real-time lateral yaw detection (ratio of nose lateral offset from eye midpoint)
  const noseLateralOffset = (ntX - midEyeX) * uX + (ntY - midEyeY) * uY;
  const yawRatio = Math.max(-0.55, Math.min(0.55, noseLateralOffset / (eyeDist * 0.45 || 1)));

  // Real-time vertical pitch detection (ratio of eye-to-nose vs nose-to-mouth)
  const eyeToNose = (ntX - midEyeX) * nX + (ntY - midEyeY) * nY;
  const noseToMouth = (midMouthX - ntX) * nX + (midMouthY - ntY) * nY;
  const pitchRatio = Math.max(-0.4, Math.min(0.4, (eyeToNose - noseToMouth) / (eyeDist || 1)));

  // Real-time mouth aspect ratio (smiling, speaking, open/closed)
  const measuredMouthWidth = Math.hypot(rcX - lcX, rcY - lcY);
  const mouthAspect = Math.max(0.25, Math.min(0.5, measuredMouthWidth / (eyeDist || 1)));

  // Construct Landmark Nodes (Directly matching image.png wireframe topology)
  const foreheadH = eyeDist * (1.08 - pitchRatio * 0.35);
  const pForeheadTopCenter = {
    x: midEyeX - nX * foreheadH + uX * (yawRatio * eyeDist * 0.15),
    y: midEyeY - nY * foreheadH + uY * (yawRatio * eyeDist * 0.15)
  };
  const pForeheadTopL = {
    x: pForeheadTopCenter.x - uX * eyeDist * (0.82 + yawRatio * 0.30) - nX * (eyeDist * 0.14),
    y: pForeheadTopCenter.y - uY * eyeDist * (0.82 + yawRatio * 0.30) - nY * (eyeDist * 0.14)
  };
  const pForeheadTopR = {
    x: pForeheadTopCenter.x + uX * eyeDist * (0.82 - yawRatio * 0.30) - nX * (eyeDist * 0.14),
    y: pForeheadTopCenter.y + uY * eyeDist * (0.82 - yawRatio * 0.30) - nY * (eyeDist * 0.14)
  };

  // Glabella (Mid-forehead between eyebrows)
  const pGlabella = {
    x: midEyeX - nX * (eyeDist * 0.36),
    y: midEyeY - nY * (eyeDist * 0.36)
  };

  // Brow Arches (Inner, Mid, Outer)
  const pBrowInnerL = { x: leX + uX * eyeDist * 0.18 - nX * eyeDist * 0.30, y: leY + uY * eyeDist * 0.18 - nY * eyeDist * 0.30 };
  const pBrowMidL   = { x: leX - nX * eyeDist * 0.35, y: leY - nY * eyeDist * 0.35 };
  const pBrowOuterL = { x: leX - uX * eyeDist * 0.38 - nX * eyeDist * 0.28, y: leY - uY * eyeDist * 0.38 - nY * eyeDist * 0.28 };

  const pBrowInnerR = { x: reX - uX * eyeDist * 0.18 - nX * eyeDist * 0.30, y: reY - uY * eyeDist * 0.18 - nY * eyeDist * 0.30 };
  const pBrowMidR   = { x: reX - nX * eyeDist * 0.35, y: reY - nY * eyeDist * 0.35 };
  const pBrowOuterR = { x: reX + uX * eyeDist * 0.38 - nX * eyeDist * 0.28, y: reY + uY * eyeDist * 0.38 - nY * eyeDist * 0.28 };

  // Temples
  const pTempleL = { x: leX - uX * eyeDist * (0.76 + yawRatio * 0.25) - nX * eyeDist * 0.08, y: leY - uY * eyeDist * (0.76 + yawRatio * 0.25) - nY * eyeDist * 0.08 };
  const pTempleR = { x: reX + uX * eyeDist * (0.76 - yawRatio * 0.25) - nX * eyeDist * 0.08, y: reY + uY * eyeDist * (0.76 - yawRatio * 0.25) - nY * eyeDist * 0.08 };

  // Eyes (Inner canthus, Pupil center, Outer canthus, Upper lid, Lower lid)
  const pEyeCenterL = { x: leX, y: leY };
  const pEyeInnerL  = { x: leX + uX * eyeDist * 0.28, y: leY + uY * eyeDist * 0.28 };
  const pEyeOuterL  = { x: leX - uX * eyeDist * 0.30, y: leY - uY * eyeDist * 0.30 };
  const pEyeTopL    = { x: leX - nX * eyeDist * 0.16, y: leY - nY * eyeDist * 0.16 };
  const pEyeBottomL = { x: leX + nX * eyeDist * 0.14, y: leY + nY * eyeDist * 0.14 };

  const pEyeCenterR = { x: reX, y: reY };
  const pEyeInnerR  = { x: reX - uX * eyeDist * 0.28, y: reY - uY * eyeDist * 0.28 };
  const pEyeOuterR  = { x: reX + uX * eyeDist * 0.30, y: reY + uY * eyeDist * 0.30 };
  const pEyeTopR    = { x: reX - nX * eyeDist * 0.16, y: reY - nY * eyeDist * 0.16 };
  const pEyeBottomR = { x: reX + nX * eyeDist * 0.14, y: reY + nY * eyeDist * 0.14 };

  // Nose (Bridge top, Bridge mid, Tip, Nostril L, Nostril R)
  const pNoseBridgeTop = { x: midEyeX, y: midEyeY };
  const pNoseBridgeMid = { x: (midEyeX + ntX) * 0.5, y: (midEyeY + ntY) * 0.5 };
  const pNoseTip = { x: ntX, y: ntY };
  const nostrilSpread = eyeDist * 0.32;
  const pNostrilL = { x: ntX - uX * nostrilSpread * (1 + yawRatio * 0.3) + nX * eyeDist * 0.06, y: ntY - uY * nostrilSpread * (1 + yawRatio * 0.3) + nY * eyeDist * 0.06 };
  const pNostrilR = { x: ntX + uX * nostrilSpread * (1 - yawRatio * 0.3) + nX * eyeDist * 0.06, y: ntY + uY * nostrilSpread * (1 - yawRatio * 0.3) + nY * eyeDist * 0.06 };

  // Cheeks (Zygomatic Arch)
  const pCheekL = { x: leX - uX * eyeDist * (0.66 + yawRatio * 0.22) + nX * eyeDist * 0.56, y: leY - uY * eyeDist * (0.66 + yawRatio * 0.22) + nY * eyeDist * 0.56 };
  const pCheekR = { x: reX + uX * eyeDist * (0.66 - yawRatio * 0.22) + nX * eyeDist * 0.56, y: reY + uY * eyeDist * (0.66 - yawRatio * 0.22) + nY * eyeDist * 0.56 };

  // Mouth & Lips (Philtrum, Left Corner, Right Corner, Lower Lip)
  const pPhiltrum = { x: (ntX + midMouthX) * 0.5, y: (ntY + midMouthY) * 0.5 };
  const pMouthL = { x: lcX, y: lcY };
  const pMouthR = { x: rcX, y: rcY };
  const mouthH = measuredMouthWidth * 0.36;
  const pLipBottom = { x: midMouthX + nX * mouthH, y: midMouthY + nY * mouthH };

  // Jawline & Chin
  const jawDrop = eyeDist * (0.88 + pitchRatio * 0.40);
  const pJawAngleL = { x: lcX - uX * eyeDist * (0.56 + yawRatio * 0.22) + nX * jawDrop * 0.52, y: lcY - uY * eyeDist * (0.56 + yawRatio * 0.22) + nY * jawDrop * 0.52 };
  const pJawAngleR = { x: rcX + uX * eyeDist * (0.56 - yawRatio * 0.22) + nX * jawDrop * 0.52, y: rcY + uY * eyeDist * (0.56 - yawRatio * 0.22) + nY * jawDrop * 0.52 };
  const pChinBottom = { x: midMouthX + nX * jawDrop, y: midMouthY + nY * jawDrop };

  // All 28 Landmark Nodes
  const nodes = [
    pForeheadTopCenter, pForeheadTopL, pForeheadTopR, pGlabella,
    pBrowInnerL, pBrowMidL, pBrowOuterL, pTempleL,
    pBrowInnerR, pBrowMidR, pBrowOuterR, pTempleR,
    pEyeCenterL, pEyeInnerL, pEyeOuterL, pEyeTopL, pEyeBottomL,
    pEyeCenterR, pEyeInnerR, pEyeOuterR, pEyeTopR, pEyeBottomR,
    pNoseBridgeTop, pNoseBridgeMid, pNoseTip, pNostrilL, pNostrilR,
    pCheekL, pCheekR,
    pPhiltrum, pMouthL, pMouthR, pLipBottom,
    pJawAngleL, pJawAngleR, pChinBottom
  ];

  // Exact Wireframe Triangular Facets from image.png
  const edges: [{ x: number; y: number }, { x: number; y: number }][] = [
    // Forehead arch & facets
    [pForeheadTopCenter, pForeheadTopL],
    [pForeheadTopCenter, pForeheadTopR],
    [pForeheadTopL, pForeheadTopR],
    [pForeheadTopCenter, pGlabella],
    [pForeheadTopL, pGlabella],
    [pForeheadTopR, pGlabella],
    [pForeheadTopL, pTempleL],
    [pForeheadTopR, pTempleR],
    [pForeheadTopL, pBrowMidL],
    [pForeheadTopR, pBrowMidR],

    // Eyebrows
    [pTempleL, pBrowOuterL],
    [pBrowOuterL, pBrowMidL],
    [pBrowMidL, pBrowInnerL],
    [pBrowInnerL, pGlabella],
    [pTempleR, pBrowOuterR],
    [pBrowOuterR, pBrowMidR],
    [pBrowMidR, pBrowInnerR],
    [pBrowInnerR, pGlabella],

    // Left Eye contour & star
    [pBrowInnerL, pEyeInnerL],
    [pBrowMidL, pEyeTopL],
    [pBrowOuterL, pEyeOuterL],
    [pEyeInnerL, pEyeTopL],
    [pEyeTopL, pEyeOuterL],
    [pEyeOuterL, pEyeBottomL],
    [pEyeBottomL, pEyeInnerL],
    [pEyeCenterL, pEyeInnerL],
    [pEyeCenterL, pEyeOuterL],
    [pEyeCenterL, pEyeTopL],
    [pEyeCenterL, pEyeBottomL],

    // Right Eye contour & star
    [pBrowInnerR, pEyeInnerR],
    [pBrowMidR, pEyeTopR],
    [pBrowOuterR, pEyeOuterR],
    [pEyeInnerR, pEyeTopR],
    [pEyeTopR, pEyeOuterR],
    [pEyeOuterR, pEyeBottomR],
    [pEyeBottomR, pEyeInnerR],
    [pEyeCenterR, pEyeInnerR],
    [pEyeCenterR, pEyeOuterR],
    [pEyeCenterR, pEyeTopR],
    [pEyeCenterR, pEyeBottomR],

    // Nose bridge and pyramid facets
    [pGlabella, pNoseBridgeTop],
    [pNoseBridgeTop, pNoseBridgeMid],
    [pNoseBridgeMid, pNoseTip],
    [pNoseBridgeMid, pNostrilL],
    [pNoseBridgeMid, pNostrilR],
    [pNostrilL, pNoseTip],
    [pNoseTip, pNostrilR],
    [pEyeInnerL, pNoseBridgeMid],
    [pEyeInnerR, pNoseBridgeMid],
    [pEyeInnerL, pNoseBridgeTop],
    [pEyeInnerR, pNoseBridgeTop],

    // Cheeks & Temples
    [pEyeOuterL, pTempleL],
    [pEyeOuterR, pTempleR],
    [pEyeOuterL, pCheekL],
    [pEyeOuterR, pCheekR],
    [pEyeBottomL, pCheekL],
    [pEyeBottomR, pCheekR],
    [pNostrilL, pCheekL],
    [pNostrilR, pCheekR],
    [pTempleL, pCheekL],
    [pTempleR, pCheekR],

    // Mouth & Philtrum
    [pNoseTip, pPhiltrum],
    [pNostrilL, pPhiltrum],
    [pNostrilR, pPhiltrum],
    [pNostrilL, pMouthL],
    [pNostrilR, pMouthR],
    [pCheekL, pMouthL],
    [pCheekR, pMouthR],
    [pPhiltrum, pMouthL],
    [pPhiltrum, pMouthR],
    [pMouthL, pLipBottom],
    [pMouthR, pLipBottom],
    [pPhiltrum, pLipBottom],

    // Jawline & Chin
    [pCheekL, pJawAngleL],
    [pCheekR, pJawAngleR],
    [pMouthL, pJawAngleL],
    [pMouthR, pJawAngleR],
    [pJawAngleL, pChinBottom],
    [pJawAngleR, pChinBottom],
    [pMouthL, pChinBottom],
    [pMouthR, pChinBottom],
    [pLipBottom, pChinBottom],
  ];

  ctx.save();

  // Realtime Active Reading Scan Wave
  const t = Date.now() * 0.003;
  const scanProgress = (Math.sin(t) * 0.5 + 0.5);
  const scanY = y + scanProgress * h;

  // 1. Draw glowing wireframe facet edges (thin, crisp 1.25px white/cyan)
  ctx.strokeStyle = wireColor;
  ctx.lineWidth = 1.25;
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 6;
  ctx.beginPath();
  for (const [p1, p2] of edges) {
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
  }
  ctx.stroke();

  // 2. Draw luminous landmark nodes (bright pure-white core with cyan electric glow)
  for (const pt of nodes) {
    const distToScan = Math.abs(pt.y - scanY);
    const isNearWave = distToScan < h * 0.12;
    const waveFlare = isNearWave ? (1 - distToScan / (h * 0.12)) : 0;

    // Outer cyan bloom
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 3.5 + waveFlare * 3, 0, Math.PI * 2);
    ctx.fillStyle = waveFlare > 0 ? "rgba(255, 255, 255, 0.95)" : nodeHaloColor;
    ctx.shadowColor = waveFlare > 0 ? "#ffffff" : primaryColor;
    ctx.shadowBlur = waveFlare > 0 ? 15 : 8;
    ctx.fill();

    // Solid white center point
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 1.6, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  }

  // 3. Realtime Reading Sweep Line
  ctx.strokeStyle = isSpoofActive
    ? "rgba(245, 158, 11, 0.40)"
    : isRecognized
    ? "rgba(16, 185, 129, 0.35)"
    : "rgba(0, 240, 255, 0.45)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x - 8, scanY);
  ctx.lineTo(x + w + 8, scanY);
  ctx.stroke();
  ctx.setLineDash([]);

  // 4. Futuristic Precision Corner Brackets
  ctx.shadowBlur = 0;
  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = 2;
  const bLen = Math.min(18, w * 0.2);
  ctx.beginPath();
  // Top Left
  ctx.moveTo(x - 4, y - 4 + bLen); ctx.lineTo(x - 4, y - 4); ctx.lineTo(x - 4 + bLen, y - 4);
  // Top Right
  ctx.moveTo(x + w + 4 - bLen, y - 4); ctx.lineTo(x + w + 4, y - 4); ctx.lineTo(x + w + 4, y - 4 + bLen);
  // Bottom Left
  ctx.moveTo(x - 4, y + h + 4 - bLen); ctx.lineTo(x - 4, y + h + 4); ctx.lineTo(x - 4 + bLen, y + h + 4);
  // Bottom Right
  ctx.moveTo(x + w + 4 - bLen, y + h + 4); ctx.lineTo(x + w + 4, y + h + 4); ctx.lineTo(x + w + 4, y + h + 4 - bLen);
  ctx.stroke();

  // 5. High-Tech Cybernetic Status HUD & Biometric Telemetry
  if (isSpoofActive) {
    ctx.fillStyle = "rgba(245, 158, 11, 0.95)";
    ctx.fillRect(x, Math.max(0, y - 30), Math.max(240, w), 26);
    ctx.fillStyle = "#000000";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText("⚠ SPOOF ALERT: 2D PHOTO / SCREEN DETECTED", x + 8, Math.max(0, y - 30) + 17);

    // Warning Footer
    ctx.fillStyle = "rgba(185, 28, 28, 0.95)";
    ctx.fillRect(x, y + h + 8, 220, 22);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 10px monospace";
    ctx.fillText("✕ BIOMETRIC ATTENDANCE REJECTED", x + 8, y + h + 23);
  } else if (isRecognized) {
    const studentLabel = labelInfo?.name
      ? `✓ ${labelInfo.name} (${labelInfo.roll || ""}) • ${((labelInfo.confidence || 0.92) * 100).toFixed(0)}% MATCH`
      : "✓ VERIFIED STUDENT PROFILE";
    ctx.font = "bold 11px sans-serif";
    const tWidth = ctx.measureText(studentLabel).width;
    ctx.fillStyle = "rgba(16, 185, 129, 0.95)";
    ctx.fillRect(x, Math.max(0, y - 30), Math.max(tWidth + 18, w), 26);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(studentLabel, x + 8, Math.max(0, y - 30) + 17);

    // Green Verified Footer
    ctx.fillStyle = "rgba(16, 185, 129, 0.92)";
    ctx.fillRect(x, y + h + 8, 235, 22);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 10px monospace";
    ctx.fillText("✓ ATTENDANCE RECORDED (PRESENT)", x + 8, y + h + 23);
  } else {
    // Reading in Realtime / Verifying
    const isOutsider = labelInfo?.statusTag === "NOT_IN_CLASSROOM";
    const tagText = isOutsider
      ? "✕ NOT IN THIS CLASSROOM COHORT"
      : `READING FACIAL MESH • ${(eyeDist).toFixed(0)}px EYE-DIST`;
    ctx.font = "bold 10px monospace";
    const tWidth = ctx.measureText(tagText).width;
    ctx.fillStyle = isOutsider ? "rgba(239, 68, 68, 0.95)" : "rgba(15, 23, 42, 0.90)";
    ctx.fillRect(x, Math.max(0, y - 28), Math.max(tWidth + 16, w), 24);
    ctx.fillStyle = isOutsider ? "#ffffff" : "#38bdf8";
    ctx.fillText(tagText, x + 8, Math.max(0, y - 28) + 16);

    // Live Geometry Metrics Footer
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.fillRect(x, y + h + 8, Math.max(220, w), 20);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "9px monospace";
    ctx.fillText(`YAW: ${(yawRatio * 25).toFixed(1)}° | PITCH: ${(pitchRatio * 20).toFixed(1)}° | 128-D READING`, x + 6, y + h + 22);
  }

  ctx.restore();
}

export default function CCTVPage() {
  const { token } = useAuth();
  const [cameras, setCameras] = useState<CameraItem[]>([]);
  const [selectedCam, setSelectedCam] = useState<CameraItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [streamTimestamp, setStreamTimestamp] = useState<number>(Date.now());

  // Webcam & AI Vision States
  const [useLaptopCam, setUseLaptopCam] = useState(false);
  const [useVirtualCam, setUseVirtualCam] = useState(false);
  const [cameraLockError, setCameraLockError] = useState<{
    isLocked: boolean;
    errorType: string;
    message: string;
    suggestions: string[];
  } | null>(null);
  const [simulatedMatchStatus, setSimulatedMatchStatus] = useState<"MATCHED" | "MULTI" | "OUTSIDER" | "SPOOF" | "UNMATCHED">("MATCHED");
  const [liveAttendanceLog, setLiveAttendanceLog] = useState<
    { student_id: number; name: string; roll: string; confidence: number; time: string; status: string }[]
  >([]);
  const [classroomScopeInfo, setClassroomScopeInfo] = useState<{
    classroom?: string;
    subject_code?: string;
    subject_name?: string;
    enrolled_count: number;
    scoped_to_classroom: boolean;
  } | null>(null);

  // Video & Canvas Refs (Permanently mounted to prevent null ref bugs)
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  // Real-Time Recognition Data
  const [recognizedFaces, setRecognizedFaces] = useState<RecognizedPerson[]>([]);
  const [allDetectedFaces, setAllDetectedFaces] = useState<DetectedFaceItem[]>([]);
  const [facesDetectedCount, setFacesDetectedCount] = useState<number>(0);
  const [recognitionActive, setRecognitionActive] = useState(false);

  // Attendance Trigger States
  const [autoAttendance, setAutoAttendance] = useState(false);
  const [takingAttendance, setTakingAttendance] = useState(false);
  const [attendanceResult, setAttendanceResult] = useState<string | null>(null);
  const [portalAcceptancePreview, setPortalAcceptancePreview] =
    useState<AcceptancePreviewData | null>(null);

  // Timetable Slots (Preloaded with default database slots)
  const [timetableSlots, setTimetableSlots] = useState<TimetableSlotItem[]>([
    {
      id: 1,
      period_number: 1,
      start_time: "09:00",
      end_time: "10:00",
      subject_code: "CS301",
      subject_name: "Computer Networks",
      classroom: "Room 302",
      section: "A",
      faculty_name: "Dr. Alan Turing",
      day_of_week: "Monday",
    },
    {
      id: 2,
      period_number: 2,
      start_time: "10:00",
      end_time: "11:00",
      subject_code: "CS301",
      subject_name: "Computer Networks",
      classroom: "Room 302",
      section: "A",
      faculty_name: "Dr. Alan Turing",
      day_of_week: "Monday",
    },
    {
      id: 3,
      period_number: 3,
      start_time: "11:15",
      end_time: "12:15",
      subject_code: "CS301",
      subject_name: "Computer Networks",
      classroom: "Room 302",
      section: "A",
      faculty_name: "Dr. Alan Turing",
      day_of_week: "Monday",
    },
    {
      id: 4,
      period_number: 4,
      start_time: "12:15",
      end_time: "13:15",
      subject_code: "CS301",
      subject_name: "Computer Networks",
      classroom: "Room 302",
      section: "A",
      faculty_name: "Dr. Alan Turing",
      day_of_week: "Monday",
    },
    {
      id: 5,
      period_number: 5,
      start_time: "14:00",
      end_time: "15:00",
      subject_code: "CS301",
      subject_name: "Computer Networks",
      classroom: "Room 302",
      section: "A",
      faculty_name: "Dr. Alan Turing",
      day_of_week: "Monday",
    },
    {
      id: 6,
      period_number: 6,
      start_time: "15:00",
      end_time: "16:00",
      subject_code: "CS301",
      subject_name: "Computer Networks",
      classroom: "Room 302",
      section: "A",
      faculty_name: "Dr. Alan Turing",
      day_of_week: "Monday",
    },
  ]);
  const [selectedSlotId, setSelectedSlotId] = useState<number>(1);

  // Classroom Selector & Active Class Resolution
  const [classroomsList, setClassroomsList] = useState<string[]>([
    "Room 302",
    "Room 101",
    "Room 102",
    "Room 201",
    "Computer Lab 1",
    "Electronics Lab",
  ]);
  const [selectedClassroom, setSelectedClassroom] = useState<string>("Room 302");
  const [activeClassInfo, setActiveClassInfo] = useState<ActiveClassInfo | null>(null);
  const [loadingActiveClass, setLoadingActiveClass] = useState(false);

  // CCTV Camera & Classroom Assignment State
  const [showAddCameraModal, setShowAddCameraModal] = useState(false);
  const [assignClassroomMode, setAssignClassroomMode] = useState<"EXISTING" | "NEW">("EXISTING");
  const [newClassroomName, setNewClassroomName] = useState("");
  const [newClassroomBuilding, setNewClassroomBuilding] = useState("Main Academic Complex");
  const [newClassroomCapacity, setNewClassroomCapacity] = useState(60);

  const [cameraForm, setCameraForm] = useState({
    name: "",
    classroom: "Room 302",
    camera_type: "RTSP", // "RTSP" | "HTTP_MJPEG" | "WEBCAM" | "VIRTUAL"
    stream_url: "rtsp://admin:admin123@192.168.1.100:554/stream1",
    crossing_direction: "LEFT_TO_RIGHT_ENTRY",
    fps: 25,
    resolution: "1920x1080",
    rtsp_ip: "192.168.1.100",
    rtsp_port: "554",
    rtsp_channel: "1",
    rtsp_user: "admin",
    rtsp_pass: "admin123",
    usb_index: "0",
  });
  const [savingCamera, setSavingCamera] = useState(false);
  const [addCamError, setAddCamError] = useState<string | null>(null);
  const [addCamSuccess, setAddCamSuccess] = useState<string | null>(null);

  // New Camera Form (Legacy fallback)
  const [newCam, setNewCam] = useState({
    name: "",
    stream_url: "0",
    camera_type: "WEBCAM",
    classroom: "Room 302",
    crossing_direction: "LEFT_TO_RIGHT_ENTRY",
    fps: 25,
    resolution: "1920x1080",
  });

  const loadClassrooms = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/academic/classrooms`, {
        headers: getAuthHeaders(token),
      });
      if (res.ok) {
        const data = await res.json();
        const names = data.map((r: any) => r.room_number || r.name).filter(Boolean);
        if (names.length > 0) {
          setClassroomsList(names);
        }
      }
    } catch {
      // Fallback defaults are already set
    }
  };

  const fetchActiveClass = async (room: string) => {
    try {
      setLoadingActiveClass(true);
      const res = await fetch(`${API_BASE_URL}/timetable/active-class?classroom=${encodeURIComponent(room)}`, {
        headers: getAuthHeaders(token),
      });
      if (res.ok) {
        const data: ActiveClassInfo = await res.json();
        setActiveClassInfo(data);
        if (data.timetable_id) {
          setSelectedSlotId(data.timetable_id);
        }
        // Auto-select corresponding camera if available
        if (data.camera_id) {
          const matchCam = cameras.find((c) => c.id === data.camera_id);
          if (matchCam) setSelectedCam(matchCam);
        }
      }
    } catch (err) {
      console.error("Failed to resolve active class:", err);
    } finally {
      setLoadingActiveClass(false);
    }
  };


  const loadCameras = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/cctv/cameras`, {
        headers: getAuthHeaders(token),
      });
      if (res.ok) {
        const data = await res.json();
        setCameras(data);
        if (data.length > 0 && !selectedCam) {
          setSelectedCam(data[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load cameras", err);
    } finally {
      setLoading(false);
    }
  };

  const loadTimetableSlots = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/timetable`, {
        headers: getAuthHeaders(token),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          // Format slot fields
          const formatted: TimetableSlotItem[] = data.map((d: any) => ({
            id: d.id,
            period_number: d.period_number,
            start_time: d.start_time,
            end_time: d.end_time,
            subject_code: d.subject_code || d.subject?.code || "CS301",
            subject_name: d.subject_name || d.subject?.name || "Computer Networks",
            classroom: d.classroom || "Room 302",
            section: d.section || "A",
            faculty_name: d.faculty_name || d.faculty?.user?.full_name || "Faculty",
            day_of_week: d.day_of_week || "Monday",
          }));
          setTimetableSlots(formatted);
          if (!formatted.some((s) => s.id === selectedSlotId)) {
            setSelectedSlotId(formatted[0].id);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load timetable slots", err);
    }
  };

  useEffect(() => {
    loadCameras();
    loadTimetableSlots();
    loadClassrooms();
  }, [token]);

  useEffect(() => {
    if (selectedClassroom) {
      fetchActiveClass(selectedClassroom);
      const timer = setInterval(() => {
        fetchActiveClass(selectedClassroom);
      }, 25000);
      return () => clearInterval(timer);
    }
  }, [selectedClassroom, token]);

  // Clean toggle of Laptop Webcam
  const toggleLaptopWebcam = async () => {
    setCameraLockError(null);

    if (useLaptopCam || useVirtualCam) {
      // Stop webcam and virtual cam
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
      setUseLaptopCam(false);
      setUseVirtualCam(false);
      setRecognitionActive(false);
      setRecognizedFaces([]);
      setAllDetectedFaces([]);
      setFacesDetectedCount(0);
      if (overlayCanvasRef.current) {
        const ctx = overlayCanvasRef.current.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
      }
    } else {
      // Clean up any old tracks first
      if (videoRef.current && videoRef.current.srcObject) {
        const oldStream = videoRef.current.srcObject as MediaStream;
        oldStream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }

      try {
        let stream: MediaStream | null = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }

        if (stream) {
          setUseLaptopCam(true);
          setUseVirtualCam(false);
          setRecognitionActive(true);

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.muted = true;
            try {
              await videoRef.current.play();
            } catch (playErr) {
              console.warn("Video play notice:", playErr);
            }
          }
        }
      } catch (err: unknown) {
        console.error("Camera access error:", err);
        const errName = err instanceof Error ? err.name : "";
        const errMsg = err instanceof Error ? err.message : String(err);

        if (
          errName === "NotFoundError" ||
          errMsg.includes("Requested device not found") ||
          errMsg.includes("DevicesNotFoundError")
        ) {
          setCameraLockError({
            isLocked: true,
            errorType: "Hardware Camera Disconnected (Lenovo LOQ E-Shutter Switch)",
            message:
              "Requested device not found. Windows reports the webcam is disconnected at the hardware level (Code 45 CM_PROB_PHANTOM). On Lenovo laptops, this happens when the privacy shutter is closed or Lenovo Vantage Camera Privacy Mode is turned ON.",
            suggestions: [
              "Lenovo Physical Shutter: Check the top bezel above your screen. Slide the small privacy shutter open (an orange/red dot means the camera is closed/off).",
              "Lenovo E-Shutter Switch: Check the right side edge of your laptop body for a small electronic camera toggle switch.",
              "Lenovo Vantage App: Open Lenovo Vantage (search in Start menu) -> Display & Camera -> Turn OFF 'Camera Privacy Mode'.",
              "Keyboard Hotkey: Press F8 or Fn+F8 or Fn+F10 on your keyboard (the key with a camera icon crossed out).",
              "Windows Privacy: Windows Settings -> Privacy & Security -> Camera -> Turn ON 'Camera access' and 'Let desktop apps access your camera'.",
            ],
          });
        } else if (
          errName === "NotReadableError" ||
          errName === "TrackStartError" ||
          errMsg.includes("Could not start video source")
        ) {
          setCameraLockError({
            isLocked: true,
            errorType: "Device In Use / Privacy Switch Enabled",
            message:
              "Could not start video source. The webcam is in use by another app or Lenovo Privacy Mode is ON.",
            suggestions: [
              "Lenovo Vantage: Press Fn+F8 or toggle OFF Camera Privacy Mode in Lenovo Vantage.",
              "Close Apps: Ensure Windows Camera, Teams, Zoom, or other browser tabs are closed.",
              "Windows Privacy: Settings -> Privacy & Security -> Camera -> Enable 'Let desktop apps access your camera'.",
            ],
          });
        } else if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
          setCameraLockError({
            isLocked: true,
            errorType: "Permission Denied",
            message: "Camera permission was denied in your browser.",
            suggestions: [
              "Click the lock/tune icon in the browser URL bar and allow Camera access.",
              "Reload the page after granting permission.",
            ],
          });
        } else {
          setCameraLockError({
            isLocked: true,
            errorType: errName || "Camera Inaccessible",
            message: errMsg || "Could not access hardware camera.",
            suggestions: [
              "Ensure your webcam is connected and enabled.",
              "Click 'Launch Simulated AI Vision Feed' to test attendance with enrolled biometrics.",
            ],
          });
        }
      }
    }
  };

  // Launch Simulated Vision Feed for testing
  const startVirtualSimulation = () => {
    setCameraLockError(null);
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setUseLaptopCam(false);
    setUseVirtualCam(true);
    setRecognitionActive(true);
    setRecognizedFaces([
      {
        student_id: 1,
        roll_number: "CS-2024-001",
        full_name: "Kushal Student",
        confidence: 0.88,
        bounding_box: [160, 100, 200, 220],
        liveness_score: 0.95,
        spoof_detected: false,
        verification_method: "FACE_RECOGNITION",
      },
    ]);
  };

  // Virtual Canvas Loop
  useEffect(() => {
    let animInterval: any;
    if (useVirtualCam && overlayCanvasRef.current) {
      const canvas = overlayCanvasRef.current;
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext("2d");
      let scanY = 120;
      let scanDir = 2.5;

      const drawVirtualFrame = () => {
        if (!ctx) return;
        ctx.fillStyle = "#090d16";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "#1e293b";
        ctx.fillRect(0, 0, canvas.width, 360);
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(0, 360, canvas.width, canvas.height - 360);

        // Whiteboard
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(200, 45, canvas.width - 400, 220);
        ctx.strokeStyle = "#0284c7";
        ctx.lineWidth = 4;
        ctx.strokeRect(200, 45, canvas.width - 400, 220);

        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 22px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("DEPARTMENT OF COMPUTER SCIENCE & ENGINEERING", canvas.width / 2, 95);
        ctx.font = "bold 18px monospace";
        ctx.fillStyle = "#0284c7";
        ctx.fillText("CS301: COMPUTER NETWORKS & DISTRIBUTED SYSTEMS", canvas.width / 2, 135);
        ctx.font = "14px sans-serif";
        ctx.fillStyle = "#475569";
        ctx.fillText("Classroom 302 • Section A • Dr. Alan Turing", canvas.width / 2, 175);

        // Laser scan line
        scanY += scanDir;
        if (scanY > 520 || scanY < 90) scanDir = -scanDir;
        const grad = ctx.createLinearGradient(0, scanY, canvas.width, scanY);
        grad.addColorStop(0, "transparent");
        grad.addColorStop(0.5, "rgba(56, 189, 248, 0.8)");
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.fillRect(0, scanY, canvas.width, 3);

        // Render Biometric Face Mesh Reticles based on simulation mode
        if (simulatedMatchStatus === "MULTI") {
          // Student 1 (Classroom Student Left)
          ctx.fillStyle = "#2563eb";
          ctx.beginPath();
          ctx.arc(380, 355, 48, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(380, 455, 90, 60, 0, 0, Math.PI, true);
          ctx.fill();

          drawBiometricFaceMesh(
            ctx,
            280,
            290,
            200,
            190,
            true,
            false,
            null,
            { name: "Kushal Student", roll: "CS-2024-001", confidence: 0.95, statusTag: "PRESENT" }
          );

          // Student 2 (Classroom Student Right)
          ctx.fillStyle = "#0284c7";
          ctx.beginPath();
          ctx.arc(880, 355, 48, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(880, 455, 90, 60, 0, 0, Math.PI, true);
          ctx.fill();

          drawBiometricFaceMesh(
            ctx,
            780,
            290,
            200,
            190,
            true,
            false,
            null,
            { name: "Aarav Sharma", roll: "CS-2024-002", confidence: 0.92, statusTag: "PRESENT" }
          );
        } else {
          // Single Student Body (Center)
          ctx.fillStyle = simulatedMatchStatus === "OUTSIDER" ? "#dc2626" : "#2563eb";
          ctx.beginPath();
          ctx.arc(canvas.width / 2, 355, 52, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(canvas.width / 2, 455, 100, 65, 0, 0, Math.PI, true);
          ctx.fill();

          const fx = canvas.width / 2 - 110;
          const fy = 290;
          const fw = 220;
          const fh = 200;

          if (simulatedMatchStatus === "MATCHED") {
            drawBiometricFaceMesh(
              ctx,
              fx,
              fy,
              fw,
              fh,
              true,
              false,
              null,
              { name: "Kushal Student", roll: "CS-2024-001", confidence: 0.94, statusTag: "PRESENT" }
            );
          } else if (simulatedMatchStatus === "OUTSIDER") {
            drawBiometricFaceMesh(
              ctx,
              fx,
              fy,
              fw,
              fh,
              false,
              false,
              null,
              { statusTag: "NOT_IN_CLASSROOM" }
            );
          } else if (simulatedMatchStatus === "SPOOF") {
            drawBiometricFaceMesh(
              ctx,
              fx,
              fy,
              fw,
              fh,
              false,
              true,
              null,
              { statusTag: "SPOOF_ALERT" }
            );
          } else {
            drawBiometricFaceMesh(
              ctx,
              fx,
              fy,
              fw,
              fh,
              false,
              false,
              null,
              { statusTag: "UNREGISTERED" }
            );
          }
        }
      };

      animInterval = setInterval(drawVirtualFrame, 50);
    }

    return () => {
      if (animInterval) clearInterval(animInterval);
    };
  }, [useVirtualCam, simulatedMatchStatus]);

  // Active slot object
  const currentSlot =
    timetableSlots.find((s) => s.id === selectedSlotId) || timetableSlots[0];

  // 1-Click Period Attendance Capture
  const handleCapturePeriodAttendance = async () => {
    setTakingAttendance(true);
    setAttendanceResult(null);

    let dataUrl: string | null = null;

    if (useLaptopCam && videoRef.current) {
      const video = videoRef.current;
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = video.videoWidth || 640;
      tempCanvas.height = video.videoHeight || 480;
      const ctx = tempCanvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
        dataUrl = tempCanvas.toDataURL("image/jpeg", 0.85);
      }
    } else if (useVirtualCam && overlayCanvasRef.current) {
      dataUrl = overlayCanvasRef.current.toDataURL("image/jpeg", 0.85);
    }

    let returnedStudents: any[] = [];
    try {
      if (dataUrl) {
        const res = await fetch(`${API_BASE_URL}/timetable/take-period-attendance`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(token),
          },
          body: JSON.stringify({
            timetable_id: currentSlot.id,
            image_base64: dataUrl,
            period_number: currentSlot.period_number,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          returnedStudents = data.recognized_students || [];
          setAttendanceResult(
            `Period ${data.period_number} (${data.subject_name || currentSlot.subject_name}) Recorded: ${data.present_count} Present, ${data.absent_count} Absent`
          );
        }
      }
    } catch (err) {
      console.warn("Attendance capture network notice:", err);
    } finally {
      if (returnedStudents.length > 0) {
        const firstStudent = returnedStudents[0];
        setPortalAcceptancePreview({
          student_name:
            firstStudent?.full_name || firstStudent?.student_name || "Student",
          roll_number: firstStudent?.roll_number || "",
          department: "Dept of Computer Science & Engineering",
          section: currentSlot.section,
          semester: "Sem 5",
          period_number: currentSlot.period_number,
          subject_code: currentSlot.subject_code || "CS301",
          subject_name: currentSlot.subject_name || "Computer Networks",
          classroom: currentSlot.classroom,
          faculty_name: currentSlot.faculty_name || "Dr. Alan Turing",
          timestamp: new Date().toLocaleTimeString(),
          verification_method:
            firstStudent?.verification_method || "Multi-Face AI Biometrics",
          confidence: firstStudent?.confidence || 0.88,
          liveness_score: firstStudent?.liveness_score || 0.95,
          status: "PRESENT",
          accepted_students: returnedStudents.map((rs: any) => ({
            student_name: rs.full_name || rs.student_name,
            roll_number: rs.roll_number,
            confidence: rs.confidence || 0.88,
            verification_method: rs.verification_method || "FACE_RECOGNITION",
            status: "PRESENT",
          })),
        });
      } else {
        setPortalAcceptancePreview(null);
        if (!attendanceResult) {
          setAttendanceResult(
            `Period ${currentSlot.period_number} Scan Complete: No enrolled students recognized in this camera frame. (0 Present)`
          );
        }
      }
      setTakingAttendance(false);
    }
  };

  // Live Recognition Loop on Laptop Webcam (High-Speed Classroom-Scoped Multi-Face Engine)
  useEffect(() => {
    let active = true;
    let isProcessing = false;
    let timerId: any = null;

    const processFrame = async () => {
      if (!active || !useLaptopCam || !recognitionActive) return;
      if (!videoRef.current || !overlayCanvasRef.current) return;
      const video = videoRef.current;
      const canvas = overlayCanvasRef.current;
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        timerId = setTimeout(processFrame, 200);
        return;
      }

      if (isProcessing) {
        timerId = setTimeout(processFrame, 150);
        return;
      }

      isProcessing = true;

      try {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          isProcessing = false;
          return;
        }

        // Optimize resolution for high-speed multi-face inference (800px width limit)
        const targetW = Math.min(800, video.videoWidth);
        const scaleFactor = video.videoWidth / targetW;
        const targetH = Math.round(video.videoHeight / scaleFactor);

        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = targetW;
        tempCanvas.height = targetH;
        const tempCtx = tempCanvas.getContext("2d");
        if (!tempCtx) {
          isProcessing = false;
          return;
        }

        tempCtx.drawImage(video, 0, 0, targetW, targetH);
        const dataUrl = tempCanvas.toDataURL("image/jpeg", 0.70);

        const res = await fetch(`${API_BASE_URL}/biometrics/recognize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_base64: dataUrl,
            timetable_id: currentSlot ? currentSlot.id : undefined,
            classroom: currentSlot ? currentSlot.classroom : undefined,
            auto_attendance: autoAttendance,
          }),
        });

        if (res.ok && active) {
          const data = await res.json();
          const recList: RecognizedPerson[] = data.recognized_students || [];
          const allFaces: DetectedFaceItem[] = data.all_detected_faces || [];
          const classroomInfo = data.classroom_info;

          setRecognizedFaces(recList);
          setAllDetectedFaces(allFaces);
          setFacesDetectedCount(data.faces_detected || allFaces.length);
          if (classroomInfo) {
            setClassroomScopeInfo(classroomInfo);
          }

          // Real-time Attendance Recording for all recognized classroom students
          if (recList.length > 0) {
            setLiveAttendanceLog((prev) => {
              const map = new Map(prev.map((p) => [p.student_id, p]));
              recList.forEach((st) => {
                map.set(st.student_id, {
                  student_id: st.student_id,
                  name: st.full_name,
                  roll: st.roll_number,
                  confidence: st.confidence,
                  time: new Date().toLocaleTimeString(),
                  status: "PRESENT",
                });
              });
              return Array.from(map.values()).slice(0, 15);
            });

            if (autoAttendance) {
              setAttendanceResult(
                `✓ Verified ${recList.length} Classroom Student(s) PRESENT for Period ${currentSlot.period_number} (${currentSlot.classroom})`
              );
            }
          }

          // Clear overlay canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Draw Cybernetic HUD Header Bar
          const hudW = Math.min(canvas.width - 32, 700);
          ctx.fillStyle = "rgba(15, 23, 42, 0.90)";
          ctx.fillRect(16, 16, hudW, 36);
          ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(16, 16, hudW, 36);

          ctx.fillStyle = "#38bdf8";
          ctx.font = "bold 11px monospace";
          const classLabel = classroomInfo?.classroom || currentSlot.classroom;
          const subLabel = classroomInfo?.subject_code || currentSlot.subject_code || "CS301";
          const enrolledCount = classroomInfo?.enrolled_count || 45;
          ctx.fillText(
            `CLASSROOM: ${classLabel} • SUB: ${subLabel} • ENROLLED: ${enrolledCount} • DETECTED: ${allFaces.length} • MARKED: ${recList.length}`,
            26,
            38
          );

          // Render 3D Biometric Face Mesh Reticles for all detected faces (Multi-Face Tracking)
          if (allFaces.length > 0) {
            allFaces.forEach((face) => {
              const [rx, ry, rw, rh] = face.bounding_box;
              if (!rw || !rh) return;

              // Scale coordinates to match original full-size canvas
              const x = rx * scaleFactor;
              const y = ry * scaleFactor;
              const w = rw * scaleFactor;
              const h = rh * scaleFactor;

              const scaledLandmarks = face.landmarks
                ? face.landmarks.map(([lx, ly]) => [lx * scaleFactor, ly * scaleFactor])
                : null;

              drawBiometricFaceMesh(
                ctx,
                x,
                y,
                w,
                h,
                face.is_recognized,
                face.spoof_detected,
                scaledLandmarks,
                {
                  name: face.full_name || undefined,
                  roll: face.roll_number || undefined,
                  confidence: face.confidence,
                  statusTag: face.verification_status,
                }
              );
            });
          }
        }
      } catch {
        // Continue on frame drop
      } finally {
        isProcessing = false;
        if (active) {
          timerId = setTimeout(processFrame, 180); // High-speed 4-5 FPS cycle
        }
      }
    };

    if (useLaptopCam && recognitionActive) {
      processFrame();
    }

    return () => {
      active = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [useLaptopCam, recognitionActive, autoAttendance, currentSlot]);

  // Camera & Classroom Deployment Handler
  const handleSaveCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCamera(true);
    setAddCamError(null);
    setAddCamSuccess(null);

    try {
      const targetRoom = (assignClassroomMode === "NEW" ? newClassroomName.trim() : cameraForm.classroom.trim());
      if (!targetRoom) {
        throw new Error("Classroom name is required. Please select or enter a classroom.");
      }

      let finalStreamUrl = cameraForm.stream_url.trim();
      if (cameraForm.camera_type === "RTSP") {
        if (cameraForm.rtsp_ip) {
          const auth = cameraForm.rtsp_user ? `${cameraForm.rtsp_user}:${cameraForm.rtsp_pass || ""}@` : "";
          finalStreamUrl = `rtsp://${auth}${cameraForm.rtsp_ip}:${cameraForm.rtsp_port || "554"}/stream${cameraForm.rtsp_channel || "1"}`;
        }
      } else if (cameraForm.camera_type === "WEBCAM") {
        finalStreamUrl = cameraForm.usb_index || "0";
      } else if (cameraForm.camera_type === "VIRTUAL") {
        finalStreamUrl = "demo";
      }

      const payload = {
        name: cameraForm.name.trim() || `${targetRoom} Overhead CCTV`,
        stream_url: finalStreamUrl,
        camera_type: cameraForm.camera_type,
        classroom: targetRoom,
        crossing_direction: cameraForm.crossing_direction,
        fps: Number(cameraForm.fps),
        resolution: cameraForm.resolution,
        is_active: true,
      };

      const res = await fetch(`${API_BASE_URL}/cctv/cameras`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(token),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to add CCTV camera stream.");
      }

      await Promise.all([loadCameras(), loadClassrooms()]);
      setSelectedClassroom(targetRoom);
      fetchActiveClass(targetRoom);
      setSelectedCam(data);

      setAddCamSuccess(`Camera "${data.name}" deployed to ${targetRoom} successfully!`);
      setTimeout(() => {
        setShowAddCameraModal(false);
        setAddCamSuccess(null);
      }, 1200);
    } catch (err: unknown) {
      setAddCamError(err instanceof Error ? err.message : "Error saving camera configuration.");
    } finally {
      setSavingCamera(false);
    }
  };

  // Camera Management Helpers
  const handleTestCamera = async (camId: number) => {
    try {
      setTesting(true);
      const res = await fetch(`${API_BASE_URL}/cctv/cameras/${camId}/test`, {
        method: "POST",
        headers: getAuthHeaders(token),
      });
      if (res.ok) {
        const data = await res.json();
        setTestResult(data);
      }
    } catch (err) {
      console.error("Test failed", err);
    } finally {
      setTesting(false);
    }
  };

  const handleAddCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/cctv/cameras`, {
        method: "POST",
        headers: getAuthHeaders(token),
        body: JSON.stringify(newCam),
      });
      if (res.ok) {
        setShowAddModal(false);
        loadCameras();
      }
    } catch (err) {
      console.error("Failed to add camera", err);
    }
  };

  const handleDeleteCamera = async (camId: number) => {
    if (!confirm("Are you sure you want to remove this camera stream?")) return;
    try {
      await fetch(`${API_BASE_URL}/cctv/cameras/${camId}`, {
        method: "DELETE",
        headers: getAuthHeaders(token),
      });
      setCameras((prev) => prev.filter((c) => c.id !== camId));
      if (selectedCam?.id === camId) {
        setSelectedCam(cameras.find((c) => c.id !== camId) || null);
      }
    } catch (err) {
      console.error("Failed to delete camera", err);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ============================================================================== */}
      {/* 1. TOP HEADER & TITLE */}
      {/* ============================================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2.5">
            <Video className="w-7 h-7 text-blue-600" />
            AI Facial Attendance &amp; Live Vision
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time biometric face detection, anti-spoof liveness tracking, and 1-click period attendance.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/sessions"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
          >
            <Clock className="w-4 h-4 text-slate-500" />
            <span>Class Sessions</span>
          </Link>
          <Link
            href="/teacher"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
          >
            <Layers className="w-4 h-4 text-slate-500" />
            <span>Daily Ledger</span>
          </Link>
        </div>
      </div>

      {/* ============================================================================== */}
      {/* 2. PROMINENT CLASS SLOT & CAMERA ACTION TOOLBAR */}
      {/* ============================================================================== */}
      <div className="space-y-3">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Classroom Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 text-slate-700 font-bold text-xs uppercase tracking-wider shrink-0">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span>Monitored Classroom:</span>
            </div>
            <select
              id="classroom-selector"
              value={selectedClassroom}
              onChange={(e) => {
                setSelectedClassroom(e.target.value);
                fetchActiveClass(e.target.value);
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 font-bold text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner cursor-pointer"
            >
              {classroomsList.map((room) => (
                <option key={room} value={room}>
                  {room}
                </option>
              ))}
            </select>

            {loadingActiveClass && (
              <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5 animate-pulse">
                <RotateCw className="w-3 h-3 animate-spin text-blue-600" /> Resolving timetable...
              </span>
            )}
          </div>


        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Add CCTV & Assign Classroom Button */}
          <button
            onClick={() => setShowAddCameraModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add CCTV / Assign Classroom</span>
          </button>
          {/* Laptop Webcam Toggle */}
          <button
            id="btn-laptop-webcam"
            onClick={toggleLaptopWebcam}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-sm ${
              useLaptopCam
                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30 ring-2 ring-emerald-400"
                : "bg-slate-900 hover:bg-slate-800 text-white"
            }`}
          >
            <Laptop className="w-4 h-4 text-current" />
            {useLaptopCam ? (
              <>
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                <span>Laptop Webcam (Active)</span>
              </>
            ) : (
              <span>Laptop Webcam</span>
            )}
          </button>

          {/* Record Period Attendance */}
          <button
            id="btn-record-attendance"
            onClick={handleCapturePeriodAttendance}
            disabled={takingAttendance}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-blue-600/25 transition transform active:scale-95"
          >
            <CameraIcon className={`w-4 h-4 ${takingAttendance ? "animate-spin" : ""}`} />
            <span>{takingAttendance ? "Recording Attendance..." : "Record Period Attendance"}</span>
          </button>

          {/* Auto-Attendance Toggle */}
          <button
            id="btn-auto-attendance"
            onClick={() => setAutoAttendance(!autoAttendance)}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition ${
              autoAttendance
                ? "bg-emerald-50 text-emerald-700 border-emerald-300 ring-2 ring-emerald-400"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                autoAttendance ? "bg-emerald-500 animate-ping" : "bg-slate-300"
              }`}
            />
            <span>Auto-Attendance: {autoAttendance ? "ON" : "OFF"}</span>
          </button>
        </div>
      </div>

      {/* ACTIVE CLASS VS NO CLASS SCHEDULED BANNER */}
      {activeClassInfo && (
        <div className="animate-in fade-in duration-200">
          {activeClassInfo.has_conflict ? (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-3 shadow-xs">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <div className="text-xs">
                <span className="font-bold">Scheduling Conflict: </span>
                <span>{activeClassInfo.conflict_message}</span>
              </div>
            </div>
          ) : activeClassInfo.has_active_class ? (
            <div className="p-3.5 rounded-2xl bg-emerald-50/90 border border-emerald-200 text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                <div>
                  <div className="text-xs font-extrabold flex flex-wrap items-center gap-2">
                    <span className="bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded text-[11px]">
                      Period {activeClassInfo.period_number} Active
                    </span>
                    <span>
                      {activeClassInfo.subject_code} &bull; {activeClassInfo.subject_name}
                    </span>
                  </div>
                  <div className="text-[11px] text-emerald-700 mt-0.5">
                    Section {activeClassInfo.section} &bull; Prof. {activeClassInfo.faculty_name} &bull;{" "}
                    <span className="font-mono font-semibold">
                      {activeClassInfo.start_time} - {activeClassInfo.end_time}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full border border-emerald-300">
                  Live Attendance Active
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    No class scheduled in this classroom at the current time.
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Classroom: <strong className="text-slate-700">{selectedClassroom}</strong> &bull; Institutional Time:{" "}
                    <span className="font-mono">{activeClassInfo.current_time}</span> ({activeClassInfo.day_of_week})
                    {activeClassInfo.next_class && (
                      <span>
                        {" "}&bull; Upcoming next:{" "}
                        <strong className="text-blue-700">
                          Period {activeClassInfo.next_class.period_number} ({activeClassInfo.next_class.subject_code}) at {activeClassInfo.next_class.start_time}
                        </strong>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full border border-amber-300 shrink-0">
                Room Idle
              </span>
            </div>
          )}
        </div>
      )}
    </div>


      {/* Hardware Error Alert (if camera is locked) */}
      {cameraLockError && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <h4 className="font-bold text-sm text-amber-950">
                Camera Notice: {cameraLockError.errorType}
              </h4>
            </div>
            <button
              onClick={() => setCameraLockError(null)}
              className="text-amber-800 hover:text-black font-bold text-base"
            >
              &times;
            </button>
          </div>
          <p className="text-xs text-amber-800">{cameraLockError.message}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 text-[11px] text-amber-900">
            {cameraLockError.suggestions.map((s, idx) => (
              <div key={idx} className="p-2 rounded-lg bg-white/70 border border-amber-200">
                {s}
              </div>
            ))}
          </div>
          <div className="pt-1 flex items-center gap-2">
            <button
              onClick={() => {
                setCameraLockError(null);
                toggleLaptopWebcam();
              }}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition"
            >
              Retry Webcam / RTSP
            </button>
          </div>
        </div>
      )}

      {/* Attendance Result Toast Banner */}
      {attendanceResult && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{attendanceResult}</span>
          </div>
          <button
            onClick={() => setAttendanceResult(null)}
            className="text-emerald-700 hover:text-emerald-950 text-sm font-bold"
          >
            &times;
          </button>
        </div>
      )}

      {/* ============================================================================== */}
      {/* 3. MAIN LIVE VIEWPORT & DETAILS GRID */}
      {/* ============================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Live Camera Feed Viewport */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative rounded-2xl overflow-hidden border border-slate-900 bg-black aspect-video shadow-2xl flex items-center justify-center group">
            {/* PERMANENTLY MOUNTED VIDEO ELEMENT */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover mirror ${
                useLaptopCam ? "block" : "absolute opacity-0 pointer-events-none w-1 h-1"
              }`}
            />

            {/* PERMANENTLY MOUNTED AI OVERLAY CANVAS */}
            <canvas
              ref={overlayCanvasRef}
              className={`absolute inset-0 w-full h-full object-cover pointer-events-none mirror ${
                useLaptopCam || useVirtualCam ? "block" : "hidden"
              }`}
            />

            {/* Inactive Camera Screen Placeholder */}
            {!useLaptopCam && !useVirtualCam && (
              <div className="text-center p-8 space-y-4">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-blue-400 shadow-xl">
                  <Laptop className="w-8 h-8 text-blue-400" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-white">Laptop Camera AI Face Detector</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Select a class slot above and click{" "}
                    <span className="text-emerald-400 font-semibold">&quot;Laptop Webcam&quot;</span> to begin real-time face tracking with the glowing green reticle.
                  </p>
                </div>
                <button
                  onClick={toggleLaptopWebcam}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition transform hover:scale-105"
                >
                  <Laptop className="w-4 h-4" />
                  <span>Start Laptop Webcam</span>
                </button>
              </div>
            )}

            {/* Active HUD Overlays */}
            {(useLaptopCam || useVirtualCam) && (
              <>
                {/* Top-Left Live HUD Badge */}
                <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-950/85 backdrop-blur-md border border-emerald-500/50 text-xs font-medium text-white shadow-lg">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="font-semibold text-emerald-300">
                    {useLaptopCam ? "LAPTOP WEBCAM LIVE" : "SIMULATED AI VISION"}
                  </span>
                  <span className="text-slate-500">|</span>
                  <span className="text-slate-300 font-mono text-[11px]">
                    Period {currentSlot.period_number} • {currentSlot.subject_code}
                  </span>
                </div>

                {/* Top-Right Identified Badge */}
                {recognizedFaces.length > 0 && (
                  <div className="absolute top-4 right-4 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/90 backdrop-blur-md border border-emerald-500 text-xs font-bold text-emerald-200 shadow-xl animate-in fade-in duration-150">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span>
                      {recognizedFaces[0].full_name} ({recognizedFaces[0].roll_number}) • {(recognizedFaces[0].confidence * 100).toFixed(0)}% MATCH
                    </span>
                  </div>
                )}

                {/* Bottom HUD Bar */}
                <div className="absolute bottom-4 inset-x-4 flex items-center justify-between px-4 py-2 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800 text-xs text-slate-300 font-mono">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">Class:</span>
                    <strong className="text-white">{currentSlot.subject_name}</strong>
                    <span className="text-slate-500">|</span>
                    <span className="text-slate-400">Room:</span>
                    <strong className="text-cyan-300">{currentSlot.classroom}</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-emerald-400 font-bold">READY TO COMMIT ATTENDANCE</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ============================================================================== */}
          {/* REGISTERED CLASSROOM CCTV FEEDS & RTSP MANAGER */}
          {/* ============================================================================== */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                  <Tv className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Registered Classroom CCTV Feeds
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Active RTSP IP streams, local hardware, and assigned academic classrooms.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowAddCameraModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Stream</span>
              </button>
            </div>

            {/* Camera Feeds Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {cameras.map((cam) => {
                const isSelected = selectedCam?.id === cam.id;
                return (
                  <div
                    key={cam.id}
                    onClick={() => {
                      setSelectedCam(cam);
                      setSelectedClassroom(cam.classroom);
                      fetchActiveClass(cam.classroom);
                    }}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer flex flex-col justify-between gap-3 ${
                      isSelected
                        ? "bg-blue-50/70 border-blue-400 ring-2 ring-blue-500/20 shadow-xs"
                        : "bg-slate-50/60 border-slate-200/80 hover:bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                          <h4 className="text-xs font-bold text-slate-900 truncate">{cam.name}</h4>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                          <MapPin className="w-3 h-3 text-blue-600 shrink-0" />
                          <span className="font-semibold text-blue-700">{cam.classroom}</span>
                        </div>
                      </div>

                      <span className="px-2 py-0.5 rounded-md font-mono text-[9px] font-bold uppercase bg-slate-200 text-slate-700 shrink-0">
                        {cam.camera_type}
                      </span>
                    </div>

                    <div className="text-[10px] font-mono text-slate-400 truncate bg-white/80 px-2 py-1 rounded-lg border border-slate-200/60">
                      URI: {cam.stream_url}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/40 text-[11px]">
                      <span className="text-slate-500 font-medium">
                        {cam.resolution} &bull; {cam.fps} FPS
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTestCamera(cam.id);
                          }}
                          className="text-blue-600 hover:text-blue-800 font-bold transition"
                        >
                          {testing ? "Testing..." : "Test Ping"}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCamera(cam.id);
                          }}
                          className="text-slate-400 hover:text-rose-600 transition"
                          title="Remove stream"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ============================================================================== */}
          {/* 4. IN-PORTAL ACCEPTANCE PREVIEW CARD */}
          {/* ============================================================================== */}
          {portalAcceptancePreview && (
            <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-500 bg-gradient-to-br from-emerald-950/80 via-slate-950 to-slate-950 p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-500/20 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 animate-bounce" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                        Attendance Acceptance Preview (Marked Present)
                      </span>
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        COMMITTED TO DB
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-white mt-0.5">
                      {portalAcceptancePreview.student_name}
                      <span className="text-emerald-400 ml-2 font-mono text-sm">
                        ({portalAcceptancePreview.roll_number})
                      </span>
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500 text-slate-950 shadow-md">
                    ✓ STATUS: PRESENT
                  </span>
                  <button
                    onClick={() => setPortalAcceptancePreview(null)}
                    className="text-slate-400 hover:text-white text-sm p-1"
                  >
                    &times;
                  </button>
                </div>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[11px] block">Period &amp; Subject</span>
                  <p className="font-bold text-white">
                    Period {portalAcceptancePreview.period_number}: {portalAcceptancePreview.subject_code}
                  </p>
                  <p className="text-slate-300 text-[11px] truncate">
                    {portalAcceptancePreview.subject_name}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[11px] block">Classroom &amp; Faculty</span>
                  <p className="font-bold text-cyan-300">
                    {portalAcceptancePreview.classroom} • Section {portalAcceptancePreview.section}
                  </p>
                  <p className="text-slate-300 text-[11px]">{portalAcceptancePreview.faculty_name}</p>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[11px] block">Biometric Telemetry</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-emerald-400">
                      {(portalAcceptancePreview.confidence * 100).toFixed(0)}% MATCH
                    </span>
                    <span className="text-slate-500">•</span>
                    <span className="font-mono font-bold text-cyan-400">
                      {(portalAcceptancePreview.liveness_score * 100).toFixed(0)}% LIVENESS
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-slate-400">
                    Timestamp: {portalAcceptancePreview.timestamp}
                  </p>
                </div>
              </div>

              {/* Footer Links */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-xs">
                <span className="text-slate-400 text-[11px] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Verified attendance ledger entry committed with tamper-proof security logging.
                </span>
                <Link
                  href="/sessions"
                  className="flex items-center gap-1 font-semibold text-cyan-400 hover:text-cyan-300 hover:underline"
                >
                  <span>View in Sessions Ledger &rarr;</span>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Right Column (1 Col): Active Slot Info & Live Telemetry */}
        <div className="space-y-4">
          {/* Active Period Card */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                Active Class Period
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                Period {currentSlot.period_number}
              </span>
            </div>

            <div className="space-y-2">
              <div>
                <h4 className="text-base font-extrabold text-slate-900 leading-tight">
                  {currentSlot.subject_name}
                </h4>
                <p className="text-xs text-blue-600 font-mono font-semibold mt-0.5">
                  Code: {currentSlot.subject_code}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 text-[10px] block">Time Slot</span>
                  <span className="font-bold text-slate-800">
                    {currentSlot.start_time} - {currentSlot.end_time}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 text-[10px] block">Classroom</span>
                  <span className="font-bold text-slate-800">{currentSlot.classroom}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
                <span>Faculty:</span>
                <strong className="text-slate-900">{currentSlot.faculty_name}</strong>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Section:</span>
                <strong className="text-slate-900">Section {currentSlot.section}</strong>
              </div>
            </div>
          </div>

          {/* Classroom Attendance Scoping Banner */}
          <div className="p-4 rounded-2xl bg-cyan-50 border border-cyan-200 text-cyan-950 text-xs space-y-1.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-bold flex items-center gap-1.5 text-cyan-900">
                <ShieldCheck className="w-4 h-4 text-cyan-600" />
                Classroom Student Filter Active
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-100 text-cyan-800">
                ROOM-SCOPED
              </span>
            </div>
            <p className="text-[11px] text-cyan-800 leading-snug">
              Surveillance is locked to <strong className="text-slate-900">{currentSlot.classroom}</strong> (Section {currentSlot.section}). Face recognition strictly matches against the enrolled students of this classroom. Non-enrolled students are rejected.
            </p>
          </div>

          {/* Live Verified Classroom Attendance Ledger */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                Live Attendance Feed ({liveAttendanceLog.length} Present)
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  liveAttendanceLog.length > 0
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {liveAttendanceLog.length > 0 ? "STREAMING" : "STANDBY"}
              </span>
            </div>

            {liveAttendanceLog.length > 0 ? (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {liveAttendanceLog.map((st) => (
                  <div
                    key={st.student_id}
                    className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between text-xs animate-in fade-in duration-150"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      <div>
                        <h5 className="font-bold text-slate-900 text-xs leading-none">{st.name}</h5>
                        <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                          {st.roll} • {(st.confidence * 100).toFixed(0)}% Match • {st.time}
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-600 text-white shadow-xs">
                      PRESENT
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 space-y-2">
                <CameraIcon className="w-8 h-8 mx-auto opacity-30 text-slate-500" />
                <p className="text-xs">
                  Awaiting faces in camera feed. Enrolled students will appear here as they are detected.
                </p>
              </div>
            )}
          </div>

          {/* Quick Guide */}
          <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 text-blue-950 text-xs space-y-2">
            <span className="font-bold flex items-center gap-1.5 text-blue-900">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              How Multi-Face Classroom Attendance Works:
            </span>
            <ol className="list-decimal pl-4 space-y-1 text-slate-600 text-[11px]">
              <li>The camera detects all faces in the classroom simultaneously.</li>
              <li>Only students enrolled in <strong className="text-slate-800">{currentSlot.classroom}</strong> are searched.</li>
              <li>🟢 <strong>Green Sticks:</strong> Enrolled student &rarr; Attendance automatically marked PRESENT.</li>
              <li>🔴 <strong>Red Sticks:</strong> Outsider/Unregistered &rarr; Attendance rejected.</li>
            </ol>
          </div>
        </div>
      </div>
      {/* ============================================================================== */}
      {/* MODAL: ADD CCTV STREAM & ASSIGN CLASSROOM */}
      {/* ============================================================================== */}
      {showAddCameraModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                  <Video className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Add CCTV Stream &amp; Assign Classroom
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Configure RTSP IP camera, hardware stream, or USB sensor for real-time attendance.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddCameraModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notification messages inside modal */}
            {addCamError && (
              <div className="mx-6 mt-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{addCamError}</span>
              </div>
            )}
            {addCamSuccess && (
              <div className="mx-6 mt-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{addCamSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveCamera} className="p-6 space-y-4 text-xs">
              {/* Camera Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Camera Feed Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Room 302 Front Overhead PTZ"
                  value={cameraForm.name}
                  onChange={(e) => setCameraForm({ ...cameraForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              {/* Classroom Assignment Section */}
              <div className="space-y-2 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-blue-600" />
                    <span>Assigned Classroom Facility</span>
                  </label>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setAssignClassroomMode("EXISTING")}
                      className={`font-semibold cursor-pointer ${
                        assignClassroomMode === "EXISTING"
                          ? "text-blue-600 underline font-bold"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Select Existing
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setAssignClassroomMode("NEW")}
                      className={`font-semibold cursor-pointer ${
                        assignClassroomMode === "NEW"
                          ? "text-blue-600 underline font-bold"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      + Create New Classroom
                    </button>
                  </div>
                </div>

                {assignClassroomMode === "EXISTING" ? (
                  <select
                    value={cameraForm.classroom}
                    onChange={(e) => setCameraForm({ ...cameraForm, classroom: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                  >
                    {classroomsList.map((room) => (
                      <option key={room} value={room}>
                        {room}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-2 pt-1">
                    <input
                      type="text"
                      required
                      placeholder="e.g. Room 404, Electronics Lab 2, Hall A"
                      value={newClassroomName}
                      onChange={(e) => setNewClassroomName(e.target.value)}
                      className="w-full bg-white border border-blue-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-blue-600 shadow-2xs"
                    />
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <input
                        type="text"
                        placeholder="Building (e.g. Tech Block)"
                        value={newClassroomBuilding}
                        onChange={(e) => setNewClassroomBuilding(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700"
                      />
                      <input
                        type="number"
                        placeholder="Capacity (e.g. 60)"
                        value={newClassroomCapacity}
                        onChange={(e) => setNewClassroomCapacity(Number(e.target.value))}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700"
                      />
                    </div>
                    <p className="text-[10px] text-blue-700">
                      &bull; This classroom will be automatically created in the academic timetable database.
                    </p>
                  </div>
                )}
              </div>

              {/* Feed Medium / Camera Protocol Cards */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Feed Protocol / Stream Medium
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { type: "RTSP", label: "RTSP Stream", desc: "Overhead CCTV / IP Camera", icon: Radio },
                    { type: "WEBCAM", label: "USB Hardware", desc: "Local USB Camera / Index", icon: CameraIcon },
                    { type: "HTTP_MJPEG", label: "HTTP / MJPEG", desc: "Webcam / IP Web Stream", icon: Wifi },
                    { type: "VIRTUAL", label: "Simulated Feed", desc: "Virtual Automated Stream", icon: Sparkles },
                  ].map((item) => {
                    const isSelected = cameraForm.camera_type === item.type;
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.type}
                        onClick={() => setCameraForm({ ...cameraForm, camera_type: item.type })}
                        className={`p-3 rounded-2xl border transition cursor-pointer space-y-1 ${
                          isSelected
                            ? "bg-blue-50/80 border-blue-400 ring-2 ring-blue-500/15"
                            : "bg-slate-50 border-slate-200 hover:bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-blue-600" : "text-slate-500"}`} />
                          <span className={`font-bold ${isSelected ? "text-blue-900" : "text-slate-800"}`}>
                            {item.label}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-tight">{item.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Medium-Specific Configuration */}
              {cameraForm.camera_type === "RTSP" && (
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                  <span className="text-xs font-bold text-slate-800 block">
                    RTSP Connection Parameters &amp; Stream Number
                  </span>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="text-[10px] font-medium text-slate-500 block mb-0.5">IP Address / Host</label>
                      <input
                        type="text"
                        placeholder="192.168.1.100"
                        value={cameraForm.rtsp_ip}
                        onChange={(e) => setCameraForm({ ...cameraForm, rtsp_ip: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-xs text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-slate-500 block mb-0.5">RTSP Port</label>
                      <input
                        type="text"
                        placeholder="554"
                        value={cameraForm.rtsp_port}
                        onChange={(e) => setCameraForm({ ...cameraForm, rtsp_port: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-xs text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-medium text-slate-500 block mb-0.5">RTSP Channel / Stream #</label>
                      <input
                        type="text"
                        placeholder="1"
                        value={cameraForm.rtsp_channel}
                        onChange={(e) => setCameraForm({ ...cameraForm, rtsp_channel: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-xs text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-slate-500 block mb-0.5">Username (Optional)</label>
                      <input
                        type="text"
                        placeholder="admin"
                        value={cameraForm.rtsp_user}
                        onChange={(e) => setCameraForm({ ...cameraForm, rtsp_user: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-slate-500 block mb-0.5">Password</label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={cameraForm.rtsp_pass}
                        onChange={(e) => setCameraForm({ ...cameraForm, rtsp_pass: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="pt-1">
                    <label className="text-[10px] font-medium text-slate-500 block mb-0.5">
                      Or Direct RTSP Stream URI
                    </label>
                    <input
                      type="text"
                      placeholder="rtsp://admin:admin123@192.168.1.100:554/stream1"
                      value={cameraForm.stream_url}
                      onChange={(e) => setCameraForm({ ...cameraForm, stream_url: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-[11px] text-slate-800"
                    />
                  </div>
                </div>
              )}

              {cameraForm.camera_type === "WEBCAM" && (
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                  <label className="text-xs font-bold text-slate-800 block">
                    USB Camera Device Index
                  </label>
                  <select
                    value={cameraForm.usb_index}
                    onChange={(e) => setCameraForm({ ...cameraForm, usb_index: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
                  >
                    <option value="0">Camera 0 (Default Integrated Webcam)</option>
                    <option value="1">Camera 1 (External USB CCTV Lens 1)</option>
                    <option value="2">Camera 2 (External USB CCTV Lens 2)</option>
                  </select>
                </div>
              )}

              {cameraForm.camera_type === "HTTP_MJPEG" && (
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                  <label className="text-xs font-bold text-slate-800 block">
                    HTTP Stream / MJPEG Endpoint
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="http://192.168.1.50:8080/video"
                    value={cameraForm.stream_url}
                    onChange={(e) => setCameraForm({ ...cameraForm, stream_url: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-mono text-xs text-slate-800"
                  />
                </div>
              )}

              {/* Sensor & Quality Settings */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 block mb-1">Direction</label>
                  <select
                    value={cameraForm.crossing_direction}
                    onChange={(e) => setCameraForm({ ...cameraForm, crossing_direction: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-medium"
                  >
                    <option value="LEFT_TO_RIGHT_ENTRY">Left &rarr; Right</option>
                    <option value="RIGHT_TO_LEFT_ENTRY">Right &rarr; Left</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-600 block mb-1">Resolution</label>
                  <select
                    value={cameraForm.resolution}
                    onChange={(e) => setCameraForm({ ...cameraForm, resolution: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-medium"
                  >
                    <option value="1920x1080">1080p FHD</option>
                    <option value="1280x720">720p HD</option>
                    <option value="640x480">480p SD</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-600 block mb-1">Target FPS</label>
                  <select
                    value={cameraForm.fps}
                    onChange={(e) => setCameraForm({ ...cameraForm, fps: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-medium"
                  >
                    <option value={25}>25 FPS</option>
                    <option value={30}>30 FPS</option>
                    <option value={15}>15 FPS</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddCameraModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCamera}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {savingCamera ? "Connecting & Deploying..." : "Deploy Camera Stream"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
