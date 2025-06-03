from sqlalchemy import create_engine

# Database connection configuration
def create_db_engine(db_url: str):
    """
    Create a SQLAlchemy engine for the given database URL.
    
    :param db_url: Database connection URL
    :return: SQLAlchemy DB_ENGINE object
    """
    try:
        DB_ENGINE = create_engine(db_url, echo=True)
        return DB_ENGINE
    except Exception as e:
        raise RuntimeError(f"Failed to create database engine: {str(e)}")