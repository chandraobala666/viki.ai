--  Table to store Lookup Types
CREATE TABLE lookup_types (
    lkt_type VARCHAR(80) UNIQUE NOT NULL,
    lkt_description VARCHAR(240),
    created_by VARCHAR(80),
    last_updated_by VARCHAR(80),
    creation_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    UNIQUE (lkd_lkt_type, lkd_code)
);

-- Table for storing files
CREATE TABLE file_store (
    fls_id VARCHAR(80) UNIQUE NOT NULL,
    fls_source_type_cd VARCHAR(80) NOT NULL,
    fls_source_id VARCHAR(80) NOT NULL,
    fls_file_name VARCHAR(240) NOT NULL,
    fls_file_content BLOB NOT NULL,
    created_by VARCHAR(80),
    last_updated_by VARCHAR(80),
    creation_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table creation for LLM Configuration
CREATE TABLE llm_config (
    llc_id VARCHAR(80) UNIQUE NOT NULL,
    llc_provider_type_cd VARCHAR(80) NOT NULL,
    llc_model_cd VARCHAR(240) NOT NULL,
    llc_endpoint_url VARCHAR(4000),
    llc_api_key VARCHAR(240),
    llc_fls_id VARCHAR(80),
    created_by VARCHAR(80),
    last_updated_by VARCHAR(80),
    creation_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table creation for Tool Configuration
CREATE TABLE tools (
    tol_id VARCHAR(80) UNIQUE NOT NULL,
    tol_name VARCHAR(240) NOT NULL,
    tol_description VARCHAR(4000),
    tol_mcp_command VARCHAR(240) NOT NULL,
    created_by VARCHAR(80),
    last_updated_by VARCHAR(80),
    creation_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    UNIQUE (tev_tol_id, tev_key)
);

-- Table creation for Knowledge Base
CREATE TABLE knowledge_base_details (
    knb_id VARCHAR(80) UNIQUE NOT NULL,
    knb_name VARCHAR(240) NOT NULL,
    knb_description VARCHAR(4000),
    created_by VARCHAR(80),
    last_updated_by VARCHAR(80),
    creation_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for Knowledge Base Documents
CREATE TABLE knowledge_base_documents (
    kbd_knb_id VARCHAR(80) NOT NULL,
    kbd_fls_id VARCHAR(80) NOT NULL,
    created_by VARCHAR(80),
    last_updated_by VARCHAR(80),
    creation_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (kbd_knb_id, kbd_fls_id)
);

-- Table creation for Agents
CREATE TABLE agents (
    agt_id VARCHAR(80) UNIQUE NOT NULL,
    agt_name VARCHAR(240) NOT NULL,
    agt_description VARCHAR(4000),
    agt_llc_id VARCHAR(80) NOT NULL,
    agt_system_prompt VARCHAR(4000),
    created_by VARCHAR(80),
    last_updated_by VARCHAR(80),
    creation_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table creation for Agent Tools (for associating tools with agents)
CREATE TABLE agent_tools (
    ato_agt_id VARCHAR(80) NOT NULL,
    ato_tol_id VARCHAR(80) NOT NULL,
    created_by VARCHAR(80),
    last_updated_by VARCHAR(80),
    creation_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (ato_agt_id, ato_tol_id)
);

-- Table creation for Agent Knowledge Bases (for associating knowledge bases with agents)
CREATE TABLE agent_knowledge_bases (
    akb_agt_id VARCHAR(80) NOT NULL,
    akb_knb_id VARCHAR(80) NOT NULL,
    created_by VARCHAR(80),
    last_updated_by VARCHAR(80),
    creation_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (akb_agt_id, akb_knb_id)
);
