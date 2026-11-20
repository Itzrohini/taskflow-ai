# TaskFlow AI - Backend

FastAPI backend for TaskFlow AI.

## Setup Instructions

### 1. Create Virtual Environment
```powershell
python -m venv .venv
```

### 2. Activate Virtual Environment
- **PowerShell (Windows)**:
  ```powershell
  .\.venv\Scripts\Activate.ps1
  ```
- **Bash / zsh (macOS/Linux)**:
  ```bash
  source .venv/bin/activate
  ```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
pip install -r requirements-dev.txt
```

### 4. Run Development Server
Run from the `backend/` directory:
```bash
uvicorn app.main:app --reload --port 8000
```

### 5. Run Tests
```bash
pytest
```

### 6. Run Linter
```bash
ruff check .
```
