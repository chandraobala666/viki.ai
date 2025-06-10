"""
Pydantic schemas for the models
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict
from datetime import datetime
from enum import Enum
import uuid


class MessageRole(str, Enum):
    """Enum for message role values"""
    USER = "USER"
    AI = "AI"


class CommonModelConfig:
    """Common configuration for all Pydantic models that map to DB entities"""
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        use_enum_values=True,
        json_encoders={datetime: lambda dt: dt.isoformat() if dt else None}
    )


class AgentBase(BaseModel):
    name: str = Field(..., alias="agt_name", description="The name of the agent")
    description: Optional[str] = Field(None, alias="agt_description", description="Detailed description of the agent's purpose and capabilities")
    llmConfig: str = Field(..., alias="agt_llc_id", description="Reference to the LLM configuration used by this agent")
    systemPrompt: Optional[str] = Field(None, alias="agt_system_prompt", description="System prompt that defines the agent's personality and behavior")
    
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True
    )


class AgentCreate(AgentBase):
    pass
    
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        json_schema_extra={
            "example": {
                "name": "Support Assistant",
                "description": "Agent for handling customer support queries",
                "llmConfig": "llm-01",
                "systemPrompt": "You are a helpful customer support assistant."
            }
        }
    )


class AgentUpdate(BaseModel):
    name: Optional[str] = Field(None, alias="agt_name", description="The name of the agent") 
    description: Optional[str] = Field(None, alias="agt_description", description="Detailed description of the agent's purpose and capabilities")
    llmConfig: Optional[str] = Field(None, alias="agt_llc_id", description="Reference to the LLM configuration used by this agent")
    systemPrompt: Optional[str] = Field(None, alias="agt_system_prompt", description="System prompt that defines the agent's personality and behavior")
    
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        json_schema_extra={
            "example": {
                "name": "Updated Support Assistant",
                "description": "Enhanced agent for handling customer support queries with additional capabilities",
                "llmConfig": "llm-02",
                "systemPrompt": "You are an expert customer support assistant with deep product knowledge."
            }
        }
    )


class AgentResponse(AgentBase):
    id: str = Field(..., alias="agt_id", description="Unique identifier for the agent")
    createdBy: Optional[str] = Field(None, alias="created_by", description="Username of the person who created the agent")
    creationDt: Optional[datetime] = Field(None, alias="creation_dt", description="Timestamp when the agent was created")
    lastUpdatedBy: Optional[str] = Field(None, alias="last_updated_by", description="Username of the person who last updated the agent")
    lastUpdatedDt: Optional[datetime] = Field(None, alias="last_updated_dt", description="Timestamp when the agent was last updated")

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        use_enum_values=True,
        json_encoders={datetime: lambda dt: dt.isoformat() if dt else None}
    )


class LLMConfigBase(BaseModel):
    providerTypeCode: str = Field(..., alias="llc_provider_type_cd", description="LLM provider type code (e.g., 'OPENAI', 'ANTHROPIC', 'HUGGINGFACE')")
    modelCode: str = Field(..., alias="llc_model_cd", description="Model identifier for the selected provider (e.g., 'gpt-4', 'claude-3-opus')")
    endpointUrl: Optional[str] = Field(None, alias="llc_endpoint_url", description="Custom API endpoint URL if not using the default provider endpoint")
    apiKey: Optional[str] = Field(None, alias="llc_api_key", description="API key for authenticating with the LLM provider")
    fileStore: Optional[str] = Field(None, alias="llc_fls_id", description="Associated file store ID for this LLM configuration")
    
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True
    )


class LLMConfigCreate(LLMConfigBase):
    pass
    
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        json_schema_extra={
            "example": {
                "providerTypeCode": "OPENAI",
                "modelCode": "gpt-4",
                "endpointUrl": "https://api.openai.com/v1",
                "apiKey": "your-api-key-here",
                "fileStore": None
            }
        }
    )


class LLMConfigUpdate(BaseModel):
    providerTypeCode: Optional[str] = Field(None, alias="llc_provider_type_cd", description="LLM provider type code (e.g., 'OPENAI', 'ANTHROPIC', 'HUGGINGFACE')")
    modelCode: Optional[str] = Field(None, alias="llc_model_cd", description="Model identifier for the selected provider")
    endpointUrl: Optional[str] = Field(None, alias="llc_endpoint_url", description="Custom API endpoint URL")
    apiKey: Optional[str] = Field(None, alias="llc_api_key", description="API key for authenticating with the LLM provider")
    fileStore: Optional[str] = Field(None, alias="llc_fls_id", description="Associated file store ID")
    
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        json_schema_extra={
            "example": {
                "providerTypeCode": "ANTHROPIC",
                "modelCode": "claude-3-opus",
                "endpointUrl": "https://api.anthropic.com/v1",
                "apiKey": "your-updated-api-key-here",
                "fileStore": None
            }
        }
    )


class LLMConfigResponse(LLMConfigBase):
    id: str = Field(..., alias="llc_id", description="Unique identifier for the LLM configuration")
    createdBy: Optional[str] = Field(None, alias="created_by", description="Username of the person who created this configuration")
    creationDt: Optional[datetime] = Field(None, alias="creation_dt", description="Timestamp when the configuration was created")
    lastUpdatedBy: Optional[str] = Field(None, alias="last_updated_by", description="Username of the person who last updated this configuration")
    lastUpdatedDt: Optional[datetime] = Field(None, alias="last_updated_dt", description="Timestamp when the configuration was last updated")

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        use_enum_values=True,
        json_encoders={datetime: lambda dt: dt.isoformat() if dt else None}
    )


class AgentToolBase(BaseModel):
    agent: str = Field(..., alias="ato_agt_id", description="ID of the agent that uses this tool")
    tool: str = Field(..., alias="ato_tol_id", description="ID of the tool being associated with the agent")
    
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True
    )


class AgentToolCreate(AgentToolBase):
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        json_schema_extra={
            "example": {
                "agent": "agent-01",
                "tool": "tool-01"
            }
        }
    )


class AgentToolResponse(AgentToolBase):
    createdBy: Optional[str] = Field(None, alias="created_by", description="Username of the person who created this association")
    creationDt: Optional[datetime] = Field(None, alias="creation_dt", description="Timestamp when this association was created")
    lastUpdatedBy: Optional[str] = Field(None, alias="last_updated_by", description="Username of the person who last updated this association")
    lastUpdatedDt: Optional[datetime] = Field(None, alias="last_updated_dt", description="Timestamp when this association was last updated")

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        use_enum_values=True,
        json_encoders={datetime: lambda dt: dt.isoformat() if dt else None}
    )


class AgentKnowledgeBaseBase(BaseModel):
    agent: str = Field(..., alias="akb_agt_id", description="ID of the agent that uses this knowledge base")
    knowledgeBase: str = Field(..., alias="akb_knb_id", description="ID of the knowledge base being associated with the agent")
    
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True
    )


class AgentKnowledgeBaseCreate(AgentKnowledgeBaseBase):
    pass
    
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        json_schema_extra={
            "example": {
                "agent": "agent-01",
                "knowledgeBase": "kb-01"
            }
        }
    )


class AgentKnowledgeBaseResponse(AgentKnowledgeBaseBase):
    createdBy: Optional[str] = Field(None, alias="created_by", description="Username of the person who created this association")
    creationDt: Optional[datetime] = Field(None, alias="creation_dt", description="Timestamp when this association was created")
    lastUpdatedBy: Optional[str] = Field(None, alias="last_updated_by", description="Username of the person who last updated this association")
    lastUpdatedDt: Optional[datetime] = Field(None, alias="last_updated_dt", description="Timestamp when this association was last updated")

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        use_enum_values=True,
        json_encoders={datetime: lambda dt: dt.isoformat() if dt else None}
    )


# Knowledge Base Schemas
class KnowledgeBaseBase(BaseModel):
    name: str = Field(..., alias="knb_name", description="Name of the knowledge base")
    description: Optional[str] = Field(None, alias="knb_description", description="Description of the knowledge base's contents and purpose")
    
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True
    )


class KnowledgeBaseCreate(KnowledgeBaseBase):
    pass
    
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        json_schema_extra={
            "example": {
                "name": "Company Documentation",
                "description": "Contains all company policies and procedures"
            }
        }
    )


class KnowledgeBaseUpdate(BaseModel):
    name: Optional[str] = Field(None, alias="knb_name", description="Name of the knowledge base")
    description: Optional[str] = Field(None, alias="knb_description", description="Description of the knowledge base's contents and purpose")
    
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        json_schema_extra={
            "example": {
                "name": "Updated Company Documentation",
                "description": "Enhanced documentation with additional company policies and procedures"
            }
        }
    )


class KnowledgeBaseResponse(KnowledgeBaseBase):
    id: str = Field(..., alias="knb_id", description="Unique identifier for the knowledge base")
    createdBy: Optional[str] = Field(None, alias="created_by", description="Username of the person who created this knowledge base")
    creationDt: Optional[datetime] = Field(None, alias="creation_dt", description="Timestamp when the knowledge base was created")
    lastUpdatedBy: Optional[str] = Field(None, alias="last_updated_by", description="Username of the person who last updated this knowledge base")
    lastUpdatedDt: Optional[datetime] = Field(None, alias="last_updated_dt", description="Timestamp when the knowledge base was last updated")

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        use_enum_values=True,
        json_encoders={datetime: lambda dt: dt.isoformat() if dt else None}
    )


class KnowledgeBaseDocumentCreate(BaseModel):
    knowledgeBase: str = Field(..., alias="kbd_knb_id", description="ID of the knowledge base that contains this document")
    fileStore: str = Field(..., alias="kbd_fls_id", description="ID of the file in the file store")
    
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        json_schema_extra={
            "example": {
                "knowledgeBase": "kb-01",
                "fileStore": "file-001"
            }
        }
    )


class KnowledgeBaseDocumentResponse(BaseModel):
    knowledgeBase: str = Field(..., alias="kbd_knb_id", description="ID of the knowledge base that contains this document")
    fileStore: str = Field(..., alias="kbd_fls_id", description="ID of the file in the file store")
    createdBy: Optional[str] = Field(None, alias="created_by", description="Username of the person who added this document")
    creationDt: Optional[datetime] = Field(None, alias="creation_dt", description="Timestamp when the document was added")
    lastUpdatedBy: Optional[str] = Field(None, alias="last_updated_by", description="Username of the person who last updated this document")
    lastUpdatedDt: Optional[datetime] = Field(None, alias="last_updated_dt", description="Timestamp when the document was last updated")
    
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        use_enum_values=True,
        json_encoders={datetime: lambda dt: dt.isoformat() if dt else None}
    )


# Tool Schemas
class ToolBase(BaseModel):
    name: str = Field(..., alias="tol_name", description="Name of the tool")
    description: Optional[str] = Field(None, alias="tol_description", description="Description of the tool's functionality and purpose")
    mcpCommand: str = Field(..., alias="tol_mcp_command", description="Model Context Protocol command for this tool")
    
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True
    )


class ToolCreate(ToolBase):
    pass
    
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        json_schema_extra={
            "example": {
                "name": "Weather API",
                "description": "Gets current weather information for a location",
                "mcpCommand": "weather_api"
            }
        }
    )


class ToolUpdate(BaseModel):
    name: Optional[str] = Field(None, alias="tol_name", description="Name of the tool")
    description: Optional[str] = Field(None, alias="tol_description", description="Description of the tool's functionality and purpose")
    mcpCommand: Optional[str] = Field(None, alias="tol_mcp_command", description="Model Context Protocol command for this tool")
    
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        json_schema_extra={
            "example": {
                "name": "Enhanced Weather API",
                "description": "Gets current weather information and forecasts for a location",
                "mcpCommand": "enhanced_weather_api"
            }
        }
    )


class ToolResponse(ToolBase, CommonModelConfig):
    id: str = Field(..., alias="tol_id", description="Unique identifier for the tool")
    mcpFunctionCount: Optional[int] = Field(None, alias="tol_mcp_function_count", description="Total number of MCP functions available for this tool")
    createdBy: Optional[str] = Field(None, alias="created_by", description="Username of the person who created this tool")
    creationDt: Optional[datetime] = Field(None, alias="creation_dt", description="Timestamp when the tool was created")
    lastUpdatedBy: Optional[str] = Field(None, alias="last_updated_by", description="Username of the person who last updated this tool")
    lastUpdatedDt: Optional[datetime] = Field(None, alias="last_updated_dt", description="Timestamp when the tool was last updated")


class ToolEnvironmentVariableBase(BaseModel):
    key: str = Field(..., alias="tev_key", description="Environment variable key name")
    value: Optional[str] = Field(None, alias="tev_value", description="Environment variable value")
    
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        json_schema_extra={
            "example": {
                "key": "API_KEY",
                "value": "updated-api-key-value"
            }
        }
    )


class ToolEnvironmentVariableCreate(ToolEnvironmentVariableBase):
    tool: str = Field(..., alias="tev_tol_id", description="ID of the tool that uses this environment variable")
    
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        json_schema_extra={
            "example": {
                "tool": "tool-01",
                "key": "API_KEY",
                "value": "your-api-key-value"
            }
        }
    )


class ToolEnvironmentVariableResponse(ToolEnvironmentVariableBase, CommonModelConfig):
    tool: str = Field(..., alias="tev_tol_id", description="ID of the tool that uses this environment variable")
    createdBy: Optional[str] = Field(None, alias="created_by", description="Username of the person who created this environment variable")
    creationDt: Optional[datetime] = Field(None, alias="creation_dt", description="Timestamp when the environment variable was created")
    lastUpdatedBy: Optional[str] = Field(None, alias="last_updated_by", description="Username of the person who last updated this environment variable")
    lastUpdatedDt: Optional[datetime] = Field(None, alias="last_updated_dt", description="Timestamp when the environment variable was last updated")


class ToolEnvironmentVariableBulkResponse(BaseModel):
    success: List[ToolEnvironmentVariableResponse] = Field(..., description="Successfully created environment variables")
    errors: List[Dict[str, str]] = Field(..., description="Errors encountered during creation")
    
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True
    )


# Tool Resource Schemas
class ToolResourceBase(BaseModel):
    resourceName: str = Field(..., alias="tre_resource_name", description="Resource name from the tool configuration")
    resourceDescription: Optional[str] = Field(None, alias="tre_resource_description", description="Description of the resource")
    
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        json_schema_extra={
            "example": {
                "resourceName": "get_weather",
                "resourceDescription": "Retrieves current weather information for a given location"
            }
        }
    )


class ToolResourceCreate(ToolResourceBase):
    tool: str = Field(..., alias="tre_tol_id", description="ID of the tool that provides this resource")
    
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        json_schema_extra={
            "example": {
                "tool": "tool-01",
                "resourceName": "get_weather",
                "resourceDescription": "Retrieves current weather information for a given location"
            }
        }
    )


class ToolResourceResponse(ToolResourceBase, CommonModelConfig):
    tool: str = Field(..., alias="tre_tol_id", description="ID of the tool that provides this resource")
    createdBy: Optional[str] = Field(None, alias="created_by", description="Username of the person who created this resource")
    creationDt: Optional[datetime] = Field(None, alias="creation_dt", description="Timestamp when the resource was created")
    lastUpdatedBy: Optional[str] = Field(None, alias="last_updated_by", description="Username of the person who last updated this resource")
    lastUpdatedDt: Optional[datetime] = Field(None, alias="last_updated_dt", description="Timestamp when the resource was last updated")


class ToolResourceBulkResponse(BaseModel):
    success: List[ToolResourceResponse] = Field(..., description="Successfully created tool resources")
    errors: List[Dict[str, str]] = Field(..., description="Errors encountered during creation")
    
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True
    )


# FileStore Schemas
class FileStoreBase(BaseModel):
    sourceTypeCode: str = Field(..., alias="fls_source_type_cd", description="Source type code for the file (e.g., 'KB' for Knowledge Base, 'LLM' for LLM Config)")
    sourceId: str = Field(..., alias="fls_source_id", description="ID of the source entity that owns this file")
    fileName: str = Field(..., alias="fls_file_name", description="Original name of the uploaded file")
    
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True
    )


class FileStoreCreate(FileStoreBase):
    fileContent: bytes = Field(..., alias="fls_file_content", description="Binary content of the file")
    
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        json_schema_extra={
            "example": {
                "sourceTypeCode": "KB",
                "sourceId": "kb-01",
                "fileName": "document.pdf",
                "fileContent": "binary_file_content_here"
            }
        }
    )


class FileStoreUpdate(BaseModel):
    sourceTypeCode: Optional[str] = Field(None, alias="fls_source_type_cd", description="Source type code for the file")
    sourceId: Optional[str] = Field(None, alias="fls_source_id", description="ID of the source entity that owns this file")
    fileName: Optional[str] = Field(None, alias="fls_file_name", description="Original name of the uploaded file")
    fileContent: Optional[bytes] = Field(None, alias="fls_file_content", description="Binary content of the file")
    
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        json_schema_extra={
            "example": {
                "sourceTypeCode": "KB",
                "sourceId": "kb-02",
                "fileName": "updated_document.pdf",
                "fileContent": "updated_binary_file_content_here"
            }
        }
    )


class FileStoreResponse(FileStoreBase, CommonModelConfig):
    id: str = Field(..., alias="fls_id", description="Unique identifier for the file")
    createdBy: Optional[str] = Field(None, alias="created_by", description="Username of the person who uploaded this file")
    creationDt: Optional[datetime] = Field(None, alias="creation_dt", description="Timestamp when the file was uploaded")
    lastUpdatedBy: Optional[str] = Field(None, alias="last_updated_by", description="Username of the person who last updated this file")
    lastUpdatedDt: Optional[datetime] = Field(None, alias="last_updated_dt", description="Timestamp when the file was last updated")


class FileStoreContentResponse(FileStoreResponse):
    fileContent: bytes = Field(..., alias="fls_file_content", description="Binary content of the file")
    
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        use_enum_values=True,
        json_encoders={datetime: lambda dt: dt.isoformat() if dt else None}
    )


# Lookup Schemas
class LookupTypeBase(BaseModel):
    typeCode: str = Field(..., alias="lkt_type", description="Type identifier for the lookup category")
    description: Optional[str] = Field(None, alias="lkt_description", description="Description of the lookup type")
    
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True
    )


class LookupTypeCreate(LookupTypeBase):
    pass
    
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        json_schema_extra={
            "example": {
                "typeCode": "PROVIDER_TYPE",
                "description": "LLM Provider Types"
            }
        }
    )


class LookupTypeUpdate(BaseModel):
    typeCode: Optional[str] = Field(None, alias="lkt_type", description="Type identifier for the lookup category")
    description: Optional[str] = Field(None, alias="lkt_description", description="Description of the lookup type")
    
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        json_schema_extra={
            "example": {
                "typeCode": "PROVIDER_TYPE",
                "description": "Updated LLM Provider Types"
            }
        }
    )


class LookupTypeResponse(LookupTypeBase, CommonModelConfig):
    createdBy: Optional[str] = Field(None, alias="created_by", description="Username of the person who created this lookup type")
    creationDt: Optional[datetime] = Field(None, alias="creation_dt", description="Timestamp when the lookup type was created")
    lastUpdatedBy: Optional[str] = Field(None, alias="last_updated_by", description="Username of the person who last updated this lookup type")
    lastUpdatedDt: Optional[datetime] = Field(None, alias="last_updated_dt", description="Timestamp when the lookup type was last updated")


class LookupDetailBase(BaseModel):
    typeCode: str = Field(..., alias="lkd_lkt_type", description="Type identifier that this detail belongs to")
    code: str = Field(..., alias="lkd_code", description="Code for this lookup detail")
    description: Optional[str] = Field(None, alias="lkd_description", description="Description of the lookup detail")
    subCode: Optional[str] = Field(None, alias="lkd_sub_code", description="Sub-code for additional categorization")
    sortOrder: Optional[int] = Field(None, alias="lkd_sort", description="Sort order for display purposes")
    
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True
    )


class LookupDetailCreate(LookupDetailBase):
    pass
    
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        json_schema_extra={
            "example": {
                "typeCode": "PROVIDER_TYPE",
                "code": "OPENAI",
                "description": "OpenAI Provider",
                "subCode": None,
                "sortOrder": 1
            }
        }
    )


class LookupDetailUpdate(BaseModel):
    typeCode: Optional[str] = Field(None, alias="lkd_lkt_type", description="Type identifier that this detail belongs to")
    code: Optional[str] = Field(None, alias="lkd_code", description="Code for this lookup detail")
    description: Optional[str] = Field(None, alias="lkd_description", description="Description of the lookup detail")
    subCode: Optional[str] = Field(None, alias="lkd_sub_code", description="Sub-code for additional categorization")
    sortOrder: Optional[int] = Field(None, alias="lkd_sort", description="Sort order for display purposes")
    
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        json_schema_extra={
            "example": {
                "typeCode": "PROVIDER_TYPE",
                "code": "OPENAI",
                "description": "Updated OpenAI Provider",
                "subCode": "GPT",
                "sortOrder": 1
            }
        }
    )


class LookupDetailResponse(LookupDetailBase, CommonModelConfig):
    createdBy: Optional[str] = Field(None, alias="created_by", description="Username of the person who created this lookup detail")
    creationDt: Optional[datetime] = Field(None, alias="creation_dt", description="Timestamp when the lookup detail was created")
    lastUpdatedBy: Optional[str] = Field(None, alias="last_updated_by", description="Username of the person who last updated this lookup detail")
    lastUpdatedDt: Optional[datetime] = Field(None, alias="last_updated_dt", description="Timestamp when the lookup detail was last updated")


# Chat Schemas
class ChatSessionBase(BaseModel):
    name: str = Field(..., alias="cht_name", description="Name of the chat session")
    description: Optional[str] = Field(None, alias="cht_description", description="Description of the chat session's purpose")
    agent: str = Field(..., alias="cht_agt_id", description="ID of the agent associated with this chat session")
    
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True
    )


class ChatSessionCreate(ChatSessionBase):
    pass
    
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        json_schema_extra={
            "example": {
                "name": "Customer Support Chat",
                "description": "Chat session for handling customer support queries",
                "agent": "agent-01"
            }
        }
    )


class ChatSessionUpdate(BaseModel):
    name: Optional[str] = Field(None, alias="cht_name", description="Name of the chat session")
    description: Optional[str] = Field(None, alias="cht_description", description="Description of the chat session's purpose")
    agent: Optional[str] = Field(None, alias="cht_agt_id", description="ID of the agent associated with this chat session")
    
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        json_schema_extra={
            "example": {
                "name": "Updated Customer Support Chat",
                "description": "Enhanced chat session for handling customer support queries with additional capabilities",
                "agent": "agent-02"
            }
        }
    )


class ChatSessionResponse(ChatSessionBase):
    id: str = Field(..., alias="cht_id", description="Unique identifier for the chat session")
    createdBy: Optional[str] = Field(None, alias="created_by", description="Username of the person who created the chat session")
    creationDt: Optional[datetime] = Field(None, alias="creation_dt", description="Timestamp when the chat session was created")
    lastUpdatedBy: Optional[str] = Field(None, alias="last_updated_by", description="Username of the person who last updated the chat session")
    lastUpdatedDt: Optional[datetime] = Field(None, alias="last_updated_dt", description="Timestamp when the chat session was last updated")

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        use_enum_values=True,
        json_encoders={datetime: lambda dt: dt.isoformat() if dt else None}
    )


class ChatMessageBase(BaseModel):
    chatSession: str = Field(..., alias="msg_cht_id", description="ID of the chat session this message belongs to")
    agentName: str = Field(..., alias="msg_agent_name", description="Name of the agent that sent this message")
    role: MessageRole = Field(..., alias="msg_role", description="Role of the message sender - either USER or AI")
    content: List[Dict] = Field(..., alias="msg_content", description="Message content as an array of message objects")
    
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True
    )


class ChatMessageCreate(ChatMessageBase):
    pass
    
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        json_schema_extra={
            "example": {
                "chatSession": "chat-01",
                "agentName": "Support Assistant",
                "role": "USER",
                "content": [
                    {"role": "user", "content": "Hello, I need help"},
                    {"role": "assistant", "content": "Hi! I'm here to help you. What can I assist you with today?"}
                ]
            }
        }
    )


class ChatMessageUpdate(BaseModel):
    chatSession: Optional[str] = Field(None, alias="msg_cht_id", description="ID of the chat session this message belongs to")
    agentName: Optional[str] = Field(None, alias="msg_agent_name", description="Name of the agent that sent this message")
    role: Optional[MessageRole] = Field(None, alias="msg_role", description="Role of the message sender - either USER or AI")
    content: Optional[List[Dict]] = Field(None, alias="msg_content", description="Message content as an array of message objects")
    
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        json_schema_extra={
            "example": {
                "agentName": "Updated Support Assistant",
                "role": "AI",
                "content": [
                    {"role": "user", "content": "Hello, I need help"},
                    {"role": "assistant", "content": "Hi! I'm here to help you. What can I assist you with today?"},
                    {"role": "user", "content": "I have a question about my account"}
                ]
            }
        }
    )


class ChatMessageResponse(ChatMessageBase):
    id: str = Field(..., alias="msg_id", description="Unique identifier for the chat message")
    createdBy: Optional[str] = Field(None, alias="created_by", description="Username of the person who created the chat message")
    creationDt: Optional[datetime] = Field(None, alias="creation_dt", description="Timestamp when the chat message was created")
    lastUpdatedBy: Optional[str] = Field(None, alias="last_updated_by", description="Username of the person who last updated the chat message")
    lastUpdatedDt: Optional[datetime] = Field(None, alias="last_updated_dt", description="Timestamp when the chat message was last updated")

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        use_enum_values=True,
        json_encoders={datetime: lambda dt: dt.isoformat() if dt else None}
    )
