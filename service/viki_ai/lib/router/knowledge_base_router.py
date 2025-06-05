"""
Knowledge Base router for VIKI API
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional, cast
import uuid
import io

from ..model.knowledge_base import KnowledgeBaseDetail, KnowledgeBaseDocument
from ..model.file_store import FileStore
from ..model.db_session import get_db
from .schemas import (
    KnowledgeBaseCreate, 
    KnowledgeBaseUpdate, 
    KnowledgeBaseResponse,
    KnowledgeBaseDocumentCreate,
    KnowledgeBaseDocumentResponse,
    FileStoreResponse
)
from .response_utils import serialize_response, serialize_response_list

router = APIRouter(
    prefix="/knowledge-bases",
    tags=["knowledge-bases"],
    responses={404: {"description": "Not found"}},
)


@router.get("/")
def get_knowledge_bases(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Get all knowledge bases
    """
    knowledge_bases = db.query(KnowledgeBaseDetail).offset(skip).limit(limit).all()
    kb_responses = [KnowledgeBaseResponse.model_validate(kb, from_attributes=True) for kb in knowledge_bases]
    return serialize_response_list(kb_responses)


@router.get("/{kb_id}")
def get_knowledge_base(kb_id: str, db: Session = Depends(get_db)):
    """
    Get a knowledge base by ID
    """
    knowledge_base = db.query(KnowledgeBaseDetail).filter(KnowledgeBaseDetail.knb_id == kb_id).first()
    if knowledge_base is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Knowledge Base with ID {kb_id} not found"
        )
    kb_response = KnowledgeBaseResponse.model_validate(knowledge_base, from_attributes=True)
    return serialize_response(kb_response)


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_knowledge_base(knowledge_base: KnowledgeBaseCreate, db: Session = Depends(get_db)):
    """
    Create a new knowledge base
    """
    # Generate unique knowledge base ID
    kb_id = str(uuid.uuid4())
    
    # Create new knowledge base with mapped field names
    db_knowledge_base = KnowledgeBaseDetail(
        knb_id=kb_id,
        knb_name=knowledge_base.name,
        knb_description=knowledge_base.description
    )
    db.add(db_knowledge_base)
    db.commit()
    db.refresh(db_knowledge_base)
    kb_response = KnowledgeBaseResponse.model_validate(db_knowledge_base, from_attributes=True)
    return serialize_response(kb_response)


@router.put("/{kb_id}")
def update_knowledge_base(kb_id: str, knowledge_base: KnowledgeBaseUpdate, db: Session = Depends(get_db)):
    """
    Update a knowledge base
    """
    db_knowledge_base = db.query(KnowledgeBaseDetail).filter(
        KnowledgeBaseDetail.knb_id == kb_id
    ).first()
    
    if db_knowledge_base is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Knowledge Base with ID {kb_id} not found"
        )
    
    update_data = knowledge_base.dict(exclude_unset=True)
    
    # Map field names back to database column names
    field_to_db_map = {
        "name": "knb_name",
        "description": "knb_description"
    }
    
    for field, value in update_data.items():
        db_field = field_to_db_map.get(field, field)
        setattr(db_knowledge_base, db_field, value)
    
    db.add(db_knowledge_base)
    db.commit()
    db.refresh(db_knowledge_base)
    kb_response = KnowledgeBaseResponse.model_validate(db_knowledge_base, from_attributes=True)
    return serialize_response(kb_response)


@router.delete("/{kb_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_knowledge_base(kb_id: str, db: Session = Depends(get_db)):
    """
    Delete a knowledge base
    """
    db_knowledge_base = db.query(KnowledgeBaseDetail).filter(
        KnowledgeBaseDetail.knb_id == kb_id
    ).first()
    
    if db_knowledge_base is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Knowledge Base with ID {kb_id} not found"
        )
    
    db.delete(db_knowledge_base)
    db.commit()
    return None


