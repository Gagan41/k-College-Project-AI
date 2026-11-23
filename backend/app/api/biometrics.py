from app.core.config import settings
import os
import json
import cv2
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.logging import logger
from app.api.deps import get_current_user, require_admin
from app.models.user import User
from app.models.academic import Student
from app.models.biometrics import StudentFaceEmbedding, SecurityAuditLog, SecurityEventType
from app.schemas.biometrics import (
    FaceEnrollRequest,
    FaceEnrollResponse,
    FaceRecognizeRequest,
    FaceRecognizeResponse,
    RecognizedStudentItem,
    DetectedFaceItem,
    IDCardScanRequest,
    IDCardScanResponse,
    SecurityAuditResponse,
    ClassroomScopingInfo
)
from app.services.biometric_service import (
    decode_base64_image,
    detect_faces,
    detect_faces_detailed,
    extract_face_embedding,
    compute_cosine_similarity,
    calculate_match_confidence,
    check_anti_spoofing,
    detect_and_decode_id_card,
    SFACE_MATCH_THRESHOLD
)
from app.services.cloudinary_service import upload_student_photo_to_cloudinary

router = APIRouter(prefix="/biometrics", tags=["Biometric Face Training & Anti-Spoofing"])

@router.post("/enroll", response_model=FaceEnrollResponse)
def enroll_student_face(
    req: FaceEnrollRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Capture/upload photo(s) to enroll student facial biometrics:
    1. Supports single capture or multiple angle captures (Front, Left Angle, Right Angle).
    2. Decodes image and detects face bounding box for each angle.
    3. Runs anti-spoofing validation (blocks paper prints and phone screen replays).
    4. Extracts normalized 128-dimensional embedding for each angle.
    5. Saves embeddings to database and updates student enrollment status and face count.
    """
    student = db.query(Student).filter(Student.id == req.student_id).first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    frames_to_process = []
    if req.images_base64 and len(req.images_base64) > 0:
        frames_to_process = req.images_base64
    elif req.image_base64:
        frames_to_process = [req.image_base64]

    if not frames_to_process:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No image data provided for enrollment.")

    saved_embeddings = []
    first_face_emb = None
    front_face_crop = None
    front_image_full = None

    # If front_image_base64 is explicitly provided, decode it as the reference front photo
    if req.front_image_base64:
        front_img = decode_base64_image(req.front_image_base64)
        if front_img is not None:
            front_image_full = front_img
            f_faces, _ = detect_faces_detailed(front_img)
            if f_faces:
                fx, fy, fw, fh = f_faces[0]
                front_face_crop = front_img[fy:fy+fh, fx:fx+fw]

    # Clean up previous outdated embeddings for this student to ensure a fresh, high-precision profile
    db.query(StudentFaceEmbedding).filter(StudentFaceEmbedding.student_id == student.id).delete()

    for idx, frame_b64 in enumerate(frames_to_process):
        image = decode_base64_image(frame_b64)
        if image is None:
            continue

        faces, raw_faces = detect_faces_detailed(image)
        if not faces:
            continue

        # Use primary face in this frame
        x, y, w, h = faces[0]
        face_raw = raw_faces[0] if raw_faces is not None and len(raw_faces) > 0 else None
        face_crop = image[y:y+h, x:x+w]

        # Preserve the FRONT photo (index 0) for disk avatar & Cloudinary
        # Include complete face, hair, forehead, chin, and neck in a clean square crop
        if idx == 0 and front_face_crop is None:
            img_h, img_w = image.shape[:2]
            fc_x = int(x + w / 2)
            fc_y = int(y + h / 2)
            sq = int(max(w, h) * 1.8)
            x1 = max(0, fc_x - sq // 2)
            y1 = max(0, fc_y - int(sq * 0.52))
            x2 = min(img_w, x1 + sq)
            y2 = min(img_h, y1 + sq)
            portrait_crop = image[y1:y2, x1:x2]
            front_face_crop = portrait_crop.copy() if portrait_crop.size > 0 else face_crop.copy()
            front_image_full = image.copy()

        # Anti-spoofing check
        is_spoof, liveness_score, details = check_anti_spoofing(
            face_crop,
            full_image=image,
            bbox=(int(x), int(y), int(w), int(h))
        )
        if is_spoof:
            # If spoof detected in any angle, report error
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Biometric Anti-Spoofing Validation Failed on Angle #{idx + 1}: {details}. Please present a live person."
            )

        # Extract 128-d deep embedding with landmark alignment
        embedding = extract_face_embedding(face_crop, full_image=image, face_raw=face_raw)

        face_emb = StudentFaceEmbedding(
            student_id=student.id,
            embedding=json.dumps(embedding),
            quality_score=round(float(min(1.0, (w * h) / (120.0 * 120.0))), 2),
            liveness_score=liveness_score,
            is_primary=(idx == 0)
        )
        db.add(face_emb)
        saved_embeddings.append(face_emb)
        if first_face_emb is None:
            first_face_emb = face_emb

    if not saved_embeddings:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid faces detected in the provided image capture(s). Please face the camera with proper lighting."
        )

    # Save FRONT side photo on disk and upload to Cloudinary CDN
    try:
        os.makedirs(settings.STUDENT_PHOTOS_DIR, exist_ok=True)
        photo_save_path = os.path.join(settings.STUDENT_PHOTOS_DIR, f"student_{student.id}.jpg")
        saved_img = None
        if front_face_crop is not None and front_face_crop.size > 0:
            cv2.imwrite(photo_save_path, front_face_crop)
            saved_img = front_face_crop
        elif front_image_full is not None and front_image_full.size > 0:
            cv2.imwrite(photo_save_path, front_image_full)
            saved_img = front_image_full
        elif 'face_crop' in locals() and face_crop is not None and face_crop.size > 0:
            cv2.imwrite(photo_save_path, face_crop)
            saved_img = face_crop
        elif 'image' in locals() and image is not None and image.size > 0:
            cv2.imwrite(photo_save_path, image)
            saved_img = image

        # Upload student front photo to Cloudinary CDN
        cloudinary_url = None
        try:
            target_to_upload = photo_save_path if os.path.exists(photo_save_path) else saved_img
            if target_to_upload is not None:
                cloudinary_url = upload_student_photo_to_cloudinary(
                    target_to_upload,
                    student_id=student.id,
                    roll_number=student.student_id
                )
        except Exception as c_err:
            logger.warning(f"Cloudinary upload exception for student {student.id}: {c_err}")

        if cloudinary_url:
            student.photo_url = cloudinary_url
            logger.info(f"Student {student.id} front photo saved to Cloudinary: {cloudinary_url}")
        else:
            student.photo_url = f"/api/academic/students/{student.id}/photo"
    except Exception as e:
        logger.warning(f"Failed to save student front photo: {e}")

    # Update Student record
    student.biometric_enrolled = True
    student.biometric_face_count = len(saved_embeddings)
    db.commit()

    return FaceEnrollResponse(
        success=True,
        student_id=student.id,
        student_name=student.user.full_name,
        roll_number=student.student_id,
        quality_score=first_face_emb.quality_score,
        liveness_score=first_face_emb.liveness_score,
        total_faces_enrolled=student.biometric_face_count,
        photo_url=student.photo_url,
        message=f"Student facial biometrics successfully trained with {len(saved_embeddings)} angle(s) and committed to database."
    )


@router.get("/student/{student_id}")
def get_student_biometrics(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve enrolled face biometric metadata for a student."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    embeddings = db.query(StudentFaceEmbedding).filter(StudentFaceEmbedding.student_id == student_id).all()
    return {
        "student_id": student.id,
        "roll_number": student.student_id,
        "full_name": student.user.full_name,
        "biometric_enrolled": student.biometric_enrolled,
        "face_count": len(embeddings),
        "embeddings": [
            {
                "id": emb.id,
                "quality_score": emb.quality_score,
                "liveness_score": emb.liveness_score,
                "created_at": emb.created_at
            }
            for emb in embeddings
        ]
    }

@router.delete("/{face_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_face_embedding(
    face_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Delete a face embedding record."""
    emb = db.query(StudentFaceEmbedding).filter(StudentFaceEmbedding.id == face_id).first()
    if not emb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Face record not found")
    student = db.query(Student).filter(Student.id == emb.student_id).first()
    db.delete(emb)
    if student:
        student.biometric_face_count = max(0, student.biometric_face_count - 1)
        if student.biometric_face_count == 0:
            student.biometric_enrolled = False
    db.commit()
    return None

@router.post("/check-pose")
def check_face_pose(payload: dict):
    """
    Real-time pose and clarity check for circular head-turn biometric onboarding:
    1. Detects face using YuNet
    2. Calculates camera clarity and blur score via Laplacian variance
    3. Calculates 3D yaw head angle from landmark coordinates (x_re, x_le, x_nt)
    4. Returns whether pose_matched is True (turns circle green in UI)
    """
    image_base64 = payload.get("image_base64")
    expected_pose = payload.get("expected_pose", "FRONT")  # "FRONT", "LEFT", "RIGHT"
    is_mirrored = payload.get("is_mirrored", True)

    if not image_base64:
        raise HTTPException(400, "Image base64 required")

    frame = decode_base64_image(image_base64)
    if frame is None or frame.size == 0:
        return {
            "face_detected": False,
            "camera_clear": False,
            "pose_matched": False,
            "current_pose": "UNKNOWN",
            "message": "Invalid camera frame"
        }

    h, w = frame.shape[:2]
    faces, raw_faces = detect_faces_detailed(frame)
    if not faces:
        return {
            "face_detected": False,
            "camera_clear": False,
            "pose_matched": False,
            "current_pose": "UNKNOWN",
            "message": "No face detected in camera"
        }

    fx, fy, fw, fh = faces[0]
    face_crop = frame[max(0, fy):min(h, fy+fh), max(0, fx):min(w, fx+fw)]

    # Clarity check: Laplacian variance must be >= 20.0 to prevent blurry shots
    gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY) if face_crop.size > 0 else None
    lap_var = float(cv2.Laplacian(gray, cv2.CV_64F).var()) if gray is not None else 0.0
    camera_clear = bool(lap_var >= 20.0 and fw >= 50 and fh >= 50)

    current_pose = "FRONT"
    yaw_ratio = 0.5
    if raw_faces is not None and len(raw_faces) > 0:
        raw = raw_faces[0]
        x_re = float(raw[4])
        x_le = float(raw[6])
        x_nt = float(raw[8])

        eye_min = min(x_re, x_le)
        eye_max = max(x_re, x_le)
        eye_dist = eye_max - eye_min

        if eye_dist > 5:
            yaw_ratio = (x_nt - eye_min) / eye_dist
            if is_mirrored:
                # In mirrored mode, turning head to user's left moves nose to left of image (lower x)
                if yaw_ratio < 0.38:
                    current_pose = "LEFT"
                elif yaw_ratio > 0.62:
                    current_pose = "RIGHT"
                elif 0.42 <= yaw_ratio <= 0.58:
                    current_pose = "FRONT"
                else:
                    current_pose = "SLIGHT_TURN"
            else:
                # In unmirrored mode, turning head to user's left moves nose to right of image (higher x)
                if yaw_ratio > 0.62:
                    current_pose = "LEFT"
                elif yaw_ratio < 0.38:
                    current_pose = "RIGHT"
                elif 0.42 <= yaw_ratio <= 0.58:
                    current_pose = "FRONT"
                else:
                    current_pose = "SLIGHT_TURN"

    pose_matched = bool((current_pose == expected_pose) and camera_clear)

    user_msg = "Perfect!" if pose_matched else (
        "Camera blurry or moving, hold still" if not camera_clear else (
            f"Slowly turn head to the left" if expected_pose == "LEFT" else (
                f"Slowly turn head to the right" if expected_pose == "RIGHT" else "Look straight at the camera"
            )
        )
    )

    return {
        "face_detected": True,
        "camera_clear": camera_clear,
        "pose_matched": pose_matched,
        "current_pose": current_pose,
        "expected_pose": expected_pose,
        "clarity_score": round(lap_var, 1),
        "yaw_ratio": round(yaw_ratio, 2),
        "message": user_msg
    }

