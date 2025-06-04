import os
import subprocess
import sys
import uvicorn
from fastapi import FastAPI, APIRouter

from .lib.util.viki_logger import setup_logging
from .lib.cmd_line.cli import load_environment_variables
from .lib.db_config.db_connect import create_db_engine
from .lib.util.version_util import get_version
from .lib.router import get_routers
from .lib.model.db_session import DatabaseSession

def main():
    """
    Entry point for the VIKI AI.
    This is a FastAPI application that serves as a wrapper for the VIKI AI API.

    Configuration is controlled via environment variables:
    - DEBUG: Enable debug logging (optional default is False)
    - DB_URL: Database connection URL (optional default is in-memory SQLite)
    - FLYWAY_LOCATION: Location of Flyway migrations (optional default is "classpath:db/flayway")
    - PORT: Port number (optional default is 8080)
    """

    # Global variables
    DEBUG = True
    DB_URL = ""
    FLYWAY_LOCATION = ""
    PORT = 8080

    logger = setup_logging(DEBUG)
    logger.info("Starting VIKI AI Service")

    try:
        
        # Load environment variables
        DB_URL, DEBUG, FLYWAY_LOCATION, logger = load_environment_variables(logger)

        # Connect to the database
        DB_ENGINE = create_db_engine(DB_URL)
        logger.info(f"Database connected with URL: {DB_URL}")
        
        # Initialize the database session
        DatabaseSession.initialize(DB_URL)
        DatabaseSession.create_tables()

        # Get version from pyproject.toml
        version = get_version()
        logger.info(f"VIKI AI Service version: {version}")

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
        
        # Create FastAPI application
        app = FastAPI(
            title="VIKI AI REST API",
            description="VIKI - Open Agent Platform REST API",
            version=version,
            docs_url=f"/api/{version}/docs",
            redoc_url=f"/api/{version}/redoc",
            openapi_url=f"/api/{version}/openapi.json",
            swagger_ui_oauth2_redirect_url=f"/api/{version}/oauth2-redirect",
            swagger_ui_parameters={"defaultModelsExpandDepth": -1}
        )
        
        # Create main router with version prefix
        api_router = APIRouter(prefix=f"/api/{version}")
        
        # Include all routers
        for router in get_routers():
            api_router.include_router(router)
        
        # Include the main router in the app
        app.include_router(api_router)
        
        # Run the application
        logger.info(f"Starting FastAPI server on port {PORT}")
        uvicorn.run(app, host="0.0.0.0", port=PORT)
        

    except KeyboardInterrupt:
        logger.info("Server shutting down gracefully...")
    except Exception as e:
        logger.error(f"Error starting the VIKI AI Service: {str(e)}")
        sys.exit(1)
    finally:
        logger.info("VIKI AI Service stopped")

if __name__ == "__main__":
    main()
