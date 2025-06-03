# Tools models
from sqlalchemy import Column, VARCHAR, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin

class Tool(Base, TimestampMixin):
    """Model representing the tools table"""
    __tablename__ = 'tools'
    
    tol_id = Column(VARCHAR(80), primary_key=True, nullable=False)
    tol_name = Column(VARCHAR(240), nullable=False)
    tol_description = Column(VARCHAR(4000))
    tol_mcp_command = Column(VARCHAR(240), nullable=False)
    
    # Relationships
    environment_variables = relationship("ToolEnvironmentVariable", back_populates="tool")
    agent_tools = relationship("AgentTool", back_populates="tool")
    
    def __repr__(self):
        return f"<Tool(tol_id='{self.tol_id}', tol_name='{self.tol_name}')>"


class ToolEnvironmentVariable(Base, TimestampMixin):
    """Model representing the tool_environment_variables table"""
    __tablename__ = 'tool_environment_variables'
    
    tev_tol_id = Column(VARCHAR(80), ForeignKey('tools.tol_id'), primary_key=True)
    tev_key = Column(VARCHAR(240), primary_key=True)
    tev_value = Column(VARCHAR(4000))
    
    # Relationship with Tool
    tool = relationship("Tool", back_populates="environment_variables")
    
    # Unique constraint
    __table_args__ = (
        UniqueConstraint('tev_tol_id', 'tev_key', name='uq_tool_env_vars'),
    )
    
    def __repr__(self):
        return f"<ToolEnvironmentVariable(tev_tol_id='{self.tev_tol_id}', tev_key='{self.tev_key}')>"
