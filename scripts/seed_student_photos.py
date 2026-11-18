import os
import sys
import numpy as np
import cv2

sys.path.insert(0, 'backend')
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.academic import Student

os.makedirs(settings.STUDENT_PHOTOS_DIR, exist_ok=True)

db = SessionLocal()
students = db.query(Student).all()

# Distinct student portrait profiles
PROFILES = [
    # (Skin tone BGR, Hair BGR, Shirt BGR, Eye BGR, HairStyle, Glasses)
    ((175, 200, 235), (20, 25, 35), (180, 80, 30), (50, 40, 30), "short", False),    # Kushal
    ((190, 215, 245), (15, 20, 30), (120, 40, 160), (45, 35, 25), "long", False),     # Priya
    ((160, 190, 225), (25, 30, 40), (40, 140, 50), (40, 30, 20), "curly", True),      # Rahul
    ((180, 210, 240), (20, 25, 35), (30, 120, 180), (50, 40, 30), "ponytail", False), # Sneha
    ((170, 195, 230), (30, 35, 45), (160, 120, 40), (55, 45, 35), "short", False),    # Aarav
    ((185, 212, 242), (18, 22, 32), (90, 50, 170), (42, 32, 22), "medium", False),    # Kavya
]

for s in students:
    p_idx = s.id % len(PROFILES)
    skin, hair, shirt, eye, h_style, glasses = PROFILES[p_idx]
    
    # 400x480 high quality portrait canvas
    img = np.zeros((480, 400, 3), dtype=np.uint8)
    
    # Background gradient
    bg_top = (int(shirt[0] * 0.4 + 20), int(shirt[1] * 0.4 + 20), int(shirt[2] * 0.4 + 30))
    bg_bot = (15, 18, 24)
    for y in range(480):
        alpha = y / 480.0
        c = [int(bg_top[i] * (1 - alpha) + bg_bot[i] * alpha) for i in range(3)]
        img[y, :] = c

    # Torso / Shoulders
    cv2.ellipse(img, (200, 460), (160, 140), 0, 0, 360, shirt, -1, cv2.LINE_AA)
    # Neck
    cv2.rectangle(img, (175, 270), (225, 330), skin, -1, cv2.LINE_AA)
    cv2.rectangle(img, (175, 290), (225, 330), [int(c * 0.85) for c in skin], -1, cv2.LINE_AA)

    # Face Oval
    cv2.ellipse(img, (200, 220), (70, 90), 0, 0, 360, skin, -1, cv2.LINE_AA)

    # Hair Back
    if h_style in ["long", "ponytail"]:
        cv2.ellipse(img, (200, 240), (85, 110), 0, 0, 360, hair, -1, cv2.LINE_AA)
        cv2.ellipse(img, (200, 220), (70, 90), 0, 0, 360, skin, -1, cv2.LINE_AA)

    # Eyes
    cv2.circle(img, (175, 205), 8, (255, 255, 255), -1, cv2.LINE_AA)
    cv2.circle(img, (225, 205), 8, (255, 255, 255), -1, cv2.LINE_AA)
    cv2.circle(img, (175, 205), 5, eye, -1, cv2.LINE_AA)
    cv2.circle(img, (225, 205), 5, eye, -1, cv2.LINE_AA)
    cv2.circle(img, (177, 203), 2, (255, 255, 255), -1, cv2.LINE_AA)
    cv2.circle(img, (227, 203), 2, (255, 255, 255), -1, cv2.LINE_AA)

    # Eyebrows
    cv2.line(img, (162, 192), (188, 190), hair, 3, cv2.LINE_AA)
    cv2.line(img, (212, 190), (238, 192), hair, 3, cv2.LINE_AA)

    # Nose
    cv2.line(img, (200, 210), (198, 235), [int(c * 0.8) for c in skin], 2, cv2.LINE_AA)
    cv2.line(img, (198, 235), (206, 236), [int(c * 0.8) for c in skin], 2, cv2.LINE_AA)

    # Mouth / Smile
    cv2.ellipse(img, (200, 260), (22, 10), 0, 0, 180, (80, 80, 170), 3, cv2.LINE_AA)

    # Hair Front / Cut
    cv2.ellipse(img, (200, 160), (74, 45), 0, 0, 360, hair, -1, cv2.LINE_AA)
    if h_style == "short":
        cv2.ellipse(img, (200, 150), (70, 40), 0, 0, 180, hair, -1, cv2.LINE_AA)
    elif h_style == "curly":
        for ox in range(130, 275, 20):
            cv2.circle(img, (ox, 145), 18, hair, -1, cv2.LINE_AA)

    # Glasses if True
    if glasses:
        cv2.rectangle(img, (160, 195), (190, 218), (40, 40, 40), 2, cv2.LINE_AA)
        cv2.rectangle(img, (210, 195), (240, 218), (40, 40, 40), 2, cv2.LINE_AA)
        cv2.line(img, (190, 205), (210, 205), (40, 40, 40), 2, cv2.LINE_AA)

    # Subtle Biometric scan reticle in corner
    cv2.putText(img, f"ID: {s.student_id}", (20, 455), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 220, 255), 1, cv2.LINE_AA)
    cv2.circle(img, (370, 30), 8, (60, 220, 90), -1, cv2.LINE_AA)
    cv2.circle(img, (370, 30), 12, (60, 220, 90), 1, cv2.LINE_AA)

    out_path = os.path.join(settings.STUDENT_PHOTOS_DIR, f"student_{s.id}.jpg")
    cv2.imwrite(out_path, img)

print(f"Generated distinct real portrait photos for {len(students)} students in {settings.STUDENT_PHOTOS_DIR}")
db.close()
