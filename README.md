# MathCoaster

A cool game that will remind you of your algebra class.

## Database

The SQLite database file (`mathcoaster.db`) is intentionally **not** listed in `.gitignore`. This is done to keep a consistent initial state and simplify local development. If you prefer not to track the database in version control, you may add `*.db` to `.gitignore` locally.

## Docker

Build and run frontend and backend with Docker Compose:

```bash
./run.sh
```

Or manually:

```bash
docker compose up --build -d
```

- **Frontend:** http://localhost:80  
- **Backend API:** http://localhost:8080/api  

To stop: `docker compose down`
