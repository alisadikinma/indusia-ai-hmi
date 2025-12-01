# FASE 10: Modal.com GPU Training

## Role
You are a senior ML engineer implementing GPU training infrastructure on Modal.com for INDUSIA AI HMI - training YOLOv10 models for PCB defect detection.

## Context
INDUSIA AI HMI training pipeline:
- Modal.com for serverless GPU (A10G/A100)
- YOLOv10 for object detection
- Dataset dari Supabase Storage
- Model output ke Supabase Storage

FastAPI service ready from Fase 9.

Working directory: `C:\xampp\htdocs\indusia-ai-hmi\fastapi-service\modal_app`

## Objective
Build Modal.com training functions dengan checkpointing, metrics logging, dan model upload.

## Tasks

### 10.1 Create Modal App Structure
```
modal_app/
├── __init__.py
├── config.py
├── train_yolo.py      # Training function
├── inference.py       # Inference function (optional)
└── utils.py          # Helper functions
```

### 10.2 Create Modal Training Function
Create `modal_app/train_yolo.py`:

```python
import modal
import os
from pathlib import Path

# Modal app
app = modal.App("indusia-pcb-training")

# Container image with dependencies
training_image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "torch==2.1.0",
    "torchvision==0.16.0",
    "ultralytics>=8.0.0",
    "supabase>=2.0.0",
    "opencv-python-headless>=4.8.0",
    "pillow>=10.0.0"
)

# Persistent volumes
dataset_volume = modal.Volume.from_name("pcb-datasets", create_if_missing=True)
checkpoint_volume = modal.Volume.from_name("model-checkpoints", create_if_missing=True)


@app.function(
    image=training_image,
    gpu="A10G",  # or "A100-40GB" for production
    timeout=86400,  # 24 hours max
    retries=modal.Retries(
        max_retries=3,
        initial_delay=60.0,
        backoff_coefficient=2.0
    ),
    secrets=[modal.Secret.from_name("supabase-credentials")],
    volumes={
        "/data": dataset_volume,
        "/checkpoints": checkpoint_volume
    }
)
def train_pcb_detector(config: dict):
    """
    Train YOLOv10 model for PCB defect detection.
    
    Args:
        config: {
            job_id: str,
            dataset_id: str,
            base_model: str,
            epochs: int,
            batch_size: int,
            image_size: int,
            learning_rate: float
        }
    """
    import torch
    from ultralytics import YOLO
    from supabase import create_client
    
    job_id = config["job_id"]
    dataset_id = config["dataset_id"]
    
    # Setup paths
    data_dir = Path(f"/data/{dataset_id}")
    checkpoint_dir = Path(f"/checkpoints/{job_id}")
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    
    # Initialize Supabase
    supabase = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_KEY"]
    )
    
    # Update status
    update_job_status(supabase, job_id, "running")
    
    try:
        # Download dataset if not cached
        if not data_dir.exists():
            download_dataset(supabase, dataset_id, data_dir)
        
        # Check for existing checkpoint (resume)
        last_checkpoint = checkpoint_dir / "weights/last.pt"
        if last_checkpoint.exists():
            model = YOLO(str(last_checkpoint))
            print(f"Resuming from checkpoint: {last_checkpoint}")
        else:
            model = YOLO(config.get("base_model", "yolov10n.pt"))
            print(f"Starting fresh with: {config.get('base_model')}")
        
        # Training with callbacks for metrics
        results = model.train(
            data=str(data_dir / "data.yaml"),
            epochs=config.get("epochs", 100),
            imgsz=config.get("image_size", 640),
            batch=config.get("batch_size", 16),
            lr0=config.get("learning_rate", 0.01),
            project=str(checkpoint_dir),
            name="train",
            exist_ok=True,
            resume=last_checkpoint.exists(),
            # Callbacks
            callbacks={
                "on_train_epoch_end": lambda trainer: log_metrics(
                    supabase, job_id, trainer
                )
            }
        )
        
        # Commit checkpoint volume
        checkpoint_volume.commit()
        
        # Upload final model
        best_model = checkpoint_dir / "train/weights/best.pt"
        model_url = upload_model(supabase, job_id, best_model)
        
        # Get final metrics
        final_metrics = {
            "map50": float(results.results_dict.get("metrics/mAP50(B)", 0)),
            "map50_95": float(results.results_dict.get("metrics/mAP50-95(B)", 0)),
            "precision": float(results.results_dict.get("metrics/precision(B)", 0)),
            "recall": float(results.results_dict.get("metrics/recall(B)", 0))
        }
        
        # Update job as completed
        update_job_status(supabase, job_id, "completed", {
            "model_url": model_url,
            "metrics": final_metrics
        })
        
        # Create model record
        create_model_record(supabase, job_id, config, model_url, final_metrics)
        
        return {
            "job_id": job_id,
            "status": "completed",
            "model_url": model_url,
            "metrics": final_metrics
        }
        
    except Exception as e:
        update_job_status(supabase, job_id, "failed", {
            "error_message": str(e)
        })
        raise


def download_dataset(supabase, dataset_id: str, data_dir: Path):
    """Download dataset from Supabase Storage"""
    import json
    
    data_dir.mkdir(parents=True, exist_ok=True)
    images_dir = data_dir / "images"
    labels_dir = data_dir / "labels"
    images_dir.mkdir(exist_ok=True)
    labels_dir.mkdir(exist_ok=True)
    
    # Get dataset images
    result = supabase.table("dataset_images")\
        .select("*")\
        .eq("dataset_id", dataset_id)\
        .eq("is_annotated", True)\
        .execute()
    
    images = result.data
    
    for img in images:
        # Download image
        response = supabase.storage.from_("inspection-images")\
            .download(img["storage_path"])
        
        img_path = images_dir / img["file_name"]
        with open(img_path, "wb") as f:
            f.write(response)
        
        # Write YOLO label file
        label_path = labels_dir / (img["file_name"].rsplit(".", 1)[0] + ".txt")
        with open(label_path, "w") as f:
            for ann in img["annotations"]:
                line = f"{ann['class_id']} {ann['x_center']} {ann['y_center']} {ann['width']} {ann['height']}\n"
                f.write(line)
    
    # Create data.yaml
    yaml_content = f"""
train: {images_dir}
val: {images_dir}

nc: 9
names:
  0: solder_bridge
  1: missing_component
  2: tombstoning
  3: insufficient_solder
  4: solder_ball
  5: component_shift
  6: cold_solder
  7: lifted_lead
  8: false_call
"""
    with open(data_dir / "data.yaml", "w") as f:
        f.write(yaml_content)


def log_metrics(supabase, job_id: str, trainer):
    """Log metrics after each epoch"""
    metrics = {
        "job_id": job_id,
        "epoch": trainer.epoch,
        "train_loss": float(trainer.loss.mean().item()),
        "box_loss": float(trainer.loss_items[0]),
        "cls_loss": float(trainer.loss_items[1]),
        "dfl_loss": float(trainer.loss_items[2]),
        "learning_rate": float(trainer.optimizer.param_groups[0]["lr"])
    }
    
    # Add validation metrics if available
    if hasattr(trainer, "metrics"):
        metrics.update({
            "map50": float(trainer.metrics.get("metrics/mAP50(B)", 0)),
            "map50_95": float(trainer.metrics.get("metrics/mAP50-95(B)", 0)),
            "precision_val": float(trainer.metrics.get("metrics/precision(B)", 0)),
            "recall": float(trainer.metrics.get("metrics/recall(B)", 0))
        })
    
    supabase.table("training_metrics").insert(metrics).execute()


def upload_model(supabase, job_id: str, model_path: Path) -> str:
    """Upload trained model to Supabase Storage"""
    storage_path = f"models/{job_id}/best.pt"
    
    with open(model_path, "rb") as f:
        supabase.storage.from_("model-weights").upload(
            path=storage_path,
            file=f,
            file_options={"content-type": "application/octet-stream"}
        )
    
    url_data = supabase.storage.from_("model-weights").get_public_url(storage_path)
    return url_data


def update_job_status(supabase, job_id: str, status: str, extra: dict = None):
    """Update training job status"""
    data = {"status": status}
    if status == "running":
        data["started_at"] = datetime.utcnow().isoformat()
    elif status in ["completed", "failed"]:
        data["completed_at"] = datetime.utcnow().isoformat()
    
    if extra:
        data.update(extra)
    
    supabase.table("training_jobs").update(data).eq("job_id", job_id).execute()


def create_model_record(supabase, job_id, config, model_url, metrics):
    """Create AI model record after training"""
    from datetime import datetime
    
    supabase.table("ai_models").insert({
        "name": f"pcb-detector-{job_id[:8]}",
        "version": "1.0.0",
        "description": f"Trained on dataset {config['dataset_id']}",
        "training_job_id": job_id,
        "dataset_id": config["dataset_id"],
        "storage_path": f"models/{job_id}/best.pt",
        "public_url": model_url,
        "base_model": config.get("base_model", "yolov10n.pt"),
        "framework": "yolov10",
        "map50": metrics["map50"],
        "map50_95": metrics["map50_95"],
        "precision_val": metrics.get("precision"),
        "recall": metrics.get("recall"),
        "status": "draft",
        "is_active": False,
        "created_by": config.get("created_by"),
        "created_at": datetime.utcnow().isoformat()
    }).execute()
```

