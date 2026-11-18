with open('backend/app/core/config.py', 'r', encoding='utf-8') as f:
    text = f.read()

target = "    ENVIRONMENT: str = os.getenv(\"ENVIRONMENT\", \"development\")"
replacement = """    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    ROOT_DIR: str = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    STUDENT_PHOTOS_DIR: str = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "uploads", "student_photos")"""

if target in text and 'STUDENT_PHOTOS_DIR' not in text:
    text = text.replace(target, replacement)
    with open('backend/app/core/config.py', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Added STUDENT_PHOTOS_DIR to config.py")
else:
    print("Already present or target not found")