@router.post("/recognize", response_model=FaceRecognizeResponse)
def recognize_face_frame(
    req: FaceRecognizeRequest,
    db: Session = Depends(get_db)
):
    """Test facial recognition on a frame against all enrolled student embeddings."""
    image = None
    if req.image_base64:
        image = decode_base64_image(req.image_base64)
    elif req.camera_id:
        from app.models.cctv import Camera
        from app.services.cctv_service import cctv_manager
        cam = db.query(Camera).filter(Camera.id == req.camera_id, Camera.is_active == True).first()
        if cam:
            _, image = cctv_manager.capture_frame(cam)

    if image is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid image or unable to grab frame from camera")

    effective_session_id = req.session_id
    timetable = None
    target_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Resolve timetable slot and active class session
    if req.timetable_id:
        from app.models.timetable import Timetable
        timetable = db.query(Timetable).filter(Timetable.id == req.timetable_id).first()
    elif effective_session_id:
        from app.models.timetable import ClassSession
        sess = db.query(ClassSession).filter(ClassSession.id == effective_session_id).first()
        if sess:
            timetable = sess.timetable
    elif req.camera_id:
        from app.models.timetable import Timetable
        timetable = db.query(Timetable).filter(Timetable.camera_id == req.camera_id).first()
    elif req.classroom:
        from app.models.timetable import Timetable
        timetable = db.query(Timetable).filter(Timetable.classroom == req.classroom).first()

    # Automatically initialize/fetch today's ClassSession for this timetable slot
    if not effective_session_id and timetable:
        try:
            from app.models.timetable import ClassSession, SessionStatus
            sess = db.query(ClassSession).filter(
                ClassSession.timetable_id == timetable.id,
                ClassSession.date == target_date
            ).first()
            if not sess:
                sess = ClassSession(
                    timetable_id=timetable.id,
                    date=target_date,
                    status=SessionStatus.IN_PROGRESS.value,
                    started_at=datetime.now(timezone.utc)
                )
                db.add(sess)
                db.commit()
                db.refresh(sess)
            effective_session_id = sess.id
        except Exception as sess_err:
            logger.debug(f"Auto session resolution note: {sess_err}")

    # Determine Monitored Classroom target
    target_room = (req.classroom or "").strip()
    if not target_room and timetable and timetable.classroom:
        target_room = timetable.classroom.strip()
    if not target_room and req.camera_id:
        from app.models.cctv import Camera
        cam_obj = db.query(Camera).filter(Camera.id == req.camera_id).first()
        if cam_obj and cam_obj.classroom:
            target_room = cam_obj.classroom.strip()

    # Determine Classroom Student Scope (Only search students assigned inside this classroom)
    classroom_student_ids = None
    is_room_scoped = False

    if target_room:
        is_room_scoped = True
        classroom_student_ids = set()
        try:
            from app.models.academic import Enrollment, CourseSection
            from app.models.timetable import Timetable
            # 1. Students from active timetable in this classroom
            if timetable and timetable.classroom and timetable.classroom.strip().upper() == target_room.upper():
                enrolled_ids = [
                    r[0] for r in db.query(Enrollment.student_id).filter(
                        Enrollment.subject_id == timetable.subject_id,
                        Enrollment.status == "ENROLLED"
                    ).all()
                ]
                sec_ids = [
                    r[0] for r in db.query(Student.id).filter(
                        Student.section == timetable.section,
                        Student.batch_year == timetable.batch_year
                    ).all()
                ]
                classroom_student_ids.update(enrolled_ids)
                classroom_student_ids.update(sec_ids)

            # 2. Students assigned to CourseSections physically mapped to this room
            sections_in_room = db.query(CourseSection).filter(
                CourseSection.room_number.ilike(f"%{target_room}%"),
                CourseSection.is_active == True
            ).all()
            for sec in sections_in_room:
                sec_student_ids = [
                    r[0] for r in db.query(Student.id).filter(
                        Student.section == sec.name
                    ).all()
                ]
                classroom_student_ids.update(sec_student_ids)

            # 3. Any timetable scheduled in this classroom
            room_slots = db.query(Timetable).filter(
                Timetable.classroom.ilike(f"%{target_room}%"),
                Timetable.is_active == True
            ).all()
            for slot in room_slots:
                slot_enrolled = [
                    r[0] for r in db.query(Enrollment.student_id).filter(
                        Enrollment.subject_id == slot.subject_id,
                        Enrollment.status == "ENROLLED"
                    ).all()
                ]
                slot_sec_ids = [
                    r[0] for r in db.query(Student.id).filter(
                        Student.section == slot.section,
                        Student.batch_year == slot.batch_year
                    ).all()
                ]
                classroom_student_ids.update(slot_enrolled)
                classroom_student_ids.update(slot_sec_ids)
        except Exception as scope_err:
            logger.debug(f"Classroom student scoping note: {scope_err}")

    recognized = []
    spoofs = []

    # 1. Check for Student ID Barcode / QR Code in camera frame
    barcode_found, code_data, code_type = detect_and_decode_id_card(image)
    scanned_barcode = None

    if barcode_found and code_data:
        clean_code = code_data.strip().upper()
        # Look up student by student_id or email
        bc_query = db.query(Student).filter(
            (Student.student_id == clean_code) | (Student.student_id.ilike(f"%{clean_code}%"))
        )
        if classroom_student_ids:
            bc_query = bc_query.filter(Student.id.in_(classroom_student_ids))
        bc_student = bc_query.first()

        if bc_student:
            scanned_barcode = IDCardScanResponse(
                success=True,
                barcode_data=clean_code,
                student_id=bc_student.id,
                student_name=bc_student.user.full_name,
                roll_number=bc_student.student_id,
                message=f"ID Card {code_type} verified for {bc_student.user.full_name} ({bc_student.student_id})"
            )
            # If session_id provided, mark attendance
            if effective_session_id:
                try:
                    from app.models.timetable import AttendanceRecord, AttendanceStatus, VerificationMethod
                    existing = db.query(AttendanceRecord).filter(
                        AttendanceRecord.session_id == effective_session_id,
                        AttendanceRecord.student_id == bc_student.id
                    ).first()
                    if existing:
                        existing.status = AttendanceStatus.PRESENT.value
                        existing.verification_method = VerificationMethod.BARCODE_FALLBACK.value
                    else:
                        new_att = AttendanceRecord(
                            session_id=effective_session_id,
                            student_id=bc_student.id,
                            date=target_date,
                            period_number=timetable.period_number if timetable else 1,
                            status=AttendanceStatus.PRESENT.value,
                            verification_method=VerificationMethod.BARCODE_FALLBACK.value,
                            confidence_score=1.0,
                            total_minutes_present=60.0,
                            presence_ratio=1.0
                        )
                        db.add(new_att)
                    db.commit()
                except Exception as att_err:
                    logger.debug(f"Barcode auto-attendance update: {att_err}")

            recognized.append(
                RecognizedStudentItem(
                    student_id=bc_student.id,
                    roll_number=bc_student.student_id,
                    full_name=bc_student.user.full_name,
                    confidence=1.0,
                    bounding_box=[20, 20, 160, 80],
                    liveness_score=1.0,
                    spoof_detected=False,
                    verification_method="BARCODE_FALLBACK",
                    attendance_marked=True
                )
            )

    all_detected_faces = []

    # 2. Check for faces in camera frame
    faces, raw_faces = detect_faces_detailed(image)
    if faces:
        # Load embeddings scoped strictly to Classroom Students
        if is_room_scoped:
            if classroom_student_ids:
                all_embeddings = db.query(StudentFaceEmbedding).filter(
                    StudentFaceEmbedding.student_id.in_(classroom_student_ids)
                ).all()
                student_map = {
                    s.id: s for s in db.query(Student).filter(Student.id.in_(classroom_student_ids)).all()
                }
            else:
                all_embeddings = []
                student_map = {}
        else:
            all_embeddings = db.query(StudentFaceEmbedding).all()
            student_map = {s.id: s for s in db.query(Student).all()}

        # Sort faces by size (prominent faces processed first)
        indexed_faces = sorted(
            range(len(faces)),
            key=lambda i: faces[i][2] * faces[i][3],
            reverse=True
        )

        for idx in indexed_faces:
            x, y, w, h = faces[idx]
            face_raw = raw_faces[idx] if raw_faces is not None and len(raw_faces) > idx else None
            face_landmarks = None
            if face_raw is not None and len(face_raw) >= 14:
                face_landmarks = [
                    [float(face_raw[4]), float(face_raw[5])],   # Right eye
                    [float(face_raw[6]), float(face_raw[7])],   # Left eye
                    [float(face_raw[8]), float(face_raw[9])],   # Nose tip
                    [float(face_raw[10]), float(face_raw[11])], # Right mouth corner
                    [float(face_raw[12]), float(face_raw[13])], # Left mouth corner
                ]
            face_crop = image[y:y+h, x:x+w]
            is_spoof, liveness, details = check_anti_spoofing(
                face_crop,
                full_image=image,
                bbox=(int(x), int(y), int(w), int(h))
            )
            if is_spoof:
                spoofs.append(details)
                try:
                    audit = SecurityAuditLog(
                        event_type=SecurityEventType.SPOOF_DETECTED.value,
                        student_id=None,
                        details=f"Spoof attack blocked: {details}",
                        timestamp=datetime.now(timezone.utc)
                    )
                    db.add(audit)
                    db.commit()
                except Exception as audit_err:
                    logger.debug(f"Audit log error: {audit_err}")

            emb = extract_face_embedding(face_crop, full_image=image, face_raw=face_raw)
            best_student = None
            best_sim = -1.0

            for stored in all_embeddings:
                try:
                    stored_vec = json.loads(stored.embedding)
                    sim = compute_cosine_similarity(emb, stored_vec)
                    if sim > best_sim:
                        best_sim = sim
                        best_student = student_map.get(stored.student_id)
                except Exception:
                    pass

            is_matched = bool(best_student and best_sim >= SFACE_MATCH_THRESHOLD and not is_spoof)
            display_confidence = calculate_match_confidence(best_sim, SFACE_MATCH_THRESHOLD)

            if is_matched:
                # Automatic attendance recording for this classroom student
                if effective_session_id and not is_spoof:
                    try:
                        from app.models.timetable import AttendanceRecord, AttendanceStatus, VerificationMethod
                        existing = db.query(AttendanceRecord).filter(
                            AttendanceRecord.session_id == effective_session_id,
                            AttendanceRecord.student_id == best_student.id
                        ).first()
                        now = datetime.now(timezone.utc)
                        if existing:
                            existing.status = AttendanceStatus.PRESENT.value
                            existing.verification_method = VerificationMethod.FACE_RECOGNITION.value
                            existing.confidence_score = float(display_confidence)
                            existing.in_time = existing.in_time or now
                            existing.total_minutes_present = max(existing.total_minutes_present, 60.0)
                            existing.presence_ratio = 1.0
                        else:
                            new_att = AttendanceRecord(
                                session_id=effective_session_id,
                                student_id=best_student.id,
                                date=target_date,
                                period_number=timetable.period_number if timetable else 1,
                                status=AttendanceStatus.PRESENT.value,
                                verification_method=VerificationMethod.FACE_RECOGNITION.value,
                                confidence_score=float(display_confidence),
                                in_time=now,
                                total_minutes_present=60.0,
                                presence_ratio=1.0
                            )
                            db.add(new_att)
                        db.commit()
                    except Exception as att_err:
                        logger.debug(f"Face auto-attendance update error: {att_err}")

                # Avoid duplicate in recognized list
                if not any(r.student_id == best_student.id for r in recognized):
                    recognized.append(
                        RecognizedStudentItem(
                            student_id=best_student.id,
                            roll_number=best_student.student_id,
                            full_name=best_student.user.full_name,
                            confidence=display_confidence,
                            bounding_box=[int(x), int(y), int(w), int(h)],
                            liveness_score=liveness,
                            spoof_detected=is_spoof,
                            verification_method="FACE_RECOGNITION",
                            attendance_marked=True
                        )
                    )
                all_detected_faces.append(
                    DetectedFaceItem(
                        bounding_box=[int(x), int(y), int(w), int(h)],
                        is_recognized=True,
                        student_id=best_student.id,
                        roll_number=best_student.student_id,
                        full_name=best_student.user.full_name,
                        confidence=display_confidence,
                        liveness_score=liveness,
                        spoof_detected=is_spoof,
                        verification_method="FACE_RECOGNITION",
                        verification_status="PRESENT",
                        landmarks=face_landmarks
                    )
                )
            else:
                # Determine unmatched reason (Spoof / Not In Classroom / Unregistered)
                status_tag = "UNREGISTERED"
                outsider_name = None
                outsider_roll = None
                outsider_id = None
                if is_spoof:
                    status_tag = "SPOOF_ALERT"
                elif is_room_scoped:
                    # Check if enrolled student belonging to another section/classroom
                    other_query = db.query(StudentFaceEmbedding)
                    if classroom_student_ids:
                        other_query = other_query.filter(~StudentFaceEmbedding.student_id.in_(classroom_student_ids))
                    other_embs = other_query.all()
                    for oe in other_embs:
                        try:
                            ovec = json.loads(oe.embedding)
                            if compute_cosine_similarity(emb, ovec) >= SFACE_MATCH_THRESHOLD:
                                status_tag = "NOT_IN_CLASSROOM"
                                out_s = db.query(Student).filter(Student.id == oe.student_id).first()
                                if out_s:
                                    outsider_name = out_s.user.full_name
                                    outsider_roll = out_s.student_id
                                    outsider_id = out_s.id
                                break
                        except Exception:
                            pass

                all_detected_faces.append(
                    DetectedFaceItem(
                        bounding_box=[int(x), int(y), int(w), int(h)],
                        is_recognized=False,
                        student_id=outsider_id if status_tag == "NOT_IN_CLASSROOM" else None,
                        roll_number=outsider_roll if status_tag == "NOT_IN_CLASSROOM" else None,
                        full_name=f"{outsider_name} (Outside Class)" if outsider_name else None,
                        confidence=display_confidence if best_student else 0.0,
                        liveness_score=liveness,
                        spoof_detected=is_spoof,
                        verification_method="FACE_DETECTION",
                        verification_status=status_tag,
                        landmarks=face_landmarks
                    )
                )

    classroom_info = None
    if target_room:
        classroom_info = ClassroomScopingInfo(
            classroom=target_room,
            subject_code=timetable.subject.code if timetable and timetable.subject else None,
            subject_name=timetable.subject.name if timetable and timetable.subject else None,
            section=timetable.section if timetable else None,
            period_number=timetable.period_number if timetable else None,
            enrolled_count=len(classroom_student_ids) if classroom_student_ids is not None else len(student_map),
            scoped_to_classroom=is_room_scoped
        )

    return FaceRecognizeResponse(
        matched=len(recognized) > 0,
        faces_detected=len(faces),
        recognized_students=recognized,
        all_detected_faces=all_detected_faces,
        spoof_alerts=spoofs,
        scanned_barcode=scanned_barcode,
        classroom_info=classroom_info
    )