### 10.3 Create Modal Client for FastAPI
Update `fastapi-service/app/services/modal_client.py`:

```python
import modal
from app.config import settings

async def submit_training(job_id: str, request) -> str:
    """Submit training job to Modal"""
    
    # Get function reference
    train_fn = modal.Function.from_name(
        "indusia-pcb-training",
        "train_pcb_detector"
    )
    
    # Spawn async job
    call = await train_fn.spawn.aio({
        "job_id": job_id,
        "dataset_id": request.dataset_id,
        "base_model": request.base_model,
        "epochs": request.epochs,
        "batch_size": request.batch_size,
        "image_size": request.image_size,
        "learning_rate": request.learning_rate,
        "created_by": request.created_by
    })
    
    return call.object_id


async def get_job_result(call_id: str):
    """Get result from Modal job (non-blocking)"""
    try:
        function_call = modal.FunctionCall.from_id(call_id)
        result = await function_call.get.aio(timeout=0)
        return {"status": "completed", "result": result}
    except TimeoutError:
        return {"status": "running"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


async def cancel_job(call_id: str):
    """Cancel running Modal job"""
    function_call = modal.FunctionCall.from_id(call_id)
    await function_call.cancel.aio()
    return True
```

### 10.4 Setup Modal Secrets
Run in terminal:
```bash
modal secret create supabase-credentials \
  SUPABASE_URL=your_url \
  SUPABASE_SERVICE_KEY=your_service_key
```

