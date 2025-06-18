import asyncio
import logging
import os
import warnings
import time
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
from langchain_aws import ChatBedrock
from langchain_anthropic import ChatAnthropic
from openinference.instrumentation.langchain import LangChainInstrumentor

# Import connection error types for better error handling
try:
    from groq import APIConnectionError as GroqAPIConnectionError, BadRequestError as GroqBadRequestError
    from httpx import ConnectError as HttpxConnectError, ProxyError as HttpxProxyError
    from httpcore import ConnectError as HttpcoreConnectError
except ImportError:
    GroqAPIConnectionError = Exception
    GroqBadRequestError = Exception
    HttpxConnectError = Exception
    HttpxProxyError = Exception
    HttpcoreConnectError = Exception

import phoenix as px
from phoenix.otel import register

from mcp.client.stdio import stdio_client
from mcp import ClientSession, StdioServerParameters

from langchain_mcp_adapters.tools import load_mcp_tools
from langgraph.prebuilt import create_react_agent

# Import MCP test utility
from .mcp_test_util import test_mcp_configuration, test_mcp_configuration_sync

# Suppress SQLAlchemy warnings about Phoenix's expression-based indices globally
# These warnings are harmless and occur during Phoenix initialization
try:
    from sqlalchemy.exc import SAWarning
    warnings.filterwarnings("ignore", 
                          message=".*Skipped unsupported reflection of expression-based index.*", 
                          category=SAWarning)
except ImportError:
    pass  # SQLAlchemy might not be available or version might be different

# Initialize Phoenix instrumentation globally
# This should be done once per application startup
def initialize_phoenix_instrumentation():
    """Initialize Phoenix instrumentation for LangChain tracing."""
    try:
        # Suppress SQLAlchemy warnings about expression-based indices during Phoenix initialization
        with warnings.catch_warnings():
            # Filter out specific SQLAlchemy warnings about unsupported reflection of expression-based indices
            warnings.filterwarnings("ignore", 
                                  message=".*Skipped unsupported reflection of expression-based index.*", 
                                  category=Warning)
            # Also try to filter SQLAlchemy SAWarning specifically
            try:
                from sqlalchemy.exc import SAWarning
                warnings.filterwarnings("ignore", 
                                      message=".*ix_cumulative_llm_token_count_total.*", 
                                      category=SAWarning)
                warnings.filterwarnings("ignore", 
                                      message=".*ix_latency.*", 
                                      category=SAWarning)
                warnings.filterwarnings("ignore", 
                                      message=".*Skipped unsupported reflection of expression-based index.*", 
                                      category=SAWarning)
            except ImportError:
                pass  # SQLAlchemy might not be available or version might be different
            
            # Set environment variable for Phoenix project
            import os
            os.environ["PHOENIX_PROJECT_NAME"] = "viki-ai-langchain-traces"
            
            # Launch Phoenix app and get session
            session = px.launch_app()
            
            # Setup instrumentation with minimal configuration
            register()
            
            # Instrument LangChain
            LangChainInstrumentor().instrument()
        
        logging.info("Phoenix instrumentation initialized successfully")
        logging.info(f"Phoenix UI available at: http://127.0.0.1:6006")
        
        # Return session without automatically opening view to avoid UI issues
        return session
    except Exception as e:
        logging.warning(f"Failed to initialize Phoenix instrumentation: {e}")
        return None

# Global Phoenix session - initialized once
_phoenix_session = None

def open_phoenix_ui():
    """Open Phoenix UI in browser. Call this after some traces are generated."""
    global _phoenix_session
    try:
        if _phoenix_session:
            _phoenix_session.view()
            logging.info("Phoenix UI opened in browser")
        else:
            logging.warning("Phoenix session not available. Initialize Phoenix first.")
    except Exception as e:
        logging.warning(f"Failed to open Phoenix UI: {e}")

def get_phoenix_session():
    """Get the global Phoenix session."""
    return _phoenix_session

