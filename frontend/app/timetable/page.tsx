"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  CalendarDays,
  Clock,
  Plus,
  BookOpen,
  User,
  MapPin,
  Camera,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  School,
  Sparkles,
  Upload,
  Download,
  FileSpreadsheet,
  Settings2,
  Check,
  ChevronDown,
  Edit2,
} from "lucide-react";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface TimetableSlot {
  id: number;
  period_number?: number | null;
  subject_id: number;
  faculty_id: number;
  camera_id?: number | null;
  day_of_week: string;
  start_time: string;
  end_time: string;
  classroom: string;
  section: string;
  batch_year: string;
  is_recurring: boolean;
  is_active: boolean;
  subject_name?: string | null;
  subject_code?: string | null;
  faculty_name?: string | null;
}

interface SubjectItem {
  id: number;
  code: string;
  name: string;
  semester?: number;
  department?: string;
  faculty_id?: number | null;
}

interface FacultyItem {
  id: number;
  employee_id: string;
  department: string;
  designation: string;
  user: {
    id: number;
    full_name: string;
    email: string;
  };
}

interface SectionItem {
  id: number;
  name: string;
  course_code: string;
  semester: number;
  room_number?: string;
}

interface TimePeriodConfig {
  id: string;
  label: string;
  start: string;
  end: string;
  isBreak?: boolean;
  breakName?: string;
}

