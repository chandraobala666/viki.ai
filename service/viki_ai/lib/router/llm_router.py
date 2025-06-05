"""
LLM router for VIKI API
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import uuid

from ..model.llm import LLMConfig
from ..model.db_session import get_db
from .schemas import LLMConfigCreate, LLMConfigUpdate, LLMConfigResponse
from .response_utils import serialize_response, serialize_response_list

router = APIRouter(
    prefix="/llm",
    tags=["llm"],
    responses={404: {"description": "Not found"}},
)


@router.get("/")
def get_llm_configs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Get all LLM configurations
    
    Returns a list of all LLM configurations in the system.
    
    - **skip**: Number of records to skip for pagination
    - **limit**: Maximum number of records to return
    """
    llm_configs = db.query(LLMConfig).offset(skip).limit(limit).all()
    llm_config_responses = [LLMConfigResponse.model_validate(llm_config, from_attributes=True) for llm_config in llm_configs]
    return serialize_response_list(llm_config_responses)


@router.get("/{llm_id}")
def get_llm_config(llm_id: str, db: Session = Depends(get_db)):
    """
    Get an LLM configuration by ID
    
    Retrieves detailed information about a specific LLM configuration.
    
    - **llm_id**: The unique identifier of the LLM configuration
    """
    llm_config = db.query(LLMConfig).filter(LLMConfig.llc_id == llm_id).first()
    if llm_config is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"LLM configuration with ID {llm_id} not found")
    llm_config_response = LLMConfigResponse.model_validate(llm_config, from_attributes=True)
    return serialize_response(llm_config_response)


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_llm_config(llm_config: LLMConfigCreate, db: Session = Depends(get_db)):
    """
    Create a new LLM configuration
    
    Creates a new configuration for connecting to an LLM provider. A unique ID will be automatically generated.
    
    - **providerTypeCode**: LLM provider type code (e.g., 'OPENAI', 'ANTHROPIC', 'OLLAMA')
    - **modelCode**: Model identifier for the selected provider
    - **endpointUrl**: (Optional) Custom API endpoint URL
    - **apiKey**: (Optional) API key for authenticating with the provider
    - **fileStore**: (Optional) Associated file store ID
    """
    # Generate a unique ID for the LLM configuration
    llm_id = str(uuid.uuid4())
    
    # Create new LLM config
    db_llm_config = LLMConfig(
        llc_id=llm_id,
        llc_provider_type_cd=llm_config.providerTypeCode,
        llc_model_cd=llm_config.modelCode,
        llc_endpoint_url=llm_config.endpointUrl,
        llc_api_key=llm_config.apiKey,
        llc_fls_id=llm_config.fileStore,
    )
    db.add(db_llm_config)
    db.commit()
    db.refresh(db_llm_config)
    llm_config_response = LLMConfigResponse.model_validate(db_llm_config, from_attributes=True)
    return serialize_response(llm_config_response)


@router.put("/{llm_id}")
def update_llm_config(llm_id: str, llm_config: LLMConfigUpdate, db: Session = Depends(get_db)):
    """
    Update an existing LLM configuration
    
    Updates the properties of an existing LLM configuration.
    
    - **llm_id**: The unique identifier of the LLM configuration to update
    - **providerTypeCode**: (Optional) New provider type code
    - **modelCode**: (Optional) New model identifier
    - **endpointUrl**: (Optional) New endpoint URL
    - **apiKey**: (Optional) New API key
    - **fileStore**: (Optional) New file store ID
    """
    db_llm_config = db.query(LLMConfig).filter(LLMConfig.llc_id == llm_id).first()
    if db_llm_config is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"LLM configuration with ID {llm_id} not found")

    # Update LLM config attributes
    update_data = llm_config.dict(exclude_unset=True, by_alias=True)
    
    # Map field names back to database column names
    field_to_db_map = {
        "providerTypeCode": "llc_provider_type_cd",
        "modelCode": "llc_model_cd",
        "endpointUrl": "llc_endpoint_url",
        "apiKey": "llc_api_key",
        "fileStore": "llc_fls_id"
    }
    
    for field, value in update_data.items():
        db_field = field_to_db_map.get(field, field)
        setattr(db_llm_config, db_field, value)

    db.commit()
    db.refresh(db_llm_config)
    llm_config_response = LLMConfigResponse.model_validate(db_llm_config, from_attributes=True)
    return serialize_response(llm_config_response)


@router.delete("/{llm_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_llm_config(llm_id: str, db: Session = Depends(get_db)):
    """
    Delete an LLM configuration
    
    Permanently removes an LLM configuration from the system.
    
    - **llm_id**: The unique identifier of the LLM configuration to delete
    """
    db_llm_config = db.query(LLMConfig).filter(LLMConfig.llc_id == llm_id).first()
    if db_llm_config is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"LLM configuration with ID {llm_id} not found")
    
    db.delete(db_llm_config)
    db.commit()
    return None
