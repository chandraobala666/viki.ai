"""
Tools router for VIKI API
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict
import uuid
import logging

from ..model.tools import Tool, ToolEnvironmentVariable, ToolResource
from ..model.db_session import get_db
from ..util.mcp_test_util import test_mcp_configuration_sync
from .schemas import (
    ToolCreate,
    ToolUpdate,
    ToolResponse,
    ToolEnvironmentVariableCreate,
    ToolEnvironmentVariableResponse,
    ToolEnvironmentVariableBase,
    ToolEnvironmentVariableBulkResponse,
    ToolResourceCreate,
    ToolResourceResponse,
    ToolResourceBase,
    ToolResourceBulkResponse
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
    logger = logging.getLogger(__name__)
    
    try:
        from ..model.agent import AgentTool
        
        logger.info(f"Attempting to delete tool with ID: {tool_id}")
        
        db_tool = db.query(Tool).filter(Tool.tol_id == tool_id).first()
        
        if db_tool is None:
            logger.warning(f"Tool with ID {tool_id} not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tool with ID {tool_id} not found"
            )
        
        # Delete related records first to avoid foreign key constraint violations
        logger.debug(f"Deleting agent-tool relationships for tool {tool_id}")
        agent_tools_deleted = db.query(AgentTool).filter(AgentTool.ato_tol_id == tool_id).delete()
        logger.debug(f"Deleted {agent_tools_deleted} agent-tool relationships")
        
        logger.debug(f"Deleting environment variables for tool {tool_id}")
        env_vars_deleted = db.query(ToolEnvironmentVariable).filter(ToolEnvironmentVariable.tev_tol_id == tool_id).delete()
        logger.debug(f"Deleted {env_vars_deleted} environment variables")
        
        logger.debug(f"Deleting tool resources for tool {tool_id}")
        resources_deleted = db.query(ToolResource).filter(ToolResource.tre_tol_id == tool_id).delete()
        logger.debug(f"Deleted {resources_deleted} tool resources")
        
        # Now delete the tool
        logger.debug(f"Deleting tool {tool_id}")
        db.delete(db_tool)
        db.commit()
        
        logger.info(f"Successfully deleted tool {tool_id}")
        return None
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Error deleting tool {tool_id}: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error while deleting tool: {str(e)}"
        )


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


@router.post("/{tool_id}/test-mcp", status_code=status.HTTP_200_OK)
def test_mcp_configuration_and_update_count(tool_id: str, db: Session = Depends(get_db)):
    """
    Test MCP configuration and update function count for a tool
    """
    logger = logging.getLogger(__name__)
    
    # First check if the tool exists
    tool = db.query(Tool).filter(Tool.tol_id == tool_id).first()
    
    if tool is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tool with ID {tool_id} not found"
        )
    
    # Get environment variables for this tool
    env_vars = db.query(ToolEnvironmentVariable).filter(
        ToolEnvironmentVariable.tev_tol_id == tool_id
    ).all()
    
    # Convert to dictionary
    environment_variables = {getattr(var, 'tev_key'): getattr(var, 'tev_value') for var in env_vars}
    
    # Test MCP configuration
    try:
        success, function_count, error_message, functions = test_mcp_configuration_sync(
            getattr(tool, 'tol_mcp_command'), 
            environment_variables
        )
        
        if success:
            # Update the function count in the database
            setattr(tool, 'tol_mcp_function_count', function_count)
            db.add(tool)
            db.commit()
            db.refresh(tool)
            
            # Save or update tool resources
            if functions:
                # Clear existing resources for this tool
                db.query(ToolResource).filter(ToolResource.tre_tol_id == tool_id).delete()
                
                # Add new resources
                for func in functions:
                    resource = ToolResource(
                        tre_tol_id=tool_id,
                        tre_resource_name=func.get("name", ""),
                        tre_resource_description=func.get("description", "")
                    )
                    db.add(resource)
                
                db.commit()
                logger.info(f"Saved {len(functions)} resources for tool {tool_id}")
            
            logger.info(f"Successfully tested MCP configuration for tool {tool_id}. Function count: {function_count}")
            
            tool_response = ToolResponse.model_validate(tool, from_attributes=True)
            return {
                "success": True,
                "function_count": function_count,
                "message": f"MCP configuration tested successfully. Found {function_count} functions.",
                "tool": serialize_response(tool_response)
            }
        else:
            logger.warning(f"MCP configuration test failed for tool {tool_id}: {error_message}")
            return {
                "success": False,
                "function_count": 0,
                "message": error_message or "MCP configuration test failed",
                "tool": None
            }
            
    except Exception as e:
        logger.error(f"Unexpected error testing MCP configuration for tool {tool_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error while testing MCP configuration: {str(e)}"
        )


@router.get("/{tool_id}/function-count")
def get_tool_function_count(tool_id: str, db: Session = Depends(get_db)):
    """
    Get the count of functions for a tool
    """
    # Check if the tool exists
    tool = db.query(Tool).filter(Tool.tol_id == tool_id).first()
    
    if tool is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tool with ID {tool_id} not found"
        )
    
    # Here you would add logic to count the functions
    # For now, we just return a dummy count
    
    dummy_function_count = 5  # Replace with actual count logic
    
    return serialize_response({"function_count": dummy_function_count})


# Tool Resource Endpoints
@router.get("/{tool_id}/resources")
def get_tool_resources(tool_id: str, db: Session = Depends(get_db)):
    """
    Get all resources for a tool
    """
    # First check if the tool exists
    tool = db.query(Tool).filter(Tool.tol_id == tool_id).first()
    
    if tool is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tool with ID {tool_id} not found"
        )
    
    resources = db.query(ToolResource).filter(
        ToolResource.tre_tol_id == tool_id
    ).all()
    
    resource_responses = [ToolResourceResponse.model_validate(resource, from_attributes=True) for resource in resources]
    return serialize_response_list(resource_responses)


@router.post("/{tool_id}/resources", status_code=status.HTTP_201_CREATED)
def add_resource_to_tool(tool_id: str, resource: ToolResourceBase, db: Session = Depends(get_db)):
    """
    Add a resource to a tool
    """
    # First check if the tool exists
    tool = db.query(Tool).filter(Tool.tol_id == tool_id).first()
    
    if tool is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tool with ID {tool_id} not found"
        )
    
    # Check if the resource already exists
    db_resource = db.query(ToolResource).filter(
        ToolResource.tre_tol_id == tool_id,
        ToolResource.tre_resource_name == resource.resourceName
    ).first()
    
    if db_resource:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Resource '{resource.resourceName}' already exists for Tool {tool_id}"
        )
    
    # Create the resource
    db_resource = ToolResource(
        tre_tol_id=tool_id,
        tre_resource_name=resource.resourceName,
        tre_resource_description=resource.resourceDescription
    )
    
    db.add(db_resource)
    db.commit()
    db.refresh(db_resource)
    resource_response = ToolResourceResponse.model_validate(db_resource, from_attributes=True)
    return serialize_response(resource_response)


@router.post("/{tool_id}/resources/bulk", status_code=status.HTTP_201_CREATED)
def add_resources_bulk_to_tool(tool_id: str, resources: List[ToolResourceBase], db: Session = Depends(get_db)):
    """
    Add multiple resources to a tool
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
    
    for resource in resources:
        try:
            # Check if the resource already exists
            existing_resource = db.query(ToolResource).filter(
                ToolResource.tre_tol_id == tool_id,
                ToolResource.tre_resource_name == resource.resourceName
            ).first()
            
            if existing_resource:
                error_responses.append({
                    "resourceName": resource.resourceName,
                    "error": f"Resource '{resource.resourceName}' already exists for Tool {tool_id}"
                })
                continue
            
            # Create the resource
            db_resource = ToolResource(
                tre_tol_id=tool_id,
                tre_resource_name=resource.resourceName,
                tre_resource_description=resource.resourceDescription
            )
            
            db.add(db_resource)
            db.commit()
            db.refresh(db_resource)
            
            resource_response = ToolResourceResponse.model_validate(db_resource, from_attributes=True)
            success_responses.append(resource_response)
            
        except Exception as e:
            db.rollback()
            error_responses.append({
                "resourceName": resource.resourceName,
                "error": f"Failed to create resource: {str(e)}"
            })
    
    bulk_response = ToolResourceBulkResponse(
        success=success_responses,
        errors=error_responses
    )
    
    return serialize_response(bulk_response)


