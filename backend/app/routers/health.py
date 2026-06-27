from fastapi import APIRouter
from app.core.config import settings
from app.core.neo4j_client import neo4j_client

router = APIRouter()

@router.get("/health")
async def health():
    neo4j_ok = neo4j_client.driver is not None
    return {
        "status": "ok",
        "mock_ai": settings.MOCK_AI,
        "environment": settings.ENVIRONMENT,
        "neo4j": "connected" if neo4j_ok else "unavailable",
    }
