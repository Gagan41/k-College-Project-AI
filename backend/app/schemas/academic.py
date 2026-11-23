from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, model_validator
from app.schemas.user import UserResponse

# ----------------- STUDENT SCHEMAS -----------------
class StudentBase(BaseModel):
    student_id: str
    department: Optional[str] = "General"
    batch_year: Optional[str] = "2023-2027"
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
    code: Optional[str] = None
    subject_code: Optional[str] = None
    name: Optional[str] = None
    subject_name: Optional[str] = None
    department: Optional[str] = "General"
    semester: int = 1
    credits: int = 3
    faculty_id: Optional[int] = None

    @model_validator(mode="before")
    @classmethod
    def populate_subject_aliases(cls, values):
        if isinstance(values, dict):
            s_code = values.get("code") or values.get("subject_code")
            s_name = values.get("name") or values.get("subject_name")
            values["code"] = s_code
            values["subject_code"] = s_code
            values["name"] = s_name
            values["subject_name"] = s_name
        return values

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

    @model_validator(mode="before")
    @classmethod
    def populate_response_aliases(cls, values):
        if hasattr(values, "code"):
            s_code = getattr(values, "code")
            s_name = getattr(values, "name")
            return {
                "id": getattr(values, "id"),
                "code": s_code,
                "subject_code": s_code,
                "name": s_name,
                "subject_name": s_name,
                "department": getattr(values, "department", "General"),
                "semester": getattr(values, "semester", 1),
                "credits": getattr(values, "credits", 3),
                "faculty_id": getattr(values, "faculty_id", None),
                "created_at": getattr(values, "created_at"),
                "updated_at": getattr(values, "updated_at"),
            }
        return values
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
    code: Optional[str] = None
    course_code: Optional[str] = None
    name: Optional[str] = None
    course_name: Optional[str] = None
    department: Optional[str] = None
    degree_level: Optional[str] = "B.Tech"
    total_semesters: Optional[int] = 8
    description: Optional[str] = None
    is_active: bool = True

    @model_validator(mode="before")
    @classmethod
    def populate_code_and_name(cls, values):
        if isinstance(values, dict):
            c_code = values.get("code") or values.get("course_code")
            c_name = values.get("name") or values.get("course_name")
            values["code"] = c_code
            values["course_code"] = c_code
            values["name"] = c_name
            values["course_name"] = c_name
        return values

class CourseCreate(CourseBase):
    pass

class CourseUpdate(BaseModel):
    code: Optional[str] = None
    course_code: Optional[str] = None
    name: Optional[str] = None
    course_name: Optional[str] = None
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

    @model_validator(mode="before")
    @classmethod
    def populate_response_aliases(cls, values):
        if hasattr(values, "code"):
            c_code = getattr(values, "code")
            c_name = getattr(values, "name")
            return {
                "id": getattr(values, "id"),
                "code": c_code,
                "course_code": c_code,
                "name": c_name,
                "course_name": c_name,
                "description": getattr(values, "description", None),
                "is_active": getattr(values, "is_active", True),
                "created_at": getattr(values, "created_at"),
                "updated_at": getattr(values, "updated_at"),
            }
        return values

# ----------------- CLASSROOM LOCATION SCHEMAS -----------------
class ClassroomBase(BaseModel):
    name: Optional[str] = None
    room_number: Optional[str] = None
    building: str = "Main Academic Block"
    capacity: int = 60
    is_active: bool = True

    @model_validator(mode="before")
    @classmethod
    def populate_name_and_room_number(cls, values):
        if isinstance(values, dict):
            val = values.get("name") or values.get("room_number")
            values["name"] = val
            values["room_number"] = val
        return values

class ClassroomCreate(ClassroomBase):
    pass

class ClassroomUpdate(BaseModel):
    name: Optional[str] = None
    room_number: Optional[str] = None
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

    @model_validator(mode="before")
    @classmethod
    def set_room_number(cls, values):
        if hasattr(values, "name"):
            room_name = getattr(values, "name")
            return {
                "id": getattr(values, "id"),
                "name": room_name,
                "room_number": room_name,
                "building": getattr(values, "building", "Main Academic Block"),
                "capacity": getattr(values, "capacity", 60),
                "is_active": getattr(values, "is_active", True),
                "created_at": getattr(values, "created_at"),
                "updated_at": getattr(values, "updated_at"),
                "camera_id": getattr(values, "camera_id", None),
                "camera_name": getattr(values, "camera_name", None),
            }
        return values

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



