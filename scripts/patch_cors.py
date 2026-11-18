import os

with open('backend/app/main.py', 'r', encoding='utf-8') as f:
    code = f.read()

old_cors = """# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)"""

new_cors = """# CORS middleware
cors_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://[::1]:3000",
]
if settings.CORS_ORIGINS:
    for o in settings.CORS_ORIGINS:
        if o not in cors_origins:
            cors_origins.append(o)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|\[::1\])(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)"""

if old_cors in code:
    code = code.replace(old_cors, new_cors)
    with open('backend/app/main.py', 'w', encoding='utf-8') as f:
        f.write(code)
    print("Updated CORS in main.py")
else:
    print("Old CORS not found")

