"""
Tools router for VIKI API
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict

from ..model.tools import Tool, ToolEnvironmentVariable
from ..model.db_session import get_db
from .schemas import (
    ToolCreate,
    ToolUpdate,
    ToolResponse,
    ToolEnvironmentVariableCreate,
    ToolEnvironmentVariableResponse,
    ToolEnvironmentVariableBase
)

router = APIRouter(
    prefix="/tools",
    tags=["tools"],
    responses={404: {"description": "Not found"}},
)


@router.get("/", response_model=List[ToolResponse])
def get_tools(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Get all tools
    """
    tools = db.query(Tool).offset(skip).limit(limit).all()
    return tools


@router.get("/{tool_id}", response_model=ToolResponse)
def get_tool(tool_id: str, db: Session = Depends(get_db)):
    """
    Get a tool by ID
    """
    tool = db.query(Tool).filter(Tool.tol_id == tool_id).first()
    if tool is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Tool with ID {tool_id} not found"
        )
    return tool


@router.post("/", response_model=ToolResponse, status_code=status.HTTP_201_CREATED)
def create_tool(tool: ToolCreate, db: Session = Depends(get_db)):
    """
    Create a new tool
    """
    db_tool = db.query(Tool).filter(Tool.tol_id == tool.tol_id).first()
    
    if db_tool:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tool with ID {tool.tol_id} already exists"
        )
    
    db_tool = Tool(**tool.dict())
    db.add(db_tool)
    db.commit()
    db.refresh(db_tool)
    return db_tool


@router.put("/{tool_id}", response_model=ToolResponse)
def update_tool(tool_id: str, tool: ToolUpdate, db: Session = Depends(get_db)):
    """
    Update a tool
    """
    db_tool = db.query(Tool).filter(Tool.tol_id == tool_id).first()
    
    if db_tool is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tool with ID {tool_id} not found"
        )
    
    update_data = tool.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_tool, key, value)
    
    db.add(db_tool)
    db.commit()
    db.refresh(db_tool)
    return db_tool


@router.delete("/{tool_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tool(tool_id: str, db: Session = Depends(get_db)):
    """
    Delete a tool
    """
    db_tool = db.query(Tool).filter(Tool.tol_id == tool_id).first()
    
    if db_tool is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tool with ID {tool_id} not found"
        )
    
    db.delete(db_tool)
    db.commit()
    return None


# Tool Environment Variable Endpoints
@router.get("/{tool_id}/env-variables", response_model=List[ToolEnvironmentVariableResponse])
def get_tool_environment_variables(tool_id: str, db: Session = Depends(get_db)):
    """
    Get all environment variables for a tool
    """
    # First check if the tool exists
    tool = db.query(Tool).filter(Tool.tol_id == tool_id).first()
    
    if tool is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tool with ID {tool_id} not found"
        )
    
    env_vars = db.query(ToolEnvironmentVariable).filter(
        ToolEnvironmentVariable.tev_tol_id == tool_id
    ).all()
    
    return env_vars


@router.post("/{tool_id}/env-variables", response_model=ToolEnvironmentVariableResponse, status_code=status.HTTP_201_CREATED)
def add_environment_variable_to_tool(tool_id: str, env_var: ToolEnvironmentVariableBase, db: Session = Depends(get_db)):
    """
    Add an environment variable to a tool
    """
    # First check if the tool exists
    tool = db.query(Tool).filter(Tool.tol_id == tool_id).first()
    
    if tool is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tool with ID {tool_id} not found"
        )
    
    # Check if the environment variable already exists
    db_env_var = db.query(ToolEnvironmentVariable).filter(
        ToolEnvironmentVariable.tev_tol_id == tool_id,
        ToolEnvironmentVariable.tev_key == env_var.tev_key
    ).first()
    
    if db_env_var:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Environment variable '{env_var.tev_key}' already exists for Tool {tool_id}"
        )
    
    # Create the environment variable
    db_env_var = ToolEnvironmentVariable(
        tev_tol_id=tool_id,
        tev_key=env_var.tev_key,
        tev_value=env_var.tev_value
    )
    
    db.add(db_env_var)
    db.commit()
    db.refresh(db_env_var)
    return db_env_var


@router.put("/{tool_id}/env-variables/{env_key}", response_model=ToolEnvironmentVariableResponse)
def update_environment_variable(tool_id: str, env_key: str, env_var: ToolEnvironmentVariableBase, db: Session = Depends(get_db)):
    """
    Update an environment variable for a tool
    """
    # Check if the environment variable exists
    db_env_var = db.query(ToolEnvironmentVariable).filter(
        ToolEnvironmentVariable.tev_tol_id == tool_id,
        ToolEnvironmentVariable.tev_key == env_key
    ).first()
    
    if db_env_var is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Environment variable '{env_key}' not found for Tool {tool_id}"
        )
    
    # Update the environment variable
    setattr(db_env_var, "tev_key", env_var.tev_key)
    setattr(db_env_var, "tev_value", env_var.tev_value)
    
    db.add(db_env_var)
    db.commit()
    db.refresh(db_env_var)
    return db_env_var


@router.delete("/{tool_id}/env-variables/{env_key}", status_code=status.HTTP_204_NO_CONTENT)
def delete_environment_variable(tool_id: str, env_key: str, db: Session = Depends(get_db)):
    """
    Delete an environment variable for a tool
    """
    # Check if the environment variable exists
    db_env_var = db.query(ToolEnvironmentVariable).filter(
        ToolEnvironmentVariable.tev_tol_id == tool_id,
        ToolEnvironmentVariable.tev_key == env_key
    ).first()
    
    if db_env_var is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Environment variable '{env_key}' not found for Tool {tool_id}"
        )
    
    db.delete(db_env_var)
    db.commit()
    return None
