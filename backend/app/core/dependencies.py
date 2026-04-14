import os
from google.cloud.firestore import AsyncClient
from app.core.config import settings

_db: AsyncClient | None = None


async def get_firestore() -> AsyncClient:
    """
    Singleton dependency for the Firestore AsyncClient.
    Uses the project ID from settings.
    """
    global _db
    if _db is None:
        if settings.FIREBASE_CREDENTIALS_PATH:
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = settings.FIREBASE_CREDENTIALS_PATH
        _db = AsyncClient(project=settings.FIREBASE_PROJECT_ID)
    return _db
