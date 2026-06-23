import logging
from typing import Any, AsyncGenerator
from neo4j import AsyncGraphDatabase
from app.core.config import settings

logger = logging.getLogger("conduit.neo4j")
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(levelname)s:     %(message)s"))
    logger.addHandler(handler)
    logger.propagate = False

class Neo4jClient:
    def __init__(self) -> None:
        self.driver = None

    async def connect(self) -> None:
        """Initialize the Neo4j driver and verify connection."""
        if self.driver is not None:
            return
        
        uri = settings.NEO4J_URI
        user = settings.NEO4J_USER
        password = settings.NEO4J_PASSWORD
        
        logger.info(f"Connecting to Neo4j at {uri}...")
        try:
            self.driver = AsyncGraphDatabase.driver(
                uri,
                auth=(user, password)
            )
            # Verify connectivity
            await self.driver.verify_connectivity()
            logger.info("Connected to Neo4j successfully!")
            
            # Setup schema constraints
            await self.init_schema()
        except Exception as exc:
            logger.error(f"Failed to connect to Neo4j: {exc}")
            self.driver = None
            raise exc

    async def init_schema(self) -> None:
        """Create constraints and indexes in Neo4j."""
        if self.driver is None:
            return
        
        async with self.driver.session() as session:
            # Enforce uniqueness on entity_id for all GraphNode labeled nodes
            logger.info("Creating Neo4j uniqueness constraints...")
            await session.run(
                "CREATE CONSTRAINT uq_graph_node_entity_id IF NOT EXISTS "
                "FOR (n:GraphNode) REQUIRE n.entity_id IS UNIQUE"
            )

    async def close(self) -> None:
        """Close the Neo4j driver cleanly."""
        if self.driver is not None:
            logger.info("Closing Neo4j connection...")
            await self.driver.close()
            self.driver = None
            logger.info("Neo4j connection closed.")

    def get_driver(self) -> Any:
        if self.driver is None:
            raise RuntimeError("Neo4j driver is not initialized. Call connect() first.")
        return self.driver

    async def execute_query(self, query: str, parameters: dict = None) -> list:
        """Helper to run a query in an async read/write session and return records as dicts."""
        if self.driver is None:
            raise RuntimeError("Neo4j driver is not initialized.")
        
        async with self.driver.session() as session:
            result = await session.run(query, parameters or {})
            records = await result.data()
            return records

# Singleton instance
neo4j_client = Neo4jClient()
