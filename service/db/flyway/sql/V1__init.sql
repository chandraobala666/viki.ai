--  Table to store Lookup Types
CREATE TABLE lookup_types (
    lkt_type VARCHAR(80) NOT NULL,
    lkt_description VARCHAR(240),
    created_by VARCHAR(80),
    last_updated_by VARCHAR(80),
    creation_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (lkt_type)
);

-- Table to store Lookup Details
CREATE TABLE lookup_details (
    lkd_lkt_type VARCHAR(80) NOT NULL,
    lkd_code VARCHAR(80) NOT NULL,
    lkd_description VARCHAR(240),
    lkd_sub_code VARCHAR(80),
    lkd_sort INTEGER,
    created_by VARCHAR(80),
    last_updated_by VARCHAR(80),
    creation_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (lkd_lkt_type, lkd_code),
    FOREIGN KEY (lkd_lkt_type) REFERENCES lookup_types(lkt_type) ON DELETE CASCADE
);

-- Table for storing files
CREATE TABLE file_store (
    fls_id VARCHAR(80) NOT NULL,
    fls_source_type_cd VARCHAR(80) NOT NULL,
    fls_source_id VARCHAR(80) NOT NULL,
    fls_file_name VARCHAR(240) NOT NULL,
    fls_file_content BLOB NOT NULL,
    created_by VARCHAR(80),
    last_updated_by VARCHAR(80),
    creation_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (fls_id)
);

-- Table creation for LLM Configuration
CREATE TABLE llm_config (
    llc_id VARCHAR(80) NOT NULL,
    llc_provider_type_cd VARCHAR(80) NOT NULL,
    llc_model_cd VARCHAR(240) NOT NULL,
    llc_endpoint_url VARCHAR(4000),
    llc_api_key VARCHAR(240),
    llc_fls_id VARCHAR(80),
    created_by VARCHAR(80),
    last_updated_by VARCHAR(80),
    creation_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (llc_id),
    FOREIGN KEY (llc_fls_id) REFERENCES file_store(fls_id) ON DELETE SET NULL
);

-- Table creation for Tool Configuration
CREATE TABLE tools (
    tol_id VARCHAR(80) NOT NULL,
    tol_name VARCHAR(240) NOT NULL,
    tol_description VARCHAR(4000),
    tol_mcp_command VARCHAR(240) NOT NULL,
    tol_mcp_function_count INTEGER DEFAULT 0,
    created_by VARCHAR(80),
    last_updated_by VARCHAR(80),
    creation_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tol_id)
);

