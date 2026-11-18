from sqlalchemy import Column, String, Integer, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin

class Student(Base, TimestampMixin):
    __tablename__ = "students"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    student_id = Column(String(50), unique=True, index=True, nullable=False)  # Roll number / Reg ID
    department = Column(String(100), nullable=False, index=True)
    batch_year = Column(String(20), nullable=False)  # e.g., "2023-2027"
    semester = Column(Integer, default=1, nullable=False)
    section = Column(String(10), default="A", nullable=False)
    biometric_enrolled = Column(Boolean, default=False, nullable=False)
    biometric_face_count = Column(Integer, default=0, nullable=False)
    photo_url = Column(String(255), nullable=True)

    # Relationships
    user = relationship("User", backref="student_profile", lazy="joined")
    enrollments = relationship("Enrollment", back_populates="student", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Student {self.student_id} - User {self.user_id}>"

class Faculty(Base, TimestampMixin):
    __tablename__ = "faculty"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    employee_id = Column(String(50), unique=True, index=True, nullable=False)
    department = Column(String(100), nullable=False, index=True)
    designation = Column(String(100), default="Assistant Professor", nullable=False)
    office_location = Column(String(100), nullable=True)
    is_class_teacher = Column(Boolean, default=False, nullable=False)
    class_teacher_section = Column(String(20), nullable=True)  # e.g., "B"
    class_teacher_semester = Column(Integer, nullable=True)  # e.g., 7

    # Relationships
    user = relationship("User", backref="faculty_profile", lazy="joined")
    subjects = relationship("Subject", back_populates="faculty")

    def __repr__(self):
        return f"<Faculty {self.employee_id} - User {self.user_id}>"

class Subject(Base, TimestampMixin):
    __tablename__ = "subjects"

    code = Column(String(50), unique=True, index=True, nullable=False)  # e.g., "CS801"
    name = Column(String(255), nullable=False)
    department = Column(String(100), nullable=False, index=True)
    semester = Column(Integer, default=1, nullable=False)
    credits = Column(Integer, default=3, nullable=False)
    faculty_id = Column(Integer, ForeignKey("faculty.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    faculty = relationship("Faculty", back_populates="subjects", lazy="joined")
    enrollments = relationship("Enrollment", back_populates="subject", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Subject {self.code}: {self.name}>"

class Enrollment(Base, TimestampMixin):
    __tablename__ = "enrollments"

    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True)
    academic_year = Column(String(20), default="2026-2027", nullable=False)
    status = Column(String(20), default="ENROLLED", nullable=False)

    # Relationships
    student = relationship("Student", back_populates="enrollments", lazy="joined")
    subject = relationship("Subject", back_populates="enrollments", lazy="joined")

    def __repr__(self):
        return f"<Enrollment Student:{self.student_id} Subject:{self.subject_id}>"

class Course(Base, TimestampMixin):
    __tablename__ = "courses"

    code = Column(String(50), unique=True, index=True, nullable=False)  # e.g., "CSE", "ECE", "ME", "AIML"
    name = Column(String(255), nullable=False)  # e.g., "Computer Science & Engineering"
    description = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    def __repr__(self):
        return f"<Course {self.code}: {self.name}>"

class Classroom(Base, TimestampMixin):
    __tablename__ = "classrooms"

    name = Column(String(100), unique=True, index=True, nullable=False)  # e.g., "Room 302", "Room 101", "Lab 1"
    building = Column(String(100), default="Main Academic Block", nullable=False)
    capacity = Column(Integer, default=60, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    def __repr__(self):
        return f"<Classroom {self.name} ({self.building})>"


class CourseSection(Base, TimestampMixin):
    __tablename__ = "course_sections"

    name = Column(String(50), nullable=False, index=True)  # e.g., "CS1", "CS2", "Sec A"
    course_code = Column(String(50), nullable=False, index=True)  # e.g., "CSE", "ECE", "ISE", "EEE"
    semester = Column(Integer, default=1, nullable=False)
    batch_year = Column(String(50), default="2023-2027", nullable=False)
    room_number = Column(String(100), default="Room 302", nullable=True)
    capacity = Column(Integer, default=60, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    def __repr__(self):
        return f"<CourseSection {self.course_code}-{self.name} (Sem {self.semester})>"


