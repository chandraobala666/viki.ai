import os
import subprocess
import sys

from viki_ai.lib.util.viki_logger import setup_logging
from viki_ai.lib.cmd_line.cli import load_environment_variables
from viki_ai.lib.db_config.db_connect import create_db_engine

def main():
    """
    Entry point for the VIKI AI.
    This is a FastAPI application that serves as a wrapper for the VIKI AI API.

    Configuration is controlled via environment variables:
    - DEBUG: Enable debug logging (optional default is False)
    - DB_URL: Database connection URL (optional default is in-memory SQLite)
    - FLYWAY_LOCATION: Location of Flyway migrations (optional default is "classpath:db/flayway")
    """

    # Global variables
    DEBUG = True
    DB_URL = ""
    FLYWAY_LOCATION = ""

    logger = setup_logging(DEBUG)
    logger.info("Starting VIKI AI Service")

    try:
        
        # Load environment variables
        DB_URL, DEBUG, FLYWAY_LOCATION, logger = load_environment_variables(logger)

        # Connect to the database
        DB_ENGINE = create_db_engine(DB_URL)
        logger.info(f"Database connected with URL: {DB_URL}")

        # Initialize the Flyway application
        logger.info(f"Running Flyway migrations from: {FLYWAY_LOCATION}")
        
        try:
            # Check if FLYWAY_LOCATION is specified
            if not FLYWAY_LOCATION:
                logger.warning("Flyway location not specified, skipping migrations")
            else:
                # Change to the Flyway directory
                os.chdir(FLYWAY_LOCATION)
                
                # Run flyway migrate command
                result = subprocess.run(
                    ["flyway", "migrate"],
                    capture_output=True,
                    text=True,
                    check=False
                )
            
                if result.returncode == 0:
                    logger.info("Flyway migrations completed successfully")
                    logger.debug(result.stdout)
                else:
                    logger.error(f"Flyway migrations failed: {result.stderr}")
                
        except Exception as e:
            logger.error(f"Error running Flyway migrations: {str(e)}")
        

    except KeyboardInterrupt:
        logger.info("Server shutting down gracefully...")
    except Exception as e:
        logger.error(f"Error starting the VIKI AI Service: {str(e)}")
        sys.exit(1)
    finally:
        logger.info("VIKI AI Service stopped")

if __name__ == "__main__":
    main()
