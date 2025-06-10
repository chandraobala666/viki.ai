"""
Chat router for VIKI API
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
import logging

from ..model.chat import ChatSession, ChatMessage
from ..model.db_session import get_db
from .schemas import (
    ChatSessionCreate, ChatSessionUpdate, ChatSessionResponse,
    ChatMessageCreate, ChatMessageUpdate, ChatMessageResponse
)
from .response_utils import serialize_response, serialize_response_list

router = APIRouter(
    prefix="/chat",
    tags=["chat"],
    responses={404: {"description": "Not found"}},
)

# Chat Session endpoints
@router.get("/sessions")
def get_chat_sessions(
    agent_id: Optional[str] = None,
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db)
):
    """
    Get all chat sessions
    
    Returns a list of all chat sessions in the system.
    
    - **agent_id**: (Optional) Filter by agent ID
    - **skip**: Number of records to skip for pagination
    - **limit**: Maximum number of records to return
    """
    query = db.query(ChatSession)
    if agent_id:
        query = query.filter(ChatSession.cht_agt_id == agent_id)
    
    chat_sessions = query.offset(skip).limit(limit).all()
    session_responses = [ChatSessionResponse.model_validate(session, from_attributes=True) for session in chat_sessions]
    return serialize_response_list(session_responses)


@router.get("/sessions/{session_id}")
def get_chat_session(session_id: str, db: Session = Depends(get_db)):
    """
    Get a chat session by ID
    
    Retrieves detailed information about a specific chat session.
    
    - **session_id**: The unique identifier of the chat session
    """
    chat_session = db.query(ChatSession).filter(ChatSession.cht_id == session_id).first()
    if chat_session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Chat session with ID {session_id} not found")
    session_response = ChatSessionResponse.model_validate(chat_session, from_attributes=True)
    return serialize_response(session_response)


@router.post("/sessions", status_code=status.HTTP_201_CREATED)
def create_chat_session(session: ChatSessionCreate, db: Session = Depends(get_db)):
    """
    Create a new chat session
    
    Creates a new chat session associated with an agent.
    
    - **name**: Human-readable name for the chat session
    - **description**: Detailed description of the chat session's purpose
    - **agent**: Reference to the agent that will handle this chat
    """
    # Generate unique session ID
    session_id = str(uuid.uuid4())
    
    # Create new chat session
    db_session = ChatSession(
        cht_id=session_id,
        cht_name=session.name,
        cht_description=session.description,
        cht_agt_id=session.agent,
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    session_response = ChatSessionResponse.model_validate(db_session, from_attributes=True)
    return serialize_response(session_response)


@router.put("/sessions/{session_id}")
def update_chat_session(session_id: str, session: ChatSessionUpdate, db: Session = Depends(get_db)):
    """
    Update an existing chat session
    
    Updates the properties of an existing chat session.
    
    - **session_id**: The unique identifier of the chat session to update
    - **name**: (Optional) New name for the chat session
    - **description**: (Optional) New description of the chat session's purpose
    - **agent**: (Optional) New agent reference for the chat session
    """
    db_session = db.query(ChatSession).filter(ChatSession.cht_id == session_id).first()
    if db_session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Chat session with ID {session_id} not found")

    # Update session attributes
    update_data = session.dict(exclude_unset=True, by_alias=True)
    
    # Map field names back to database column names
    field_to_db_map = {
        "name": "cht_name",
        "description": "cht_description",
        "agent": "cht_agt_id"
    }
    
    for field, value in update_data.items():
        db_field = field_to_db_map.get(field, field)
        setattr(db_session, db_field, value)

    db.commit()
    db.refresh(db_session)
    session_response = ChatSessionResponse.model_validate(db_session, from_attributes=True)
    return serialize_response(session_response)


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_chat_session(session_id: str, db: Session = Depends(get_db)):
    """
    Delete a chat session with cascade delete of related messages
    
    Permanently removes a chat session from the system along with all its messages.
    
    - **session_id**: The unique identifier of the chat session to delete
    """
    logger = logging.getLogger(__name__)
    
    try:
        logger.info(f"Attempting to delete chat session with ID: {session_id}")
        
        # Check if chat session exists first
        db_session = db.query(ChatSession).filter(ChatSession.cht_id == session_id).first()
        if db_session is None:
            logger.warning(f"Chat session with ID {session_id} not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail=f"Chat session with ID {session_id} not found"
            )
        
        # Delete the chat session (messages will be cascade deleted due to relationship)
        logger.debug(f"Deleting chat session {session_id}")
        db.delete(db_session)
        db.commit()
        
        logger.info(f"Successfully deleted chat session {session_id} and all its messages")
        return None
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Error deleting chat session {session_id}: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error while deleting chat session: {str(e)}"
        )


# Chat Message endpoints
@router.get("/sessions/{session_id}/messages")
def get_chat_messages(
    session_id: str,
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db)
):
    """
    Get all messages for a chat session
    
    Returns a list of all messages in a specific chat session.
    
    - **session_id**: The unique identifier of the chat session
    - **skip**: Number of records to skip for pagination
    - **limit**: Maximum number of records to return
    """
    # Check if session exists
    chat_session = db.query(ChatSession).filter(ChatSession.cht_id == session_id).first()
    if chat_session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Chat session with ID {session_id} not found")
    
    messages = db.query(ChatMessage).filter(ChatMessage.msg_cht_id == session_id).offset(skip).limit(limit).all()
    message_responses = [ChatMessageResponse.model_validate(message, from_attributes=True) for message in messages]
    return serialize_response_list(message_responses)


@router.get("/messages/{message_id}")
def get_chat_message(message_id: str, db: Session = Depends(get_db)):
    """
    Get a chat message by ID
    
    Retrieves detailed information about a specific chat message.
    
    - **message_id**: The unique identifier of the chat message
    """
    chat_message = db.query(ChatMessage).filter(ChatMessage.msg_id == message_id).first()
    if chat_message is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Chat message with ID {message_id} not found")
    message_response = ChatMessageResponse.model_validate(chat_message, from_attributes=True)
    return serialize_response(message_response)


@router.post("/messages", status_code=status.HTTP_201_CREATED)
def create_chat_message(message: ChatMessageCreate, db: Session = Depends(get_db)):
    """
    Create a new chat message
    
    Creates a new chat message within a chat session.
    
    - **chatSession**: Reference to the chat session this message belongs to
    - **agentName**: Name of the agent sending this message
    - **role**: Role of the message sender - either USER or AI
    - **content**: Message content as an array of message objects
    """
    # Check if chat session exists
    chat_session = db.query(ChatSession).filter(ChatSession.cht_id == message.chatSession).first()
    if chat_session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Chat session with ID {message.chatSession} not found"
        )
    
    # Generate unique message ID
    message_id = str(uuid.uuid4())
    
    # Create new chat message
    db_message = ChatMessage(
        msg_id=message_id,
        msg_cht_id=message.chatSession,
        msg_agent_name=message.agentName,
        msg_role=message.role.value,
        msg_content=message.content,
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    message_response = ChatMessageResponse.model_validate(db_message, from_attributes=True)
    return serialize_response(message_response)


@router.put("/messages/{message_id}")
def update_chat_message(message_id: str, message: ChatMessageUpdate, db: Session = Depends(get_db)):
    """
    Update an existing chat message
    
    Updates the properties of an existing chat message.
    
    - **message_id**: The unique identifier of the chat message to update
    - **chatSession**: (Optional) New chat session reference
    - **agentName**: (Optional) New agent name
    - **role**: (Optional) New message role - either USER or AI
    - **content**: (Optional) New message content
    """
    db_message = db.query(ChatMessage).filter(ChatMessage.msg_id == message_id).first()
    if db_message is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Chat message with ID {message_id} not found")

    # Update message attributes
    update_data = message.dict(exclude_unset=True, by_alias=True)
    
    # Map field names back to database column names
    field_to_db_map = {
        "chatSession": "msg_cht_id",
        "agentName": "msg_agent_name",
        "role": "msg_role",
        "content": "msg_content"
    }
    
    for field, value in update_data.items():
        db_field = field_to_db_map.get(field, field)
        # Handle enum values for role field
        if field == "role" and value is not None:
            value = value.value
        setattr(db_message, db_field, value)

    db.commit()
    db.refresh(db_message)
    message_response = ChatMessageResponse.model_validate(db_message, from_attributes=True)
    return serialize_response(message_response)


@router.delete("/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_chat_message(message_id: str, db: Session = Depends(get_db)):
    """
    Delete a chat message
    
    Permanently removes a chat message from the system.
    
    - **message_id**: The unique identifier of the chat message to delete
    """
    logger = logging.getLogger(__name__)
    
    try:
        logger.info(f"Attempting to delete chat message with ID: {message_id}")
        
        # Check if chat message exists first
        db_message = db.query(ChatMessage).filter(ChatMessage.msg_id == message_id).first()
        if db_message is None:
            logger.warning(f"Chat message with ID {message_id} not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail=f"Chat message with ID {message_id} not found"
            )
        
        # Delete the chat message
        logger.debug(f"Deleting chat message {message_id}")
        db.delete(db_message)
        db.commit()
        
        logger.info(f"Successfully deleted chat message {message_id}")
        return None
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Error deleting chat message {message_id}: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error while deleting chat message: {str(e)}"
        )