# Knowledge Base Document Endpoints
@router.get("/{kb_id}/documents")
def get_knowledge_base_documents(kb_id: str, db: Session = Depends(get_db)):
    """
    Get all documents for a knowledge base
    """
    # First check if the knowledge base exists
    knowledge_base = db.query(KnowledgeBaseDetail).filter(
        KnowledgeBaseDetail.knb_id == kb_id
    ).first()
    
    if knowledge_base is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Knowledge Base with ID {kb_id} not found"
        )
    
    documents = db.query(KnowledgeBaseDocument).filter(
        KnowledgeBaseDocument.kbd_knb_id == kb_id
    ).all()
    
    doc_responses = [KnowledgeBaseDocumentResponse.model_validate(doc, from_attributes=True) for doc in documents]
    return serialize_response_list(doc_responses)


@router.post("/{kb_id}/documents", status_code=status.HTTP_201_CREATED)
def add_document_to_knowledge_base(kb_id: str, document: KnowledgeBaseDocumentCreate, db: Session = Depends(get_db)):
    """
    Add a document to a knowledge base
    """
    # First check if the knowledge base exists
    knowledge_base = db.query(KnowledgeBaseDetail).filter(
        KnowledgeBaseDetail.knb_id == kb_id
    ).first()
    
    if knowledge_base is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Knowledge Base with ID {kb_id} not found"
        )
    
    # Check if the document is already in the knowledge base
    db_document = db.query(KnowledgeBaseDocument).filter(
        KnowledgeBaseDocument.kbd_knb_id == kb_id,
        KnowledgeBaseDocument.kbd_fls_id == document.fileStore
    ).first()
    
    if db_document:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Document with ID {document.fileStore} already exists in Knowledge Base {kb_id}"
        )
    
    # Create new document with mapped field names
    db_document = KnowledgeBaseDocument(
        kbd_knb_id=kb_id,
        kbd_fls_id=document.fileStore
    )
    db.add(db_document)
    db.commit()
    db.refresh(db_document)
    doc_response = KnowledgeBaseDocumentResponse.model_validate(db_document, from_attributes=True)
    return serialize_response(doc_response)


@router.delete("/{kb_id}/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_document_from_knowledge_base(kb_id: str, document_id: str, db: Session = Depends(get_db)):
    """
    Remove a document from a knowledge base
    """
    # First check if the knowledge base exists
    knowledge_base = db.query(KnowledgeBaseDetail).filter(
        KnowledgeBaseDetail.knb_id == kb_id
    ).first()
    
    if knowledge_base is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Knowledge Base with ID {kb_id} not found"
        )
    
    # Check if the document exists in this knowledge base
    db_document = db.query(KnowledgeBaseDocument).filter(
        KnowledgeBaseDocument.kbd_knb_id == kb_id,
        KnowledgeBaseDocument.kbd_fls_id == document_id
    ).first()
    
    if db_document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with ID {document_id} not found in Knowledge Base {kb_id}"
        )
    
    db.delete(db_document)
    db.commit()
    return None


# Knowledge Base File Management Endpoints
@router.get("/{kb_id}/files")
def get_knowledge_base_files(kb_id: str, db: Session = Depends(get_db)):
    """
    Get all files directly associated with a knowledge base
    
    Returns files that are stored with the knowledge base as source.
    Note: This is different from /documents which shows files linked via KnowledgeBaseDocument.
    
    - **kb_id**: The unique identifier of the knowledge base
    """
    # First check if the knowledge base exists
    knowledge_base = db.query(KnowledgeBaseDetail).filter(
        KnowledgeBaseDetail.knb_id == kb_id
    ).first()
    
    if knowledge_base is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Knowledge Base with ID {kb_id} not found"
        )
    
    # Get files associated with this knowledge base
    files = db.query(FileStore).filter(
        FileStore.fls_source_type_cd == "KB",
        FileStore.fls_source_id == kb_id
    ).all()
    
    file_responses = [FileStoreResponse.model_validate(file, from_attributes=True) for file in files]
    return serialize_response_list(file_responses)


