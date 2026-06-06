import json
from groq import Groq
from app.core.config import settings
import traceback

client = Groq(api_key=settings.GROQ_API_KEY)
MODEL = "llama-3.3-70b-versatile"

async def generate_pipeline_proposal(
    incoming_schema: dict,
    target_schema: dict,
    sample_rows: list[dict],
    table_metadata: dict,
    retry_msg: str = None
) -> dict:

    system_prompt = """You are a data engineering AI. Your job is to analyze schema 
differences between an incoming dataset and a target database table, 
then generate a safe Python transformation plan.

You must respond with ONLY valid JSON. No explanation text before or 
after. No markdown code fences. Raw JSON only.

Response format:
{
  "drift_detected": [
    {
      "column": "string",
      "issue_type": "RENAME|EXTRA_COLUMN|TYPE_MISMATCH|NULL_VIOLATION|MISSING_REQUIRED",
      "source_value": "string - what the incoming data has",
      "target_expectation": "string - what the target expects",
      "suggested_action": "string - plain english action",
      "severity": "LOW|MEDIUM|HIGH"
    }
  ],
  "proposed_steps": ["string - plain english step 1", "step 2"],
  "generated_code": "string - complete valid Python function",
  "confidence_score": 0.0-1.0,
  "pii_columns_found": ["col1", "col2"],
  "reasoning": "string - 2-3 sentences explaining the decisions made",
  "gateway_recommendation": "AUTO_LINK|SCHEMA_EVOLUTION|CONFLICT"
}

Rules for gateway_recommendation:
- AUTO_LINK: all columns match cleanly, zero or trivial drift 
  (only extra nullable columns), confidence > 0.92
- SCHEMA_EVOLUTION: detectable drift with clear fix available, 
  confidence > 0.75
- CONFLICT: type mismatch on required columns, missing required 
  columns, or confidence <= 0.75

Rules for generated_code:
- Must be a complete Python function: def transform(df: pd.DataFrame) -> pd.DataFrame:
- Import nothing inside the function, assume pandas as pd and hashlib are available
- Must handle every drift item detected
- Must mask PII columns: replace value with SHA256 hash
- Must add processed_at column: pd.Timestamp.now()
- Return the transformed DataFrame"""

    user_message = f"""TARGET TABLE SCHEMA:
{json.dumps(target_schema, indent=2)}

INCOMING DATA SCHEMA (columns detected):
{json.dumps(incoming_schema, indent=2)}

SAMPLE ROWS (first 5):
{json.dumps(sample_rows, indent=2)}

TABLE BUSINESS CONTEXT:
{json.dumps(table_metadata, indent=2)}

Analyze the drift and generate the transformation plan."""

    if retry_msg:
        user_message += f"\n\n{retry_msg}"

    if settings.MOCK_AI:
        # Check incoming schema to determine test case
        cols = list(incoming_schema.keys())
        if "order_amount" in cols:
            # SCHEMA_EVOLUTION mock
            content = json.dumps({
                "drift_detected": [
                    {"column": "order_amount", "issue_type": "RENAME", "source_value": "order_amount", "target_expectation": "amount_usd", "suggested_action": "rename to amount_usd", "severity": "LOW"},
                    {"column": "discount_code", "issue_type": "EXTRA_COLUMN", "source_value": "discount_code", "target_expectation": "none", "suggested_action": "drop column", "severity": "LOW"},
                    {"column": "order_status", "issue_type": "NULL_VIOLATION", "source_value": "null", "target_expectation": "not null", "suggested_action": "fill nulls", "severity": "LOW"}
                ],
                "proposed_steps": ["Rename order_amount", "Drop discount_code", "Fill order_status"],
                "generated_code": 'def transform(df: pd.DataFrame) -> pd.DataFrame:\n    df = df.rename(columns={"order_amount": "amount_usd"})\n    if "discount_code" in df.columns:\n        df = df.drop(columns=["discount_code"])\n    df["order_status"] = df["order_status"].fillna("unknown")\n    df["customer_email"] = df["customer_email"].apply(lambda x: hashlib.sha256(str(x).encode()).hexdigest() if pd.notnull(x) else x)\n    df["processed_at"] = pd.Timestamp.now()\n    df["created_at"] = pd.to_datetime(df["created_at"])\n    return df',
                "confidence_score": 0.85,
                "pii_columns_found": ["customer_email"],
                "reasoning": "Mocked logic",
                "gateway_recommendation": "SCHEMA_EVOLUTION"
            })
        elif "amount_usd" in cols and "customer_email" not in cols:
            # CONFLICT mock
            content = json.dumps({
                "drift_detected": [
                    {"column": "order_id", "issue_type": "TYPE_MISMATCH", "source_value": "string", "target_expectation": "integer", "suggested_action": "cannot convert safely", "severity": "HIGH"},
                    {"column": "customer_email", "issue_type": "MISSING_REQUIRED", "source_value": "missing", "target_expectation": "string", "suggested_action": "missing required column", "severity": "HIGH"}
                ],
                "proposed_steps": ["Fail"],
                "generated_code": 'def transform(df: pd.DataFrame) -> pd.DataFrame:\n    df["created_at"] = pd.to_datetime(df["created_at"])\n    return df',
                "confidence_score": 0.60,
                "pii_columns_found": [],
                "reasoning": "Mocked logic",
                "gateway_recommendation": "CONFLICT"
            })
        else:
            # AUTO_LINK mock
            content = json.dumps({
                "drift_detected": [],
                "proposed_steps": ["Identity transform"],
                "generated_code": 'def transform(df: pd.DataFrame) -> pd.DataFrame:\n    df["customer_email"] = df["customer_email"].apply(lambda x: hashlib.sha256(str(x).encode()).hexdigest() if pd.notnull(x) else x)\n    df["processed_at"] = pd.Timestamp.now()\n    df["created_at"] = pd.to_datetime(df["created_at"])\n    return df',
                "confidence_score": 0.95,
                "pii_columns_found": ["customer_email"],
                "reasoning": "Mocked logic",
                "gateway_recommendation": "AUTO_LINK"
            })
    else:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            temperature=0.1,
            max_tokens=2000
        )
        content = response.choices[0].message.content

    try:
        parsed = json.loads(content)
        return {
            "raw_response": content,
            "prompt_sent": user_message,
            "model_used": MODEL,
            "parsed": parsed
        }
    except json.JSONDecodeError:
        if retry_msg is None:
            return await generate_pipeline_proposal(
                incoming_schema, target_schema, sample_rows, table_metadata, 
                retry_msg="Your previous response was not valid JSON. Respond with ONLY the JSON object, no other text."
            )
        else:
            raise Exception(f"Failed to parse JSON from AI response: {content}")
