"""
QR Task Manager — FastAPI Backend
Production-ready REST API with Firebase Auth and Firestore.
Multi-tenant: all data is partitioned by companyId.
"""

import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import firebase_admin
from firebase_admin import credentials

from app.core.config import settings
from app.routers import tasks, locations, admin, users, companies, employee

# -------------------- LOGGING --------------------
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# -------------------- LIFESPAN --------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize Firebase Admin SDK at startup."""
    logger.info("🚀 Starting QR Task Manager API...")

    try:
        if not firebase_admin._apps:
            if settings.FIREBASE_CREDENTIALS_PATH:
                cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
                firebase_admin.initialize_app(cred)
                logger.info("✅ Firebase initialized with service account.")
            else:
                firebase_admin.initialize_app()
                logger.info("✅ Firebase initialized with default credentials.")
    except Exception as e:
        logger.error(f"❌ Firebase init failed: {e}")

    yield

    logger.info("🛑 Shutting down QR Task Manager API...")

# -------------------- APP INIT --------------------
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="REST API for QR-based task management system with multi-tenant company isolation",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# -------------------- CORS --------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------- ROUTERS --------------------
app.include_router(companies.router, prefix=settings.API_V1_PREFIX)
app.include_router(tasks.router, prefix=settings.API_V1_PREFIX)
app.include_router(locations.router, prefix=settings.API_V1_PREFIX)
app.include_router(admin.router, prefix=settings.API_V1_PREFIX)
app.include_router(users.router, prefix=settings.API_V1_PREFIX)
app.include_router(employee.router, prefix=settings.API_V1_PREFIX)

# -------------------- HEALTH --------------------
@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": "2.0.0",
    }

# -------------------- ROOT --------------------
@app.get("/", tags=["Root"])
async def root():
    return {
        "service": settings.PROJECT_NAME,
        "docs": "/docs",
        "health": "/health",
    }
