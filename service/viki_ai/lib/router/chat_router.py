"""
Chat router for VIKI API
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
import logging
from datetime import datetime
from datetime import datetime

from ..model.chat import ChatSession, ChatMessage
from ..model.agent import Agent
from ..model.llm import LLMConfig
from ..model.db_session import get_db
from .schemas import (
    ChatSessionCreate, ChatSessionUpdate, ChatSessionResponse,
    ChatMessageCreate, ChatMessageUpdate, ChatMessageResponse,
    ChatAIRequest, ChatAIResponse
)
from .response_utils import serialize_response, serialize_response_list
from ..util.ai_chat_utility import AIChatUtility

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
    - **agent**: Reference to the agent that will handle this chat
    """
    # Generate unique session ID
    session_id = str(uuid.uuid4())
    
    # Create new chat session
    db_session = ChatSession(
        cht_id=session_id,
        cht_name=session.name,
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


@router.post("/ai-chat", response_model=ChatAIResponse)
async def chat_with_ai(request: ChatAIRequest, db: Session = Depends(get_db)):
    """
    Generate AI response for a chat message
    
    This endpoint uses the AI Chat Utility to generate intelligent responses.
    It retrieves the chat session, agent configuration, LLM settings, and chat history,
    then generates an AI response using the configured model and tools.
    
    - **message**: The user message to send to the AI
    - **chatSessionId**: The ID of the chat session
    
    Returns:
    - **success**: Whether the request was successful
    - **response**: The AI-generated response
    - **error**: Error message if the request failed
    - **sessionId**: The chat session ID
    - **messageCount**: Total messages in the session after processing
    - **timestamp**: Timestamp of the response
    """
    logger = logging.getLogger(__name__)
    
    try:
        logger.info(f"Processing AI chat request for session: {request.chatSessionId}")
        
        # 1. Get chat session from database
        chat_session = db.query(ChatSession).filter(ChatSession.cht_id == request.chatSessionId).first()
        if chat_session is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Chat session with ID {request.chatSessionId} not found"
            )
        
        # 2. Get agent details
        agent = db.query(Agent).filter(Agent.agt_id == chat_session.cht_agt_id).first()
        if agent is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Agent with ID {chat_session.cht_agt_id} not found"
            )
        
        # 3. Get LLM configuration
        llm_config = db.query(LLMConfig).filter(LLMConfig.llc_id == agent.agt_llc_id).first()
        if llm_config is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"LLM configuration with ID {agent.agt_llc_id} not found"
            )
        
        # 4. Get chat history (last 50 messages for context)
        messages = db.query(ChatMessage).filter(
            ChatMessage.msg_cht_id == request.chatSessionId
        ).order_by(ChatMessage.creation_dt.asc()).limit(50).all()
        
        logger.info(f"Found {len(messages)} historical messages for context")
        
        # 5. Initialize AI Chat Utility with agent's configuration
        # Map provider type codes to utility format
        provider_mapping = {
            'OPENAI': 'openai',
            'OLLAMA': 'ollama',
            'GROQ': 'groq',
            'ANTHROPIC': 'anthropic',
            'AZURE': 'azure',
            'HUGGINGFACE': 'huggingface',
            'CEREBRAS': 'cerebras',
            'OPENROUTER': 'openrouter'
        }
        
        llm_provider = provider_mapping.get(llm_config.llc_provider_type_cd.upper(), 'ollama')
        
        # 5.5. Load agent-specific tools and create MCP server configurations
        logger.info(f"Loading tools for agent {agent.agt_id}")
        
        # Import required models for agent tool queries
        from ..model.agent import AgentTool
        from ..model.tools import Tool, ToolEnvironmentVariable
        
        # Get tools associated with this agent
        agent_tools_query = db.query(AgentTool).filter(AgentTool.ato_agt_id == agent.agt_id).all()
        tool_ids = [at.ato_tol_id for at in agent_tools_query]
        
        logger.info(f"Found {len(tool_ids)} tools associated with agent {agent.agt_id}: {tool_ids}")
        
        # Build agent-specific MCP server configurations
        agent_mcp_configs = []
        
        if tool_ids:
            # Get tool details for each associated tool
            tools = db.query(Tool).filter(Tool.tol_id.in_(tool_ids)).all()
            
            for tool in tools:
                # Get environment variables for this tool
                env_vars = db.query(ToolEnvironmentVariable).filter(
                    ToolEnvironmentVariable.tev_tol_id == tool.tol_id
                ).all()
                
                # Convert to dictionary
                environment_variables = {getattr(var, 'tev_key'): getattr(var, 'tev_value') for var in env_vars}
                
                # Create MCP config for this tool
                tool_mcp_config = {
                    "tool_id": tool.tol_id,
                    "tool_name": tool.tol_name,
                    "mcp_command": tool.tol_mcp_command,
                    "env": environment_variables
                }
                agent_mcp_configs.append(tool_mcp_config)
                
                logger.info(f"Added MCP config for tool {tool.tol_name} (ID: {tool.tol_id})")
        
        logger.info(f"Created {len(agent_mcp_configs)} MCP server configurations for agent")
        
        # Create AI Chat Utility instance with agent-specific MCP configurations
        chat_util = AIChatUtility(
            llm_provider=llm_provider,
            model_name=getattr(llm_config, 'llc_model_cd', ''),
            api_key=getattr(llm_config, 'llc_api_key', None),
            base_url=getattr(llm_config, 'llc_endpoint_url', None),
            temperature=0.0,
            system_prompt=getattr(agent, 'agt_system_prompt', None),
            agent_mcp_configs=agent_mcp_configs  # Pass agent-specific MCP configs
        )
        
        # 6. Build conversation history for AI context
        # Convert database messages to AI utility format
        conversation_history = []
        system_prompt = getattr(agent, 'agt_system_prompt', None)
        if system_prompt:
            conversation_history.append({
                "role": "system",
                "content": system_prompt
            })
        
        for msg in messages:
            # Extract content from the message
            msg_content = getattr(msg, 'msg_content', [])
            if isinstance(msg_content, list) and len(msg_content) > 0:
                content = msg_content[0].get('content', '') if isinstance(msg_content[0], dict) else str(msg_content[0])
            else:
                content = str(msg_content)
            
            msg_role = getattr(msg, 'msg_role', '')
            role = "user" if msg_role == "USER" else "assistant"
            conversation_history.append({
                "role": role,
                "content": content
            })
        
        # Add current user message
        conversation_history.append({
            "role": "user",
            "content": request.message
        })
        
        # 7. Manually set the conversation history in the AI utility
        chat_util.message_history = conversation_history
        chat_util.session_id = f"session_{request.chatSessionId}"
        
        logger.info(f"Generating AI response with {len(conversation_history)} messages in context")
        
        # 8. Generate AI response
        ai_response = await chat_util.generate_response(
            request.message,
            include_history=True
        )
        
        if not ai_response.get("success", False):
            error_msg = ai_response.get("error", "Unknown error occurred")
            logger.error(f"AI response generation failed: {error_msg}")
            return ChatAIResponse(
                success=False,
                response=None,
                error=error_msg,
                sessionId=request.chatSessionId,
                messageCount=len(messages),
                timestamp=datetime.now().isoformat()
            )
        
        # 9. Save user message to database
        user_message_id = str(uuid.uuid4())
        agent_name = getattr(agent, 'agt_name', 'Unknown Agent')
        user_message = ChatMessage(
            msg_id=user_message_id,
            msg_cht_id=request.chatSessionId,
            msg_agent_name=agent_name,
            msg_role="USER",
            msg_content=[{"role": "user", "content": request.message}]
        )
        db.add(user_message)
        
        # 10. Save AI response to database
        ai_message_id = str(uuid.uuid4())
        ai_message = ChatMessage(
            msg_id=ai_message_id,
            msg_cht_id=request.chatSessionId,
            msg_agent_name=agent_name,
            msg_role="AI",
            msg_content=[{"role": "assistant", "content": ai_response["response"]}]
        )
        db.add(ai_message)
        
        db.commit()
        
        logger.info(f"AI response generated and saved successfully for session: {request.chatSessionId}")
        
        return ChatAIResponse(
            success=True,
            response=ai_response["response"],
            error=None,
            sessionId=request.chatSessionId,
            messageCount=len(messages) + 2,  # +2 for user message and AI response
            timestamp=ai_response.get("timestamp", datetime.now().isoformat())
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Unexpected error in AI chat: {str(e)}")
        db.rollback()
        return ChatAIResponse(
            success=False,
            response=None,
            error=f"Internal server error: {str(e)}",
            sessionId=request.chatSessionId,
            messageCount=0,
            timestamp=datetime.now().isoformat()
        )
