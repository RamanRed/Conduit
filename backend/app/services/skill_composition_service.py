"""
Skill Composition Service  —  Phase 2
======================================
Replaces raw exec(generated_code) with a validated, pre-audited skill pipeline.

The AI now returns an *optional* skill_composition_plan alongside generated_code.
This service:
  1. Validates the plan structure.
  2. Executes each skill using a pre-validated, bounded Python function.
  3. Generates human-readable audit code (never exec'd — for the ledger only).
  4. Falls back to AI-generated raw code when no plan is present or valid.

Skill implementations follow a single contract:
    fn(df: pd.DataFrame, config: dict) -> pd.DataFrame

No arbitrary imports, no filesystem access, no network calls.
Each skill is a typed, bounded, testable pandas transformation.

Available skills
----------------
  rename_column       Rename columns via a mapping dict
  fill_nulls          Fill nulls with a constant value or strategy
  pii_masking         SHA-256 hash PII columns
  drop_extra_columns  Remove columns absent from the target schema
  type_conversion     Cast column data types
  deduplicate_records Remove duplicate rows by key
  add_processed_at    Inject a processed_at timestamp
  normalize_dates     Parse string dates to datetime
"""

from __future__ import annotations

import hashlib
from typing import Dict, List, Optional, Tuple

import pandas as pd


# ─────────────────────────────────────────────────────────────────────────────
#  Validated skill implementations
# ─────────────────────────────────────────────────────────────────────────────

def _rename_column(df: pd.DataFrame, config: dict) -> pd.DataFrame:
    """
    Rename columns.
    config: {"mapping": {"old_name": "new_name", ...}}
    """
    mapping = config.get("mapping", {})
    if not mapping:
        return df
    applicable = {k: v for k, v in mapping.items() if k in df.columns}
    return df.rename(columns=applicable) if applicable else df


def _fill_nulls(df: pd.DataFrame, config: dict) -> pd.DataFrame:
    """
    Fill null values.
    config: {"columns": [list], "default": "unknown", "strategy": "constant|ffill|mean"}
    If columns is empty, targets all object-dtype columns.
    """
    columns  = config.get("columns", [])
    default  = config.get("default", "unknown")
    strategy = config.get("strategy", "constant")

    if isinstance(columns, str):
        columns = [columns]
    if not columns:
        columns = list(df.select_dtypes(include=["object"]).columns)

    for col in columns:
        if col not in df.columns:
            continue
        if strategy == "ffill":
            df[col] = df[col].ffill()
        elif strategy == "mean" and pd.api.types.is_numeric_dtype(df[col]):
            df[col] = df[col].fillna(df[col].mean())
        else:
            df[col] = df[col].fillna(default)
    return df


def _pii_masking(df: pd.DataFrame, config: dict) -> pd.DataFrame:
    """
    SHA-256 hash PII columns.
    config: {"columns": ["customer_email", "phone", ...]}
    """
    columns = config.get("columns", [])
    if isinstance(columns, str):
        columns = [columns]

    def _hash(x):
        return hashlib.sha256(str(x).encode("utf-8")).hexdigest() if pd.notnull(x) else x

    for col in columns:
        if col in df.columns:
            df[col] = df[col].apply(_hash)
    return df


def _drop_extra_columns(df: pd.DataFrame, config: dict) -> pd.DataFrame:
    """
    Drop unwanted columns.
    config: {"drop": [col1, col2]}
         OR {"target_columns": [col1, col2]}  (keep only these)
    """
    drop_list    = config.get("drop", [])
    keep_columns = config.get("target_columns", [])

    if drop_list:
        to_drop = [c for c in drop_list if c in df.columns]
        if to_drop:
            df = df.drop(columns=to_drop)
    elif keep_columns:
        to_drop = [c for c in df.columns if c not in keep_columns]
        if to_drop:
            df = df.drop(columns=to_drop)
    return df