const DEFAULT_PERIODS: TimePeriodConfig[] = [
  { id: "P1", label: "8:45 - 9:45", start: "08:45", end: "09:45" },
  { id: "P2", label: "9:45 - 10:45", start: "09:45", end: "10:45" },
  { id: "B1", label: "10:45 - 11:00", start: "10:45", end: "11:00", isBreak: true, breakName: "TEA BREAK" },
  { id: "P3", label: "11:00 - 12:00", start: "11:00", end: "12:00" },
  { id: "P4", label: "12:00 - 1:00", start: "12:00", end: "13:00" },
  { id: "B2", label: "1:00 - 1:30", start: "13:00", end: "13:30", isBreak: true, breakName: "LUNCH BREAK" },
  { id: "P5", label: "1:30 - 2:30", start: "13:30", end: "14:30" },
  { id: "P6", label: "2:30 - 3:30", start: "14:30", end: "15:30" },
  { id: "P7", label: "3:30 - 4:30", start: "15:30", end: "16:30" },
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const COURSES = [
  { id: "CSE", name: "Computer Science & Engineering" },
  { id: "ISE", name: "Information Science & Engineering" },
  { id: "ECE", name: "Electronics & Communication" },
  { id: "EEE", name: "Electrical & Electronics" },
];

export default function TimetablePage() {
  const { token } = useAuth();
  const [coursesList, setCoursesList] = useState<{ id: number; code: string; name: string }[]>([]);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [facultyList, setFacultyList] = useState<FacultyItem[]>([]);
  const [courseSections, setCourseSections] = useState<SectionItem[]>([]);
  const [availableRooms, setAvailableRooms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // CORE SELECTIONS: Course, Semester, Class/Section, and Room Number
  const [selectedCourse, setSelectedCourse] = useState("CSE");
  const [selectedSemester, setSelectedSemester] = useState<number>(7);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedRoom, setSelectedRoom] = useState("");

  // Periods configuration with localStorage persistence
  const [periods, setPeriods] = useState<TimePeriodConfig[]>(DEFAULT_PERIODS);

  // Load saved custom periods from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("smart_campus_timetable_periods");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPeriods(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load saved periods", e);
    }
  }, []);

  const savePeriods = (newPeriods: TimePeriodConfig[]) => {
    setPeriods(newPeriods);
    try {
      localStorage.setItem("smart_campus_timetable_periods", JSON.stringify(newPeriods));
    } catch (e) {
      console.error("Failed to save periods", e);
    }
  };

  // State for single period timing quick edit (clicking the header like "8:45 - 9:45")
  const [editingPeriod, setEditingPeriod] = useState<{
    index: number;
    period: TimePeriodConfig;
    newStart: string;
    newEnd: string;
    updateExistingSlots: boolean;
  } | null>(null);

  // Banners & Modals
  const [banner, setBanner] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [showTimingsModal, setShowTimingsModal] = useState(false);

  // EDIT SLOT MODAL STATE
  const [editingSlot, setEditingSlot] = useState<TimetableSlot | null>(null);
  const [editForm, setEditForm] = useState({
    subject_id: 0,
    faculty_id: 0,
    day_of_week: "Monday",
    start_time: "08:45",
    end_time: "09:45",
    classroom: "Room 302",
    section: "CS2",
  });
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Manual Add Form State
  const [manualForm, setManualForm] = useState({
    day_of_week: "Monday",
    start_time: "08:45",
    end_time: "09:45",
    subject_id: 0,
    faculty_id: 0,
    classroom: "Room 302",
    section: "CS2",
  });
  const [submittingManual, setSubmittingManual] = useState(false);

  // Excel / CSV Upload State
  const [excelText, setExcelText] = useState("");
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [importingExcel, setImportingExcel] = useState(false);

  // Handler to assign a physical classroom to the active class section
  const handleRoomChange = async (newRoom: string) => {
    setSelectedRoom(newRoom);
    const activeSec = courseSections.find((s) => s.name === selectedClass);
    if (activeSec && token) {
      try {
        const res = await fetch(`${API_BASE_URL}/academic/sections/${activeSec.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...getAuthHeaders(token) },
          body: JSON.stringify({ room_number: newRoom }),
        });
        if (res.ok) {
          setBanner({
            type: "success",
            msg: `Classroom '${newRoom}' successfully assigned to Section '${selectedClass}'.`,
          });
          setCourseSections((prev) =>
            prev.map((s) => (s.id === activeSec.id ? { ...s, room_number: newRoom } : s))
          );
        }
      } catch (err) {
        console.error("Failed to assign room:", err);
      }
    }
  };

  useEffect(() => {
    const loadCourses = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/academic/courses`, {
          headers: getAuthHeaders(token),
        });
        if (res.ok) {
          const courses = await res.json();
          setCoursesList(courses);
          if (courses.length > 0 && !courses.some((c: any) => c.code === selectedCourse)) {
            setSelectedCourse(courses[0].code);
          }
        }
      } catch (err) {
        console.error("Failed to load courses:", err);
      }
    };
    loadCourses();
  }, [token]);

  // Load Course Sections whenever selectedCourse changes
  useEffect(() => {
    const loadSectionsForCourse = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/academic/sections?course_code=${selectedCourse}`, {
          headers: getAuthHeaders(token),
        });
        if (res.ok) {
          const secs = await res.json();
          setCourseSections(secs);
          if (secs.length > 0) {
            setSelectedClass(secs[0].name);
            if (secs[0].room_number) setSelectedRoom(secs[0].room_number);
          } else {
            setSelectedClass("");
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadSectionsForCourse();
  }, [selectedCourse, token]);

  // Fetch timetable slots and metadata (accurately scoped to Course, Section, and Semester)
  const loadData = async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders(token);
      const params = new URLSearchParams({
        course: selectedCourse,
        section: selectedClass,
        semester: selectedSemester.toString(),
      });

      const [resSlots, resSub, resFac, resRooms] = await Promise.all([
        fetch(`${API_BASE_URL}/timetable?${params.toString()}`, { headers }),
        fetch(`${API_BASE_URL}/academic/subjects`, { headers }),
        fetch(`${API_BASE_URL}/academic/faculty`, { headers }),
        fetch(`${API_BASE_URL}/academic/classrooms`, { headers }),
      ]);

      if (resRooms.ok) {
        const roomsData = await resRooms.json();
        const roomNames = roomsData.map((r: any) => r.name || r.room_number).filter(Boolean);
        setAvailableRooms(roomNames);
        if (roomNames.length > 0) {
          if (!selectedRoom || !roomNames.includes(selectedRoom)) {
            setSelectedRoom(roomNames[0]);
          }
        } else {
          setSelectedRoom("Unassigned");
        }
      }

      if (resSlots.ok) {
        setSlots(await resSlots.json());
      }
      if (resSub.ok) {
        const subData = await resSub.json();
        setSubjects(subData);
        if (subData.length > 0 && manualForm.subject_id === 0) {
          setManualForm((prev) => ({ ...prev, subject_id: subData[0].id }));
        }
      }
      if (resFac.ok) {
        const facData = await resFac.json();
        setFacultyList(facData);
        if (facData.length > 0 && manualForm.faculty_id === 0) {
          setManualForm((prev) => ({ ...prev, faculty_id: facData[0].id }));
        }
      }
    } catch (err) {
      console.error("Failed to load timetable data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCourse, selectedClass, selectedSemester, token]);

  // Handle Quick Attendance Teacher Dropdown Change
  const handleUpdateSlotFaculty = async (slotId: number, newFacultyId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/timetable/${slotId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(token),
        },
        body: JSON.stringify({ faculty_id: newFacultyId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to update attendance teacher");
      }
      setBanner({
        type: "success",
        msg: `Assigned teacher ${data.faculty_name} to take attendance for ${data.subject_code} (${data.day_of_week} ${data.start_time}).`,
      });
      loadData();
    } catch (err: unknown) {
      setBanner({
        type: "error",
        msg: err instanceof Error ? err.message : "Error assigning teacher.",
      });
    }
  };

  // Open Edit Slot Modal
  const handleOpenEditSlot = (slot: TimetableSlot) => {
    setEditingSlot(slot);
    setEditForm({
      subject_id: slot.subject_id,
      faculty_id: slot.faculty_id,
      day_of_week: slot.day_of_week,
      start_time: slot.start_time,
      end_time: slot.end_time,
      classroom: slot.classroom,
      section: slot.section,
    });
  };

  // Save Slot Edits
  const handleSaveEditSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSlot) return;
    setSubmittingEdit(true);
    try {
      const res = await fetch(`${API_BASE_URL}/timetable/${editingSlot.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(token),
        },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to update slot.");
      setBanner({ type: "success", msg: `Slot ${data.subject_code} updated successfully.` });
      setEditingSlot(null);
      loadData();
    } catch (err: unknown) {
      setBanner({ type: "error", msg: err instanceof Error ? err.message : "Error updating slot." });
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Delete Timetable Slot
  const handleDeleteSlot = async (slotId: number) => {
    if (!confirm("Are you sure you want to delete this scheduled class slot?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/timetable/${slotId}`, {
        method: "DELETE",
        headers: getAuthHeaders(token),
      });
      if (res.ok) {
        setBanner({ type: "success", msg: "Slot removed from timetable." });
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Quick edit and update single period timing directly from table header (e.g. 8:45 - 9:45)
  const handleSavePeriodTiming = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPeriod) return;

    const { index, period, newStart, newEnd, updateExistingSlots } = editingPeriod;
    if (!newStart || !newEnd) return;

    const startFormatted = newStart.startsWith("0") ? newStart.substring(1) : newStart;
    const endFormatted = newEnd.startsWith("0") ? newEnd.substring(1) : newEnd;
    const newLabel = `${startFormatted} - ${endFormatted}`;

    const oldStart = period.start;

    const nextPeriods = [...periods];
    nextPeriods[index] = {
      ...nextPeriods[index],
      start: newStart,
      end: newEnd,
      label: newLabel,
    };
    savePeriods(nextPeriods);

    if (updateExistingSlots) {
      const matchingSlots = slots.filter((s) => s.start_time === oldStart);
      if (matchingSlots.length > 0) {
        for (const slot of matchingSlots) {
          try {
            await fetch(`${API_BASE_URL}/timetable/${slot.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json", ...getAuthHeaders(token) },
              body: JSON.stringify({
                start_time: newStart,
                end_time: newEnd,
              }),
            });
          } catch (err) {
            console.error("Failed to update slot timing:", err);
          }
        }
        setBanner({
          type: "success",
          msg: `Updated timing to ${newLabel} and shifted ${matchingSlots.length} scheduled class(es).`,
        });
        loadData();
      } else {
        setBanner({
          type: "success",
          msg: `Updated period timing to ${newLabel}.`,
        });
      }
    } else {
      setBanner({
        type: "success",
        msg: `Updated period timing to ${newLabel}.`,
      });
    }

    setEditingPeriod(null);
  };
  const handleQuickAddCell = (day: string, period: TimePeriodConfig) => {
    setManualForm({
      day_of_week: day,
      start_time: period.start,
      end_time: period.end,
      subject_id: subjects.length > 0 ? subjects[0].id : 0,
      faculty_id: facultyList.length > 0 ? facultyList[0].id : 0,
      classroom: selectedRoom,
      section: selectedClass,
    });
    setShowAddModal(true);
  };

  // Handle Manual Add Slot Submit
  const handleManualAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingManual(true);
    setBanner(null);
    try {
      const res = await fetch(`${API_BASE_URL}/timetable`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(token),
        },
        body: JSON.stringify({
          ...manualForm,
          classroom: selectedRoom,
          section: selectedClass,
          batch_year: "2023-2027",
          is_recurring: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to schedule slot.");
      }
      setBanner({
        type: "success",
        msg: `Successfully added ${data.subject_code} on ${data.day_of_week} (${data.start_time}-${data.end_time}).`,
      });
      setShowAddModal(false);
      loadData();
    } catch (err: unknown) {
      setBanner({
        type: "error",
        msg: err instanceof Error ? err.message : "Error adding slot.",
      });
    } finally {
      setSubmittingManual(false);
    }
  };

  // Parse Excel / CSV pasted text
  const handleParseExcelText = (text: string) => {
    setExcelText(text);
    const lines = text.trim().split("\n");
    if (lines.length <= 1) {
      setParsedRows([]);
      return;
    }

    const rows: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(/[,\t]/).map((p) => p.trim());
      if (parts.length >= 4) {
        rows.push({
          day_of_week: parts[0],
          start_time: parts[1],
          end_time: parts[2],
          subject_code: parts[3],
          subject_name: parts[4] || parts[3],
          faculty_name: parts[5] || "",
          classroom: parts[6] || selectedRoom,
          section: selectedClass,
          semester: selectedSemester,
        });
      }
    }
    setParsedRows(rows);
  };

  // Submit Excel / CSV Import to Backend
  const handleConfirmExcelImport = async () => {
    if (parsedRows.length === 0) return;
    setImportingExcel(true);
    try {
      const res = await fetch(`${API_BASE_URL}/timetable/batch-import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(token),
        },
        body: JSON.stringify({
          slots: parsedRows,
          replace_existing: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Import failed.");
      }
      setBanner({
        type: "success",
        msg: `Import complete! Successfully saved ${data.imported_count} timetable slots from sheet.`,
      });
      setShowExcelModal(false);
      setExcelText("");
      setParsedRows([]);
      loadData();
    } catch (err: unknown) {
      setBanner({
        type: "error",
        msg: err instanceof Error ? err.message : "Error importing timetable sheet.",
      });
    } finally {
      setImportingExcel(false);
    }
  };

  // Download Sample Excel/CSV Template
  const downloadSampleTemplate = () => {
    const csvContent =
      "Day,Start Time,End Time,Subject Code,Subject Name,Faculty Name,Classroom\n" +
      `Monday,08:45,09:45,${selectedCourse}701,Advanced Systems,Prof. Teacher 1,${selectedRoom}\n` +
      `Monday,09:45,10:45,${selectedCourse}702,Core Subject,Prof. Teacher 2,${selectedRoom}\n` +
      `Monday,11:00,12:00,${selectedCourse}703,Applied Computing,Prof. Teacher 3,${selectedRoom}\n` +
      `Monday,12:00,13:00,${selectedCourse}704,Engineering Design,Prof. Teacher 4,${selectedRoom}\n`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `timetable_${selectedCourse}_${selectedClass}_sem${selectedSemester}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Normalize time strings like "08:30" and "8:30" to comparable integer minutes or clean string
  const normalizeTimeStr = (t?: string) => {
    if (!t) return "";
    const clean = t.trim();
    const parts = clean.split(":");
    if (parts.length < 2) return clean;
    const h = parseInt(parts[0], 10);
    const m = parts[1].padStart(2, "0");
    return `${h}:${m}`;
  };

  const getSlot = (day: string, period: TimePeriodConfig) => {
    const pStart = normalizeTimeStr(period.start);
    const pEnd = normalizeTimeStr(period.end);

    return slots.find((s) => {
      if (s.day_of_week.trim().toLowerCase() !== day.trim().toLowerCase()) {
        return false;
      }
      const sStart = normalizeTimeStr(s.start_time);
      const sEnd = normalizeTimeStr(s.end_time);

      const pNum = parseInt(period.id.replace(/\D/g, ""), 10);
      if (s.period_number && !isNaN(pNum) && s.period_number === pNum) {
        return true;
      }
      if (sStart === pStart) {
        return true;
      }
      return Boolean(sStart && pStart && sStart <= pStart && sEnd >= pEnd);
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* =========================================================================
          DIVISION BAR: Course, Semester, Class (From DB Sections), and Room Number
      ========================================================================= */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* 1. Course Division (Loaded dynamically from database) */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Course
            </label>
            <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              {coursesList.length > 0 ? (
                coursesList.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCourse(c.code)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      selectedCourse === c.code
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {c.code}
                  </button>
                ))
              ) : (
                <span className="text-[11px] text-slate-400 px-2 py-1">No Courses Configured</span>
              )}
            </div>
          </div>

          {/* 2. Semester */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Semester
            </label>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(Number(e.target.value))}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                <option key={sem} value={sem}>
                  Sem {sem}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Class / Section (Dynamically Loaded for Selected Course) */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Class / Section
            </label>
            <select
              value={selectedClass}
              onChange={(e) => {
                const newClass = e.target.value;
                setSelectedClass(newClass);
                const matchedSec = courseSections.find((s) => s.name === newClass);
                if (matchedSec?.room_number) {
                  setSelectedRoom(matchedSec.room_number);
                }
              }}
              className="bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2 text-xs font-bold text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {courseSections.length > 0 ? (
                courseSections.map((sec) => (
                  <option key={sec.id} value={sec.name}>
                    Class: {sec.name} (Sem {sec.semester})
                  </option>
                ))
              ) : (
                <option value="">No Sections Found — Add in Academic</option>
              )}
            </select>
          </div>

          {/* 4. Room Number */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Room Number
            </label>
            <select
              value={selectedRoom}
              onChange={(e) => handleRoomChange(e.target.value)}
              className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs font-bold text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {availableRooms.length > 0 ? (
                availableRooms.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))
              ) : (
                <option value="Unassigned">No Registered Classrooms</option>
              )}
            </select>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowExcelModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Import XL / Sheet</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Manual Add Slot</span>
          </button>

          <button
            onClick={() => setShowTimingsModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
          >
            <Settings2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Timings Config</span>
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {banner && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center justify-between gap-3 shadow-xs ${
            banner.type === "success"
              ? "bg-emerald-50/90 border-emerald-200 text-emerald-900"
              : "bg-rose-50/90 border-rose-200 text-rose-900"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {banner.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-semibold">{banner.msg}</span>
          </div>
          <button onClick={() => setBanner(null)} className="text-slate-400 hover:text-slate-700 transition">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* =========================================================================
          TIMETABLE MATRIX: Editable Slots, Room Display, & Attendance Teacher
      ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
        {/* Simple Header Bar */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-4 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {selectedCourse} &bull; Class {selectedClass || "Unselected"} (Semester {selectedSemester})
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  Assigned Classroom: {selectedRoom || "Unassigned"}
                </span>
                <span className="text-xs text-slate-500">
                  &bull; Select Room Number dropdown above to assign or reassign room for this class
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold font-mono">
              {slots.length} Scheduled Periods
            </span>
          </div>
        </div>

        {/* Timetable Weekly Matrix Grid */}
        <div className="overflow-x-auto border border-slate-200 rounded-2xl">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <th className="py-3 px-4 border-r border-slate-200 whitespace-nowrap bg-slate-100/70 text-slate-900 font-extrabold w-28">
                  DAY / TIME
                </th>
                {periods.map((p) => (
                  <th
                    key={p.id}
                    className={`py-2 px-2 border-r border-slate-200 whitespace-nowrap text-[11px] ${
                      p.isBreak ? "bg-amber-50/70 text-amber-800 font-bold w-16" : "min-w-[145px] font-bold"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setEditingPeriod({
                          index: periods.findIndex((item) => item.id === p.id),
                          period: p,
                          newStart: p.start,
                          newEnd: p.end,
                          updateExistingSlots: true,
                        })
                      }
                      className="w-full text-center group cursor-pointer hover:bg-blue-100/60 p-1.5 rounded-xl border border-transparent hover:border-blue-200 transition"
                      title={`Click to change timing (${p.label})`}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="font-bold text-slate-800 group-hover:text-blue-700">{p.label}</span>
                        <Edit2 className="w-3 h-3 text-slate-400 group-hover:text-blue-600 transition" />
                      </div>
                      {p.isBreak && (
                        <span className="text-[9px] font-extrabold text-amber-700 block mt-0.5 uppercase tracking-wider">
                          {p.breakName}
                        </span>
                      )}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {DAYS.map((day) => (
                <tr key={day} className="hover:bg-blue-50/15 transition">
                  {/* Day Label */}
                  <td className="py-4 px-4 border-r border-slate-200 bg-slate-50/80 font-bold text-slate-900 text-left whitespace-nowrap">
                    {day}
                  </td>

                  {/* Period Slots */}
                  {periods.map((p) => {
                    if (p.isBreak) {
                      return (
                        <td
                          key={p.id}
                          className="border-r border-slate-200 bg-amber-50/40 p-1 text-[9px] font-mono text-amber-700"
                        >
                          <div className="flex flex-col items-center justify-center h-full text-[9px] font-extrabold tracking-widest uppercase">
                            {p.breakName?.split(" ")[0]}
                          </div>
                        </td>
                      );
                    }

                    const slot = getSlot(day, p);
                    if (!slot) {
                      return (
                        <td
                          key={p.id}
                          className="border-r border-slate-200 p-2 text-slate-300 font-mono text-xs bg-slate-50/20 group hover:bg-blue-50/30 transition cursor-pointer"
                          onClick={() => handleQuickAddCell(day, p)}
                          title="Click to schedule class here"
                        >
                          <div className="flex items-center justify-center h-full min-h-[70px]">
                            <span className="text-slate-300 group-hover:hidden">—</span>
                            <span className="hidden group-hover:inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-white px-2 py-1 rounded-lg border border-blue-200 shadow-2xs">
                              <Plus className="w-3 h-3" />
                              <span>Add</span>
                            </span>
                          </div>
                        </td>
                      );
                    }

                    return (
                      <td
                        key={p.id}
                        className="border-r border-slate-200 p-2.5 bg-white align-top text-left space-y-1.5 hover:shadow-inner transition group relative"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                            {slot.subject_code || "CLASS"}
                          </span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                            <button
                              onClick={() => handleOpenEditSlot(slot)}
                              className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-slate-100"
                              title="Edit Slot"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteSlot(slot.id)}
                              className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-slate-100"
                              title="Delete Slot"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div
                          className="text-[11px] font-bold text-slate-800 line-clamp-1 cursor-pointer hover:text-blue-600"
                          title={slot.subject_name || ""}
                          onClick={() => handleOpenEditSlot(slot)}
                        >
                          {slot.subject_name || slot.classroom}
                        </div>

                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-emerald-500" />
                          <span>{slot.classroom}</span>
                        </div>

                        {/* Interactive Dropdown to show and change teacher taking attendance */}
                        <div className="pt-1 border-t border-slate-100">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                            Taking Attendance:
                          </label>
                          <select
                            value={slot.faculty_id}
                            onChange={(e) => handleUpdateSlotFaculty(slot.id, Number(e.target.value))}
                            className="w-full bg-slate-50 hover:bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer transition"
                          >
                            {facultyList.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.user.full_name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================================
          MODALS
      ========================================================================= */}
      {/* 1. EDIT TIMETABLE SLOT MODAL */}
      {editingSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <Edit2 className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Edit Timetable Slot</h3>
                  <p className="text-xs text-slate-500">
                    Modify subject, teacher, room, or period timing
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingSlot(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditSlot} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Subject</label>
                <select
                  value={editForm.subject_id}
                  onChange={(e) => setEditForm({ ...editForm, subject_id: Number(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} - {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Teacher Taking Attendance
                </label>
                <select
                  value={editForm.faculty_id}
                  onChange={(e) => setEditForm({ ...editForm, faculty_id: Number(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold"
                >
                  {facultyList.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.user.full_name} ({f.department})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Day of Week</label>
                <select
                  value={editForm.day_of_week}
                  onChange={(e) => setEditForm({ ...editForm, day_of_week: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold"
                >
                  {DAYS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={editForm.start_time}
                    onChange={(e) => setEditForm({ ...editForm, start_time: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">End Time</label>
                  <input
                    type="time"
                    required
                    value={editForm.end_time}
                    onChange={(e) => setEditForm({ ...editForm, end_time: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Classroom / Room Number</label>
                <select
                  value={editForm.classroom}
                  onChange={(e) => setEditForm({ ...editForm, classroom: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold"
                >
                  {availableRooms.length > 0 ? (
                    availableRooms.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))
                  ) : (
                    <option value="Unassigned">No Classrooms Available</option>
                  )}
                </select>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteSlot(editingSlot.id);
                    setEditingSlot(null);
                  }}
                  className="px-3 py-2 rounded-xl text-rose-600 font-bold hover:bg-rose-50 flex items-center gap-1 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingSlot(null)}
                    className="px-4 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingEdit}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs transition"
                  >
                    {submittingEdit ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Import Excel / CSV Modal */}
      {showExcelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <FileSpreadsheet className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Import Timetable from Excel / Sheet</h3>
                  <p className="text-xs text-slate-500">
                    Paste CSV or tabular data for Class {selectedClass} ({selectedCourse})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowExcelModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Paste Table Data (CSV / TSV)</span>
                <button
                  type="button"
                  onClick={downloadSampleTemplate}
                  className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Sample CSV</span>
                </button>
              </div>

              <textarea
                rows={6}
                value={excelText}
                onChange={(e) => handleParseExcelText(e.target.value)}
                placeholder={"Day,Start Time,End Time,Subject Code,Subject Name,Faculty Name,Classroom\nMonday,08:45,09:45,BCS701,Internet of Things,Prof. Gangambika G,Room 302"}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {parsedRows.length > 0 && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 font-semibold flex items-center justify-between">
                  <span>Detected {parsedRows.length} valid timetable periods ready to import.</span>
                  <Check className="w-4 h-4 text-emerald-600" />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowExcelModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={parsedRows.length === 0 || importingExcel}
                onClick={handleConfirmExcelImport}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition"
              >
                {importingExcel ? "Importing..." : `Save ${parsedRows.length} Periods`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Manual Add Slot Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <Plus className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add Timetable Slot</h3>
                  <p className="text-xs text-slate-500">
                    Schedule period for Class {selectedClass} &bull; {selectedRoom}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualAddSlot} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Day of Week</label>
                <select
                  value={manualForm.day_of_week}
                  onChange={(e) => setManualForm({ ...manualForm, day_of_week: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold"
                >
                  {DAYS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={manualForm.start_time}
                    onChange={(e) => setManualForm({ ...manualForm, start_time: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">End Time</label>
                  <input
                    type="time"
                    required
                    value={manualForm.end_time}
                    onChange={(e) => setManualForm({ ...manualForm, end_time: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Subject</label>
                <select
                  value={manualForm.subject_id}
                  onChange={(e) => setManualForm({ ...manualForm, subject_id: Number(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} - {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Teacher Taking Attendance
                </label>
                <select
                  value={manualForm.faculty_id}
                  onChange={(e) => setManualForm({ ...manualForm, faculty_id: Number(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold"
                >
                  {facultyList.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.user.full_name} ({f.department})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingManual}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs transition"
                >
                  {submittingManual ? "Saving..." : "Add Slot"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Single Period Timing Quick Edit Modal (Clicking "8:45 - 9:45" etc.) */}
      {editingPeriod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <Clock className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Change {editingPeriod.period.isBreak ? editingPeriod.period.breakName : `Period ${editingPeriod.index + 1}`} Timing
                  </h3>
                  <p className="text-xs text-slate-500">Currently scheduled as: {editingPeriod.period.label}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingPeriod(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePeriodTiming} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={editingPeriod.newStart}
                    onChange={(e) =>
                      setEditingPeriod({ ...editingPeriod, newStart: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">End Time</label>
                  <input
                    type="time"
                    required
                    value={editingPeriod.newEnd}
                    onChange={(e) =>
                      setEditingPeriod({ ...editingPeriod, newEnd: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-2xl">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingPeriod.updateExistingSlots}
                    onChange={(e) =>
                      setEditingPeriod({
                        ...editingPeriod,
                        updateExistingSlots: e.target.checked,
                      })
                    }
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 mt-0.5"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block text-xs">
                      Update existing scheduled classes
                    </span>
                    <span className="text-[11px] text-slate-500 block leading-snug">
                      Automatically shift all classes matching {editingPeriod.period.start} to the new time ({editingPeriod.newStart} - {editingPeriod.newEnd}).
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingPeriod(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs transition cursor-pointer"
                >
                  Save New Timing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Bulk Timings Config Modal */}
      {showTimingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-slate-100 text-slate-700">
                  <Clock className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Period Timings Configuration</h3>
                  <p className="text-xs text-slate-500">Configure daily period start and end time boundaries</p>
                </div>
              </div>
              <button
                onClick={() => setShowTimingsModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 text-xs">
              {periods.map((p, idx) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-200 bg-slate-50"
                >
                  <div className="font-bold text-slate-800 w-24">
                    {p.isBreak ? p.breakName : `Period ${idx + 1}`}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={p.start}
                      onChange={(e) => {
                        const next = [...periods];
                        next[idx].start = e.target.value;
                        const sF = e.target.value.startsWith("0") ? e.target.value.substring(1) : e.target.value;
                        const eF = next[idx].end.startsWith("0") ? next[idx].end.substring(1) : next[idx].end;
                        next[idx].label = `${sF} - ${eF}`;
                        savePeriods(next);
                      }}
                      className="bg-white border border-slate-300 rounded-lg px-2 py-1 font-mono text-[11px]"
                    />
                    <span className="text-slate-400">to</span>
                    <input
                      type="time"
                      value={p.end}
                      onChange={(e) => {
                        const next = [...periods];
                        next[idx].end = e.target.value;
                        const sF = next[idx].start.startsWith("0") ? next[idx].start.substring(1) : next[idx].start;
                        const eF = e.target.value.startsWith("0") ? e.target.value.substring(1) : e.target.value;
                        next[idx].label = `${sF} - ${eF}`;
                        savePeriods(next);
                      }}
                      className="bg-white border border-slate-300 rounded-lg px-2 py-1 font-mono text-[11px]"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => {
                  savePeriods(DEFAULT_PERIODS);
                  setBanner({ type: "success", msg: "Reset to default period timings." });
                }}
                className="text-blue-600 font-bold hover:underline"
              >
                Reset to Standard Timings
              </button>
              <button
                type="button"
                onClick={() => {
                  savePeriods(periods);
                  setShowTimingsModal(false);
                  setBanner({ type: "success", msg: "Daily period timings saved and applied." });
                }}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs transition"
              >
                Apply Timings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
