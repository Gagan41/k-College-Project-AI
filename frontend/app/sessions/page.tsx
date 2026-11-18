"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  CalendarCheck,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Mail,
  UserCheck,
  UserX,
  QrCode,
  ShieldAlert,
  Send,
  Sparkles,
  ArrowRightLeft,
  RotateCw,
  X,
  BarChart3,
  TrendingDown,
  TrendingUp,
  Users,
  BookOpen,
  Filter,
  GraduationCap,
  Layers,
  Building2,
  ArrowDownUp,
} from "lucide-react";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface TimetableSlot {
  id: number;
  subject_name?: string;
  subject_code?: string;
  faculty_name?: string;
  classroom: string;
  start_time: string;
  end_time: string;
  day_of_week: string;
}

interface SessionData {
  id: number;
  timetable_id: number;
  date: string;
  status: string;
  subject_name?: string;
  subject_code?: string;
  faculty_name?: string;
  faculty_email?: string;
  classroom?: string;
  total_enrolled: number;
  present_count: number;
  absent_count: number;
  left_early_count: number;
  email_report_sent: boolean;
}

interface RosterItem {
  id: number;
  student_id: number;
  roll_number: string;
  student_name: string;
  in_time?: string | null;
  out_time?: string | null;
  total_minutes_present: number;
  presence_ratio: number;
  status: string;
  verification_method: string;
  photo_proof_url?: string | null;
  email_notified: boolean;
}

interface StudentAnalyticsItem {
  student_id: number;
  roll_number: string;
  student_name: string;
  department: string;
  semester: number;
  section: string;
  sessions_held: number;
  sessions_attended: number;
  attendance_percentage: number;
  is_shortage: boolean;
}

interface SubjectAnalyticsItem {
  subject_code: string;
  subject_name: string;
  total_sessions: number;
  total_attendances: number;
  average_attendance_percentage: number;
}

interface AttendanceAnalyticsResponse {
  overall_percentage: number;
  total_students: number;
  students_shortage_count: number;
  students: StudentAnalyticsItem[];
  subject_summary: SubjectAnalyticsItem[];
}

