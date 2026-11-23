"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  CalendarCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Mail,
  UserX,
  QrCode,
  ShieldAlert,
  RotateCw,
  X,
  BarChart3,
  BookOpen,
  Building,
  Activity,
  Search,
  School,
  Camera,
  Layers,
  ChevronRight,
} from "lucide-react";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

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

interface SubjectItem {
  id: number;
  code: string;
  name: string;
  semester?: number;
  department: string;
  faculty_id?: number | null;
}

interface ClassroomItem {
  id: number;
  room_number: string;
  building: string;
  capacity: number;
  room_type: string;
  camera_id?: number | null;
}

interface IncidentItem {
  id: number;
  session_id: number;
  type: string;
  description: string;
  confidence?: number;
  created_at: string;
  student_name?: string;
  roll_number?: string;
  resolved: boolean;
}

type AttendanceViewMode = "overall" | "subject_wise" | "classroom_wise" | "sessions" | "review";

function AttendancePageContent() {
  const searchParams = useSearchParams();
  const initialMode = (searchParams.get("tab") as AttendanceViewMode) || "overall";
  const { token } = useAuth();

  const [viewMode, setViewMode] = useState<AttendanceViewMode>(initialMode);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Filters (Not locked to 9 to 10!)
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [semFilter, setSemFilter] = useState("7");
  const [secFilter, setSecFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [shortageOnly, setShortageOnly] = useState(false);

  // Metadata Lists
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [classrooms, setClassrooms] = useState<ClassroomItem[]>([]);
  const [sectionsList, setSectionsList] = useState<{ id: number; name: string }[]>([]);
  const [coursesList, setCoursesList] = useState<{ id: number; code: string; name: string }[]>([]);
  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string>("");
  const [selectedClassroom, setSelectedClassroom] = useState<string>("");

  // Data States
  const [analyticsData, setAnalyticsData] = useState<AttendanceAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);

  // Barcode Override State
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeProcessing, setBarcodeProcessing] = useState(false);

  // Finalize Session state
  const [finalizing, setFinalizing] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  // Load Subjects, Classrooms and Sections
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const headers = getAuthHeaders(token);
        const [resSub, resRoom, resSec, resCourses] = await Promise.all([
          fetch(`${API_BASE_URL}/academic/subjects`, { headers }),
          fetch(`${API_BASE_URL}/academic/classrooms`, { headers }),
          fetch(`${API_BASE_URL}/academic/sections`, { headers }),
          fetch(`${API_BASE_URL}/academic/courses`, { headers }),
        ]);

        if (resCourses.ok) {
          const coursesData = await resCourses.json();
          setCoursesList(coursesData);
        }

        if (resSub.ok) {
          const subData = await resSub.json();
          setSubjects(subData);
          if (subData.length > 0 && !subData.some((s: SubjectItem) => s.code === selectedSubjectCode)) {
            setSelectedSubjectCode(subData[0].code);
          }
        }
        if (resRoom.ok) {
          const roomData = await resRoom.json();
          setClassrooms(roomData);
          if (roomData.length > 0 && !roomData.some((r: ClassroomItem) => r.room_number === selectedClassroom)) {
            setSelectedClassroom(roomData[0].room_number);
          }
        }
        if (resSec.ok) {
          const secData = await resSec.json();
          setSectionsList(secData);
        }
      } catch (err) {
        console.error("Failed to load metadata:", err);
      }
    };
    loadMetadata();
  }, [token]);

  // Load Analytics Data
  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (deptFilter !== "ALL") params.append("department", deptFilter);
      if (semFilter !== "ALL") params.append("semester", semFilter);
      if (secFilter !== "ALL") params.append("section", secFilter);

      const res = await fetch(`${API_BASE_URL}/academic/attendance-analytics?${params.toString()}`, {
        headers: getAuthHeaders(token),
      });

      if (res.ok) {
        setAnalyticsData(await res.json());
      }
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [deptFilter, semFilter, secFilter, token]);

  // Load Incidents
  const fetchIncidents = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/timetable/incidents`, {
        headers: getAuthHeaders(token),
      });
      if (res.ok) setIncidents(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (viewMode === "review") fetchIncidents();
  }, [viewMode, token]);

  // Barcode scan fallback
  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    setBarcodeProcessing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/timetable/sessions/1/scan-barcode`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(token) },
        body: JSON.stringify({ barcode: barcodeInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Barcode override failed.");
      setFeedback({
        type: "success",
        msg: `Recorded presence for ${data.student_name} (${data.roll_number}) via barcode override.`,
      });
      setShowBarcodeModal(false);
      setBarcodeInput("");
      fetchAnalytics();
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        msg: err instanceof Error ? err.message : "Error processing barcode.",
      });
    } finally {
      setBarcodeProcessing(false);
    }
  };

  // Filtered Students list sorted by Lowest Attendance First
  const filteredStudents = useMemo(() => {
    if (!analyticsData?.students) return [];

    let list = [...analyticsData.students];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.student_name.toLowerCase().includes(q) ||
          s.roll_number.toLowerCase().includes(q) ||
          s.department.toLowerCase().includes(q)
      );
    }

    if (shortageOnly) {
      list = list.filter((s) => s.is_shortage || s.attendance_percentage < 75);
    }

    // Lowest attendance first
    list.sort((a, b) => a.attendance_percentage - b.attendance_percentage);
    return list;
  }, [analyticsData, searchQuery, shortageOnly]);

  // Selected Subject Detail
  const selectedSubjectSummary = useMemo(() => {
    return analyticsData?.subject_summary?.find((s) => s.subject_code === selectedSubjectCode);
  }, [analyticsData, selectedSubjectCode]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Section */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <CalendarCheck className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Attendance Ledger &amp; Integrated Analytics
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Overall cohort compliance, curriculum subject-wise tracking, classroom facility presence, and security audits.
          </p>
        </div>

        {/* Primary View Modes */}
        <div className="flex flex-wrap items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs">
          <button
            onClick={() => setViewMode("overall")}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
              viewMode === "overall"
                ? "bg-white text-blue-700 shadow-xs border border-blue-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
            <span>Overall Attendance</span>
          </button>

          <button
            onClick={() => setViewMode("subject_wise")}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
              viewMode === "subject_wise"
                ? "bg-white text-blue-700 shadow-xs border border-blue-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
            <span>Subject-Wise</span>
          </button>

          <button
            onClick={() => setViewMode("classroom_wise")}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
              viewMode === "classroom_wise"
                ? "bg-white text-blue-700 shadow-xs border border-blue-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Building className="w-3.5 h-3.5 text-cyan-600" />
            <span>Classroom-Wise</span>
          </button>

          <button
            onClick={() => setViewMode("sessions")}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
              viewMode === "sessions"
                ? "bg-white text-blue-700 shadow-xs border border-blue-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-emerald-600" />
            <span>Finalize / Email</span>
          </button>

          <button
            onClick={() => setViewMode("review")}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
              viewMode === "review"
                ? "bg-white text-blue-700 shadow-xs border border-blue-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
            <span>Security Audit</span>
          </button>
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center justify-between gap-3 shadow-xs ${
            feedback.type === "success"
              ? "bg-emerald-50/90 border-emerald-200 text-emerald-900"
              : "bg-rose-50/90 border-rose-200 text-rose-900"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-semibold">{feedback.msg}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* =========================================================================
          VIEW 1: OVERALL COHORT ATTENDANCE (NOT RESTRICTED TO SINGLE CLASS!)
      ========================================================================= */}
      {viewMode === "overall" && (
        <div className="space-y-6">
          {/* Cohort Selection Bar */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">Department</label>
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800"
                >
                  <option value="ALL">All Departments</option>
                  {coursesList.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">Semester</label>
                <select
                  value={semFilter}
                  onChange={(e) => setSemFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800"
                >
                  <option value="ALL">All Semesters</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <option key={s} value={s}>
                      Semester {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">Class / Section</label>
                <select
                  value={secFilter}
                  onChange={(e) => setSecFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800"
                >
                  <option value="ALL">All Sections</option>
                  {sectionsList.map((sec) => (
                    <option key={sec.id} value={sec.name}>
                      {sec.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShortageOnly(!shortageOnly)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                  shortageOnly
                    ? "bg-rose-50 border-rose-200 text-rose-700"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>Shortage &lt; 75% Only</span>
              </button>

              <button
                onClick={() => setShowBarcodeModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Barcode Override</span>
              </button>

              <div className="relative w-44">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Aggregate KPI Banner */}
          {analyticsData && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
                <div className="text-xs font-medium text-slate-500">Overall Attendance Compliance</div>
                <div className="text-2xl font-black text-slate-900 mt-1">{analyticsData.overall_percentage}%</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Computed across all curriculum lectures</div>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
                <div className="text-xs font-medium text-slate-500">Total Enrolled Cohort</div>
                <div className="text-2xl font-black text-blue-600 mt-1">{analyticsData.total_students}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Students active in academic database</div>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
                <div className="text-xs font-medium text-slate-500">Attendance Shortage (&lt; 75%)</div>
                <div className="text-2xl font-black text-rose-600 mt-1">{analyticsData.students_shortage_count}</div>
                <div className="text-[11px] text-rose-500 mt-0.5">Students at risk of institutional debarment</div>
              </div>
            </div>
          )}

          {/* Student Roster Table (Lowest Attendance First) */}
          <div className="bg-white border border-slate-200/90 rounded-3xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Overall Student Attendance Roster
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Ordered by <strong>Lowest Attendance First</strong> to facilitate regulatory compliance and alerts.
                </p>
              </div>
              <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                {filteredStudents.length} Students
              </span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-xs text-slate-400">Computing overall metrics...</div>
            ) : filteredStudents.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">No students match the criteria.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Roll Number</th>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4">Cohort</th>
                      <th className="py-3 px-4">Total Lectures Held</th>
                      <th className="py-3 px-4">Classes Attended</th>
                      <th className="py-3 px-4">Cumulative %</th>
                      <th className="py-3 px-4">Regulatory Standing</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredStudents.map((st) => (
                      <tr
                        key={st.student_id}
                        className={`transition ${
                          st.attendance_percentage < 75
                            ? "bg-rose-50/30 hover:bg-rose-50/50"
                            : "hover:bg-slate-50/50"
                        }`}
                      >
                        <td className="py-3 px-4 font-mono font-semibold text-slate-900">{st.roll_number}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0 shadow-2xs">
                              <img
                                src={`/api/academic/students/${st.student_id}/photo?v=${st.student_id}`}
                                alt={st.student_name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" fill="%232563eb" rx="6"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="white" font-weight="bold" font-family="sans-serif" font-size="11">${st.student_name.slice(0, 2).toUpperCase()}</text></svg>`;
                                }}
                              />
                            </div>
                            <span className="font-semibold text-slate-900">{st.student_name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          Sem {st.semester}-{st.section}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-700">{st.sessions_held}</td>
                        <td className="py-3 px-4 font-semibold text-slate-700">{st.sessions_attended}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  st.attendance_percentage >= 75
                                    ? "bg-emerald-500"
                                    : st.attendance_percentage >= 50
                                    ? "bg-amber-500"
                                    : "bg-rose-500"
                                }`}
                                style={{ width: `${Math.min(100, Math.max(0, st.attendance_percentage))}%` }}
                              />
                            </div>
                            <span
                              className={`font-mono text-xs font-bold ${
                                st.attendance_percentage < 75 ? "text-rose-600" : "text-slate-800"
                              }`}
                            >
                              {st.attendance_percentage}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {st.attendance_percentage < 75 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              DEBARMENT RISK (&lt; 75%)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              IN GOOD STANDING
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
        </div>
      )}

      {/* =========================================================================
          VIEW 2: SUBJECT-WISE ATTENDANCE (CURRICULUM SPECIFIC)
      ========================================================================= */}
      {viewMode === "subject_wise" && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Subject-Wise Attendance Breakdown</h3>
                <p className="text-xs text-slate-500">
                  Select any course subject to view delivered lectures, class attendances, and student metrics.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-700 whitespace-nowrap">Subject:</label>
                <select
                  value={selectedSubjectCode}
                  onChange={(e) => setSelectedSubjectCode(e.target.value)}
                  className="bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2 text-xs font-bold text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.code}>
                      {sub.code}: {sub.name} (Sem {sub.semester || 7})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedSubjectSummary && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div className="text-xs font-medium text-slate-500">Delivered Lectures</div>
                  <div className="text-2xl font-black text-slate-900 mt-1">
                    {selectedSubjectSummary.total_sessions}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div className="text-xs font-medium text-slate-500">Total Attendances Recorded</div>
                  <div className="text-2xl font-black text-blue-600 mt-1">
                    {selectedSubjectSummary.total_attendances}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div className="text-xs font-medium text-slate-500">Average Subject Attendance</div>
                  <div className="text-2xl font-black text-emerald-600 mt-1">
                    {selectedSubjectSummary.average_attendance_percentage}%
                  </div>
                </div>
              </div>
            )}

            {/* Complete Subject Catalog Summary Table */}
            <div className="mt-4 overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                    <th className="py-3 px-4">Subject Code</th>
                    <th className="py-3 px-4">Subject Name</th>
                    <th className="py-3 px-4">Lectures Held</th>
                    <th className="py-3 px-4">Total Attendances</th>
                    <th className="py-3 px-4">Average Attendance %</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analyticsData?.subject_summary?.map((sub) => (
                    <tr
                      key={sub.subject_code}
                      onClick={() => setSelectedSubjectCode(sub.subject_code)}
                      className={`cursor-pointer transition ${
                        sub.subject_code === selectedSubjectCode ? "bg-indigo-50/70" : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-blue-700">{sub.subject_code}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{sub.subject_name}</td>
                      <td className="py-3 px-4 font-semibold text-slate-700">{sub.total_sessions}</td>
                      <td className="py-3 px-4 font-semibold text-slate-700">{sub.total_attendances}</td>
                      <td className="py-3 px-4 font-bold font-mono">{sub.average_attendance_percentage}%</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            sub.average_attendance_percentage >= 75
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {sub.average_attendance_percentage >= 75 ? "OPTIMAL" : "ATTENTION"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 3: CLASSROOM-WISE ATTENDANCE (FACILITY & CCTV SENSORS)
      ========================================================================= */}
      {viewMode === "classroom_wise" && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Classroom Facility Attendance &amp; Occupancy</h3>
                <p className="text-xs text-slate-500">
                  Select a physical classroom facility to view CCTV feed status and presence occupancy.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-700 whitespace-nowrap">Classroom:</label>
                <select
                  value={selectedClassroom}
                  onChange={(e) => setSelectedClassroom(e.target.value)}
                  className="bg-cyan-50 border border-cyan-200 rounded-xl px-3 py-2 text-xs font-bold text-cyan-900 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  {classrooms.map((room) => (
                    <option key={room.id} value={room.room_number}>
                      {room.room_number} • {room.building} (Cap: {room.capacity})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="text-xs font-medium text-slate-500">Facility Code</div>
                <div className="text-xl font-black text-slate-900 mt-1">{selectedClassroom}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Main Academic Block</div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="text-xs font-medium text-slate-500">CCTV Camera Node</div>
                <div className="text-xl font-black text-emerald-600 mt-1 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Online (30 FPS)</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">YuNet Facial Detection Active</div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="text-xs font-medium text-slate-500">Classroom Occupancy</div>
                <div className="text-xl font-black text-blue-600 mt-1">Full Section Present</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Continuous Monitoring Active</div>
              </div>
            </div>

            <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-2xl flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <div className="font-bold text-blue-900">Live CCTV Sensor Feed Linked</div>
                <div className="text-[11px] text-blue-700">
                  You can inspect the live video bounding boxes and 28-point biometric face mesh in the Live CCTV Feeds section.
                </div>
              </div>
              <a
                href="/cctv"
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition"
              >
                Go to CCTV Feeds
              </a>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 4: SESSION CONTROLS & FINALIZATION
      ========================================================================= */}
      {viewMode === "sessions" && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Session Finalization &amp; Faculty Digest Email</h3>
            <p className="text-xs text-slate-500">
              Seal continuous presence records, compute final ratios (&ge; 75% Present, 50-74% Left Early, &lt; 50% Absent), and dispatch the automated PDF/SMTP report to the assigned faculty.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => setShowBarcodeModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition cursor-pointer"
              >
                <QrCode className="w-4 h-4 text-slate-600" />
                <span>Barcode Scanner Fallback</span>
              </button>

              <button
                onClick={async () => {
                  setFinalizing(true);
                  try {
                    const res = await fetch(`${API_BASE_URL}/timetable/sessions/1/finalize`, {
                      method: "POST",
                      headers: getAuthHeaders(token),
                    });
                    const d = await res.json();
                    setFeedback({ type: "success", msg: "Session finalized and presence ledger locked." });
                    fetchAnalytics();
                  } catch (err) {
                    console.error(err);
                  } finally {
                    setFinalizing(false);
                  }
                }}
                disabled={finalizing}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{finalizing ? "Finalizing..." : "Finalize & Seal Session"}</span>
              </button>

              <button
                onClick={async () => {
                  setSendingEmail(true);
                  try {
                    const res = await fetch(`${API_BASE_URL}/timetable/sessions/1/send-email`, {
                      method: "POST",
                      headers: getAuthHeaders(token),
                    });
                    const d = await res.json();
                    setFeedback({ type: "success", msg: `Email digest dispatched to ${d.recipient || "faculty"}.` });
                  } catch (err) {
                    console.error(err);
                  } finally {
                    setSendingEmail(false);
                  }
                }}
                disabled={sendingEmail}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition cursor-pointer"
              >
                <Mail className="w-4 h-4" />
                <span>{sendingEmail ? "Transmitting..." : "Send Email Digest Now"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 5: SECURITY AUDIT
      ========================================================================= */}
      {viewMode === "review" && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Attendance Security &amp; Anti-Spoof Audit</h3>
                <p className="text-xs text-slate-500">
                  Logs of anti-spoofing rejections (paper prints, phone screens), covered face alerts, and confidence scores.
                </p>
              </div>
              <button
                onClick={fetchIncidents}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>

            {incidents.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No security flags or anti-spoof incidents recorded. All face ingests comply with institutional thresholds.
              </div>
            ) : (
              <div className="mt-4 divide-y divide-slate-100">
                {incidents.map((inc) => (
                  <div key={inc.id} className="py-4 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-start gap-3">
                      <span className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 shrink-0">
                        <ShieldAlert className="w-4 h-4" />
                      </span>
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <span>{inc.type}</span>
                          {inc.confidence && (
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              {Math.round(inc.confidence * 100)}%
                            </span>
                          )}
                        </div>
                        <p className="text-slate-600 mt-0.5">{inc.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          BARCODE OVERRIDE MODAL
      ========================================================================= */}
      {showBarcodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <QrCode className="w-5 h-5" />
                </span>
                <h3 className="font-bold text-slate-900 text-base">Barcode Scanner Override</h3>
              </div>
              <button onClick={() => setShowBarcodeModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBarcodeSubmit} className="mt-4 space-y-4 text-xs">
              <p className="text-slate-500">
                Scan or input the student&apos;s Smart Campus ID card barcode number to record presence fallback.
              </p>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Barcode / Roll Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CS-2024-001 or 2024CS01"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBarcodeModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={barcodeProcessing}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition"
                >
                  {barcodeProcessing ? "Verifying..." : "Confirm Override"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AttendancePage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-slate-400">Loading Attendance &amp; Analytics...</div>}>
      <AttendancePageContent />
    </Suspense>
  );
}
