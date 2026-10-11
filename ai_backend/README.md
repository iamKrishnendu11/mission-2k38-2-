# AI Ecosystem Backend — Setup Guide

This folder contains the complete AI ecosystem for Mission 2038:
- **11v11 Match Tactical Tracking** (YOLOv8 + ByteTrack + Camera Movement + Possession + Speed/Distance estimation)
- **AI Tactical Assistant & Scouting Matchups** (Ollama + Llama 3.2)
- **Individual Skill Coaching** (Shooting, Dribbling, Goalkeeper Pose tracking)

---

## 📋 Prerequisites

1. **Python 3.10 or 3.11** installed.
2. **Ollama** installed on your system ([Download Ollama](https://ollama.com/download)).
3. *(Optional but recommended)* **NVIDIA GPU** with CUDA support.

---

## 🚀 Setup Steps (For Freshly Cloned Repo)

### 1. Start Ollama and Pull the LLM Model
The AI Coach and tactical scouting modules require local Ollama:
```bash
# Pull and start the Llama 3.2 model
ollama run llama3.2
```
*Keep Ollama running in the background (by default on `http://localhost:11434`).*

---

### 2. Create and Activate Virtual Environment
From the project root:
```bash
cd ai_backend
python -m venv venv
```

**Activate it:**
- **Windows (PowerShell):**
  ```powershell
  .\venv\Scripts\Activate.ps1
  ```
  *(If you get an execution policy error, run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` first)*
- **Windows (Command Prompt):**
  ```cmd
  venv\Scripts\activate.bat
  ```
- **macOS / Linux:**
  ```bash
  source venv/bin/activate
  ```

---

### 3. Install Dependencies
Make sure your virtual environment is active (`(venv)` shown in terminal):
```bash
pip install -r requirements.txt
```

*(Optional GPU Acceleration)*: If you have an NVIDIA GPU, install PyTorch with CUDA:
```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
```

---

### 4. Create `.env` File
In `ai_backend/`, copy the example file:
```bash
# Windows PowerShell / CMD:
copy .env.example .env

# macOS / Linux:
cp .env.example .env
```
Ensure the `.env` contains:
```env
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

---

### 5. Model Weights (`.pt` files)
> **Note:** `.pt` weights are gitignored to avoid bloated repo size.

1. **Match Tracking Model**:
   - If you don't have `models/best.pt`, `main.py` **automatically falls back to `yolov8n.pt`** and downloads it on first run! No manual action needed.
2. **Pose Tracking Model (for Coaching Modules)**:
   - Ensure `yolo26n-pose.pt` is placed inside `ai_backend/api_service/`.
   - Ask your team member for this file, or place a standard `yolov8n-pose.pt` in `ai_backend/api_service/`.

---

### 6. Run the AI Backend Server

**Option A: Directly with Uvicorn (Recommended)**
```bash
cd api_service
uvicorn api:app --reload --port 8000
```

**Option B: From Repository Root with npm**
```bash
# In the root mission-2k38 directory:
npm run dev:ai
```

---

## 🧪 Testing the Setup

Once the server is running on `http://localhost:8000`:
- **Interactive API Documentation:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Live Match Dashboard UI:** [http://localhost:8000/match-dashboard](http://localhost:8000/match-dashboard)
  - Upload a match video (`.mp4`) to test YOLO tracking and MJPEG streaming.
  - Click **"Generate 1v1 Matchup Strategy"** to test the Ollama Llama 3.2 LLM integration.
