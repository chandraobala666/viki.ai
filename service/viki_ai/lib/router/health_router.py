"""
Health router for VIKI API
"""
from fastapi import APIRouter
from ..util.version_util import get_version

router = APIRouter(
    prefix="/health",
    tags=["health"],
)


@router.get("/")
def health_check():
    """
    Health check endpoint
    """
    version = get_version()
    return {
        "status": "healthy",
        "version": version,
    }
