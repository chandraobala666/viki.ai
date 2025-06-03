# Lookup models
from sqlalchemy import Column, VARCHAR, Integer, UniqueConstraint, ForeignKey
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin

class LookupType(Base, TimestampMixin):
    """Model representing the lookup_types table"""
    __tablename__ = 'lookup_types'
    
    lkt_type = Column(VARCHAR(80), primary_key=True, nullable=False)
    lkt_description = Column(VARCHAR(240))
    
    # Relationship with LookupDetail
    details = relationship("LookupDetail", back_populates="lookup_type")
    
    def __repr__(self):
        return f"<LookupType(lkt_type='{self.lkt_type}', lkt_description='{self.lkt_description}')>"


class LookupDetail(Base, TimestampMixin):
    """Model representing the lookup_details table"""
    __tablename__ = 'lookup_details'
    
    lkd_lkt_type = Column(VARCHAR(80), ForeignKey('lookup_types.lkt_type'), primary_key=True)
    lkd_code = Column(VARCHAR(80), primary_key=True)
    lkd_description = Column(VARCHAR(240))
    lkd_sub_code = Column(VARCHAR(80))
    lkd_sort = Column(Integer)
    
    # Relationship with LookupType
    lookup_type = relationship("LookupType", back_populates="details")
    
    # Unique constraint
    __table_args__ = (
        UniqueConstraint('lkd_lkt_type', 'lkd_code', name='uq_lookup_details'),
    )
    
    def __repr__(self):
        return f"<LookupDetail(lkd_lkt_type='{self.lkd_lkt_type}', lkd_code='{self.lkd_code}', lkd_description='{self.lkd_description}')>"
