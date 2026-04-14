# QR Task Manager

A production-ready QR-based task management system for field operations. Employees scan QR codes at physical locations to receive and complete assigned tasks, while admins manage everything from a web dashboard.

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  Flutter App     │────▶│  FastAPI Backend │◀────│  React Admin     │
│  (iOS/Android)   │     │  (REST API)      │     │  (Web Dashboard) │
│                  │     │                  │     │                  │
│  • QR Scanner    │     │  • Auth JWT      │     │  • CRUD Mgmt     │
│  • Task List     │     │  • Firestore     │     │  • Analytics     │
│  • Checklist     │     │  • RBAC          │     │  • QR Generator  │
└────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘
         │                        │                         │
         └────────────────────────┴─────────────────────────┘
                                  │
                    ┌─────────────┴────────────────┐
                    │       Firebase Platform       │
                    │  Auth · Firestore · Functions │
                    └──────────────────────────────┘
```

## 📁 Project Structure

```
QR/
├── backend/              # FastAPI REST API
│   ├── app/
│   │   ├── core/         # Config, security, dependencies
│   │   ├── models/       # Pydantic schemas
│   │   ├── routers/      # API endpoints
│   │   └── main.py       # App entry point
│   ├── firebase/         # Firestore rules, indexes, Cloud Functions
│   ├── Dockerfile
│   └── docker-compose.yml
│
├── mobile/               # Flutter mobile app
│   ├── lib/
│   │   ├── core/         # Theme, constants
│   │   ├── data/         # Models, services
│   │   ├── providers/    # Riverpod state management
│   │   └── ui/           # Screens and widgets
│   └── pubspec.yaml
│
└── admin/                # React admin dashboard
    ├── src/
    │   ├── auth/         # Firebase auth context
    │   ├── api/          # Axios API client
    │   ├── components/   # Layout, shared components
    │   ├── pages/        # Dashboard, Locations, Tasks, Users
    │   └── styles/       # Design system CSS
    └── package.json
```

## 🚀 Quick Start

### Prerequisites
- Python 3.12+
- Flutter 3.16+
- Node.js 20+
- Firebase project with Auth & Firestore enabled

### 1. Firebase Setup

```bash
# Install Firebase CLI
npm install -g firebase-tools
firebase login

# Create a new project (or use existing)
firebase projects:create qr-task-manager

# Enable services in Firebase Console:
# - Authentication → Email/Password
# - Cloud Firestore → Create database (production mode)

# Deploy Firestore rules and indexes
cd backend/firebase
firebase deploy --only firestore:rules,firestore:indexes

# Deploy Cloud Functions
cd functions
npm install
npm run build
firebase deploy --only functions
```

### 2. Backend (FastAPI)

```bash
cd backend

# Create .env from template
cp .env.example .env
# Edit .env with your Firebase project ID and credentials path

# Create virtual environment
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt

# Place your Firebase service account key
mkdir credentials
# Download from Firebase Console → Project Settings → Service Accounts
# Save as credentials/service-account.json

# Run development server
uvicorn app.main:app --reload --port 8000

# Or use Docker
docker-compose up
```

API docs: https://backend-sepia-mu-47.vercel.app

### 3. Mobile App (Flutter)

```bash
cd mobile

# Install dependencies
flutter pub get

# Configure Firebase for Flutter
# Option A: Use FlutterFire CLI (recommended)
dart pub global activate flutterfire_cli
flutterfire configure --project=your-firebase-project-id

# Option B: Manual setup
# - Download google-services.json → android/app/
# - Download GoogleService-Info.plist → ios/Runner/

# Create assets directories
mkdir -p assets/images assets/animations

# Run on device/emulator
flutter run
```

### 4. Admin Dashboard (React)

```bash
cd admin

# Install dependencies
npm install


# Edit with your Firebase web config

# Run development server
npm run dev
```

Dashboard: https://admin-phi-beryl-87.vercel.app/login

### 5. Bootstrap First Admin

After signing up through the mobile app or admin dashboard:

```bash
# Option A: Call bootstrapAdmin Cloud Function from Flutter
# (Already integrated in the app)

# Option B: Use Firebase Admin SDK directly
firebase functions:shell
> bootstrapAdmin({ auth: { uid: "YOUR_UID", token: { email: "you@email.com" } } })
```

## 📊 API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/v1/tasks/by-qr/{qr_value}` | Employee | Tasks for scanned QR |
| `POST` | `/api/v1/tasks/submit` | Employee | Submit completed tasks |
| `POST` | `/api/v1/tasks` | Admin | Create task |
| `PUT` | `/api/v1/tasks/{id}` | Admin | Update task |
| `DELETE` | `/api/v1/tasks/{id}` | Admin | Soft-delete task |
| `GET` | `/api/v1/locations` | Any | List locations |
| `POST` | `/api/v1/locations` | Admin | Create location |
| `PUT` | `/api/v1/locations/{id}` | Admin | Update location |
| `DELETE` | `/api/v1/locations/{id}` | Admin | Soft-delete location |
| `GET` | `/api/v1/locations/{id}/tasks` | Any | Location's tasks |
| `GET` | `/api/v1/users/me` | Any | Current user profile |
| `GET` | `/api/v1/users` | Admin | List all users |
| `PUT` | `/api/v1/users/{id}/role` | Admin | Change user role |
| `GET` | `/api/v1/admin/dashboard` | Admin | Dashboard stats |
| `GET` | `/api/v1/admin/activity` | Admin | Activity feed |
| `GET` | `/api/v1/admin/employees` | Admin | Employee stats |

## 🔐 Security

- **Authentication**: Firebase Auth with JWT token verification on every request
- **Authorization**: Custom claims-based RBAC (`admin` / `employee`)
- **Double enforcement**: API middleware + Firestore Security Rules
- **Immutable logs**: `task_logs` cannot be edited or deleted
- **Self-protection**: Admins cannot demote themselves

## 🚢 Production Deployment

### Backend → GCP Cloud Run
```bash
cd backend
gcloud run deploy qr-task-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars FIREBASE_PROJECT_ID=your-project-id \
  --min-instances 0 \
  --max-instances 10
```

### Admin → Vercel
```bash
cd admin
npx vercel --prod
```

### Mobile → Play Store & App Store
```bash
# Android
flutter build appbundle --release
# Upload build/app/outputs/bundle/release/app-release.aab to Play Console

# iOS
flutter build ipa --release
# Upload via Transporter or Xcode to App Store Connect
```

## 📐 Firestore Schema

| Collection | Document Fields |
|-----------|----------------|
| `users` | uid, email, displayName, role, isActive, assignedLocations, createdAt |
| `locations` | name, description, qrCodeValue, address, isActive, createdBy, createdAt |
| `tasks` | title, description, locationId, priority, frequencyType, isActive, order, estimatedMinutes, createdBy |
| `task_logs` | taskId, locationId, completedBy, completedByName, status, notes, photoUrl, completedAt, submittedAt, sessionId |

## 🧪 Testing

```bash
# Backend
cd backend
pip install pytest httpx
pytest tests/

# Flutter
cd mobile
flutter test

# Admin
cd admin
npm test
```

## License

MIT
