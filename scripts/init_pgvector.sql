-- ============================================================
-- PostgreSQL initialization: enable pgvector extension
-- This runs automatically on first container startup
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
