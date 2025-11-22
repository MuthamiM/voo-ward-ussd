# Python FastAPI Mobile Backend

Backend API for Kyamatu Ward Citizen Mobile App

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd mobile-backend
pip install -r requirements.txt
```

### 2. Configure Environment
Create `.env` file:
```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Run Server
```bash
python main.py
```

API will be available at: `http://localhost:8000`

### 4. View API Docs
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

---

## 📦 API Endpoints

### Authentication
- `POST /api/v1/auth/request-otp` - Request OTP
- `POST /api/v1/auth/verify-otp` - Verify OTP & get token

### Issues
- `GET /api/v1/issues` - Get user's issues
- `POST /api/v1/issues` - Create new issue
- `GET /api/v1/issues/{id}` - Get specific issue

### Bursaries
- `GET /api/v1/bursaries` - Get bursary applications

### Upload
- `POST /api/v1/upload/photo` - Upload photo

---

## 🗄️ Database

Uses PostgreSQL with SQLAlchemy ORM

### Models:
- `Citizen` - Mobile app users
- `Issue` - Reported issues
- `OTP` - Phone verification codes

---

## 🚀 Deployment

### Railway.app (Recommended)
```bash
railway login
railway init
railway up
```

### Render.com
- Build: `pip install -r requirements.txt`
- Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`

---

**Version**: 1.0.0  
**Status**: ✅ Ready for Development
