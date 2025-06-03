import logging
import sys

logger = logging.getLogger(__name__)

def setup_logging(debug=False)  -> logging.Logger:
    """
    Setup the logging configuration for the application. 
    """          
    logger.setLevel(logging.DEBUG if debug else logging.INFO)
    logger.propagate = False

    # Remove all existing handlers to prevent accumulation
    for handler in logger.handlers:
        logger.removeHandler(handler)
    
    handlers = []
           
    # Create a new handler
    try:
        handler = logging.StreamHandler()
        handler.setLevel(logging.DEBUG if debug else logging.INFO)
        formatter = logging.Formatter("[%(levelname)s] %(message)s")
        handler.setFormatter(formatter)
        handlers.append(handler)
    except Exception as e:
        logger.error(f"Failed to create stdout log handler: {e}", file=sys.stderr) # type: ignore

    # Add the handlers to the logger
    for handler in handlers:
        logger.addHandler(handler)
    
    return logger