def initialize_phoenix_project():
    """Generate an initial trace to create the Phoenix project."""
    try:
        # This will create a minimal trace to initialize the project in Phoenix
        from opentelemetry import trace
        from opentelemetry.trace import Status, StatusCode
        
        tracer = trace.get_tracer(__name__)
        with tracer.start_as_current_span("phoenix_initialization") as span:
            span.set_attribute("service.name", "viki-ai")
            span.set_attribute("project.name", "viki-ai-langchain-traces")
            span.set_status(Status(StatusCode.OK, "Phoenix project initialized"))
            logging.info("Phoenix project initialized with initial trace")
        return True
    except Exception as e:
        logging.warning(f"Failed to initialize Phoenix project: {e}")
        return False


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
                 llm_provider: str,
                 model_name: str,
                 config_file_content: Any= None,
                 api_key: Optional[str] = None,
                 base_url: Optional[str] = None,
                 temperature: float = 0.0,
                 system_prompt: Optional[str] = None,
                 mcp_server_config: Optional[Dict[str, Any]] = None,
                 agent_mcp_configs: Optional[List[Dict[str, Any]]] = None,
                 http_proxy: Optional[str] = None,
                 https_proxy: Optional[str] = None,
                 no_proxy: Optional[str] = None):
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
            http_proxy: HTTP proxy URL for LLM calls only (not global)
            https_proxy: HTTPS proxy URL for LLM calls only (not global)
            no_proxy: Comma-separated list of domains to exclude from proxying (not global)
        """
        self.llm_provider = llm_provider.lower()
        self.model_name = model_name
        self.api_key = api_key.strip() if api_key else api_key
        self.base_url = base_url
        self.temperature = temperature
        self.config_file_content = config_file_content or {}
        
        # Store LLM-specific proxy settings (not global)
        self.http_proxy = http_proxy
        self.https_proxy = https_proxy
        self.no_proxy = no_proxy
        
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
        
        # Connection management for preventing resource contention
        self._connection_semaphore = asyncio.Semaphore(3)  # Limit concurrent MCP connections
        self._max_retries = 3
        self._base_delay = 0.5  # Base delay for exponential backoff
        
        # Default system prompt for OFSLL application
        self.system_prompt = system_prompt or (
            "You are a helpful assistant specialized in supporting user requests."
            "Don't hallucinate or make up answers. "
            "If you cannot answer the question, say 'I don't know'. "
            "Use the tools provided to answer the user's questions. "
        )
        
        # Initialize session variables
        self.model = None
        self.tools = None
        self.agent = None
        self.session_id: Optional[str] = None
        # Initialize message history with system prompt
        self.message_history: List[Dict[str, Any]] = [
            {"role": "system", "content": self.system_prompt}
        ]
        
        # Initialize Phoenix instrumentation for this instance
        global _phoenix_session
        if _phoenix_session is None:
            _phoenix_session = initialize_phoenix_instrumentation()
        
        # Log Phoenix session status
        if _phoenix_session:
            self.logger.info("Phoenix instrumentation active for AIChatUtility")
        else:
            self.logger.warning("Phoenix instrumentation not available")
    
    def configure_proxy(self):
        if self.http_proxy:
            os.environ["HTTP_PROXY"] = self.http_proxy
            os.environ["http_proxy"] = self.http_proxy
        if self.https_proxy:
            os.environ["HTTPS_PROXY"] = self.https_proxy
            os.environ["https_proxy"] = self.https_proxy
        if self.no_proxy:
            os.environ["NO_PROXY"] = self.no_proxy
            os.environ["no_proxy"] = self.no_proxy
    
    def remove_proxy(self):
        """
        Remove proxy settings from environment variables.
        This is useful to reset the environment after LLM configuration.
        """
        if "HTTP_PROXY" in os.environ:
            del os.environ["HTTP_PROXY"]
        if "http_proxy" in os.environ:
            del os.environ["http_proxy"]
        if "HTTPS_PROXY" in os.environ:
            del os.environ["HTTPS_PROXY"]
        if "https_proxy" in os.environ:
            del os.environ["https_proxy"]
        if "NO_PROXY" in os.environ:
            del os.environ["NO_PROXY"]
        if "no_proxy" in os.environ:
            del os.environ["no_proxy"]
    
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

                if not self.model_name:
                    raise ValueError("Model name is required for Ollama")

                self.remove_proxy()         

                self.model = ChatOllama(
                    model=self.model_name,
                    temperature=self.temperature
                )

                self.configure_proxy()
                
            elif self.llm_provider == "openai":
                if not self.api_key:
                    raise ValueError("API key is required for OpenAI")
                if not self.model_name:
                    raise ValueError("Model name is required for OpenAI")

                self.model = ChatOpenAI(
                    model=self.model_name,
                    api_key=SecretStr(self.api_key),
                    temperature=self.temperature
                )
                
            elif self.llm_provider == "groq":
                if not self.api_key:
                    raise ValueError("API key is required for Groq")
                if not self.model_name:
                    raise ValueError("Model name is required for Groq")
                
                self.configure_proxy()

                self.model = ChatGroq(
                    model=self.model_name,
                    api_key=SecretStr(self.api_key),
                    temperature=self.temperature
                )

                self.remove_proxy()

            elif self.llm_provider == "azure":
                if not self.api_key:
                    raise ValueError("API key is required for Azure AI")
                
                os.environ["AZURE_INFERENCE_CREDENTIAL"] = self.api_key
                
                self.configure_proxy()

                self.model = AzureAIChatCompletionsModel(
                    model=self.model_name,
                    endpoint=self.base_url or "https://models.github.ai/inference"
                )

                self.remove_proxy()
                    

            elif self.llm_provider == "huggingface":
                if not self.api_key:
                    raise ValueError("API key is required for HuggingFace")
                if not self.model_name:
                    raise ValueError("Model name is required for HuggingFace")

                self.configure_proxy()

                # Create HuggingFace endpoint with additional timeout
                llm = HuggingFaceEndpoint(
                    huggingfacehub_api_token=self.api_key,
                    repo_id=self.model_name,
                    task="text-generation"
                )  # type: ignore
                self.model = ChatHuggingFace(llm=llm)
                        
                self.remove_proxy()

            elif self.llm_provider == "cerebras":
                if not self.api_key:
                    raise ValueError("API key is required for Cerebras")
                if not self.model_name:
                    raise ValueError("Model name is required for Cerebras")

                self.configure_proxy()

                self.model = ChatCerebras( model=self.model_name,
                    api_key=SecretStr(self.api_key),
                    temperature=self.temperature)
                
                self.remove_proxy()

            elif self.llm_provider == "openrouter":
                if not self.api_key:
                    raise ValueError("API key is required for OpenRouter")
                if not self.model_name:
                    raise ValueError("Model name is required for OpenRouter")
            
                self.configure_proxy()

                # Custom OpenRouter implementation
                self.model = ChatOpenAI(
                    model=self.model_name,
                    api_key=SecretStr(self.api_key),
                    temperature=self.temperature,
                    base_url="https://openrouter.ai/api/v1")
                
                self.remove_proxy()

            elif self.llm_provider == "anthropic":
                if not self.api_key:
                    raise ValueError("API key is required for Anthropic")
                if not self.model_name:
                    raise ValueError("Model name is required for Anthropic")

                self.configure_proxy()

                self.model = ChatAnthropic(
                    model=self.model_name,  # type: ignore
                    api_key=SecretStr(self.api_key),
                    temperature=self.temperature
                )

                self.remove_proxy()
                    

            elif self.llm_provider == "aws":
                if not self.model_name:
                    raise ValueError("Model name is required for AWS BedRock")
                if not self.config_file_content:
                    raise ValueError("Configuration file is required for AWS BedRock")

                config_file_content = self.config_file_content
                
                # Ensure config_file_content is a dictionary
                if not isinstance(config_file_content, dict):
                    raise ValueError("Configuration file content must be a dictionary for AWS BedRock")
                
                # Extract AWS credentials from config_file_content
                aws_access_key = config_file_content.get("access_key")
                aws_secret_key = config_file_content.get("secret_key")
                aws_region = config_file_content.get("region")
                aws_account_id = config_file_content.get("account_id")
                
                # Trim whitespace from credentials if they exist
                if aws_access_key:
                    aws_access_key = aws_access_key.strip()
                if aws_secret_key:
                    aws_secret_key = aws_secret_key.strip()
                if aws_region:
                    aws_region = aws_region.strip()
                
                # Provide detailed error message about missing credentials
                missing_fields = []
                if not aws_access_key:
                    missing_fields.append("access_key")
                if not aws_secret_key:
                    missing_fields.append("secret_key")
                if not aws_region:
                    missing_fields.append("region")
                
                if missing_fields:
                    available_keys = list(config_file_content.keys())
                    raise ValueError(
                        f"AWS BedRock configuration is missing required fields: {missing_fields}. "
                        f"Available keys in config: {available_keys}. "
                        f"Please ensure your configuration file contains: access_key, secret_key, and region."
                    )
                
                self.configure_proxy()
                
                # Configure AWS credentials
                self.model = ChatBedrock(
                    model=self.model_name,
                    aws_access_key_id=aws_access_key,
                    aws_secret_access_key=aws_secret_key,
                    region=aws_region,
                    temperature=self.temperature
                )

                self.remove_proxy()

            else:
                raise ValueError(f"Unsupported LLM provider: {self.llm_provider}")
                
            self.logger.info(f"LLM model configured successfully: {type(self.model).__name__}")
            return self.model
            
        except Exception as e:
            # Enhanced error handling for common connection issues
            error_msg = str(e)
            if "Connect call failed" in error_msg or "Cannot connect to host" in error_msg:
                proxy_info = ""
                if self.http_proxy or self.https_proxy:
                    proxy_info = f" Current proxy settings - HTTP: {self.http_proxy}, HTTPS: {self.https_proxy}"
                
                self.logger.error(f"Connection failed to {self.llm_provider} endpoint. This may be due to proxy configuration issues.{proxy_info}")
                self.logger.error(f"Original error: {error_msg}")
            
            else:
                self.logger.error(f"Error configuring LLM: {error_msg}")
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
        
        # Get base environment from config
        env = config.get("env", {}).copy()
        
        # Add LLM-specific proxy environment variables if they are configured
        if self.http_proxy or self.https_proxy:
            llm_proxy_env = {}
            
            if self.http_proxy:
                llm_proxy_env['HTTP_PROXY'] = self.http_proxy
                llm_proxy_env['http_proxy'] = self.http_proxy
                
            if self.https_proxy:
                llm_proxy_env['HTTPS_PROXY'] = self.https_proxy
                llm_proxy_env['https_proxy'] = self.https_proxy
            
            # Always include the global NO_PROXY setting if it exists
            no_proxy = os.environ.get('NO_PROXY') or os.environ.get('no_proxy', '')
            if no_proxy:
                llm_proxy_env['NO_PROXY'] = no_proxy
                llm_proxy_env['no_proxy'] = no_proxy
            
            env.update(llm_proxy_env)
            self.logger.debug(f"Added LLM proxy environment variables for MCP server: {llm_proxy_env}")
        
        return StdioServerParameters(
            command=command,
            args=args,
            env=env
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
            mcp_command = ""
            if "mcp_command" in config:
                mcp_command = config["mcp_command"]
            # else:
            #     # Construct command from legacy format
            #     command = config.get("command", "uv")
            #     args = config.get("args", ["run", "openapi_mcp_server"])
            #     mcp_command = f"{command} {' '.join(args)}"
            
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
            mcp_command = ""
            if "mcp_command" in config:
                mcp_command = config["mcp_command"]
            # else:
            #     # Construct command from legacy format
            #     command = config.get("command", "uv")
            #     args = config.get("args", ["run", "openapi_mcp_server"])
            #     mcp_command = f"{command} {' '.join(args)}"
            
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
                async with stdio_client(server_params) as (read, write):
                    async with ClientSession(read, write) as session:
                        await session.initialize()
                        
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

    async def generate_response(self, user_message: str, include_history: bool = True) -> Dict[str, Any]:
        """
        Generate AI response using the configured model and MCP tools.
        
        Args:
            user_message: The user's message
            include_history: Whether to include message history in the conversation
            
        Returns:
            Dictionary containing success status, response content, and optional error info
        """
        try:
            self.logger.info(f"Generating response for message: {user_message[:100]}...")
            
            # Add user message to history if including history
            if include_history:
                self.message_history.append({"role": "user", "content": user_message})
            
            # Configure the LLM model if not already done
            if not self.model:
                self.configure_llm()
            
            # Ensure model is properly configured before proceeding
            if not self.model:
                error_msg = "Model not properly initialized"
                self.logger.error(error_msg)
                return {
                    "success": False,
                    "error": error_msg,
                    "response": "I'm sorry, but the AI model is not properly configured. Please check the configuration."
                }
            
            # Prepare messages for LangChain format
            from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
            
            langchain_messages = []
            for msg in self.message_history:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                
                if role == "system":
                    langchain_messages.append(SystemMessage(content=content))
                elif role == "user":
                    langchain_messages.append(HumanMessage(content=content))
                elif role == "assistant":
                    langchain_messages.append(AIMessage(content=content))
            
            # If not including history, just use the current message
            if not include_history:
                langchain_messages = [HumanMessage(content=user_message)]
            
            agent_response = None
            
            self.configure_proxy()

            # Try to use MCP tools first if available
            if self.agent_mcp_configs:
                self.logger.info("Using agent-specific MCP tools for response generation")
                try:
                    tools = await self.load_agent_specific_tools()
                    if tools and self.model:
                        try:
                            agent = create_react_agent(self.model, tools)
                            agent_response = await agent.ainvoke({"messages": langchain_messages})
                        finally:
                            self.remove_proxy()
                except Exception as e:
                    self.logger.warning(f"Failed to use agent-specific MCP tools, falling back to direct model: {e}")
            elif self.mcp_server_config:
                self.logger.info("Using legacy MCP configuration for response generation")
                # For legacy single MCP configuration, load tools and create agent
                try:
                    tools = await self.load_agent_specific_tools()
                    if tools and self.model:
                        try:
                            agent = create_react_agent(self.model, tools)
                            agent_response = await agent.ainvoke({"messages": langchain_messages})
                        finally:
                            self.remove_proxy()
                except Exception as e:
                    self.logger.warning(f"Failed to use MCP tools, falling back to direct model: {e}")
            
            # If agent response was successful, extract content
            if agent_response and "messages" in agent_response and agent_response["messages"]:
                response_content = agent_response["messages"][-1].content
                response_text = str(response_content) if response_content else "No response generated"
                
                # Add AI response to history if including history
                if include_history:
                    self.message_history.append({"role": "assistant", "content": response_text})
                
                return {
                    "success": True,
                    "response": response_text,
                    "used_tools": True
                }
            
            # Fallback to direct model invocation without tools
            self.logger.info("Using direct model invocation without tools")
            
            # Retry logic for connection errors (especially important for corporate networks)
            max_retries = 3
            base_delay = 1.0
            last_error = None
            
            for attempt in range(max_retries):
                try:
                    # self.set_proxy_variables()
                    try:
                        response = await self.model.ainvoke(langchain_messages)
                        response_content = response.content
                        response_text = str(response_content) if response_content else "No response generated"
                        
                        # Add AI response to history if including history
                        if include_history:
                            self.message_history.append({"role": "assistant", "content": response_text})
                        
                        return {
                            "success": True,
                            "response": response_text,
                            "used_tools": False
                        }
                    finally:
                        self.remove_proxy()
                        
                except (GroqAPIConnectionError, HttpxConnectError, HttpcoreConnectError, HttpxProxyError, ConnectionError) as conn_err:
                    last_error = conn_err
                    if attempt < max_retries - 1:
                        delay = base_delay * (2 ** attempt)  # Exponential backoff
                        self.logger.warning(f"Connection error on attempt {attempt + 1}/{max_retries}: {str(conn_err)}. Retrying in {delay}s...")
                        await asyncio.sleep(delay)
                        continue
                    else:
                        # Final attempt failed, break to handle error below
                        break
            
            # If we reach here, all retries failed or there was a non-connection error
            if last_error:
                if isinstance(last_error, (GroqAPIConnectionError, HttpxConnectError, HttpcoreConnectError, HttpxProxyError, ConnectionError)):
                    # Connection error after all retries
                    error_msg = f"Connection failed after {max_retries} attempts. This might be due to proxy configuration issues in your corporate network. Please check your proxy settings."
                    if self.http_proxy or self.https_proxy:
                        error_msg += f" Current proxy settings - HTTP: {self.http_proxy}, HTTPS: {self.https_proxy}"
                    else:
                        error_msg += " No proxy is configured - you may need to set HTTP_PROXY and HTTPS_PROXY environment variables or configure them in the application."
                    
                    self.logger.error(error_msg)
                    return {
                        "success": False,
                        "error": error_msg,
                        "response": "Unable to connect to the AI service. Please check your network connection and proxy settings."
                    }
                else:
                    # Other error, re-raise it to be caught by the outer exception handler
                    raise last_error
            else:
                # This should not happen, but just in case
                error_msg = "Unexpected error: All retry attempts failed without an error being captured"
                self.logger.error(error_msg)
                return {
                    "success": False,
                    "error": error_msg,
                    "response": "I apologize, but I encountered an unexpected error while processing your request. Please try again."
                }
                        
        except Exception as e:
            # Handle any other unexpected errors
            error_msg = f"Error generating AI response: {str(e)}"
            self.logger.error(error_msg)
            
            # Check if it's a connection-related error and provide helpful message
            if any(err_type in str(e).lower() for err_type in ['connection', 'proxy', 'network', 'timeout']):
                helpful_msg = "This appears to be a network connectivity issue. If you're in a corporate network, please ensure your proxy settings are correctly configured."
                return {
                    "success": False,
                    "error": f"{error_msg}. {helpful_msg}",
                    "response": "I apologize, but I'm having trouble connecting to the AI service. Please check your network connection and try again."
                }
            
            return {
                "success": False,
                "error": error_msg,
                "response": "I apologize, but I encountered an error while processing your request. Please try again."
            }