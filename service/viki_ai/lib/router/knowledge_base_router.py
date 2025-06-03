"""
Knowledge Base router for VIKI API
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..model.knowledge_base import KnowledgeBaseDetail, KnowledgeBaseDocument
from ..model.db_session import get_db
from .schemas import (
    KnowledgeBaseCreate, 
    KnowledgeBaseUpdate, 
    KnowledgeBaseResponse,
    KnowledgeBaseDocumentCreate,
    KnowledgeBaseDocumentResponse
)

router = APIRouter(
    prefix="/knowledge-bases",
    tags=["knowledge-bases"],
    responses={404: {"description": "Not found"}},
)


@router.get("/", response_model=List[KnowledgeBaseResponse])
def get_knowledge_bases(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Get all knowledge bases
    """
    knowledge_bases = db.query(KnowledgeBaseDetail).offset(skip).limit(limit).all()
    return knowledge_bases


@router.get("/{kb_id}", response_model=KnowledgeBaseResponse)
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
    return knowledge_base


@router.post("/", response_model=KnowledgeBaseResponse, status_code=status.HTTP_201_CREATED)
def create_knowledge_base(knowledge_base: KnowledgeBaseCreate, db: Session = Depends(get_db)):
    """
    Create a new knowledge base
    """
    db_knowledge_base = db.query(KnowledgeBaseDetail).filter(
        KnowledgeBaseDetail.knb_id == knowledge_base.knb_id
    ).first()
    
    if db_knowledge_base:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Knowledge Base with ID {knowledge_base.knb_id} already exists"
        )
    
    db_knowledge_base = KnowledgeBaseDetail(**knowledge_base.dict())
    db.add(db_knowledge_base)
    db.commit()
    db.refresh(db_knowledge_base)
    return db_knowledge_base


@router.put("/{kb_id}", response_model=KnowledgeBaseResponse)
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
    for key, value in update_data.items():
        setattr(db_knowledge_base, key, value)
    
    db.add(db_knowledge_base)
    db.commit()
    db.refresh(db_knowledge_base)
    return db_knowledge_base


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
@router.get("/{kb_id}/documents", response_model=List[KnowledgeBaseDocumentResponse])
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
    
    return documents


@router.post("/{kb_id}/documents", response_model=KnowledgeBaseDocumentResponse, status_code=status.HTTP_201_CREATED)
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
        KnowledgeBaseDocument.kbd_fls_id == document.kbd_fls_id
    ).first()
    
    if db_document:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Document with ID {document.kbd_fls_id} already exists in Knowledge Base {kb_id}"
        )
    
    db_document = KnowledgeBaseDocument(**document.dict())
    db.add(db_document)
    db.commit()
    db.refresh(db_document)
    return db_document


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
