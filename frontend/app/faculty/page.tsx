"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  GraduationCap,
  Users,
  Building2,
  Search,
  Plus,
  Mail,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  X,
  School,
  BookOpen,
  Trash2,
} from "lucide-react";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface SubjectItem {
  id: number;
  code: string;
  name: string;
  semester?: number;
  department: string;
  faculty_id?: number | null;
}

interface FacultyItem {
  id: number;
  employee_id: string;
  department: string;
  designation: string;
  is_class_teacher?: boolean;
  class_teacher_section?: string | null;
  class_teacher_semester?: number | null;
  class_teacher_cohort?: string | null;
  subjects?: SubjectItem[];
  user: {
    id: number;
    email: string;
    full_name: string;
    is_active: boolean;
  };
}

interface CourseItem {
  id: number;
  code: string;
  name: string;
}

export default function FacultyManagementPage() {
  const { token } = useAuth();
  const [facultyList, setFacultyList] = useState<FacultyItem[]>([]);
  const [subjectsList, setSubjectsList] = useState<SubjectItem[]>([]);
  const [coursesList, setCoursesList] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "CLASS_TEACHER" | "UNASSIGNED">("ALL");

  // Notification banners
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [assignModalFaculty, setAssignModalFaculty] = useState<FacultyItem | null>(null);
  const [assignSubjectFaculty, setAssignSubjectFaculty] = useState<FacultyItem | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | "">("");

  // Add Faculty Form State
  const [addForm, setAddForm] = useState({
    full_name: "",
    email: "",
    employee_id: "",
    department: "",
    designation: "Assistant Professor",
    password: "",
  });
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // Assign Class Teacher Form State
  const [assignForm, setAssignForm] = useState({
    department: "",
    semester: 7,
    section: "",
  });
  const [submittingAssign, setSubmittingAssign] = useState(false);
  const [submittingSubjectAssign, setSubmittingSubjectAssign] = useState(false);

  const fetchFacultyAndSubjects = async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders(token);
      const [resFac, resSub, resCourses] = await Promise.all([
        fetch(`${API_BASE_URL}/academic/faculty`, { headers }),
        fetch(`${API_BASE_URL}/academic/subjects`, { headers }),
        fetch(`${API_BASE_URL}/academic/courses`, { headers }),
      ]);

      if (resCourses.ok) {
        const cData: CourseItem[] = await resCourses.json();
        setCoursesList(cData);
        if (cData.length > 0) {
          setAddForm((prev) => ({ ...prev, department: prev.department || cData[0].name }));
        }
      }

      let subjectsData: SubjectItem[] = [];
      if (resSub.ok) {
        subjectsData = await resSub.json();
        setSubjectsList(subjectsData);
      }

      if (resFac.ok) {
        const facData: FacultyItem[] = await resFac.json();
        // Map subjects to faculty
        const enhanced = facData.map((f) => {
          const taughtSubjects = subjectsData.filter((s) => s.faculty_id === f.id);
          const cohort =
            f.class_teacher_cohort ||
            (f.is_class_teacher && f.class_teacher_semester && f.class_teacher_section
              ? `Sem ${f.class_teacher_semester}-${f.class_teacher_section}`
              : null);
          return {
            ...f,
            subjects: taughtSubjects,
            class_teacher_cohort: cohort,
          };
        });
        setFacultyList(enhanced);
      }
    } catch (err) {
      console.error("Failed to load faculty and subjects:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFacultyAndSubjects();
  }, [token]);

  // Derived Statistics
  const stats = useMemo(() => {
    const total = facultyList.length;
    const classTeachers = facultyList.filter((f) => Boolean(f.class_teacher_cohort)).length;
    const totalAssignedSubjects = subjectsList.filter((s) => Boolean(s.faculty_id)).length;
    return { total, classTeachers, totalAssignedSubjects };
  }, [facultyList, subjectsList]);

  // Unique departments for filter
  const departments = useMemo(() => {
    const set = new Set([
      ...facultyList.map((f) => f.department),
      ...coursesList.map((c) => c.name),
    ].filter(Boolean));
    return Array.from(set);
  }, [facultyList, coursesList]);

  // Filtered Faculty
  const filteredFaculty = useMemo(() => {
    return facultyList.filter((f) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !searchQuery ||
        f.user.full_name.toLowerCase().includes(q) ||
        f.employee_id.toLowerCase().includes(q) ||
        f.user.email.toLowerCase().includes(q) ||
        f.department.toLowerCase().includes(q) ||
        (f.subjects && f.subjects.some((s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)));

      const matchDept = deptFilter === "ALL" || f.department === deptFilter;

      let matchRole = true;
      if (roleFilter === "CLASS_TEACHER") matchRole = Boolean(f.class_teacher_cohort);
      if (roleFilter === "UNASSIGNED") matchRole = !f.class_teacher_cohort;

      return matchSearch && matchDept && matchRole;
    });
  }, [facultyList, searchQuery, deptFilter, roleFilter]);

  // Handle Add Faculty Submit
  const handleAddFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingAdd(true);
    setBanner(null);
    try {
      const res = await fetch(`${API_BASE_URL}/academic/faculty`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(token),
        },
        body: JSON.stringify(addForm),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to create faculty member.");
      }
      setBanner({
        type: "success",
        message: `Faculty member ${addForm.full_name} (${addForm.employee_id}) created successfully.`,
      });
      setIsAddModalOpen(false);
      setAddForm({
        full_name: "",
        email: "",
        employee_id: "",
        department: "Computer Science & Engineering",
        designation: "Assistant Professor",
        password: "",
      });
      fetchFacultyAndSubjects();
    } catch (err: unknown) {
      setBanner({
        type: "error",
        message: err instanceof Error ? err.message : "Error creating faculty member.",
      });
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Handle Assign Class Teacher Submit
  const handleAssignClassTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModalFaculty) return;
    setSubmittingAssign(true);
    setBanner(null);
    try {
      const res = await fetch(
        `${API_BASE_URL}/academic/faculty/${assignModalFaculty.id}/assign-class-teacher`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(token),
          },
          body: JSON.stringify({
            department: assignForm.department,
            semester: Number(assignForm.semester),
            section: assignForm.section.toUpperCase(),
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Assignment conflict or failure.");
      }
      setBanner({
        type: "success",
        message: `${assignModalFaculty.user.full_name} successfully assigned as Class Teacher for ${data.class_teacher_section || assignForm.section}.`,
      });
      setAssignModalFaculty(null);
      fetchFacultyAndSubjects();
    } catch (err: unknown) {
      setBanner({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to assign Class Teacher.",
      });
    } finally {
      setSubmittingAssign(false);
    }
  };

  // Handle Assign Subject to Faculty
  const handleAssignSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignSubjectFaculty || !selectedSubjectId) return;
    setSubmittingSubjectAssign(true);
    setBanner(null);
    try {
      const res = await fetch(
        `${API_BASE_URL}/academic/faculty/${assignSubjectFaculty.id}/assign-subject`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(token),
          },
          body: JSON.stringify({ subject_id: Number(selectedSubjectId) }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to assign subject.");
      }
      setBanner({
        type: "success",
        message: `Assigned subject ${data.subject_code} (${data.subject_name}) to ${assignSubjectFaculty.user.full_name}.`,
      });
      setAssignSubjectFaculty(null);
      setSelectedSubjectId("");
      fetchFacultyAndSubjects();
    } catch (err: unknown) {
      setBanner({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to assign subject.",
      });
    } finally {
      setSubmittingSubjectAssign(false);
    }
  };

  // Handle Unassign Subject from Faculty
  const handleUnassignSubject = async (facultyId: number, subjectId: number, subjectName: string) => {
    if (!confirm(`Are you sure you want to unassign ${subjectName}?`)) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/academic/faculty/${facultyId}/unassign-subject/${subjectId}`,
        {
          method: "POST",
          headers: getAuthHeaders(token),
        }
      );
      if (res.ok) {
        setBanner({ type: "success", message: `Unassigned ${subjectName} successfully.` });
        fetchFacultyAndSubjects();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Delete Faculty Member
  const handleDeleteFaculty = async (facultyId: number, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete faculty member "${name}" and their login account?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/academic/faculty/${facultyId}`, {
        method: "DELETE",
        headers: getAuthHeaders(token),
      });
      if (res.ok) {
        setBanner({ type: "success", message: `Faculty member "${name}" permanently deleted.` });
        fetchFacultyAndSubjects();
      } else {
        const errData = await res.json().catch(() => ({}));
        setBanner({ type: "error", message: errData.detail || "Failed to delete faculty member." });
      }
    } catch (err: unknown) {
      console.error(err);
      setBanner({ type: "error", message: "Network error deleting faculty member." });
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Section */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <GraduationCap className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Faculty &amp; Subject Teaching Management
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            Provision academic personnel, map subject course instructors, and enforce Class Teacher cohort governance.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Faculty Member</span>
        </button>
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
            <span className="font-semibold">{banner.message}</span>
          </div>
          <button
            onClick={() => setBanner(null)}
            className="text-slate-400 hover:text-slate-700 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{stats.total}</div>
            <div className="text-xs text-slate-500 font-medium">Total Faculty Appointed</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-indigo-700">{stats.totalAssignedSubjects}</div>
            <div className="text-xs text-slate-500 font-medium">Subjects Assigned to Faculty</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-700">
            <School className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-cyan-800">{stats.classTeachers}</div>
            <div className="text-xs text-slate-500 font-medium">Class Teachers Assigned</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by faculty, subject code, or ID..."
            className="w-full bg-slate-50/80 border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Department Filter */}
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as "ALL" | "CLASS_TEACHER" | "UNASSIGNED")}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Roles</option>
            <option value="CLASS_TEACHER">Class Teachers Only</option>
            <option value="UNASSIGNED">Unassigned Cohort</option>
          </select>
        </div>
      </div>

      {/* Faculty Directory Table */}
      <div className="bg-white border border-slate-200/90 rounded-3xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Faculty Roster &amp; Teaching Assignments
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono text-[10px] font-bold">
              {filteredFaculty.length} {filteredFaculty.length === 1 ? "Member" : "Members"}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-8 h-8 rounded-full border-2 border-blue-500/20 border-t-blue-600 animate-spin mx-auto" />
            <p className="text-xs text-slate-500 font-medium">Loading faculty members...</p>
          </div>
        ) : filteredFaculty.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Users className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-700">No faculty members found</p>
            <p className="text-[11px] text-slate-400">Adjust your search or filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-6">Faculty Member</th>
                  <th className="py-3 px-4">Employee ID</th>
                  <th className="py-3 px-4">Assigned Subjects (Teaching)</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredFaculty.map((faculty) => {
                  const initials = faculty.user.full_name
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();
                  const isClassTeacher = Boolean(faculty.class_teacher_cohort);

                  return (
                    <tr key={faculty.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-100/70 border border-blue-200 text-blue-700 font-extrabold flex items-center justify-center shrink-0 text-xs shadow-2xs">
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{faculty.user.full_name}</div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1 font-normal">
                              <Mail className="w-3 h-3 text-slate-400" />
                              <span>{faculty.user.email}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium">{faculty.designation}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                          {faculty.employee_id}
                        </span>
                      </td>

                      {/* Assigned Subjects Column */}
                      <td className="py-3.5 px-4">
                        {faculty.subjects && faculty.subjects.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {faculty.subjects.map((sub) => (
                              <span
                                key={sub.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-bold shadow-2xs group"
                              >
                                <span className="font-mono text-blue-600">{sub.code}:</span>
                                <span>{sub.name}</span>
                                <button
                                  type="button"
                                  onClick={() => handleUnassignSubject(faculty.id, sub.id, sub.name)}
                                  className="text-blue-400 hover:text-rose-600 ml-0.5 transition"
                                  title="Unassign Subject"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            No subjects assigned yet
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setAssignSubjectFaculty(faculty);
                              setSelectedSubjectId("");
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition cursor-pointer shadow-2xs"
                            title="Assign a subject course to this teacher"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>Assign Subject</span>
                          </button>

                          <button
                            onClick={() => handleDeleteFaculty(faculty.id, faculty.user.full_name)}
                            className="p-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition cursor-pointer shadow-2xs"
                            title="Delete Faculty Member"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =========================================================================
          MODALS
      ========================================================================= */}
      {/* Assign Subject to Faculty Modal */}
      {assignSubjectFaculty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <BookOpen className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Assign Subject Course</h3>
                  <p className="text-[11px] text-slate-500">Instructor: {assignSubjectFaculty.user.full_name}</p>
                </div>
              </div>
              <button
                onClick={() => setAssignSubjectFaculty(null)}
                className="text-slate-400 hover:text-slate-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAssignSubject} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Select Subject</label>
                <select
                  required
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Choose Subject to Teach --</option>
                  {subjectsList.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.code} • {sub.name} (Sem {sub.semester})
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-500">
                Assigning this subject links the faculty instructor directly to all attendance ledgers, CCTV processing sessions, and weekly timetable slots for this subject.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAssignSubjectFaculty(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSubjectAssign || !selectedSubjectId}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold transition shadow-xs cursor-pointer"
                >
                  {submittingSubjectAssign ? "Assigning..." : "Confirm Subject Assignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Class Teacher Modal */}
      {assignModalFaculty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <School className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Assign Class Teacher Role</h3>
                  <p className="text-[11px] text-slate-500">Faculty: {assignModalFaculty.user.full_name}</p>
                </div>
              </div>
              <button
                onClick={() => setAssignModalFaculty(null)}
                className="text-slate-400 hover:text-slate-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAssignClassTeacher} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Academic Department</label>
                <input
                  type="text"
                  readOnly
                  value={assignForm.department}
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-600 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Semester</label>
                  <select
                    value={assignForm.semester}
                    onChange={(e) => setAssignForm({ ...assignForm, semester: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={s}>
                        Semester {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Section</label>
                  <input
                    type="text"
                    required
                    value={assignForm.section}
                    onChange={(e) => setAssignForm({ ...assignForm, section: e.target.value.toUpperCase() })}
                    placeholder="e.g. CS2, A, B"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold uppercase"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAssignModalFaculty(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAssign}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold transition shadow-xs cursor-pointer"
                >
                  {submittingAssign ? "Saving..." : "Confirm Class Teacher"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Faculty Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <GraduationCap className="w-5 h-5" />
                </span>
                <h3 className="font-bold text-slate-900 text-sm">Add New Faculty Member</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddFaculty} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Prof. Roopa E"
                  value={addForm.full_name}
                  onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Official Email</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. roopa.e@ewit.edu.in"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Employee ID</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. EMP-CS-701"
                    value={addForm.employee_id}
                    onChange={(e) => setAddForm({ ...addForm, employee_id: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Designation</label>
                  <select
                    value={addForm.designation}
                    onChange={(e) => setAddForm({ ...addForm, designation: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  >
                    <option value="Assistant Professor">Assistant Professor</option>
                    <option value="Associate Professor">Associate Professor</option>
                    <option value="Professor">Professor</option>
                    <option value="HOD">Head of Department</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Department</label>
                <select
                  value={addForm.department}
                  onChange={(e) => setAddForm({ ...addForm, department: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                >
                  {coursesList.length > 0 ? (
                    coursesList.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name} {c.code ? `(${c.code})` : ""}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="Computer Science & Engineering">Computer Science & Engineering (CSE)</option>
                      <option value="Information Science & Engineering">Information Science & Engineering (ISE)</option>
                      <option value="Electronics & Communication">Electronics & Communication (ECE)</option>
                      <option value="Electrical & Electronics">Electrical & Electronics (EEE)</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Initial Password</label>
                <input
                  type="password"
                  placeholder="Defaults to faculty123"
                  value={addForm.password}
                  onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdd}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold transition shadow-xs cursor-pointer"
                >
                  {submittingAdd ? "Saving..." : "Create Faculty Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
