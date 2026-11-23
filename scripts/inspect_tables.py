import os
import sys
import sqlite3

sqlite_path = "backend/attendance.db"
if not os.path.exists(sqlite_path):
    sqlite_path = "attendance.db"

conn = sqlite3.connect(sqlite_path)
cur = conn.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
tables = [r[0] for r in cur.fetchall()]
print(f"=== Tables in {sqlite_path} ===")
for t in tables:
    try:
        cur.execute(f"SELECT count(*) FROM {t}")
        cnt = cur.fetchone()[0]
        print(f"  {t}: {cnt} rows")
    except Exception as e:
        print(f"  {t}: error {e}")
conn.close()
