import os

with open('backend/app/api/academic.py', 'r', encoding='utf-8') as f:
    text = f.read()

# Make sure settings is imported
if 'from app.core.config import settings' not in text:
    text = "from app.core.config import settings\n" + text

old_photo_fn = text[text.find('def get_student_photo'):text.find('def update_student')]

new_photo_fn = '''def get_student_photo(student_id: int, db: Session = Depends(get_db)):
    """Return trained photo for student, or generate a high-res, distinct personalized biometric avatar."""
    os.makedirs(settings.STUDENT_PHOTOS_DIR, exist_ok=True)
    
    photo_file = os.path.join(settings.STUDENT_PHOTOS_DIR, f"student_{student_id}.jpg")
    if os.path.exists(photo_file):
        return FileResponse(photo_file, media_type="image/jpeg")
    
    png_file = os.path.join(settings.STUDENT_PHOTOS_DIR, f"student_{student_id}.png")
    if os.path.exists(png_file):
        return FileResponse(png_file, media_type="image/png")

    student = db.query(Student).filter(Student.id == student_id).first()
    name = student.user.full_name if (student and student.user) else f"Student {student_id}"
    roll = student.student_id if student else f"CS-{student_id:03d}"
    dept = student.department if student else "Computer Science"
    
    # Initials
    parts = [p for p in name.split() if p]
    if len(parts) >= 2:
        initials = (parts[0][0] + parts[1][0]).upper()
    elif len(parts) == 1:
        initials = parts[0][:2].upper()
    else:
        initials = "ST"

    # Distinct, vibrant color theme per student (based on ID / roll hash)
    PALETTES = [
        {"bg1": "#1e3a8a", "bg2": "#172554", "accent": "#3b82f6", "badge": "#2563eb", "text": "#bfdbfe"}, # Blue
        {"bg1": "#065f46", "bg2": "#022c22", "accent": "#10b981", "badge": "#059669", "text": "#a7f3d0"}, # Emerald
        {"bg1": "#581c87", "bg2": "#3b0764", "accent": "#a855f7", "badge": "#7c3aed", "text": "#e9d5ff"}, # Purple
        {"bg1": "#9a3412", "bg2": "#431407", "accent": "#f97316", "badge": "#ea580c", "text": "#fed7aa"}, # Orange
        {"bg1": "#155e75", "bg2": "#083344", "accent": "#06b6d4", "badge": "#0891b2", "text": "#a5f3fc"}, # Cyan
        {"bg1": "#831843", "bg2": "#500724", "accent": "#ec4899", "badge": "#db2777", "text": "#fbcfe8"}, # Pink
        {"bg1": "#374151", "bg2": "#111827", "accent": "#6b7280", "badge": "#4b5563", "text": "#e5e7eb"}, # Slate
    ]
    pal = PALETTES[student_id % len(PALETTES)]

    # Modern, crisp SVG Biometric Student Portrait with unique colors, initials, and student info
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 280" width="240" height="280">
      <defs>
        <linearGradient id="grad_{student_id}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="{pal['bg1']}"/>
          <stop offset="100%" stop-color="{pal['bg2']}"/>
        </linearGradient>
        <radialGradient id="glow_{student_id}" cx="50%" cy="40%" r="50%">
          <stop offset="0%" stop-color="{pal['accent']}" stop-opacity="0.5"/>
          <stop offset="100%" stop-color="{pal['bg2']}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="240" height="280" fill="url(#grad_{student_id})" rx="20"/>
      <circle cx="120" cy="105" r="70" fill="url(#glow_{student_id})"/>
      
      <!-- Biometric Mesh Frame Circles -->
      <circle cx="120" cy="100" r="50" fill="none" stroke="{pal['accent']}" stroke-width="2" stroke-dasharray="4 2" opacity="0.8"/>
      <circle cx="120" cy="100" r="44" fill="{pal['bg2']}" stroke="{pal['accent']}" stroke-width="2"/>
      
      <!-- Initials -->
      <text x="120" y="112" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="34" font-weight="900" fill="#ffffff" text-anchor="middle">{initials}</text>
      
      <!-- Student Silhouette Shoulders -->
      <path d="M 45 220 C 45 165, 195 165, 195 220 Z" fill="{pal['badge']}" opacity="0.4"/>
      
      <!-- Roll Number Banner -->
      <rect x="24" y="222" width="192" height="26" rx="8" fill="{pal['badge']}" opacity="0.9"/>
      <text x="120" y="239" font-family="'Courier New', Courier, monospace" font-size="12" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="1">{roll}</text>
      
      <!-- Biometric Status Dot -->
      <circle cx="205" cy="30" r="7" fill="#10b981" stroke="#ffffff" stroke-width="2"/>
    </svg>"""
    return Response(content=svg, media_type="image/svg+xml")
'''

text = text[:text.find('def get_student_photo')] + new_photo_fn + text[text.find('def update_student'):]

with open('backend/app/api/academic.py', 'w', encoding='utf-8') as f:
    f.write(text)

print("Updated get_student_photo in academic.py")
