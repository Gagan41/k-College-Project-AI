import sys
sys.path.insert(0, 'backend')
from app.core.database import SessionLocal
from app.models.user import User, UserRole
from app.models.academic import Faculty, Subject
from app.models.timetable import Timetable
from app.core.security import get_password_hash

db = SessionLocal()

# 1. Create or get Faculty from image.png
faculty_data = [
    ("EMP-CS-701", "Prof. Roopa E", "roopa.e@ewit.edu.in", "Assistant Professor"),
    ("EMP-CS-702", "Prof. Gangambika G", "gangambika.g@ewit.edu.in", "Assistant Professor"),
    ("EMP-CS-703", "Prof. Pawanraj S P", "pawanraj.sp@ewit.edu.in", "Assistant Professor"),
    ("EMP-CS-704", "Prof. Leena Shruti H M", "leena.shruti@ewit.edu.in", "Associate Professor"),
    ("EMP-CS-705", "Dr. Mohan B R", "mohan.br@ewit.edu.in", "Professor"),
    ("EMP-CS-706", "Dr. Sashi Shekar", "sashi.shekar@ewit.edu.in", "Professor"),
]

fac_map = {}
for emp_id, name, email, desig in faculty_data:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            email=email,
            hashed_password=get_password_hash("faculty123"),
            full_name=name,
            role=UserRole.FACULTY,
            is_active=True
        )
        db.add(user)
        db.flush()

    fac = db.query(Faculty).filter(Faculty.employee_id == emp_id).first()
    if not fac:
        fac = Faculty(
            user_id=user.id,
            employee_id=emp_id,
            department="Computer Science & Engineering",
            designation=desig,
            is_class_teacher=(name == "Prof. Roopa E"),
            class_teacher_section="CS2",
            class_teacher_semester=7
        )
        db.add(fac)
        db.flush()
    fac_map[name] = fac

# 2. Create or get Subjects from image.png
subjects_data = [
    ("BCS701", "Internet of Things", 7, 4, fac_map["Prof. Gangambika G"].id),
    ("BCS702", "Parallel Computing", 7, 4, fac_map["Prof. Pawanraj S P"].id),
    ("BCS703", "Cryptography & Network Security", 7, 4, fac_map["Prof. Leena Shruti H M"].id),
    ("BCS714D", "Big Data Analytics", 7, 3, fac_map["Dr. Mohan B R"].id),
    ("BCV755B", "Conservation of Natural Resources", 7, 3, fac_map["Dr. Sashi Shekar"].id),
    ("BCS786", "Major Project Phase - II", 7, 6, fac_map["Prof. Roopa E"].id),
    ("ACT-DEPT", "Departmental Activity", 7, 1, fac_map["Prof. Roopa E"].id),
    ("TNP-PRE", "Pre Placement Training", 7, 2, fac_map["Prof. Pawanraj S P"].id),
]

sub_map = {}
for code, name, sem, cred, fid in subjects_data:
    sub = db.query(Subject).filter(Subject.code == code).first()
    if not sub:
        sub = Subject(
            code=code,
            name=name,
            department="Computer Science & Engineering",
            semester=sem,
            credits=cred,
            faculty_id=fid
        )
        db.add(sub)
        db.flush()
    else:
        sub.faculty_id = fid
    sub_map[code] = sub

# 3. Create Timetable Slots for 'CS2'
slots_to_create = [
    # MONDAY
    ("Monday", "08:45", "09:45", "BCS701", fac_map["Prof. Gangambika G"].id),
    ("Monday", "09:45", "10:45", "BCV755B", fac_map["Dr. Sashi Shekar"].id),
    ("Monday", "11:00", "12:00", "BCS702", fac_map["Prof. Pawanraj S P"].id),
    ("Monday", "12:00", "13:00", "BCS703", fac_map["Prof. Leena Shruti H M"].id),
    ("Monday", "14:30", "16:30", "BCS786", fac_map["Prof. Roopa E"].id),

    # TUESDAY
    ("Tuesday", "08:45", "09:45", "BCS714D", fac_map["Dr. Mohan B R"].id),
    ("Tuesday", "09:45", "10:45", "BCV755B", fac_map["Dr. Sashi Shekar"].id),
    ("Tuesday", "11:00", "13:00", "BCS701", fac_map["Prof. Gangambika G"].id),
    ("Tuesday", "14:30", "16:30", "BCS786", fac_map["Prof. Roopa E"].id),

    # WEDNESDAY
    ("Wednesday", "08:45", "09:45", "BCS702", fac_map["Prof. Pawanraj S P"].id),
    ("Wednesday", "09:45", "10:45", "BCS714D", fac_map["Dr. Mohan B R"].id),
    ("Wednesday", "11:00", "12:00", "BCS701", fac_map["Prof. Gangambika G"].id),
    ("Wednesday", "12:00", "13:00", "BCS701", fac_map["Prof. Gangambika G"].id),
    ("Wednesday", "14:30", "16:30", "ACT-DEPT", fac_map["Prof. Roopa E"].id),

    # THURSDAY
    ("Thursday", "08:45", "10:45", "BCS701", fac_map["Prof. Gangambika G"].id),
    ("Thursday", "11:00", "12:00", "BCS714D", fac_map["Dr. Mohan B R"].id),
    ("Thursday", "12:00", "13:00", "BCS702", fac_map["Prof. Pawanraj S P"].id),
    ("Thursday", "14:30", "16:30", "TNP-PRE", fac_map["Prof. Pawanraj S P"].id),

    # FRIDAY
    ("Friday", "08:45", "09:45", "BCS703", fac_map["Prof. Leena Shruti H M"].id),
    ("Friday", "09:45", "10:45", "BCS703", fac_map["Prof. Leena Shruti H M"].id),
    ("Friday", "11:00", "12:00", "BCV755B", fac_map["Dr. Sashi Shekar"].id),
    ("Friday", "12:00", "13:00", "BCS703", fac_map["Prof. Leena Shruti H M"].id),
    ("Friday", "14:30", "16:30", "TNP-PRE", fac_map["Prof. Pawanraj S P"].id),
]

for day, start, end, code, fid in slots_to_create:
    sub = sub_map[code]
    exist = (
        db.query(Timetable)
        .filter(
            Timetable.day_of_week == day,
            Timetable.start_time == start,
            Timetable.section == "CS2"
        )
        .first()
    )
    if not exist:
        slot = Timetable(
            subject_id=sub.id,
            faculty_id=fid,
            day_of_week=day,
            start_time=start,
            end_time=end,
            classroom="Room 302",
            section="CS2",
            batch_year="2026-2027",
            is_recurring=True,
            is_active=True
        )
        db.add(slot)

db.commit()
print("Successfully seeded timetable, subjects and faculty from image.png!")
db.close()

