-- 001_initial_schema.sql
-- Core tables for the social media platform.
-- Conventions: INT identity primary keys, TIMESTAMPTZ timestamps, ON DELETE CASCADE
-- so deleting a user or post cleans up everything that depends on it.

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------- users
CREATE TABLE users (
  id            INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username      VARCHAR(30)  NOT NULL UNIQUE
                CONSTRAINT users_username_format CHECK (username ~ '^[a-z0-9_]{3,30}$'),
  email         VARCHAR(254) NOT NULL UNIQUE
                CONSTRAINT users_email_lowercase CHECK (email = lower(email)),
  password_hash TEXT         NOT NULL,
  display_name  VARCHAR(50)  NOT NULL,
  bio           VARCHAR(160) NOT NULL DEFAULT '',
  avatar_url    TEXT,
  website       VARCHAR(200),
  location      VARCHAR(80),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- posts
CREATE TABLE posts (
  id         INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    VARCHAR(500) NOT NULL DEFAULT '',
  image_url  TEXT,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  -- A post needs text, an image, or both.
  CONSTRAINT posts_has_content CHECK (length(btrim(content)) > 0 OR image_url IS NOT NULL)
);
-- Profile pages: one user's posts, newest first.
CREATE INDEX posts_user_created_idx ON posts (user_id, created_at DESC, id DESC);
-- Global/explore pagination and feed ordering.
CREATE INDEX posts_created_idx ON posts (created_at DESC, id DESC);

-- ------------------------------------------------------------- comments
CREATE TABLE comments (
  id         INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id    INT          NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    VARCHAR(300) NOT NULL CONSTRAINT comments_not_blank CHECK (length(btrim(content)) > 0),
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX comments_post_created_idx ON comments (post_id, created_at, id);
CREATE INDEX comments_user_idx ON comments (user_id);

-- ---------------------------------------------------------------- likes
CREATE TABLE likes (
  id         INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id    INT         NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    INT         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT likes_unique_per_user UNIQUE (post_id, user_id)
);
CREATE INDEX likes_user_idx ON likes (user_id);

-- -------------------------------------------------------------- follows
CREATE TABLE follows (
  id           INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  follower_id  INT         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id INT         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT follows_unique_pair UNIQUE (follower_id, following_id),
  CONSTRAINT follows_no_self_follow CHECK (follower_id <> following_id)
);
-- "Who follows X?" (the unique index already covers "who does X follow?").
CREATE INDEX follows_following_idx ON follows (following_id);

-- --------------------------------------------------------- notifications
CREATE TABLE notifications (
  id           INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recipient_id INT         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id     INT         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         VARCHAR(20) NOT NULL CONSTRAINT notifications_type_valid CHECK (type IN ('follow', 'like', 'comment')),
  post_id      INT         REFERENCES posts(id) ON DELETE CASCADE,
  is_read      BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT notifications_no_self CHECK (recipient_id <> actor_id)
);
CREATE INDEX notifications_recipient_idx ON notifications (recipient_id, created_at DESC, id DESC);
CREATE INDEX notifications_unread_idx ON notifications (recipient_id) WHERE NOT is_read;

-- ------------------------------------------------- updated_at triggers
CREATE TRIGGER users_set_updated_at    BEFORE UPDATE ON users    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER posts_set_updated_at    BEFORE UPDATE ON posts    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER comments_set_updated_at BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
