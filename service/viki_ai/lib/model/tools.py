# Tools models
from sqlalchemy import Column, VARCHAR, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin

class Tool(Base, TimestampMixin):
    """Model representing the tools table"""
    __tablename__ = 'tools'
    
    tol_id = Column(VARCHAR(80), nullable=False)
    tol_name = Column(VARCHAR(240), nullable=False)
    tol_description = Column(VARCHAR(4000))
    tol_mcp_command = Column(VARCHAR(240), nullable=False)
    tol_mcp_function_count = Column(Integer, default=0)
    
    # Define primary key in mapper args
    __mapper_args__ = {
        'primary_key': [tol_id]
    }
    
    # Relationships
    environment_variables = relationship("ToolEnvironmentVariable", back_populates="tool", cascade="all, delete-orphan")
    resources = relationship("ToolResource", back_populates="tool", cascade="all, delete-orphan")
    agent_tools = relationship("AgentTool", back_populates="tool", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Tool(tol_id='{self.tol_id}', tol_name='{self.tol_name}')>"


class ToolEnvironmentVariable(Base, TimestampMixin):
    """Model representing the tool_environment_variables table"""
    __tablename__ = 'tool_environment_variables'
    
    tev_tol_id = Column(VARCHAR(80), ForeignKey('tools.tol_id'), nullable=False)
    tev_key = Column(VARCHAR(240), nullable=False)
    tev_value = Column(VARCHAR(4000))
    
    # Define composite primary key in mapper args
    __mapper_args__ = {
        'primary_key': [tev_tol_id, tev_key]
    }
    
    # Relationship with Tool
    tool = relationship("Tool", back_populates="environment_variables")
    
    # Unique constraint
    __table_args__ = (
        UniqueConstraint('tev_tol_id', 'tev_key', name='uq_tool_env_vars'),
    )
    
    def __repr__(self):
        return f"<ToolEnvironmentVariable(tev_tol_id='{self.tev_tol_id}', tev_key='{self.tev_key}')>"


class ToolResource(Base, TimestampMixin):
    """Model representing the tool_resources table"""
    __tablename__ = 'tool_resources'
    
    tre_tol_id = Column(VARCHAR(80), ForeignKey('tools.tol_id'), nullable=False)
    tre_resource_name = Column(VARCHAR(240), nullable=False)
    tre_resource_description = Column(VARCHAR(4000))
    
    # Define composite primary key in mapper args
    __mapper_args__ = {
        'primary_key': [tre_tol_id, tre_resource_name]
    }
    
    # Relationship with Tool
    tool = relationship("Tool", back_populates="resources")
    
    # Unique constraint
    __table_args__ = (
        UniqueConstraint('tre_tol_id', 'tre_resource_name', name='uq_tool_resources'),
    )
    
    def __repr__(self):
        return f"<ToolResource(tre_tol_id='{self.tre_tol_id}', tre_resource_name='{self.tre_resource_name}')>"
