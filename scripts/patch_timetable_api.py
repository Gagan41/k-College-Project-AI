with open('backend/app/api/timetable.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Check imports
if 'TimetableUpdate' not in content:
    content = content.replace(
        'from app.schemas.timetable import (',
        'from app.schemas.timetable import (\n    TimetableUpdate,\n    BatchTimetableImportRequest,'
    )

new_endpoints = """
@router.put("/{slot_id}", response_model=TimetableResponse, summary="Update Timetable Slot / Assigned Faculty")
def update_timetable_slot(
    slot_id: int,
    payload: TimetableUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    \"\"\"Update an existing timetable period slot: faculty assignment, classroom, timing, or active status.\"\"\"
    slot = db.query(Timetable).filter(Timetable.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Timetable slot not found")

    if payload.faculty_id is not None:
        faculty = db.query(Faculty).filter(Faculty.id == payload.faculty_id).first()
        if not faculty:
            raise HTTPException(status_code=404, detail="Faculty member not found")
        slot.faculty_id = payload.faculty_id

    if payload.subject_id is not None:
        subject = db.query(Subject).filter(Subject.id == payload.subject_id).first()
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")
        slot.subject_id = payload.subject_id

    if payload.start_time is not None:
        slot.start_time = payload.start_time
    if payload.end_time is not None:
        slot.end_time = payload.end_time
    if payload.day_of_week is not None:
        slot.day_of_week = payload.day_of_week
    if payload.classroom is not None:
        slot.classroom = payload.classroom
    if payload.section is not None:
        slot.section = payload.section
    if payload.camera_id is not None:
        slot.camera_id = payload.camera_id
    if payload.is_active is not None:
        slot.is_active = payload.is_active

    db.commit()
    db.refresh(slot)

    return TimetableResponse(
        id=slot.id,
        subject_id=slot.subject_id,
        faculty_id=slot.faculty_id,
        camera_id=slot.camera_id,
        day_of_week=slot.day_of_week,
        start_time=slot.start_time,
        end_time=slot.end_time,
        classroom=slot.classroom,
        section=slot.section,
        batch_year=slot.batch_year,
        is_recurring=slot.is_recurring,
        single_date=slot.single_date,
        is_active=slot.is_active,
        created_at=slot.created_at,
        subject_name=slot.subject.name if slot.subject else None,
        subject_code=slot.subject.code if slot.subject else None,
        faculty_name=slot.faculty.user.full_name if slot.faculty and slot.faculty.user else None,
        faculty_email=slot.faculty.user.email if slot.faculty and slot.faculty.user else None,
        camera_name=slot.camera.name if slot.camera else None
    )

@router.post("/batch-import", summary="Batch Import Timetable from Excel / Sheet Data")
def batch_import_timetable(
    payload: BatchTimetableImportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    \"\"\"Batch import or replace timetable slots parsed from Excel/CSV spreadsheet.\"\"\"
    imported_count = 0
    errors = []

    # Map existing subjects by code (upper)
    subjects = db.query(Subject).all()
    sub_map = {s.code.upper(): s for s in subjects}

    # Map existing faculty by name (lower) or employee_id
    faculty_list = db.query(Faculty).all()
    fac_emp_map = {f.employee_id.upper(): f for f in faculty_list}
    fac_name_map = {f.user.full_name.lower(): f for f in faculty_list if f.user}

    default_faculty = faculty_list[0] if faculty_list else None

    for idx, item in enumerate(payload.slots):
        try:
            sub = sub_map.get(item.subject_code.upper())
            if not sub:
                # Auto-create subject if not existing
                sub = Subject(
                    code=item.subject_code.upper(),
                    name=item.subject_name or item.subject_code.upper(),
                    department="Computer Science & Engineering",
                    semester=item.semester or 7,
                    credits=3
                )
                db.add(sub)
                db.flush()
                sub_map[item.subject_code.upper()] = sub

            # Resolve faculty
            target_faculty = None
            if item.faculty_id:
                target_faculty = db.query(Faculty).filter(Faculty.id == item.faculty_id).first()
            if not target_faculty and item.faculty_employee_id:
                target_faculty = fac_emp_map.get(item.faculty_employee_id.upper())
            if not target_faculty and item.faculty_name:
                target_faculty = fac_name_map.get(item.faculty_name.lower())
            if not target_faculty:
                target_faculty = default_faculty

            if not target_faculty:
                errors.append(f"Row {idx+1}: No valid faculty member found for '{item.subject_code}'")
                continue

            # Check if matching slot exists for day, time, section
            existing_slot = (
                db.query(Timetable)
                .filter(
                    Timetable.day_of_week.ilike(item.day_of_week),
                    Timetable.start_time == item.start_time,
                    Timetable.section == item.section
                )
                .first()
            )

            if existing_slot:
                existing_slot.subject_id = sub.id
                existing_slot.faculty_id = target_faculty.id
                existing_slot.end_time = item.end_time
                existing_slot.classroom = item.classroom
                existing_slot.is_active = True
            else:
                new_slot = Timetable(
                    subject_id=sub.id,
                    faculty_id=target_faculty.id,
                    day_of_week=item.day_of_week.capitalize(),
                    start_time=item.start_time,
                    end_time=item.end_time,
                    classroom=item.classroom,
                    section=item.section,
                    batch_year=item.batch_year,
                    is_recurring=True,
                    is_active=True
                )
                db.add(new_slot)

            imported_count += 1
        except Exception as e:
            errors.append(f"Row {idx+1}: {str(e)}")

    db.commit()

    return {
        "success": True,
        "imported_count": imported_count,
        "errors_count": len(errors),
        "errors": errors
    }
"""

if 'def update_timetable_slot' not in content:
    content = content.replace(
        '@router.delete("/{slot_id}", status_code=status.HTTP_204_NO_CONTENT)',
        new_endpoints + '\n@router.delete("/{slot_id}", status_code=status.HTTP_204_NO_CONTENT)'
    )
    with open('backend/app/api/timetable.py', 'w', encoding='utf-8') as f:
        f.write(content)
    print('Updated backend/app/api/timetable.py')
else:
    print('Already present in backend/app/api/timetable.py')

