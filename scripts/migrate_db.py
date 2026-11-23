import sqlite3
import shutil

def migrate_db(db_path):
    print(f"Migrating {db_path}...")
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    cur.execute("PRAGMA foreign_keys=OFF")
    
    # 1. Recreate timetables table with nullable faculty_id and nullable classroom
    cur.execute("""
    CREATE TABLE IF NOT EXISTS timetables_new (
        id INTEGER NOT NULL PRIMARY KEY,
        subject_id INTEGER NOT NULL,
        faculty_id INTEGER NULL,
        camera_id INTEGER NULL,
        day_of_week VARCHAR(20) NOT NULL,
        period_number INTEGER NOT NULL DEFAULT 1,
        start_time VARCHAR(10) NOT NULL,
        end_time VARCHAR(10) NOT NULL,
        classroom VARCHAR(100) NULL DEFAULT 'Unassigned',
        section VARCHAR(10) NOT NULL DEFAULT 'A',
        batch_year VARCHAR(20) NOT NULL DEFAULT '2023-2027',
        is_recurring BOOLEAN NOT NULL DEFAULT 1,
        single_date VARCHAR(20) NULL,
        is_active BOOLEAN NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        FOREIGN KEY(subject_id) REFERENCES subjects (id) ON DELETE CASCADE,
        FOREIGN KEY(faculty_id) REFERENCES faculty (id) ON DELETE SET NULL,
        FOREIGN KEY(camera_id) REFERENCES cameras (id) ON DELETE SET NULL
    )
    """)
    
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='timetables'")
    if cur.fetchone():
        cur.execute("PRAGMA table_info(timetables)")
        old_cols = [c[1] for c in cur.fetchall()]
        common_cols = [c for c in ['id', 'subject_id', 'faculty_id', 'camera_id', 'day_of_week', 'period_number', 'start_time', 'end_time', 'classroom', 'section', 'batch_year', 'is_recurring', 'single_date', 'is_active', 'created_at', 'updated_at'] if c in old_cols]
        cols_str = ', '.join(common_cols)
        cur.execute(f"INSERT INTO timetables_new ({cols_str}) SELECT {cols_str} FROM timetables")
        cur.execute("DROP TABLE timetables")
        
    cur.execute("ALTER TABLE timetables_new RENAME TO timetables")
    cur.execute("CREATE INDEX IF NOT EXISTS ix_timetables_faculty_id ON timetables (faculty_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS ix_timetables_subject_id ON timetables (subject_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS ix_timetables_id ON timetables (id)")
    
    # 2. Delete Alan Turing from faculty and users, update dummy timetables
    cur.execute("UPDATE timetables SET faculty_id = NULL WHERE faculty_id = 1")
    cur.execute("DELETE FROM faculty WHERE employee_id = 'FAC-001' OR user_id IN (SELECT id FROM users WHERE email = 'faculty@attendance.edu')")
    cur.execute("DELETE FROM users WHERE email = 'faculty@attendance.edu'")
    
    # 3. Clean seeded dummy course_sections
    cur.execute("DELETE FROM course_sections WHERE name IN ('CS1', 'CS2', 'Sec A', 'Sec B', 'IS1', 'IS2', 'EC1', 'EC2', 'EE1', 'EE2')")
    
    # 4. Check if Kushal VR exists in users and faculty
    cur.execute("SELECT id FROM users WHERE email = 'kushalvr15@gmail.com'")
    kushal_user = cur.fetchone()
    if kushal_user:
        u_id = kushal_user[0]
        cur.execute("SELECT id FROM faculty WHERE user_id = ?", (u_id,))
        if not cur.fetchone():
            cur.execute("""
            INSERT INTO faculty (user_id, employee_id, department, designation, is_class_teacher, class_teacher_section, class_teacher_semester, created_at, updated_at)
            VALUES (?, 'FAC-002', 'Computer Science & Engineering', 'Assistant Professor', 0, NULL, NULL, datetime('now'), datetime('now'))
            """, (u_id,))
            print(f"Added Kushal VR to faculty table in {db_path}")

    conn.commit()
    conn.close()
    print(f"Migration complete for {db_path}")

if __name__ == '__main__':
    migrate_db('backend/attendance.db')
    shutil.copy2('backend/attendance.db', 'attendance.db')
    print("Synchronized attendance.db and backend/attendance.db successfully!")
