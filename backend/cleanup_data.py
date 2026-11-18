import sys, os
sys.path.insert(0, 'backend')
from app.core.database import SessionLocal, engine
from sqlalchemy import text
from app.core.security import get_password_hash

db = SessionLocal()
print("Starting data purge as requested by user...")

# Delete in proper foreign-key order
tables_to_purge = [
    "attendance_records",
    "class_sessions",
    "timetables",
    "student_face_embeddings",
    "enrollments",
    "subjects",
    "course_sections",
    "courses",
    "classrooms",
    "students",
    "faculty",
    "security_audit_logs",
]


for tbl in tables_to_purge:
    try:
        db.execute(text(f"DELETE FROM {tbl}"))
        print(f"Perged table: {tbl}")
    except Exception as e:
        print(f"Error clearing {tbl}: {e}")


# Remove super admin login (bushalvr12@gmail.com) and all other non-admin users
db.execute(text("DELETE FROM users WHERE email != 'cortinexwebstudio@gmail.com' AND email != 'admin@attendance.edu'"))

# Ensure cortinexwebstudio@gmail.com exists with role ADMIN and password admin123
admin = db.execute(text("SELECT id, email FROM users WHERE email = 'cortinexwebstudio@gmail.com'")).fetchone()
p_hash = get_password_hash("admin123")
if not admin:
    db.execute(text(f"""INSERT INTO users (email, full_name, hashed_password, role, is_active, is_verified) VALUES ('cortinexwebstudio@gmail.com', 'System Administrator', '{p_hash}', 'ADMIN', 1, 1)""")
    print("Seeded cortinexwebstudio@gmail.com as primary Admin")
else:
    db.execute(text(f"""UPDATE users SET hashed_password = '{p_hash}', role = 'ADMIN', is_active = 1, is_verified = 1 WHERE email = 'cortinexwebstudio@gmail.com'""")
    print("Updated cortinexwebstudio@gmail.com password & role")

db.commit()

# Verify final rows for everything
all_tables = tables_to_purge + ["users"]
for t in all_tables:
    c = db.execute(text(f"SELECT count(*) FROM {t}")).scalar()
    print(f"  -> {t}: {c}")

remaining_users = db.execute(text("SELECT id, email, role, full_name FROM users")).fetchall()
print("Remaining users in database:", remaining_users)
db.close()
print("Development data purge complete!")
