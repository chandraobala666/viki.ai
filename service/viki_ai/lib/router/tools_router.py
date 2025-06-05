"""
Tools router for VIKI API
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict
import uuid

from ..model.tools import Tool, ToolEnvironmentVariable
from ..model.db_session import get_db
from .schemas import (
    ToolCreate,
    ToolUpdate,
    ToolResponse,
    ToolEnvironmentVariableCreate,
    ToolEnvironmentVariableResponse,
    ToolEnvironmentVariableBase,
    ToolEnvironmentVariableBulkResponse
)
from .response_utils import serialize_response, serialize_response_list

router = APIRouter(
    prefix="/tools",
    tags=["tools"],
    responses={404: {"description": "Not found"}},
)


@router.get("/")
def get_tools(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Get all tools
    """
    tools = db.query(Tool).offset(skip).limit(limit).all()
    tool_responses = [ToolResponse.model_validate(tool, from_attributes=True) for tool in tools]
    return serialize_response_list(tool_responses)


@router.get("/{tool_id}")
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
    tool_response = ToolResponse.model_validate(tool, from_attributes=True)
    return serialize_response(tool_response)


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_tool(tool: ToolCreate, db: Session = Depends(get_db)):
    """
    Create a new tool
    """
    # Generate unique tool ID
    tool_id = str(uuid.uuid4())
    
    # Create new tool with mapped field names
    db_tool = Tool(
        tol_id=tool_id,
        tol_name=tool.name,
        tol_description=tool.description,
        tol_mcp_command=tool.mcpCommand
    )
    db.add(db_tool)
    db.commit()
    db.refresh(db_tool)
    tool_response = ToolResponse.model_validate(db_tool, from_attributes=True)
    return serialize_response(tool_response)


@router.put("/{tool_id}")
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
    
    # Map field names back to database column names
    field_to_db_map = {
        "name": "tol_name",
        "description": "tol_description",
        "mcpCommand": "tol_mcp_command"
    }
    
    for field, value in update_data.items():
        db_field = field_to_db_map.get(field, field)
        setattr(db_tool, db_field, value)
    
    db.add(db_tool)
    db.commit()
    db.refresh(db_tool)
    tool_response = ToolResponse.model_validate(db_tool, from_attributes=True)
    return serialize_response(tool_response)


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
@router.get("/{tool_id}/env-variables")
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
    
    env_var_responses = [ToolEnvironmentVariableResponse.model_validate(env_var, from_attributes=True) for env_var in env_vars]
    return serialize_response_list(env_var_responses)


@router.post("/{tool_id}/env-variables", status_code=status.HTTP_201_CREATED)
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
        ToolEnvironmentVariable.tev_key == env_var.key
    ).first()
    
    if db_env_var:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Environment variable '{env_var.key}' already exists for Tool {tool_id}"
        )
    
    # Create the environment variable
    db_env_var = ToolEnvironmentVariable(
        tev_tol_id=tool_id,
        tev_key=env_var.key,
        tev_value=env_var.value
    )
    
    db.add(db_env_var)
    db.commit()
    db.refresh(db_env_var)
    env_var_response = ToolEnvironmentVariableResponse.model_validate(db_env_var, from_attributes=True)
    return serialize_response(env_var_response)


@router.post("/{tool_id}/env-variables/bulk", status_code=status.HTTP_201_CREATED)
def add_environment_variables_bulk_to_tool(tool_id: str, env_vars: List[ToolEnvironmentVariableBase], db: Session = Depends(get_db)):
    """
    Add multiple environment variables to a tool
    """
    # First check if the tool exists
    tool = db.query(Tool).filter(Tool.tol_id == tool_id).first()
    
    if tool is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tool with ID {tool_id} not found"
        )
    
    success_responses = []
    error_responses = []
    
    for env_var in env_vars:
        try:
            # Check if the environment variable already exists
            existing_env_var = db.query(ToolEnvironmentVariable).filter(
                ToolEnvironmentVariable.tev_tol_id == tool_id,
                ToolEnvironmentVariable.tev_key == env_var.key
            ).first()
            
            if existing_env_var:
                error_responses.append({
                    "key": env_var.key,
                    "error": f"Environment variable '{env_var.key}' already exists for Tool {tool_id}"
                })
                continue
            
            # Create the environment variable
            db_env_var = ToolEnvironmentVariable(
                tev_tol_id=tool_id,
                tev_key=env_var.key,
                tev_value=env_var.value
            )
            
            db.add(db_env_var)
            db.commit()
            db.refresh(db_env_var)
            
            env_var_response = ToolEnvironmentVariableResponse.model_validate(db_env_var, from_attributes=True)
            success_responses.append(env_var_response)
            
        except Exception as e:
            db.rollback()
            error_responses.append({
                "key": env_var.key,
                "error": f"Failed to create environment variable: {str(e)}"
            })
    
    bulk_response = ToolEnvironmentVariableBulkResponse(
        success=success_responses,
        errors=error_responses
    )
    
    return serialize_response(bulk_response)


@router.put("/{tool_id}/env-variables/{env_key}")
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
    setattr(db_env_var, "tev_key", env_var.key)
    setattr(db_env_var, "tev_value", env_var.value)
    
    db.add(db_env_var)
    db.commit()
    db.refresh(db_env_var)
    env_var_response = ToolEnvironmentVariableResponse.model_validate(db_env_var, from_attributes=True)
    return serialize_response(env_var_response)


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
