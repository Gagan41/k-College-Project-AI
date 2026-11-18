from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime

class FaceEnrollRequest(BaseModel):
    student_id: int = Field(..., description="ID of the student to enroll")
    image_base64: Optional[str] = Field(None, description="Base64 encoded JPEG/PNG frame (single capture)")
    images_base64: Optional[List[str]] = Field(None, description="List of Base64 encoded frames (multi-angle captures: Front, Left, Right)")
    front_image_base64: Optional[str] = Field(None, description="Base64 encoded Front profile photo to save as official student avatar")

class FaceEnrollResponse(BaseModel):
    success: bool
    student_id: int
    student_name: str
    roll_number: str
    quality_score: float
    liveness_score: float
    total_faces_enrolled: int
    photo_url: Optional[str] = None
    message: str

class FaceRecognizeRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded camera frame")
    camera_id: Optional[int] = None
    session_id: Optional[int] = None
    timetable_id: Optional[int] = None
    classroom: Optional[str] = None
    auto_attendance: Optional[bool] = False

class ClassroomScopingInfo(BaseModel):
    classroom: Optional[str] = None
    subject_code: Optional[str] = None
    subject_name: Optional[str] = None
    section: Optional[str] = None
    period_number: Optional[int] = None
    enrolled_count: int = 0
    scoped_to_classroom: bool = False

class RecognizedStudentItem(BaseModel):
    student_id: int
    roll_number: str
    full_name: str
    confidence: float
    bounding_box: List[int]  # [x, y, w, h]
    liveness_score: float
    spoof_detected: bool
    verification_method: str = "FACE_RECOGNITION"
    attendance_marked: bool = True

class DetectedFaceItem(BaseModel):
    bounding_box: List[int]  # [x, y, w, h]
    is_recognized: bool
    student_id: Optional[int] = None
    roll_number: Optional[str] = None
    full_name: Optional[str] = None
    confidence: float = 0.0
    liveness_score: float = 0.0
    spoof_detected: bool = False
    verification_method: str = "FACE_RECOGNITION"
    verification_status: str = "UNMATCHED"  # "PRESENT", "NOT_IN_CLASSROOM", "SPOOF_ALERT", "UNREGISTERED"
    landmarks: Optional[List[List[float]]] = None  # [[x, y], ...]

class IDCardScanRequest(BaseModel):
    image_base64: Optional[str] = None
    barcode_data: Optional[str] = None
    session_id: Optional[int] = None

class IDCardScanResponse(BaseModel):
    success: bool
    barcode_data: str
    student_id: Optional[int] = None
    student_name: Optional[str] = None
    roll_number: Optional[str] = None
    message: str

class FaceRecognizeResponse(BaseModel):
    matched: bool
    faces_detected: int
    recognized_students: List[RecognizedStudentItem]
    all_detected_faces: List[DetectedFaceItem] = []
    spoof_alerts: List[str] = []
    scanned_barcode: Optional[IDCardScanResponse] = None
    classroom_info: Optional[ClassroomScopingInfo] = None

class SecurityAuditResponse(BaseModel):
    id: int
    event_type: str
    camera_id: Optional[int] = None
    student_id: Optional[int] = None
    photo_proof_path: Optional[str] = None
    details: Optional[str] = None
    email_alert_sent: bool
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)
