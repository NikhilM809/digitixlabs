-- Run this as the PostgreSQL superuser (usually "postgres")
-- PowerShell example:
--   & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -f scripts\setup-postgres-windows.sql

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'hrms') THEN
    CREATE USER hrms WITH PASSWORD 'hrms_password';
  ELSE
    ALTER USER hrms WITH PASSWORD 'hrms_password';
  END IF;
END
$$;

SELECT 'CREATE DATABASE digitix_hrms OWNER hrms'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'digitix_hrms')\gexec

GRANT ALL PRIVILEGES ON DATABASE digitix_hrms TO hrms;

\c digitix_hrms

GRANT ALL ON SCHEMA public TO hrms;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO hrms;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO hrms;
