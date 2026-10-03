CREATE TABLE IF NOT EXISTS public_task_completions (
  task_id TEXT NOT NULL REFERENCES task_submissions(id), user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL, PRIMARY KEY(task_id,user_id)
);
