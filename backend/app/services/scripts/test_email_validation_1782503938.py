def transform(df: pd.DataFrame, config: dict) -> pd.DataFrame:
    email_columns = config.get('columns', [])
    email_providers = config.get('providers', ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com'])
    email_pattern = r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'

    for column in email_columns:
        if column in df.columns:
            df[f'{column}_is_valid'] = df[column].apply(lambda x: bool(pd.Series([x]).str.contains(email_pattern).values[0]) and pd.Series([x]).str.split('@').str[1].values[0].split('.')[-2] in email_providers)
        else:
            raise ValueError(f'The column {column} does not exist in the DataFrame')

    return df