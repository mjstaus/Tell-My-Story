DROP TABLE IF EXISTS contribution_votes CASCADE;

CREATE TABLE contribution_votes (
  id SERIAL PRIMARY KEY NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contribution_id INTEGER NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
  story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE
);
