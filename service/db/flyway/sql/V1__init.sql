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
    created_by VARCHAR(80),
    last_updated_by VARCHAR(80),
    creation_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);