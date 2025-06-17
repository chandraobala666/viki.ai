"""
Proxy Configuration Utility

This module provides utilities for configuring HTTP and HTTPS proxy settings
throughout the VIKI AI application.
"""

import os
import logging
from typing import Dict, Optional, Any

logger = logging.getLogger(__name__)


class ProxyConfig:
    """
    Handles proxy configuration for HTTP clients and external services.
    """
    
    def __init__(self, http_proxy: str = "", https_proxy: str = "", no_proxy: str = ""):
        """
        Initialize proxy configuration.
        
        Args:
            http_proxy (str): HTTP proxy URL
            https_proxy (str): HTTPS proxy URL  
            no_proxy (str): Comma-separated list of hosts that should bypass proxy
        """
        self.http_proxy = http_proxy
        self.https_proxy = https_proxy
        self.no_proxy = no_proxy
        
        # NOTE: This class no longer sets global environment variables
        # Use get_llm_proxy_env_vars() for LLM-specific proxy configuration
        logger.info(f"Proxy configuration initialized - HTTP: {self.http_proxy}, HTTPS: {self.https_proxy}, NO_PROXY: {self.no_proxy}")
    
    def get_proxy_dict(self) -> Dict[str, str]:
        """
        Get proxy configuration as a dictionary suitable for requests library.
        
        Returns:
            Dict[str, str]: Proxy configuration dictionary
        """
        proxy_dict = {}
        
        if self.http_proxy:
            proxy_dict['http'] = self.http_proxy
            
        if self.https_proxy:
            proxy_dict['https'] = self.https_proxy
            
        return proxy_dict
    
    def get_proxy_env_vars(self) -> Dict[str, str]:
        """
        Get proxy configuration as environment variables dictionary.
        Useful for passing to subprocess or MCP server configurations.
        
        Returns:
            Dict[str, str]: Environment variables for proxy configuration
        """
        env_vars = {}
        
        if self.http_proxy:
            env_vars['HTTP_PROXY'] = self.http_proxy
            env_vars['http_proxy'] = self.http_proxy
            
        if self.https_proxy:
            env_vars['HTTPS_PROXY'] = self.https_proxy
            env_vars['https_proxy'] = self.https_proxy
            
        if self.no_proxy:
            env_vars['NO_PROXY'] = self.no_proxy
            env_vars['no_proxy'] = self.no_proxy
            
        return env_vars
    
    def configure_urllib3(self) -> None:
        """
        Configure urllib3 proxy settings.
        """
        try:
            import urllib3
            
            # Configure proxy manager if needed
            if self.http_proxy or self.https_proxy:
                logger.info("Configuring urllib3 with proxy settings")
                # urllib3 will automatically use environment variables
                # but we ensure they're set properly
                pass
                
        except ImportError:
            logger.debug("urllib3 not available, skipping urllib3-specific proxy configuration")
    
    def is_proxy_configured(self) -> bool:
        """
        Check if any proxy is configured.
        
        Returns:
            bool: True if any proxy is configured, False otherwise
        """
        return bool(self.http_proxy or self.https_proxy)
    
    def __str__(self) -> str:
        """String representation of proxy configuration."""
        parts = []
        if self.http_proxy:
            parts.append(f"HTTP: {self.http_proxy}")
        if self.https_proxy:
            parts.append(f"HTTPS: {self.https_proxy}")
        if self.no_proxy:
            parts.append(f"NO_PROXY: {self.no_proxy}")
        return f"ProxyConfig({', '.join(parts)})" if parts else "ProxyConfig(no proxy)"


# Global proxy configuration instance
_global_proxy_config: Optional[ProxyConfig] = None


def initialize_proxy_config(http_proxy: str = "", https_proxy: str = "", no_proxy: str = "") -> ProxyConfig:
    """
    Initialize global proxy configuration.
    
    Args:
        http_proxy (str): HTTP proxy URL
        https_proxy (str): HTTPS proxy URL
        no_proxy (str): Comma-separated list of hosts that should bypass proxy
        
    Returns:
        ProxyConfig: Initialized proxy configuration
    """
    global _global_proxy_config
    _global_proxy_config = ProxyConfig(http_proxy, https_proxy, no_proxy)
    _global_proxy_config.configure_urllib3()
    return _global_proxy_config


def get_proxy_config() -> Optional[ProxyConfig]:
    """
    Get the global proxy configuration instance.
    
    Returns:
        Optional[ProxyConfig]: Global proxy configuration or None if not initialized
    """
    return _global_proxy_config


def get_llm_proxy_config(http_proxy: str = "", https_proxy: str = "") -> Dict[str, str]:
    """
    Get proxy configuration specifically for LLM HTTP clients.
    This does NOT set global environment variables, only returns the proxy config.
    
    Args:
        http_proxy (str): HTTP proxy URL for LLM calls
        https_proxy (str): HTTPS proxy URL for LLM calls
        
    Returns:
        Dict[str, str]: Proxy configuration for LLM HTTP clients
    """
    proxy_config = {}
    
    if http_proxy:
        proxy_config['http'] = http_proxy
        
    if https_proxy:
        proxy_config['https'] = https_proxy
    
    logger.info(f"LLM proxy configuration: {proxy_config}")
    return proxy_config


def get_llm_proxy_env_vars(http_proxy: str = "", https_proxy: str = "") -> Dict[str, str]:
    """
    Get proxy environment variables specifically for LLM subprocess calls (e.g., MCP servers).
    This includes the current NO_PROXY setting from global environment.
    
    Args:
        http_proxy (str): HTTP proxy URL for LLM calls
        https_proxy (str): HTTPS proxy URL for LLM calls
        
    Returns:
        Dict[str, str]: Environment variables for LLM subprocess calls
    """
    env_vars = {}
    
    if http_proxy:
        env_vars['HTTP_PROXY'] = http_proxy
        env_vars['http_proxy'] = http_proxy
        
    if https_proxy:
        env_vars['HTTPS_PROXY'] = https_proxy
        env_vars['https_proxy'] = https_proxy
    
    # Always include the global NO_PROXY setting if it exists
    no_proxy = os.environ.get('NO_PROXY') or os.environ.get('no_proxy', '')
    if no_proxy:
        env_vars['NO_PROXY'] = no_proxy
        env_vars['no_proxy'] = no_proxy
    
    logger.info(f"LLM proxy environment variables: {env_vars}")
    return env_vars


def get_proxy_env_for_subprocess() -> Dict[str, str]:
    """
    Get proxy environment variables for subprocess calls.
    Includes current environment plus proxy settings.
    
    Returns:
        Dict[str, str]: Environment variables including proxy settings
    """
    env = os.environ.copy()
    
    if _global_proxy_config:
        env.update(_global_proxy_config.get_proxy_env_vars())
    
    return env
