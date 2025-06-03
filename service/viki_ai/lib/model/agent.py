# Agent models
from sqlalchemy import Column, VARCHAR, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin

class Agent(Base, TimestampMixin):
    """Model representing the agents table"""
    __tablename__ = 'agents'
    
    agt_id = Column(VARCHAR(80), primary_key=True, nullable=False)
    agt_name = Column(VARCHAR(240), nullable=False)
    agt_description = Column(VARCHAR(4000))
    agt_llc_id = Column(VARCHAR(80), ForeignKey('llm_config.llc_id'), nullable=False)
    agt_system_prompt = Column(VARCHAR(4000))
    
    # Relationships
    llm_config = relationship("LLMConfig", back_populates="agents")
    tools = relationship("AgentTool", back_populates="agent")
    knowledge_bases = relationship("AgentKnowledgeBase", back_populates="agent")
    
    def __repr__(self):
        return f"<Agent(agt_id='{self.agt_id}', agt_name='{self.agt_name}')>"


class AgentTool(Base, TimestampMixin):
    """Model representing the agent_tools table"""
    __tablename__ = 'agent_tools'
    
    ato_agt_id = Column(VARCHAR(80), ForeignKey('agents.agt_id'), primary_key=True)
    ato_tol_id = Column(VARCHAR(80), ForeignKey('tools.tol_id'), primary_key=True)
    
    # Relationships
    agent = relationship("Agent", back_populates="tools")
    tool = relationship("Tool", back_populates="agent_tools")
    
    # Unique constraint
    __table_args__ = (
        UniqueConstraint('ato_agt_id', 'ato_tol_id', name='uq_agent_tools'),
    )
    
    def __repr__(self):
        return f"<AgentTool(ato_agt_id='{self.ato_agt_id}', ato_tol_id='{self.ato_tol_id}')>"


class AgentKnowledgeBase(Base, TimestampMixin):
    """Model representing the agent_knowledge_bases table"""
    __tablename__ = 'agent_knowledge_bases'
    
    akb_agt_id = Column(VARCHAR(80), ForeignKey('agents.agt_id'), primary_key=True)
    akb_knb_id = Column(VARCHAR(80), ForeignKey('knowledge_base_details.knb_id'), primary_key=True)
    
    # Relationships
    agent = relationship("Agent", back_populates="knowledge_bases")
    knowledge_base = relationship("KnowledgeBaseDetail", back_populates="agent_knowledge_bases")
    
    # Unique constraint
    __table_args__ = (
        UniqueConstraint('akb_agt_id', 'akb_knb_id', name='uq_agent_knowledge_bases'),
    )
    
    def __repr__(self):
        return f"<AgentKnowledgeBase(akb_agt_id='{self.akb_agt_id}', akb_knb_id='{self.akb_knb_id}')>"
