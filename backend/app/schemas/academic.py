from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from app.schemas.user import UserResponse

# ----------------- STUDENT SCHEMAS -----------------
class StudentBase(BaseModel):
    student_id: str
    department: str
    batch_year: str
    semester: int = 1
    section: str = "A"
    photo_url: Optional[str] = None

class StudentCreate(StudentBase):
    email: str
    full_name: str
    password: str = "student123"
    phone_number: Optional[str] = None

class StudentUpdate(BaseModel):
    department: Optional[str] = None
    batch_year: Optional[str] = None
    semester: Optional[int] = None
    section: Optional[str] = None
    photo_url: Optional[str] = None
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    is_active: Optional[bool] = None

class StudentResponse(StudentBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    biometric_enrolled: bool
    biometric_face_count: int
    created_at: datetime
    updated_at: datetime
    user: Optional[UserResponse] = None

# ----------------- FACULTY SCHEMAS -----------------
class FacultyBase(BaseModel):
    employee_id: str
    department: str
    designation: str = "Assistant Professor"
    office_location: Optional[str] = None
    is_class_teacher: bool = False
    class_teacher_section: Optional[str] = None
    class_teacher_semester: Optional[int] = None

class FacultyCreate(FacultyBase):
    email: str
    full_name: str
    password: str = "faculty123"
    phone_number: Optional[str] = None

class FacultyUpdate(BaseModel):
    department: Optional[str] = None
    designation: Optional[str] = None
    office_location: Optional[str] = None
    is_class_teacher: Optional[bool] = None
    class_teacher_section: Optional[str] = None
    class_teacher_semester: Optional[int] = None
    full_name: Optional[str] = None
    phone_number: Optional[str] = None

class SubjectMini(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    name: str
    department: str
    semester: int = 1
    credits: int = 3

class FacultyResponse(FacultyBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    user: Optional[UserResponse] = None
    subjects: Optional[List[SubjectMini]] = None

class FacultyAssignSubjectRequest(BaseModel):
    subject_id: int

# ----------------- SUBJECT SCHEMAS -----------------
class SubjectBase(BaseModel):
    code: str
    name: str
    department: str
    semester: int = 1
    credits: int = 3
    faculty_id: Optional[int] = None

class SubjectCreate(SubjectBase):
    pass

class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    semester: Optional[int] = None
    credits: Optional[int] = None
    faculty_id: Optional[int] = None

class SubjectResponse(SubjectBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
    faculty: Optional[FacultyResponse] = None

# ----------------- ENROLLMENT SCHEMAS -----------------
class EnrollmentCreate(BaseModel):
    student_id: int
    subject_id: int
    academic_year: str = "2026-2027"

class EnrollmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    subject_id: int
    academic_year: str
    status: str
    created_at: datetime
    student: Optional[StudentResponse] = None
    subject: Optional[SubjectResponse] = None

# ----------------- MY CLASSROOM SCHEMAS -----------------
class ClassroomTeacherInfo(BaseModel):
    id: int
    employee_id: str
    name: str
    email: str
    phone_number: Optional[str] = None
    department: str
    designation: str
    office_location: Optional[str] = None
    is_class_teacher: bool = False
    subjects_taught: List[str] = []
    weekly_periods: int = 0

class ClassroomSubjectInfo(BaseModel):
    id: int
    code: str
    name: str
    department: str
    semester: int
    credits: int
    faculty_id: Optional[int] = None
    faculty_name: Optional[str] = None

class ClassroomTimeSlot(BaseModel):
    period: int
    start_time: str
    end_time: str
    label: str

class ClassroomTimetableSlot(BaseModel):
    id: int
    period_number: int
    start_time: str
    end_time: str
    subject_code: Optional[str] = None
    subject_name: Optional[str] = None
    classroom: str
    teacher_name: Optional[str] = None
    teacher_email: Optional[str] = None
    day_of_week: str
    is_recurring: bool = True

class ClassroomStudentItem(BaseModel):
    id: int
    student_id: str
    full_name: str
    email: str
    phone_number: Optional[str] = None
    department: str
    semester: int
    section: str
    batch_year: str
    biometric_enrolled: bool
    biometric_face_count: int = 0
    photo_url: Optional[str] = None
    enrolled_subjects_count: int = 0
    enrolled_subject_names: List[str] = []

class ClassroomOverviewResponse(BaseModel):
    monitored_class: dict
    available_sections: List[str]
    available_semesters: List[int]
    stats: dict
    teachers: List[ClassroomTeacherInfo]
    subjects: List[ClassroomSubjectInfo]
    time_slots: List[ClassroomTimeSlot]
    timetable_grid: dict
    students: List[ClassroomStudentItem]

class ClassroomAddStudentRequest(BaseModel):
    student_id: str
    full_name: str
    email: str
    phone_number: Optional[str] = None
    password: str = "student123"
    department: Optional[str] = None
    semester: Optional[int] = None
    section: Optional[str] = None
    batch_year: Optional[str] = "2023-2027"
    auto_enroll_subjects: bool = True

# ----------------- COURSE & DEPARTMENT SCHEMAS -----------------
class CourseBase(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    is_active: bool = True

class CourseCreate(CourseBase):
    pass

class CourseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class CourseResponse(CourseBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
    student_count: Optional[int] = 0
    faculty_count: Optional[int] = 0
    subject_count: Optional[int] = 0

# ----------------- CLASSROOM LOCATION SCHEMAS -----------------
class ClassroomBase(BaseModel):
    name: str
    building: str = "Main Academic Block"
    capacity: int = 60
    is_active: bool = True

class ClassroomCreate(ClassroomBase):
    pass

class ClassroomUpdate(BaseModel):
    building: Optional[str] = None
    capacity: Optional[int] = None
    is_active: Optional[bool] = None

class ClassroomResponse(ClassroomBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
    camera_id: Optional[int] = None
    camera_name: Optional[str] = None

# ----------------- CLASS TEACHER ASSIGNMENT SCHEMAS -----------------
class ClassTeacherAssignRequest(BaseModel):
    department: str
    semester: int
    section: str

# ----------------- ATTENDANCE ANALYTICS SCHEMAS -----------------
class StudentAnalyticsItem(BaseModel):
    student_id: int
    roll_number: str
    student_name: str
    department: str
    semester: int
    section: str
    sessions_held: int
    sessions_attended: int
    attendance_percentage: float
    shortage_amount: float
    is_shortage: bool

class SubjectAnalyticsItem(BaseModel):
    subject_id: int
    code: str
    name: str
    department: str
    semester: int
    faculty_name: Optional[str] = None
    total_sessions: int
    average_attendance_percentage: float

class SectionAnalyticsItem(BaseModel):
    section: str
    semester: int
    department: str
    total_students: int
    average_attendance_percentage: float

class AttendanceAnalyticsResponse(BaseModel):
    department: str
    total_enrolled: int
    overall_attendance_pct: float
    total_qualifying_sessions: int
    total_attendances: int
    shortage_count: int
    threshold_pct: float
    students: List[StudentAnalyticsItem]
    sections_summary: List[SectionAnalyticsItem]
    subjects_summary: List[SubjectAnalyticsItem]


# ----------------- SECTION SCHEMAS -----------------
class SectionBase(BaseModel):
    name: str  # e.g., "CS1", "CS2", "Sec A"
    course_code: str  # e.g., "CSE", "ECE", "ISE", "EEE"
    semester: int = 1
    batch_year: str = "2023-2027"
    room_number: Optional[str] = "Room 302"
    capacity: int = 60
    is_active: bool = True

class SectionCreate(SectionBase):
    pass

class SectionUpdate(BaseModel):
    name: Optional[str] = None
    course_code: Optional[str] = None
    semester: Optional[int] = None
    batch_year: Optional[str] = None
    room_number: Optional[str] = None
    capacity: Optional[int] = None
    is_active: Optional[bool] = None

class SectionResponse(SectionBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime



