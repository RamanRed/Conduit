from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    GROQ_API_KEY: str
    WAREHOUSE_DB_URL: str
    SOURCE_DB_URL: str
    ENVIRONMENT: str = "development"
    MOCK_AI: bool = False
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "conduit_graph_2026"

    class Config:
        env_file = ".env"

settings = Settings()
