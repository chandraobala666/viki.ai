"""
Response serialization utilities for VIKI API routers
"""

def serialize_response(pydantic_obj):
    """Helper function to serialize Pydantic objects with field names instead of aliases"""
    if pydantic_obj is None:
        return None
    return pydantic_obj.model_dump(by_alias=False)


def serialize_response_list(pydantic_objects):
    """Helper function to serialize lists of Pydantic objects with field names"""
    return [serialize_response(obj) for obj in pydantic_objects if obj is not None]
