"""
Router module for VIKI API
"""
from fastapi import APIRouter
from .agent_router import router as agent_router
from .llm_router import router as llm_router
from .agent_relationships_router import router as agent_relationships_router
from .health_router import router as health_router
from .knowledge_base_router import router as knowledge_base_router
from .tools_router import router as tools_router
from .lookup_router import router as lookup_router
from .file_store_router import router as file_store_router

def get_routers():
    """
    Returns all routers to be included in the main app
    """
    return [
        health_router,
        agent_router,
        llm_router,
        agent_relationships_router,
        knowledge_base_router,
        tools_router,
        lookup_router,
        file_store_router
    ]
