"""
Agent router for VIKI API
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..model.agent import Agent
from ..model.db_session import get_db
from .schemas import AgentCreate, AgentUpdate, AgentResponse

router = APIRouter(
    prefix="/agents",
    tags=["agents"],
    responses={404: {"description": "Not found"}},
)


@router.get("/", response_model=List[AgentResponse])
def get_agents(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Get all agents
    """
    agents = db.query(Agent).offset(skip).limit(limit).all()
    return agents


@router.get("/{agent_id}", response_model=AgentResponse)
def get_agent(agent_id: str, db: Session = Depends(get_db)):
    """
    Get an agent by ID
    """
    agent = db.query(Agent).filter(Agent.agt_id == agent_id).first()
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Agent with ID {agent_id} not found")
    return agent


@router.post("/", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
def create_agent(agent: AgentCreate, db: Session = Depends(get_db)):
    """
    Create a new agent
    """
    # Check if agent with the same ID already exists
    db_agent = db.query(Agent).filter(Agent.agt_id == agent.agt_id).first()
    if db_agent:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Agent with ID {agent.agt_id} already exists")
    
    # Create new agent
    db_agent = Agent(
        agt_id=agent.agt_id,
        agt_name=agent.agt_name,
        agt_description=agent.agt_description,
        agt_llc_id=agent.agt_llc_id,
        agt_system_prompt=agent.agt_system_prompt,
    )
    db.add(db_agent)
    db.commit()
    db.refresh(db_agent)
    return db_agent


@router.put("/{agent_id}", response_model=AgentResponse)
def update_agent(agent_id: str, agent: AgentUpdate, db: Session = Depends(get_db)):
    """
    Update an existing agent
    """
    db_agent = db.query(Agent).filter(Agent.agt_id == agent_id).first()
    if db_agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Agent with ID {agent_id} not found")

    # Update agent attributes
    update_data = agent.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_agent, key, value)

    db.commit()
    db.refresh(db_agent)
    return db_agent


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_agent(agent_id: str, db: Session = Depends(get_db)):
    """
    Delete an agent
    """
    db_agent = db.query(Agent).filter(Agent.agt_id == agent_id).first()
    if db_agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Agent with ID {agent_id} not found")
    
    db.delete(db_agent)
    db.commit()
    return None
