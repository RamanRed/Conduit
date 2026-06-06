import magic
import ast

def validate_magic_bytes(file_bytes: bytes, declared_extension: str) -> tuple[bool, str]:
    if len(file_bytes) == 0:
        return False, "File is empty"
    if len(file_bytes) > 50 * 1024 * 1024:
        return False, "File is too large (max 50MB)"
        
    detected = magic.from_buffer(file_bytes, mime=True)
    ext = declared_extension.lower()
    if ext == '.csv':
        if detected not in ['text/plain', 'text/csv', 'application/csv']:
            return False, f"Expected CSV, detected {detected}"
    elif ext == '.json':
        if detected != 'application/json':
            return False, f"Expected JSON, detected {detected}"
    else:
        return False, f"Unsupported file extension: {declared_extension}"
            
    return True, ""

def validate_generated_code(code_string: str) -> tuple[bool, str]:
    try:
        ast.parse(code_string)
    except SyntaxError as e:
        return False, f"Syntax error at line {e.lineno}: {e.msg}"

    if "def transform(df" not in code_string:
        return False, "Function def transform(df: pd.DataFrame) not found"
    if "return " not in code_string:
        return False, "Function must return a value"
        
    unsafe_terms = ["import os", "import sys", "subprocess", "eval(", "exec("]
    for term in unsafe_terms:
        if term in code_string:
            return False, "unsafe code detected"

    return True, ""
