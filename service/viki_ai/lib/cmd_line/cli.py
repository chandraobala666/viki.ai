import sys
import os
import argparse
import importlib.metadata
from dotenv import load_dotenv

from viki_ai.lib.util.viki_logger import setup_logging

def load_environment_variables(logger, env_path: str = None): # type: ignore
    """
    Load environment variables

    Args:
        logger (Logger): Logger instance for logging messages
        env_path (str): Path to the .env file
    
    Returns:
        None
    """
    
    try:
        version = importlib.metadata.version("viki-ai")
    except importlib.metadata.PackageNotFoundError:
        version = "unknown"
    
    parser = argparse.ArgumentParser(
        description=f"VIKI AI CLI v{version}",
        prog="viki_ai"
    )
    parser.add_argument(
        "--env",
        help="Path to .env file to load environment variables from",
        default=None
    )
    args = parser.parse_args()
    
    # Load environment variables
    env_path = args.env if args.env else os.path.join(os.getcwd(), ".env")
    
    # Processing .env file
    try:
        if env_path and os.path.exists(env_path):
            load_dotenv(env_path)
            logger.info(f"Environment variables loaded from: {env_path}")
        else:
            logger.info("No .env file specified or file does not exist")

        # Updating logging level from environment variable
        DEBUG = os.getenv("DEBUG", "False").lower() in ("true", "1", "yes")
        logger = setup_logging(debug=DEBUG)
        logger.debug("DEBUG: %s", DEBUG)

        # Updating database URL from environment variable
        DB_URL = os.getenv("DB_URL", "sqlite:///:memory:")
        logger.debug("DB_URL: %s", DB_URL)

        # Update Flyway location if needed
        DEFAULT_CLASSPATH = os.path.join(os.getcwd(), "db", "flyway")
        FLYWAY_LOCATION = os.getenv("FLYWAY_LOCATION", DEFAULT_CLASSPATH)

        return DB_URL, DEBUG, FLYWAY_LOCATION ,logger
    
    except Exception as e:
        logger.error(f"Error loading environment variables: {str(e)}")
        sys.exit(1)
