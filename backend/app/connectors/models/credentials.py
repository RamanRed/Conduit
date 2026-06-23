"""
models/credentials.py
─────────────────────
Pydantic credential schemas — one model per provider,
parameter names match the official documentation exactly.

Adding a new provider = add its class here + register in CRED_MODELS.
"""

from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional, Literal
from enum import Enum


# ── Supported DB Types ─────────────────────────────────────────────────────────

class DBType(str, Enum):
    POSTGRESQL = "postgresql"
    MYSQL      = "mysql"
    MONGODB    = "mongodb"
    NEO4J      = "neo4j"
    SUPABASE   = "supabase"
    DATABRICKS = "databricks"
    SNOWFLAKE  = "snowflake"
    REDIS      = "redis"
    PINECONE   = "pinecone"
    BIGQUERY   = "bigquery"
    SQLITE     = "sqlite"
    CLICKHOUSE = "clickhouse"


# ── Per-Provider Credential Models ─────────────────────────────────────────────
# Field names follow official driver / connection docs.

class PostgreSQLCreds(BaseModel):
    """
    Official params: PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD, PGSSLMODE
    Ref: https://www.postgresql.org/docs/current/libpq-envars.html
    """
    host:        str
    port:        int = 5432
    database:    str                                                            # PGDATABASE / dbname
    user:        str                                                            # PGUSER
    password:    str
    sslmode:     Optional[Literal["disable","allow","prefer",
                                   "require","verify-ca","verify-full"]] = "prefer"
    sslrootcert: Optional[str] = None
    hostaddr:    Optional[str] = None


class MySQLCreds(BaseModel):
    """
    Official params: Host, Port, Database, Username, Password, SSL
    Ref: https://dev.mysql.com/doc/refman/8.0/en/connecting.html
    """
    host:     str
    port:     int = 3306
    database: str
    user:     str
    password: str
    ssl:      bool = False
    ssl_ca:   Optional[str] = None
    ssl_cert: Optional[str] = None
    ssl_key:  Optional[str] = None


class MongoDBCreds(BaseModel):
    """
    Official params: connection string URI or individual host/port + auth options
    Ref: https://www.mongodb.com/docs/manual/reference/connection-string/
    """
    connection_string:        Optional[str]  = None        # mongodb:// URI (takes priority)
    host:                     Optional[str]  = None
    port:                     Optional[int]  = 27017
    username:                 Optional[str]  = None
    password:                 Optional[str]  = None
    authentication_source:    str            = "admin"     # authSource
    authentication_mechanism: Optional[str]  = None        # e.g. SCRAM-SHA-256
    replica_set:              Optional[str]  = None        # replicaSet
    tls:                      bool           = False

    def resolved_uri(self) -> str:
        if self.connection_string:
            return self.connection_string
        auth = ""
        if self.username:
            auth = f"{self.username}:{self.password}@"
        tls_param = "?tls=true" if self.tls else ""
        return f"mongodb://{auth}{self.host}:{self.port}{tls_param}"


class Neo4jCreds(BaseModel):
    """
    Official params: host/uri, login, password, database, encryption
    Ref: https://neo4j.com/docs/driver-manual/current/client-applications/#driver-connection-uri
    Note: Neo4j calls the username field 'login', not 'user'.
    """
    uri:        Optional[str] = None          # bolt:// or neo4j:// (takes priority)
    host:       Optional[str] = None
    port:       int           = 7687
    login:      str                           # 'login' — as per Neo4j driver docs
    password:   str
    database:   str           = "neo4j"
    encryption: bool          = False

    def resolved_uri(self) -> str:
        return self.uri or f"bolt://{self.host}:{self.port}"


class SupabaseCreds(BaseModel):
    """
    Official params: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
    For direct Postgres access: database_host, database_password
    Ref: https://supabase.com/docs/guides/api/api-keys
    SECURITY: service_role_key must NEVER be exposed to the browser.
    """
    supabase_url:              str
    supabase_service_role_key: str            # Backend-only — never send to browser
    database_host:             Optional[str]  = None   # db.<ref>.supabase.co
    database_password:         Optional[str]  = None
    database_port:             int            = 5432
    database_name:             str            = "postgres"


