import os
import cv2
import base64
import numpy as np
import cloudinary
import cloudinary.uploader
import cloudinary.utils
from app.core.config import settings
from app.core.logging import logger

# Initialize Cloudinary configuration
cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
    secure=True
)

def upload_student_photo_to_cloudinary(
    image_input,
    student_id: int,
    roll_number: str = ""
) -> str | None:
    """
    Uploads a student's front-side facial photo to Cloudinary.
    Accepts:
      - base64 data URI string ("data:image/jpeg;base64,...")
      - OpenCV BGR numpy array
      - raw bytes
      - file path string
    Returns:
      The HTTPS Cloudinary secure URL with face-centered square cropping and auto-optimization.
    """
    try:
        data_to_upload = None

        if isinstance(image_input, np.ndarray):
            # Encode OpenCV numpy array to JPEG base64
            success, buffer = cv2.imencode(".jpg", image_input)
            if success:
                b64 = base64.b64encode(buffer).decode("utf-8")
                data_to_upload = f"data:image/jpeg;base64,{b64}"
        elif isinstance(image_input, str):
            if image_input.startswith("data:image") or os.path.exists(image_input):
                data_to_upload = image_input
            elif len(image_input) > 200:
                data_to_upload = f"data:image/jpeg;base64,{image_input}"
        elif isinstance(image_input, bytes):
            b64 = base64.b64encode(image_input).decode("utf-8")
            data_to_upload = f"data:image/jpeg;base64,{b64}"

        if not data_to_upload:
            logger.warning(f"Cloudinary: invalid image input for student {student_id}")
            return None

        public_id = f"student_{student_id}"
        folder = "cctv_attendance_ledger/student_photos"

        upload_result = cloudinary.uploader.upload(
            data_to_upload,
            public_id=public_id,
            folder=folder,
            overwrite=True,
            resource_type="image",
            context=f"student_id={student_id}|roll_number={roll_number}"
        )

        full_public_id = upload_result.get("public_id")
        secure_url = upload_result.get("secure_url")

        # Create optimized square delivery URL preserving the complete face
        try:
            optimized_url, _ = cloudinary.utils.cloudinary_url(
                full_public_id,
                crop="fill",
                gravity="faces",
                width=600,
                height=600,
                fetch_format="auto",
                quality="auto",
                secure=True
            )
            if optimized_url:
                logger.info(f"Cloudinary upload successful for student {student_id}: {optimized_url}")
                return optimized_url
        except Exception as e:
            logger.warning(f"Could not build transformed Cloudinary URL: {e}")

        logger.info(f"Cloudinary upload successful for student {student_id}: {secure_url}")
        return secure_url

    except Exception as exc:
        logger.error(f"Cloudinary upload failed for student {student_id}: {exc}")
        return None
