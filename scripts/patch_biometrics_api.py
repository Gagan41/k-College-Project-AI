import os

with open('backend/app/api/biometrics.py', 'r', encoding='utf-8') as f:
    content = f.read()

target = """    # Update Student record
    student.biometric_enrolled = True
    student.biometric_face_count = len(saved_embeddings)
    db.commit()"""

replacement = """    # Save primary photo on disk for ID card & display
    try:
        os.makedirs("uploads/student_photos", exist_ok=True)
        photo_save_path = f"uploads/student_photos/student_{student.id}.jpg"
        if 'face_crop' in locals() and face_crop is not None and face_crop.size > 0:
            cv2.imwrite(photo_save_path, face_crop)
        elif 'image' in locals() and image is not None and image.size > 0:
            cv2.imwrite(photo_save_path, image)
        student.photo_url = f"/api/academic/students/{student.id}/photo"
    except Exception as e:
        logger.warning(f"Failed to save student photo to disk: {e}")

    # Update Student record
    student.biometric_enrolled = True
    student.biometric_face_count = len(saved_embeddings)
    db.commit()"""

if target in content:
    content = content.replace(target, replacement)
    with open('backend/app/api/biometrics.py', 'w', encoding='utf-8') as f:
        f.write(content)
    print('Updated biometrics.py')
else:
    print('Target not found in biometrics.py')

