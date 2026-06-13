import magic
import ast

FORBIDDEN_METHODS = {
    "quantile",
    "describe",
    "corr",
    "cov",
    "kurt",
    "kurtosis",
    "skew",
    "sem",
    "var",
    "std",
    "mean",
    "median",
    "mode",
    "pct_change",
    "diff",
    "rank",
    "rolling",
    "ewm",
    "expanding",
    "groupby",
    "resample",
    "pivot_table",
    "crosstab",
    "melt",
    "wide_to_long",
    "merge",
    "join",
    "concat",
    "eval",
    "query",
}

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

    tree = ast.parse(code_string)
    for node in ast.walk(tree):
        if isinstance(node, ast.Attribute):
            if node.attr in FORBIDDEN_METHODS:
                return False, (
                    f"Generated code uses forbidden method '.{node.attr}()'. "
                    "Statistical and aggregation operations are not permitted "
                    "in schema transformation scripts. Only column mapping, "
                    "renaming, type casting, null filling, and string "
                    "normalization are allowed."
                )

    return True, ""