def _type_conversion(df: pd.DataFrame, config: dict) -> pd.DataFrame:
    """
    Cast column data types.
    config: {"conversions": {"col_name": "int|float|datetime|str|bool"}}
    Silently skips columns that cannot be converted.
    """
    conversions = config.get("conversions", {})
    for col, target_type in conversions.items():
        if col not in df.columns:
            continue
        t = str(target_type).lower()
        try:
            if t in ("int", "integer"):
                df[col] = pd.to_numeric(df[col], errors="coerce").astype("Int64")
            elif t in ("float", "decimal", "double", "numeric"):
                df[col] = pd.to_numeric(df[col], errors="coerce")
            elif t in ("datetime", "timestamp", "date"):
                df[col] = pd.to_datetime(df[col], errors="coerce")
            elif t in ("str", "string", "varchar", "text", "character varying"):
                df[col] = df[col].astype(str)
            elif t in ("bool", "boolean"):
                df[col] = df[col].astype(bool)
        except Exception:
            pass  # Leave column unchanged — silent resilience
    return df


def _deduplicate_records(df: pd.DataFrame, config: dict) -> pd.DataFrame:
    """
    Remove duplicate rows.
    config: {"key_columns": [...], "keep": "last|first"}
    """
    key_columns = config.get("key_columns", [])
    keep        = config.get("keep", "last")
    keep_val    = False if str(keep).lower() == "false" else keep

    if key_columns:
        existing = [c for c in key_columns if c in df.columns]
        if existing:
            df = df.drop_duplicates(subset=existing, keep=keep_val)
    else:
        df = df.drop_duplicates(keep=keep_val)
    return df


def _add_processed_at(df: pd.DataFrame, config: dict) -> pd.DataFrame:
    """
    Inject a processed_at timestamp.
    config: {"column_name": "processed_at"}
    """
    col = config.get("column_name", "processed_at")
    df[col] = pd.Timestamp.now()
    return df


def _normalize_dates(df: pd.DataFrame, config: dict) -> pd.DataFrame:
    """
    Parse date/datetime strings to pd.Timestamp.
    config: {"columns": ["created_at", "updated_at", ...]}
    """
    columns = config.get("columns", [])
    if isinstance(columns, str):
        columns = [columns]

    for col in columns:
        if col not in df.columns:
            continue
        try:
            df[col] = pd.to_datetime(df[col], errors="coerce")
        except Exception:
            pass
    return df


# ─────────────────────────────────────────────────────────────────────────────
#  Dispatch table  (skill_name → implementation function)
# ─────────────────────────────────────────────────────────────────────────────

SKILL_DISPATCH: Dict[str, callable] = {
    "rename_column":       _rename_column,
    "fill_nulls":          _fill_nulls,
    "pii_masking":         _pii_masking,
    "drop_extra_columns":  _drop_extra_columns,
    "type_conversion":     _type_conversion,
    "deduplicate_records": _deduplicate_records,
    "add_processed_at":    _add_processed_at,
    "normalize_dates":     _normalize_dates,
}

AVAILABLE_SKILLS: List[str] = list(SKILL_DISPATCH.keys())


# ─────────────────────────────────────────────────────────────────────────────
#  Validation
# ─────────────────────────────────────────────────────────────────────────────

def validate_skill_plan(plan: list) -> Tuple[bool, str]:
    """
    Validate a skill composition plan before execution.
    Returns (is_valid, error_message).
    """
    if not isinstance(plan, list):
        return False, f"Skill plan must be a list, got {type(plan).__name__}"

    if len(plan) == 0:
        return False, "Skill plan is empty"

    for i, step in enumerate(plan):
        if not isinstance(step, dict):
            return False, f"Step {i} must be a dict, got {type(step).__name__}"
        if "name" not in step:
            return False, f"Step {i} is missing the required 'name' field"
        skill_name = step["name"]
        if skill_name not in SKILL_DISPATCH:
            return (
                False,
                f"Step {i} references unknown skill '{skill_name}'. "
                f"Available: {AVAILABLE_SKILLS}",
            )

    return True, ""


