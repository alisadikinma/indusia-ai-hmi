# FASE 9: FastAPI Training Service

## Role
You are a senior Python backend developer building a FastAPI microservice for INDUSIA AI HMI - orchestrating ML training jobs on Modal.com with GPU infrastructure.

## Context
INDUSIA AI HMI training pipeline:
- FastAPI service as orchestration layer
- Modal.com for serverless GPU training
- Supabase for data storage
- YOLOv10 for PCB defect detection

This is a SEPARATE Python project from the Next.js frontend.

Working directory: `C:\xampp\htdocs\indusia-ai-hmi\fastapi-service`

## Objective
Build FastAPI microservice yang orchestrate training jobs ke Modal.com, track status, dan manage trained models.

## Project Structure
```
fastapi-service/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app entry
│   ├── config.py               # Environment config
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── training.py         # Training job endpoints
│   │   ├── models.py           # Model management endpoints
│   │   └── datasets.py         # Dataset endpoints
│   ├── services/
│   │   ├── __init__.py
│   │   ├── modal_client.py     # Modal.com integration
│   │   ├── supabase_client.py  # Supabase integration
│   │   └── training_service.py # Training orchestration
│   └── schemas/
│       ├── __init__.py
│       ├── training.py         # Pydantic models
│       └── models.py
├── requirements.txt
├── Dockerfile
├── .env.example
└── README.md
```

## Tasks

### 9.1 Setup Project
Create `requirements.txt`:
```
fastapi>=0.104.0
uvicorn[standard]>=0.24.0
pydantic>=2.5.0
python-dotenv>=1.0.0
supabase>=2.0.0
modal>=0.56.0
httpx>=0.25.0
python-multipart>=0.0.6
```

Create `app/config.py`:
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Supabase
    supabase_url: str
    supabase_service_key: str
    
    # Modal
    modal_token_id: str
    modal_token_secret: str
    
    # API Security
    api_key: str
    
    class Config:
        env_file = ".env"

settings = Settings()
```

### 9.2 Create Main FastAPI App
Create `app/main.py`:
```python
from fastapi import FastAPI, Depends, HTTPException, Security
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import training, models, datasets

