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
from .response_utils import serialize_response, serialize_response_list

router = APIRouter(
    prefix="/lookups",
    tags=["lookups"],
    responses={404: {"description": "Not found"}},
)


# Lookup Type endpoints
@router.get("/types")  
def get_lookup_types(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Get all lookup types
    
    Returns a list of all lookup type categories in the system.
    Lookup types are used to categorize reference data.
    
    - **skip**: Number of records to skip for pagination
    - **limit**: Maximum number of records to return
    """
    lookup_types = db.query(LookupType).offset(skip).limit(limit).all()
    pydantic_objects = [LookupTypeResponse.model_validate(lookup_type, from_attributes=True) for lookup_type in lookup_types]
    return serialize_response_list(pydantic_objects)


@router.get("/types/{type_code}")
def get_lookup_type(type_code: str, db: Session = Depends(get_db)):
    """
    Get a lookup type by code
    
    Retrieves a specific lookup type category by its unique code.
    
    - **type_code**: The unique identifier code for the lookup type
    """
    lookup_type = db.query(LookupType).filter(LookupType.lkt_type == type_code).first()
    if lookup_type is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lookup Type with code {type_code} not found"
        )
    pydantic_obj = LookupTypeResponse.model_validate(lookup_type, from_attributes=True)
    return serialize_response(pydantic_obj)


@router.post("/types", status_code=status.HTTP_201_CREATED)
def create_lookup_type(lookup_type: LookupTypeCreate, db: Session = Depends(get_db)):
    """
    Create a new lookup type
    
    Creates a new lookup type category for organizing reference data.
    
    - **typeCode**: The unique identifier code for the lookup type
    - **description**: A description explaining the purpose of this lookup type
    """
    db_lookup_type = db.query(LookupType).filter(LookupType.lkt_type == lookup_type.typeCode).first()
    
    if db_lookup_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Lookup Type with code {lookup_type.typeCode} already exists"
        )
    
    # Create new lookup type with mapped field names
    db_lookup_type = LookupType(
        lkt_type=lookup_type.typeCode,
        lkt_description=lookup_type.description
    )
    db.add(db_lookup_type)
    db.commit()
    db.refresh(db_lookup_type)
    pydantic_obj = LookupTypeResponse.model_validate(db_lookup_type, from_attributes=True)
    return serialize_response(pydantic_obj)


@router.put("/types/{type_code}")
def update_lookup_type(type_code: str, lookup_type: LookupTypeUpdate, db: Session = Depends(get_db)):
    """
    Update a lookup type
    
    Updates an existing lookup type category.
    
    - **type_code**: The unique identifier code of the lookup type to update
    - **description**: (Optional) New description for the lookup type
    """
    db_lookup_type = db.query(LookupType).filter(LookupType.lkt_type == type_code).first()
    
    if db_lookup_type is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lookup Type with code {type_code} not found"
        )
    
    # Map field names back to database column names
    if lookup_type.description is not None:
        setattr(db_lookup_type, "lkt_description", lookup_type.description)
    
    db.add(db_lookup_type)
    db.commit()
    db.refresh(db_lookup_type)
    pydantic_obj = LookupTypeResponse.model_validate(db_lookup_type, from_attributes=True)
    return serialize_response(pydantic_obj)


@router.delete("/types/{type_code}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lookup_type(type_code: str, db: Session = Depends(get_db)):
    """
    Delete a lookup type
    
    Permanently removes a lookup type category from the system.
    
    - **type_code**: The unique identifier code of the lookup type to delete
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
@router.get("/details")
def get_lookup_details(
    type_code: Optional[str] = None, 
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db)
):
    """
    Get lookup details, optionally filtered by type_code
    
    Returns a list of lookup detail values, which can be filtered by lookup type.
    These represent the individual values within a lookup type category.
    
    - **type_code**: (Optional) Filter results to only show details for this lookup type
    - **skip**: Number of records to skip for pagination
    - **limit**: Maximum number of records to return
    """
    query = db.query(LookupDetail)
    
    if type_code:
        query = query.filter(LookupDetail.lkd_lkt_type == type_code)
    
    lookup_details = query.offset(skip).limit(limit).all()
    lookup_detail_responses = [LookupDetailResponse.model_validate(lookup_detail, from_attributes=True) for lookup_detail in lookup_details]
    return serialize_response_list(lookup_detail_responses)


