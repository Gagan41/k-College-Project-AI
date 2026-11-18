import os

with open('backend/app/api/academic.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Check imports
if 'FileResponse' not in content:
    content = content.replace(
        'from fastapi import APIRouter, Depends, HTTPException, status, Query',
        'from fastapi import APIRouter, Depends, HTTPException, status, Query, Response\nfrom fastapi.responses import FileResponse'
    )

if 'FacultyAssignSubjectRequest' not in content:
    content = content.replace(
        'from app.schemas.academic import (',
        'from app.schemas.academic import (\n    FacultyAssignSubjectRequest,'
    )

# Add student photo endpoint if not present
if '/students/{student_id}/photo' not in content:
    photo_endpoint = """
@router.get("/students/{student_id}/photo", summary="Get Student Trained Biometric Photo")
def get_student_photo(student_id: int, db: Session = Depends(get_db)):
    \"\"\"Return trained photo for student, or generate a high-res biometric badge avatar.\"\"\"
    photo_file = f"uploads/student_photos/student_{student_id}.jpg"
    if os.path.exists(photo_file):
        return FileResponse(photo_file, media_type="image/jpeg")
    
    png_file = f"uploads/student_photos/student_{student_id}.png"
    if os.path.exists(png_file):
        return FileResponse(png_file, media_type="image/png")

    student = db.query(Student).filter(Student.id == student_id).first()
    name = student.user.full_name if (student and student.user) else "Student"
    roll = student.student_id if student else "CS"
    initials = "".join([part[0] for part in name.split()[:2]]).upper() or "ST"

    # Crisp, elegant SVG Biometric Photo Badge
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" width="200" height="240">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#1e293b"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
        <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#3b82f6"/>
          <stop offset="100%" stop-color="#06b6d4"/>
        </linearGradient>
      </defs>
      <rect width="200" height="240" fill="url(#bg)" rx="16"/>
      <circle cx="100" cy="90" r="48" fill="#334155" stroke="url(#glow)" stroke-width="2.5"/>
      <text x="100" y="102" font-family="system-ui, sans-serif" font-size="32" font-weight="800" fill="#f8fafc" text-anchor="middle">{initials}</text>
      <path d="M 40 195 C 40 150, 160 150, 160 195 Z" fill="#334155" opacity="0.6"/>
      <rect x="25" y="200" width="150" height="22" rx="6" fill="#1e3a8a" opacity="0.8"/>
      <text x="100" y="215" font-family="monospace" font-size="11" font-weight="700" fill="#93c5fd" text-anchor="middle">{roll}</text>
      <circle cx="170" cy="30" r="6" fill="#10b981"/>
    </svg>'''
    return Response(content=svg, media_type="image/svg+xml")
"""
    # Insert before UPDATE STUDENT
    content = content.replace(
        '@router.put("/students/{student_id}"',
        photo_endpoint + '\n@router.put("/students/{student_id}"'
    )

# Add faculty assign-subject endpoints
if '/faculty/{faculty_id}/assign-subject' not in content:
    subject_assign_endpoint = """
@router.post("/faculty/{faculty_id}/assign-subject", summary="Assign Subject to Faculty")
def assign_subject_to_faculty(
    faculty_id: int,
    payload: FacultyAssignSubjectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    faculty = db.query(Faculty).filter(Faculty.id == faculty_id).first()
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty member not found.")
    subject = db.query(Subject).filter(Subject.id == payload.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")
    subject.faculty_id = faculty.id
    db.commit()
    db.refresh(subject)
    return {
        "success": True,
        "faculty_id": faculty.id,
        "faculty_name": faculty.user.full_name if faculty.user else None,
        "subject_id": subject.id,
        "subject_code": subject.code,
        "subject_name": subject.name
    }

@router.post("/faculty/{faculty_id}/unassign-subject/{subject_id}", summary="Unassign Subject from Faculty")
def unassign_subject_from_faculty(
    faculty_id: int,
    subject_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    subject = db.query(Subject).filter(Subject.id == subject_id, Subject.faculty_id == faculty_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject assignment not found.")
    subject.faculty_id = None
    db.commit()
    return {"success": True, "message": "Subject unassigned successfully."}
"""
    content = content.replace(
        '# ==============================================================================\n# SUBJECTS ENDPOINTS',
        subject_assign_endpoint + '\n# ==============================================================================\n# SUBJECTS ENDPOINTS'
    )

with open('backend/app/api/academic.py', 'w', encoding='utf-8') as f:
    f.write(content)
print('Updated backend/app/api/academic.py')

