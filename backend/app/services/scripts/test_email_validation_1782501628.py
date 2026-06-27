def transform(df: pd.DataFrame, config: dict) -> pd.DataFrame:
    # Implement: Validates email format and domain against known providers.
    columns = config.get("columns", [])
    for col in columns:
        if col in df.columns:
            pass
    return df
