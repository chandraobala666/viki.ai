"""
File Store router for VIKI API
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional, cast
import uuid
import io

from ..model.file_store import FileStore
from ..model.db_session import get_db
from .schemas import (
    FileStoreCreate, 
    FileStoreUpdate, 
    FileStoreResponse,
    FileStoreContentResponse
)
from .response_utils import serialize_response, serialize_response_list

router = APIRouter(
    prefix="/file-store",
    tags=["file-store"],
    responses={404: {"description": "Not found"}},
)


@router.get("/")
def get_files(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Get all files in the store
    """
    files = db.query(FileStore).offset(skip).limit(limit).all()
    file_responses = [FileStoreResponse.model_validate(file, from_attributes=True) for file in files]
    return serialize_response_list(file_responses)


@router.get("/{file_id}")
def get_file(file_id: str, include_content: bool = False, db: Session = Depends(get_db)):
    """
    Get a file by ID. Set include_content=true to include the binary content.
    """
    file_record = db.query(FileStore).filter(FileStore.fls_id == file_id).first()
    if file_record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"File with ID {file_id} not found"
        )
    
    if include_content:
        file_response = FileStoreContentResponse.model_validate(file_record, from_attributes=True)
    else:
        file_response = FileStoreResponse.model_validate(file_record, from_attributes=True)
    
    return serialize_response(file_response)


@router.get("/{file_id}/download")
def download_file(file_id: str, db: Session = Depends(get_db)):
    """
    Download a file by ID, returning the binary content as a stream
    """
    file_record = db.query(FileStore).filter(FileStore.fls_id == file_id).first()
    if file_record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"File with ID {file_id} not found"
        )
    
    # Get the binary content with proper type casting
    file_content = cast(bytes, file_record.fls_file_content) or b''
    
    # Return as streaming response
    return StreamingResponse(
        io.BytesIO(file_content),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename={file_record.fls_file_name}"}
    )


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_file(file_store: FileStoreCreate, db: Session = Depends(get_db)):
    """
    Create a new file record
    """
    # Generate unique file ID
    file_id = str(uuid.uuid4())
    
    # Create new file record with mapped field names
    db_file = FileStore(
        fls_id=file_id,
        fls_source_type_cd=file_store.sourceTypeCode,
        fls_source_id=file_store.sourceId,
        fls_file_name=file_store.fileName,
        fls_file_content=file_store.fileContent
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)
    file_response = FileStoreResponse.model_validate(db_file, from_attributes=True)
    return serialize_response(file_response)


@router.post("/upload", status_code=status.HTTP_201_CREATED)
def upload_file(
    file: UploadFile = File(...),
    source_type_code: str = Form(...),
    source_id: str = Form(...),
    db: Session = Depends(get_db)
):
    """
    Upload a file using multipart form data
    """
    # Generate unique file ID
    file_id = str(uuid.uuid4())
    
    # Read file content
    file_content = file.file.read()
    
    # Create new file record
    db_file = FileStore(
        fls_id=file_id,
        fls_source_type_cd=source_type_code,
        fls_source_id=source_id,
        fls_file_name=file.filename or "unnamed_file",
        fls_file_content=file_content
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)
    file_response = FileStoreResponse.model_validate(db_file, from_attributes=True)
    return serialize_response(file_response)


@router.put("/{file_id}")
def update_file(file_id: str, file_store: FileStoreUpdate, db: Session = Depends(get_db)):
    """
    Update a file record
    """
    db_file = db.query(FileStore).filter(FileStore.fls_id == file_id).first()
    
    if db_file is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File with ID {file_id} not found"
        )
    
    update_data = file_store.dict(exclude_unset=True)
    
    # Map field names back to database column names
    field_to_db_map = {
        "sourceTypeCode": "fls_source_type_cd",
        "sourceId": "fls_source_id",
        "fileName": "fls_file_name",
        "fileContent": "fls_file_content"
    }
    
    for field, value in update_data.items():
        db_field = field_to_db_map.get(field, field)
        setattr(db_file, db_field, value)
    
    db.add(db_file)
    db.commit()
    db.refresh(db_file)
    file_response = FileStoreResponse.model_validate(db_file, from_attributes=True)
    return serialize_response(file_response)


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_file(file_id: str, db: Session = Depends(get_db)):
    """
    Delete a file from the store
    """
    db_file = db.query(FileStore).filter(FileStore.fls_id == file_id).first()
    
    if db_file is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File with ID {file_id} not found"
        )
    
    db.delete(db_file)
    db.commit()
    return None


# Additional utility endpoints
@router.get("/search/by-source")
def get_files_by_source(
    source_type_code: Optional[str] = None,
    source_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Search files by source type and/or source ID
    """
    query = db.query(FileStore)
    
    if source_type_code:
        query = query.filter(FileStore.fls_source_type_cd == source_type_code)
    
    if source_id:
        query = query.filter(FileStore.fls_source_id == source_id)
    
    files = query.offset(skip).limit(limit).all()
    file_responses = [FileStoreResponse.model_validate(file, from_attributes=True) for file in files]
    return serialize_response_list(file_responses)


@router.get("/search/by-filename")
def search_files_by_name(
    filename_pattern: str,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Search files by filename pattern (case-insensitive partial match)
    """
    files = db.query(FileStore).filter(
        FileStore.fls_file_name.ilike(f"%{filename_pattern}%")
    ).offset(skip).limit(limit).all()
    
    file_responses = [FileStoreResponse.model_validate(file, from_attributes=True) for file in files]
    return serialize_response_list(file_responses)