@router.get("/details/{type_code}")
def get_lookup_details_by_type(type_code: str, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Get all lookup details for a specific lookup type
    
    Returns a list of all lookup detail values for the specified lookup type.
    This endpoint allows you to retrieve all reference data values within a specific category.
    
    - **type_code**: The unique identifier code of the lookup type to retrieve details for
    - **skip**: Number of records to skip for pagination
    - **limit**: Maximum number of records to return
    """
    # First verify that the lookup type exists
    lookup_type = db.query(LookupType).filter(LookupType.lkt_type == type_code).first()
    if lookup_type is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lookup Type with code {type_code} not found"
        )
    
    # Get all lookup details for this type
    lookup_details = db.query(LookupDetail).filter(
        LookupDetail.lkd_lkt_type == type_code
    ).offset(skip).limit(limit).all()
    
    lookup_detail_responses = [LookupDetailResponse.model_validate(lookup_detail, from_attributes=True) for lookup_detail in lookup_details]
    return serialize_response_list(lookup_detail_responses)


@router.get("/details/{type_code}/{detail_code}")
def get_lookup_detail(type_code: str, detail_code: str, db: Session = Depends(get_db)):
    """
    Get a specific lookup detail
    
    Retrieves a specific lookup detail value by its type and code combination.
    
    - **type_code**: The lookup type this detail belongs to
    - **detail_code**: The unique code of the lookup detail within its type
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
    
    pydantic_obj = LookupDetailResponse.model_validate(lookup_detail, from_attributes=True)
    return serialize_response(pydantic_obj)


@router.post("/details", status_code=status.HTTP_201_CREATED)
def create_lookup_detail(lookup_detail: LookupDetailCreate, db: Session = Depends(get_db)):
    """
    Create a new lookup detail
    
    Creates a new lookup detail value within a lookup type category.
    
    - **typeCode**: The lookup type this detail belongs to
    - **code**: The unique code identifying this detail within its type
    - **description**: A description of what this lookup value represents
    - **subCode**: (Optional) Additional sub-classification code
    - **sortOrder**: (Optional) Priority/order for displaying this value
    """
    # Check if lookup type exists
    lookup_type = db.query(LookupType).filter(
        LookupType.lkt_type == lookup_detail.typeCode
    ).first()
    
    if lookup_type is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lookup Type with code {lookup_detail.typeCode} not found"
        )
    
    # Check if lookup detail already exists
    db_lookup_detail = db.query(LookupDetail).filter(
        LookupDetail.lkd_lkt_type == lookup_detail.typeCode,
        LookupDetail.lkd_code == lookup_detail.code
    ).first()
    
    if db_lookup_detail:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Lookup Detail with type {lookup_detail.typeCode} and code {lookup_detail.code} already exists"
        )
    
    # Create new lookup detail with mapped field names
    db_lookup_detail = LookupDetail(
        lkd_lkt_type=lookup_detail.typeCode,
        lkd_code=lookup_detail.code,
        lkd_description=lookup_detail.description,
        lkd_sub_code=lookup_detail.subCode,
        lkd_sort=lookup_detail.sortOrder
    )
    db.add(db_lookup_detail)
    db.commit()
    db.refresh(db_lookup_detail)
    pydantic_obj = LookupDetailResponse.model_validate(db_lookup_detail, from_attributes=True)
    return serialize_response(pydantic_obj)


@router.put("/details/{type_code}/{detail_code}")
def update_lookup_detail(
    type_code: str, 
    detail_code: str, 
    lookup_detail: LookupDetailUpdate, 
    db: Session = Depends(get_db)
):
    """
    Update a lookup detail
    
    Updates an existing lookup detail value.
    
    - **type_code**: The lookup type this detail belongs to
    - **detail_code**: The unique code of the lookup detail to update
    - **description**: (Optional) New description for this lookup value
    - **subCode**: (Optional) New sub-classification code
    - **sortOrder**: (Optional) New display order priority
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
    
    # Map field names back to database column names
    if lookup_detail.description is not None:
        setattr(db_lookup_detail, "lkd_description", lookup_detail.description)
    if lookup_detail.subCode is not None:
        setattr(db_lookup_detail, "lkd_sub_code", lookup_detail.subCode)
    if lookup_detail.sortOrder is not None:
        setattr(db_lookup_detail, "lkd_sort", lookup_detail.sortOrder)
    
    db.add(db_lookup_detail)
    db.commit()
    db.refresh(db_lookup_detail)
    pydantic_obj = LookupDetailResponse.model_validate(db_lookup_detail, from_attributes=True)
    return serialize_response(pydantic_obj)


@router.delete("/details/{type_code}/{detail_code}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lookup_detail(type_code: str, detail_code: str, db: Session = Depends(get_db)):
    """
    Delete a lookup detail
    
    Permanently removes a lookup detail value from the system.
    
    - **type_code**: The lookup type this detail belongs to
    - **detail_code**: The unique code of the lookup detail to delete
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
