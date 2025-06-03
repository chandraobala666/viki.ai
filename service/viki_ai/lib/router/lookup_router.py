"""
Lookup router for VIKI API
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from ..model.lookup import LookupType, LookupDetail
from ..model.db_session import get_db
from .schemas import (
    LookupTypeCreate,
    LookupTypeUpdate,
    LookupTypeResponse,
    LookupDetailCreate, 
    LookupDetailUpdate,
    LookupDetailResponse
)

router = APIRouter(
    prefix="/lookups",
    tags=["lookups"],
    responses={404: {"description": "Not found"}},
)


# Lookup Type endpoints
@router.get("/types", response_model=List[LookupTypeResponse])
def get_lookup_types(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Get all lookup types
    """
    lookup_types = db.query(LookupType).offset(skip).limit(limit).all()
    return lookup_types


@router.get("/types/{type_code}", response_model=LookupTypeResponse)
def get_lookup_type(type_code: str, db: Session = Depends(get_db)):
    """
    Get a lookup type by code
    """
    lookup_type = db.query(LookupType).filter(LookupType.lkt_type == type_code).first()
    if lookup_type is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lookup Type with code {type_code} not found"
        )
    return lookup_type


@router.post("/types", response_model=LookupTypeResponse, status_code=status.HTTP_201_CREATED)
def create_lookup_type(lookup_type: LookupTypeCreate, db: Session = Depends(get_db)):
    """
    Create a new lookup type
    """
    db_lookup_type = db.query(LookupType).filter(LookupType.lkt_type == lookup_type.lkt_type).first()
    
    if db_lookup_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Lookup Type with code {lookup_type.lkt_type} already exists"
        )
    
    db_lookup_type = LookupType(**lookup_type.dict())
    db.add(db_lookup_type)
    db.commit()
    db.refresh(db_lookup_type)
    return db_lookup_type


@router.put("/types/{type_code}", response_model=LookupTypeResponse)
def update_lookup_type(type_code: str, lookup_type: LookupTypeUpdate, db: Session = Depends(get_db)):
    """
    Update a lookup type
    """
    db_lookup_type = db.query(LookupType).filter(LookupType.lkt_type == type_code).first()
    
    if db_lookup_type is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lookup Type with code {type_code} not found"
        )
    
    update_data = lookup_type.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_lookup_type, key, value)
    
    db.add(db_lookup_type)
    db.commit()
    db.refresh(db_lookup_type)
    return db_lookup_type


@router.delete("/types/{type_code}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lookup_type(type_code: str, db: Session = Depends(get_db)):
    """
    Delete a lookup type
    """
    db_lookup_type = db.query(LookupType).filter(LookupType.lkt_type == type_code).first()
    
    if db_lookup_type is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lookup Type with code {type_code} not found"
        )
    
    db.delete(db_lookup_type)
    db.commit()
    return None


# Lookup Detail endpoints
@router.get("/details", response_model=List[LookupDetailResponse])
def get_lookup_details(
    type_code: Optional[str] = None, 
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db)
):
    """
    Get lookup details, optionally filtered by type_code
    """
    query = db.query(LookupDetail)
    
    if type_code:
        query = query.filter(LookupDetail.lkd_lkt_type == type_code)
    
    lookup_details = query.offset(skip).limit(limit).all()
    return lookup_details


@router.get("/details/{type_code}/{detail_code}", response_model=LookupDetailResponse)
def get_lookup_detail(type_code: str, detail_code: str, db: Session = Depends(get_db)):
    """
    Get a lookup detail by type code and detail code
    """
    lookup_detail = db.query(LookupDetail).filter(
        LookupDetail.lkd_lkt_type == type_code,
        LookupDetail.lkd_code == detail_code
    ).first()
    
    if lookup_detail is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lookup Detail with type {type_code} and code {detail_code} not found"
        )
    
    return lookup_detail


@router.post("/details", response_model=LookupDetailResponse, status_code=status.HTTP_201_CREATED)
def create_lookup_detail(lookup_detail: LookupDetailCreate, db: Session = Depends(get_db)):
    """
    Create a new lookup detail
    """
    # Check if lookup type exists
    lookup_type = db.query(LookupType).filter(
        LookupType.lkt_type == lookup_detail.lkd_lkt_type
    ).first()
    
    if lookup_type is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lookup Type with code {lookup_detail.lkd_lkt_type} not found"
        )
    
    # Check if lookup detail already exists
    db_lookup_detail = db.query(LookupDetail).filter(
        LookupDetail.lkd_lkt_type == lookup_detail.lkd_lkt_type,
        LookupDetail.lkd_code == lookup_detail.lkd_code
    ).first()
    
    if db_lookup_detail:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Lookup Detail with type {lookup_detail.lkd_lkt_type} and code {lookup_detail.lkd_code} already exists"
        )
    
    db_lookup_detail = LookupDetail(**lookup_detail.dict())
    db.add(db_lookup_detail)
    db.commit()
    db.refresh(db_lookup_detail)
    return db_lookup_detail


@router.put("/details/{type_code}/{detail_code}", response_model=LookupDetailResponse)
def update_lookup_detail(
    type_code: str, 
    detail_code: str, 
    lookup_detail: LookupDetailUpdate, 
    db: Session = Depends(get_db)
):
    """
    Update a lookup detail
    """
    db_lookup_detail = db.query(LookupDetail).filter(
        LookupDetail.lkd_lkt_type == type_code,
        LookupDetail.lkd_code == detail_code
    ).first()
    
    if db_lookup_detail is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lookup Detail with type {type_code} and code {detail_code} not found"
        )
    
    update_data = lookup_detail.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_lookup_detail, key, value)
    
    db.add(db_lookup_detail)
    db.commit()
    db.refresh(db_lookup_detail)
    return db_lookup_detail


@router.delete("/details/{type_code}/{detail_code}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lookup_detail(type_code: str, detail_code: str, db: Session = Depends(get_db)):
    """
    Delete a lookup detail
    """
    db_lookup_detail = db.query(LookupDetail).filter(
        LookupDetail.lkd_lkt_type == type_code,
        LookupDetail.lkd_code == detail_code
    ).first()
    
    if db_lookup_detail is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lookup Detail with type {type_code} and code {detail_code} not found"
        )
    
    db.delete(db_lookup_detail)
    db.commit()
    return None
