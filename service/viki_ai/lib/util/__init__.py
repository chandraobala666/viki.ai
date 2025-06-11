"""
Utility modules for the Viki AI service.

This package contains utility classes and functions for AI chat functionality,
including LLM integration and MCP tools support.
"""

from .ai_chat_utility import AIChatUtility, create_chat_session, quick_chat

__all__ = ["AIChatUtility", "create_chat_session", "quick_chat"]
