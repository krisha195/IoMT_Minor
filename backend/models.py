from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class VitalsPayload(BaseModel):
    patient_id: int
    hr: Optional[float] = None
    spo2: Optional[float] = None
    temperature: Optional[float] = None
    ax: Optional[float] = 0.0
    ay: Optional[float] = 0.0
    az: Optional[float] = 0.0
    motion_score: Optional[float] = 0.0
    motion_status: Optional[str] = 'STABLE'
    finger_detected: Optional[bool] = True

class LoginRequest(BaseModel):
    username: str
    password: str = Field(min_length=6, max_length=72)
    role: Optional[str] = 'patient'

class MessageRequest(BaseModel):
    sender_id: int
    receiver_id: int
    message: str

class CareStatusUpdate(BaseModel):
    care_status: str
    surgery_name: Optional[str] = None
    primary_diagnosis: Optional[str] = None
    baseline_hr: Optional[float] = None
    baseline_spo2: Optional[float] = None
    baseline_temp: Optional[float] = None

class CareTaskCreate(BaseModel):
    title: str
    category: Optional[str] = 'General'
    instructions: Optional[str] = ''
    scheduled_time: Optional[str] = ''
    priority: Optional[str] = 'medium'
    due_date: Optional[str] = None
    assigned_to_user_id: Optional[int] = None

class MedicationCreate(BaseModel):
    name: str
    dosage: str
    frequency: str
    scheduled_timings: Optional[str] = ''
    instructions: Optional[str] = ''
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: Optional[str] = 'active'
    source: Optional[str] = 'discharge'

class ReconciliationResolve(BaseModel):
    resolution_notes: str

class SurgeryHistoryCreate(BaseModel):
    procedure_name: str
    procedure_date: str
    indication: str
    hospital_name: Optional[str] = None
    admission_date: Optional[str] = None
    discharge_date: Optional[str] = None
    discharge_summary: Optional[str] = None
    doctor_instructions: Optional[str] = None
    medication_changes: Optional[str] = None
    followup_appointments: Optional[List[Dict[str, Any]]] = []
    recovery_milestones: Optional[List[Dict[str, Any]]] = []
    outcomes: Optional[str] = None

class MilestoneUpdate(BaseModel):
    milestone_index: int
    status: str

class AssessmentCreate(BaseModel):
    clinical_notes: str
    overall_status: Optional[str] = 'on_track'
    plan_adjustments: Optional[str] = None

class CaregiverLink(BaseModel):
    caregiver_username: str
    relationship: str
    phone: Optional[str] = None
    can_complete_tasks: Optional[bool] = True
    can_view_vitals: Optional[bool] = True

class CopilotQuery(BaseModel):
    question: str
