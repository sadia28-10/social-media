-- 002_search_indexes.sql
-- Trigram indexes make ILIKE '%text%' searches fast enough for user and post search.
-- pg_trgm ships with PostgreSQL (contrib) and is available on Render, Neon, Supabase and Railway.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX users_username_trgm_idx     ON users USING gin (username gin_trgm_ops);
CREATE INDEX users_display_name_trgm_idx ON users USING gin (display_name gin_trgm_ops);
CREATE INDEX posts_content_trgm_idx      ON posts USING gin (content gin_trgm_ops);
