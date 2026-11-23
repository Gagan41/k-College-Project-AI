from sqlalchemy import create_engine, text
url = 'postgresql://postgres.wxzvojhljxbelkiwqcze:SmartCampus2026!@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres'
eng = create_engine(url)
with eng.connect() as conn:
    print('=== QUERYING SUPABASE LIVE TABLES ===')
    for tbl in ['users', 'courses', 'classrooms', 'course_sections', 'faculty', 'subjects', 'students', 'cameras', 'security_audit_logs']:
        res = conn.execute(text(f'SELECT count(*) FROM "{tbl}"')).scalar()
        print(f'  {tbl}: {res} rows in Supabase')
