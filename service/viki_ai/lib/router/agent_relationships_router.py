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

router = APIRouter(
    prefix="/agent-relationships",
    tags=["agent-relationships"],
    responses={404: {"description": "Not found"}},
)


# Agent Tools endpoints
@router.get("/tools", response_model=List[AgentToolResponse])
def get_agent_tools(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Get all agent tools
    """
    agent_tools = db.query(AgentTool).offset(skip).limit(limit).all()
    return agent_tools


@router.get("/tools/{agent_id}/{tool_id}", response_model=AgentToolResponse)
def get_agent_tool(agent_id: str, tool_id: str, db: Session = Depends(get_db)):
    """
    Get an agent tool by agent ID and tool ID
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
    return agent_tool


@router.post("/tools", response_model=AgentToolResponse, status_code=status.HTTP_201_CREATED)
def create_agent_tool(agent_tool: AgentToolCreate, db: Session = Depends(get_db)):
    """
    Create a new agent tool relationship
    """
    # Check if agent tool already exists
    db_agent_tool = db.query(AgentTool).filter(
        AgentTool.ato_agt_id == agent_tool.ato_agt_id,
        AgentTool.ato_tol_id == agent_tool.ato_tol_id
    ).first()
    
    if db_agent_tool:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Agent tool with agent ID {agent_tool.ato_agt_id} and tool ID {agent_tool.ato_tol_id} already exists"
        )
    
    # Create new agent tool
    db_agent_tool = AgentTool(
        ato_agt_id=agent_tool.ato_agt_id,
        ato_tol_id=agent_tool.ato_tol_id,
    )
    db.add(db_agent_tool)
    db.commit()
    db.refresh(db_agent_tool)
    return db_agent_tool


@router.delete("/tools/{agent_id}/{tool_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_agent_tool(agent_id: str, tool_id: str, db: Session = Depends(get_db)):
    """
    Delete an agent tool relationship
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
@router.get("/knowledge-bases", response_model=List[AgentKnowledgeBaseResponse])
def get_agent_knowledge_bases(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Get all agent knowledge bases
    """
    agent_knowledge_bases = db.query(AgentKnowledgeBase).offset(skip).limit(limit).all()
    return agent_knowledge_bases


@router.get("/knowledge-bases/{agent_id}/{kb_id}", response_model=AgentKnowledgeBaseResponse)
def get_agent_knowledge_base(agent_id: str, kb_id: str, db: Session = Depends(get_db)):
    """
    Get an agent knowledge base by agent ID and knowledge base ID
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
    return agent_kb


@router.post("/knowledge-bases", response_model=AgentKnowledgeBaseResponse, status_code=status.HTTP_201_CREATED)
def create_agent_knowledge_base(agent_kb: AgentKnowledgeBaseCreate, db: Session = Depends(get_db)):
    """
    Create a new agent knowledge base relationship
    """
    # Check if agent knowledge base already exists
    db_agent_kb = db.query(AgentKnowledgeBase).filter(
        AgentKnowledgeBase.akb_agt_id == agent_kb.akb_agt_id,
        AgentKnowledgeBase.akb_knb_id == agent_kb.akb_knb_id
    ).first()
    
    if db_agent_kb:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Agent knowledge base with agent ID {agent_kb.akb_agt_id} and KB ID {agent_kb.akb_knb_id} already exists"
        )
    
    # Create new agent knowledge base
    db_agent_kb = AgentKnowledgeBase(
        akb_agt_id=agent_kb.akb_agt_id,
        akb_knb_id=agent_kb.akb_knb_id,
    )
    db.add(db_agent_kb)
    db.commit()
    db.refresh(db_agent_kb)
    return db_agent_kb


@router.delete("/knowledge-bases/{agent_id}/{kb_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_agent_knowledge_base(agent_id: str, kb_id: str, db: Session = Depends(get_db)):
    """
    Delete an agent knowledge base relationship
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
