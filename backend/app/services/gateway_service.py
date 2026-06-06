def classify_gateway_state(
    ai_recommendation: str,
    drift_items: list[dict],
    confidence_score: float
) -> str:
    # Force CONFLICT
    if confidence_score < 0.70:
        return "CONFLICT"
    for item in drift_items:
        if item.get("severity") == "HIGH" and item.get("issue_type") == "TYPE_MISMATCH":
            return "CONFLICT"
        if item.get("issue_type") == "MISSING_REQUIRED":
            return "CONFLICT"

    # Force SCHEMA_EVOLUTION
    if len(drift_items) >= 3:
        return "SCHEMA_EVOLUTION"
    if 0.70 <= confidence_score <= 0.88:
        return "SCHEMA_EVOLUTION"
    for item in drift_items:
        if item.get("severity") == "MEDIUM":
            return "SCHEMA_EVOLUTION"

    return ai_recommendation