@router.post("/{kb_id}/files", status_code=status.HTTP_201_CREATED)
def upload_file_to_knowledge_base(
    kb_id: str,
    file: UploadFile = File(...),
    auto_add_to_documents: bool = Form(default=True),
    db: Session = Depends(get_db)
):
    """
    Upload a file and associate it with a knowledge base
    
    - **kb_id**: The unique identifier of the knowledge base
    - **file**: The file to upload and associate with the knowledge base
    - **auto_add_to_documents**: Whether to automatically add this file to the knowledge base documents
    """
    # First check if the knowledge base exists
    knowledge_base = db.query(KnowledgeBaseDetail).filter(
        KnowledgeBaseDetail.knb_id == kb_id
    ).first()
    
    if knowledge_base is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Knowledge Base with ID {kb_id} not found"
        )
    
    # Generate unique file ID
    file_id = str(uuid.uuid4())
    
    # Read file content
    file_content = file.file.read()
    
    # Create new file record
    db_file = FileStore(
        fls_id=file_id,
        fls_source_type_cd="KB",
        fls_source_id=kb_id,
        fls_file_name=file.filename or "unnamed_file",
        fls_file_content=file_content
    )
    db.add(db_file)
    
    # Optionally add to knowledge base documents
    if auto_add_to_documents:
        db_document = KnowledgeBaseDocument(
            kbd_knb_id=kb_id,
            kbd_fls_id=file_id
        )
        db.add(db_document)
    
    db.commit()
    db.refresh(db_file)
    file_response = FileStoreResponse.model_validate(db_file, from_attributes=True)
    return serialize_response(file_response)