@router.post("/scan-id-card", response_model=IDCardScanResponse)
def scan_id_card_barcode(
    req: IDCardScanRequest,
    db: Session = Depends(get_db)
):
    """
    ID Card Barcode / QR Code Fallback Scanner:
    Scans camera frame for barcode/QR code or matches direct barcode string.
    Finds the matching student by roll number (`student_id`).
    """
    barcode_val = ""
    if req.barcode_data and len(req.barcode_data.strip()) > 0:
        barcode_val = req.barcode_data.strip()
    elif req.image_base64:
        image = decode_base64_image(req.image_base64)
        if image is not None:
            ok, decoded, _ = detect_and_decode_id_card(image)
            if ok:
                barcode_val = decoded

    if not barcode_val:
        return IDCardScanResponse(
            success=False,
            barcode_data="",
            message="No barcode or QR code detected. Please align the Student ID Card clearly in frame."
        )

    # Match in database by student_id / roll number
    student = db.query(Student).filter(Student.student_id == barcode_val).first()
    if not student:
        # Check if roll number without dashes/spaces matches
        student = db.query(Student).filter(Student.student_id.ilike(f"%{barcode_val}%")).first()

    if not student:
        return IDCardScanResponse(
            success=False,
            barcode_data=barcode_val,
            message=f"ID Card read ({barcode_val}) but no registered student found with this roll number."
        )

    # Log security audit entry for barcode fallback
    audit = SecurityAuditLog(
        event_type=SecurityEventType.BARCODE_FALLBACK_USED.value,
        student_id=student.id,
        details=f"Attendance marked via Student ID Card Barcode Fallback ({barcode_val})",
        timestamp=datetime.now(timezone.utc)
    )
    db.add(audit)
    db.commit()

    return IDCardScanResponse(
        success=True,
        barcode_data=barcode_val,
        student_id=student.id,
        student_name=student.user.full_name,
        roll_number=student.student_id,
        message=f"Successfully verified Student ID Card for {student.user.full_name} ({student.student_id})"
    )

@router.get("/security-logs", response_model=List[SecurityAuditResponse])
def get_security_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve security audit logs (spoofs, covered face departures, barcode usage)."""
    logs = db.query(SecurityAuditLog).order_by(SecurityAuditLog.timestamp.desc()).limit(100).all()
    return logs

@router.get("/demo-kushal-photo")
def get_demo_kushal_photo():
    """Returns base64 data URI of Kushal VR's test photo for instant offline/locked webcam testing."""
    import os, glob, base64
    candidate_paths = [
        "backend/uploads/student_photos/student_2.jpg",
        "uploads/student_photos/student_2.jpg",
        "backend/uploads/student_photos/student_1.jpg",
        "uploads/student_photos/student_1.jpg",
        "My photo for test/image.png",
        "../My photo for test/image.png",
    ]
    for p in candidate_paths:
        if os.path.exists(p):
            with open(p, "rb") as f:
                b64 = "data:image/jpeg;base64," + base64.b64encode(f.read()).decode("utf-8")
                return {"image_base64": b64, "filename": os.path.basename(p), "student_name": "Kushal VR", "roll_number": "1EW23CS065"}
    return {"image_base64": "", "filename": "", "student_name": "Kushal VR", "roll_number": "1EW23CS065"}

