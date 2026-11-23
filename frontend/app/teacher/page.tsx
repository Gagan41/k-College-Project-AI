"use client";

import React, { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  GraduationCap,
  Calendar,
  BarChart3,
  CheckCircle2,
  Clock,
  RotateCw,
  Search,
  BookOpen,
  Filter,
  Check,
  X,
  Layers,
  Sparkles,
  Camera,
  Lock,
  Unlock,
  AlertCircle,
  AlertTriangle,
  Building,
  Users,
  MapPin,
  CalendarDays,
  Send,
  UserCheck,
  UserX,
  ShieldCheck,
  Cloud,
  ChevronRight,
  TrendingUp,
  Eye,
  Video,
  Maximize2,
  Minimize2,
} from "lucide-react";
import Link from "next/link";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface TeacherSlot {
  id: number;
  period_number: number;
  start_time: string;
  end_time: string;
  subject_id: number;
  subject_code: string;
  subject_name: string;
  classroom: string;
  section: string;
  status: "ACTIVE_NOW" | "UPCOMING" | "COMPLETED" | "SCHEDULED";
  is_active_now: boolean;
  can_take_attendance: boolean;
  lock_reason?: string | null;
}

interface StudentRosterItem {
  student_id: number;
  roll_number: string;
  full_name: string;
  email: string;
  section: string;
  semester: number;
  biometric_enrolled: boolean;
  photo_url?: string | null;
  status: "PRESENT" | "ABSENT" | "NOT_RECORDED" | string;
  presence_ratio: number;
  verification_method?: string | null;
  minutes_present: number;
}

interface TeacherSubjectItem {
  id: number;
  code: string;
  name: string;
  department: string;
  semester: number;
  credits: number;
  section: string;
  classroom: string;
  enrolled_students_count: number;
  classes_held: number;
}

interface TeacherScheduleData {
  cctv_camera?: {
    id: number;
    name: string;
    classroom: string;
    camera_type: string;
    status: string;
    stream_url: string;
    snapshot_url: string;
  } | null;
  teacher: {
    id: number;
    name: string;
    email: string;
    employee_id: string;
    department: string;
    designation: string;
    is_class_teacher: boolean;
    class_teacher_section?: string | null;
  };
  current_time: string;
  current_day: string;
  current_date: string;
  has_active_class_now: boolean;
  active_class?: TeacherSlot | null;
  next_class?: TeacherSlot | null;
  displayed_class?: TeacherSlot | null;
  today_schedule: TeacherSlot[];
  student_roster: StudentRosterItem[];
  weekly_grid: {
    days: string[];
    grid: Record<string, TeacherSlot[]>;
  };
  my_subjects: TeacherSubjectItem[];
}

function TeacherPortalContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, token } = useAuth();

  // Active tab state
  type TabType = "live_attendance" | "weekly_timetable" | "subject_matrix" | "today_timeline";
  const initialTab = (searchParams.get("tab") as TabType) || "live_attendance";
  const [activeTab, setActiveTab] = useState<TabType>(
    initialTab === ("class_teacher_ledger" as any) ? "live_attendance" : initialTab
  );

  // Sync tab with URL
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam) {
      if (tabParam === "class_teacher_ledger") {
        setActiveTab("live_attendance");
      } else if (["live_attendance", "weekly_timetable", "subject_matrix", "today_timeline"].includes(tabParam)) {
        setActiveTab(tabParam as TabType);
      }
    }
  }, [searchParams]);

  const switchTab = (tab: TabType) => {
    setActiveTab(tab);
    router.replace(`/teacher?tab=${tab}`);
  };

  // Live real-time clock
  const [currentTime, setCurrentTime] = useState<string>("");
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Main Teacher Data state
  const [data, setData] = useState<TeacherScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [searchStudent, setSearchStudent] = useState("");
  const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [updatingStudentId, setUpdatingStudentId] = useState<number | null>(null);

  // Load teacher schedule & roster
  const loadTeacherData = async (slotId?: number | null) => {
    try {
      setLoading(true);
      const url = slotId
        ? `${API_BASE_URL}/timetable/teacher/my-schedule?selected_timetable_id=${slotId}`
        : `${API_BASE_URL}/timetable/teacher/my-schedule`;
      const res = await fetch(url, { headers: getAuthHeaders(token) });
      if (res.ok) {
        const json: TeacherScheduleData = await res.json();
        setData(json);
        if (json.displayed_class && !slotId) {
          setSelectedSlotId(json.displayed_class.id);
        }
      } else {
        const err = await res.json();
        setActionFeedback({ type: "error", text: err.detail || "Failed to load teacher schedule." });
      }
    } catch (err: unknown) {
      setActionFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Error connecting to server.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadTeacherData(selectedSlotId);
    }
  }, [token, selectedSlotId]);

  // Handle Manual Attendance Mark / Toggle
  const handleToggleStatus = async (studentId: number, currentStatus: string) => {
    const activeSlot = data?.displayed_class;
    if (!activeSlot) return;

    if (!activeSlot.can_take_attendance && user?.role === "FACULTY") {
      setActionFeedback({
        type: "error",
        text: activeSlot.lock_reason || "Attendance taking is locked outside class schedule.",
      });
      return;
    }

    const nextStatus = currentStatus === "PRESENT" ? "ABSENT" : "PRESENT";
    setUpdatingStudentId(studentId);
    try {
      const res = await fetch(`${API_BASE_URL}/timetable/teacher/mark-manual-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(token) },
        body: JSON.stringify({
          timetable_id: activeSlot.id,
          student_id: studentId,
          status: nextStatus,
        }),
      });
      if (res.ok) {
        // Optimistically update roster
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            student_roster: prev.student_roster.map((s) =>
              s.student_id === studentId
                ? {
                    ...s,
                    status: nextStatus,
                    presence_ratio: nextStatus === "PRESENT" ? 1.0 : 0.0,
                    minutes_present: nextStatus === "PRESENT" ? 60 : 0,
                  }
                : s
            ),
          };
        });
        setActionFeedback({ type: "success", text: `Updated student status to ${nextStatus}.` });
      } else {
        const err = await res.json();
        setActionFeedback({ type: "error", text: err.detail || "Failed to update status." });
      }
    } catch (err: unknown) {
      setActionFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Network error.",
      });
    } finally {
      setUpdatingStudentId(null);
    }
  };

  // CCTV Scanning State
  const [isScanningCCTV, setIsScanningCCTV] = useState(false);
  const [cctvScanResult, setCctvScanResult] = useState<{
    detected_faces: number;
    recognized_count: number;
    message: string;
  } | null>(null);

  // Live Feed Watch & Popout Modal State
  const [showLiveFeedModal, setShowLiveFeedModal] = useState(false);
  const [liveFeedSource, setLiveFeedSource] = useState<"CCTV" | "WEBCAM">("CCTV");
  const modalVideoRef = useRef<HTMLVideoElement | null>(null);
  const [webcamActive, setWebcamActive] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (showLiveFeedModal && liveFeedSource === "WEBCAM") {
      navigator.mediaDevices?.getUserMedia({ video: { width: 1280, height: 720 } })
        .then((s) => {
          stream = s;
          if (modalVideoRef.current) {
            modalVideoRef.current.srcObject = s;
            modalVideoRef.current.play();
            setWebcamActive(true);
          }
        })
        .catch((err) => {
          console.error("Webcam access error:", err);
          setWebcamActive(false);
        });
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [showLiveFeedModal, liveFeedSource]);

  // Take Attendance from Classroom CCTV Feed via YuNet Face Detection + SFace Biometrics
  const handleScanCCTVAttendance = async () => {
    const activeSlot = data?.displayed_class;
    if (!activeSlot) return;

    if (!activeSlot.can_take_attendance && user?.role === "FACULTY") {
      setActionFeedback({
        type: "error",
        text: activeSlot.lock_reason || "Attendance taking is locked outside class schedule.",
      });
      return;
    }

    setIsScanningCCTV(true);
    setCctvScanResult(null);
    setActionFeedback(null);

    try {
      const res = await fetch(`${API_BASE_URL}/timetable/teacher/scan-cctv-attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(token) },
        body: JSON.stringify({
          timetable_id: activeSlot.id,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "CCTV attendance scan failed.");
      }

      const result = await res.json();
      setCctvScanResult({
        detected_faces: result.detected_faces_in_cctv,
        recognized_count: result.recognized_students_count,
        message: result.message,
      });

      // Refresh schedule and roster data so marked students update immediately
      await loadTeacherData(activeSlot.id);

      setActionFeedback({
        type: "success",
        text: result.message || `CCTV scan complete: ${result.recognized_students_count} students marked Present.`,
      });
    } catch (err: unknown) {
      setActionFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to scan CCTV feed.",
      });
    } finally {
      setIsScanningCCTV(false);
    }
  };

  // Filter students by search term
  const filteredRoster = useMemo(() => {
    if (!data?.student_roster) return [];
    if (!searchStudent.trim()) return data.student_roster;
    const q = searchStudent.toLowerCase();
    return data.student_roster.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        s.roll_number.toLowerCase().includes(q) ||
        (s.section && s.section.toLowerCase().includes(q))
    );
  }, [data?.student_roster, searchStudent]);

  // Attendance stats for current slot
  const currentSlotStats = useMemo(() => {
    const roster = data?.student_roster || [];
    const total = roster.length;
    const present = roster.filter((s) => s.status === "PRESENT").length;
    const absent = roster.filter((s) => s.status === "ABSENT").length;
    const unrecorded = roster.filter((s) => s.status === "NOT_RECORDED" || !s.status).length;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    return { total, present, absent, unrecorded, rate };
  }, [data?.student_roster]);

  const displayedSlot = data?.displayed_class;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Teacher Workspace Header */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <GraduationCap className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Faculty Attendance Workspace</span>
                {data?.teacher && (
                  <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                    {data.teacher.name}
                  </span>
                )}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {data?.teacher.department} &bull; {data?.teacher.designation || "Assistant Professor"} &bull;{" "}
                <span className="font-mono text-slate-600">{data?.teacher.employee_id}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Live Wall-Clock & Today's Date */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-2xl flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-blue-600 animate-pulse" />
            <div className="text-right">
              <div className="font-mono font-bold text-xs text-slate-900">{currentTime || "..."}</div>
              <div className="text-[10px] text-slate-500 font-semibold">
                {data?.current_day}, {data?.current_date}
              </div>
            </div>
          </div>

          <button
            onClick={() => loadTeacherData(selectedSlotId)}
            className="p-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition shadow-xs cursor-pointer"
            title="Refresh Schedule & Attendance"
          >
            <RotateCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* 4 Main Tabs */}
      <div className="flex items-center p-1 bg-slate-100/90 rounded-2xl border border-slate-200 text-xs gap-1 max-w-fit">
        {[
          { id: "live_attendance", label: "Live Class Attendance", icon: CheckCircle2 },
          { id: "weekly_timetable", label: "My Weekly Timetable", icon: CalendarDays },
          { id: "subject_matrix", label: "My Subjects & Students", icon: BookOpen },
          { id: "today_timeline", label: "Today's Schedule", icon: Clock },
        ].map((tab) => {
          const Icon = tab.icon;
          const isCurrent = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition cursor-pointer ${
                isCurrent
                  ? "bg-white text-blue-700 shadow-xs border border-blue-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Icon className="w-4 h-4 text-blue-600" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Banner / Feedback */}
      {actionFeedback && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center justify-between shadow-xs ${
            actionFeedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-rose-50 border-rose-200 text-rose-900"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {actionFeedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-semibold">{actionFeedback.text}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-slate-400 hover:text-slate-700 text-xs cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* =========================================================================
          TAB 1: LIVE CLASS ATTENDANCE (STRICT TIME-LOCKING LOGIC)
      ========================================================================= */}
      {activeTab === "live_attendance" && (
        <div className="space-y-6">
          {/* Active / Selected Class Card with Time-Lock Indicator */}
          {displayedSlot ? (
            <div
              className={`rounded-3xl border p-6 shadow-xs transition-all ${
                displayedSlot.can_take_attendance
                  ? "bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-white border-emerald-300 ring-2 ring-emerald-500/20"
                  : "bg-white border-slate-200"
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {displayedSlot.can_take_attendance ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600 text-white font-bold text-xs shadow-xs animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                        <span>LIVE CLASS IN PROGRESS</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200">
                        <Lock className="w-3.5 h-3.5 text-slate-500" />
                        <span>ATTENDANCE TAKING LOCKED</span>
                      </span>
                    )}

                    <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-lg">
                      Period {displayedSlot.period_number}
                    </span>

                    <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-lg">
                      {displayedSlot.start_time} - {displayedSlot.end_time}
                    </span>
                  </div>

                  <div>
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                      <span>{displayedSlot.subject_name}</span>
                      <span className="text-xs font-mono font-semibold text-slate-500">
                        ({displayedSlot.subject_code})
                      </span>
                    </h2>
                    <p className="text-xs text-slate-600 mt-1 flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-rose-500" />
                        <span className="font-bold text-slate-800">{displayedSlot.classroom}</span>
                      </span>
                      <span>&bull;</span>
                      <span>
                        Section: <strong className="text-slate-800">{displayedSlot.section}</strong>
                      </span>
                    </p>
                  </div>

                  {/* Lock Notice or Live Notice */}
                  {!displayedSlot.can_take_attendance ? (
                    <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-2.5 max-w-2xl">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Attendance Locked Outside Scheduled Hours</p>
                        <p className="text-[11px] text-amber-800 mt-0.5">
                          {displayedSlot.lock_reason ||
                            `You can only take attendance for ${displayedSlot.subject_name} in ${displayedSlot.classroom} during its scheduled period (${displayedSlot.start_time} - ${displayedSlot.end_time}).`}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-start gap-2.5 max-w-2xl">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Active Scheduled Period &bull; Attendance Open</p>
                        <p className="text-[11px] text-emerald-700 mt-0.5">
                          CCTV sensor in {displayedSlot.classroom} is actively streaming and verifying students.
                          You may verify student biometric records or apply manual marks below.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Metric Summary Counters */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-center min-w-[90px]">
                    <div className="text-lg font-bold text-slate-900">{currentSlotStats.total}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Enrolled</div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center min-w-[90px]">
                    <div className="text-lg font-bold text-emerald-700">{currentSlotStats.present}</div>
                    <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Present</div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-center min-w-[90px]">
                    <div className="text-lg font-bold text-rose-700">{currentSlotStats.absent}</div>
                    <div className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Absent</div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-center min-w-[90px]">
                    <div className="text-lg font-bold text-blue-700">{currentSlotStats.rate}%</div>
                    <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Attendance</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-3">
              <Clock className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">No Scheduled Classes Found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No active timetable entry was found for your faculty account today. Check &quot;My Weekly Timetable&quot; to review your complete schedule.
              </p>
            </div>
          )}

          {/* Classroom CCTV Live Feed & AI Attendance Scanner */}
          {displayedSlot && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-lg text-white space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                    <Camera className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white tracking-wide">
                        {data?.cctv_camera?.name || `${displayedSlot.classroom} Main Overhead CCTV`}
                      </h3>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        <span>ONLINE &bull; 1080P</span>
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Classroom: <strong className="text-slate-200">{displayedSlot.classroom}</strong> &bull; Section:{" "}
                      <strong className="text-slate-200">{displayedSlot.section}</strong> &bull; AI Face Recognition Biometrics Engine
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowLiveFeedModal(true)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md shadow-slate-900/20 transition flex items-center justify-center gap-2 cursor-pointer border border-slate-700 hover:border-slate-600"
                  >
                    <Eye className="w-4 h-4 text-emerald-400 animate-pulse" />
                    <span>Watch Live Feed</span>
                  </button>

                  <button
                    onClick={handleScanCCTVAttendance}
                    disabled={
                      isScanningCCTV ||
                      (!displayedSlot.can_take_attendance && user?.role === "FACULTY")
                    }
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-600 text-white font-bold text-xs shadow-md shadow-blue-900/30 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer border border-blue-400/30"
                  >
                    {isScanningCCTV ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin text-white" />
                        <span>Scanning CCTV &amp; Matching Faces...</span>
                      </>
                    ) : !displayedSlot.can_take_attendance && user?.role === "FACULTY" ? (
                      <>
                        <Lock className="w-4 h-4 text-slate-300" />
                        <span>CCTV Attendance Locked</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-4 h-4 text-blue-200" />
                        <span>Take Attendance from CCTV</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Live Stream Viewport / Snapshot HUD */}
              <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800/80 aspect-video max-h-72 w-full flex items-center justify-center">
                {/* Video Stream or Snapshot */}
                {data?.cctv_camera ? (
                  <img
                    src={`${API_BASE_URL}/cctv/cameras/${data.cctv_camera.id}/stream`}
                    alt={data.cctv_camera.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = `${API_BASE_URL}/cctv/cameras/${data.cctv_camera?.id}/snapshot?t=${Date.now()}`;
                    }}
                  />
                ) : (
                  <div className="text-center p-6 text-slate-500 space-y-2">
                    <Camera className="w-10 h-10 mx-auto text-slate-600" />
                    <p className="text-xs">Classroom CCTV Stream Initializing...</p>
                  </div>
                )}

                {/* HUD Overlay Elements */}
                <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 text-[10px] font-mono text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                      <span>REC</span>
                      <span className="text-slate-400">|</span>
                      <span>AI YUNET + SFACE DETECTOR</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowLiveFeedModal(true)}
                        className="pointer-events-auto bg-black/70 hover:bg-black/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/20 text-[10px] font-bold text-white flex items-center gap-1.5 transition hover:scale-105 cursor-pointer shadow-lg"
                      >
                        <Eye className="w-3 h-3 text-emerald-400" />
                        <span>Watch Feed</span>
                      </button>
                      <div className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 text-[10px] font-mono text-slate-300">
                        {displayedSlot.classroom} &bull; CAM-0{data?.cctv_camera?.id || 4}
                      </div>
                    </div>
                  </div>

                  {/* Scanning Animation bar when scanning */}
                  {isScanningCCTV && (
                    <div className="absolute inset-0 bg-blue-950/70 backdrop-blur-xs flex flex-col items-center justify-center gap-3">
                      <div className="w-56 h-1.5 bg-blue-900 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400 animate-pulse w-full" />
                      </div>
                      <div className="bg-slate-900/95 border border-blue-500/40 px-5 py-3 rounded-2xl text-center shadow-2xl">
                        <p className="text-xs font-bold text-blue-300 flex items-center justify-center gap-2">
                          <RotateCw className="w-4 h-4 animate-spin" />
                          <span>Detecting Student Faces in Classroom CCTV...</span>
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Matching 128-D SFace Embeddings against enrolled Section {displayedSlot.section} students
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
                    <span>SEATING ROWS: 1-3 &bull; DESKS: 15</span>
                    <span className="text-blue-400 font-bold">
                      {displayedSlot.subject_code} &bull; {displayedSlot.start_time} - {displayedSlot.end_time}
                    </span>
                  </div>
                </div>
              </div>

              {/* CCTV Scan Feedback Result Banner */}
              {cctvScanResult && (
                <div className="p-3.5 bg-emerald-950/60 border border-emerald-500/30 rounded-2xl flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <p className="font-bold text-emerald-200">{cctvScanResult.message}</p>
                      <p className="text-[11px] text-emerald-400/80 mt-0.5">
                        YuNet detected {cctvScanResult.detected_faces} face(s) in CCTV &bull; Verified {cctvScanResult.recognized_count} enrolled students via SFace biometrics.
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-mono font-bold text-[10px] border border-emerald-500/30 shrink-0">
                    VERIFIED
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Student Roster Table for This Subject & Section Only */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span>Enrolled Student Roster ({filteredRoster.length})</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Showing students taking {displayedSlot?.subject_name || "this subject"} in {displayedSlot?.section || "Class"}.
                </p>
              </div>

              {/* Action Buttons: Search & Quick CCTV Scan */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search enrolled students..."
                    value={searchStudent}
                    onChange={(e) => setSearchStudent(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <button
                  onClick={handleScanCCTVAttendance}
                  disabled={
                    isScanningCCTV ||
                    (!displayedSlot?.can_take_attendance && user?.role === "FACULTY")
                  }
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Scan CCTV</span>
                </button>

                <button
                  onClick={() => loadTeacherData(selectedSlotId)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
                  title="Refresh Roster"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Roster Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Student Roll &amp; Photo</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">Biometric DP</th>
                    <th className="py-3 px-4">Duration &amp; Presence</th>
                    <th className="py-3 px-4">Period Status</th>
                    <th className="py-3 px-4 text-right">Attendance Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRoster.map((st) => {
                    const isPresent = st.status === "PRESENT";
                    const isAbsent = st.status === "ABSENT";
                    const isUpdating = updatingStudentId === st.student_id;

                    return (
                      <tr key={st.student_id} className="hover:bg-slate-50/50 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">
                          <div className="flex items-center gap-2.5">
                            {/* Instagram style DP thumbnail with Cloudinary support */}
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                              {st.photo_url ? (
                                <img
                                  src={st.photo_url}
                                  alt={st.full_name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" fill="%232563eb" rx="16"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="white" font-weight="bold" font-family="sans-serif" font-size="11">${st.full_name.slice(0, 2).toUpperCase()}</text></svg>`;
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-slate-200 text-slate-500 font-bold text-[10px]">
                                  {st.full_name.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <span>{st.roll_number}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{st.full_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">Sec {st.section}</div>
                        </td>

                        <td className="py-3 px-4">
                          {st.biometric_enrolled ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Enrolled</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-semibold bg-slate-100 px-2 py-0.5 rounded-full">
                              Pending
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">
                              {isPresent ? "60 min (100%)" : "0 min (0%)"}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          {isPresent ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 text-[10px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              <span>PRESENT</span>
                              {st.verification_method === "FACE_RECOGNITION" ? (
                                <span className="text-[9px] font-semibold text-emerald-800 bg-emerald-100/80 px-1.5 py-0.5 rounded-md border border-emerald-300">
                                  CCTV AI Face
                                </span>
                              ) : (
                                <span className="text-[9px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-md">
                                  Manual
                                </span>
                              )}
                            </span>
                          ) : isAbsent ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 font-bold border border-rose-200 text-[10px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              <span>ABSENT</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px]">
                              <span>UNRECORDED</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleToggleStatus(st.student_id, st.status)}
                            disabled={
                              isUpdating || (!displayedSlot?.can_take_attendance && user?.role === "FACULTY")
                            }
                            className={`px-3 py-1 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                              isPresent
                                ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200"
                                : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                            }`}
                          >
                            {isUpdating ? "Updating..." : isPresent ? "Set Absent" : "Set Present"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredRoster.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-400">
                  No students found matching your filter for this class.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: MY WEEKLY TIMETABLE (AUTOMATICALLY EXTRACTED FROM ADMIN MASTER)
      ========================================================================= */}
      {activeTab === "weekly_timetable" && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-blue-600" />
                <span>My Weekly Teaching Schedule</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatically filtered from the college-wide master timetable created by Admin.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="p-1 rounded-md bg-blue-50 text-blue-700 font-bold font-mono px-2">
                Today: {data?.current_day}
              </span>
            </div>
          </div>

          {/* Timetable Grid Day-by-Day */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(data?.weekly_grid?.days || [
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
            ]).map((day) => {
              const daySlots = data?.weekly_grid?.grid?.[day] || [];
              const isToday = data?.current_day.toLowerCase() === day.toLowerCase();

              return (
                <div
                  key={day}
                  className={`bg-white border rounded-3xl p-5 shadow-xs space-y-3 transition ${
                    isToday ? "border-blue-400 ring-2 ring-blue-500/10" : "border-slate-200/90"
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <span>{day}</span>
                      {isToday && (
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                          Today
                        </span>
                      )}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-500">
                      {daySlots.length} Period{daySlots.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {daySlots.length > 0 ? (
                      daySlots.map((slot) => {
                        const isCurrentSlot =
                          isToday &&
                          slot.start_time <= (data?.current_time || "") &&
                          (data?.current_time || "") <= slot.end_time;

                        return (
                          <div
                            key={slot.id}
                            onClick={() => {
                              setSelectedSlotId(slot.id);
                              switchTab("live_attendance");
                            }}
                            className={`p-3 rounded-2xl border transition cursor-pointer space-y-1.5 ${
                              isCurrentSlot
                                ? "bg-emerald-50/90 border-emerald-300 ring-1 ring-emerald-400"
                                : "bg-slate-50/70 border-slate-200/80 hover:bg-blue-50/40 hover:border-blue-300"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[11px] font-bold text-blue-700 bg-blue-100/60 px-2 py-0.5 rounded-lg">
                                {slot.start_time} - {slot.end_time}
                              </span>
                              <span className="text-[10px] font-bold text-slate-600 flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-rose-500" />
                                <span>{slot.classroom}</span>
                              </span>
                            </div>

                            <div>
                              <div className="text-xs font-bold text-slate-900 truncate">
                                {slot.subject_name}
                              </div>
                              <div className="text-[10px] font-mono text-slate-500 flex items-center justify-between">
                                <span>{slot.subject_code}</span>
                                <span>Section: {slot.section}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-6 text-center text-xs text-slate-400 italic">
                        No periods assigned for {day}.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: MY SUBJECTS & STUDENTS ATTENDANCE
      ========================================================================= */}
      {activeTab === "subject_matrix" && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-600" />
                <span>My Assigned Curriculum Subjects</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Overview of courses you are assigned to instruct, student counts, and semester metrics.
              </p>
            </div>
          </div>

          {/* Subject Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(data?.my_subjects || []).map((sub) => (
              <div
                key={sub.id}
                className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-3 hover:border-blue-300 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-lg">
                    {sub.code}
                  </span>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    Sem {sub.semester} &bull; {sub.credits} Credits
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-snug">{sub.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{sub.department}</p>
                </div>

                <div className="border-t border-slate-100 pt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-slate-50 rounded-xl">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Enrolled</div>
                    <div className="text-sm font-bold text-slate-800">{sub.enrolled_students_count} Students</div>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-xl">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Classes Held</div>
                    <div className="text-sm font-bold text-slate-800">{sub.classes_held} Sessions</div>
                  </div>
                </div>

                <div className="pt-1 flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-rose-500" />
                    <span>{sub.classroom || "Unassigned"}</span>
                  </span>
                  <span>Section: {sub.section}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: TODAY'S SCHEDULE TIMELINE
      ========================================================================= */}
      {activeTab === "today_timeline" && (
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <span>Today&apos;s Class Timeline ({data?.current_day})</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time tracking of periods and attendance locks for {data?.current_date}.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {(data?.today_schedule || []).map((slot) => (
              <div
                key={slot.id}
                className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  slot.is_active_now
                    ? "bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/15"
                    : "bg-slate-50/60 border-slate-200/80"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-lg">
                      {slot.start_time} - {slot.end_time}
                    </span>
                    <span className="font-mono text-xs font-semibold text-slate-600">
                      Period {slot.period_number}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-rose-500" />
                      <span>{slot.classroom}</span>
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900">{slot.subject_name}</h3>
                  <p className="text-xs text-slate-500">
                    Section {slot.section} &bull; Code: {slot.subject_code}
                  </p>

                  {slot.lock_reason && (
                    <p className="text-[11px] text-amber-700 font-medium">{slot.lock_reason}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {slot.is_active_now ? (
                    <button
                      onClick={() => {
                        setSelectedSlotId(slot.id);
                        switchTab("live_attendance");
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Take Attendance Now</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setSelectedSlotId(slot.id);
                        switchTab("live_attendance");
                      }}
                      className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-xs transition flex items-center gap-1.5"
                    >
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      <span>View Roster</span>
                    </button>
                  )}
                </div>
              </div>
            ))}

            {(data?.today_schedule || []).length === 0 && (
              <div className="p-8 text-center text-xs text-slate-400 italic">
                No classes scheduled for you today ({data?.current_day}).
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          WATCH LIVE FEED & REAL-TIME ATTENDANCE MODAL
      ========================================================================= */}
      {showLiveFeedModal && displayedSlot && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl relative">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-extrabold text-white">Classroom Live Feed</h3>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      LIVE STREAM
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {displayedSlot.classroom} &bull; Period {displayedSlot.period_number} &bull; {displayedSlot.subject_name} ({displayedSlot.subject_code})
                  </p>
                </div>
              </div>

              {/* Source Switcher & Close */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-800 p-0.5 rounded-xl border border-slate-700 text-xs">
                  <button
                    type="button"
                    onClick={() => setLiveFeedSource("CCTV")}
                    className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                      liveFeedSource === "CCTV" ? "bg-blue-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Classroom CCTV
                  </button>
                  <button
                    type="button"
                    onClick={() => setLiveFeedSource("WEBCAM")}
                    className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                      liveFeedSource === "WEBCAM" ? "bg-blue-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Device Webcam
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowLiveFeedModal(false)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
                  title="Close Live Feed"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Video Viewport */}
            <div className="relative flex-1 bg-black aspect-video min-h-[320px] max-h-[60vh] flex items-center justify-center overflow-hidden">
              {liveFeedSource === "CCTV" ? (
                data?.cctv_camera ? (
                  <img
                    src={`${API_BASE_URL}/cctv/cameras/${data.cctv_camera.id}/stream`}
                    alt={data.cctv_camera.name}
                    className="w-full h-full object-contain bg-black"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = `${API_BASE_URL}/cctv/cameras/${data.cctv_camera?.id}/snapshot?t=${Date.now()}`;
                    }}
                  />
                ) : (
                  <div className="text-center p-8 text-slate-500 space-y-2">
                    <Camera className="w-12 h-12 mx-auto text-slate-600" />
                    <p className="text-sm font-semibold text-slate-300">Connecting to Classroom Stream...</p>
                    <p className="text-xs text-slate-500">Camera assigned to {displayedSlot.classroom}</p>
                  </div>
                )
              ) : (
                <video
                  ref={modalVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain bg-black"
                />
              )}

              {/* HUD Overlay Elements */}
              <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-xs font-mono text-emerald-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                    <span className="font-bold">LIVE FEED</span>
                    <span className="text-slate-500">|</span>
                    <span className="text-slate-300">
                      {liveFeedSource === "CCTV" ? data?.cctv_camera?.name || "Overhead CCTV" : "Local Device Webcam"}
                    </span>
                  </div>

                  <div className="bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-xs font-mono text-slate-300">
                    {displayedSlot.classroom} &bull; Section {displayedSlot.section}
                  </div>
                </div>

                {/* Scanning Animation bar when scanning */}
                {isScanningCCTV && (
                  <div className="absolute inset-0 bg-blue-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-3">
                    <div className="w-64 h-2 bg-blue-900 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-400 animate-pulse w-full" />
                    </div>
                    <div className="bg-slate-900/95 border border-blue-500/50 px-6 py-4 rounded-2xl text-center shadow-2xl">
                      <p className="text-sm font-bold text-blue-300 flex items-center justify-center gap-2">
                        <RotateCw className="w-5 h-5 animate-spin" />
                        <span>Detecting Faces via YuNet & Matching 128-D SFace Vectors...</span>
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Scanning all students in {displayedSlot.classroom} for Period {displayedSlot.period_number}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs font-mono text-slate-400 bg-black/70 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10">
                  <span>FACULTY: {data?.teacher?.name || "Teacher"}</span>
                  <span className="text-blue-400 font-bold">
                    {displayedSlot.start_time} - {displayedSlot.end_time} &bull; {displayedSlot.subject_code}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-400">
                {cctvScanResult ? (
                  <div className="flex items-center gap-2 text-emerald-400 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>{cctvScanResult.message} ({cctvScanResult.recognized_count} Recognized)</span>
                  </div>
                ) : (
                  <span>Monitor student activity and click scan below to take instant attendance.</span>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleScanCCTVAttendance}
                  disabled={isScanningCCTV || (!displayedSlot.can_take_attendance && user?.role === "FACULTY")}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-600 text-white font-bold text-xs shadow-lg shadow-blue-900/40 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer border border-blue-400/40"
                >
                  {isScanningCCTV ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" />
                      <span>Scanning Faces...</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4 text-blue-200" />
                      <span>Take Attendance from Live Feed</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowLiveFeedModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TeacherPortalPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Loading Teacher Workspace...</div>}>
      <TeacherPortalContent />
    </Suspense>
  );
}