# ─────────────────────────────────────────────────────────────────────────────
#  Pipeline execution
# ─────────────────────────────────────────────────────────────────────────────

def compose_pipeline(
    skill_plan: List[dict],
    df: pd.DataFrame,
) -> Tuple[pd.DataFrame, List[str]]:
    """
    Execute a skill composition plan sequentially against a DataFrame.

    Args:
        skill_plan: [{"name": str, "config": dict}, ...]
        df:         Input DataFrame (will be copied internally)

    Returns:
        (transformed_df, applied_skill_names)

    Raises:
        ValueError:  if the plan is structurally invalid.
        RuntimeError: if a skill function raises during execution.
    """
    is_valid, err = validate_skill_plan(skill_plan)
    if not is_valid:
        raise ValueError(f"Invalid skill plan: {err}")

    applied: List[str] = []
    current_df = df.copy()

    for step in skill_plan:
        name   = step["name"]
        config = step.get("config", {})
        fn     = SKILL_DISPATCH[name]

        try:
            current_df = fn(current_df, config)
            applied.append(name)
        except Exception as exc:
            raise RuntimeError(f"Skill '{name}' failed during execution: {exc}") from exc

    # Guarantee processed_at is always present in the output
    if "processed_at" not in current_df.columns:
        current_df["processed_at"] = pd.Timestamp.now()

    return current_df, applied


# ─────────────────────────────────────────────────────────────────────────────
#  Plan extraction helpers
# ─────────────────────────────────────────────────────────────────────────────

def extract_composition_plan(ai_response: dict) -> Optional[List[dict]]:
    """
    Extract a skill composition plan from the AI response dict.

    Handles two formats:
      • Structured: {"mode": "COMPOSE", "skills": [...]}
      • Flat list:  [{"name": ..., "config": ...}, ...]

    Returns None when no valid plan is present (raw code path).
    """
    plan = ai_response.get("skill_composition_plan")
    if not plan:
        return None

    if isinstance(plan, dict):
        mode = plan.get("mode", "RAW").upper()
        if mode == "COMPOSE":
            skills = plan.get("skills", [])
            if skills:
                return skills
        return None

    if isinstance(plan, list) and len(plan) > 0:
        return plan

    return None


# ─────────────────────────────────────────────────────────────────────────────
#  Audit code generation  (human-readable — NOT exec()d)
# ─────────────────────────────────────────────────────────────────────────────

