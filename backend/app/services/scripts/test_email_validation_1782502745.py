def transform(df: pd.DataFrame, config: dict) -> pd.DataFrame:
    # Define a function to validate email format
    def validate_email_format(email):
        pattern = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
        return bool(re.match(pattern, email))

    # Define a function to validate email domain
    def validate_email_domain(email):
        known_providers = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com']
        domain = email.split('@')[-1]
        return domain in known_providers

    # Apply the validation functions to the specified columns
    for column in config.get('columns', []):
        if column in df.columns:
            df[f'{column}_is_valid_format'] = df[column].apply(validate_email_format)
            df[f'{column}_is_valid_domain'] = df[column].apply(validate_email_domain)

    return df