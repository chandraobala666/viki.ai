"""
Agent router for VIKI API
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..model.agent import Agent
from ..model.db_session import get_db
from .schemas import AgentCreate, AgentUpdate, AgentResponse
from .response_utils import serialize_response, serialize_response_list

router = APIRouter(
    prefix="/agents",
    tags=["agents"],
    responses={404: {"description": "Not found"}},
)


@router.get("/")
def get_agents(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Get all agents
    
    Returns a list of all registered agents in the system.
    
    - **skip**: Number of records to skip for pagination
    - **limit**: Maximum number of records to return
    """
    agents = db.query(Agent).offset(skip).limit(limit).all()
    agent_responses = [AgentResponse.model_validate(agent, from_attributes=True) for agent in agents]
    return serialize_response_list(agent_responses)


@router.get("/{agent_id}")
def get_agent(agent_id: str, db: Session = Depends(get_db)):
    """
    Get an agent by ID
    
    Retrieves detailed information about a specific agent.
    
    - **agent_id**: The unique identifier of the agent
    """
    agent = db.query(Agent).filter(Agent.agt_id == agent_id).first()
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Agent with ID {agent_id} not found")
    agent_response = AgentResponse.model_validate(agent, from_attributes=True)
    return serialize_response(agent_response)


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_agent(agent: AgentCreate, db: Session = Depends(get_db)):
    """
    Create a new agent
    
    Creates a new AI agent with the specified configuration.
    
    - **id**: Unique identifier for the agent
    - **name**: Human-readable name for the agent
    - **description**: Detailed description of the agent's purpose
    - **llmConfig**: Reference to the LLM configuration to use
    - **systemPrompt**: System prompt that defines the agent's behavior
    """
    # Check if agent with the same ID already exists
    db_agent = db.query(Agent).filter(Agent.agt_id == agent.id).first()
    if db_agent:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Agent with ID {agent.id} already exists")
    
    # Create new agent
    db_agent = Agent(
        agt_id=agent.id,
        agt_name=agent.name,
        agt_description=agent.description,
        agt_llc_id=agent.llmConfig,
        agt_system_prompt=agent.systemPrompt,
    )
    db.add(db_agent)
    db.commit()
    db.refresh(db_agent)
    agent_response = AgentResponse.model_validate(db_agent, from_attributes=True)
    return serialize_response(agent_response)


@router.put("/{agent_id}")
def update_agent(agent_id: str, agent: AgentUpdate, db: Session = Depends(get_db)):
    """
    Update an existing agent
    
    Updates the properties of an existing agent.
    
    - **agent_id**: The unique identifier of the agent to update
    - **name**: (Optional) New name for the agent
    - **description**: (Optional) New description of the agent's purpose
    - **llmConfig**: (Optional) New LLM configuration reference
    - **systemPrompt**: (Optional) New system prompt for the agent
    """
    db_agent = db.query(Agent).filter(Agent.agt_id == agent_id).first()
    if db_agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Agent with ID {agent_id} not found")

    # Update agent attributes
    update_data = agent.dict(exclude_unset=True, by_alias=True)
    
    # Map field names back to database column names
    field_to_db_map = {
        "name": "agt_name",
        "description": "agt_description", 
        "llmConfig": "agt_llc_id",
        "systemPrompt": "agt_system_prompt"
    }
    
    for field, value in update_data.items():
        db_field = field_to_db_map.get(field, field)
        setattr(db_agent, db_field, value)

    db.commit()
    db.refresh(db_agent)
    agent_response = AgentResponse.model_validate(db_agent, from_attributes=True)
    return serialize_response(agent_response)


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_agent(agent_id: str, db: Session = Depends(get_db)):
    """
    Delete an agent
    
    Permanently removes an agent from the system.
    
    - **agent_id**: The unique identifier of the agent to delete
    """
    db_agent = db.query(Agent).filter(Agent.agt_id == agent_id).first()
    if db_agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Agent with ID {agent_id} not found")
    
    db.delete(db_agent)
    db.commit()
    return None
