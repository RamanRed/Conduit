def transform(df: pd.DataFrame, config: dict) -> pd.DataFrame:
    # Standardize currencies to standard currency values and format decimal representation.
    columns = config.get("columns", [])
    if not columns:
        columns = [c for c in df.columns if "amount" in c.lower() or "price" in c.lower() or "currency" in c.lower()]
    for col in columns:
        if col in df.columns:
            # Strip currency symbols and commas, then convert to numeric
            df[col] = df[col].astype(str).str.replace(r'[^\d\.]', '', regex=True)
            df[col] = pd.to_numeric(df[col], errors='coerce')
    return df
