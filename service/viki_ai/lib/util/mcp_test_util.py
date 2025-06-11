# MCP Test Utility for testing MCP configuration and counting tools
import asyncio
import logging
import os
import tempfile
from typing import Dict, List, Optional, Tuple

from langchain_ollama import ChatOllama
from mcp.client.stdio import stdio_client
from mcp import ClientSession, StdioServerParameters
from langchain_mcp_adapters.tools import load_mcp_tools


async def test_mcp_configuration(
    mcp_command: str, 
    environment_variables: Dict[str, str]
) -> Tuple[bool, int, Optional[str], Optional[List[Dict[str, str]]]]:
    """
    Test MCP configuration and return function count and function details.
    
    Args:
        mcp_command: The MCP command to test
        environment_variables: Environment variables for the MCP server
        
    Returns:
        Tuple of (success: bool, function_count: int, error_message: Optional[str], functions: Optional[List[Dict[str, str]]])
    """
    try:
        # Parse MCP command to get command and args
        command_parts = mcp_command.strip().split()
        if not command_parts:
            return False, 0, "Empty MCP command", None
        
        command = command_parts[0]
        args = command_parts[1:] if len(command_parts) > 1 else []
        
        # Prepare environment
        env = os.environ.copy()
        env.update(environment_variables)
        
        # Create server parameters
        server_params = StdioServerParameters(
            command=command,
            args=args,
            env=env
        )
        
        # Test connection and count tools
        async with stdio_client(server_params) as (read, write):  # type: ignore
            async with ClientSession(read, write) as session:
                await session.initialize()
                logging.info("MCP connection initialized successfully")
                
                # Load MCP tools and count them
                tools = await load_mcp_tools(session)
                tool_count = len(tools)
                
                # Extract function details
                functions = []
                for tool in tools:
                    functions.append({
                        "name": tool.name,
                        "description": tool.description if hasattr(tool, 'description') else "",
                        "type": "function"
                    })
                
                logging.info(f"Successfully loaded {tool_count} MCP tools")
                return True, tool_count, None, functions
                
    except Exception as e:
        error_message = f"Failed to test MCP configuration: {str(e)}"
        logging.error(error_message)
        return False, 0, error_message, None


def test_mcp_configuration_sync(
    mcp_command: str, 
    environment_variables: Dict[str, str]
) -> Tuple[bool, int, Optional[str], Optional[List[Dict[str, str]]]]:
    """
    Synchronous wrapper for test_mcp_configuration.
    
    Args:
        mcp_command: The MCP command to test
        environment_variables: Environment variables for the MCP server
        
    Returns:
        Tuple of (success: bool, function_count: int, error_message: Optional[str], functions: Optional[List[Dict[str, str]]])
    """
    try:
        # Run the async function
        return asyncio.run(test_mcp_configuration(mcp_command, environment_variables))
    except Exception as e:
        error_message = f"Failed to run MCP test: {str(e)}"
        logging.error(error_message)
        return False, 0, error_message, None
