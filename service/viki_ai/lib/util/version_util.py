import re
import os

def get_version():
    """
    Read the version from pyproject.toml
    """
    try:
        current_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        pyproject_path = os.path.join(current_dir, "pyproject.toml")
        
        with open(pyproject_path, "r") as file:
            content = file.read()
            match = re.search(r'version\s*=\s*"([^"]+)"', content)
            if match:
                return match.group(1)
            return "0.0.0"  # Default version if not found
    except Exception as e:
        print(f"Error reading version: {str(e)}")
        return "0.0.0"  # Default version if error occurs