function SessionsContent() {
  const searchParams = useSearchParams();
  const urlTimetableId = searchParams.get("timetable_id");
  const { token } = useAuth();

  // Tab: Live Ledger vs Cumulative Analytics
  const [activeTab, setActiveTab] = useState<"SESSION_LEDGER" | "ANALYTICS">("SESSION_LEDGER");

  // --- Session Ledger State ---
  const [timetables, setTimetables] = useState<TimetableSlot[]>([]);
  const [selectedTimetableId, setSelectedTimetableId] = useState<number | null>(
    urlTimetableId ? parseInt(urlTimetableId) : null
  );
  const [activeSession, setActiveSession] = useState<SessionData | null>(null);
  const [roster, setRoster] = useState<RosterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // --- Cumulative Analytics State ---
  const [analyticsData, setAnalyticsData] = useState<AttendanceAnalyticsResponse | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [semFilter, setSemFilter] = useState("ALL");
  const [secFilter, setSecFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"lowest" | "highest" | "roll_number">("lowest");
  const [shortageOnly, setShortageOnly] = useState(false);

  // Load available timetable periods
  useEffect(() => {
    const loadTimetables = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/timetable`, {
          headers: getAuthHeaders(token),
        });
        if (res.ok) {
          const data = await res.json();
          setTimetables(data);
          if (!selectedTimetableId && data.length > 0) {
            setSelectedTimetableId(data[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load timetable", err);
      } finally {
        setLoading(false);
      }
    };
    loadTimetables();
  }, [token]);

  // Start / Load session for selected timetable
  const loadSession = async () => {
    if (!selectedTimetableId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/timetable/sessions/start?timetable_id=${selectedTimetableId}`, {
        method: "POST",
        headers: getAuthHeaders(token),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveSession(data);
        loadRoster(data.id);
      }
    } catch (err) {
      console.error("Failed to start/load session", err);
    }
  };

  const loadRoster = async (sessionId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/timetable/sessions/${sessionId}/ledger`, {
        headers: getAuthHeaders(token),
      });
      if (res.ok) {
        const data = await res.json();
        setRoster(data);
      }
    } catch (err) {
      console.error("Failed to load roster", err);
    }
  };

  useEffect(() => {
    if (selectedTimetableId) {
      loadSession();
    }
  }, [selectedTimetableId]);

  // Fetch Cumulative Analytics
  const fetchAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      const params = new URLSearchParams();
      if (deptFilter !== "ALL") params.append("department", deptFilter);
      if (semFilter !== "ALL") params.append("semester", semFilter);
      if (secFilter !== "ALL") params.append("section", secFilter);
      params.append("sort_by", sortBy);
      if (shortageOnly) params.append("shortage_only", "true");

      const res = await fetch(`${API_BASE_URL}/academic/attendance-analytics?${params.toString()}`, {
        headers: getAuthHeaders(token),
      });
      if (res.ok) {
        const data = await res.json();
        setAnalyticsData(data);
      }
    } catch (err) {
      console.error("Failed to load attendance analytics", err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "ANALYTICS") {
      fetchAnalytics();
    }
  }, [activeTab, deptFilter, semFilter, secFilter, sortBy, shortageOnly, token]);

  // Finalize Session & Auto-email Teacher
  const handleFinalizeSession = async () => {
    if (!activeSession) return;
    setFinalizing(true);
    setFeedback(null);
    try {
      const res = await fetch(`${API_BASE_URL}/timetable/sessions/${activeSession.id}/finalize`, {
        method: "POST",
        headers: getAuthHeaders(token),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({
          type: "success",
          msg: `Session finalized! Presence evaluated against >= 75% rule. Official report dispatched to ${data.teacher_email || "assigned teacher"}.`,
        });
        loadSession();
      } else {
        throw new Error(data.detail || "Failed to finalize session.");
      }
    } catch (err: unknown) {
      setFeedback({ type: "error", msg: err instanceof Error ? err.message : "Finalization error." });
    } finally {
      setFinalizing(false);
    }
  };

  // Re-send Email
  const handleSendEmail = async () => {
    if (!activeSession) return;
    setSendingEmail(true);
    try {
      const res = await fetch(`${API_BASE_URL}/timetable/sessions/${activeSession.id}/send-email`, {
        method: "POST",
        headers: getAuthHeaders(token),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({
          type: "success",
          msg: `Attendance report dispatched via SMTP to ${data.teacher_email}!`,
        });
      }
    } catch {
      setFeedback({ type: "error", msg: "Failed to dispatch email." });
    } finally {
      setSendingEmail(false);
    }
  };

  // Barcode Scan Fallback
  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession || !barcodeInput.trim()) return;

    try {
      const res = await fetch(`${API_BASE_URL}/timetable/sessions/${activeSession.id}/scan-barcode`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(token),
        },
        body: JSON.stringify({ barcode: barcodeInput.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({
          type: "success",
          msg: `Barcode scanned! Student marked present: ${data.student_name} (${data.roll_number})`,
        });
        setBarcodeInput("");
        setShowBarcodeModal(false);
        loadRoster(activeSession.id);
      } else {
        throw new Error(data.detail || "Barcode not recognized");
      }
    } catch (err: unknown) {
      setFeedback({ type: "error", msg: err instanceof Error ? err.message : "Barcode scan failed" });
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header with Segmented Navigation Tab */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <CalendarCheck className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Attendance Ledger & Integrated Analytics
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time biometric session records, directional tracking, and institutional shortage compliance (&lt; 75%).
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 bg-slate-100/90 rounded-2xl border border-slate-200 text-xs self-start md:self-auto">
          <button
            onClick={() => setActiveTab("SESSION_LEDGER")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold transition cursor-pointer ${
              activeTab === "SESSION_LEDGER"
                ? "bg-white text-blue-700 shadow-xs border border-blue-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            <span>Active Session Ledger</span>
          </button>

          <button
            onClick={() => setActiveTab("ANALYTICS")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold transition cursor-pointer ${
              activeTab === "ANALYTICS"
                ? "bg-white text-indigo-700 shadow-xs border border-indigo-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
            <span>Cumulative Analytics</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center justify-between shadow-xs ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.msg}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-700 text-xs">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* =========================================================================
          VIEW 1: ACTIVE SESSION LEDGER
      ========================================================================= */}
      {activeTab === "SESSION_LEDGER" && (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-700 whitespace-nowrap">Class Period:</label>
              <select
                value={selectedTimetableId || ""}
                onChange={(e) => setSelectedTimetableId(parseInt(e.target.value))}
                className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-600"
              >
                {timetables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.day_of_week} ({t.start_time} - {t.end_time}) : {t.subject_code} - {t.subject_name} ({t.classroom})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowBarcodeModal(true)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5 text-blue-600" />
                <span>Scan Student ID</span>
              </button>
              <button
                onClick={handleFinalizeSession}
                disabled={finalizing || !activeSession}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{finalizing ? "Finalizing Ledger..." : "Finalize & Email Teacher"}</span>
              </button>
            </div>
          </div>

          {/* Session Overview Stats */}
          {activeSession && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Enrolled Cohort</span>
                <div className="text-xl font-black text-slate-900 mt-0.5">{activeSession.total_enrolled}</div>
                <div className="text-[10px] text-slate-400 mt-1 font-mono">Assigned Students</div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Present (&ge; 75%)</span>
                <div className="text-xl font-black text-emerald-600 mt-0.5">{activeSession.present_count}</div>
                <div className="text-[10px] text-emerald-700/70 mt-1 font-mono">
                  {activeSession.total_enrolled > 0
                    ? ((activeSession.present_count / activeSession.total_enrolled) * 100).toFixed(0)
                    : 0}
                  % Turnout
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500">Absent</span>
                <div className="text-xl font-black text-rose-600 mt-0.5">{activeSession.absent_count}</div>
                <div className="text-[10px] text-rose-700/70 mt-1 font-mono">Zero Detections</div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Partial / Left</span>
                <div className="text-xl font-black text-amber-600 mt-0.5">{activeSession.left_early_count}</div>
                <div className="text-[10px] text-amber-700/70 mt-1 font-mono">&lt; 75% Duration</div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Teacher Report</span>
                  <div className="text-xs font-bold text-slate-800 mt-1 truncate">
                    {activeSession.email_report_sent ? "Dispatched" : "Pending Finalize"}
                  </div>
                </div>
                {activeSession.email_report_sent && (
                  <button
                    onClick={handleSendEmail}
                    disabled={sendingEmail}
                    className="mt-2 text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Send className="w-3 h-3" /> Resend SMTP
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Roster Table */}
          <div className="bg-white border border-slate-200/90 rounded-3xl shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Continuous Presence Verification Matrix
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                Institutional Rule: <strong className="text-blue-600">&gt;= 75% Duration = Present</strong>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-6">Roll No</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">First In</th>
                    <th className="py-3 px-4">Last Out</th>
                    <th className="py-3 px-4">Duration</th>
                    <th className="py-3 px-4">Presence Ratio</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-6 text-right">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {roster.map((row) => {
                    const isPresent = row.status === "PRESENT";
                    const isLeftEarly = row.status === "LEFT_EARLY";

                    return (
                      <tr key={row.id} className="hover:bg-slate-50/50 transition">
                        <td className="py-3.5 px-6 font-mono font-bold text-slate-700">{row.roll_number}</td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900">{row.student_name}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-500">{row.in_time ? row.in_time.slice(11, 16) : "--:--"}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-500">{row.out_time ? row.out_time.slice(11, 16) : "--:--"}</td>
                        <td className="py-3.5 px-4 font-mono font-medium text-slate-700">{row.total_minutes_present} min</td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  isPresent ? "bg-emerald-500" : isLeftEarly ? "bg-amber-500" : "bg-rose-400"
                                }`}
                                style={{ width: `${Math.min(100, Math.round(row.presence_ratio * 100))}%` }}
                              />
                            </div>
                            <span className="font-mono text-[11px] text-slate-600">
                              {(row.presence_ratio * 100).toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {isPresent ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 text-[10px]">
                              <CheckCircle2 className="w-3 h-3" /> PRESENT
                            </span>
                          ) : isLeftEarly ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-200 text-[10px]">
                              <Clock className="w-3 h-3" /> LEFT EARLY
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold border border-rose-200 text-[10px]">
                              <UserX className="w-3 h-3" /> ABSENT
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-6 text-right font-mono text-[11px] text-slate-500">
                          {row.verification_method || "CCTV_BIOMETRIC"}
                        </td>
                      </tr>
                    );
                  })}
                  {roster.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        No attendance records for this session yet. Start the CCTV feed to begin tracking.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 2: CUMULATIVE ATTENDANCE ANALYTICS & SHORTAGE TRACKER
      ========================================================================= */}
      {activeTab === "ANALYTICS" && (
        <div className="space-y-6">
          {/* Filter and Sorting Controls */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Department */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="ALL">All Departments</option>
                  <option value="Computer Science & Engineering">Computer Science</option>
                  <option value="Electronics & Communication Engineering">Electronics & Communication</option>
                  <option value="Mechanical Engineering">Mechanical Engineering</option>
                  <option value="Artificial Intelligence & Data Science">AI & Data Science</option>
                </select>
              </div>

              {/* Semester */}
              <select
                value={semFilter}
                onChange={(e) => setSemFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Semesters</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <option key={s} value={s}>
                    Semester {s}
                  </option>
                ))}
              </select>

              {/* Section */}
              <select
                value={secFilter}
                onChange={(e) => setSecFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Sections</option>
                {["A", "B", "C", "D"].map((sec) => (
                  <option key={sec} value={sec}>
                    Section {sec}
                  </option>
                ))}
              </select>

              {/* Sort Order */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <ArrowDownUp className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "lowest" | "highest" | "roll_number")}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="lowest">Lowest Attendance First (Shortage Priority)</option>
                  <option value="highest">Highest Attendance First</option>
                  <option value="roll_number">Roll Number</option>
                </select>
              </div>
            </div>

            {/* Shortage Toggle */}
            <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl hover:bg-rose-100 transition">
              <input
                type="checkbox"
                checked={shortageOnly}
                onChange={(e) => setShortageOnly(e.target.checked)}
                className="rounded text-rose-600 focus:ring-rose-500"
              />
              <span className="text-rose-700">Show Shortage Only (&lt; 75%)</span>
            </label>
          </div>

          {/* Metric Cards */}
          {analyticsData && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-2xl font-black text-slate-900">
                    {analyticsData.overall_percentage.toFixed(1)}%
                  </div>
                  <div className="text-xs text-slate-500 font-medium">Cohort Average Attendance</div>
                </div>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-2xl font-black text-indigo-700">{analyticsData.total_students}</div>
                  <div className="text-xs text-slate-500 font-medium">Total Tracked Students</div>
                </div>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-2xl font-black text-rose-600">
                    {analyticsData.students_shortage_count}
                  </div>
                  <div className="text-xs text-slate-500 font-medium">
                    Students with Shortage (&lt; 75%)
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Students Cumulative Table */}
          <div className="bg-white border border-slate-200/90 rounded-3xl shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Student Cumulative Ledger
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono text-[10px] font-bold">
                  {analyticsData?.students.length || 0} Students Listed
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Formula: (Sessions Attended / Sessions Held) &times; 100
              </span>
            </div>

            {analyticsLoading ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-8 h-8 rounded-full border-2 border-blue-500/20 border-t-blue-600 animate-spin mx-auto" />
                <p className="text-xs text-slate-500 font-medium">Calculating institutional analytics...</p>
              </div>
            ) : !analyticsData || analyticsData.students.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <Users className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-700">No students match filter criteria</p>
                <p className="text-[11px] text-slate-400">Try changing department or shortage filter.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-6">Roll Number</th>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4">Department & Cohort</th>
                      <th className="py-3 px-4">Sessions Attended</th>
                      <th className="py-3 px-4">Attendance %</th>
                      <th className="py-3 px-6 text-right">Shortage Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analyticsData.students.map((st) => (
                      <tr
                        key={st.student_id}
                        className={`transition ${
                          st.is_shortage ? "bg-rose-50/30 hover:bg-rose-50/60" : "hover:bg-slate-50/50"
                        }`}
                      >
                        <td className="py-3.5 px-6 font-mono font-bold text-slate-800">{st.roll_number}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">{st.student_name}</td>
                        <td className="py-3.5 px-4 text-slate-600">
                          <span className="font-semibold text-slate-800">{st.department}</span> &bull; Sem {st.semester} - Sec {st.section}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-medium text-slate-700">
                          {st.sessions_attended} / {st.sessions_held}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  st.is_shortage ? "bg-rose-500" : "bg-emerald-500"
                                }`}
                                style={{ width: `${Math.min(100, Math.round(st.attendance_percentage))}%` }}
                              />
                            </div>
                            <span
                              className={`font-mono font-bold ${
                                st.is_shortage ? "text-rose-600" : "text-emerald-700"
                              }`}
                            >
                              {st.attendance_percentage.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-6 text-right">
                          {st.is_shortage ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-100 text-rose-800 font-extrabold border border-rose-200 text-[10px]">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              <span>SHORTAGE (&lt; 75%)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 text-[10px]">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>ON TRACK</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Subject Breakdown Card */}
          {analyticsData && analyticsData.subject_summary.length > 0 && (
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <span>Subject-Wise Performance Breakdown</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {analyticsData.subject_summary.map((sub) => (
                  <div
                    key={sub.subject_code}
                    className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg">
                        {sub.subject_code}
                      </span>
                      <span className="font-mono font-bold text-xs text-slate-800">
                        {sub.average_attendance_percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-900 truncate">{sub.subject_name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      Sessions Held: <strong>{sub.total_sessions}</strong> &bull; Total Attendances: <strong>{sub.total_attendances}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Barcode Fallback Modal */}
      {showBarcodeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white border border-slate-200 p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <QrCode className="w-4 h-4 text-blue-600" />
                Student ID Card Scanner
              </h3>
              <button
                onClick={() => setShowBarcodeModal(false)}
                className="text-slate-400 hover:text-slate-700 text-xs"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              If a student&apos;s face is occluded or not detected, enter or scan the barcode/roll number from their Student ID Card:
            </p>

            <form onSubmit={handleBarcodeSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Student Roll Number (Barcode)</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="e.g. 1EW23CS065"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:border-blue-600 font-mono text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBarcodeModal(false)}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs transition cursor-pointer"
                >
                  Record Attendance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SessionsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-slate-500 font-mono text-xs">Loading live attendance sessions...</div>
      }
    >
      <SessionsContent />
    </Suspense>
  );
}
