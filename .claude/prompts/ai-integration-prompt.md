# AI Integration for PCB Defect Detection

## Objective
Integrate AI inference service (Roboflow or custom YOLO endpoint) into INDUSIA HMI for real-time PCB defect detection with accurate bounding box coordinates.

---

## Current Architecture

```
Camera → [MOCK DATA] → HMI Display
              ↓
    Random bbox (not accurate)
```

## Target Architecture

```
Camera → Image Upload → AI Inference API → Defect Results → HMI Display
                              ↓
                    Roboflow / YOLO Endpoint
                              ↓
                    {class, confidence, bbox}[]
```

---

## Task Breakdown

### Task 1: Create AI Service Module

**File:** `lib/services/aiInferenceService.js`

```javascript
/**
 * AI Inference Service
 * Handles communication with Roboflow or custom YOLO endpoint
 */

const AI_PROVIDER = process.env.NEXT_PUBLIC_AI_PROVIDER || 'roboflow'; // 'roboflow' | 'yolo' | 'mock'
const ROBOFLOW_API_KEY = process.env.ROBOFLOW_API_KEY;
const ROBOFLOW_MODEL_ID = process.env.ROBOFLOW_MODEL_ID; // e.g., 'pcb-defect-detection/1'
const YOLO_ENDPOINT = process.env.YOLO_ENDPOINT; // e.g., 'http://localhost:8000/predict'

/**
 * Run inference on image
 * @param {string} imageUrl - URL or base64 of image
 * @param {Object} options - Inference options
 * @returns {Promise<{success: boolean, defects: Array}>}
 */
export async function runInference(imageUrl, options = {}) {
  switch (AI_PROVIDER) {
    case 'roboflow':
      return runRoboflowInference(imageUrl, options);
    case 'yolo':
      return runYoloInference(imageUrl, options);
    default:
      return runMockInference(imageUrl, options);
  }
}

/**
 * Roboflow Inference
 */
async function runRoboflowInference(imageUrl, options) {
  // TODO: Implement Roboflow API call
  // Docs: https://docs.roboflow.com/inference/hosted-api
  
  const response = await fetch(
    `https://detect.roboflow.com/${ROBOFLOW_MODEL_ID}?api_key=${ROBOFLOW_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: imageUrl, // base64 or URL
        confidence: options.confidence || 0.5,
        overlap: options.overlap || 0.3,
      }),
    }
  );
  
  const data = await response.json();
  
  // Transform Roboflow response to our format
  return {
    success: true,
    defects: data.predictions.map((pred, idx) => ({
      id: idx + 1,
      class_name: pred.class,
      confidence: pred.confidence,
      severity: mapClassToSeverity(pred.class),
      component_ref: null, // Roboflow doesn't provide this
      pin_number: null,
      ipc_reference: getIPCReference(pred.class),
      bbox: {
        x: pred.x - pred.width / 2,  // Roboflow uses center coordinates
        y: pred.y - pred.height / 2,
        width: pred.width,
        height: pred.height,
      },
      reviewed: false,
    })),
    imageWidth: data.image.width,
    imageHeight: data.image.height,
  };
}

/**
 * Custom YOLO Endpoint Inference
 */
async function runYoloInference(imageUrl, options) {
  // TODO: Implement custom YOLO API call
  // Expects endpoint that returns:
  // { predictions: [{ class, confidence, x, y, width, height }], image: { width, height } }
}

/**
 * Map defect class to severity
 */
function mapClassToSeverity(className) {
  const severityMap = {
    solder_bridge: 'critical',
    missing_component: 'critical',
    tombstone: 'critical',
    lifted_lead: 'critical',
    insufficient_solder: 'major',
    cold_solder: 'major',
    excess_solder: 'major',
    misalignment: 'major',
    solder_ball: 'minor',
  };
  return severityMap[className] || 'major';
}

/**
 * Get IPC reference for defect type
 */
function getIPCReference(className) {
  const references = {
    solder_bridge: 'IPC-A-610 8.2.9',
    missing_component: 'IPC-A-610 8.3.1',
    tombstone: 'IPC-A-610 8.3.4',
    insufficient_solder: 'IPC-A-610 8.2.5',
    cold_solder: 'IPC-A-610 8.2.7',
    excess_solder: 'IPC-A-610 8.2.6',
    lifted_lead: 'IPC-A-610 8.3.5',
    solder_ball: 'IPC-A-610 8.2.8',
    misalignment: 'IPC-A-610 8.3.6',
  };
  return references[className] || 'IPC-A-610';
}

export const aiInferenceService = {
  runInference,
  mapClassToSeverity,
  getIPCReference,
};

export default aiInferenceService;
```

---

### Task 2: Create API Route for Inference

**File:** `app/api/inference/route.js`

```javascript
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/apiAuth';
import { runInference } from '@/lib/services/aiInferenceService';

