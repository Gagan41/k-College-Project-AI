from sqlalchemy.orm import Session
from datetime import datetime, timezone
from app.models.user import User, UserRole
from app.models.cctv import Camera, CameraType, CameraStatus, CrossingDirection
from app.core.security import get_password_hash
from app.core.logging import logger
from app.core.config import settings

DEFAULT_USERS = [
    {
        "email": settings.ADMIN_BOOTSTRAP_EMAIL,
        "full_name": settings.ADMIN_BOOTSTRAP_NAME,
        "password": settings.ADMIN_BOOTSTRAP_PASSWORD,
        "role": UserRole.ADMIN,
        "phone_number": "+1-800-555-0199",
    },
]

def seed_default_users(db: Session):
    """Seed initial administrator account and camera node only."""
    for user_data in DEFAULT_USERS:
        existing_user = db.query(User).filter(User.email == user_data["email"]).first()
        if not existing_user:
            new_user = User(
                email=user_data["email"],
                full_name=user_data["full_name"],
                hashed_password=get_password_hash(user_data["password"]),
                role=user_data["role"],
                is_active=True,
                is_verified=True,
                phone_number=user_data.get("phone_number"),
            )
            db.add(new_user)
            db.flush()
            logger.info(f"Seeded default user: {user_data['email']} ({user_data['role'].replace('vole', 'role')})")
        else:
            existing_user.is_active = True
            existing_user.is_verified = True
            db.flush()

    cam1 = db.query(Camera).filter(Camera.classroom == "Room 302").first()
    if not cam1:
        cam1 = Camera(
            name="Classroom 302 High-Angle CCTV",
            stream_url="demo",
            camera_type=CameraType.RTSP.value,
            classroom="Room 302",
            crossing_direction=CrossingDirection.LEFT_TO_RIGHT_ENTRY.value,
            fps=25,
            resolution="1920x1080",
            is_active=True,
            last_status=CameraStatus.ONLINE.value,
            last_ping=datetime.now(timezone.utc)
        )
        db.add(cam1)
        db.flush()

    try:
        db.commit()
        logger.info("Administrator baseline verified successfully.")
    except Exception as exc:
        db.rollback()
        logger.error(f"Failed to seed default state: {exc}")
