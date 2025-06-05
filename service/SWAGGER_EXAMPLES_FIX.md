# Swagger Examples Fix Summary

## Problem
The Swagger documentation for the VIKI AI REST API was showing database field aliases (like `llc_id`, `llc_provider_type_cd`, etc.) in the request examples instead of the user-friendly field names (like `id`, `providerTypeCode`, etc.) that should actually be used in POST and PUT requests.

## Solution
Added `json_schema_extra` configuration with proper examples to all Pydantic schema classes used for POST and PUT requests. This ensures that the Swagger documentation displays the correct field names that users should use when making API requests.

## Changes Made

### Updated Schema Classes with Examples:

1. **LLMConfigCreate** - Added example with correct field names:
   ```json
   {
     "id": "llm-01",
     "providerTypeCode": "OPENAI",
     "modelCode": "gpt-4",
     "endpointUrl": "https://api.openai.com/v1",
     "apiKey": "your-api-key-here",
     "fileStore": null
   }
   ```

2. **LLMConfigUpdate** - Added example for PUT requests:
   ```json
   {
     "providerTypeCode": "ANTHROPIC",
     "modelCode": "claude-3-opus",
     "endpointUrl": "https://api.anthropic.com/v1",
     "apiKey": "your-updated-api-key-here",
     "fileStore": null
   }
   ```

3. **AgentCreate** - Added example:
   ```json
   {
     "id": "agent-01",
     "name": "Support Assistant",
     "description": "Agent for handling customer support queries",
     "llmConfig": "llm-01",
     "systemPrompt": "You are a helpful customer support assistant."
   }
   ```

4. **AgentUpdate** - Added example for PUT requests
5. **AgentToolCreate** - Added example for agent-tool relationships
6. **AgentKnowledgeBaseCreate** - Added example for agent-knowledge base relationships
7. **KnowledgeBaseCreate** - Added example for knowledge bases
8. **KnowledgeBaseUpdate** - Added example for PUT requests
9. **KnowledgeBaseDocumentCreate** - Added example for knowledge base documents
10. **ToolCreate** - Added example for tools
11. **ToolUpdate** - Added example for PUT requests
12. **ToolEnvironmentVariableBase** - Added example for environment variables
13. **ToolEnvironmentVariableCreate** - Added example for creating environment variables
14. **LookupTypeCreate** - Added example for lookup types
15. **LookupTypeUpdate** - Added example for PUT requests
16. **LookupDetailCreate** - Added example for lookup details
17. **LookupDetailUpdate** - Added example for PUT requests

## Impact
- ✅ Swagger documentation now shows correct field names in examples
- ✅ API users can copy examples directly from Swagger docs
- ✅ Reduced confusion between database field names and API field names
- ✅ Consistent with the seed_data.rest file examples
- ✅ Better developer experience when using the API

## Files Modified
- `/Users/rahgadda/rahul/DEV/viki/service/viki_ai/lib/router/schemas.py`

## Verification
- API server starts successfully without errors
- Swagger documentation accessible at `http://localhost:8080/api/0.1.0/docs`
- Health endpoint responds correctly
- All schema examples show user-friendly field names instead of database aliases

## Next Steps
Users can now:
1. Open the Swagger documentation
2. View any POST or PUT endpoint
3. See examples with correct field names
4. Copy and use the examples directly in their API requests
