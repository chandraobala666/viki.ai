# File Store model
from sqlalchemy import Column, VARCHAR, LargeBinary

from .base import Base, TimestampMixin

class FileStore(Base, TimestampMixin):
    """Model representing the file_store table"""
    __tablename__ = 'file_store'
    
    fls_id = Column(VARCHAR(80), nullable=False)
    fls_source_type_cd = Column(VARCHAR(80), nullable=False)
    fls_source_id = Column(VARCHAR(80), nullable=False)
    fls_file_name = Column(VARCHAR(240), nullable=False)
    fls_file_content = Column(LargeBinary, nullable=False)
    
    # Define primary key in mapper args
    __mapper_args__ = {
        'primary_key': [fls_id]
    }
    
    def __repr__(self):
        return f"<FileStore(fls_id='{self.fls_id}', fls_file_name='{self.fls_file_name}')>"
