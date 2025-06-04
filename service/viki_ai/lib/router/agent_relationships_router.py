"""
Agent relationships router for VIKI API
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..model.agent import AgentTool, AgentKnowledgeBase
from ..model.db_session import get_db
from .schemas import (
    AgentToolCreate, AgentToolResponse, 
    AgentKnowledgeBaseCreate, AgentKnowledgeBaseResponse
)
from .response_utils import serialize_response, serialize_response_list

router = APIRouter(
    prefix="/agent-relationships",
    tags=["agent-relationships"],
    responses={404: {"description": "Not found"}},
)


# Agent Tools endpoints
@router.get("/tools")
def get_agent_tools(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Get all agent tools
    
    Returns a list of all agent-tool associations, showing which tools are available to which agents.
    
    - **skip**: Number of records to skip for pagination
    - **limit**: Maximum number of records to return
    """
    agent_tools = db.query(AgentTool).offset(skip).limit(limit).all()
    agent_tool_responses = [AgentToolResponse.model_validate(agent_tool, from_attributes=True) for agent_tool in agent_tools]
    return serialize_response_list(agent_tool_responses)


@router.get("/tools/{agent_id}/{tool_id}")
def get_agent_tool(agent_id: str, tool_id: str, db: Session = Depends(get_db)):
    """
    Get a specific agent tool association
    
    Retrieves the specific relationship between an agent and a tool.
    
    - **agent_id**: The unique identifier of the agent
    - **tool_id**: The unique identifier of the tool
    """
    agent_tool = db.query(AgentTool).filter(
        AgentTool.ato_agt_id == agent_id,
        AgentTool.ato_tol_id == tool_id
    ).first()
    
    if agent_tool is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Agent tool with agent ID {agent_id} and tool ID {tool_id} not found"
        )
    agent_tool_response = AgentToolResponse.model_validate(agent_tool, from_attributes=True)
    return serialize_response(agent_tool_response)


@router.post("/tools", status_code=status.HTTP_201_CREATED)
def create_agent_tool(agent_tool: AgentToolCreate, db: Session = Depends(get_db)):
    """
    Create a new agent tool relationship
    
    Associates a tool with an agent, making the tool available for the agent to use.
    
    - **agent**: The unique identifier of the agent
    - **tool**: The unique identifier of the tool to associate
    """
    # Check if agent tool already exists
    db_agent_tool = db.query(AgentTool).filter(
        AgentTool.ato_agt_id == agent_tool.agent,
        AgentTool.ato_tol_id == agent_tool.tool
    ).first()
    
    if db_agent_tool:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Agent tool with agent ID {agent_tool.agent} and tool ID {agent_tool.tool} already exists"
        )
    
    # Create new agent tool
    db_agent_tool = AgentTool(
        ato_agt_id=agent_tool.agent,
        ato_tol_id=agent_tool.tool,
    )
    db.add(db_agent_tool)
    db.commit()
    db.refresh(db_agent_tool)
    agent_tool_response = AgentToolResponse.model_validate(db_agent_tool, from_attributes=True)
    return serialize_response(agent_tool_response)


@router.delete("/tools/{agent_id}/{tool_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_agent_tool(agent_id: str, tool_id: str, db: Session = Depends(get_db)):
    """
    Delete an agent tool relationship
    
    Removes the association between an agent and a tool.
    
    - **agent_id**: The unique identifier of the agent
    - **tool_id**: The unique identifier of the tool to disassociate
    """
    db_agent_tool = db.query(AgentTool).filter(
        AgentTool.ato_agt_id == agent_id,
        AgentTool.ato_tol_id == tool_id
    ).first()
    
    if db_agent_tool is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Agent tool with agent ID {agent_id} and tool ID {tool_id} not found"
        )
    
    db.delete(db_agent_tool)
    db.commit()
    return None


# Agent Knowledge Base endpoints
@router.get("/knowledge-bases")
def get_agent_knowledge_bases(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Get all agent knowledge base associations
    
    Returns a list of all associations between agents and knowledge bases.
    
    - **skip**: Number of records to skip for pagination
    - **limit**: Maximum number of records to return
    """
    agent_knowledge_bases = db.query(AgentKnowledgeBase).offset(skip).limit(limit).all()
    agent_kb_responses = [AgentKnowledgeBaseResponse.model_validate(agent_kb, from_attributes=True) for agent_kb in agent_knowledge_bases]
    return serialize_response_list(agent_kb_responses)


@router.get("/knowledge-bases/{agent_id}/{kb_id}")
def get_agent_knowledge_base(agent_id: str, kb_id: str, db: Session = Depends(get_db)):
    """
    Get a specific agent knowledge base association
    
    Retrieves the relationship between an agent and a knowledge base.
    
    - **agent_id**: The unique identifier of the agent
    - **kb_id**: The unique identifier of the knowledge base
    """
    agent_kb = db.query(AgentKnowledgeBase).filter(
        AgentKnowledgeBase.akb_agt_id == agent_id,
        AgentKnowledgeBase.akb_knb_id == kb_id
    ).first()
    
    if agent_kb is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Agent knowledge base with agent ID {agent_id} and KB ID {kb_id} not found"
        )
    agent_kb_response = AgentKnowledgeBaseResponse.model_validate(agent_kb, from_attributes=True)
    return serialize_response(agent_kb_response)


@router.post("/knowledge-bases", status_code=status.HTTP_201_CREATED)
def create_agent_knowledge_base(agent_kb: AgentKnowledgeBaseCreate, db: Session = Depends(get_db)):
    """
    Create a new agent knowledge base relationship
    
    Associates a knowledge base with an agent, allowing the agent to access its contents.
    
    - **agent**: The unique identifier of the agent
    - **knowledgeBase**: The unique identifier of the knowledge base to associate
    """
    # Check if agent knowledge base already exists
    db_agent_kb = db.query(AgentKnowledgeBase).filter(
        AgentKnowledgeBase.akb_agt_id == agent_kb.agent,
        AgentKnowledgeBase.akb_knb_id == agent_kb.knowledgeBase
    ).first()
    
    if db_agent_kb:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Agent knowledge base with agent ID {agent_kb.agent} and KB ID {agent_kb.knowledgeBase} already exists"
        )
    
    # Create new agent knowledge base
    db_agent_kb = AgentKnowledgeBase(
        akb_agt_id=agent_kb.agent,
        akb_knb_id=agent_kb.knowledgeBase,
    )
    db.add(db_agent_kb)
    db.commit()
    db.refresh(db_agent_kb)
    agent_kb_response = AgentKnowledgeBaseResponse.model_validate(db_agent_kb, from_attributes=True)
    return serialize_response(agent_kb_response)


@router.delete("/knowledge-bases/{agent_id}/{kb_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_agent_knowledge_base(agent_id: str, kb_id: str, db: Session = Depends(get_db)):
    """
    Delete an agent knowledge base relationship
    
    Removes the association between an agent and a knowledge base.
    
    - **agent_id**: The unique identifier of the agent
    - **kb_id**: The unique identifier of the knowledge base to disassociate
    """
    db_agent_kb = db.query(AgentKnowledgeBase).filter(
        AgentKnowledgeBase.akb_agt_id == agent_id,
        AgentKnowledgeBase.akb_knb_id == kb_id
    ).first()
    
    if db_agent_kb is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Agent knowledge base with agent ID {agent_id} and KB ID {kb_id} not found"
        )
    
    db.delete(db_agent_kb)
    db.commit()
    return None
