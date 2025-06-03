"""
Pydantic schemas for the models
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict


class AgentBase(BaseModel):
    agt_name: str
    agt_description: Optional[str] = None
    agt_llc_id: str
    agt_system_prompt: Optional[str] = None


class AgentCreate(AgentBase):
    agt_id: str


class AgentUpdate(BaseModel):
    agt_name: Optional[str] = None
    agt_description: Optional[str] = None
    agt_llc_id: Optional[str] = None
    agt_system_prompt: Optional[str] = None


class AgentResponse(AgentBase):
    agt_id: str
    created_by: Optional[str] = None
    creation_dt: Optional[str] = None
    last_updated_by: Optional[str] = None
    last_updated_dt: Optional[str] = None

    class Config:
        orm_mode = True
        from_attributes = True


class LLMConfigBase(BaseModel):
    llc_provider_type_cd: str
    llc_model_cd: str
    llc_endpoint_url: Optional[str] = None
    llc_api_key: Optional[str] = None
    llc_fls_id: Optional[str] = None


class LLMConfigCreate(LLMConfigBase):
    llc_id: str


class LLMConfigUpdate(BaseModel):
    llc_provider_type_cd: Optional[str] = None
    llc_model_cd: Optional[str] = None
    llc_endpoint_url: Optional[str] = None
    llc_api_key: Optional[str] = None
    llc_fls_id: Optional[str] = None


class LLMConfigResponse(LLMConfigBase):
    llc_id: str
    created_by: Optional[str] = None
    creation_dt: Optional[str] = None
    last_updated_by: Optional[str] = None
    last_updated_dt: Optional[str] = None

    class Config:
        orm_mode = True
        from_attributes = True


class AgentToolBase(BaseModel):
    ato_agt_id: str
    ato_tol_id: str


class AgentToolCreate(AgentToolBase):
    pass


class AgentToolResponse(AgentToolBase):
    created_by: Optional[str] = None
    creation_dt: Optional[str] = None
    last_updated_by: Optional[str] = None
    last_updated_dt: Optional[str] = None

    class Config:
        orm_mode = True
        from_attributes = True


class AgentKnowledgeBaseBase(BaseModel):
    akb_agt_id: str
    akb_knb_id: str


class AgentKnowledgeBaseCreate(AgentKnowledgeBaseBase):
    pass


class AgentKnowledgeBaseResponse(AgentKnowledgeBaseBase):
    created_by: Optional[str] = None
    creation_dt: Optional[str] = None
    last_updated_by: Optional[str] = None
    last_updated_dt: Optional[str] = None

    class Config:
        orm_mode = True
        from_attributes = True


# Knowledge Base Schemas
class KnowledgeBaseBase(BaseModel):
    knb_name: str
    knb_description: Optional[str] = None


class KnowledgeBaseCreate(KnowledgeBaseBase):
    knb_id: str


class KnowledgeBaseUpdate(BaseModel):
    knb_name: Optional[str] = None
    knb_description: Optional[str] = None


class KnowledgeBaseResponse(KnowledgeBaseBase):
    knb_id: str
    created_by: Optional[str] = None
    creation_dt: Optional[str] = None
    last_updated_by: Optional[str] = None
    last_updated_dt: Optional[str] = None

    class Config:
        orm_mode = True
        from_attributes = True


class KnowledgeBaseDocumentCreate(BaseModel):
    kbd_knb_id: str
    kbd_fls_id: str


class KnowledgeBaseDocumentResponse(BaseModel):
    kbd_knb_id: str
    kbd_fls_id: str
    created_by: Optional[str] = None
    creation_dt: Optional[str] = None
    last_updated_by: Optional[str] = None
    last_updated_dt: Optional[str] = None

    class Config:
        orm_mode = True
        from_attributes = True


# Tool Schemas
class ToolBase(BaseModel):
    tol_name: str
    tol_description: Optional[str] = None
    tol_mcp_command: str


class ToolCreate(ToolBase):
    tol_id: str


class ToolUpdate(BaseModel):
    tol_name: Optional[str] = None
    tol_description: Optional[str] = None
    tol_mcp_command: Optional[str] = None


class ToolResponse(ToolBase):
    tol_id: str
    created_by: Optional[str] = None
    creation_dt: Optional[str] = None
    last_updated_by: Optional[str] = None
    last_updated_dt: Optional[str] = None

    class Config:
        orm_mode = True
        from_attributes = True


class ToolEnvironmentVariableBase(BaseModel):
    tev_key: str
    tev_value: Optional[str] = None


class ToolEnvironmentVariableCreate(ToolEnvironmentVariableBase):
    tev_tol_id: str


class ToolEnvironmentVariableResponse(ToolEnvironmentVariableBase):
    tev_tol_id: str
    created_by: Optional[str] = None
    creation_dt: Optional[str] = None
    last_updated_by: Optional[str] = None
    last_updated_dt: Optional[str] = None

    class Config:
        orm_mode = True
        from_attributes = True


# Lookup Type Schemas
class LookupTypeBase(BaseModel):
    lkt_type: str
    lkt_description: Optional[str] = None


class LookupTypeCreate(LookupTypeBase):
    pass


class LookupTypeUpdate(BaseModel):
    lkt_description: Optional[str] = None


class LookupTypeResponse(LookupTypeBase):
    created_by: Optional[str] = None
    creation_dt: Optional[str] = None
    last_updated_by: Optional[str] = None
    last_updated_dt: Optional[str] = None

    class Config:
        orm_mode = True
        from_attributes = True


# Lookup Detail Schemas
class LookupDetailBase(BaseModel):
    lkd_code: str
    lkd_description: Optional[str] = None
    lkd_sub_code: Optional[str] = None
    lkd_sort: Optional[int] = None


class LookupDetailCreate(LookupDetailBase):
    lkd_lkt_type: str


class LookupDetailUpdate(BaseModel):
    lkd_description: Optional[str] = None
    lkd_sub_code: Optional[str] = None
    lkd_sort: Optional[int] = None


class LookupDetailResponse(LookupDetailBase):
    lkd_lkt_type: str
    created_by: Optional[str] = None
    creation_dt: Optional[str] = None
    last_updated_by: Optional[str] = None
    last_updated_dt: Optional[str] = None

    class Config:
        orm_mode = True
        from_attributes = True
