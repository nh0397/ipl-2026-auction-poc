# Database Operations

This folder contains SQL scripts for common database operations you may run manually.

## Files

- `sql/reset_auction_start.sql`
  - Resets auction runtime state to day zero without deleting master records.
  - Keeps `project7072@gmail.com` as Admin.

- `sql/set_project7072_admin_trigger.sql`
  - Recreates `public.handle_new_user()` so:
    - `project7072@gmail.com` is always `Admin`
    - everyone else defaults to `Viewer`
  - Existing profile rows are matched by email and updated on relogin.

## Run (destination project)

```bash
psql "postgresql://postgres.<project-ref>@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require" -W -v ON_ERROR_STOP=1 -f /absolute/path/to/sql/reset_auction_start.sql
```

```bash
psql "postgresql://postgres.<project-ref>@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require" -W -v ON_ERROR_STOP=1 -f /absolute/path/to/sql/set_project7072_admin_trigger.sql
```