app = FastAPI(
    title="INDUSIA AI Training Service",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Key auth
api_key_header = APIKeyHeader(name="X-API-Key")

async def verify_api_key(api_key: str = Security(api_key_header)):
    if api_key != settings.api_key:
        raise HTTPException(status_code=403, detail="Invalid API Key")
    return api_key

# Routers
app.include_router(
    training.router,
    prefix="/training",
    tags=["Training"],
    dependencies=[Depends(verify_api_key)]
)
app.include_router(
    models.router,
    prefix="/models",
    tags=["Models"],
    dependencies=[Depends(verify_api_key)]
)
app.include_router(
    datasets.router,
    prefix="/datasets",
    tags=["Datasets"],
    dependencies=[Depends(verify_api_key)]
)

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
```

### 9.3 Create Supabase Client
Create `app/services/supabase_client.py`:
```python
from supabase import create_client
from app.config import settings

supabase = create_client(
    settings.supabase_url,
    settings.supabase_service_key
)

# Training jobs
async def create_training_job(job_data: dict):
    return supabase.table("training_jobs").insert(job_data).execute()

async def update_training_job(job_id: str, data: dict):
    return supabase.table("training_jobs").update(data).eq("job_id", job_id).execute()

async def get_training_job(job_id: str):
    return supabase.table("training_jobs").select("*").eq("job_id", job_id).single().execute()

# Metrics
async def save_metrics(metrics: dict):
    return supabase.table("training_metrics").insert(metrics).execute()

# Models
async def create_model(model_data: dict):
    return supabase.table("ai_models").insert(model_data).execute()

async def update_model(model_id: str, data: dict):
    return supabase.table("ai_models").update(data).eq("id", model_id).execute()
```

### 9.4 Create Training Router
Create `app/routers/training.py`:
```python
from fastapi import APIRouter, HTTPException
from app.schemas.training import TrainingRequest, TrainingResponse, JobStatus
from app.services import training_service

router = APIRouter()

@router.post("/submit", response_model=TrainingResponse)
async def submit_training_job(request: TrainingRequest):
    """Submit new training job to Modal.com"""
    job = await training_service.submit_job(request)
    return job

@router.get("/status/{job_id}", response_model=JobStatus)
async def get_job_status(job_id: str):
    """Get training job status"""
    status = await training_service.get_job_status(job_id)
    if not status:
        raise HTTPException(status_code=404, detail="Job not found")
    return status

@router.post("/cancel/{job_id}")
async def cancel_job(job_id: str):
    """Cancel running training job"""
    result = await training_service.cancel_job(job_id)
    return {"success": result}

@router.get("/metrics/{job_id}")
async def get_job_metrics(job_id: str):
    """Get training metrics for job"""
    metrics = await training_service.get_metrics(job_id)
    return metrics
```

### 9.5 Create Pydantic Schemas
Create `app/schemas/training.py`:
```python
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class TrainingRequest(BaseModel):
    dataset_id: str
    base_model: str = "yolov10n.pt"
    epochs: int = 100
    batch_size: int = 16
    image_size: int = 640
    learning_rate: float = 0.01
    created_by: str

class TrainingResponse(BaseModel):
    job_id: str
    modal_call_id: Optional[str]
    status: str
    message: str

class JobStatus(BaseModel):
    job_id: str
    status: str  # pending, queued, running, completed, failed
    progress: Optional[float]
    current_epoch: Optional[int]
    total_epochs: Optional[int]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    error_message: Optional[str]

class TrainingMetrics(BaseModel):
    epoch: int
    train_loss: float
    val_loss: float
    map50: float
    map50_95: float
```

### 9.6 Create Training Service
Create `app/services/training_service.py`:
```python
import uuid
from datetime import datetime
from app.services import supabase_client, modal_client

async def submit_job(request):
    job_id = str(uuid.uuid4())
    
    # Save to database
    await supabase_client.create_training_job({
        "job_id": job_id,
        "dataset_id": request.dataset_id,
        "status": "pending",
        "config": {
            "base_model": request.base_model,
            "epochs": request.epochs,
            "batch_size": request.batch_size,
            "image_size": request.image_size,
            "learning_rate": request.learning_rate
        },
        "base_model": request.base_model,
        "epochs": request.epochs,
        "batch_size": request.batch_size,
        "image_size": request.image_size,
        "created_by": request.created_by,
        "created_at": datetime.utcnow().isoformat()
    })
    
    # Submit to Modal
    modal_call_id = await modal_client.submit_training(job_id, request)
    
    # Update with Modal call ID
    await supabase_client.update_training_job(job_id, {
        "modal_call_id": modal_call_id,
        "status": "queued"
    })
    
    return {
        "job_id": job_id,
        "modal_call_id": modal_call_id,
        "status": "queued",
        "message": "Training job submitted successfully"
    }

async def get_job_status(job_id: str):
    result = await supabase_client.get_training_job(job_id)
    return result.data if result.data else None

async def cancel_job(job_id: str):
    job = await get_job_status(job_id)
    if job and job.get("modal_call_id"):
        await modal_client.cancel_job(job["modal_call_id"])
        await supabase_client.update_training_job(job_id, {"status": "cancelled"})
        return True
    return False

async def get_metrics(job_id: str):
    result = supabase_client.supabase.table("training_metrics")\
        .select("*")\
        .eq("job_id", job_id)\
        .order("epoch")\
        .execute()
    return result.data
```

### 9.7 Create Models Router
Create `app/routers/models.py`:
```python
from fastapi import APIRouter, HTTPException
from app.services import supabase_client

router = APIRouter()

@router.get("/")
async def list_models():
    """List all trained models"""
    result = supabase_client.supabase.table("ai_models")\
        .select("*")\
        .order("created_at", desc=True)\
        .execute()
    return result.data

@router.get("/{model_id}")
async def get_model(model_id: str):
    """Get model details"""
    result = supabase_client.supabase.table("ai_models")\
        .select("*")\
        .eq("id", model_id)\
        .single()\
        .execute()
    return result.data

@router.post("/{model_id}/deploy")
async def deploy_model(model_id: str):
    """Deploy model (set as ready)"""
    await supabase_client.update_model(model_id, {"status": "deployed"})
    return {"success": True}

@router.post("/{model_id}/promote")
async def promote_model(model_id: str):
    """Promote model to active (deactivate others)"""
    # Deactivate all
    supabase_client.supabase.table("ai_models")\
        .update({"is_active": False})\
        .execute()
    
    # Activate this one
    await supabase_client.update_model(model_id, {
        "is_active": True,
        "deployed_at": datetime.utcnow().isoformat()
    })
    return {"success": True}
```

### 9.8 Create Dockerfile
Create `Dockerfile`:
```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/training/submit` | Submit training job |
| GET | `/training/status/{job_id}` | Get job status |
| POST | `/training/cancel/{job_id}` | Cancel job |
| GET | `/training/metrics/{job_id}` | Get training metrics |
| GET | `/models` | List models |
| GET | `/models/{id}` | Get model details |
| POST | `/models/{id}/deploy` | Deploy model |
| POST | `/models/{id}/promote` | Set as active model |

## Constraints
- Protected by API key (X-API-Key header)
- Only Next.js backend calls this service
- No direct browser access
- Use service role key for Supabase
- Modal.com integration in next fase

## Output Files
```
fastapi-service/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── training.py
│   │   ├── models.py
│   │   └── datasets.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── supabase_client.py
│   │   └── training_service.py
│   └── schemas/
│       ├── __init__.py
│       ├── training.py
│       └── models.py
├── requirements.txt
├── Dockerfile
├── .env.example
└── README.md
```

## Validation Checklist
- [ ] `uvicorn app.main:app --reload` starts without errors
- [ ] `/health` endpoint returns 200
- [ ] API key protection works
- [ ] Can connect to Supabase
- [ ] Swagger docs available at `/docs`

## Estimated Time
4-6 hours
