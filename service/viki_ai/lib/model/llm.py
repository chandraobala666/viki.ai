# LLM Config model
from sqlalchemy import Column, VARCHAR, ForeignKey
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin

class LLMConfig(Base, TimestampMixin):
    """Model representing the llm_config table"""
    __tablename__ = 'llm_config'
    
    llc_id = Column(VARCHAR(80), nullable=False)
    llc_provider_type_cd = Column(VARCHAR(80), nullable=False)
    llc_model_cd = Column(VARCHAR(240), nullable=False)
    llc_endpoint_url = Column(VARCHAR(4000))
    llc_api_key = Column(VARCHAR(240))
    llc_fls_id = Column(VARCHAR(80), ForeignKey('file_store.fls_id'))
    
    # Define primary key in mapper args
    __mapper_args__ = {
        'primary_key': [llc_id]
    }
    
    # Relationships
    agents = relationship("Agent", back_populates="llm_config", cascade="all, delete-orphan")
    file_store = relationship("FileStore")
    
    def __repr__(self):
        return f"<LLMConfig(llc_id='{self.llc_id}', llc_provider_type_cd='{self.llc_provider_type_cd}', llc_model_cd='{self.llc_model_cd}')>"
