# SQLAlchemy Base for models
from sqlalchemy.orm import declarative_base
from sqlalchemy import Column, TIMESTAMP, VARCHAR, text

# Create base class for all models
Base = declarative_base()

# Define common timestamp columns for all models
class TimestampMixin:
    """Mixin class for common timestamp fields used across all tables"""
    created_by = Column(VARCHAR(80))
    last_updated_by = Column(VARCHAR(80))
    creation_dt = Column(TIMESTAMP, server_default=text('CURRENT_TIMESTAMP'))
    last_updated_dt = Column(TIMESTAMP, server_default=text('CURRENT_TIMESTAMP'))
