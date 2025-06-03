# Database session utilities
from sqlalchemy.orm import sessionmaker, Session

from ..db_config.db_connect import create_db_engine
from .base import Base

class DatabaseSession:
    """
    Utility class to manage database sessions
    """
    _engine = None
    _session_factory = None
    
    @classmethod
    def initialize(cls, db_url: str):
        """
        Initialize the database engine and session factory
        
        Args:
            db_url: Database connection URL
        """
        if cls._engine is None:
            cls._engine = create_db_engine(db_url)
            cls._session_factory = sessionmaker(bind=cls._engine)
    
    @classmethod
    def create_tables(cls):
        """Create all tables defined in the models"""
        if cls._engine:
            Base.metadata.create_all(cls._engine)
    
    @classmethod
    def get_session(cls) -> Session:
        """
        Get a new database session
        
        Returns:
            SQLAlchemy Session object
        
        Raises:
            RuntimeError: If initialize() has not been called
        """
        if cls._session_factory is None:
            raise RuntimeError("Database session factory not initialized. Call DatabaseSession.initialize() first.")
        return cls._session_factory()
    
    @classmethod
    def session_scope(cls):
        """
        Session context manager for automatic commit/rollback
        
        Usage:
            with DatabaseSession.session_scope() as session:
                # do database operations
                # session will be automatically committed or rolled back
        """
        if cls._session_factory is None:
            raise RuntimeError("Database session factory not initialized. Call DatabaseSession.initialize() first.")
            
        session = cls._session_factory()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()
