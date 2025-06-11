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
                 mcp_server_config: Optional[Dict[str, Any]] = None):
        """
        Initialize the AI Chat Utility.
        
        Args:
            llm_provider: The LLM provider to use ('ollama', 'openai', 'groq', 'azure', 'huggingface', 'openrouter')
            model_name: The model name to use
            api_key: API key for the provider (if required)
            base_url: Base URL for the provider (if required)
            temperature: Temperature setting for the model
            system_prompt: Custom system prompt for the chat session
            mcp_server_config: Configuration dictionary for MCP server parameters
        """
        self.llm_provider = llm_provider.lower()
        self.model_name = model_name
        self.api_key = api_key
        self.base_url = base_url
        self.temperature = temperature
        
        # Store MCP server configuration
        self.mcp_server_config = mcp_server_config or {
            "mcp_command": "uv run openapi_mcp_server",
            "env": {
                "DEBUG": "True",
                "API_BASE_URL": "http://129.80.245.181:8004/OfsllRestWS/service/api/resources",
                "OPENAPI_SPEC_PATH": "/Users/rahgadda/rahul/DEV/mcp/ofsll_swaggerv3.json",
                "API_HEADERS": "Accept:application/json,Authorization:Basic T0xMQURNSU46T0xMQURNSU4qMTIz,Content-Type:application/json",
                "API_WHITE_LIST": "getAccountDetail,postAccountComments,fetchAccountComments,executePaymentPosting,getCallActivityDetail,executeCallActivity"
            }
        }
        
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
        
        # Setup logging
        self.logger = logging.getLogger(__name__)
        
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
                os.environ["HUGGINGFACEHUB_API_TOKEN"] = self.api_key
                llm = HuggingFaceEndpoint(
                    repo_id=self.model_name,
                    model=self.model_name,
                    task="text-generation"
                )
                self.model = ChatHuggingFace(llm=llm)
                
            elif self.llm_provider == "openrouter":
                if not self.api_key:
                    raise ValueError("API key is required for OpenRouter")
                    
                # Custom OpenRouter implementation
                class ChatOpenRouter(ChatOpenAI):
                    def __init__(self, **kwargs):
                        super().__init__(
                            base_url="https://openrouter.ai/api/v1",
                            **kwargs
                        )
                
                self.model = ChatOpenRouter(
                    model=self.model_name,
                    api_key=SecretStr(self.api_key),
                    temperature=self.temperature
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
        # Use provided config or fall back to instance config
        config = server_config or self.mcp_server_config
        
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
            
            # Use the simpler approach similar to langchain_mcp.py
            server_params = self.get_server_params()
            
            # Create a single async context that handles both connections
            try:
                async with stdio_client(server_params) as (read, write):
                    async with ClientSession(read, write) as session:
                        await session.initialize()
                        self.logger.info("MCP connection initialized")
                        
                        # Load MCP tools
                        tools = await load_mcp_tools(session)
                        self.logger.info(f"Loaded {len(tools)} MCP tools")
                        
                        # Ensure model is configured
                        if not self.model:
                            raise ValueError("Model not properly initialized")
                        
                        # Create REACT agent
                        agent = create_react_agent(self.model, tools)
                        self.logger.info("REACT agent created")
                        
                        # Run the agent with messages
                        agent_response = await agent.ainvoke({"messages": langchain_messages})
                        self.logger.info("Agent invoked successfully")
                        
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
                        
            except Exception as mcp_error:
                self.logger.error(f"MCP connection error: {str(mcp_error)}", exc_info=True)
                raise mcp_error
                    
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


# ============================================================================
# DEMO FUNCTION
# ============================================================================

async def demo():
    """
    Demo function showing how to use the AIChatUtility class with MCP test utility.
    """
    print("=== AI Chat Utility Demo ===\n")
    
    # Example custom MCP server configuration using the new format
    custom_mcp_config = {
        "mcp_command": "uv run openapi_mcp_server",
        "env": {
            "DEBUG": "True",
            "API_BASE_URL": "http://129.80.245.181:8004/OfsllRestWS/service/api/resources",
            "OPENAPI_SPEC_PATH": "/Users/rahgadda/rahul/DEV/mcp/ofsll_swaggerv3.json",
            "API_HEADERS": "Accept:application/json,Authorization:Basic T0xMQURNSU46T0xMQURNSU4qMTIz,Content-Type:application/json",
            "API_WHITE_LIST": "getAccountDetail,postAccountComments,fetchAccountComments,executePaymentPosting,getCallActivityDetail,executeCallActivity"
        }
    }
    
    # Create and initialize chat session with custom MCP config
    chat = AIChatUtility(
        llm_provider="ollama",
        model_name="qwen3:32b",
        temperature=0.0,
        mcp_server_config=custom_mcp_config
    )
    
    # Test MCP configuration before initializing session
    print("Testing MCP configuration...")
    test_result = await chat.test_mcp_configuration()
    if test_result["success"]:
        print(f"✅ MCP configuration test successful. Found {test_result['function_count']} functions.")
        if test_result["functions"]:
            print("Available functions:")
            for func in test_result["functions"][:5]:  # Show first 5 functions
                print(f"  - {func['name']}: {func['description']}")
    else:
        print(f"❌ MCP configuration test failed: {test_result['error_message']}")
    print()
    
    await chat.initialize_session()
    print(f"Session initialized: {chat.session_id}\n")
    
    # Demo conversation
    queries = [
        "What tools are available?",
        "Can you help me get account details for account number 20000100061065?",
        "How can I post a comment to an account?"
    ]
    
    for query in queries:
        print(f"User: {query}")
        response = await chat.generate_response(query)
        
        if response["success"]:
            print(f"AI: {response['response']}\n")
        else:
            print(f"Error: {response['error']}\n")
    
    # Show session info
    print("Session Info:")
    print(chat.get_session_info())


if __name__ == "__main__":
    # Set up logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    
    # Run demo
    asyncio.run(demo())