@router.put("/{kb_id}/files/{file_id}")
def update_knowledge_base_file(
    kb_id: str,
    file_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Update a file associated with a knowledge base
    
    - **kb_id**: The unique identifier of the knowledge base
    - **file_id**: The unique identifier of the file to update
    - **file**: The new file content
    """
    # Check if the knowledge base exists
    knowledge_base = db.query(KnowledgeBaseDetail).filter(
        KnowledgeBaseDetail.knb_id == kb_id
    ).first()
    
    if knowledge_base is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Knowledge Base with ID {kb_id} not found"
        )
    
    # Check if the file exists and is associated with this knowledge base
    db_file = db.query(FileStore).filter(
        FileStore.fls_id == file_id,
        FileStore.fls_source_type_cd == "KB",
        FileStore.fls_source_id == kb_id
    ).first()
    
    if db_file is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File with ID {file_id} not found for Knowledge Base {kb_id}"
        )
    
    # Update file content and name
    file_content = file.file.read()
    setattr(db_file, 'fls_file_content', file_content)
    setattr(db_file, 'fls_file_name', file.filename or getattr(db_file, 'fls_file_name'))
    
    db.add(db_file)
    db.commit()
    db.refresh(db_file)
    file_response = FileStoreResponse.model_validate(db_file, from_attributes=True)
    return serialize_response(file_response)


@router.get("/{kb_id}/files/{file_id}")
def get_knowledge_base_file(kb_id: str, file_id: str, db: Session = Depends(get_db)):
    """
    Get a specific file associated with a knowledge base
    
    - **kb_id**: The unique identifier of the knowledge base
    - **file_id**: The unique identifier of the file
    """
    # Check if the knowledge base exists
    knowledge_base = db.query(KnowledgeBaseDetail).filter(
        KnowledgeBaseDetail.knb_id == kb_id
    ).first()
    
    if knowledge_base is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Knowledge Base with ID {kb_id} not found"
        )
    
    # Get the specific file
    db_file = db.query(FileStore).filter(
        FileStore.fls_id == file_id,
        FileStore.fls_source_type_cd == "KB",
        FileStore.fls_source_id == kb_id
    ).first()
    
    if db_file is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File with ID {file_id} not found for Knowledge Base {kb_id}"
        )
    
    file_response = FileStoreResponse.model_validate(db_file, from_attributes=True)
    return serialize_response(file_response)


@router.get("/{kb_id}/files/{file_id}/download")
def download_knowledge_base_file(kb_id: str, file_id: str, db: Session = Depends(get_db)):
    """
    Download a file associated with a knowledge base
    
    - **kb_id**: The unique identifier of the knowledge base
    - **file_id**: The unique identifier of the file to download
    """
    # Check if the knowledge base exists
    knowledge_base = db.query(KnowledgeBaseDetail).filter(
        KnowledgeBaseDetail.knb_id == kb_id
    ).first()
    
    if knowledge_base is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Knowledge Base with ID {kb_id} not found"
        )
    
    # Get the specific file
    db_file = db.query(FileStore).filter(
        FileStore.fls_id == file_id,
        FileStore.fls_source_type_cd == "KB",
        FileStore.fls_source_id == kb_id
    ).first()
    
    if db_file is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File with ID {file_id} not found for Knowledge Base {kb_id}"
        )
    
    # Return file as streaming response
    file_content = cast(bytes, getattr(db_file, 'fls_file_content')) or b''
    return StreamingResponse(
        io.BytesIO(file_content),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename={getattr(db_file, 'fls_file_name')}"}
    )


@router.delete("/{kb_id}/files/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_knowledge_base_file(kb_id: str, file_id: str, db: Session = Depends(get_db)):
    """
    Delete a file associated with a knowledge base
    
    This will also remove any document associations for this file.
    
    - **kb_id**: The unique identifier of the knowledge base
    - **file_id**: The unique identifier of the file to delete
    """
    # Check if the knowledge base exists
    knowledge_base = db.query(KnowledgeBaseDetail).filter(
        KnowledgeBaseDetail.knb_id == kb_id
    ).first()
    
    if knowledge_base is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Knowledge Base with ID {kb_id} not found"
        )
    
    # Get the specific file
    db_file = db.query(FileStore).filter(
        FileStore.fls_id == file_id,
        FileStore.fls_source_type_cd == "KB",
        FileStore.fls_source_id == kb_id
    ).first()
    
    if db_file is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File with ID {file_id} not found for Knowledge Base {kb_id}"
        )
    
    # Remove any document associations first
    db.query(KnowledgeBaseDocument).filter(
        KnowledgeBaseDocument.kbd_fls_id == file_id
    ).delete()
    
    # Delete the file
    db.delete(db_file)
    db.commit()
    return None


@router.post("/{kb_id}/files/{file_id}/add-to-documents", status_code=status.HTTP_201_CREATED)
def add_file_to_knowledge_base_documents(kb_id: str, file_id: str, db: Session = Depends(get_db)):
    """
    Add an existing file to the knowledge base documents
    
    This creates a document association for a file that already exists in the knowledge base.
    
    - **kb_id**: The unique identifier of the knowledge base
    - **file_id**: The unique identifier of the file to add to documents
    """
    # Check if the knowledge base exists
    knowledge_base = db.query(KnowledgeBaseDetail).filter(
        KnowledgeBaseDetail.knb_id == kb_id
    ).first()
    
    if knowledge_base is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Knowledge Base with ID {kb_id} not found"
        )
    
    # Check if the file exists
    db_file = db.query(FileStore).filter(
        FileStore.fls_id == file_id,
        FileStore.fls_source_type_cd == "KB",
        FileStore.fls_source_id == kb_id
    ).first()
    
    if db_file is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File with ID {file_id} not found for Knowledge Base {kb_id}"
        )
    
    # Check if document association already exists
    existing_document = db.query(KnowledgeBaseDocument).filter(
        KnowledgeBaseDocument.kbd_knb_id == kb_id,
        KnowledgeBaseDocument.kbd_fls_id == file_id
    ).first()
    
    if existing_document:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File {file_id} is already associated with Knowledge Base {kb_id} documents"
        )
    
    # Create document association
    db_document = KnowledgeBaseDocument(
        kbd_knb_id=kb_id,
        kbd_fls_id=file_id
    )
    db.add(db_document)
    db.commit()
    db.refresh(db_document)
    
    doc_response = KnowledgeBaseDocumentResponse.model_validate(db_document, from_attributes=True)
    return serialize_response(doc_response)