def generate_composed_code(skill_plan: List[dict]) -> str:
    """
    Produce a human-readable Python function for the audit ledger.
    This code represents what the skill pipeline did.  It is stored
    for inspection purposes and is NEVER passed to exec().
    """
    lines = [
        "def transform(df: pd.DataFrame) -> pd.DataFrame:",
        f"    # Generated by Skill Composition Engine — {len(skill_plan)} skill(s)",
        "    import hashlib",
    ]

    for step in skill_plan:
        name   = step["name"]
        config = step.get("config", {})
        lines.append(f"\n    # ── {name} " + "─" * max(0, 50 - len(name)))

        if name == "rename_column":
            m = config.get("mapping", {})
            lines.append(f"    df = df.rename(columns={m!r})")

        elif name == "fill_nulls":
            cols = config.get("columns", [])
            dflt = config.get("default", "unknown")
            if cols:
                for col in cols:
                    lines.append(f"    df[{col!r}] = df[{col!r}].fillna({dflt!r})")
            else:
                lines.append(f"    # (fills all object columns with {dflt!r})")

        elif name == "pii_masking":
            for col in config.get("columns", []):
                lines.append(
                    f"    df[{col!r}] = df[{col!r}].apply(\n"
                    f"        lambda x: hashlib.sha256(str(x).encode()).hexdigest() "
                    f"if pd.notnull(x) else x)"
                )

        elif name == "drop_extra_columns":
            drop  = config.get("drop", [])
            keeps = config.get("target_columns", [])
            if drop:
                lines.append(f"    df = df.drop(columns={drop!r}, errors='ignore')")
            elif keeps:
                lines.append(
                    f"    df = df[[c for c in df.columns if c in {keeps!r}]]"
                )

        elif name == "type_conversion":
            for col, typ in config.get("conversions", {}).items():
                t = typ.lower()
                if t in ("int", "integer"):
                    lines.append(
                        f"    df[{col!r}] = pd.to_numeric(df[{col!r}], errors='coerce').astype('Int64')"
                    )
                elif t in ("float", "decimal"):
                    lines.append(
                        f"    df[{col!r}] = pd.to_numeric(df[{col!r}], errors='coerce')"
                    )
                elif t in ("datetime", "timestamp"):
                    lines.append(
                        f"    df[{col!r}] = pd.to_datetime(df[{col!r}], errors='coerce')"
                    )
                else:
                    lines.append(f"    df[{col!r}] = df[{col!r}].astype({typ!r})")

        elif name == "deduplicate_records":
            keys = config.get("key_columns", [])
            keep = config.get("keep", "last")
            sub  = f", subset={keys!r}" if keys else ""
            lines.append(f"    df = df.drop_duplicates{sub}, keep={keep!r})")

        elif name == "add_processed_at":
            col = config.get("column_name", "processed_at")
            lines.append(f"    df[{col!r}] = pd.Timestamp.now()")

        elif name == "normalize_dates":
            for col in config.get("columns", []):
                lines.append(
                    f"    df[{col!r}] = pd.to_datetime(df[{col!r}], errors='coerce')"
                )

        else:
            lines.append(f"    pass  # skill '{name}' — no render template")

    lines += [
        "",
        "    # Guarantee processed_at is always present",
        "    if 'processed_at' not in df.columns:",
        "        df['processed_at'] = pd.Timestamp.now()",
        "    return df",
    ]
    return "\n".join(lines)


# ─────────────────────────────────────────────────────────────────────────────
#  Prompt helper — injected into the AI system prompt
# ─────────────────────────────────────────────────────────────────────────────

def get_skills_prompt_section() -> str:
    """
    Return the skill composition section for the AI system prompt.
    Instructs the AI on how to produce a skill_composition_plan.
    """
    desc_map = {
        "rename_column":       'Config: {"mapping": {"old": "new", ...}}',
        "fill_nulls":          'Config: {"columns": [...], "default": "unknown", "strategy": "constant|ffill|mean"}',
        "pii_masking":         'Config: {"columns": ["customer_email", "phone", ...]}',
        "drop_extra_columns":  'Config: {"drop": [col, ...]} OR {"target_columns": [col, ...]}',
        "type_conversion":     'Config: {"conversions": {"col": "int|float|datetime|str"}}',
        "deduplicate_records": 'Config: {"key_columns": [...], "keep": "last|first"}',
        "add_processed_at":    'Config: {"column_name": "processed_at"}',
        "normalize_dates":     'Config: {"columns": ["created_at", ...]}',
    }

    lines = [
        "",
        "## Skill Composition (strongly preferred over raw Python generation)",
        "The execution engine runs pre-validated skill implementations when a valid",
        "skill_composition_plan is provided. This is safer and faster than arbitrary code.",
        "ALWAYS include generated_code as a fallback even when providing a composition plan.",
        "",
        "Available composition skills:",
    ]
    for name, cfg_hint in desc_map.items():
        lines.append(f'  • {name}: {cfg_hint}')

    lines += [
        "",
        "skill_composition_plan JSON format:",
        '  {"mode": "COMPOSE", "skills": [{"name": "skill_name", "config": {...}}, ...]}',
        "",
        'If the drift cannot be fully handled by available skills, set mode to "RAW"',
        "or omit skill_composition_plan entirely and rely on generated_code.",
    ]
    return "\n".join(lines)
