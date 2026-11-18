with open('backend/app/schemas/timetable.py', 'r', encoding='utf-8') as f:
    tt_schemas = f.read()

if 'class TimetableUpdate' not in tt_schemas:
    code_to_add = """

class TimetableUpdate(BaseModel):
    subject_id: Optional[int] = None
    faculty_id: Optional[int] = None
    camera_id: Optional[int] = None
    day_of_week: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    classroom: Optional[str] = None
    section: Optional[str] = None
    batch_year: Optional[str] = None
    is_active: Optional[bool] = None

class BatchTimetableImportItem(BaseModel):
    day_of_week: str
    start_time: str
    end_time: str
    subject_code: str
    subject_name: Optional[str] = None
    faculty_employee_id: Optional[str] = None
    faculty_name: Optional[str] = None
    faculty_id: Optional[int] = None
    classroom: str = "Room 302"
    section: str = "CS2"
    semester: int = 7
    batch_year: str = "2026-2027"

class BatchTimetableImportRequest(BaseModel):
    slots: List[BatchTimetableImportItem]
    replace_existing: bool = False
"""
    tt_schemas += code_to_add
    with open('backend/app/schemas/timetable.py', 'w', encoding='utf-8') as f:
        f.write(tt_schemas)
    print('Updated schemas/timetable.py')
else:
    print('schemas/timetable.py already updated')

