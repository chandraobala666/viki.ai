"""
Health router for VIKI API
"""
from fastapi import APIRouter
from ..util.version_util import get_version
from ..util.ai_chat_utility import open_phoenix_ui, get_phoenix_session

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


@router.post("/phoenix/open-ui")
def open_phoenix_ui_endpoint():
    """
    Open Phoenix UI in browser

    This endpoint allows you to manually open the Phoenix UI after traces have been generated.
    """
    try:
        phoenix_session = get_phoenix_session()
        if phoenix_session:
            open_phoenix_ui()
            return {
                "success": True,
                "message": "Phoenix UI opened in browser",
                "phoenix_url": "http://127.0.0.1:6006",
            }
        else:
            return {
                "success": False,
                "message": "Phoenix session not available. Ensure Phoenix is initialized.",
                "phoenix_url": None,
            }
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to open Phoenix UI: {str(e)}",
            "phoenix_url": None,
        }


@router.get("/phoenix/status")
def phoenix_status():
    """
    Get Phoenix instrumentation status
    """
    try:
        phoenix_session = get_phoenix_session()
        return {
            "phoenix_initialized": phoenix_session is not None,
            "phoenix_url": "http://127.0.0.1:6006" if phoenix_session else None,
            "instrumentation_active": phoenix_session is not None,
        }
    except Exception as e:
        return {
            "phoenix_initialized": False,
            "phoenix_url": None,
            "instrumentation_active": False,
            "error": str(e),
        }
