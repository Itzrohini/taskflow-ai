# TaskFlow AI - Backend

FastAPI backend for TaskFlow AI using MongoDB.

---

## Setup Instructions

### 1. Create and Activate Virtual Environment
- **PowerShell (Windows)**:
  ```powershell
  python -m venv .venv
  .\.venv\Scripts\Activate.ps1
  ```
- **Bash / zsh (macOS/Linux)**:
  ```bash
  python -m venv .venv
  source .venv/bin/activate
  ```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
pip install -r requirements-dev.txt
```

---

## Local MongoDB Setup

Start MongoDB Community Server locally and confirm it is listening on
`localhost:27017`. Create `backend/.env` from `.env.example` only if it does not
already exist, then set:

```dotenv
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=taskflow_ai
MONGODB_TIMEOUT_MS=5000
```

The application creates the database and configured `tasks` indexes as needed.

---

## Running the Application

Run the development server from the `backend/` directory:
```bash
uvicorn app.main:app --reload --port 8000
```
- Base API health: `GET http://localhost:8000/health`
- Database ping health: `GET http://localhost:8000/health/db`

---

## Running Tests

### Offline Unit Tests
Unit tests use `mongomock` and require no network connection or Atlas credentials:
```bash
pytest
```

### Local MongoDB Integration Test
The integration test pings MongoDB and creates indexes in a uniquely named,
temporary `taskflow_ai_integration_test_*` database. It drops only that database
afterward. To run it:
```bash
pytest -m integration
```
The test is skipped when `MONGODB_URI` is empty.

---

## Code Quality & Linting
```bash
ruff check .
```
