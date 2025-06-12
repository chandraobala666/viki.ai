import asyncio
import logging
import os
from typing import Dict, List, Optional, Any, Union
from datetime import datetime
from contextlib import asynccontextmanager

from pydantic import Field, SecretStr

from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI
from langchain_huggingface import ChatHuggingFace, HuggingFaceEndpoint
from langchain_groq import ChatGroq
from langchain_azure_ai.chat_models import AzureAIChatCompletionsModel
from langchain_cerebras import ChatCerebras

from mcp.client.stdio import stdio_client
from mcp import ClientSession, StdioServerParameters

from langchain_mcp_adapters.tools import load_mcp_tools
from langgraph.prebuilt import create_react_agent

# Import MCP test utility
from .mcp_test_util import test_mcp_configuration, test_mcp_configuration_sync


class AIChatUtility:
    """
    A utility class for generating AI responses in chat sessions using LangChain and MCP tools.
    
    This class encapsulates the functionality for:
    - LLM configuration and management
    - MCP tools integration
    - Chat session management
    - Message history tracking
    """
    
    def __init__(self, 
                 llm_provider: str = "ollama",
                 model_name: str = "qwen3:32b",
                 api_key: Optional[str] = None,
                 base_url: Optional[str] = None,
                 temperature: float = 0.0,
                 system_prompt: Optional[str] = None,
                 mcp_server_config: Optional[Dict[str, Any]] = None,
                 agent_mcp_configs: Optional[List[Dict[str, Any]]] = None):
        """
        Initialize the AI Chat Utility.
        
        Args:
            llm_provider: The LLM provider to use ('ollama', 'openai', 'groq', 'azure', 'huggingface', 'openrouter')
            model_name: The model name to use
            api_key: API key for the provider (if required)
            base_url: Base URL for the provider (if required)
            temperature: Temperature setting for the model
            system_prompt: Custom system prompt for the chat session
            mcp_server_config: Configuration dictionary for MCP server parameters (legacy, deprecated)
            agent_mcp_configs: List of agent-specific MCP configurations for individual tools
        """
        self.llm_provider = llm_provider.lower()
        self.model_name = model_name
        self.api_key = api_key
        self.base_url = base_url
        self.temperature = temperature
        
        # Setup logging first
        self.logger = logging.getLogger(__name__)
        
        # Handle both legacy single MCP config and new agent-specific multiple configs
        if agent_mcp_configs:
            # Use agent-specific configurations (preferred approach)
            self.agent_mcp_configs = agent_mcp_configs
            self.mcp_server_config = None  # Deprecate the single config
            self.logger.info(f"Using agent-specific MCP configurations: {len(agent_mcp_configs)} tools")
        else:
            # Fall back to legacy single MCP configuration for backward compatibility
            self.agent_mcp_configs = []
            self.mcp_server_config = mcp_server_config 
            self.logger.info("Using legacy single MCP configuration")
        
        # Default system prompt for OFSLL application
        self.system_prompt = system_prompt or (
            "You are a helpful assistant specialized in querying and updating OFSLL application using API. "
            "Don't hallucinate or make up answers. "
            "If you cannot answer the question, say 'I don't know'. "
            "Use the tools provided to answer the user's questions. "
            "For tool calls, don't make up input parameters, use the input parameters as is. "
            "If you are not sure about the input parameters, then use default values."
        )
        
        # Initialize session variables
        self.model = None
        self.tools = None
        self.agent = None
        self.session_id = None
        self.message_history: List[Dict[str, Any]] = []
        
    def configure_llm(self) -> Any:
        """
        Configure and return the LLM model based on the provider.
        
        Returns:
            Configured LLM model instance
            
        Raises:
            ValueError: If unsupported provider or missing required parameters
        """
        self.logger.info(f"Configuring LLM model: {self.llm_provider}")
        
        try:
            if self.llm_provider == "ollama":
                self.model = ChatOllama(
                    model=self.model_name,
                    temperature=self.temperature
                )
                
            elif self.llm_provider == "openai":
                if not self.api_key:
                    raise ValueError("API key is required for OpenAI")
                self.model = ChatOpenAI(
                    model=self.model_name,
                    api_key=SecretStr(self.api_key),
                    temperature=self.temperature
                )
                
            elif self.llm_provider == "groq":
                if not self.api_key:
                    raise ValueError("API key is required for Groq")
                self.model = ChatGroq(
                    model=self.model_name,
                    api_key=SecretStr(self.api_key),
                    temperature=self.temperature
                )
                
            elif self.llm_provider == "azure":
                if not self.api_key:
                    raise ValueError("API key is required for Azure AI")
                os.environ["AZURE_INFERENCE_CREDENTIAL"] = self.api_key
                self.model = AzureAIChatCompletionsModel(
                    model=self.model_name,
                    endpoint=self.base_url or "https://models.github.ai/inference"
                )

            elif self.llm_provider == "huggingface":
                if not self.api_key:
                    raise ValueError("API key is required for HuggingFace")
                if not self.model_name:
                    raise ValueError("Model name is required for HuggingFace")

                # os.environ["HUGGINGFACEHUB_API_TOKEN"] = self.api_key
                llm = HuggingFaceEndpoint(
                        huggingfacehub_api_token=self.api_key,
                        repo_id=self.model_name,
                        task="text-generation"
                    )  # type: ignore
                self.model = ChatHuggingFace(llm=llm)

            elif self.llm_provider == "cerebras":
                if not self.api_key:
                    raise ValueError("API key is required for Cerebras")
                if not self.model_name:
                    raise ValueError("Model name is required for Cerebras")

                self.model = ChatCerebras(
                    model=self.model_name,
                    api_key=SecretStr(self.api_key),
                    temperature=self.temperature
                )

            elif self.llm_provider == "openrouter":
                if not self.api_key:
                    raise ValueError("API key is required for OpenRouter")
                if not self.model_name:
                    raise ValueError("Model name is required for OpenRouter")
            
                # Custom OpenRouter implementation
                self.model = ChatOpenAI(
                    model=self.model_name,
                    api_key=SecretStr(self.api_key),
                    temperature=self.temperature,
                    base_url="https://openrouter.ai/api/v1"
                )
                
            else:
                raise ValueError(f"Unsupported LLM provider: {self.llm_provider}")
                
            self.logger.info(f"LLM model configured successfully: {type(self.model).__name__}")
            return self.model
            
        except Exception as e:
            self.logger.error(f"Error configuring LLM: {str(e)}")
            raise
    
    def get_server_params(self, server_config: Optional[Dict[str, Any]] = None) -> StdioServerParameters:
        """
        Configure and return MCP server parameters using mcp_test_util structure.
        
        Args:
            server_config: Optional server configuration to override the default config.
                          Should contain 'mcp_command' and 'env' keys.
        
        Returns:
            StdioServerParameters: Configured server parameters for MCP
        """
        # Use provided config or fall back to instance config (legacy support)
        config = server_config or self.mcp_server_config
        
        if not config:
            raise ValueError("No MCP server configuration available")
        
        # Handle both old format (command, args, env) and new format (mcp_command, env)
        if "mcp_command" in config:
            # New format compatible with mcp_test_util
            mcp_command = config.get("mcp_command", "uv run openapi_mcp_server")
            command_parts = mcp_command.strip().split()
            command = command_parts[0]
            args = command_parts[1:] if len(command_parts) > 1 else []
        else:
            # Legacy format
            command = config.get("command", "uv")
            args = config.get("args", ["run", "openapi_mcp_server"])
        
        return StdioServerParameters(
            command=command,
            args=args,
            env=config.get("env", {})
        )
    
    async def test_mcp_configuration(self, server_config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Test MCP configuration using mcp_test_util.
        
        Args:
            server_config: Optional server configuration to test.
                          Should contain 'mcp_command' and 'env' keys.
        
        Returns:
            Dict containing test results with 'success', 'function_count', 'error_message', and 'functions' keys
        """
        try:
            # Use provided config or fall back to instance config
            config = server_config or self.mcp_server_config
            
            if not config:
                return {
                    "success": False,
                    "function_count": 0,
                    "error_message": "No MCP configuration available",
                    "functions": None
                }
            
            # Extract mcp_command and environment variables
            if "mcp_command" in config:
                mcp_command = config["mcp_command"]
            else:
                # Construct command from legacy format
                command = config.get("command", "uv")
                args = config.get("args", ["run", "openapi_mcp_server"])
                mcp_command = f"{command} {' '.join(args)}"
            
            env_vars = config.get("env", {})
            
            # Test using mcp_test_util
            success, function_count, error_message, functions = await test_mcp_configuration(mcp_command, env_vars)
            
            self.logger.info(f"MCP configuration test result: success={success}, function_count={function_count}")
            
            return {
                "success": success,
                "function_count": function_count,
                "error_message": error_message,
                "functions": functions
            }
            
        except Exception as e:
            error_msg = f"Error testing MCP configuration: {str(e)}"
            self.logger.error(error_msg)
            return {
                "success": False,
                "function_count": 0,
                "error_message": error_msg,
                "functions": None
            }
    
    def test_mcp_configuration_sync(self, server_config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Synchronous version of test_mcp_configuration.
        
        Args:
            server_config: Optional server configuration to test.
        
        Returns:
            Dict containing test results
        """
        try:
            # Use provided config or fall back to instance config
            config = server_config or self.mcp_server_config
            
            if not config:
                return {
                    "success": False,
                    "function_count": 0,
                    "error_message": "No MCP configuration available",
                    "functions": None
                }
            
            # Extract mcp_command and environment variables
            if "mcp_command" in config:
                mcp_command = config["mcp_command"]
            else:
                # Construct command from legacy format
                command = config.get("command", "uv")
                args = config.get("args", ["run", "openapi_mcp_server"])
                mcp_command = f"{command} {' '.join(args)}"
            
            env_vars = config.get("env", {})
            
            # Test using mcp_test_util synchronous function
            try:
                # Check if we're already in an event loop
                import asyncio
                try:
                    loop = asyncio.get_running_loop()
                    # We're in an event loop, create a new thread to run the sync function
                    import concurrent.futures
                    with concurrent.futures.ThreadPoolExecutor() as executor:
                        future = executor.submit(test_mcp_configuration_sync, mcp_command, env_vars)
                        success, function_count, error_message, functions = future.result()
                except RuntimeError:
                    # No event loop running, safe to use the sync function directly
                    success, function_count, error_message, functions = test_mcp_configuration_sync(mcp_command, env_vars)
            except ImportError:
                # Fallback if concurrent.futures is not available
                success, function_count, error_message, functions = test_mcp_configuration_sync(mcp_command, env_vars)
            
            self.logger.info(f"MCP configuration test result: success={success}, function_count={function_count}")
            
            return {
                "success": success,
                "function_count": function_count,
                "error_message": error_message,
                "functions": functions
            }
            
        except Exception as e:
            error_msg = f"Error testing MCP configuration: {str(e)}"
            self.logger.error(error_msg)
            return {
                "success": False,
                "function_count": 0,
                "error_message": error_msg,
                "functions": None
            }

    async def load_mcp_tools(self, session: ClientSession) -> List[Any]:
        """
        Load MCP tools using an existing session.
        
        Args:
            session: Active MCP ClientSession
            
        Returns:
            List of loaded MCP tools
        """
        try:
            tools = await load_mcp_tools(session)
            self.tools = tools
            
            self.logger.info(f"Successfully loaded {len(tools)} MCP tools")
            for i, tool in enumerate(tools, 1):
                tool_name = getattr(tool, 'name', 'Unknown')
                tool_description = getattr(tool, 'description', 'No description available')
                self.logger.debug(f"{i}. {tool_name}: {tool_description}")
            
            return tools
            
        except Exception as e:
            self.logger.error(f"Error loading MCP tools: {str(e)}")
            raise
    
    async def load_agent_specific_tools(self) -> List[Any]:
        """
        Load MCP tools from agent-specific configurations.
        Each tool gets its own MCP server connection.
        
        Returns:
            List of loaded MCP tools from all agent-specific configurations
        """
        if not self.agent_mcp_configs:
            self.logger.info("No agent-specific MCP configurations, falling back to legacy approach")
            return []
        
        all_tools = []
        successful_tools = []
        failed_tools = []
        
        self.logger.info(f"Starting to load tools from {len(self.agent_mcp_configs)} agent-specific MCP configurations")
        
        for i, config in enumerate(self.agent_mcp_configs, 1):
            tool_name = config.get("tool_name", "Unknown")
            tool_id = config.get("tool_id", "unknown")
            
            try:
                self.logger.info(f"[{i}/{len(self.agent_mcp_configs)}] Loading tools for '{tool_name}' (ID: {tool_id})")
                
                # Create server parameters for this specific tool
                server_params = self.get_server_params(config)
                self.logger.debug(f"Created server params for {tool_name}: command={server_params.command}, args={server_params.args}")
                
                # Create MCP connection for this tool
                async with stdio_client(server_params) as (read, write):  # type: ignore
                    async with ClientSession(read, write) as session:
                        await session.initialize()
                        self.logger.debug(f"MCP connection initialized for tool {tool_name}")
                        
                        # Load MCP tools for this specific configuration
                        tools = await load_mcp_tools(session)
                        all_tools.extend(tools)
                        
                        tool_names = [getattr(tool, 'name', 'Unknown') for tool in tools]
                        self.logger.info(f"✓ Loaded {len(tools)} tools from '{tool_name}': {tool_names}")
                        successful_tools.append({
                            "tool_id": tool_id,
                            "tool_name": tool_name,
                            "loaded_count": len(tools),
                            "tool_names": tool_names
                        })
                        
            except Exception as e:
                error_msg = f"Error loading tools for '{tool_name}' (ID: {tool_id}): {str(e)}"
                self.logger.error(f"❌ {error_msg}")
                failed_tools.append({
                    "tool_id": tool_id,
                    "tool_name": tool_name,
                    "error": str(e)
                })
                # Continue with other tools instead of failing completely
                continue
        
        # Log summary
        total_tools = len(all_tools)
        successful_count = len(successful_tools)
        failed_count = len(failed_tools)
        
        if successful_count > 0:
            self.logger.info(f"✓ Successfully loaded {total_tools} tools from {successful_count}/{len(self.agent_mcp_configs)} MCP configurations")
            for success in successful_tools:
                self.logger.debug(f"  - {success['tool_name']}: {success['loaded_count']} tools")
        
        if failed_count > 0:
            self.logger.warning(f"❌ Failed to load tools from {failed_count}/{len(self.agent_mcp_configs)} MCP configurations")
            for failure in failed_tools:
                self.logger.warning(f"  - {failure['tool_name']}: {failure['error']}")
        
        if total_tools == 0:
            self.logger.warning("No tools were successfully loaded from any MCP configuration")
        
        return all_tools

    async def load_agent_specific_tools_with_persistent_connections(self, langchain_messages) -> Optional[Dict[str, Any]]:
        """
        Load MCP tools from agent-specific configurations and execute agent with persistent connections.
        This method maintains MCP connections throughout the entire agent execution to prevent ClosedResourceError.
        
        Args:
            langchain_messages: The messages to pass to the agent
            
        Returns:
            Agent response dict or None if no tools could be loaded
        """
        if not self.agent_mcp_configs:
            self.logger.info("No agent-specific MCP configurations available")
            return None
        
        # For agent-specific configurations, we need to create multiple connection contexts
        # and maintain them throughout the agent execution
        self.logger.info(f"Creating persistent connections for {len(self.agent_mcp_configs)} MCP configurations")
        
        # We'll maintain all connections in a list of context managers
        connection_contexts = []
        all_tools = []
        
        try:
            # Create all connection contexts
            for i, config in enumerate(self.agent_mcp_configs, 1):
                tool_name = config.get("tool_name", "Unknown")
                tool_id = config.get("tool_id", "unknown")
                
                try:
                    self.logger.info(f"[{i}/{len(self.agent_mcp_configs)}] Creating persistent connection for '{tool_name}' (ID: {tool_id})")
                    
                    # Create server parameters for this specific tool
                    server_params = self.get_server_params(config)
                    self.logger.debug(f"Created server params for {tool_name}: command={server_params.command}, args={server_params.args}")
                    
                    # Store connection context info for later use
                    connection_contexts.append({
                        'tool_name': tool_name,
                        'tool_id': tool_id,
                        'server_params': server_params,
                        'config': config
                    })
                    
                except Exception as e:
                    error_msg = f"Error creating connection context for '{tool_name}' (ID: {tool_id}): {str(e)}"
                    self.logger.error(f"❌ {error_msg}")
                    continue
            
            if not connection_contexts:
                self.logger.warning("No valid connection contexts created")
                return None
            
            # Create nested async context managers for all connections
            # This is the key fix: maintain all connections throughout agent execution
            async def create_nested_connections(contexts, index=0):
                if index >= len(contexts):
                    # Base case: all connections established, load tools and run agent
                    self.logger.info(f"All {len(contexts)} MCP connections established")
                    
                    # Ensure model is configured
                    if not self.model:
                        raise ValueError("Model not properly initialized")
                    
                    if not all_tools:
                        self.logger.warning("No tools loaded from any connection")
                        return None
                    
                    tool_names = [getattr(tool, 'name', 'Unknown') for tool in all_tools]
                    self.logger.info(f"🛠️ Agent loaded with {len(all_tools)} tools: {tool_names}")
                    
                    # Create REACT agent with all tools
                    agent = create_react_agent(self.model, all_tools)
                    self.logger.info("🤖 REACT agent created with persistent connection tools")
                    
                    # Run the agent with messages while connections are maintained
                    agent_response = await agent.ainvoke({"messages": langchain_messages})
                    self.logger.info("✅ Agent executed successfully with persistent connections")
                    
                    return agent_response
                
                # Recursive case: establish connection for current context
                ctx = contexts[index]
                try:
                    async with stdio_client(ctx['server_params']) as (read, write):  # type: ignore
                        async with ClientSession(read, write) as session:
                            await session.initialize()
                            self.logger.debug(f"Connection established for {ctx['tool_name']}")
                            
                            # Load tools for this connection
                            tools = await load_mcp_tools(session)
                            all_tools.extend(tools)
                            
                            tool_names = [getattr(tool, 'name', 'Unknown') for tool in tools]
                            self.logger.info(f"✓ Loaded {len(tools)} tools from '{ctx['tool_name']}': {tool_names}")
                            
                            # Recursively establish remaining connections
                            return await create_nested_connections(contexts, index + 1)
                            
                except Exception as e:
                    error_msg = f"Error in persistent connection for '{ctx['tool_name']}': {str(e)}"
                    self.logger.error(f"❌ {error_msg}")
                    # Continue with remaining connections
                    return await create_nested_connections(contexts, index + 1)
            
            # Execute with nested connections
            agent_response = await create_nested_connections(connection_contexts)
            return agent_response
            
        except Exception as e:
            self.logger.error(f"Error in persistent connection management: {str(e)}")
            return None

    async def initialize_session(self, validate_mcp: bool = True) -> str:
        """
        Initialize a new chat session with LLM and MCP tools.
        
        Args:
            validate_mcp: Whether to validate MCP configuration before initialization
        
        Returns:
            str: Session ID for tracking the chat session
        """
        try:
            # Generate session ID
            self.session_id = f"chat_session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            
            # Validate MCP configuration if requested
            if validate_mcp:
                self.logger.info("Validating MCP configuration...")
                test_result = await self.test_mcp_configuration()
                if not test_result["success"]:
                    raise ValueError(f"MCP configuration validation failed: {test_result['error_message']}")
                self.logger.info(f"MCP configuration validated successfully. Found {test_result['function_count']} functions.")
            
            # Configure LLM
            if not self.model:
                self.configure_llm()
            
            # Initialize MCP connection and load tools
            server_params = self.get_server_params()
            
            # Use a simpler approach for MCP connection
            async with stdio_client(server_params) as (read, write):  # type: ignore
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    self.logger.info("MCP connection initialized")
                    
                    # Load MCP tools
                    await self.load_mcp_tools(session)
                    
                    # Create REACT agent
                    if self.model and self.tools:
                        self.agent = create_react_agent(self.model, self.tools)
                        self.logger.info("REACT agent created")
                    else:
                        raise ValueError("Model or tools not properly initialized")
            
            # Initialize message history with system prompt
            self.message_history = [
                {"role": "system", "content": self.system_prompt}
            ]
            
            self.logger.info(f"Chat session initialized: {self.session_id}")
            return self.session_id
            
        except Exception as e:
            self.logger.error(f"Error initializing session: {str(e)}")
            raise
    
    async def generate_response(self, user_message: str, include_history: bool = True) -> Dict[str, Any]:
        """
        Generate AI response for a user message in the chat session.
        
        Args:
            user_message: The user's input message
            include_history: Whether to include message history in the context
            
        Returns:
            Dict containing the AI response and metadata
        """
        try:
            # Configure LLM if not already configured
            if not self.model:
                self.configure_llm()
            
            # Generate session ID if not already set
            if not self.session_id:
                self.session_id = f"chat_session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            
            # Add user message to history
            user_msg = {"role": "user", "content": user_message}
            if include_history:
                self.message_history.append(user_msg)
            
            # Prepare messages for the agent (convert to langchain format)
            if include_history:
                # Convert history to langchain message format
                langchain_messages = []
                for msg in self.message_history:
                    if msg["role"] == "system":
                        from langchain_core.messages import SystemMessage
                        langchain_messages.append(SystemMessage(content=msg["content"]))
                    elif msg["role"] == "user":
                        from langchain_core.messages import HumanMessage
                        langchain_messages.append(HumanMessage(content=msg["content"]))
                    elif msg["role"] == "assistant":
                        from langchain_core.messages import AIMessage
                        langchain_messages.append(AIMessage(content=msg["content"]))
            else:
                from langchain_core.messages import SystemMessage, HumanMessage
                langchain_messages = [
                    SystemMessage(content=self.system_prompt),
                    HumanMessage(content=user_message)
                ]
            
            self.logger.info(f"Processing user query: {user_message}")
            
            # Check if we should use agent-specific MCP configurations, legacy approach, or no tools
            agent_response = None
            
            if self.agent_mcp_configs:
                # New approach: Load tools from multiple agent-specific MCP configurations
                # Maintain connections throughout agent execution to prevent ClosedResourceError
                self.logger.info(f"🔧 Using agent-specific MCP configurations: {len(self.agent_mcp_configs)} tool(s) assigned")
                
                # Load all tools while maintaining connections and execute agent
                agent_response = await self.load_agent_specific_tools_with_persistent_connections(langchain_messages)
                
                if agent_response:
                    self.logger.info("✅ Agent invoked successfully with persistent agent-specific tools")
                else:
                    self.logger.warning("⚠️ No response from agent-specific configurations - falling back to no-tools mode")
                    # Ensure model is configured
                    if not self.model:
                        raise ValueError("Model not properly initialized")
                    
                    # Create REACT agent with no tools (empty list)
                    agent = create_react_agent(self.model, [])
                    self.logger.info("🤖 REACT agent created without tools")
                    
                    # Run the agent with messages
                    agent_response = await agent.ainvoke({"messages": langchain_messages})
                    self.logger.info("✅ Agent invoked successfully without tools")
                
            elif self.mcp_server_config:
                # Legacy approach: Use single MCP server configuration
                self.logger.info("🔧 Using legacy single MCP server configuration")
                server_params = self.get_server_params()
                
                # Create a single async context that handles both connections
                async with stdio_client(server_params) as (read, write):  # type: ignore
                    async with ClientSession(read, write) as session:
                        await session.initialize()
                        self.logger.info("🔗 Legacy MCP connection initialized")
                        
                        # Load MCP tools
                        tools = await load_mcp_tools(session)
                        tool_names = [getattr(tool, 'name', 'Unknown') for tool in tools]
                        self.logger.info(f"🛠️ Loaded {len(tools)} legacy tools: {tool_names}")
                        
                        # Ensure model is configured
                        if not self.model:
                            raise ValueError("Model not properly initialized")
                        
                        # Create REACT agent
                        agent = create_react_agent(self.model, tools)
                        self.logger.info("🤖 REACT agent created with legacy tools")
                        
                        # Run the agent with messages
                        agent_response = await agent.ainvoke({"messages": langchain_messages})
                        self.logger.info("✅ Agent invoked successfully with legacy tools")
            
            else:
                # No tools approach: Agent runs without any MCP tools
                self.logger.info("🔧 No MCP configurations available - agent will run without tools")
                
                # Ensure model is configured
                if not self.model:
                    raise ValueError("Model not properly initialized")
                
                # Create REACT agent with no tools (empty list)
                agent = create_react_agent(self.model, [])
                self.logger.info("🤖 REACT agent created without tools")
                
                # Run the agent with messages
                agent_response = await agent.ainvoke({"messages": langchain_messages})
                self.logger.info("✅ Agent invoked successfully without tools")
            
            # Process agent response (same for both approaches)
            if not agent_response or "messages" not in agent_response:
                self.logger.error("Invalid agent response")
                return {
                    "success": False,
                    "error": "Invalid agent response",
                    "session_id": self.session_id
                }
            
            # Extract AI response from the last message
            ai_messages = agent_response["messages"]
            ai_response_content = ""
            
            # Get the last AI message content
            for msg in reversed(ai_messages):
                if hasattr(msg, 'content') and msg.content:
                    ai_response_content = msg.content
                    break
            
            # Add AI response to history if using history
            if include_history:
                ai_msg = {"role": "assistant", "content": ai_response_content}
                self.message_history.append(ai_msg)
            
            self.logger.info("AI response generated successfully")
            
            return {
                "success": True,
                "response": ai_response_content,
                "session_id": self.session_id,
                "message_count": len(self.message_history) if include_history else 2,
                "timestamp": datetime.now().isoformat()
            }
                    
        except Exception as e:
            self.logger.error(f"Error generating response: {str(e)}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "session_id": self.session_id or "unknown"
            }
    
    def get_message_history(self) -> List[Dict[str, Any]]:
        """
        Get the current message history for the session.
        
        Returns:
            List of message dictionaries
        """
        return self.message_history.copy()
    
    def clear_history(self) -> None:
        """Clear the message history but keep the system prompt."""
        self.message_history = [
            {"role": "system", "content": self.system_prompt}
        ]
        self.logger.info("Message history cleared")
    
    def get_available_mcp_functions(self) -> List[Dict[str, str]]:
        """
        Get list of available MCP functions using the test utility.
        
        Returns:
            List of function dictionaries with 'name', 'description', and 'type' keys
        """
        try:
            test_result = self.test_mcp_configuration_sync()
            if test_result["success"] and test_result["functions"]:
                return test_result["functions"]
            else:
                self.logger.warning(f"Failed to get MCP functions: {test_result.get('error_message', 'Unknown error')}")
                return []
        except Exception as e:
            self.logger.error(f"Error getting MCP functions: {str(e)}")
            return []

    def get_session_info(self) -> Dict[str, Any]:
        """
        Get information about the current session, including MCP function count from test utility.
        
        Returns:
            Dict containing session information
        """
        # Get MCP function count using test utility
        mcp_function_count = 0
        try:
            test_result = self.test_mcp_configuration_sync()
            if test_result["success"]:
                mcp_function_count = test_result["function_count"]
        except Exception as e:
            self.logger.warning(f"Could not get MCP function count: {str(e)}")
        
        return {
            "session_id": self.session_id,
            "llm_provider": self.llm_provider,
            "model_name": self.model_name,
            "message_count": len(self.message_history),
            "tools_count": len(self.tools) if self.tools else 0,
            "mcp_function_count": mcp_function_count,
            "created_at": self.session_id.split('_')[-2] + '_' + self.session_id.split('_')[-1] if self.session_id else None
        }


# ============================================================================
# USAGE EXAMPLE AND CONVENIENCE FUNCTIONS
# ============================================================================

async def create_chat_session(llm_provider: str = "ollama", 
                             model_name: str = "qwen3:32b",
                             mcp_server_config: Optional[Dict[str, Any]] = None,
                             validate_mcp: bool = True,
                             **kwargs) -> AIChatUtility:
    """
    Convenience function to create and initialize a chat session.
    
    Args:
        llm_provider: The LLM provider to use
        model_name: The model name to use
        mcp_server_config: Optional MCP server configuration
        validate_mcp: Whether to validate MCP configuration before initialization
        **kwargs: Additional parameters for AIChatUtility
        
    Returns:
        Initialized AIChatUtility instance
    """
    chat_util = AIChatUtility(
        llm_provider=llm_provider,
        model_name=model_name,
        mcp_server_config=mcp_server_config,
        **kwargs
    )
    await chat_util.initialize_session(validate_mcp=validate_mcp)
    return chat_util


async def quick_chat(message: str, 
                    llm_provider: str = "ollama",
                    model_name: str = "qwen3:32b",
                    mcp_server_config: Optional[Dict[str, Any]] = None,
                    **kwargs) -> str:
    """
    Convenience function for a quick one-off chat interaction.
    
    Args:
        message: The message to send
        llm_provider: The LLM provider to use
        model_name: The model name to use
        mcp_server_config: Optional MCP server configuration
        **kwargs: Additional parameters for AIChatUtility
        
    Returns:
        AI response string
    """
    chat_util = AIChatUtility(
        llm_provider=llm_provider,
        model_name=model_name,
        mcp_server_config=mcp_server_config,
        **kwargs
    )
    
    response = await chat_util.generate_response(message, include_history=False)
    
    if response["success"]:
        return response["response"]
    else:
        return f"Error: {response['error']}"
