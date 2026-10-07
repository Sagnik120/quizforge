import os
import tempfile

# Tests always run against a throwaway SQLite file, never the real database.
# This must be set before anything imports app.core.config.
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{os.path.join(tempfile.mkdtemp(), 'quizforge_test.db')}"
