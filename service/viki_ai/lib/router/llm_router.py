"""
LLM router for VIKI API
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..model.llm import LLMConfig
from ..model.db_session import get_db
from .schemas import LLMConfigCreate, LLMConfigUpdate, LLMConfigResponse

router = APIRouter(
    prefix="/llm",
    tags=["llm"],
    responses={404: {"description": "Not found"}},
)


@router.get("/", response_model=List[LLMConfigResponse])
def get_llm_configs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Get all LLM configurations
    """
    llm_configs = db.query(LLMConfig).offset(skip).limit(limit).all()
    return llm_configs


@router.get("/{llm_id}", response_model=LLMConfigResponse)
def get_llm_config(llm_id: str, db: Session = Depends(get_db)):
    """
    Get an LLM configuration by ID
    """
    llm_config = db.query(LLMConfig).filter(LLMConfig.llc_id == llm_id).first()
    if llm_config is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"LLM configuration with ID {llm_id} not found")
    return llm_config


@router.post("/", response_model=LLMConfigResponse, status_code=status.HTTP_201_CREATED)
def create_llm_config(llm_config: LLMConfigCreate, db: Session = Depends(get_db)):
    """
    Create a new LLM configuration
    """
    # Check if LLM config with the same ID already exists
    db_llm_config = db.query(LLMConfig).filter(LLMConfig.llc_id == llm_config.llc_id).first()
    if db_llm_config:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"LLM configuration with ID {llm_config.llc_id} already exists")
    
    # Create new LLM config
    db_llm_config = LLMConfig(
        llc_id=llm_config.llc_id,
        llc_provider_type_cd=llm_config.llc_provider_type_cd,
        llc_model_cd=llm_config.llc_model_cd,
        llc_endpoint_url=llm_config.llc_endpoint_url,
        llc_api_key=llm_config.llc_api_key,
        llc_fls_id=llm_config.llc_fls_id,
    )
    db.add(db_llm_config)
    db.commit()
    db.refresh(db_llm_config)
    return db_llm_config


@router.put("/{llm_id}", response_model=LLMConfigResponse)
def update_llm_config(llm_id: str, llm_config: LLMConfigUpdate, db: Session = Depends(get_db)):
    """
    Update an existing LLM configuration
    """
    db_llm_config = db.query(LLMConfig).filter(LLMConfig.llc_id == llm_id).first()
    if db_llm_config is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"LLM configuration with ID {llm_id} not found")

    # Update LLM config attributes
    update_data = llm_config.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_llm_config, key, value)

    db.commit()
    db.refresh(db_llm_config)
    return db_llm_config


@router.delete("/{llm_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_llm_config(llm_id: str, db: Session = Depends(get_db)):
    """
    Delete an LLM configuration
    """
    db_llm_config = db.query(LLMConfig).filter(LLMConfig.llc_id == llm_id).first()
    if db_llm_config is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"LLM configuration with ID {llm_id} not found")
    
    db.delete(db_llm_config)
    db.commit()
    return None
