"""
Knowledge Base router for VIKI API
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import uuid

from ..model.knowledge_base import KnowledgeBaseDetail, KnowledgeBaseDocument
from ..model.db_session import get_db
from .schemas import (
    KnowledgeBaseCreate, 
    KnowledgeBaseUpdate, 
    KnowledgeBaseResponse,
    KnowledgeBaseDocumentCreate,
    KnowledgeBaseDocumentResponse
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
    # Check if the document exists in the knowledge base
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