### 10.5 Create Model Weights Storage Bucket
Run in Supabase SQL Editor:
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('model-weights', 'model-weights', true, 524288000);  -- 500MB

CREATE POLICY "Public read models" ON storage.objects
FOR SELECT TO anon USING (bucket_id = 'model-weights');

CREATE POLICY "Service upload models" ON storage.objects
FOR INSERT TO service_role WITH CHECK (bucket_id = 'model-weights');
```

### 10.6 Deploy Modal App
```bash
cd modal_app
modal deploy train_yolo.py
```

## Training Flow
```
1. Engineer triggers training via UI
2. Next.js calls FastAPI /training/submit
3. FastAPI creates job record in Supabase
4. FastAPI calls Modal.spawn()
5. Modal allocates GPU and runs training
6. Training function:
   a. Downloads dataset from Supabase
   b. Trains YOLOv10
   c. Logs metrics per epoch
   d. Uploads model to Supabase Storage
   e. Creates model record
7. FastAPI polls status via Modal call ID
8. UI shows progress and completion
```

## GPU Options
| GPU | VRAM | Price/sec | Recommendation |
|-----|------|-----------|----------------|
| A10G | 24GB | $0.000306 | Development, small datasets |
| A100-40GB | 40GB | $0.000583 | Production training |
| A100-80GB | 80GB | $0.000694 | Large batch sizes |

## Constraints
- Training timeout: 24 hours max
- Checkpoint every epoch for resume
- Metrics logged per epoch to Supabase
- Model files stored in Supabase Storage
- Non-blocking job submission (spawn)

## Output Files
```
fastapi-service/modal_app/
├── __init__.py
├── train_yolo.py
└── utils.py

fastapi-service/app/services/
└── modal_client.py (update)
```

## Validation Checklist
- [ ] Modal app deploys successfully
- [ ] Secrets accessible in Modal
- [ ] Dataset downloads correctly
- [ ] Training runs on GPU
- [ ] Metrics logged to database
- [ ] Model uploaded to storage
- [ ] Checkpointing works
- [ ] Resume from checkpoint works

## Estimated Time
4-6 hours