-- Table creation for Tool Environment Variables
CREATE TABLE tool_environment_variables (
    tev_tol_id VARCHAR(80) NOT NULL,
    tev_key VARCHAR(240) NOT NULL,
    tev_value VARCHAR(4000),
    created_by VARCHAR(80),
    last_updated_by VARCHAR(80),
    creation_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tev_tol_id, tev_key),
    FOREIGN KEY (tev_tol_id) REFERENCES tools(tol_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tool_resources (
    tre_tol_id VARCHAR(80) NOT NULL,
    tre_resource_name VARCHAR(240) NOT NULL,
    tre_resource_description VARCHAR(4000),
    created_by VARCHAR(80),
    last_updated_by VARCHAR(80),
    creation_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tre_tol_id, tre_resource_name),
    FOREIGN KEY (tre_tol_id) REFERENCES tools(tol_id) ON DELETE CASCADE
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_tool_resources_tool ON tool_resources(tre_tol_id);

-- Table creation for Knowledge Base
CREATE TABLE knowledge_base_details (
    knb_id VARCHAR(80) NOT NULL,
    knb_name VARCHAR(240) NOT NULL,
    knb_description VARCHAR(4000),
    created_by VARCHAR(80),
    last_updated_by VARCHAR(80),
    creation_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (knb_id)
);

-- Table for Knowledge Base Documents
CREATE TABLE knowledge_base_documents (
    kbd_knb_id VARCHAR(80) NOT NULL,
    kbd_fls_id VARCHAR(80) NOT NULL,
    created_by VARCHAR(80),
    last_updated_by VARCHAR(80),
    creation_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (kbd_knb_id, kbd_fls_id),
    FOREIGN KEY (kbd_knb_id) REFERENCES knowledge_base_details(knb_id) ON DELETE CASCADE,
    FOREIGN KEY (kbd_fls_id) REFERENCES file_store(fls_id) ON DELETE CASCADE
);

-- Table creation for Agents
CREATE TABLE agents (
    agt_id VARCHAR(80) NOT NULL,
    agt_name VARCHAR(240) NOT NULL,
    agt_description VARCHAR(4000),
    agt_llc_id VARCHAR(80) NOT NULL,
    agt_system_prompt VARCHAR(4000),
    created_by VARCHAR(80),
    last_updated_by VARCHAR(80),
    creation_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (agt_id),
    FOREIGN KEY (agt_llc_id) REFERENCES llm_config(llc_id) ON DELETE CASCADE
);

-- Table creation for Agent Tools (for associating tools with agents)
CREATE TABLE agent_tools (
    ato_agt_id VARCHAR(80) NOT NULL,
    ato_tol_id VARCHAR(80) NOT NULL,
    created_by VARCHAR(80),
    last_updated_by VARCHAR(80),
    creation_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (ato_agt_id, ato_tol_id),
    FOREIGN KEY (ato_agt_id) REFERENCES agents(agt_id) ON DELETE CASCADE,
    FOREIGN KEY (ato_tol_id) REFERENCES tools(tol_id) ON DELETE CASCADE
);

-- Table creation for Agent Knowledge Bases (for associating knowledge bases with agents)
CREATE TABLE agent_knowledge_bases (
    akb_agt_id VARCHAR(80) NOT NULL,
    akb_knb_id VARCHAR(80) NOT NULL,
    created_by VARCHAR(80),
    last_updated_by VARCHAR(80),
    creation_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (akb_agt_id, akb_knb_id),
    FOREIGN KEY (akb_agt_id) REFERENCES agents(agt_id) ON DELETE CASCADE,
    FOREIGN KEY (akb_knb_id) REFERENCES knowledge_base_details(knb_id) ON DELETE CASCADE
);

-- Table creation for Chat Sessions
CREATE TABLE chat_sessions (
    cht_id VARCHAR(80) NOT NULL,
    cht_name VARCHAR(240) NOT NULL,
    cht_description VARCHAR(4000),
    cht_agt_id VARCHAR(80) NOT NULL,
    created_by VARCHAR(80),
    last_updated_by VARCHAR(80),
    creation_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (cht_id),
    FOREIGN KEY (cht_agt_id) REFERENCES agents(agt_id) ON DELETE CASCADE
);

-- Table creation for Chat Messages
CREATE TABLE chat_messages (
    msg_id VARCHAR(80) NOT NULL,
    msg_cht_id VARCHAR(80) NOT NULL,
    msg_agent_name VARCHAR(240) NOT NULL,
    msg_content JSON NOT NULL,
    created_by VARCHAR(80),
    last_updated_by VARCHAR(80),
    creation_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (msg_id),
    FOREIGN KEY (msg_cht_id) REFERENCES chat_sessions(cht_id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX idx_lookup_details_type ON lookup_details(lkd_lkt_type);
CREATE INDEX idx_llm_config_file ON llm_config(llc_fls_id);
CREATE INDEX idx_tool_env_vars_tool ON tool_environment_variables(tev_tol_id);
CREATE INDEX idx_tool_resources_tool ON tool_resources(tre_tol_id);
CREATE INDEX idx_knowledge_base_docs_knb ON knowledge_base_documents(kbd_knb_id);
CREATE INDEX idx_knowledge_base_docs_fls ON knowledge_base_documents(kbd_fls_id);
CREATE INDEX idx_agents_llm ON agents(agt_llc_id);
CREATE INDEX idx_agent_tools_agent ON agent_tools(ato_agt_id);
CREATE INDEX idx_agent_tools_tool ON agent_tools(ato_tol_id);
CREATE INDEX idx_agent_kb_agent ON agent_knowledge_bases(akb_agt_id);
CREATE INDEX idx_agent_kb_knb ON agent_knowledge_bases(akb_knb_id);
CREATE INDEX idx_chat_sessions_agent ON chat_sessions(cht_agt_id);
CREATE INDEX idx_chat_messages_session ON chat_messages(msg_cht_id);