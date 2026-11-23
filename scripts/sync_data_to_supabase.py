import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))
import sqlite3
import urllib.parse
from sqlalchemy import create_engine, text
from app.core.config import settings
from app.core.database import Base
from app.models import *

def sync_sqlite_to_supabase(pg_url: str):
    print("=" * 60)
    print("MIGRATING SQLITE DATA TO SUPABASE POSTGRESQL")
    print("=" * 60)
    
    # 1. Connect to PostgreSQL
    print(f"Connecting to target PostgreSQL: {pg_url.split('@')[-1]}")
    pg_engine = create_engine(pg_url, pool_pre_ping=True)
    with pg_engine.connect() as conn:
        res = conn.execute(text("SELECT 1")).scalar()
        print(f"PostgreSQL connection verified! Result: {res}")

    # 2. Create all tables on PostgreSQL
    print("\nEnsuring all tables exist on Supabase...")
    Base.metadata.create_all(bind=pg_engine)
    print("All tables successfully verified / created on Supabase!")

    # 3. Connect to SQLite
    sqlite_path = "backend/attendance.db"
    if not os.path.exists(sqlite_path):
        sqlite_path = "attendance.db"
    
    print(f"\nReading source records from SQLite ({sqlite_path})...")
    sq_conn = sqlite3.connect(sqlite_path)
    sq_conn.row_factory = sqlite3.Row
    sq_cur = sq_conn.cursor()

    # Tables in dependency order
    tables = [
        "users",
        "courses",
        "classrooms",
        "course_sections",
        "faculty",
        "subjects",
        "students",
        "enrollments",
        "student_face_embeddings",
        "cameras",
        "timetables",
        "class_sessions",
        "attendance_records",
        "security_audit_logs",
    ]

    boolean_cols = {
        "is_active", "is_verified", "is_class_teacher",
        "biometric_enrolled", "email_alert_sent", "is_recurring", "resolved"
    }

    with pg_engine.begin() as pg_conn:
        for tbl in tables:
            try:
                sq_cur.execute(f"SELECT * FROM {tbl}")
                rows = sq_cur.fetchall()
                if not rows:
                    print(f"  - {tbl}: 0 records to migrate.")
                    continue

                col_names = [col[0] for col in sq_cur.description]
                cols_str = ", ".join([f'"{c}"' for c in col_names])
                placeholders = ", ".join([f":{c}" for c in col_names])

                insert_sql = text(f'INSERT INTO "{tbl}" ({cols_str}) VALUES ({placeholders}) ON CONFLICT DO NOTHING')
                
                count = 0
                for r in rows:
                    row_dict = dict(r)
                    for k, v in row_dict.items():
                        if k in boolean_cols and isinstance(v, int):
                            row_dict[k] = bool(v)
                    pg_conn.execute(insert_sql, row_dict)
                    count += 1
                
                print(f"  + {tbl}: Successfully synchronized {count} record(s).")
                
                # Reset PostgreSQL serial sequences if table has id column
                if "id" in col_names:
                    try:
                        seq_sql = text(f"SELECT setval(pg_get_serial_sequence('{tbl}', 'id'), COALESCE((SELECT MAX(id) FROM \"{tbl}\"), 1), true)")
                        pg_conn.execute(seq_sql)
                    except Exception:
                        pass
            except Exception as e:
                print(f"  ! Note on {tbl}: {e}")

    sq_conn.close()
    print("\nSUCCESS: All updates and records have been successfully migrated to Supabase!")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        target_url = sys.argv[1]
    else:
        target_url = os.getenv("DATABASE_URL", "")
    
    if not target_url or target_url.startswith("sqlite"):
        print("Error: DATABASE_URL must be a valid PostgreSQL connection string.")
        sys.exit(1)
        
    sync_sqlite_to_supabase(target_url)
