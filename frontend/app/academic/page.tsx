"use client";

import React, { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Building,
  MapPin,
  BookOpen,
  Users,
  Camera,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  CreditCard,
  ScanFace,
  Layers,
  GraduationCap,
  Sparkles,
  RefreshCw,
  Upload,
  ArrowRight,
  Filter,
  Check,
  Trash2,
  Edit2,
  User,
  ArrowLeft,
  Cloud,
  Printer,
  QrCode,
  Info,
  ShieldCheck,
  RotateCw,
} from "lucide-react";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

type AcademicTab = "courses" | "sections" | "classrooms" | "subjects" | "students" | "enrollment";

interface CourseItem {
  id: number;
  code?: string;
  course_code?: string;
  name?: string;
  course_name?: string;
  department?: string;
  description?: string;
  degree_level?: string;
  total_semesters?: number;
  is_active: boolean;
  student_count?: number;
  faculty_count?: number;
  subject_count?: number;
}

interface SectionItem {
  id: number;
  name: string;
  course_code: string;
  semester: number;
  batch_year: string;
  room_number?: string;
  capacity: number;
  is_active: boolean;
}

interface ClassroomItem {
  id: number;
  room_number: string;
  building: string;
  floor: number;
  capacity: number;
  room_type: string;
  is_active: boolean;
}

interface SubjectItem {
  id: number;
  code: string;
  name: string;
  department: string;
  semester: number;
  credits: number;
  faculty_id?: number | null;
  faculty?: {
    id: number;
    employee_id: string;
    user: {
      full_name: string;
      email: string;
    };
  } | null;
}

interface StudentItem {
  id: number;
  student_id: string;
  department: string;
  batch_year: string;
  semester: number;
  section: string;
  biometric_enrolled: boolean;
  biometric_face_count: number;
  photo_url?: string | null;
  user: {
    id: number;
    full_name: string;
    email: string;
  };
}

const COURSES_LIST = [
  { code: "CSE", name: "Computer Science & Engineering" },
  { code: "ISE", name: "Information Science & Engineering" },
  { code: "ECE", name: "Electronics & Communication" },
  { code: "EEE", name: "Electrical & Electronics" },
];

function AcademicManagementContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { token } = useAuth();

  const urlTab = (searchParams.get("tab") as AcademicTab) || "courses";
  const [activeTab, setActiveTab] = useState<AcademicTab>(
    ["courses", "sections", "classrooms", "subjects", "students", "enrollment"].includes(urlTab) ? urlTab : "courses"
  );

  const switchTab = (tab: AcademicTab) => {
    setActiveTab(tab);
    router.replace(`/academic?tab=${tab}`);
  };

  // Notification Banner
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // ==========================================
  // TAB 1: COURSES STATE
  // ==========================================
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [courseSearch, setCourseSearch] = useState("");
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [courseForm, setCourseForm] = useState({
    course_code: "",
    course_name: "",
    department: "Computer Science & Engineering",
    degree_level: "B.Tech",
    total_semesters: 8,
    is_active: true,
  });

  // ==========================================
  // TAB 2: COURSE SECTIONS (CLASSES) STATE
  // ==========================================
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [loadingSections, setLoadingSections] = useState(false);
  const [sectionCourseFilter, setSectionCourseFilter] = useState("ALL");
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [sectionForm, setSectionForm] = useState({
    name: "",
    course_code: "CSE",
    semester: 7,
    batch_year: "2023-2027",
    room_number: "Room 302",
    capacity: 60,
    is_active: true,
  });

  // ==========================================
  // TAB 3: CLASSROOMS STATE
  // ==========================================
  const [classrooms, setClassrooms] = useState<ClassroomItem[]>([]);
  const [loadingClassrooms, setLoadingClassrooms] = useState(false);
  const [showClassroomModal, setShowClassroomModal] = useState(false);
  const [classroomForm, setClassroomForm] = useState({
    room_number: "",
    building: "Main Academic Complex",
    floor: 1,
    capacity: 60,
    room_type: "Lecture Hall",
    is_active: true,
  });

  // ==========================================
  // TAB 4: SUBJECTS STATE (Assigned to Course & Cards Display)
  // ==========================================
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [subjectSearch, setSubjectSearch] = useState("");
  const [subjectCourseFilter, setSubjectCourseFilter] = useState("ALL");
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [subjectForm, setSubjectForm] = useState({
    code: "",
    name: "",
    department: "Computer Science & Engineering",
    course_code: "CSE",
    semester: 7,
    credits: 4,
  });

  // ==========================================
  // TAB 5: STUDENTS STATE
  // ==========================================
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [studentForm, setStudentForm] = useState({
    student_id: "",
    full_name: "",
    email: "",
    department: "Computer Science & Engineering",
    batch_year: "2023-2027",
    semester: 7,
    section: "CS2",
    phone_number: "",
    password: "student123",
  });

  // ==========================================
  // TAB 6: FACE ENROLLMENT (ORB BIO-STUDIO)
  // ==========================================
  const [selectedStudentForEnroll, setSelectedStudentForEnroll] = useState<StudentItem | null>(null);
  type FaceAngle = "FRONT" | "LEFT" | "RIGHT";
  const [activeAngle, setActiveAngle] = useState<FaceAngle>("FRONT");
  const [capturedAngles, setCapturedAngles] = useState<{ FRONT?: string; LEFT?: string; RIGHT?: string }>({});
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [webcamActive, setWebcamActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);

  // Enrollment Filter & Search States
  const [enrollSearchInput, setEnrollSearchInput] = useState("");
  const [enrollSearchQuery, setEnrollSearchQuery] = useState("");
  const [enrollCourseFilter, setEnrollCourseFilter] = useState("ALL");
  const [enrollSemFilter, setEnrollSemFilter] = useState("ALL");
  const [enrollSectionFilter, setEnrollSectionFilter] = useState("ALL");
  const [enrollSortBy, setEnrollSortBy] = useState<"name" | "roll" | "pending_first" | "enrolled_first">("name");

  // Camera Orb Alignment & Auto-Snap State
  const [faceAligned, setFaceAligned] = useState(false);
  const [holdDuration, setHoldDuration] = useState(0);
  const [shutterFlash, setShutterFlash] = useState(false);
  const [poseFeedback, setPoseFeedback] = useState<string>("Look straight at the camera");
  const autoSnapTriggeredRef = useRef(false);
  const checkingPoseRef = useRef(false);
  const consecutiveValidChecksRef = useRef(0);

  // ==========================================
  // DATA LOADERS
  // ==========================================
  const loadCourses = async () => {
    try {
      setLoadingCourses(true);
      const res = await fetch(`${API_BASE_URL}/academic/courses`, { headers: getAuthHeaders(token) });
      if (res.ok) setCourses(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCourses(false);
    }
  };

  const loadSections = async () => {
    try {
      setLoadingSections(true);
      const res = await fetch(`${API_BASE_URL}/academic/sections`, { headers: getAuthHeaders(token) });
      if (res.ok) setSections(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSections(false);
    }
  };

  const loadClassrooms = async () => {
    try {
      setLoadingClassrooms(true);
      const res = await fetch(`${API_BASE_URL}/academic/classrooms`, { headers: getAuthHeaders(token) });
      if (res.ok) setClassrooms(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingClassrooms(false);
    }
  };

  const loadSubjects = async () => {
    try {
      setLoadingSubjects(true);
      const res = await fetch(`${API_BASE_URL}/academic/subjects`, { headers: getAuthHeaders(token) });
      if (res.ok) setSubjects(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSubjects(false);
    }
  };

  const loadStudents = async () => {
    try {
      setLoadingStudents(true);
      const res = await fetch(`${API_BASE_URL}/academic/students`, { headers: getAuthHeaders(token) });
      if (res.ok) {
        const data = await res.json();
        setStudents(data);
        if (data.length > 0 && !selectedStudentForEnroll) {
          setSelectedStudentForEnroll(data[0]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    if (activeTab === "courses") loadCourses();
    if (activeTab === "sections") {
      loadSections();
      loadCourses();
    }
    if (activeTab === "classrooms") loadClassrooms();
    if (activeTab === "subjects") {
      loadSubjects();
      loadCourses();
    }
    if (activeTab === "students" || activeTab === "enrollment") {
      loadStudents();
      loadSections();
      loadCourses();
    }
  }, [activeTab, token]);

  // ==========================================
  // ACTION HANDLERS
  // ==========================================
  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/academic/courses`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(token) },
        body: JSON.stringify(courseForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to create course.");
      setBanner({ type: "success", text: `Course ${data.code || data.course_code} created successfully.` });
      setShowCourseModal(false);
      setCourseForm({ course_code: "", course_name: "", department: "Computer Science & Engineering", degree_level: "B.Tech", total_semesters: 8, is_active: true });
      loadCourses();
    } catch (err: unknown) {
      setBanner({ type: "error", text: err instanceof Error ? err.message : "Error creating course." });
    }
  };

  const handleCreateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/academic/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(token) },
        body: JSON.stringify(sectionForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to create section.");
      setBanner({ type: "success", text: `Section ${data.course_code}-${data.name} added successfully.` });
      setShowSectionModal(false);
      setSectionForm({ name: "", course_code: "CSE", semester: 7, batch_year: "2023-2027", room_number: "Room 302", capacity: 60, is_active: true });
      loadSections();
    } catch (err: unknown) {
      setBanner({ type: "error", text: err instanceof Error ? err.message : "Error creating section." });
    }
  };

  const handleDeleteSection = async (id: number) => {
    if (!confirm("Are you sure you want to permanently delete this section?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/academic/sections/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(token),
      });
      if (res.ok) {
        setBanner({ type: "success", text: "Section deleted successfully." });
        loadSections();
      } else {
        const errData = await res.json().catch(() => ({}));
        setBanner({ type: "error", text: errData.detail || "Failed to delete section." });
      }
    } catch (err) {
      console.error(err);
      setBanner({ type: "error", text: "Network error deleting section." });
    }
  };

  const handleDeleteCourse = async (id: number, code: string) => {
    if (!confirm(`Are you sure you want to permanently delete course "${code}" and all associated sections?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/academic/courses/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(token),
      });
      if (res.ok) {
        setBanner({ type: "success", text: `Course "${code}" deleted successfully.` });
        loadCourses();
        loadSections();
      } else {
        const errData = await res.json().catch(() => ({}));
        setBanner({ type: "error", text: errData.detail || "Failed to delete course." });
      }
    } catch (err: unknown) {
      console.error(err);
      setBanner({ type: "error", text: "Network error deleting course." });
    }
  };

  const handleDeleteClassroom = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete classroom "${name}"?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/academic/classrooms/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(token),
      });
      if (res.ok) {
        setBanner({ type: "success", text: `Classroom "${name}" deleted successfully.` });
        loadClassrooms();
      } else {
        const errData = await res.json().catch(() => ({}));
        setBanner({ type: "error", text: errData.detail || "Failed to delete classroom." });
      }
    } catch (err: unknown) {
      console.error(err);
      setBanner({ type: "error", text: "Network error deleting classroom." });
    }
  };

  const handleDeleteSubject = async (id: number, code: string) => {
    if (!confirm(`Are you sure you want to permanently delete subject "${code}"?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/academic/subjects/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(token),
      });
      if (res.ok) {
        setBanner({ type: "success", text: `Subject "${code}" deleted successfully.` });
        loadSubjects();
      } else {
        const errData = await res.json().catch(() => ({}));
        setBanner({ type: "error", text: errData.detail || "Failed to delete subject." });
      }
    } catch (err: unknown) {
      console.error(err);
      setBanner({ type: "error", text: "Network error deleting subject." });
    }
  };

  const handleDeleteStudent = async (id: number, roll: string) => {
    if (!confirm(`Are you sure you want to permanently delete student "${roll}" and all biometric records?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/academic/students/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(token),
      });
      if (res.ok) {
        setBanner({ type: "success", text: `Student "${roll}" deleted successfully.` });
        loadStudents();
      } else {
        const errData = await res.json().catch(() => ({}));
        setBanner({ type: "error", text: errData.detail || "Failed to delete student." });
      }
    } catch (err: unknown) {
      console.error(err);
      setBanner({ type: "error", text: "Network error deleting student." });
    }
  };

  const handleCreateClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/academic/classrooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(token) },
        body: JSON.stringify(classroomForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to create classroom.");
      setBanner({ type: "success", text: `Classroom ${data.room_number || data.name} created successfully.` });
      setShowClassroomModal(false);
      setClassroomForm({ room_number: "", building: "Main Academic Complex", floor: 1, capacity: 60, room_type: "Lecture Hall", is_active: true });
      loadClassrooms();
    } catch (err: unknown) {
      setBanner({ type: "error", text: err instanceof Error ? err.message : "Error creating classroom." });
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/academic/subjects`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(token) },
        body: JSON.stringify({
          code: subjectForm.code.toUpperCase(),
          name: subjectForm.name,
          department: subjectForm.department,
          semester: subjectForm.semester,
          credits: subjectForm.credits,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to create subject.");
      setBanner({ type: "success", text: `Subject ${data.code} (${data.name}) created and assigned to ${data.department}.` });
      setShowSubjectModal(false);
      setSubjectForm({ code: "", name: "", department: "Computer Science & Engineering", course_code: "CSE", semester: 7, credits: 4 });
      loadSubjects();
    } catch (err: unknown) {
      setBanner({ type: "error", text: err instanceof Error ? err.message : "Error creating subject." });
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/academic/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(token) },
        body: JSON.stringify(studentForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to register student.");
      setBanner({ type: "success", text: `Student ${data.user.full_name} (${data.student_id}) enrolled.` });
      setShowStudentModal(false);
      setStudentForm({ student_id: "", full_name: "", email: "", department: "Computer Science & Engineering", batch_year: "2023-2027", semester: 7, section: "CS2", phone_number: "", password: "student123" });
      loadStudents();
    } catch (err: unknown) {
      setBanner({ type: "error", text: err instanceof Error ? err.message : "Error registering student." });
    }
  };

  // ==========================================
  // WEBCAM & AUTO-SNAP ORB LOGIC
  // ==========================================
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 640 }, facingMode: "user" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setWebcamActive(true);
        autoSnapTriggeredRef.current = false;
        setHoldDuration(0);
      }
    } catch (err) {
      setBanner({ type: "error", text: "Camera hardware access denied or not available." });
    }
  };

  const stopWebcam = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setWebcamActive(false);
    setFaceAligned(false);
    setHoldDuration(0);
  };

  const capturePhotoForAngle = (angle: FaceAngle): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 640;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Draw mirrored so captured photo matches the mirrored on-screen preview
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();

    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    setCapturedImage(dataUrl);

    // Shutter flash effect
    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 200);

    return dataUrl;
  };

  const capturePhoto = () => {
    const snap = capturePhotoForAngle(activeAngle);
    if (snap) {
      setCapturedAngles((prev) => ({ ...prev, [activeAngle]: snap }));
      if (activeAngle === "FRONT") setActiveAngle("LEFT");
      else if (activeAngle === "LEFT") setActiveAngle("RIGHT");
    }
  };

  // Realtime Center Orb Face Alignment & Multi-Angle Auto-Snap Loop
  useEffect(() => {
    if (!webcamActive) {
      setFaceAligned(false);
      setHoldDuration(0);
      autoSnapTriggeredRef.current = false;
      consecutiveValidChecksRef.current = 0;
      checkingPoseRef.current = false;
      return;
    }

    const interval = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current || checkingPoseRef.current || autoSnapTriggeredRef.current) return;
      const video = videoRef.current;
      if (video.readyState !== 4) return;

      try {
        checkingPoseRef.current = true;
        const offCanvas = document.createElement("canvas");
        offCanvas.width = 320;
        offCanvas.height = 320;
        const oCtx = offCanvas.getContext("2d");
        if (!oCtx) {
          checkingPoseRef.current = false;
          return;
        }

        // Draw mirrored sample for pose estimation
        oCtx.save();
        oCtx.translate(320, 0);
        oCtx.scale(-1, 1);
        oCtx.drawImage(video, 0, 0, 320, 320);
        oCtx.restore();

        const sampleBase64 = offCanvas.toDataURL("image/jpeg", 0.75);

        const res = await fetch(`${API_BASE_URL}/biometrics/check-pose`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_base64: sampleBase64,
            expected_pose: activeAngle,
            is_mirrored: true,
          }),
        });

        if (res.ok) {
          const result = await res.json();
          if (result.pose_matched && result.camera_clear) {
            setFaceAligned(true);
            setPoseFeedback("Perfect!");
            consecutiveValidChecksRef.current += 1;
            setHoldDuration(Math.min(1.0, consecutiveValidChecksRef.current * 0.35));

            // Must hold the turned, sharp pose for 3 consecutive checks (~1s) to eliminate motion blur
            if (consecutiveValidChecksRef.current >= 3 && !autoSnapTriggeredRef.current) {
              autoSnapTriggeredRef.current = true;
              const snapped = capturePhotoForAngle(activeAngle);
              if (snapped) {
                setCapturedAngles((curr) => {
                  const updated = { ...curr, [activeAngle]: snapped };

                  if (activeAngle === "FRONT") {
                    setTimeout(() => {
                      setActiveAngle("LEFT");
                      setHoldDuration(0);
                      setFaceAligned(false);
                      autoSnapTriggeredRef.current = false;
                      consecutiveValidChecksRef.current = 0;
                    }, 400);
                  } else if (activeAngle === "LEFT") {
                    setTimeout(() => {
                      setActiveAngle("RIGHT");
                      setHoldDuration(0);
                      setFaceAligned(false);
                      autoSnapTriggeredRef.current = false;
                      consecutiveValidChecksRef.current = 0;
                    }, 400);
                  } else if (activeAngle === "RIGHT") {
                    // ALL 3 ANGLES CAPTURED! STOP TAKING IMMEDIATELY!
                    setTimeout(() => {
                      setHoldDuration(0);
                      setFaceAligned(false);
                      autoSnapTriggeredRef.current = false;
                      consecutiveValidChecksRef.current = 0;
                      stopWebcam();
                      handleEnrollBiometrics(updated);
                    }, 400);
                  }
                  return updated;
                });
              }
            }
          } else {
            setFaceAligned(false);
            consecutiveValidChecksRef.current = 0;
            setHoldDuration(0);
            if (result.message) {
              setPoseFeedback(result.message);
            }
          }
        }
      } catch {
        // Suppress transient streaming errors
      } finally {
        checkingPoseRef.current = false;
      }
    }, 320);

    return () => clearInterval(interval);
  }, [webcamActive, activeAngle]);

  const handleEnrollBiometrics = async (anglesOverride?: { FRONT?: string; LEFT?: string; RIGHT?: string }) => {
    if (!selectedStudentForEnroll) return;
    const angles = anglesOverride || capturedAngles;
    const frontPhoto = angles.FRONT || capturedAngles.FRONT || capturedImage;
    if (!frontPhoto) return;

    setEnrolling(true);
    try {
      const frames = [angles.FRONT, angles.LEFT, angles.RIGHT].filter(Boolean) as string[];
      const res = await fetch(`${API_BASE_URL}/biometrics/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(token) },
        body: JSON.stringify({
          student_id: selectedStudentForEnroll.id,
          image_base64: frontPhoto,
          front_image_base64: frontPhoto,
          images_base64: frames.length > 0 ? frames : [frontPhoto],
        }),
      });

      const resText = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(resText);
      } catch {
        throw new Error(resText || `Biometric enrollment failed with status ${res.status}`);
      }

      if (!res.ok) throw new Error(data?.detail || "Biometric enrollment failed.");

      const cloudUrl =
        data.photo_url || `/api/academic/students/${selectedStudentForEnroll.id}/photo?t=${Date.now()}`;

      setBanner({
        type: "success",
        text: `Enrollment complete! ${selectedStudentForEnroll.user.full_name}'s FRONT side photo saved to Cloudinary CDN and registered with 128-D YuNet+SFace embeddings.`,
      });
      stopWebcam();
      setCapturedImage(cloudUrl);
      setSelectedStudentForEnroll((prev) =>
        prev
          ? {
              ...prev,
              biometric_enrolled: true,
              biometric_face_count: frames.length,
              photo_url: cloudUrl,
            }
          : null
      );
      loadStudents();
    } catch (err: unknown) {
      setBanner({ type: "error", text: err instanceof Error ? err.message : "Error enrolling biometrics." });
    } finally {
      setEnrolling(false);
    }
  };

  // Filtered & Sorted Enrollment Student List
  // Dynamic list of courses from database (courses table + sections distinct course_codes)
  const availableEnrollCourses = useMemo(() => {
    const map = new Map<string, string>();
    courses.forEach((c) => {
      const code = (c.code || c.course_code || "").trim().toUpperCase();
      const name = c.name || c.course_name || code;
      if (code) map.set(code, name);
    });
    sections.forEach((s) => {
      const code = (s.course_code || "").trim().toUpperCase();
      if (code && !map.has(code)) {
        map.set(code, code);
      }
    });
    return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
  }, [courses, sections]);

  // Dynamic list of sections from database, strictly filtered by selected course
  const availableEnrollSections = useMemo(() => {
    if (enrollCourseFilter === "ALL") {
      return sections.filter((s) => s.is_active);
    }
    const targetCourse = enrollCourseFilter.trim().toUpperCase();
    return sections.filter(
      (s) => s.is_active && (s.course_code || "").trim().toUpperCase() === targetCourse
    );
  }, [sections, enrollCourseFilter]);

  const filteredEnrollStudents = useMemo(() => {
    let list = [...students];

    if (enrollSearchQuery.trim()) {
      const q = enrollSearchQuery.toLowerCase();
      list = list.filter(
        (st) =>
          st.user.full_name.toLowerCase().includes(q) ||
          st.student_id.toLowerCase().includes(q) ||
          (st.department && st.department.toLowerCase().includes(q))
      );
    }

    if (enrollCourseFilter !== "ALL") {
      const targetCode = enrollCourseFilter.trim().toUpperCase();
      const courseObj = courses.find(
        (c) => (c.code || c.course_code || "").trim().toUpperCase() === targetCode
      );
      const courseName = (courseObj?.name || courseObj?.course_name || "").toLowerCase();

      const matchMap: Record<string, string[]> = {
        CSE: ["computer", "cse", "cs"],
        ISE: ["information", "ise", "is"],
        ECE: ["electronics", "ece", "ec"],
        EEE: ["electrical", "eee", "ee"],
        ME: ["mechanical", "me"],
        AIML: ["intelligence", "aiml", "ai"],
      };

      const targets = [
        targetCode.toLowerCase(),
        ...(matchMap[targetCode] || []),
        ...(courseName ? [courseName] : []),
      ];

      const courseSectionNames = sections
        .filter((sec) => (sec.course_code || "").trim().toUpperCase() === targetCode)
        .map((sec) => sec.name.trim().toUpperCase());

      list = list.filter((st) => {
        const d = (st.department || "").toLowerCase();
        const deptMatches = targets.some((t) => t && d.includes(t));
        if (deptMatches) return true;
        const studentSec = (st.section || "").trim().toUpperCase();
        if (studentSec && courseSectionNames.includes(studentSec)) return true;
        return false;
      });
    }

    if (enrollSemFilter !== "ALL") {
      list = list.filter((st) => st.semester === Number(enrollSemFilter));
    }

    if (enrollSectionFilter !== "ALL") {
      const targetSec = enrollSectionFilter.trim().toUpperCase();
      list = list.filter((st) => {
        const s = (st.section || "").trim().toUpperCase();
        if (!s) return false;
        if (s === targetSec) return true;
        const cleanS = s.replace(/^(SEC|SECTION)\s*/i, "").trim();
        const cleanTarget = targetSec.replace(/^(SEC|SECTION)\s*/i, "").trim();
        if (cleanS === cleanTarget) return true;
        if (targetSec === "CS1" && (s === "A" || s === "1" || s === "SEC A")) return true;
        if (targetSec === "CS2" && (s === "B" || s === "2" || s === "SEC B")) return true;
        if ((targetSec === "SEC A" || targetSec === "A") && (s === "A" || s === "CS1")) return true;
        if ((targetSec === "SEC B" || targetSec === "B") && (s === "B" || s === "CS2")) return true;
        return s.includes(targetSec) || targetSec.includes(s);
      });
    }

    // Sorting
    list.sort((a, b) => {
      if (enrollSortBy === "name") return a.user.full_name.localeCompare(b.user.full_name);
      if (enrollSortBy === "roll") return a.student_id.localeCompare(b.student_id);
      if (enrollSortBy === "pending_first") return (a.biometric_enrolled ? 1 : 0) - (b.biometric_enrolled ? 1 : 0);
      if (enrollSortBy === "enrolled_first") return (b.biometric_enrolled ? 1 : 0) - (a.biometric_enrolled ? 1 : 0);
      return 0;
    });

    return list;
  }, [students, enrollSearchQuery, enrollCourseFilter, enrollSemFilter, enrollSectionFilter, enrollSortBy, courses, sections]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner Navigation */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Building className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Academic Management Workspace
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Centrally manage degree courses, course sections/classes, classrooms, curriculum subjects, and biometrics.
          </p>
        </div>

        {/* 6 Tabs */}
        <div className="flex flex-wrap items-center p-1 bg-slate-100/90 rounded-2xl border border-slate-200 text-xs gap-0.5">
          {[
            { id: "courses", label: "Courses", icon: Building },
            { id: "sections", label: "Sections (Classes)", icon: Layers },
            { id: "classrooms", label: "Classrooms & Rooms", icon: MapPin },
            { id: "subjects", label: "Subjects Catalog", icon: BookOpen },
            { id: "students", label: "Student Directory", icon: Users },
            { id: "enrollment", label: "Face Enrollment", icon: ScanFace },
          ].map((tab) => {
            const Icon = tab.icon;
            const isCurrent = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => switchTab(tab.id as AcademicTab)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                  isCurrent
                    ? "bg-white text-blue-700 shadow-xs border border-blue-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Icon className="w-3.5 h-3.5 text-blue-600" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {banner && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center justify-between shadow-xs ${
            banner.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-rose-50 border-rose-200 text-rose-900"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {banner.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-semibold">{banner.text}</span>
          </div>
          <button onClick={() => setBanner(null)} className="text-slate-400 hover:text-slate-700 text-xs">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* =========================================================================
          TAB 1: COURSES
      ========================================================================= */}
      {activeTab === "courses" && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex items-center justify-between gap-3">
            <div className="relative w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search courses..."
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              onClick={() => setShowCourseModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Course</span>
            </button>
          </div>

          {loadingCourses ? (
            <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-blue-600 mb-2" />
              <span>Loading academic courses...</span>
            </div>
          ) : courses.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
              <span>No courses found. Click &ldquo;Create Course&rdquo; to add one.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {courses
                .filter((c) => {
                  const q = courseSearch.toLowerCase();
                  const code = (c.course_code || c.code || "").toLowerCase();
                  const name = (c.course_name || c.name || "").toLowerCase();
                  return !courseSearch || code.includes(q) || name.includes(q);
                })
                .map((course) => {
                  const code = course.code || course.course_code || "COURSE";
                  const name = course.name || course.course_name || "Academic Program";
                  const dept = course.description || course.department || "Engineering & Technology";
                  const degree = course.degree_level || "B.Tech";
                  const semesters = course.total_semesters || 8;
                  const subjects = course.subject_count ?? 8;
                  const faculty = course.faculty_count ?? 6;

                  return (
                    <div
                      key={course.id}
                      className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3 hover:border-blue-400 hover:shadow-md transition flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-lg">
                            {code}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                                course.is_active
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {course.is_active ? "Active" : "Archived"}
                            </span>
                            <button
                              onClick={() => handleDeleteCourse(course.id, code)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                              title="Delete Course"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 leading-snug">{name}</h3>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{dept}</p>
                        </div>
                      </div>

                      <div className="space-y-2 border-t border-slate-100 pt-3">
                        <div className="text-[11px] text-slate-500 flex items-center justify-between">
                          <span className="font-semibold text-slate-700">{degree} Degree</span>
                          <span>{semesters} Semesters</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100">
                          <span>{subjects} Subjects</span>
                          <span className="text-slate-300">&bull;</span>
                          <span>{faculty} Faculty Members</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button
                            onClick={() => {
                              setSectionCourseFilter(code);
                              switchTab("sections");
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition text-center"
                          >
                            View Sections
                          </button>
                          <button
                            onClick={() => {
                              setSubjectCourseFilter(code);
                              switchTab("subjects");
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition text-center"
                          >
                            View Subjects
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: COURSE SECTIONS (CLASSES e.g. CS1, CS2)
      ========================================================================= */}
      {activeTab === "sections" && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Course Filter:</span>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                {["ALL", ...availableEnrollCourses.map((c) => c.code)].map((c) => (
                  <button
                    key={c}
                    onClick={() => setSectionCourseFilter(c)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      sectionCourseFilter === c
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowSectionModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Course Section (Class)</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sections
              .filter((s) => sectionCourseFilter === "ALL" || s.course_code === sectionCourseFilter)
              .map((sec) => (
                <div
                  key={sec.id}
                  className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3 hover:border-indigo-300 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-lg">
                      {sec.course_code} - {sec.name}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Active
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Class: {sec.name} (Sem {sec.semester})
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Batch {sec.batch_year} &bull; Capacity: {sec.capacity} Students
                    </p>
                  </div>
                  <div className="text-[11px] text-slate-600 border-t border-slate-100 pt-2 flex items-center justify-between">
                    <span className="flex items-center gap-1 font-semibold text-slate-700">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{sec.room_number || "Room 302"}</span>
                    </span>
                    <button
                      onClick={() => handleDeleteSection(sec.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded-lg"
                      title="Deactivate Section"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: CLASSROOMS & ROOMS
      ========================================================================= */}
      {activeTab === "classrooms" && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Lecture Halls &amp; Laboratory Facilities
              </h3>
              <p className="text-[11px] text-slate-500">
                Physical classrooms mapped to CCTV camera sensors for automated timetable tracking.
              </p>
            </div>
            <button
              onClick={() => setShowClassroomModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Classroom</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {classrooms.map((room) => (
              <div
                key={room.id}
                className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3 hover:border-emerald-300 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg">
                    {room.room_number || "ROOM"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      Floor {room.floor || 1}
                    </span>
                    <button
                      onClick={() => handleDeleteClassroom(room.id, room.room_number || `Room ${room.id}`)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                      title="Delete Classroom"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{room.room_type || "Lecture Hall"}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{room.building}</p>
                </div>
                <div className="text-[11px] text-slate-500 font-mono border-t border-slate-100 pt-2 flex items-center justify-between">
                  <span>Capacity: {room.capacity} seats</span>
                  <span className="text-emerald-600 font-bold">CCTV Mapped</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: SUBJECTS CATALOG (ASSIGNED TO COURSES & CARDS DISPLAY)
      ========================================================================= */}
      {activeTab === "subjects" && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search subjects..."
                  value={subjectSearch}
                  onChange={(e) => setSubjectSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Course filter pills */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                {["ALL", ...availableEnrollCourses.map((c) => c.code)].map((c) => (
                  <button
                    key={c}
                    onClick={() => setSubjectCourseFilter(c)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                      subjectCourseFilter === c
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowSubjectModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Subject</span>
            </button>
          </div>

          {/* Cards Display as requested */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjects
              .filter((s) => {
                const q = subjectSearch.toLowerCase();
                const matchesSearch = !subjectSearch || s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
                const matchesCourse =
                  subjectCourseFilter === "ALL" ||
                  s.department.toUpperCase().includes(subjectCourseFilter) ||
                  s.code.toUpperCase().startsWith(subjectCourseFilter);
                return matchesSearch && matchesCourse;
              })
              .map((sub) => (
                <div
                  key={sub.id}
                  className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3 hover:border-blue-300 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-lg">
                      {sub.code}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      {sub.department || "Engineering"}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 leading-snug">{sub.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 font-medium">
                      <span>Sem {sub.semester || 1}</span>
                      <span>&bull;</span>
                      <span>{sub.credits || 4} Credits</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 truncate max-w-[80%]">
                      <span className="text-slate-400 text-[11px]">Instructor:</span>
                      <span className="font-semibold text-slate-800 truncate">
                        {sub.faculty ? sub.faculty.user.full_name : "Assigned in Timetable"}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteSubject(sub.id, sub.code)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                      title="Delete Subject"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5: STUDENT DIRECTORY
      ========================================================================= */}
      {activeTab === "students" && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search students by name or roll number..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              onClick={() => setShowStudentModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Enroll Student</span>
            </button>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-3xl shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-6">Student ID / Photo</th>
                  <th className="py-3.5 px-4">Full Name</th>
                  <th className="py-3.5 px-4">Program &amp; Section</th>
                  <th className="py-3.5 px-4">Biometric Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students
                  .filter(
                    (st) =>
                      !studentSearch ||
                      st.student_id.toLowerCase().includes(studentSearch.toLowerCase()) ||
                      st.user.full_name.toLowerCase().includes(studentSearch.toLowerCase())
                  )
                  .map((st) => (
                    <tr key={st.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3.5 px-6 font-mono font-bold text-slate-800">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0 shadow-2xs">
                            <img
                              src={
                                st.photo_url && st.photo_url.startsWith("http")
                                  ? st.photo_url
                                  : `/api/academic/students/${st.id}/photo?v=${st.id}`
                              }
                              alt={st.user.full_name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" fill="%232563eb" rx="10"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="white" font-weight="bold" font-family="sans-serif" font-size="14">${st.user.full_name.slice(0, 2).toUpperCase()}</text></svg>`;
                              }}
                            />
                          </div>
                          <span className="font-mono text-xs">{st.student_id}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{st.user.full_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{st.user.email}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {st.department} &bull; Sem {st.semester} - Sec {st.section}
                      </td>
                      <td className="py-3.5 px-4">
                        {st.biometric_enrolled ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 text-[10px]">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Enrolled ({st.biometric_face_count || 1} angles)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-200 text-[10px]">
                            <ScanFace className="w-3 h-3 text-amber-600" />
                            <span>Pending Enrollment</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedStudentForEnroll(st);
                              switchTab("enrollment");
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-blue-700 font-bold text-xs transition cursor-pointer"
                          >
                            <ScanFace className="w-3.5 h-3.5" />
                            <span>{st.biometric_enrolled ? "Retrain Faces" : "Capture Face"}</span>
                          </button>
                          <button
                            onClick={() => handleDeleteStudent(st.id, st.student_id)}
                            className="p-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition cursor-pointer"
                            title="Delete Student Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 6: BIOMETRIC FACE ENROLLMENT STUDIO (WITH TARGET ORB & AUTO-SNAP)
      ========================================================================= */}
      {activeTab === "enrollment" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Col 1: Student Selector (4 cols) with Filters, Sort, and Search Button */}
          <div className="lg:col-span-4 bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-600" />
                <span>Select Student to Enroll</span>
              </h3>
              <span className="text-[10px] font-mono font-bold text-slate-500">
                {filteredEnrollStudents.length} Found
              </span>
            </div>

            {/* Search Bar with Search Button */}
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search name or roll..."
                  value={enrollSearchInput}
                  onChange={(e) => setEnrollSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setEnrollSearchQuery(enrollSearchInput);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                onClick={() => setEnrollSearchQuery(enrollSearchInput)}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition"
              >
                Search
              </button>
            </div>

            {/* Filters: Course, Sem, Section (Dynamic & Course-Dependent) */}
            <div className="grid grid-cols-3 gap-1.5 text-[11px]">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Course</label>
                <select
                  value={enrollCourseFilter}
                  onChange={(e) => {
                    const newCourse = e.target.value;
                    setEnrollCourseFilter(newCourse);
                    setEnrollSectionFilter("ALL"); // Reset section when course changes
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1 text-slate-800 font-semibold"
                >
                  <option value="ALL">All Courses</option>
                  {availableEnrollCourses.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Sem</label>
                <select
                  value={enrollSemFilter}
                  onChange={(e) => setEnrollSemFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1 text-slate-800 font-semibold"
                >
                  <option value="ALL">All</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <option key={s} value={s}>
                      Sem {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Section</label>
                <select
                  value={enrollSectionFilter}
                  onChange={(e) => setEnrollSectionFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1 text-slate-800 font-semibold"
                >
                  <option value="ALL">All Sections</option>
                  {availableEnrollSections.length > 0 ? (
                    availableEnrollSections.map((s) => (
                      <option key={s.id} value={s.name}>
                        {enrollCourseFilter === "ALL" ? `${s.course_code}-${s.name}` : s.name}
                      </option>
                    ))
                  ) : (
                    <option disabled value="">
                      {enrollCourseFilter === "ALL" ? "No sections" : `No sections for ${enrollCourseFilter}`}
                    </option>
                  )}
                </select>
              </div>
            </div>

            {/* Sort Options */}
            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
              <span className="text-slate-400 font-semibold">Sort By:</span>
              <select
                value={enrollSortBy}
                onChange={(e) => setEnrollSortBy(e.target.value as any)}
                className="bg-transparent font-bold text-blue-600 focus:outline-none"
              >
                <option value="name">Name (A-Z)</option>
                <option value="roll">Roll Number</option>
                <option value="pending_first">Not Enrolled First</option>
                <option value="enrolled_first">Enrolled First</option>
              </select>
            </div>

            {/* Student List */}
            <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
              {filteredEnrollStudents.map((st) => {
                const isSelected = selectedStudentForEnroll?.id === st.id;
                return (
                  <div
                    key={st.id}
                    onClick={() => {
                      setSelectedStudentForEnroll(st);
                      setCapturedImage(null);
                      setCapturedAngles({});
                      setActiveAngle("FRONT");
                    }}
                    className={`p-2 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-2.5 ${
                      isSelected
                        ? "bg-blue-50/90 border-blue-400 ring-2 ring-blue-500/15"
                        : "bg-slate-50/60 border-slate-200/80 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Student Square Face Avatar */}
                      <div className="relative shrink-0">
                        <div
                          className={`p-[1.5px] rounded-xl transition-all ${
                            st.biometric_enrolled
                              ? "bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 shadow-2xs"
                              : "bg-slate-200"
                          }`}
                        >
                          <div className="w-8 h-8 rounded-lg overflow-hidden bg-white p-[1px] flex items-center justify-center">
                            {st.biometric_enrolled ? (
                              <img
                                src={
                                  st.photo_url && st.photo_url.startsWith("http")
                                    ? st.photo_url
                                    : `/api/academic/students/${st.id}/photo?v=${st.id}`
                                }
                                alt={st.user.full_name}
                                className="w-full h-full rounded-md object-cover"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" fill="%232563eb" rx="6"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="white" font-weight="bold" font-family="sans-serif" font-size="11">${st.user.full_name.slice(0, 2).toUpperCase()}</text></svg>`;
                                }}
                              />
                            ) : (
                              <div className="w-full h-full rounded-md bg-slate-100 flex items-center justify-center text-slate-400">
                                <User className="w-4 h-4 text-slate-300" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">{st.user.full_name}</div>
                        <div className="text-[10px] font-mono text-blue-700">
                          {st.student_id} &bull; {st.section}
                        </div>
                      </div>
                    </div>
                    {st.biometric_enrolled ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" title="Enrolled" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" title="Pending" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Col 2: Circular Head-Turn Biometric Studio (5 cols) matching reference image */}
          <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs flex flex-col justify-between relative overflow-hidden">
            {/* Header: Title + Help Link */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                  <ScanFace className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-none">Biometric Face Registration</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">3-Angle Multi-Pose Face ID &bull; SFace 128-D</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    alert(
                      "Keep your head steady inside the circle. Slowly turn your head to the indicated direction (Left, Right, or Front) until the ring turns green and captures automatically."
                    )
                  }
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer px-2.5 py-1 rounded-lg hover:bg-slate-100"
                >
                  Help
                </button>
              </div>
            </div>

            {/* Central Stage */}
            <div className="flex-1 flex flex-col items-center justify-center py-6 space-y-6">
              {!webcamActive && (capturedImage || (selectedStudentForEnroll?.photo_url && selectedStudentForEnroll.photo_url.startsWith("http"))) ? (
                /* 1. SQUARE SAVED FACE DISPLAY: Full face clearly visible */
                <div className="flex flex-col items-center justify-center space-y-4">
                  <div className="w-56 h-56 sm:w-64 sm:h-64 rounded-2xl overflow-hidden relative shadow-lg bg-slate-100 border-2 border-slate-300 flex items-center justify-center">
                    <img
                      src={
                        capturedImage ||
                        (selectedStudentForEnroll?.photo_url && selectedStudentForEnroll.photo_url.startsWith("http")
                          ? selectedStudentForEnroll.photo_url
                          : `/api/academic/students/${selectedStudentForEnroll?.id}/photo?t=${Date.now()}`)
                      }
                      alt={selectedStudentForEnroll?.user.full_name || "Enrolled Face"}
                      className="w-full h-full object-cover object-center"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" fill="%232563eb" rx="16"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="white" font-weight="bold" font-family="sans-serif" font-size="36">${(selectedStudentForEnroll?.user.full_name || "ST").slice(0, 2).toUpperCase()}</text></svg>`;
                      }}
                    />
                    <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-slate-950/80 via-slate-900/40 to-transparent flex items-center justify-between text-white">
                      <span className="text-[11px] font-bold flex items-center gap-1.5 text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Enrolled Face (Square)
                      </span>
                      <span className="text-[10px] font-mono text-slate-300">Complete Portrait</span>
                    </div>
                  </div>

                  <div className="text-center space-y-1">
                    <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                      Biometric Face Enrolled
                    </h2>
                    <p className="text-xs md:text-sm text-slate-500 font-normal max-w-sm mx-auto">
                      Complete front-angle square portrait registered and stored to Cloudinary CDN for Campus ID card.
                    </p>
                  </div>
                </div>
              ) : (
                /* 2. Live Camera Head-Turn Guidance (or Idle without photo) */
                <>
                  <div className="relative w-64 h-64 sm:w-72 sm:h-72 md:w-80 md:h-80 flex items-center justify-center">
                    {/* SVG Segmented Circular Ring around Video */}
                    <svg
                      className="absolute inset-0 w-full h-full pointer-events-none z-10"
                      viewBox="0 0 240 240"
                    >
                      {/* Segment 1: Front / Top Arc */}
                      <circle
                        cx="120"
                        cy="120"
                        r="108"
                        fill="none"
                        stroke={
                          capturedAngles.FRONT || (activeAngle === "FRONT" && faceAligned)
                            ? "#10b981"
                            : "#cbd5e1"
                        }
                        strokeWidth="7"
                        strokeDasharray="180 500"
                        strokeDashoffset="135"
                        strokeLinecap="round"
                        className="transition-colors duration-300"
                      />

                      {/* Segment 2: Left Arc */}
                      <circle
                        cx="120"
                        cy="120"
                        r="108"
                        fill="none"
                        stroke={
                          capturedAngles.LEFT || (activeAngle === "LEFT" && faceAligned)
                            ? "#10b981"
                            : "#cbd5e1"
                        }
                        strokeWidth="7"
                        strokeDasharray="180 500"
                        strokeDashoffset="-90"
                        strokeLinecap="round"
                        className="transition-colors duration-300"
                      />

                      {/* Segment 3: Right Arc */}
                      <circle
                        cx="120"
                        cy="120"
                        r="108"
                        fill="none"
                        stroke={
                          capturedAngles.RIGHT || (activeAngle === "RIGHT" && faceAligned)
                            ? "#10b981"
                            : "#cbd5e1"
                        }
                        strokeWidth="7"
                        strokeDasharray="180 500"
                        strokeDashoffset="-315"
                        strokeLinecap="round"
                        className="transition-colors duration-300"
                      />
                    </svg>

                    {/* Inner Video / Photo Circle */}
                    <div className="w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 rounded-full overflow-hidden relative shadow-inner bg-slate-100 border border-slate-200 flex items-center justify-center">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover scale-x-[-1] ${webcamActive ? "block" : "hidden"}`}
                      />

                      {/* Shutter White Flash */}
                      {shutterFlash && (
                        <div className="absolute inset-0 bg-white z-40 animate-out fade-out duration-200 pointer-events-none" />
                      )}

                      {!webcamActive && (
                        <div className="flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                          <User className="w-16 h-16 text-slate-300 mb-1" />
                          <span className="text-[11px] font-semibold text-slate-500">Camera Inactive</span>
                          <span className="text-[10px] text-slate-400">Click &quot;Start Camera&quot; to begin</span>
                        </div>
                      )}

                      {/* Holding progress circle overlay */}
                      {webcamActive && faceAligned && (
                        <div className="absolute inset-0 bg-emerald-500/10 border-4 border-emerald-400 rounded-full animate-pulse pointer-events-none" />
                      )}
                    </div>

                    {/* Guidance Indicator Badges on Circle Perimeter */}
                    {/* 1. LEFT Indicator */}
                    <div className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 z-20">
                      {capturedAngles.LEFT || (activeAngle === "LEFT" && faceAligned) ? (
                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg border-2 border-white transition-all transform scale-110">
                          <Check className="w-5 h-5 sm:w-6 sm:h-6 stroke-[3]" />
                        </div>
                      ) : activeAngle === "LEFT" ? (
                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white text-slate-800 flex items-center justify-center shadow-md border-2 border-slate-700 animate-pulse">
                          <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
                        </div>
                      ) : null}
                    </div>

                    {/* 2. RIGHT Indicator */}
                    <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 z-20">
                      {capturedAngles.RIGHT || (activeAngle === "RIGHT" && faceAligned) ? (
                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg border-2 border-white transition-all transform scale-110">
                          <Check className="w-5 h-5 sm:w-6 sm:h-6 stroke-[3]" />
                        </div>
                      ) : activeAngle === "RIGHT" ? (
                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white text-slate-800 flex items-center justify-center shadow-md border-2 border-slate-700 animate-pulse">
                          <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
                        </div>
                      ) : null}
                    </div>

                    {/* 3. FRONT Indicator */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                      {capturedAngles.FRONT || (activeAngle === "FRONT" && faceAligned) ? (
                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg border-2 border-white transition-all transform scale-110">
                          <Check className="w-5 h-5 sm:w-6 sm:h-6 stroke-[3]" />
                        </div>
                      ) : activeAngle === "FRONT" ? (
                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white text-slate-800 flex items-center justify-center shadow-md border-2 border-slate-700">
                          <ScanFace className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Dynamic Guidance Typography Below Circle */}
                  <div className="text-center space-y-1">
                    {faceAligned || Boolean(capturedAngles[activeAngle]) ? (
                      <h2 className="text-xl md:text-2xl font-bold text-emerald-600 tracking-tight">
                        Perfect!
                      </h2>
                    ) : (
                      <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
                        {poseFeedback || (activeAngle === "LEFT"
                          ? "Slowly turn your head to the left"
                          : activeAngle === "RIGHT"
                          ? "Slowly turn your head to the right"
                          : "Look straight at the camera")}
                      </h2>
                    )}

                    <p className="text-xs md:text-sm text-slate-500 font-normal max-w-sm mx-auto">
                      Hold steady and align your head within the ring. The ring turns green once sharp and properly turned.
                    </p>
                  </div>

                  {/* 3 Steps Progress Chips */}
                  <div className="flex items-center justify-center gap-2">
                    {(["FRONT", "LEFT", "RIGHT"] as const).map((ang, idx) => {
                      const isDone = Boolean(capturedAngles[ang]);
                      const isCurrent = activeAngle === ang;
                      return (
                        <div
                          key={ang}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition ${
                            isDone
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-300"
                              : isCurrent
                              ? "bg-blue-50 text-blue-700 border border-blue-300 shadow-xs"
                              : "bg-slate-100 text-slate-400 border border-slate-200"
                          }`}
                        >
                          {isDone ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          )}
                          <span>
                            {idx + 1}. {ang === "FRONT" ? "Front" : ang === "LEFT" ? "Left" : "Right"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <canvas ref={canvasRef} className="hidden" />

            {/* Bottom Controls */}
            <div className="pt-3 border-t border-slate-100 flex items-center gap-3">
              {!webcamActive ? (
                <button
                  type="button"
                  onClick={startWebcam}
                  disabled={!selectedStudentForEnroll}
                  className="flex-1 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Camera className="w-4 h-4" />
                  <span>Start Camera &amp; Auto-Capture</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopWebcam}
                  className="flex-1 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  <span>Stop Camera</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setCapturedAngles({});
                  setActiveAngle("FRONT");
                  startWebcam();
                }}
                disabled={!selectedStudentForEnroll}
                className="py-3 px-4 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Restart 3-angle capture sequence"
              >
                <RotateCw className="w-3.5 h-3.5 text-slate-500" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Col 3: Student Smart Campus ID Card with Cloudinary Front Photo (3 cols) */}
          <div className="lg:col-span-3 space-y-4">
            <div className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Student Smart ID Card
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  disabled={!selectedStudentForEnroll}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-40"
                  title="Print official student card"
                >
                  <Printer className="w-3 h-3 text-slate-500" />
                  <span>Print</span>
                </button>
              </div>

              {selectedStudentForEnroll ? (
                <div className="space-y-4">
                  {/* The Physical Smart ID Card */}
                  <div className="rounded-2xl border border-blue-200/90 bg-white shadow-md overflow-hidden relative">
                    {/* Card Header Band */}
                    <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 px-4 py-3 text-white flex items-center justify-between">
                      <div>
                        <div className="text-[8px] tracking-widest font-extrabold uppercase text-blue-200">
                          METROPOLITAN UNIVERSITY
                        </div>
                        <div className="text-xs font-extrabold tracking-wide">SMART CAMPUS PASS</div>
                      </div>
                      <div className="w-6 h-6 rounded-lg bg-white/15 flex items-center justify-center text-[10px] font-bold text-white border border-white/20">
                        MU
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-4 space-y-3 bg-gradient-to-b from-white to-slate-50/60">
                      <div className="flex items-start gap-3">
                        {/* Student Front Photo from Cloudinary (Square, Complete Face Visible) */}
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-slate-100 border-2 border-slate-300 flex flex-col items-center justify-center shrink-0 overflow-hidden shadow-sm relative">
                          {capturedAngles.FRONT ||
                          capturedImage ||
                          (selectedStudentForEnroll.photo_url && selectedStudentForEnroll.photo_url.startsWith("http")) ? (
                            <img
                              src={
                                capturedAngles.FRONT ||
                                (selectedStudentForEnroll.photo_url && selectedStudentForEnroll.photo_url.startsWith("http")
                                  ? selectedStudentForEnroll.photo_url
                                  : capturedImage ||
                                    `/api/academic/students/${selectedStudentForEnroll.id}/photo?t=${Date.now()}`)
                              }
                              alt={selectedStudentForEnroll.user.full_name}
                              className="w-full h-full object-cover object-center"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" fill="%232563eb" rx="12"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="white" font-weight="bold" font-family="sans-serif" font-size="28">${selectedStudentForEnroll.user.full_name.slice(0, 2).toUpperCase()}</text></svg>`;
                              }}
                            />
                          ) : (
                            <div className="text-center p-1">
                              <User className="w-8 h-8 text-slate-400 mx-auto" />
                              <span className="text-[8px] font-mono font-bold text-slate-400 uppercase">FRONT PHOTO</span>
                            </div>
                          )}
                        </div>

                        {/* Student Bio Details */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="text-xs font-extrabold text-slate-900 truncate">
                            {selectedStudentForEnroll.user.full_name}
                          </div>
                          <div className="text-[11px] font-mono font-bold text-blue-600">
                            {selectedStudentForEnroll.student_id}
                          </div>
                          <div className="text-[10px] text-slate-600 truncate font-medium">
                            {selectedStudentForEnroll.department}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            Sem {selectedStudentForEnroll.semester} &bull; Sec {selectedStudentForEnroll.section}
                          </div>
                        </div>
                      </div>

                      {/* Security Microchip Graphic & Cloudinary Badge */}
                      <div className="flex items-center justify-between pt-1">
                        <div className="w-8 h-6 rounded bg-gradient-to-br from-amber-200 via-amber-300 to-amber-500 border border-amber-600/40 flex items-center justify-center shadow-2xs">
                          <div className="w-5 h-4 border border-amber-700/30 rounded-xs flex flex-col justify-between py-0.5">
                            <div className="h-[1px] bg-amber-700/40 w-full" />
                            <div className="h-[1px] bg-amber-700/40 w-full" />
                          </div>
                        </div>

                        <span className="text-[9px] font-mono text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 flex items-center gap-1 font-semibold">
                          <Cloud className="w-2.5 h-2.5 text-sky-600" />
                          <span>Cloudinary CDN</span>
                        </span>
                      </div>

                      {/* Scannable Barcode Strip on White Container */}
                      <div className="pt-2 border-t border-slate-100 text-center">
                        <div className="bg-white p-2 rounded-xl border border-slate-200 inline-block my-1 shadow-2xs">
                          <svg className="w-40 h-8" viewBox="0 0 160 30">
                            {selectedStudentForEnroll.student_id.split("").map((char, i) => {
                              const w = (char.charCodeAt(0) % 3) + 1;
                              return (
                                <rect
                                  key={i}
                                  x={i * 14 + 10}
                                  y="0"
                                  width={w * 2}
                                  height="30"
                                  fill="#0f172a"
                                />
                              );
                            })}
                          </svg>
                        </div>
                        <div className="text-[10px] font-mono font-bold text-slate-600 tracking-widest mt-0.5">
                          *{selectedStudentForEnroll.student_id}*
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Multi-Angle Status Verification Strip */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Enrolled Biometric Angles
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {(["FRONT", "LEFT", "RIGHT"] as const).map((ang) => {
                        const hasImg = Boolean(capturedAngles[ang]);
                        const isEnrolled = selectedStudentForEnroll.biometric_enrolled || hasImg;
                        return (
                          <div
                            key={ang}
                            className={`p-2 rounded-xl border text-center transition ${
                              isEnrolled
                                ? "bg-emerald-50/80 border-emerald-300 text-emerald-800"
                                : "bg-white border-slate-200 text-slate-400"
                            }`}
                          >
                            <div className="flex items-center justify-center mb-1">
                              {isEnrolled ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <div className="w-4 h-4 rounded-full border border-slate-300" />
                              )}
                            </div>
                            <span className="text-[9px] font-bold block">{ang}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 space-y-2 text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-100 border-2 border-dashed border-slate-200 mx-auto flex items-center justify-center text-slate-300">
                    <CreditCard className="w-8 h-8" />
                  </div>
                  <p className="text-xs font-bold text-slate-700">Select a Student</p>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    Choose a student on the left to view their official Smart Campus ID Card and begin 3-angle enrollment.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODALS
      ========================================================================= */}
      {/* 1. Create Course Modal */}
      {showCourseModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Create Academic Course</h3>
              <button onClick={() => setShowCourseModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <form onSubmit={handleCreateCourse} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Course Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CSE, ECE, ME"
                  value={courseForm.course_code}
                  onChange={(e) => setCourseForm({ ...courseForm, course_code: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono uppercase"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Course Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Computer Science & Engineering"
                  value={courseForm.course_name}
                  onChange={(e) => setCourseForm({ ...courseForm, course_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Degree</label>
                  <select
                    value={courseForm.degree_level}
                    onChange={(e) => setCourseForm({ ...courseForm, degree_level: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  >
                    <option value="B.Tech">B.Tech</option>
                    <option value="M.Tech">M.Tech</option>
                    <option value="B.Sc">B.Sc</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Semesters</label>
                  <input
                    type="number"
                    value={courseForm.total_semesters}
                    onChange={(e) => setCourseForm({ ...courseForm, total_semesters: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowCourseModal(false)} className="px-4 py-2 rounded-xl text-slate-600">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold">Save Course</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Add Course Section (Class e.g. CS1, CS2) Modal */}
      {showSectionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Add Course Section (Class)</h3>
              <button onClick={() => setShowSectionModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <form onSubmit={handleCreateSection} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Course</label>
                  <select
                    value={sectionForm.course_code}
                    onChange={(e) => setSectionForm({ ...sectionForm, course_code: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold"
                  >
                    {availableEnrollCourses.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} - {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Section Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CS1, CS2, Sec A"
                    value={sectionForm.name}
                    onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Semester</label>
                  <select
                    value={sectionForm.semester}
                    onChange={(e) => setSectionForm({ ...sectionForm, semester: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={s}>
                        Semester {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Academic Batch</label>
                  <input
                    type="text"
                    value={sectionForm.batch_year}
                    onChange={(e) => setSectionForm({ ...sectionForm, batch_year: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Assigned Room</label>
                  <input
                    type="text"
                    placeholder="e.g. Room 302"
                    value={sectionForm.room_number}
                    onChange={(e) => setSectionForm({ ...sectionForm, room_number: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Capacity</label>
                  <input
                    type="number"
                    value={sectionForm.capacity}
                    onChange={(e) => setSectionForm({ ...sectionForm, capacity: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowSectionModal(false)} className="px-4 py-2 rounded-xl text-slate-600">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold">Save Section</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Create Classroom Modal */}
      {showClassroomModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Add Physical Classroom</h3>
              <button onClick={() => setShowClassroomModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <form onSubmit={handleCreateClassroom} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Room Number / ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Room 302, Lab 1"
                  value={classroomForm.room_number}
                  onChange={(e) => setClassroomForm({ ...classroomForm, room_number: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Building</label>
                  <input
                    type="text"
                    value={classroomForm.building}
                    onChange={(e) => setClassroomForm({ ...classroomForm, building: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Capacity</label>
                  <input
                    type="number"
                    value={classroomForm.capacity}
                    onChange={(e) => setClassroomForm({ ...classroomForm, capacity: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowClassroomModal(false)} className="px-4 py-2 rounded-xl text-slate-600">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold">Save Classroom</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Create Subject Modal (With Course Assignment) */}
      {showSubjectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Create &amp; Assign Subject to Course</h3>
              <button onClick={() => setShowSubjectModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <form onSubmit={handleCreateSubject} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Assign to Course</label>
                <select
                  value={subjectForm.department}
                  onChange={(e) => setSubjectForm({ ...subjectForm, department: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold"
                >
                  <option value="Computer Science & Engineering">Computer Science & Engineering (CSE)</option>
                  <option value="Information Science & Engineering">Information Science & Engineering (ISE)</option>
                  <option value="Electronics & Communication">Electronics & Communication (ECE)</option>
                  <option value="Electrical & Electronics">Electrical & Electronics (EEE)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Subject Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BCS701, CS301"
                    value={subjectForm.code}
                    onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Semester</label>
                  <input
                    type="number"
                    value={subjectForm.semester}
                    onChange={(e) => setSubjectForm({ ...subjectForm, semester: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Subject Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Internet of Things, Parallel Computing"
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Credits</label>
                <input
                  type="number"
                  value={subjectForm.credits}
                  onChange={(e) => setSubjectForm({ ...subjectForm, credits: Number(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowSubjectModal(false)} className="px-4 py-2 rounded-xl text-slate-600">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold">Save Subject</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Enroll Student Modal */}
      {showStudentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Enroll New Student Record</h3>
              <button onClick={() => setShowStudentModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <form onSubmit={handleCreateStudent} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Roll / Student ID</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CS-2024-007"
                    value={studentForm.student_id}
                    onChange={(e) => setStudentForm({ ...studentForm, student_id: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Student Name"
                    value={studentForm.full_name}
                    onChange={(e) => setStudentForm({ ...studentForm, full_name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Email</label>
                  <input
                    type="email"
                    required
                    placeholder="student@college.edu"
                    value={studentForm.email}
                    onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Phone</label>
                  <input
                    type="text"
                    placeholder="+91 98765 43210"
                    value={studentForm.phone_number}
                    onChange={(e) => setStudentForm({ ...studentForm, phone_number: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Course</label>
                  <select
                    value={studentForm.department}
                    onChange={(e) => setStudentForm({ ...studentForm, department: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  >
                    <option value="Computer Science & Engineering">CSE</option>
                    <option value="Information Science & Engineering">ISE</option>
                    <option value="Electronics & Communication">ECE</option>
                    <option value="Electrical & Electronics">EEE</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Semester</label>
                  <input
                    type="number"
                    value={studentForm.semester}
                    onChange={(e) => setStudentForm({ ...studentForm, semester: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Section</label>
                  <select
                    value={studentForm.section}
                    onChange={(e) => setStudentForm({ ...studentForm, section: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  >
                    {sections.length > 0 ? (
                      sections
                        .filter((s) => s.is_active)
                        .map((s) => (
                          <option key={s.id} value={s.name}>
                            {s.course_code}-{s.name} (Sem {s.semester})
                          </option>
                        ))
                    ) : (
                      <option value="A">Section A</option>
                    )}
                  </select>
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowStudentModal(false)} className="px-4 py-2 rounded-xl text-slate-600">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold">Register Student</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AcademicManagementPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Loading Academic Workspace...</div>}>
      <AcademicManagementContent />
    </Suspense>
  );
}
