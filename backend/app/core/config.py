from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    GROQ_API_KEY: str
    WAREHOUSE_DB_URL: str
    SOURCE_DB_URL: str
    ENVIRONMENT: str = "development"
    MOCK_AI: bool = False

    class Config:
        env_file = ".env"

settings = Settings()
