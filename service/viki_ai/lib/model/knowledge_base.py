# Knowledge Base models
from sqlalchemy import Column, VARCHAR, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin

class KnowledgeBaseDetail(Base, TimestampMixin):
    """Model representing the knowledge_base_details table"""
    __tablename__ = 'knowledge_base_details'
    
    knb_id = Column(VARCHAR(80), primary_key=True, nullable=False)
    knb_name = Column(VARCHAR(240), nullable=False)
    knb_description = Column(VARCHAR(4000))
    
    # Relationships
    documents = relationship("KnowledgeBaseDocument", back_populates="knowledge_base")
    agent_knowledge_bases = relationship("AgentKnowledgeBase", back_populates="knowledge_base")
    
    def __repr__(self):
        return f"<KnowledgeBaseDetail(knb_id='{self.knb_id}', knb_name='{self.knb_name}')>"


class KnowledgeBaseDocument(Base, TimestampMixin):
    """Model representing the knowledge_base_documents table"""
    __tablename__ = 'knowledge_base_documents'
    
    kbd_knb_id = Column(VARCHAR(80), ForeignKey('knowledge_base_details.knb_id'), primary_key=True)
    kbd_fls_id = Column(VARCHAR(80), ForeignKey('file_store.fls_id'), primary_key=True)
    
    # Relationship with KnowledgeBaseDetail
    knowledge_base = relationship("KnowledgeBaseDetail", back_populates="documents")
    
    # Unique constraint
    __table_args__ = (
        UniqueConstraint('kbd_knb_id', 'kbd_fls_id', name='uq_knowledge_base_documents'),
    )
    
    def __repr__(self):
        return f"<KnowledgeBaseDocument(kbd_knb_id='{self.kbd_knb_id}', kbd_fls_id='{self.kbd_fls_id}')>"
