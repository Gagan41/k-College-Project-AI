with open('backend/app/api/biometrics.py', 'r', encoding='utf-8') as f:
    text = f.read()

# Make sure settings is imported
if 'from app.core.config import settings' not in text:
    text = "from app.core.config import settings\n" + text

old_save = """    try:
        os.makedirs("uploads/student_photos", exist_ok=True)
        photo_save_path = f"uploads/student_photos/student_{student.id}.jpg"
        if 'face_crop' in locals() and face_crop is not None and face_crop.size > 0:
            cv2.imwrite(photo_save_path, face_crop)
        elif 'image' in locals() and image is not None and image.size > 0:
            cv2.imwrite(photo_save_path, image)
        student.photo_url = f"/api/academic/students/{student.id}/photo"
    except Exception as e:
        logger.warning(f"Failed to save student photo to disk: {e}")"""

new_save = """    try:
        os.makedirs(settings.STUDENT_PHOTOS_DIR, exist_ok=True)
        photo_save_path = os.path.join(settings.STUDENT_PHOTOS_DIR, f"student_{student.id}.jpg")
        if 'face_crop' in locals() and face_crop is not None and face_crop.size > 0:
            cv2.imwrite(photo_save_path, face_crop)
        elif 'image' in locals() and image is not None and image.size > 0:
            cv2.imwrite(photo_save_path, image)
        student.photo_url = f"/api/academic/students/{student.id}/photo"
    except Exception as e:
        logger.warning(f"Failed to save student photo to disk: {e}")"""

if old_save in text:
    text = text.replace(old_save, new_save)
    with open('backend/app/api/biometrics.py', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Updated biometrics.py save path")
else:
    print("old_save not found in biometrics.py")
