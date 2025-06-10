# Chat models
from sqlalchemy import Column, VARCHAR, TEXT, JSON, ForeignKey
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin

class ChatSession(Base, TimestampMixin):
    """Model representing the chat_sessions table"""
    __tablename__ = 'chat_sessions'
    
    cht_id = Column(VARCHAR(80), nullable=False)
    cht_name = Column(VARCHAR(240), nullable=False)
    cht_agt_id = Column(VARCHAR(80), ForeignKey('agents.agt_id'), nullable=False)
    
    # Define primary key in mapper args
    __mapper_args__ = {
        'primary_key': [cht_id]
    }
    
    # Relationships (managed in code)
    agent = relationship("Agent", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="chat_session", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<ChatSession(cht_id='{self.cht_id}', cht_name='{self.cht_name}', cht_agt_id='{self.cht_agt_id}')>"


class ChatMessage(Base, TimestampMixin):
    """Model representing the chat_messages table"""
    __tablename__ = 'chat_messages'
    
    msg_id = Column(VARCHAR(80), nullable=False)
    msg_cht_id = Column(VARCHAR(80), ForeignKey('chat_sessions.cht_id'), nullable=False)
    msg_agent_name = Column(VARCHAR(240), nullable=False)
    msg_role = Column(VARCHAR(10), nullable=False)
    msg_content = Column(JSON, nullable=False)  # Stores message array as JSON
    
    # Define primary key in mapper args
    __mapper_args__ = {
        'primary_key': [msg_id]
    }
    
    # Relationships (managed in code)
    chat_session = relationship("ChatSession", back_populates="messages")
    
    def __repr__(self):
        return f"<ChatMessage(msg_id='{self.msg_id}', msg_cht_id='{self.msg_cht_id}', msg_agent_name='{self.msg_agent_name}')>"
