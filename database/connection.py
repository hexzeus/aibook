"""
Database connection manager for PostgreSQL
"""
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool
from contextlib import contextmanager
import os
from typing import Generator
import logging

from .models import Base

logger = logging.getLogger(__name__)


class DatabaseManager:
    """
    Database connection manager with connection pooling
    """

    def __init__(self, database_url: str = None):
        """
        Initialize database connection

        Args:
            database_url: PostgreSQL connection string
                         Format: postgresql://user:password@host:port/database
                         If not provided, reads from DATABASE_URL environment variable
        """
        self.database_url = database_url or os.getenv('DATABASE_URL')

        if not self.database_url:
            raise ValueError(
                "Database URL must be provided or set in DATABASE_URL environment variable.\n"
                "Format: postgresql://user:password@host:port/database"
            )

        # Handle Render.com DATABASE_URL format (postgres:// -> postgresql://)
        if self.database_url.startswith('postgres://'):
            self.database_url = self.database_url.replace('postgres://', 'postgresql://', 1)

        # Create engine with optimized connection pooling for production
        self.engine = create_engine(
            self.database_url,
            poolclass=QueuePool,
            pool_size=10,  # Increased for better concurrency
            max_overflow=20,  # Allow bursts of traffic
            pool_pre_ping=True,  # Test connections before using them
            pool_recycle=1800,  # Recycle connections after 30 minutes
            pool_timeout=30,  # Increased timeout for high traffic
            echo=False,  # Set to True for SQL query logging (development only)
            connect_args={
                "options": "-c statement_timeout=60000 -c idle_in_transaction_session_timeout=10000"
                # 60s statement timeout, 10s idle transaction timeout
            }
        )

        # Create session factory
        self.SessionLocal = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=self.engine,
            expire_on_commit=False  # Prevent detached instance errors
        )

        logger.info("Database connection manager initialized")

    def create_tables(self):
        """
        Create all tables defined in models
        Only creates tables that don't exist yet
        """
        try:
            Base.metadata.create_all(bind=self.engine)
            logger.info("Database tables created successfully")
        except Exception as e:
            logger.error(f"Failed to create database tables: {e}")
            raise

    def drop_tables(self):
        """
        Drop all tables (USE WITH CAUTION!)
        Only use in development or for complete database reset
        """
        logger.warning("Dropping all database tables")
        Base.metadata.drop_all(bind=self.engine)
        logger.info("All tables dropped")

    @contextmanager
    def get_session(self) -> Generator[Session, None, None]:
        """
        Context manager for database sessions
        Automatically commits on success, rolls back on error

        Usage:
            with db_manager.get_session() as session:
                user = session.query(User).filter_by(license_key=key).first()
        """
        session = self.SessionLocal()
        try:
            yield session
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"Database session error: {e}")
            raise
        finally:
            session.close()

    def get_db_session(self) -> Session:
        """
        Get a new database session
        Must be closed manually or used with FastAPI Depends

        Returns:
            Session: SQLAlchemy session
        """
        return self.SessionLocal()

    def close(self):
        """Close all database connections"""
        self.engine.dispose()
        logger.info("Database connections closed")

    def health_check(self) -> bool:
        """
        Check if database is accessible

        Returns:
            bool: True if database is accessible, False otherwise
        """
        try:
            with self.get_session() as session:
                session.execute(text("SELECT 1"))
            return True
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False

    def cleanup_idle_transactions(self):
        """
        Terminate idle transactions and blocked queries
        Should be called on startup to clean up stale connections
        """
        try:
            with self.get_session() as session:
                # First, terminate all idle in transaction sessions
                result1 = session.execute(text("""
                    SELECT pg_terminate_backend(pid)
                    FROM pg_stat_activity
                    WHERE datname = current_database()
                    AND state = 'idle in transaction'
                """))
                idle_terminated = result1.rowcount

                # Then, terminate all blocked queries (they're stuck waiting)
                result2 = session.execute(text("""
                    SELECT pg_terminate_backend(pid)
                    FROM pg_stat_activity
                    WHERE datname = current_database()
                    AND cardinality(pg_blocking_pids(pid)) > 0
                """))
                blocked_terminated = result2.rowcount

                total = idle_terminated + blocked_terminated
                if total > 0:
                    logger.warning(f"Terminated {idle_terminated} idle + {blocked_terminated} blocked transactions on startup")
                return total
        except Exception as e:
            logger.error(f"Failed to cleanup idle transactions: {e}")
            return 0


# Global database manager instance
db_manager = None


def initialize_database(database_url: str = None) -> DatabaseManager:
    """
    Initialize global database manager

    Args:
        database_url: PostgreSQL connection string

    Returns:
        DatabaseManager: Initialized database manager
    """
    global db_manager
    db_manager = DatabaseManager(database_url)
    return db_manager


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency for database sessions

    Usage in FastAPI routes:
        @app.get("/users")
        def get_users(db: Session = Depends(get_db)):
            return db.query(User).all()
    """
    if db_manager is None:
        raise RuntimeError("Database not initialized. Call initialize_database() first.")

    db = db_manager.get_db_session()
    try:
        yield db
    finally:
        db.close()


def get_db_manager() -> DatabaseManager:
    """
    Get global database manager instance

    Returns:
        DatabaseManager: Global database manager

    Raises:
        RuntimeError: If database not initialized
    """
    if db_manager is None:
        raise RuntimeError("Database not initialized. Call initialize_database() first.")
    return db_manager
