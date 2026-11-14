def ev(value):
    """The plain string of a status/priority/type, whether the database gave back an Enum member or already a str.
    These columns are String, so a row reloaded from the database holds a str and `.value` on it raises AttributeError."""
    return getattr(value, "value", value)