class DatabricksCreds(BaseModel):
    """
    Official params: server_hostname (host), http_path, access_token, catalog, schema
    Ref: https://docs.databricks.com/integrations/jdbc-odbc-bi.html
    """
    host:         str                          # workspace host / server_hostname
    http_path:    str                          # /sql/1.0/warehouses/<id>
    access_token: str
    catalog:      Optional[str] = None
    schema_name:  Optional[str] = None         # 'schema' reserved in Python


class SnowflakeCreds(BaseModel):
    """
    Official params: account, user, password, warehouse, database, schema, role
    Ref: https://docs.snowflake.com/en/developer-guide/python-connector/python-connector-connect
    """
    account:     str
    user:        str
    password:    str
    warehouse:   Optional[str] = None
    database:    Optional[str] = None
    schema_name: Optional[str] = None         # maps to 'schema' param
    role:        Optional[str] = None


class RedisCreds(BaseModel):
    """
    Official params: redis:// or rediss:// URI, or host/port/password/username/db
    Ref: https://redis.io/docs/connect/clients/python/
    """
    url:      Optional[str] = None            # redis://[:password@]host[:port][/db]
    host:     Optional[str] = None
    port:     int           = 6379
    password: Optional[str] = None
    username: Optional[str] = None
    db:       int           = 0

    def resolved_url(self) -> str:
        if self.url:
            return self.url
        auth = ""
        if self.username and self.password:
            auth = f"{self.username}:{self.password}@"
        elif self.password:
            auth = f":{self.password}@"
        return f"redis://{auth}{self.host or 'localhost'}:{self.port}/{self.db}"


class PineconeCreds(BaseModel):
    """
    Official params: api_key, index_name, environment (legacy), namespace
    Ref: https://docs.pinecone.io/docs/quickstart
    """
    api_key:     str
    index_name:  Optional[str] = None
    environment: Optional[str] = None        # Legacy (pre-serverless)
    project_id:  Optional[str] = None
    namespace:   Optional[str] = None


class BigQueryCreds(BaseModel):
    """
    Official params: project_id, service account JSON, dataset, location
    Ref: https://cloud.google.com/bigquery/docs/authentication/service-account-file
    """
    project_id:           str
    service_account_json: str               # Full JSON content as string
    dataset:              Optional[str] = None
    location:             str           = "US"


class SQLiteCreds(BaseModel):
    """
    SQLite is file-based — only needs a file path.
    Ref: https://docs.python.org/3/library/sqlite3.html
    """
    file_path: str


class ClickHouseCreds(BaseModel):
    """
    Official params: host, port, database, username, password, protocol/TLS
    Ref: https://clickhouse.com/docs/en/integrations/python
    """
    host:     str
    port:     int         = 8123
    database: str         = "default"
    username: str         = "default"        # 'username' — not 'user'
    password: Optional[str] = ""
    tls:      bool        = False


# ── Request / Response DTOs ────────────────────────────────────────────────────

class ConnectionRequest(BaseModel):
    conn_id:      str  = Field(..., min_length=1, max_length=64,
                               pattern=r"^[a-zA-Z0-9_-]+$",
                               description="Unique ID — letters, numbers, hyphens, underscores")
    db_type:      DBType
    credentials:  dict
    read_only:    bool          = True
    display_name: Optional[str] = None


class QueryRequest(BaseModel):
    conn_id: str
    query:   str
    params:  Optional[dict] = None
    limit:   int             = Field(1000, ge=1, le=10_000)


# ── Credential Validator Registry ──────────────────────────────────────────────
# ADDING A NEW PROVIDER: Add its model class above, then add one line here.

CRED_MODELS: dict = {
    "postgresql": PostgreSQLCreds,
    "postgres":   PostgreSQLCreds,    # alias
    "mysql":      MySQLCreds,
    "mongodb":    MongoDBCreds,
    "neo4j":      Neo4jCreds,
    "supabase":   SupabaseCreds,
    "databricks": DatabricksCreds,
    "snowflake":  SnowflakeCreds,
    "redis":      RedisCreds,
    "pinecone":   PineconeCreds,
    "bigquery":   BigQueryCreds,
    "sqlite":     SQLiteCreds,
    "clickhouse": ClickHouseCreds,
}


def validate_credentials(db_type: str, raw: dict) -> BaseModel:
    """Validate a raw credentials dict against the provider's Pydantic model."""
    model = CRED_MODELS.get(db_type.lower())
    if not model:
        raise ValueError(f"Unknown provider '{db_type}'. "
                         f"Supported: {list(CRED_MODELS.keys())}")
    return model(**raw)