async function handlePOST(request) {
  try {
    const { imageUrl, imageBase64, options } = await request.json();
    
    if (!imageUrl && !imageBase64) {
      return NextResponse.json(
        { success: false, error: 'Image URL or base64 required' },
        { status: 400 }
      );
    }
    
    const image = imageBase64 || imageUrl;
    const result = await runInference(image, options);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Inference API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export const POST = withAuth('inspection:read')(handlePOST);
```

---

### Task 3: Update imageService.js

**File:** `lib/services/imageService.js`

Replace `getInspectionResult()` to call AI inference:

```javascript
import { runInference } from './aiInferenceService';

/**
 * Get inspection result with AI inference
 * @param {string} imageUrl - Image to analyze
 * @returns {Promise<Object>} Inspection result with defects
 */
export async function getInspectionResult(imageUrl = null) {
  // If no image provided, use random sample (for demo/testing)
  if (!imageUrl) {
    const filename = SAMPLE_BOARD_IMAGES[Math.floor(Math.random() * SAMPLE_BOARD_IMAGES.length)];
    imageUrl = getImageUrl(filename) || `/images/${filename}`;
  }
  
  // Check if AI is configured
  const aiEnabled = process.env.NEXT_PUBLIC_AI_PROVIDER && 
                    process.env.NEXT_PUBLIC_AI_PROVIDER !== 'mock';
  
  if (aiEnabled) {
    // Run AI inference
    const result = await runInference(imageUrl);
    
    if (result.success && result.defects.length > 0) {
      return {
        imageUrl,
        imagePath: imageUrl,
        imageWidth: result.imageWidth,
        imageHeight: result.imageHeight,
        defects: result.defects,
        timestamp: new Date().toISOString(),
        source: 'ai',
      };
    }
  }
  
  // Fallback to mock data
  return {
    imageUrl,
    imagePath: imageUrl,
    imageWidth: IMAGE_WIDTH,
    imageHeight: IMAGE_HEIGHT,
    defects: generateMockDefects(),
    timestamp: new Date().toISOString(),
    source: 'mock',
  };
}
```

---

### Task 4: Environment Variables

**File:** `.env.local`

```env
# AI Provider: 'roboflow' | 'yolo' | 'mock'
NEXT_PUBLIC_AI_PROVIDER=mock

# Roboflow Configuration
ROBOFLOW_API_KEY=your_api_key_here
ROBOFLOW_MODEL_ID=pcb-defect-detection/1

# Custom YOLO Endpoint (if using custom model)
YOLO_ENDPOINT=http://localhost:8000/predict
```

---

### Task 5: Update LiveViewV2 to Use Real Camera

**File:** `components/inspection/LiveViewV2.jsx`

Add camera capture or image upload capability:

```javascript
// Option A: Capture from webcam/industrial camera
const captureImage = async () => {
  // Use MediaDevices API or industrial camera SDK
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  // Capture frame and convert to base64
};

// Option B: Receive image from PLC/Camera trigger via WebSocket
useEffect(() => {
  const ws = new WebSocket(process.env.NEXT_PUBLIC_CAMERA_WS_URL);
  
  ws.onmessage = async (event) => {
    const { imageBase64, boardId } = JSON.parse(event.data);
    
    // Run AI inference
    const result = await fetch('/api/inference', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64 }),
    }).then(r => r.json());
    
    if (result.defects.length > 0) {
      setCurrentImage(`data:image/png;base64,${imageBase64}`);
      setDefects(result.defects);
      setAiResult('FAIL');
    } else {
      // Auto-pass if no defects
      setAiResult('PASS');
    }
  };
  
  return () => ws.close();
}, []);
```

---

## Roboflow Setup Guide

1. **Create Roboflow Account:** https://roboflow.com
2. **Create Project:** PCB Defect Detection (Object Detection)
3. **Upload & Label Images:**
   - Classes: `solder_bridge`, `missing_component`, `tombstone`, `insufficient_solder`, `cold_solder`, `excess_solder`, `solder_ball`, `lifted_lead`, `misalignment`
4. **Train Model:** Use Roboflow's auto-train or YOLO export
5. **Deploy:** Get API key and model ID
6. **Configure .env.local** with credentials

---

## Alternative: Custom YOLO Deployment

If using custom YOLO model on Modal.com or local server:

**FastAPI Endpoint Example:**

```python
from fastapi import FastAPI, File, UploadFile
from ultralytics import YOLO
import base64

app = FastAPI()
model = YOLO('pcb_defect_model.pt')

@app.post("/predict")
async def predict(image: UploadFile = File(...)):
    contents = await image.read()
    results = model(contents)
    
    predictions = []
    for r in results:
        for box in r.boxes:
            predictions.append({
                "class": model.names[int(box.cls)],
                "confidence": float(box.conf),
                "x": float(box.xywh[0][0]),
                "y": float(box.xywh[0][1]),
                "width": float(box.xywh[0][2]),
                "height": float(box.xywh[0][3]),
            })
    
    return {
        "predictions": predictions,
        "image": {"width": results[0].orig_shape[1], "height": results[0].orig_shape[0]}
    }
```

---

## Testing Checklist

- [ ] AI service module created and exports working
- [ ] API route `/api/inference` responds correctly
- [ ] Environment variables configured
- [ ] Roboflow/YOLO credentials valid
- [ ] Inference returns correct bbox format (x, y, width, height)
- [ ] Defects display correctly in DefectViewPanel
- [ ] BoardOverview crops align with bbox
- [ ] Fallback to mock works when AI unavailable

---

## Expected Response Format

```json
{
  "success": true,
  "defects": [
    {
      "id": 1,
      "class_name": "solder_bridge",
      "confidence": 0.94,
      "severity": "critical",
      "component_ref": null,
      "pin_number": null,
      "ipc_reference": "IPC-A-610 8.2.9",
      "bbox": {
        "x": 1300,
        "y": 380,
        "width": 280,
        "height": 280
      },
      "reviewed": false
    }
  ],
  "imageWidth": 2400,
  "imageHeight": 1792
}
```

---

## Notes

- Roboflow free tier: 1000 inferences/month
- For production, consider self-hosted YOLO on Modal.com
- Bbox format: top-left origin (x, y) + dimensions (width, height)
- Confidence threshold default: 0.5 (configurable)