@router.put("/{tool_id}/resources/{resource_name}")
def update_resource(tool_id: str, resource_name: str, resource: ToolResourceBase, db: Session = Depends(get_db)):
    """
    Update a resource for a tool
    """
    # Check if the resource exists
    db_resource = db.query(ToolResource).filter(
        ToolResource.tre_tol_id == tool_id,
        ToolResource.tre_resource_name == resource_name
    ).first()
    
    if db_resource is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resource '{resource_name}' not found for Tool {tool_id}"
        )
    
    # Update the resource
    setattr(db_resource, "tre_resource_name", resource.resourceName)
    setattr(db_resource, "tre_resource_description", resource.resourceDescription)
    
    db.add(db_resource)
    db.commit()
    db.refresh(db_resource)
    resource_response = ToolResourceResponse.model_validate(db_resource, from_attributes=True)
    return serialize_response(resource_response)


@router.delete("/{tool_id}/resources/{resource_name}", status_code=status.HTTP_204_NO_CONTENT)
def delete_resource(tool_id: str, resource_name: str, db: Session = Depends(get_db)):
    """
    Delete a resource for a tool
    """
    # Check if the resource exists
    db_resource = db.query(ToolResource).filter(
        ToolResource.tre_tol_id == tool_id,
        ToolResource.tre_resource_name == resource_name
    ).first()
    
    if db_resource is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resource '{resource_name}' not found for Tool {tool_id}"
        )
    
    # Delete the resource
    db.delete(db_resource)
    db.commit()
    return None
